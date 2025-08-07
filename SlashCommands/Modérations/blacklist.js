const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../Events/loadDatabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Affiche la liste des utilisateurs blacklistés sur ce serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),

  /**
   * Exécute la commande d'affichage de la blacklist
   * @param {import('discord.js').ChatInputCommandInteraction} interaction L'interaction de commande
   */
  async execute(interaction) {
    try {
      await interaction.deferReply({ flags: 'Ephemeral' });

      // Vérifier si la table blacklist existe
      const tableExists = await new Promise((resolve) => {
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='blacklist'", [], (err, row) => {
          if (err) return resolve(false);
          resolve(!!row);
        });
      });

      if (!tableExists) {
        return interaction.editReply('Aucun utilisateur n\'est actuellement blacklisté sur ce serveur.');
      }

      // Récupérer tous les utilisateurs blacklistés pour ce serveur
      const blacklistedUsers = await new Promise((resolve, reject) => {
        db.all(
          'SELECT * FROM blacklist WHERE guild_id = ?',
          [interaction.guild.id],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      if (blacklistedUsers.length === 0) {
        return interaction.editReply('Aucun utilisateur n\'est actuellement blacklisté sur ce serveur.');
      }

      // Créer un embed pour afficher les utilisateurs blacklistés
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('📜 Liste des utilisateurs blacklistés')
        .setDescription(`**${blacklistedUsers.length}** utilisateur(s) blacklisté(s) sur ce serveur.`)
        .setTimestamp();

      // Ajouter chaque utilisateur à l'embed
      for (const entry of blacklistedUsers) {
        try {
          const user = await interaction.client.users.fetch(entry.user_id).catch(() => null);
          const moderator = await interaction.client.users.fetch(entry.moderator_id).catch(() => null);
          
          const userInfo = user ? `${user.tag} (${user.id})` : `Utilisateur inconnu (${entry.user_id})`;
          const moderatorInfo = moderator ? moderator.tag : `Modérateur inconnu (${entry.moderator_id})`;
          const timestamp = entry.timestamp ? `<t:${Math.floor(entry.timestamp / 1000)}:F>` : 'Inconnu';
          const reason = entry.reason || 'Aucune raison fournie';
          
          embed.addFields({
            name: userInfo,
            value: `🛡️ **Modérateur:** ${moderatorInfo}\n📅 **Date:** ${timestamp}\n📝 **Raison:** ${reason}`,
            inline: false
          });
        } catch (error) {
          console.error('Erreur lors de la récupération des informations utilisateur:', error);
        }
      }

      // Envoyer l'embed
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Erreur lors de l\'exécution de la commande blacklist:', error);
      await interaction.editReply('Une erreur est survenue lors de la récupération de la liste des utilisateurs blacklistés.');
    }
  },
};
