const fs = require('fs');
const path = require('path');

module.exports = bot => {
  // Initialiser les collections et tableaux
  bot.slashCommands = new Map();
  bot.arrayOfSlashCommands = [];
  
  // Fonction pour charger les commandes d'un dossier
  const loadCommands = (dir, folder = '') => {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        // Si c'est un dossier, on le parcourt récursivement
        loadCommands(filePath, file);
      } else if (file.endsWith('.js')) {
        try {
          const command = require(filePath);
          
          // Vérifier que la commande a bien un data et une fonction execute
          if (!command.data || typeof command.execute !== 'function') {
            console.log(`[WARNING] La commande ${file} n'a pas le bon format.`);
            continue;
          }
          
          // Ajouter la commande à la collection
          bot.slashCommands.set(command.data.name, command);
          
          // Ajouter les données de la commande pour l'enregistrement
          bot.arrayOfSlashCommands.push(command.data.toJSON());
          
          console.log(`[SLASH-COMMAND] > ${file}${folder ? ` (${folder})` : ''}`);
          
        } catch (error) {
          console.error(`Erreur lors du chargement de la commande ${file}:`, error);
        }
      }
    }
  };
  
  // Charger toutes les commandes du dossier SlashCommands
  loadCommands(path.join(__dirname, '../SlashCommands'));
  
  console.log(`[INFO] ${bot.slashCommands.size} commandes slash chargées.`);
};