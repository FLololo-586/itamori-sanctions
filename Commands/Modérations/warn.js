const Discord = require('discord.js');
const db = require('../../Events/loadDatabase');
const config = require('../../config.json');
const sendLog = require('../../Events/sendlog');
const { EmbedBuilder } = require('discord.js');

exports.help = {
  name: 'warn',
  sname: 'warn <mention/id> <raison>',
  description: "Permet de sanctionner un membre",
  use: 'warn <mention/id> <raison>',
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
  if (!user) {
    return message.reply("L'utilisateur n'existe pas.");
  }

  const reason = args.slice(1).join(' ');
  if (!reason) {
    return message.reply("Veuillez fournir une raison.");
  }

  const timestamp = new Date().toISOString();
  db.run(`INSERT INTO sanctions (userId, raison, date, guild) VALUES (?, ?, ?, ?)`, [user.id, reason, timestamp, message.guild.id], async function(err) {
    if (err) {
      console.error(err);
      return;
    }

    // Envoi du message à l'utilisateur en MP
    try {
      const userDM = await user.createDM();
      const dmEmbed = new EmbedBuilder()
        .setColor('#FFA500') // Orange pour un avertissement
        .setTitle('⚠️ Vous avez reçu un avertissement')
        .addFields(
          { name: 'Serveur', value: message.guild.name, inline: true },
          { name: 'Modérateur', value: `${message.author.tag} (${message.author.id})`, inline: true },
          { name: 'Raison', value: reason || 'Aucune raison fournie' },
          { name: 'Date', value: `<t:${Math.floor(new Date(timestamp).getTime() / 1000)}:F>`, inline: true }
        )
        .setTimestamp();
      
      await userDM.send({ embeds: [dmEmbed] });
    } catch (error) {
      console.error(`Impossible d'envoyer un MP à ${user.tag}:`, error);
      // On continue même si l'envoi du MP échoue
    }

    // Message de confirmation dans le salon
    message.reply(`<@${user.id}> a été averti pour: ${reason}`);
    
    // Log dans le salon de modération
    const logEmbed = new EmbedBuilder()
      .setColor(config.color)
      .setTitle('⚠️ Avertissement')
      .addFields(
        { name: 'Utilisateur', value: `${user.tag} (${user.id})`, inline: true },
        { name: 'Modérateur', value: `${message.author.tag} (${message.author.id})`, inline: true },
        { name: 'Raison', value: reason || 'Aucune raison fournie' },
        { name: 'Date', value: `<t:${Math.floor(new Date(timestamp).getTime() / 1000)}:F>`, inline: true }
      )
      .setTimestamp();
    
    sendLog(message.guild, logEmbed, 'modlog');
  });
};
