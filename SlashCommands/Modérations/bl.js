const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../Events/loadDatabase');
const config = require('../../config.json');
const sendLog = require('../../Events/sendlog');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bl')
    .setDescription('Blacklist un utilisateur du serveur')
    .addUserOption(option =>
      option.setName('utilisateur')
        .setDescription('L\'utilisateur à blacklister')
        .setRequired(true))
    .setDMPermission(false),

  /**
   * Exécute la commande de blacklist
   * @param {import('discord.js').ChatInputCommandInteraction} interaction L'interaction de commande
   */
  async execute(interaction) {
    await interaction.deferReply({ flags: 'Ephemeral' });
    
    const db = require('../../Events/loadDatabase');
    
    // Vérification des permissions personnalisées
    const hasPermission = await new Promise(async (resolve) => {
      try {
        // Vérifier si l'utilisateur est dans la whitelist
        db.get('SELECT id FROM whitelist WHERE id = ?', [interaction.user.id], (err, row) => {
          if (err) return resolve(false);
          if (row) return resolve(true);
          
          // Vérifier si l'utilisateur est owner
          db.get('SELECT id FROM owner WHERE id = ?', [interaction.user.id], (err, row) => {
            if (err) return resolve(false);
            if (row) return resolve(true);
            
            // Vérifier les rôles de l'utilisateur
            const userRoles = interaction.member.roles.cache.map(role => role.id);
            
            db.all(
              'SELECT perm FROM permissions WHERE id IN (' + userRoles.map(() => '?').join(',') + ') AND guild = ?',
              [...userRoles, interaction.guild.id],
              (err, rows) => {
                if (err || !rows.length) return resolve(false);
                
                const permissions = rows.map(row => row.perm);
                
                // Vérifier si une des permissions de l'utilisateur donne accès à cette commande
                db.all(
                  'SELECT command FROM cmdperm WHERE perm IN (' + permissions.map(() => '?').join(',') + ') AND guild = ?',
                  [...permissions, interaction.guild.id],
                  (err, cmdRows) => {
                    if (err) return resolve(false);
                    resolve(cmdRows.some(row => row.command === 'bl'));
                  }
                );
              }
            );
          });
        });
      } catch (error) {
        console.error('Erreur de vérification des permissions:', error);
        resolve(false);
      }
    });
    
    if (!hasPermission) {
      return interaction.editReply("❌ Vous n'avez pas la permission d'utiliser cette commande.");
    }
    
    const user = interaction.options.getUser('utilisateur');
    const member = interaction.guild.members.cache.get(user.id);
    
    // Vérifier si l'utilisateur est un administrateur
    if (member?.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.editReply('Vous ne pouvez pas blacklister un administrateur.');
    }
    
    // Créer ou mettre à jour la table blacklist si nécessaire
    await new Promise((resolve, reject) => {
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='blacklist'", [], (err, row) => {
        if (err) return reject(err);
        
        if (!row) {
          // Table doesn't exist, create it with all required columns
          db.run(`
            CREATE TABLE blacklist (
              user_id TEXT,
              guild_id TEXT,
              moderator_id TEXT,
              timestamp INTEGER,
              reason TEXT,
              PRIMARY KEY (user_id, guild_id)
            )
          `, (err) => err ? reject(err) : resolve());
        } else {
          // Table exists, check if it has all required columns
          db.all("PRAGMA table_info(blacklist)", (err, columns) => {
            if (err) return reject(err);
            
            const columnNames = columns.map(col => col.name);
            const requiredColumns = [
              { name: 'user_id', type: 'TEXT' },
              { name: 'guild_id', type: 'TEXT' },
              { name: 'moderator_id', type: 'TEXT' },
              { name: 'timestamp', type: 'INTEGER' },
              { name: 'reason', type: 'TEXT' }
            ];
            
            const missingColumns = requiredColumns
              .filter(col => !columnNames.includes(col.name))
              .map(col => `${col.name} ${col.type}`);
            
            if (missingColumns.length === 0) {
              resolve();
              return;
            }
            
            // If user_id or guild_id is missing, we need to recreate the table
            if (missingColumns.some(col => col.includes('user_id') || col.includes('guild_id'))) {
              // Create a backup of existing data
              db.serialize(() => {
                // Create a temp table with the correct schema
                db.run(`
                  CREATE TABLE blacklist_temp (
                    user_id TEXT,
                    guild_id TEXT,
                    moderator_id TEXT,
                    timestamp INTEGER,
                    reason TEXT,
                    PRIMARY KEY (user_id, guild_id)
                  )
                `, (err) => {
                  if (err) return reject(err);
                  
                  // Get the list of columns that exist in the old table
                  db.all("PRAGMA table_info(blacklist)", [], (err, columns) => {
                    if (err) return reject(err);
                    
                    const oldColumns = columns.map(col => col.name);
                    const safeColumns = ['user_id', 'guild_id', 'moderator_id', 'timestamp', 'reason']
                      .filter(col => oldColumns.includes(col));
                    
                    // Only include columns that exist in both tables
                    const columnsList = safeColumns.join(', ');
                    
                    // Copy only the columns that exist in both tables
                    db.run(`INSERT INTO blacklist_temp (${columnsList}) SELECT ${columnsList} FROM blacklist`, [], (err) => {
                      if (err) {
                        console.error('Could not migrate data:', err);
                        // Continue with empty table if migration fails
                        db.run('DROP TABLE blacklist', [], (dropErr) => {
                          if (dropErr) return reject(dropErr);
                          db.run('ALTER TABLE blacklist_temp RENAME TO blacklist', (renameErr) => {
                            if (renameErr) reject(renameErr);
                            else resolve();
                          });
                        });
                        return;
                      }
                      
                      // Drop the old table
                      db.run('DROP TABLE blacklist', [], (err) => {
                        if (err) return reject(err);
                        
                        // Rename temp table to original name
                        db.run('ALTER TABLE blacklist_temp RENAME TO blacklist', (err) => {
                          if (err) reject(err);
                          else resolve();
                        });
                      });
                    });
                  });
                });
              });
            } else {
              // Only add missing non-PK columns
              const alterPromises = missingColumns.map(column => 
                new Promise((res, rej) => {
                  const [colName, colType] = column.split(' ');
                  db.run(`ALTER TABLE blacklist ADD COLUMN ${colName} ${colType}`, 
                    (err) => err ? rej(err) : res());
                })
              );
              
              Promise.all(alterPromises).then(resolve).catch(reject);
            }
          });
        }
      });
    });
    
    // Vérifier si l'utilisateur est déjà blacklisté
    const isBlacklisted = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM blacklist WHERE user_id = ? AND guild_id = ?', 
        [user.id, interaction.guild.id], 
        (err, row) => {
          if (err) reject(err);
          resolve(!!row);
        }
      );
    });

    if (isBlacklisted) {
      return interaction.editReply('Cet utilisateur est déjà blacklisté.');
    }

    try {
      // Ajouter à la blacklist
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO blacklist (user_id, guild_id, moderator_id, timestamp) VALUES (?, ?, ?, ?)',
          [user.id, interaction.guild.id, interaction.user.id, Date.now()],
          (err) => {
            if (err) return reject(err);
            
            // Envoyer un log dans le modlog si activé
            const logEmbed = new EmbedBuilder()
              .setColor('#FF0000')
              .setTitle('🚫 Utilisateur blacklisté')
              .setDescription(`**${user.tag}** a été ajouté à la blacklist.`)
              .addFields(
                { name: '👤 Utilisateur', value: `${user} (${user.id})`, inline: true },
                { name: '🛡️ Modérateur', value: `${interaction.user}`, inline: true },
                { name: '📅 Date', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
              )
              .setTimestamp();

            // Envoyer le log dans le salon de logs
            sendLog(interaction.guild, logEmbed, 'modlog');
            
            resolve();
          }
        );
      });

      // Bannir l'utilisateur
      try {
        if (member) {
          await member.ban({ reason: 'Blacklist automatique' });
        }
      } catch (banError) {
        console.error('Erreur lors du bannissement:', banError);
      }

      // Créer l'embed de confirmation
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔨 Blacklist')
        .setDescription(`${user.tag} a été ajouté à la blacklist.`)
        .addFields(
          { name: 'Utilisateur', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Modérateur', value: interaction.user.tag, inline: true },
          { name: 'Date', value: new Date().toLocaleString('fr-FR'), inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ content: 'Utilisateur blacklisté avec succès.', embeds: [embed] });
      
      // Envoyer le log
      await sendLog(interaction.client, interaction.guild, 'blacklist', embed);

    } catch (error) {
      console.error('Erreur lors de la blacklist:', error);
      await interaction.editReply('Une erreur est survenue lors de la blacklist.');
    }
  },
};
