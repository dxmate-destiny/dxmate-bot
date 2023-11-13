const fs = require('fs');
const path = require('node:path');
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');

// Craete Discord Bot client instance.
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions] });

// Create collection instance.
client.commands = new Collection();

// Get directory path of all command directories.
const commandDirsDirPath = path.join(__dirname, 'commands');
console.log('Retrieved command dirs dir path:', commandDirsDirPath);

// Get command directories directory.
const commandDirsDir = fs.readdirSync(commandDirsDirPath);
console.log('Retrieved command dirs dir:', commandDirsDir);

for (const commandDir of commandDirsDir) {
    // Get command directory path.
    const commandDirPath = path.join(commandDirsDirPath, commandDir);
    console.log('Retrieved command directory path:', commandDirPath);

    // Get command files in command directory.
    const commandFiles = fs.readdirSync(commandDirPath).filter(file => file.endsWith('.js'));
    console.log('Retrieved command files:', commandFiles);

    for (const commandFile of commandFiles) {
        // Get command file path.
        const commandFilePath = path.join(commandDirPath, commandFile);
        console.log('Retrieved command file path:', commandFilePath);

        // Get command data.
        const commandData = require(commandFilePath);
        console.log('Retrieved command data.');

        if ('data' in commandData && 'execute' in commandData) {
            // Set command data.
            client.commands.set(commandData.data.name, commandData);
        } else {
            console.log(`[WARNING] The command at ${commandFilePath} is missing a required "data" or "execute" property.`);
        }
    }
}

client.once(Events.ClientReady, () => {
    console.log('DXmate Bot is ready!');
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // Get executed command.
    const command = client.commands.get(interaction.commandName);
    console.log('Received command:', command.data.name);

    if (!command) return;

    try {
        // Execute command.
        await command.execute(interaction);
        console.log('Command process completed.');
    } catch (error) {
        console.error(error);

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
    console.log(`${user.tag} added reaction: ${reaction.emoji.name}`);
});