const { ChannelType, PermissionsBitField, EmbedBuilder } = require('discord.js');
const db = require('../Events/loadDatabase');
const sendLog = require('./sendlog.js');
const config = require('../config.json');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, bot) {
    const guildId = oldState.guild.id;

    db.get(`SELECT * FROM tempvoc WHERE guildId = ?`, [guildId], async (err, row) => {
      if (err || !row) return;

      const categoryId = row.category;
      const tempvoc = row.channel;

      if ((!oldState.channelId || oldState.channelId !== tempvoc) && newState.channelId === tempvoc) {
        const category = oldState.guild.channels.cache.get(categoryId);
        if (!category) return;

        oldState.guild.channels.create({
          name: `⏱・Salon temporaire de ${newState.member.user.username}`,
          type: ChannelType.GuildVoice,
          parent: category,
          reason: 'Salon temporaire',
          permissionOverwrites: [
            {
              id: newState.member.id,
              allow: [
                PermissionsBitField.Flags.MoveMembers,
                PermissionsBitField.Flags.MuteMembers,
                PermissionsBitField.Flags.DeafenMembers,
                PermissionsBitField.Flags.ManageChannels,
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.UseVAD,
                PermissionsBitField.Flags.Stream,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak,
                PermissionsBitField.Flags.UseSoundboard,
                PermissionsBitField.Flags.SendVoiceMessages
              ]
            },
            {
              id: newState.guild.id,
              allow: [
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak,
                PermissionsBitField.Flags.Stream,
                PermissionsBitField.Flags.UseVAD
              ]
            }
          ]
        }).then((createdChannel) => {
          newState.member.voice.setChannel(createdChannel);
        });
      }

      if (
  oldState.channel &&
  oldState.channel.parentId === categoryId &&
  oldState.channel.id !== tempvoc &&
  oldState.channel.name.startsWith('⏱・Salon temporaire de') &&
  oldState.channel.members.size === 0
) {
  const channelToDelete = oldState.channel;
  setTimeout(() => {
    const refreshed = channelToDelete.guild.channels.cache.get(channelToDelete.id);
    if (refreshed && refreshed.members.size === 0) {
      refreshed.delete({ reason: 'Salon temporaire vide' });
    }
  }, 2000);
}
    });

    db.get('SELECT channels FROM logs WHERE guild = ?', [guildId], async (err, row) => {
  if (err || !row) return;
  let channelsObj;
  try {
    channelsObj = JSON.parse(row.channels);
  } catch {
    return;
  }
  const channelId = channelsObj["📁・voice-logs"];
  if (!channelId) return;

      if (oldState.channelId !== newState.channelId) {
        if (oldState.channelId && !newState.channelId) {

          const embed = new EmbedBuilder()
            .setColor(config.color)
            .setDescription(`<@${oldState.member.id}> s'est déconnecté de <#${oldState.channelId}>`)
            .setTimestamp();
          sendLog(oldState.guild, embed, 'voicelog');
        } else if (!oldState.channelId && newState.channelId) {

          const embed = new EmbedBuilder()
            .setColor(config.color)
            .setDescription(`<@${newState.member.id}> s'est connecté à <#${newState.channelId}>`)
            .setTimestamp();
          sendLog(newState.guild, embed, 'voicelog');
        } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {

          const embed = new EmbedBuilder()
            .setColor(config.color)
            .setDescription(`<@${newState.member.id}> a quitté <#${oldState.channelId}> pour aller vers <#${newState.channelId}>`)
            .setTimestamp();
          sendLog(newState.guild, embed, 'voicelog');
        }
      }

      if (oldState.mute !== newState.mute) {
        const action = newState.mute ? "s'est mute" : "s'est démute";
        const embed = new EmbedBuilder()
          .setColor(config.color)
          .setDescription(`<@${newState.member.id}> ${action} dans <#${newState.channelId || oldState.channelId}>`)
          .setTimestamp();
        sendLog(newState.guild, embed, 'voicelog');
      }

      if (oldState.deaf !== newState.deaf) {
        const action = newState.deaf ? "s'est mute casque" : "s'est démute casque";
        const embed = new EmbedBuilder()
          .setColor(config.color)
          .setDescription(`<@${newState.member.id}> ${action} dans <#${newState.channelId || oldState.channelId}>`)
          .setTimestamp();
        sendLog(newState.guild, embed, 'voicelog');
      }
    });
  }
};