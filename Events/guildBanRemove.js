const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const sendLog = require('./sendlog');
const config = require('../config.json');

module.exports = {
  name: 'guildBanRemove',
  async execute(ban) {
    const { guild, user } = ban;
    let executor = null;

    try {
      const fetchedLogs = await guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberBanRemove,
      });
      const unbanLog = fetchedLogs.entries.find(entry =>
        entry.target.id === user.id &&
        Date.now() - entry.createdTimestamp < 5000
      );
      if (unbanLog) executor = unbanLog.executor;
    } catch (e) {}

    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setDescription(
        `<@${user.id}> a été débanni du serveur` +
        (executor ? ` par <@${executor.id}>` : '')
      )
      .setTimestamp();
    sendLog(guild, embed, 'modlog');
  }
};