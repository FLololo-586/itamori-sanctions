const db = require('../../Events/loadDatabase');
const Discord = require('discord.js');
const config = require('../../config.json');

exports.help = {
  name: 'perms',
  sname: 'perms',
  description: "Permet de gérer les permissions",
  use: 'perms',
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



db.all('SELECT * FROM permissions WHERE guild = ?', [message.guild.id], async (err, rows) => {
  if (err) {
    return;
  }

  const embed = new Discord.EmbedBuilder()
    .setTitle('Liste des rôles par permissions')
    .setColor(config.color);

  for (let i = 1; i <= 12; i++) {
    const roles = rows.filter(row => row.perm === i).map(row => {
      const role = message.guild.roles.cache.get(row.id);
      return role ? `${role} - \`${role.id}\`` : `${row.id}`;
    });
    embed.addFields({
      name: `Permissions ${i}`,
      value: roles.length > 0 ? roles.join('\n') : ' '
    });
  }
  embed.setImage('https://media.discordapp.net/attachments/1271399515877802049/1284775059705040947/sq2.png?ex=66e7db84&is=66e68a04&hm=e00d6a85d02276604e84836207bfa3970e3d1219c1132254849db3d560656971&=&format=webp&quality=lossless&width=705&height=11');
  message.reply({ embeds: [embed] });
});
}