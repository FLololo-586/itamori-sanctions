const Discord = require('discord.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const sendLog = require('./Events/sendlog');
const config = require('./config.json');
const { GiveawaysManager } = require('discord-giveaways');
const bot = new Discord.Client({ intents: 3276799, partials: [Discord.Partials.Channel, Discord.Partials.Message, Discord.Partials.User, Discord.Partials.GuildMember, Discord.Partials.Reaction, Discord.Partials.ThreadMember, Discord.Partials.GuildScheduledEvent] });
bot.commands = new Discord.Collection();
bot.slashCommands = new Discord.Collection();
bot.setMaxListeners(70);
bot.login(require('./config.json').token).then(() => { console.log(`[INFO] > ${bot.user.tag} est connecté`); }).catch(() => { console.log('\x1b[31m[!] — Please configure a valid bot token\x1b[0m'); });
bot.giveawaysManager = new GiveawaysManager(bot, {
  storage: './giveaways.json',
  updateCountdownEvery: 5000,
  default: {
    botsCanWin: false,
    embedColor: config.color,
    reaction: "🎉"
  }
});
bot.giveawaysManager.on('giveawayEnded', async (giveaway, winners) => {
  try {
    const channel = await bot.channels.fetch(giveaway.channelId);
    const message = await channel.messages.fetch(giveaway.messageId);

    setTimeout(async () => {
      const reaction = message.reactions.cache.get("🎉");
      let participantsCount = 0;
      if (reaction) {
        const users = await reaction.users.fetch();
        participantsCount = users.filter(u => !u.bot).size;
      }
      const embed = new EmbedBuilder()
        .setTitle(giveaway.prize)
        .setDescription(
          `Fin: <t:${Math.floor(giveaway.endAt / 1000)}:R> <t:${Math.floor(giveaway.endAt / 1000)}:F>\n` +
          `Organisé par: ${giveaway.hostedBy?.id || giveaway.hostedBy}\n` +
          `Participants: ${participantsCount}\n` +
          `Gagnant(s): ${winners.map(w => `<@${w.id}>`).join(', ') || "Aucun"}\n`
        )
        .setColor(config.color);
      await message.edit({ embeds: [embed], components: [] });
    }, 1000);
  } catch (error) {
    console.error("Impossible de modifier l'embed:", error);
  }
});
const commandHandler = require('./Handler/Commands.js')(bot);
const slashcommandHandler = require('./Handler/slashCommands.js')(bot);
const eventdHandler = require('./Handler/Events')(bot);
const anticrashHandler = require('./Handler/anticrash');
anticrashHandler(bot);