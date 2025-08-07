const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const config = require('../../config.json');


exports.help = {
  name: 'activity',
  description: 'Permet de changer l\'activité du bot',
  use: 'activity <listen/play/stream/watch/compet/custom/stop> [texte]',
};

exports.run = async (bot, message, args, config, db) => {
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
    const noacces = new EmbedBuilder()
    .setDescription("Vous n'avez pas la permission d'utiliser cette commande.")
    .setColor(config.color);
  return message.reply({embeds: [noacces], allowedMentions: { repliedUser: true }});
  }

  const activityTypes = ['listen', 'play', 'stream', 'watch', 'compet', 'custom', 'stop'];
  const activityType = args[0] ? args[0].toLowerCase() : '';

  if (!activityTypes.includes(activityType)) {
    return
  }

  if (activityType === 'stop') {
    await bot.user.setActivity(null);
    return message.reply({ content: "L'activitée actuelle a bien été désactivée.", allowedMentions: { repliedUser: false } });
  }

  const activityText = args.slice(1).join(' ') || 'Sans titre';

  let activity;
  switch (activityType) {
    case 'listen':
      activity = { name: activityText, type: ActivityType.Listening };
      break;
    case 'play':
      activity = { name: activityText, type: ActivityType.Playing };
      break;
    case 'stream':
      activity = { name: activityText, type: ActivityType.Streaming };
      break;
    case 'watch':
      activity = { name: activityText, type: ActivityType.Watching };
      break;
    case 'compet':
      activity = { name: activityText, type: ActivityType.Competing };
      break;
    case 'custom':
      activity = { name: activityText, type: ActivityType.Custom };
      break;
  }

  await bot.user.setActivity(activity);
  return message.reply({ content: `L'activité du bot a bien été changée`, allowedMentions: { repliedUser: false } });
};
