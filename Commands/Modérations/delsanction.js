const Discord = require('discord.js');
const db = require('../../Events/loadDatabase');
const config = require('../../config.json');
const sendLog = require('../../Events/sendlog');

exports.help = {
  name: 'delsanction',
  sname: 'delsanction <mention/id> <nombre>',
  description: 'Permet de retirer la sanction d\'un membre',
  use: 'delsanction <mention/id> <nombre>',
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


  const user = message.mentions.users.first() || await bot.users.fetch(args[0]).catch(() => null);
  if (!user) return;

  const sanctionNumber = parseInt(args[1], 10);
  if (isNaN(sanctionNumber)) {
    return message.reply("Le numéro de sanction est invalide.");
  }

  db.all('SELECT id FROM sanctions WHERE userId = ? AND guild = ? ORDER BY date DESC', [user.id, message.guild.id], (err, rows) => {
    if (err) {
      console.error('Erreur lors de la récupération des sanctions:', err);
      return;
    }

    if (sanctionNumber < 1 || sanctionNumber > rows.length) {
      return message.reply("Le numéro de sanction est invalide.");
    }

    const sanctionToRemove = rows[sanctionNumber - 1].id;
    db.run('DELETE FROM sanctions WHERE id = ?', [sanctionToRemove], (err) => {
      if (err) {
        console.error('Erreur lors de la suppression de la sanction:', err);
        return;
      }
      db.all('SELECT id FROM sanctions WHERE userId = ? AND guild = ? ORDER BY date DESC', [user.id, message.guild.id], (err, updatedRows) => {
        if (err) {
          console.error('Erreur lors de la réorganisation des sanctions:', err);
          return;
        }

        updatedRows.forEach((row, index) => {
          db.run('UPDATE sanctions SET rowid = ? WHERE id = ?', [index + 1, row.id], (err) => {
            if (err) {
              console.error('Erreur lors de la mise à jour des sanctions:', err);
            }
          });
        });

        message.reply(`La sanction #${sanctionNumber} de <@${user.tag}> a été supprimée.`);
                const embed = new Discord.EmbedBuilder()
              .setColor(config.color)
              .setDescription(`<@${message.author.id}> a supprimé la sanction #${sanctionNumber} de <@${user.tag}> (${user.id})`)
              .setTimestamp();
        
            sendLog(message.guild, embed, 'modlog');
      });
    });
  });
};
