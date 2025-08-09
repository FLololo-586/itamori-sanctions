const { EmbedBuilder } = require('discord.js');
const config = require('../../config.json');

exports.help = {
  name: 'uptime',
  description: "Affiche depuis combien de temps le bot est allumé (Admin uniquement)",
  use: 'uptime'
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
          ['admin', commandName, message.guild.id],
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

    const member = message.member;
    const hasPermission = member.permissions.has('ADMINISTRATOR');
    return hasPermission;
  };

  const hasPermission = await checkperm(message, 'uptime');
  if (!hasPermission) {
    const noacces = new EmbedBuilder()
      .setDescription("❌ Vous n'avez pas la permission d'utiliser cette commande.")
      .setColor(config.color);
    return message.reply({ embeds: [noacces], allowedMentions: { repliedUser: true } });
  }

  const totalSeconds = Math.floor(process.uptime());
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const uptimeString = `\🕒 **Uptime**: ${days} jours, ${hours} heures, ${minutes} minutes, ${seconds} secondes`;
  
  const embed = new EmbedBuilder()
    .setDescription(uptimeString)
    .setColor(config.color);

  message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
};
