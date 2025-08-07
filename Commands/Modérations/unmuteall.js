
const Discord = require('discord.js');
const db = require('../../Events/loadDatabase');
const config = require('../../config.json');
const sendLog = require('../../Events/sendlog');

exports.help = {
  name: 'unmuteAll',
  sname: 'unmuteAll',
  description: "Retire le timeout de tout les membres.",
  use: 'unmuteAll',
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

  try {
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

    // Fetch all members to ensure we have the latest data
    await message.guild.members.fetch();
    
    // Get all members who have the muted role
    const mutedMembers = message.guild.members.cache.filter(member => member.roles.cache.has(mutedRoleId));
    
    if (mutedMembers.size === 0) {
      return message.reply("Aucun membre n'est actuellement mute.");
    }
    
    // Remove muted role from all muted members
    let successCount = 0;
    const failedMembers = [];
    
    for (const [id, member] of mutedMembers) {
      try {
        await member.roles.remove(mutedRole);
        successCount++;
      } catch (error) {
        console.error(`Erreur lors du unmute de ${member.user.tag}:`, error);
        failedMembers.push(member.user.tag);
      }
    }
    
    // Send success message
    const successMessage = `✅ ${successCount} membre(s) ont été unmute avec succès.`;
    const failedMessage = failedMembers.length > 0 
      ? `\n❌ Échec du unmute pour ${failedMembers.length} membre(s): ${failedMembers.join(', ')}` 
      : '';
    
    message.reply(successMessage + failedMessage);
    
    // Log the action
    const embed = new Discord.EmbedBuilder()
      .setColor(config.color)
      .setDescription(`<@${message.author.id}> a unmute ${successCount} membre(s)`)
      .setTimestamp();
    
    if (failedMembers.length > 0) {
      embed.addFields({
        name: 'Échecs',
        value: `${failedMembers.length} membres n'ont pas pu être unmute`,
        inline: false
      });
    }
    
    sendLog(message.guild, embed, 'modlog');
    
  } catch (error) {
    console.error('Erreur lors du unmute de masse :', error);
    return message.reply("Une erreur est survenue lors de la tentative de unmute de masse.");
  }
};