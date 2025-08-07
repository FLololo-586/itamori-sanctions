const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('../../Events/loadDatabase');
const config = require('../../config.json');

const categories = [
  'Utilitaires',
  'Modérations',
  'Gestions',
  'Logs',
  'Paramètres',
  'Informations'
];

exports.help = {
  name: 'help',
  sname: 'help [commande]',
  description: "Permet d'afficher la liste des commandes",
  use: 'help <commande>',
};

exports.run = async (bot, message, args) => {
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

  if (args[0]) {
    let commandFound = false;
    for (const category of categories) {
      const categoryPath = path.join(__dirname, `../../Commands/${category}`);
      if (!fs.existsSync(categoryPath)) continue;
      const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
      for (const file of commandFiles) {
        const command = require(`../../Commands/${category}/${file}`);
        if (command.help.name === args[0] || (command.help.aliases && command.help.aliases.includes(args[0]))) {
          const embed = new EmbedBuilder()
            .setTitle(`Commande : ${command.help.name}`)
            .setDescription(command.help.description || "Aucune description")
            .addFields(
              { name: 'Utilisation', value: `\`${config.prefix}${command.help.use}\`` },
              { name: 'Alias', value: command.help.aliases ? command.help.aliases.join(', ') : 'Aucun' }
            )
            .setColor(config.color)
            .setFooter({ text: "Itamori - Sanction" });
          await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
          commandFound = true;
          break;
        }
      }
      if (commandFound) break;
    }
    if (!commandFound) {
      const notFoundEmbed = new EmbedBuilder()
        .setTitle('Erreur')
        .setDescription(`La commande \`${args[0]}\` n'existe pas.`)
        .setColor('#6495ED')
        .setFooter({ text: "Itamori - Sanction" });
      await message.reply({ embeds: [notFoundEmbed], allowedMentions: { repliedUser: false } });
    }
    return;
  }

  const embeds = categories.map(category => {
    const categoryPath = path.join(__dirname, `../../Commands/${category}`);
    let commands = [];
    if (fs.existsSync(categoryPath)) {
      commands = fs.readdirSync(categoryPath)
        .filter(file => file.endsWith('.js'))
        .map(file => {
          const cmd = require(`../../Commands/${category}/${file}`);
          return `\`${config.prefix}${cmd.help.sname || cmd.help.name}\` : ${cmd.help.description || 'Aucune description'}`;
        });
    }
    return new EmbedBuilder()
      .setTitle(`${category}`)
      .setDescription(`Pour avoir de l’aide sur une commande, utilisez \`${config.prefix}help <commande>\`\n\n${commands.join('\n') || "C'est vide par ici..."}`)
      .setColor(config.color)
      .setFooter({ text: "Itamori - Sanction" });
  });

  const selectMenu = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('categorySelect')
        .setPlaceholder('Choisis une catégorie')
        .addOptions(categories.map((category, index) => ({
          label: category,
          value: `category_${index}`,
        })))
    );

  const msg = await message.reply({ embeds: [embeds[0]], components: [selectMenu], allowedMentions: { repliedUser: false } });

  const filter = i => i.user.id === message.author.id;
  const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

  collector.on('collect', async i => {
    if (i.customId === 'categorySelect') {
      const selectedCategoryIndex = parseInt(i.values[0].split('_')[1], 10);
      await i.update({ embeds: [embeds[selectedCategoryIndex]], components: [selectMenu] });
    }
  });

  collector.on('end', () => {
    msg.edit({ components: [] });
  });
};