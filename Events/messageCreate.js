const db = require('../Events/loadDatabase');
const spamMap = new Map();

module.exports = {
  name: 'messageCreate',
  async execute(message, bot, config) {
    if (!message.guild || message.author.bot) return;
    await al(message);
    await antiEveryone(message);
    await antispam(message);
    await handleCommands(message, bot, config);
  },
};

const bypass = async (userId) => {
  return await new Promise(resolve => {
    db.get('SELECT id FROM owner WHERE id = ?', [userId], (err, row) => {
      if (row) return resolve(true);
      db.get('SELECT id FROM whitelist WHERE id = ?', [userId], (err2, row2) => {
        resolve(!!row2);
      });
    });
  });
};

const al = async (message) => {
  if (await bypass(message.author.id)) return;

  db.get('SELECT antilink, type FROM antiraid WHERE guild = ?', [message.guild.id], (err, row) => {
    if (err) {
      console.error('Error retrieving protections:', err);
      return;
    }

    if (row?.antilink) {
      const patern = /(?:https?|ftp):\/\/[^\s/$.?#].[^\s]*/gi;
      const blword = /(discord\.gg\/[^\s]+|discord(app)?\.com\/invite\/[^\s]+)/i;

      if (patern.test(message.content)) {
        const isInvite = blword.test(message.content);

        if ((isInvite && row.type === 'invite') || row.type === 'all') {
          message.delete().catch(console.error);
          message.channel.send(`Vous n'avez pas le droit d'envoyer des liens <@${message.author.id}>.`).then(msg => {
            setTimeout(() => {
              msg.delete().catch(console.error);
            }, 1000);
          }).catch(console.error);

          db.get('SELECT punition FROM punish WHERE guild = ? AND module = ?', [message.guild.id, 'antilink'], async (err, row) => {
            const sanction = row?.punition || 'timeout'; 

            try {
              if (sanction === 'ban') {
                await message.member.ban({ reason: 'Antilink' });
              } else if (sanction === 'kick') {
                await message.member.kick('Antilink');
              } else if (sanction === 'derank') {
                await message.member.roles.set([], 'Antilink');
              } else {
                await message.member.timeout?.(60000, 'Antilink');
              }
            } catch (error) {
              console.error('Erreur punition Antilink:', error);
            }
          });
        }
      }
    }
  });
};


 const antiEveryone = async (message) => {
  if (await bypass(message.author.id)) return;

  db.get('SELECT antieveryone FROM antiraid WHERE guild = ?', [message.guild.id], async (err, row) => {
    if (err || !row?.antieveryone) return;

    if (message.mentions.everyone) {
      try {
        await message.delete();

        const sanctionRow = await new Promise((resolve) => {
          db.get('SELECT punition FROM punish WHERE guild = ? AND module = ?', [message.guild.id, 'antieveryone'], (err2, row2) => {
            resolve(row2);
          });
        });
        const sanction = sanctionRow?.punition || 'timeout';

        const member = message.member;
        if (!member) return;

        if (sanction === 'ban') {
          await member.ban({ reason: 'AntiEveryone' });
        } else if (sanction === 'kick') {
          await member.kick('AntiEveryone');
        } else if (sanction === 'derank') {
          await member.roles.set([], 'AntiEveryone');
        } else {
          await member.timeout?.(60000, 'AntiEveryone');
        }
      } catch (error) {
        console.error('Erreur AntiEveryone:', error);
      }
    }
  }); 
}; 


const antispam = async (message) => {

  if (await bypass(message.author.id)) return;
  db.get('SELECT antispam, nombremessage, sous, timeout FROM antiraid WHERE guild = ?', [message.guild.id], async (err, row) => {
    if (err || !row?.antispam) return;

    const count = row.nombremessage || 3;
    const sous = row.sous || 10000; 
    const timeoutMs = row.timeout || 60000;  
    const now = Date.now();
    if (!spamMap.has(message.guild.id)) spamMap.set(message.guild.id, new Map());
    const guildSpam = spamMap.get(message.guild.id);

    const userTimestamps = guildSpam.get(message.author.id) || [];
    const recent = userTimestamps.filter(ts => now - ts < sous);
    recent.push(now);
    guildSpam.set(message.author.id, recent);

    if (recent.length >= count) {
      try {
        await message.member.timeout?.(timeoutMs, 'Antispam');
        message.channel.send(`<@${message.author.id}> a été timeout pour spam.`);
      } catch (e) {
        message.channel.send(`Impossible de timeout <@${message.author.id}>.`);
      }
      guildSpam.set(message.author.id, []);
    }
  db.get('SELECT punition FROM punish WHERE guild = ? AND module = ?', [message.guild.id, 'antispam'], async (err, row) => {
  const sanction = row?.punition || 'timeout'; 

  if (sanction === 'ban') {
    await message.member.ban({ reason: 'Antispam' });
  } else if (sanction === 'kick') {
    await message.member.kick('Antispam');
  } else if (sanction === 'derank') {
    await message.member.roles.set([], 'Antispam');
  } else {
    await message.member.timeout?.(60000, 'Antispam');
  }
});
  })
};

const handleCommands = async (message, bot, config) => {
  const prefixPing = () => message.reply({
    content: `Mon préfixe est \`${config.prefix}\`.`,
    allowedMentions: { repliedUser: false }
  });

  if (message.content.startsWith(`<@${bot.user.id}>`)) {
    const args = message.content.slice(`<@${bot.user.id}>`.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return prefixPing();

    const commandFile = bot.commands.get(commandName);
    if (!commandFile) return prefixPing();

    await commandFile.run(bot, message, args, config);
  } else if (message.content.startsWith(config.prefix)) {
    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    const commandFile = bot.commands.get(commandName);
    if (!commandFile) return;

    await commandFile.run(bot, message, args, config);
  }
};
