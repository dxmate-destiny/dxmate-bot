const fs = require('fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

const commands = [];

// Get command directories directory path.
const commandDirsDirPath = path.join(__dirname, 'commands');
console.log('Retrieved command dirs dir path:', commandDirsDirPath);

// Get command directories directory.
const commandDirsDir = fs.readdirSync(commandDirsDirPath);
console.log('Retrieved command dirs dir:', commandDirsDir);

for (const commandDir of commandDirsDir) {
    // Get command directory path.
    const commandDirPath = path.join(commandDirsDirPath, commandDir);
    console.log('Retrieved command dir path:', commandDirPath);

    // Get command files in command directory.
    const commandFiles = fs.readdirSync(commandDirPath).filter(file => file.endsWith('.js'));
    console.log('Retrieved command files:', commandFiles);

    for (const commandFile of commandFiles) {
        // Get command file path.
        const commandFilePath = path.join(commandDirPath, commandFile);
        console.log('Retrieved command file path:', commandFilePath);

        // Get command data.
        const commandData = require(commandFilePath);
        console.log('Retrievd command data:', commandData);

        if ('data' in commandData && 'execute' in commandData) {
            commands.push(commandData.data.toJSON());
        } else {
            console.log(`[WARNING] The command at ${commandFilePath} is missing a required "data" or "execute" property.`);
        }
    }
}

// Create rest instance using token.
const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);

// Deploy commands.
(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // The put method is used to fully refresh all commands in the guild with the current set.
		const data = await rest.put(
			Routes.applicationGuildCommands(process.env.DISCORD_BOT_CLIENT_ID, process.env.DXMATE_DISCORD_SERVER_GUILD_ID),
			{ body: commands },
		);

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();