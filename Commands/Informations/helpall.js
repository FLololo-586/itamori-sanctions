const db = require('../../Events/loadDatabase');
const Discord = require('discord.js');
const config = require('../../config.json');

exports.help = {
  name: 'helpall',
  sname: 'helpall',
  description: "Permet d'afficher la liste des commandes par permissions",
  use: 'helpall',
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
    const noacces = new EmbedBuilder()
    .setDescription("Vous n'avez pas la permission d'utiliser cette commande.")
    .setColor(config.color);
  return message.reply({embeds: [noacces], allowedMentions: { repliedUser: true }});
  }

db.all(`SELECT * FROM cmdperm WHERE guild = ?`, [message.guild.id], (err, rows) => {
  if (err) {
    console.error('Erreur lors de la récupération des commandes:', err);
    return;
  }

  const embed = new Discord.EmbedBuilder()
    .setTitle('Liste des Commandes par Permissions')
    .setColor(config.color)
    .setFooter({ text: `${config.prefix}perms pour voir quelles permissions sont liées à chaque rôle` });

  const publicCommands = rows.filter(row => row.perm === 'public').map(row => `\`${row.command}\``);
  embed.addFields({
    name: 'Public',
    value: publicCommands.length > 0 ? publicCommands.join(', ') : ' ',
  });

  for (let i = 1; i <= 12; i++) {
    const commands = rows.filter(row => row.perm === i).map(row => `\`${row.command}\``);
    embed.addFields({
      name: `Permissions ${i}`,
      value: commands.length > 0 ? commands.join(', ') : ' '
    });
  }

  message.reply({ embeds: [embed] });
});
};
