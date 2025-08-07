const Discord = require('discord.js');
const config = require('../config.json');
const sendLog = require('./sendlog');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage, bot) {
    if (oldMessage.partial || newMessage.partial) return;
    if (oldMessage.content === newMessage.content) return; 

    const embed = new Discord.EmbedBuilder()
      .setColor(config.color)
      .setTitle('Message modifié')
      .setAuthor({
        name: oldMessage.author?.tag || ' ',
        iconURL: oldMessage.author?.displayAvatarURL() || ''
      })
      .setDescription(
        `**Auteur :** <@${oldMessage.author?.id || ' '}> (${oldMessage.author?.id || ' '})\n` +
        `**Salon :** <#${oldMessage.channel.id}>\n` +
        `**Avant :**\n${oldMessage.content ? `\`\`\`\n${oldMessage.content}\n\`\`\`` : ' '}\n` +
        `**Après :**\n${newMessage.content ? `\`\`\`\n${newMessage.content}\n\`\`\`` : ' '}`
      )
      .setTimestamp();

    sendLog(oldMessage.guild, embed, 'messagelog');
  },
};