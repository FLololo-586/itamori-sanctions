const Discord = require('discord.js');
const db = require('../../Events/loadDatabase');
const config = require('../../config.json');
const sendLog = require('../../Events/sendlog');

exports.help = {
  name: 'mute',
  sname: 'mute <mention/id> [1s/1m/1h/1d]',
  description: "Mute un membre.",
  use: 'mute <mention/id> [1s/1m/1h/1d]',
};

exports.run = async (bot, message, args, config) => {
  const checkperm = async (message, commandName) => {
    if (config.owners.includes(message.author.id)) {
      return true;
    }

const public = await new Promise((resolve, reject) => {
  db.get('SELECT statut FROM public WHERE guild = ? AND statut = ?', [message.guild.id, 'on'], (err, row) => {
    if (err) reject(err);
    resolve(!!row);
  });
});

if (public) {

  const publiccheck = await new Promise((resolve, reject) => {
    db.get(
      'SELECT command FROM cmdperm WHERE perm = ? AND command = ? AND guild = ?',
      ['public', commandName, message.guild.id],
      (err, row) => {
        if (err) reject(err);
        resolve(!!row);
      }
    );
  });

  if (publiccheck) {
    return true;
  }
}
    
    try {
      const userwl = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM whitelist WHERE id = ?', [message.author.id], (err, row) => {
          if (err) reject(err);
          resolve(!!row);
        });
      });

      if (userwl) {
        return true;
      }

            const userowner = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM owner WHERE id = ?', [message.author.id], (err, row) => {
          if (err) reject(err);
          resolve(!!row);
        });
      });

      if (userowner) {
        return true;
      }

      const userRoles = message.member.roles.cache.map(role => role.id);

      const permissions = await new Promise((resolve, reject) => {
        db.all('SELECT perm FROM permissions WHERE id IN (' + userRoles.map(() => '?').join(',') + ') AND guild = ?', [...userRoles, message.guild.id], (err, rows) => {
          if (err) reject(err);
          resolve(rows.map(row => row.perm));
        });
      });

      if (permissions.length === 0) {
        return false;
      }

      const cmdwl = await new Promise((resolve, reject) => {
        db.all('SELECT command FROM cmdperm WHERE perm IN (' + permissions.map(() => '?').join(',') + ') AND guild = ?', [...permissions, message.guild.id], (err, rows) => {
          if (err) reject(err);
          resolve(rows.map(row => row.command));
        });
      });

      return cmdwl.includes(commandName);
    } catch (error) {
      console.error('Erreur lors de la vérification des permissions:', error);
      return false;
    }
  };

  if (!(await checkperm(message, exports.help.name))) {
    const noacces = new Discord.EmbedBuilder()
    .setDescription("Vous n'avez pas la permission d'utiliser cette commande.")
    .setColor(config.color);
  return message.reply({embeds: [noacces], allowedMentions: { repliedUser: true }});
  }

  const member = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
  if (!member) {
    return message.reply("Utilisateur introuvable.");
  }

  // Get the muted role ID from config
  const mutedRoleId = config.mutedRole;
  if (!mutedRoleId) {
    return message.reply("Aucun rôle de mute n'est configuré. Veuillez définir un rôle dans la configuration.");
  }

  // Find the muted role
  const mutedRole = message.guild.roles.cache.get(mutedRoleId);
  if (!mutedRole) {
    return message.reply("Le rôle de mute configuré est introuvable. Veuillez vérifier la configuration.");
  }

  try {
    // Check if user already has the muted role
    if (member.roles.cache.has(mutedRoleId)) {
      return message.reply(`<@${member.id}> est déjà mute.`);
    }

    // Parse duration from args[1] if it exists
    const duration = args[1];
    let durationText = '';
    let durationMs = 0;
    let unmuteTime = null;
    
    if (duration) {
      const match = duration.match(/^(\d+)(s|m|h|d)$/);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2];
        
        // Calculate duration in milliseconds
        switch (unit) {
          case 's': 
            durationMs = value * 1000;
            durationText = `pour ${value} seconde${value > 1 ? 's' : ''}`; 
            break;
          case 'm': 
            durationMs = value * 60 * 1000;
            durationText = `pour ${value} minute${value > 1 ? 's' : ''}`; 
            break;
          case 'h': 
            durationMs = value * 60 * 60 * 1000;
            durationText = `pour ${value} heure${value > 1 ? 's' : ''}`; 
            break;
          case 'd': 
            durationMs = value * 24 * 60 * 60 * 1000;
            durationText = `pour ${value} jour${value > 1 ? 's' : ''}`; 
            break;
        }
        
        unmuteTime = Date.now() + durationMs;
      } else {
        return message.reply("Format de durée invalide. Utilisez: 10s, 5m, 2h, 1d");
      }
    }
    
    // Get user's current roles (except @everyone)
    const userRoles = member.roles.cache
      .filter(role => role.id !== message.guild.id && role.id !== mutedRole.id)
      .map(role => role.id);
    
    // Store roles as JSON string
    const rolesJson = JSON.stringify(userRoles);
    
    try {
      // Store mute info in database with roles
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO mutes (user_id, guild_id, end_time, roles) VALUES (?, ?, ?, ?)',
          [member.id, message.guild.id, unmuteTime || null, rolesJson],
          (err) => err ? reject(err) : resolve()
        );
      });
      
      // Remove all roles except @everyone and add muted role
      await member.roles.set([mutedRole]);
        
      if (unmuteTime) {
        // Set timeout to unmute user
        const unmuteTimeout = setTimeout(async () => {
          try {
            const memberToUnmute = await message.guild.members.fetch(member.id).catch(() => null);
            if (memberToUnmute && memberToUnmute.roles.cache.has(mutedRole.id)) {
              // Get the mute record from database to restore roles
              const muteRecord = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM mutes WHERE user_id = ? AND guild_id = ?', 
                  [member.id, message.guild.id],
                  (err, row) => err ? reject(err) : resolve(row || null)
                );
              });
              
              // Remove muted role
              await memberToUnmute.roles.remove(mutedRole);
              
              // Restore previous roles if they exist
              if (muteRecord?.roles) {
                try {
                  const rolesToRestore = JSON.parse(muteRecord.roles);
                  // Filter out any roles that no longer exist
                  const validRoles = rolesToRestore.filter(roleId => 
                    message.guild.roles.cache.has(roleId) && 
                    roleId !== message.guild.id && // Don't add @everyone
                    roleId !== mutedRole.id // Don't add muted role back
                  );
                  
                  if (validRoles.length > 0) {
                    await memberToUnmute.roles.add(validRoles);
                  }
                } catch (error) {
                  console.error('Error restoring roles on auto-unmute:', error);
                }
              }
              
              // Delete from mutes table
              await new Promise((resolve, reject) => {
                db.run('DELETE FROM mutes WHERE user_id = ? AND guild_id = ?', 
                  [member.id, message.guild.id],
                  (err) => err ? reject(err) : resolve()
                );
              });
              
              const unmuteEmbed = new Discord.EmbedBuilder()
                .setColor(config.color)
                .setDescription(`🔊 <@${member.id}> a été automatiquement unmute après ${durationText}`)
                .setTimestamp();
              
              sendLog(message.guild, unmuteEmbed, 'modlog');
            }
          } catch (error) {
            console.error('Erreur lors du unmute automatique:', error);
          }
        }, durationMs);

        // Store the timeout in case we need to clear it later
        bot.muteTimeouts = bot.muteTimeouts || new Map();
        bot.muteTimeouts.set(`${message.guild.id}-${member.id}`, unmuteTimeout);
      }
      
      message.reply(`<@${member.id}> a été mute ${durationText || 'indéfiniment'}.`);
      const embed = new Discord.EmbedBuilder()
        .setColor(config.color)
        .setDescription(`<@${message.author.id}> a mute <@${member.id}> (${member.id}) ${durationText || 'indéfiniment'}`)
        .addFields(
          { name: 'Durée', value: durationText || 'Indéfinie', inline: true },
          { name: 'Fin du mute', value: unmuteTime ? `<t:${Math.floor(unmuteTime / 1000)}:R>` : 'Jamais', inline: true }
        )
        .setTimestamp();
      
      sendLog(message.guild, embed, 'modlog');
    } catch (error) {
      console.error('Erreur lors du mute :', error);
      return message.reply("Impossible de mute. Vérifiez que le bot a les permissions nécessaires.");
    }
  } catch (error) {
    console.error('Erreur lors du mute :', error);
    return message.reply("Impossible de mute. Vérifiez que le bot a les permissions nécessaires.");
  }
};