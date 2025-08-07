const { EmbedBuilder } = require('discord.js');
const Discord = require('discord.js');
const db = require('../../Events/loadDatabase');
const config = require('../../config.json');
const sendLog = require('../../Events/sendlog');

exports.help = {
  name: 'unmute',
  sname: 'unmute <mention/id>',
  description: "Retire le timeout d'un membre.",
  use: 'unmute <mention/id>',
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
    // Check if user has the muted role
    if (!member.roles.cache.has(mutedRoleId)) {
      return message.reply(`<@${member.id}> n'est pas mute.`);
    }

    // Get the mute record from database
    const muteRecord = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM mutes WHERE user_id = ? AND guild_id = ?', 
        [member.id, message.guild.id],
        (err, row) => err ? reject(err) : resolve(row || null)
      );
    });

    // Remove the muted role
    await member.roles.remove(mutedRole);
    
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
          await member.roles.add(validRoles);
        }
      } catch (error) {
        console.error('Error restoring roles:', error);
      }
    }
    
    // Remove from mutes table
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM mutes WHERE user_id = ? AND guild_id = ?', 
        [member.id, message.guild.id],
        (err) => err ? reject(err) : resolve()
      );
    });
    
    message.reply(`<@${member.id}> a été unmute et ses rôles ont été restaurés.`);
    const embed = new Discord.EmbedBuilder()
      .setColor(config.color)
      .setDescription(`<@${message.author.id}> a unmute <@${member.id}> (${member.id})`)
      .addFields(
        { name: 'Rôles restaurés', value: muteRecord?.roles ? JSON.parse(muteRecord.roles).length.toString() : 'Aucun', inline: true }
      )
      .setTimestamp();
    
    sendLog(message.guild, embed, 'modlog');
  } catch (error) {
    console.error('Erreur lors du unmute :', error);
    return message.reply("Impossible de unmute. Vérifiez que le bot a les permissions nécessaires.");
  }
};