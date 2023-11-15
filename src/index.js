const fs = require('fs');
const path = require('node:path');
const { Client, GatewayIntentBits, Collection, Events, EmbedBuilder } = require('discord.js');
const { default: axios } = require('axios');

// Get DXmate API base URL.
const dxmateApiBaseUrl = process.env.DXMATE_API_BASE_URL;

// Create Discord Bot client instance.
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

    if (user.bot) return;

    // Get reacted message.
    const message = reaction.message;

    if (!message.author.bot) return;

    if (!message.interaction) return;

    // Get command.
    const commandName = message.interaction.commandName;
    console.log('Retrieved Command Name:', commandName);

    if (commandName !== 'matchmake') return;

    // Get Report ID (Message ID).
    const reportId = message.id;
    console.log('Retrieved Report ID:', reportId);

    // Get Report data.
    const getReportDataResponse = await axios.get(dxmateApiBaseUrl + `/reports/${reportId}`);
    console.log('Retrieved Report data:', getReportDataResponse.data);

    if (getReportDataResponse.data.matchMode.includes('unranked')) return;

    if (getReportDataResponse.data.matchMode.includes('singles')) {

        if (reaction.emoji.name === '1️⃣') {
            // Get emoji count.
            const reactionCount = message.reactions.cache.get('1️⃣').count;
            console.log(`Reaction ${reaction.emoji.name} count:`, reactionCount);

            if (reactionCount === 3) {
                // Get Winner Discord ID.
                const winnerDiscordId = getReportDataResponse.data['1️⃣'];
                console.log('Winner Discord ID:', winnerDiscordId);

                // Get Loser Discord ID.
                const loserDiscordId = getReportDataResponse.data['2️⃣'];
                console.log('Loser Discord ID:', loserDiscordId);

                // Get room data.
                const getRoomDataResponse = await axios.get(dxmateApiBaseUrl + `/rooms/${getReportDataResponse.data.roomId}`);
                console.log('Retrieved Room data:', getRoomDataResponse.data);

                // Get players field.
                const players = getRoomDataResponse.data.players;

                // Get Winner player data.
                const winnerPlayerData = players.find(player => player.discordUserData.id === winnerDiscordId);
                console.log('Retrieved winner player data:', winnerPlayerData);

                // Get Loser player data.
                const loserPlayerData = players.find(player => player.discordUserData.id === loserDiscordId);
                console.log('Retrieved loser player data:', loserPlayerData);

                // Get winner skill.
                const winnerSkill = winnerPlayerData.skill.singles;
                console.log('Retrieved winner skill:', winnerSkill);

                // Get loser skill.
                const loserSkill = loserPlayerData.skill.singles;
                console.log('Retrieved loser skill:', loserSkill);

                // Update skill.
                const updateSkillResponse = await axios.post(dxmateApiBaseUrl + '/skill/update', {
                    winnerSkill,
                    loserSkill
                });
                console.log('Updated skill:', updateSkillResponse.data);

                // Save updated skill.
                await axios.post(dxmateApiBaseUrl + '/players/skill/update', {
                    discordId: winnerDiscordId,
                    skill: updateSkillResponse.data.winner
                });
                console.log('Saved updated winner skill.');

                await axios.post(dxmateApiBaseUrl + '/players/skill/update', {
                    discordId: loserDiscordId,
                    skill: updateSkillResponse.data.loser
                });
                console.log('Saved updated loser skill.');

                // Get updated Rank Points.
                const getWinnerRankPointsResponse = await axios.get(dxmateApiBaseUrl + '/rank', {
                    params: {
                        mu: updateSkillResponse.data.winner.mu,
                        sigma: updateSkillResponse.data.winner.sigma
                    }
                });
                console.log('Retrieved Updated winner Rank data:', getWinnerRankPointsResponse.data);

                // Get updated Rank Points.
                const getLoserRankPointsResponse = await axios.get(dxmateApiBaseUrl + '/rank', {
                    params: {
                        mu: updateSkillResponse.data.loser.mu,
                        sigma: updateSkillResponse.data.loser.sigma
                    }
                });
                console.log('Retrieved Updated winner Rank data:', getLoserRankPointsResponse.data);

                // Create match result embed.
                const matchResultEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('Ranked Singles Result')
                .addFields(
                    { name: 'Winner', value: `<@${winnerDiscordId}>`, inline: true },
                    { name: 'Before Rank', value: `${winnerPlayerData.rankData.name} ${winnerPlayerData.rankData.points} RP`, inline: true },
                    { name: 'After Rank', value: `${getWinnerRankPointsResponse.data.name} ${getWinnerRankPointsResponse.data.points} RP`, inline: true },
                    { name: 'Loser', value: `<@${loserDiscordId}>`, inline: true },
                    { name: 'Before Rank', value: `${loserPlayerData.rankData.name} ${loserPlayerData.rankData.points} RP`, inline: true },
                    { name: 'After Rank', value: `${getLoserRankPointsResponse.data.name} ${getLoserRankPointsResponse.data.points} RP`, inline: true }
                );

                // Get channel.
                const channel = reaction.message.channel;

                // Send match result embed.
                return await channel.send({ embeds: [matchResultEmbed] });
            }
        } else if (reaction.emoji.name === '2️⃣') {
        }
    } else {

    }
});

// Log in to Discord.
client.login(process.env.DISCORD_BOT_TOKEN);