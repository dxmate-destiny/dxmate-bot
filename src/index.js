const fs = require('fs');
const path = require('node:path');
const { Client, GatewayIntentBits, Collection, Events, EmbedBuilder, Emoji } = require('discord.js');
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

    // Get room data.
    const getRoomDataResponse = await axios.get(dxmateApiBaseUrl + `/rooms/${getReportDataResponse.data.roomId}`);
    console.log('Retrieved room data:', getRoomDataResponse.data);

    // Get emoji.
    const emoji = reaction.emoji.name;
    console.log('Emoji:', emoji);

    if (emoji === '1️⃣' || emoji === '2️⃣') {

        if (getReportDataResponse.data.matchMode !== 'ranked_singles') return;

        // Get reaction count.
        const player1ReactionCount = message.reactions.cache.get('1️⃣').count;
        console.log('1️⃣ reaction count:', player1ReactionCount);

        const player2ReactionCount = message.reactions.cache.get('2️⃣').count;
        console.log('2️⃣ reaction count:', player2ReactionCount);

        if (player1ReactionCount !== 3 && player2ReactionCount !== 3) return;

        let winnerDiscordId;
        let loserDiscordId;

        // Get Discord ID.
        if (player1ReactionCount === 3) {
            winnerDiscordId = getReportDataResponse.data['1️⃣'];
            loserDiscordId = getReportDataResponse.data['2️⃣'];
        } else {
            winnerDiscordId = getReportDataResponse.data['2️⃣'];
            loserDiscordId = getReportDataResponse.data['1️⃣'];
        }

        console.log('Retrieved winner Discord ID:', winnerDiscordId);
        console.log('Retrieved loser Discord ID:', loserDiscordId);

        // Get player data.
        const winnerPlayerData = getRoomDataResponse.data.players.find(player => player.discordUserData.id === winnerDiscordId);
        const loserPlayerData = getRoomDataResponse.data.players.find(player => player.discordUserData.id === loserDiscordId);
        console.log('Retrieved winner player data:', winnerPlayerData);
        console.log('Retrieved loser player data:', loserPlayerData);

        // Get before skill.
        const winnerBeforeSkill = winnerPlayerData.dxmatePlayerData.skill.singles;
        const loserBeforeSkill = loserPlayerData.dxmatePlayerData.skill.singles;
        console.log('Retrieved winner before skill:', winnerBeforeSkill);
        console.log('Retrieved loser before skill:', loserBeforeSkill);

        // Update skill.
        const updateSkillResponse = await axios.post(dxmateApiBaseUrl + '/skill/singles/update', {
            winnerSkill: winnerBeforeSkill,
            loserSkill: loserBeforeSkill
        });
        console.log('Updated skill:', updateSkillResponse.data);

        // Get updated skill.
        const winnerAfterSkill = updateSkillResponse.data.winner;
        const loserAfterSkill = updateSkillResponse.data.loser;

        // Save updated skill.
        await axios.post(dxmateApiBaseUrl + '/players/skill/update', {
            discordId: winnerDiscordId,
            skill: winnerAfterSkill
        });

        await axios.post(dxmateApiBaseUrl + '/players/skill/update', {
            discordId: winnerDiscordId,
            skill: loserAfterSkill
        });
        console.log('Saved updated skill.');

        // Get before Rank data.
        const winnerBeforeRankData = winnerPlayerData.rankData;
        const loserBeforeRankData = loserPlayerData.rankData;

        // Get updated Rank Data.
        const getWinnerAfterRankDataResponse = await axios.get(dxmateApiBaseUrl + '/rank', {
            params: {
                mu: winnerAfterSkill.mu,
                sigma: winnerAfterSkill.sigma
            }
        });

        const getLoserAfterRankDataResponse = await axios.get(dxmateApiBaseUrl + '/rank', {
            params: {
                mu: loserAfterSkill.mu,
                sigma: loserAfterSkill.sigma
            }
        });

        const winnerAfterRankData = getWinnerAfterRankDataResponse.data;
        const loserAfterRankData = getLoserAfterRankDataResponse.data;

        console.log('Retrieved winner updated Rank data:', getWinnerAfterRankDataResponse.data);
        console.log('Retrieved loser Rank data:', getLoserAfterRankDataResponse.data);

        // Delete room.
        await axios.post(dxmateApiBaseUrl + '/rooms/delete', {
            roomId: getReportDataResponse.data.roomId
        });
        console.log('Deleted room data.');
        
        // Delete report data.
        await axios.post(dxmateApiBaseUrl + '/reports/delete', {
            reportId
        });
        console.log('Deleted report data.');

        // Create match result embed.
        const matchResultEmbed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Ranked Singles Result')
        .addFields(
            { name: 'Winner', value: `<@${winnerDiscordId}>`, inline: true },
            { name: 'Before Rank', value: `${winnerBeforeRankData.name} ${winnerBeforeRankData.points} RP`, inline: true },
            { name: 'After Rank', value: `${winnerAfterRankData.name} ${winnerAfterRankData.points} RP`, inline: true },
            { name: 'Loser', value: `<@${loserDiscordId}>`, inline: true },
            { name: 'Before Rank', value: `${loserBeforeRankData.name} ${loserBeforeRankData.points} RP`, inline: true },
            { name: 'After Rank', value: `${loserAfterRankData.name} ${loserAfterRankData.points} RP`, inline: true }
        );

        // Get channel.
        const channel = reaction.message.channel;

        // Send match result embed.
        return await channel.send({ embeds: [matchResultEmbed] });
    }

    if (emoji === '🔴' || emoji === '🔵') {

        if (getReportDataResponse.data.matchMode !== 'ranked_doubles') return;

        // Get reaction count.
        const redReactionCount = message.reactions.cache.get('🔴').count;
        console.log('🔴 reaction count:', redReactionCount);

        const blueReactionCount = message.reactions.cache.get('🔵').count;
        console.log('🔵 reaction count:', blueReactionCount);

        if (redReactionCount !== 5 && blueReactionCount !== 5) return;

        let winner1DiscordId;
        let winner2DiscordId;
        let loser1DiscordId;
        let loser2DiscordId;

        // Get Discord ID.
        if (redReactionCount === 5) {
            winner1DiscordId = getReportDataResponse.data['🔴'][0];
            winner2DiscordId = getReportDataResponse.data['🔴'][1];
            loser1DiscordId = getReportDataResponse.data['🔵'][0];
            loser2DiscordId = getReportDataResponse.data['🔵'][1];

        } else {
            winner1DiscordId = getReportDataResponse.data['🔵'][0];
            winner2DiscordId = getReportDataResponse.data['🔵'][1];
            loser1DiscordId = getReportDataResponse.data['🔴'][0];
            loser2DiscordId = getReportDataResponse.data['🔴'][1];
        }

        console.log('Retrieved winner Discord IDs:', { winner1DiscordId, winner2DiscordId });
        console.log('Retrieved loser Discord IDs', { loser1DiscordId, loser2DiscordId });

        // Get player data.
        const winner1PlayerData = getRoomDataResponse.data.players.find(player => player.discordUserData.id === winner1DiscordId);
        const winner2PlayerData = getRoomDataResponse.data.players.find(player => player.discordUserData.id === winner2DiscordId);
        const loser1PlayerData = getRoomDataResponse.data.players.find(player => player.discordUserData.id === loser1DiscordId);
        const loser2PlayerData = getRoomDataResponse.data.players.find(player => player.discordUserData.id === loser2DiscordId);

        console.log('Retrieved winner players data:', { winner1PlayerData, winner2PlayerData });
        console.log('Retrieved loser players data:', { loser1PlayerData, loser2PlayerData });

        // Get before skill.
        const winner1BeforeSkill = winner1PlayerData.dxmatePlayerData.skill.doubles;
        const winner2BeforeSkill = winner2PlayerData.dxmatePlayerData.skill.doubles;
        const loser1BeforeSkill = loser1PlayerData.dxmatePlayerData.skill.doubles;
        const loser2BeforeSkill = loser2PlayerData.dxmatePlayerData.skill.doubles;

        console.log('Retrieved winner before skills:', { winner1BeforeSkill, winner2BeforeSkill });
        console.log('Retrieved loser before skills:', { loser1BeforeSkill, loser2BeforeSkill });

        // Update skill.
        const updateDoublesSkillResponse = await axios.post(dxmateApiBaseUrl + '/skill/doubles/update', {
            winner1Skill: winner1BeforeSkill,
            winner2Skill: winner2BeforeSkill,
            loser1Skill: loser1BeforeSkill,
            loser2Skill: loser2BeforeSkill
        });

        // Get updated skill.
        const winner1AfterSkill = updateDoublesSkillResponse.data.winners[0];
        const winner2AfterSkill = updateDoublesSkillResponse.data.winners[1];
        const loser1AfterSkill = updateDoublesSkillResponse.data.losers[0];
        const loser2AfterSkill = updateDoublesSkillResponse.data.losers[1];
        console.log('Updated winner players skill:', { winner1AfterSkill, winner2AfterSkill });
        console.log('Updated loser players skill:', { loser1AfterSkill, loser2AfterSkill });

        // Save updated skill.
        await axios.post(dxmateApiBaseUrl + '/players/skill/update', {
            discordId: winner1DiscordId,
            skill: winner1AfterSkill
        });

        await axios.post(dxmateApiBaseUrl + '/players/skill/update', {
            discordId: winner2DiscordId,
            skill: winner2AfterSkill
        });

        await axios.post(dxmateApiBaseUrl + '/players/skill/update', {
            discordId: loser1DiscordId,
            skill: loser1AfterSkill
        });

        await axios.post(dxmateApiBaseUrl + '/players/skill/update', {
            discordId: loser2DiscordId,
            skill: loser2AfterSkill
        });

        console.log('Saved updated skill.');

        // Get before Rank Data.
        const winner1BeforeRankData = winner1PlayerData.rankData;
        const winner2BeforeRankData = winner2PlayerData.rankData;
        const loser1BeforeRankData = loser1PlayerData.rankData;
        const loser2BeforeRankData = loser2PlayerData.rankData;

        // Get after Rank data.
        const getWinner1AfterRankDataResponse = await axios.get(dxmateApiBaseUrl + '/rank', {
            params: {
                mu: winner1AfterSkill.mu,
                sigma: winner1AfterSkill.sigma
            }
        });

        const getWinner2AfterRankDataResponse = await axios.get(dxmateApiBaseUrl + '/rank', {
            params: {
                mu: winner2AfterSkill.mu,
                sigma: winner2AfterSkill.sigma
            }
        });

        const getLoser1AfterRankDataResponse = await axios.get(dxmateApiBaseUrl + '/rank', {
            params: {
                mu: loser1AfterSkill.mu,
                sigma: loser1AfterSkill.sigma
            }
        });

        const getLoser2AfterRankDataResponse = await axios.get(dxmateApiBaseUrl + '/rank', {
            params: {
                mu: loser2AfterSkill.mu,
                sigma: loser2AfterSkill.sigma
            }
        });

        const winner1AfterRankData = getWinner1AfterRankDataResponse.data;
        const winner2AfterRankData = getWinner2AfterRankDataResponse.data;
        const loser1AfterRankData = getLoser1AfterRankDataResponse.data;
        const loser2AfterRankData = getLoser2AfterRankDataResponse.data;
        console.log('Retrieved winner updated Rank data:', { winner1AfterRankData, winner2AfterRankData });
        console.log('Retrieved winner updated Rank data:', { loser1AfterRankData, loser2AfterRankData });

        // Delete room.
        await axios.post(dxmateApiBaseUrl + '/rooms/delete', {
            roomId: getReportDataResponse.data.roomId
        });
        console.log('Deleted room data.');
        
        // Delete report data.
        await axios.post(dxmateApiBaseUrl + '/reports/delete', {
            reportId
        });
        console.log('Deleted report data.');

        // Create match result embed.
        const matchResultEmbed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Ranked Doubles Result')
        .addFields(
            { name: 'Winner 1️⃣', value: `<@${winner1DiscordId}>`, inline: true },
            { name: 'Before Rank', value: `${winner1BeforeRankData.name} ${winner1BeforeRankData.points} RP`, inline: true },
            { name: 'After Rank', value: `${winner1AfterRankData.name} ${winner1AfterRankData.points} RP`, inline: true },
            { name: 'Winner 2️⃣', value: `<@${winner2DiscordId}>`, inline: true },
            { name: 'Before Rank', value: `${winner2BeforeRankData.name} ${winner2BeforeRankData.points} RP`, inline: true },
            { name: 'After Rank', value: `${winner2AfterRankData.name} ${winner2AfterRankData.points} RP`, inline: true },
            { name: 'Loser 1️⃣', value: `<@${loser1DiscordId}>`, inline: true },
            { name: 'Before Rank', value: `${loser1BeforeRankData.name} ${loser1BeforeRankData.points} RP`, inline: true },
            { name: 'After Rank', value: `${loser1AfterRankData.name} ${loser1AfterRankData.points} RP`, inline: true },
            { name: 'Loser 2️⃣', value: `<@${loser2DiscordId}>`, inline: true },
            { name: 'Before Rank', value: `${loser2BeforeRankData.name} ${loser2BeforeRankData.points} RP`, inline: true },
            { name: 'After Rank', value: `${loser2AfterRankData.name} ${loser2AfterRankData.points} RP`, inline: true },
        );

        // Get channel.
        const channel = reaction.message.channel;

        // Send match result embed.
        return await channel.send({ embeds: [matchResultEmbed] });
    }

    if (emoji === '❌') {
        // Get reaction count.
        const cancelReactionCount = message.reactions.cache.get('❌').count;
        console.log('❌ reaction count:', cancelReactionCount);

        let discordIds = [];

        if (getReportDataResponse.data.matchMode === 'ranked_singles') {
            
            if (cancelReactionCount !== 3) return;

            discordIds.push(getReportDataResponse.data['1️⃣']);
            discordIds.push(getReportDataResponse.data['2️⃣']);
        } else {

            if (cancelReactionCount !== 5) return;

            discordIds.push(getReportDataResponse.data['🔴'][0]);
            discordIds.push(getReportDataResponse.data['🔴'][1]);
            discordIds.push(getReportDataResponse.data['🔵'][0]);
            discordIds.push(getReportDataResponse.data['🔵'][1]);
        }

        // Delete room.
        await axios.post(dxmateApiBaseUrl + '/rooms/delete', {
            roomId: getReportDataResponse.data.roomId
        });
        console.log('Deleted room data.');
        
        // Delete report data.
        await axios.post(dxmateApiBaseUrl + '/reports/delete', {
            reportId
        });
        console.log('Deleted report data.');

        // Get mentioned players.
        const mentionedPlayers = discordIds.map(discordId => `<@${discordId}>`).join(' ');

        // Get channel.
        const channel = reaction.message.channel;

        // Send match cancel complete reply.
        channel.send(`${mentionedPlayers} Canceled match.`);
    }
});

// Log in to Discord.
client.login(process.env.DISCORD_BOT_TOKEN);