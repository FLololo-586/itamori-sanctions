const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database.sqlite3');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err);
    throw err;
  }
  dbcreate();
});

const dbcreate = () => {
  db.serialize(() => {
    const dbcreate = [
      `CREATE TABLE IF NOT EXISTS whitelist (id TEXT PRIMARY KEY)`,
      `CREATE TABLE IF NOT EXISTS owner (id TEXT PRIMARY KEY)`,
      `CREATE TABLE IF NOT EXISTS blacklist (
        user_id TEXT,
        guild_id TEXT,
        moderator_id TEXT,
        timestamp INTEGER,
        reason TEXT,
        PRIMARY KEY (user_id, guild_id)
      )`,
      `CREATE TABLE IF NOT EXISTS ghostping (guild TEXT PRIMARY KEY, channels TEXT)`,
      `CREATE TABLE IF NOT EXISTS soutien (guild TEXT PRIMARY KEY, id TEXT, texte TEXT)`,
      `CREATE TABLE IF NOT EXISTS public (statut TEXT, guild TEXT, PRIMARY KEY (statut, guild))`,
      `CREATE TABLE IF NOT EXISTS permissions (perm INTEGER, id TEXT, guild TEXT, PRIMARY KEY (perm, id, guild))`,
      `CREATE TABLE IF NOT EXISTS cmdperm (perm INTEGER, command TEXT, guild TEXT, PRIMARY KEY (perm, command, guild))`,
      `CREATE TABLE IF NOT EXISTS sanctions (id INTEGER PRIMARY KEY AUTOINCREMENT, userId TEXT, raison TEXT, date TEXT, guild TEXT)`,
      `CREATE TABLE IF NOT EXISTS logs (guild TEXT PRIMARY KEY, channels TEXT)`,
      `CREATE TABLE IF NOT EXISTS punish (guild TEXT, module TEXT,punition TEXT,PRIMARY KEY (guild, module))`,
      `CREATE TABLE IF NOT EXISTS tempvoc (guildId TEXT PRIMARY KEY, channel TEXT, category TEXT)`,
      `CREATE TABLE IF NOT EXISTS Confess (guildId TEXT PRIMARY KEY, channel TEXT)`,
      `CREATE TABLE IF NOT EXISTS confesslogs (guildId TEXT, userId TEXT, message TEXT)`,
      `CREATE TABLE IF NOT EXISTS Suggest (guildId TEXT PRIMARY KEY, channel TEXT)`,
      `CREATE TABLE IF NOT EXISTS joinsettings (guildId TEXT PRIMARY KEY, channel TEXT, message TEXT)`,
      `CREATE TABLE IF NOT EXISTS captcha (guild TEXT PRIMARY KEY, id TEXT)`,
      `CREATE TABLE IF NOT EXISTS antiraid (
  guild TEXT PRIMARY KEY, 
  antilink INTEGER DEFAULT 0, 
  type TEXT DEFAULT 'all',
  antispam INTEGER DEFAULT 0,
  nombremessage INTEGER DEFAULT 3,
  sous INTEGER DEFAULT 10,
  timeout INTEGER DEFAULT 60000,
  antichannel INTEGER DEFAULT 0,
  antivanity INTEGER DEFAULT 0,
  antiwebhook INTEGER DEFAULT 0,
  antibot INTEGER DEFAULT 0,
  antieveryone INTEGER DEFAULT 0,
  antirole INTEGER DEFAULT 0,
  antiban INTEGER DEFAULT 0,
  antiupdate INTEGER DEFAULT 0
)`
    ];

    dbcreate.forEach(query => {
      db.run(query);
    });
  });
};

module.exports = db;