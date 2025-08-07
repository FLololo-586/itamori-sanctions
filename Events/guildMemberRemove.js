const { AuditLogEvent, EmbedBuilder } = require('discord.js');
const config = require('../config.json');
const sendLog = require('./sendlog');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    const fetchedLogs = await member.guild.fetchAuditLogs({
      limit: 1,
      type: AuditLogEvent.MemberKick,
    });
    const kickLog = fetchedLogs.entries.first();
    if (kickLog && kickLog.target.id === member.id && Date.now() - kickLog.createdTimestamp < 5000) {
      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setDescription(`<@${member.id}> a été kick par <@${kickLog.executor.id}>`)
        .setTimestamp();
      sendLog(member.guild, embed, 'modlog');
    }
  }
};