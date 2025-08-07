const Discord = require('discord.js');
const db = require('../../Events/loadDatabase');
const { formatDistanceToNow, parseISO, isToday, isYesterday } = require('date-fns');
const { fr } = require('date-fns/locale');
const config = require('../../config.json');

const ITEMS_PER_PAGE = 5;

const generateFooterDate = (date) => {
  const now = new Date();
  const parsedDate = parseISO(date);

  if (isToday(parsedDate)) {
    return `Aujourd'hui à ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (isYesterday(parsedDate)) {
    return `Hier à ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    return `${new Date(date).toLocaleDateString()} à ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
};

exports.help = {
  name: 'sanction',
  sname: 'sanction [mention/id]',
  description: 'Permet de voir la liste des sanctions d\'un membre',
  use: 'sanction [mention/id]',
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
  if (!user) return message.reply("L'utilisateur n'existe pas");

  db.all('SELECT id, reason, date FROM sanctions WHERE userId = ? AND guild = ? ORDER BY date DESC', [user.id, message.guild.id], async (err, rows) => {
    if (err) {
      console.error('Erreur lors de la récupération des sanctions:', err);
      return;
    }

    if (rows.length === 0) return message.reply(`${user.tag} n'a aucune sanction.`);

    const totalPages = Math.ceil(rows.length / ITEMS_PER_PAGE);
    let currentPage = 1;

    const generateEmbed = (page) => {
      const embed = new Discord.EmbedBuilder()
        .setTitle(`Sanctions de ${user.tag}`)
        .setColor(config.color)
        .setFooter({ text: `Page ${page} sur ${totalPages}` });

      const start = (page - 1) * ITEMS_PER_PAGE;
      const end = Math.min(start + ITEMS_PER_PAGE, rows.length);

      for (let i = start; i < end; i++) {
        embed.addFields({
          name: `**Sanction #${i + 1}**`,
          value: `**Date** : ${formatDistanceToNow(parseISO(rows[i].date), { locale: fr, addSuffix: true })}\n` +
                 `**Raison** : ${rows[i].reason}`
        });
      }

      return embed;
    };

    const embed = generateEmbed(currentPage);

    const row = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.ButtonBuilder()
          .setCustomId('prev')
          .setLabel('Précédent')
          .setStyle('Secondary')
          .setDisabled(currentPage === 1),
        new Discord.ButtonBuilder()
          .setCustomId('next')
          .setLabel('Suivant')
          .setStyle('Secondary')
          .setDisabled(currentPage === totalPages)
      );

    const reply = await message.reply({ embeds: [embed], components: [row], allowedMentions: { repliedUser: false } });

    const filter = i => i.user.id === message.author.id;
    const collector = reply.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async interaction => {
      if (interaction.customId === 'prev') {
        currentPage--;
      } else if (interaction.customId === 'next') {
        currentPage++;
      }

      const newEmbed = generateEmbed(currentPage);

      const newRow = new Discord.ActionRowBuilder()
        .addComponents(
          new Discord.ButtonBuilder()
            .setCustomId('prev')
            .setLabel('Précédent')
            .setStyle('Secondary')
            .setDisabled(currentPage === 1),
          new Discord.ButtonBuilder()
            .setCustomId('next')
            .setLabel('Suivant')
            .setStyle('Secondary')
            .setDisabled(currentPage === totalPages)
        );

      await interaction.update({ embeds: [newEmbed], components: [newRow] });
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        reply.edit({ components: [] });
      }
    });
  });
};