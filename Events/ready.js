const { ActivityType } = require('discord.js');
const db = require('./loadDatabase');
const config = require('../config.json');
const sendLog = require('./sendlog');

// Create or update mutes table
const createMutesTable = () => {
  return new Promise((resolve, reject) => {
    // First, check if the table exists
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='mutes'", [], async (err, row) => {
      if (err) return reject(err);
      
      if (!row) {
        // Table doesn't exist, create it with all columns
        db.run(`
          CREATE TABLE mutes (
            user_id TEXT,
            guild_id TEXT,
            end_time INTEGER,
            roles TEXT DEFAULT '[]',
            PRIMARY KEY (user_id, guild_id)
          )
        `, (err) => err ? reject(err) : resolve());
      } else {
        // Table exists, check if it has the roles column
        db.all("PRAGMA table_info(mutes)", [], (err, columns) => {
          if (err) return reject(err);
          
          // S'assurer que columns est un tableau
          const columnArray = Array.isArray(columns) ? columns : [];
          const hasRolesColumn = columnArray.some(col => col && col.name === 'roles');
          
          if (!hasRolesColumn) {
            // Add roles column if it doesn't exist
            db.run('ALTER TABLE mutes ADD COLUMN roles TEXT DEFAULT "[]"', 
              (err) => err ? reject(err) : resolve());
          } else {
            resolve();
          }
        });
      }
    });
  });
};

// Check and handle active mutes on startup
const checkActiveMutes = async (bot) => {
  try {
    const now = Date.now();
    
    // Get all active mutes
    const mutes = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM mutes WHERE end_time > ?', [now], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    for (const mute of mutes) {
      try {
        const guild = bot.guilds.cache.get(mute.guild_id);
        if (!guild) continue;
        
        const member = await guild.members.fetch(mute.user_id).catch(() => null);
        if (!member) continue;
        
        const mutedRole = guild.roles.cache.get(config.mutedRole);
        if (!mutedRole) continue;
        
        // If the member doesn't have the muted role, skip
        if (!member.roles.cache.has(mutedRole.id)) {
          await db.run('DELETE FROM mutes WHERE user_id = ? AND guild_id = ?', 
            [mute.user_id, mute.guild_id]);
          continue;
        }
        
        const timeLeft = mute.end_time - now;
        
        // Set timeout to unmute the user and restore roles
        setTimeout(async () => {
          try {
            const memberToUnmute = await guild.members.fetch(mute.user_id).catch(() => null);
            if (memberToUnmute && memberToUnmute.roles.cache.has(mutedRole.id)) {
              // Remove muted role
              await memberToUnmute.roles.remove(mutedRole);
              
              // Restore previous roles if they exist
              if (mute.roles) {
                try {
                  const rolesToRestore = JSON.parse(mute.roles);
                  const validRoles = rolesToRestore.filter(roleId => 
                    guild.roles.cache.has(roleId) && 
                    roleId !== guild.id && // Don't add @everyone
                    roleId !== mutedRole.id // Don't add muted role back
                  );
                  
                  if (validRoles.length > 0) {
                    await memberToUnmute.roles.add(validRoles);
                  }
                } catch (error) {
                  console.error('Error restoring roles on auto-unmute:', error);
                }
              }
              
              const unmuteEmbed = new Discord.EmbedBuilder()
                .setColor(config.color)
                .setDescription(`🔊 <@${mute.user_id}> a été automatiquement unmute après la durée prévue`)
                .setTimestamp();
              
              sendLog(guild, unmuteEmbed, 'modlog');
            }
          } catch (error) {
            console.error('Erreur lors du unmute automatique:', error);
          } finally {
            db.run('DELETE FROM mutes WHERE user_id = ? AND guild_id = ?', 
              [mute.user_id, mute.guild_id]);
          }
        }, timeLeft);
        
      } catch (error) {
        console.error('Erreur lors du traitement du mute:', error);
      }
    }
  } catch (error) {
    console.error('Erreur lors de la vérification des mutes actifs:', error);
  }
};

module.exports = {
  name: 'ready',
  async execute(bot) {
    // Initialize database
    await createMutesTable();
    
    // Set bot presence
    await bot.user.setPresence({
      activities: [{ 
        name: 'Itamori - Sanction', 
        type: ActivityType.Streaming, 
        url: 'https://twitch.tv/4wipyk'
      }], 
      status: 'online'
    });
    
    // Register slash commands
    await bot.application.commands.set(bot.arrayOfSlashCommands);
    
    // Check for active mutes
    await checkActiveMutes(bot);
    
    console.log(`Connecté en tant que ${bot.user.tag}`);
  }
};
