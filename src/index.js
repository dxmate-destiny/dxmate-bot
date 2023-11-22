const fs = require('fs');
const path = require('node:path');
const { Client, GatewayIntentBits, Collection, Events, EmbedBuilder, Emoji } = require('discord.js');
const { default: axios } = require('axios');
const { setTimeout } = require('timers/promises');
const { convertNumberToEmoji } = require('../modules/util');

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

    if (user.bot) return;

    // Get reacted message.
    const message = reaction.message;

    if (!message.author.bot) return;

    if (!message.interaction) return;

    // Get command name.
    const commandName = message.interaction.commandName;
    console.log('Retrieved command name:', commandName);

    if (commandName !== 'matchmake') return;

    // Get report ID.
    const reportId = message.id;
    console.log('Retrieved report ID:', reportId);

    // Get report data.
    const getReportDataResponse = await axios.get(dxmateApiBaseUrl + `/reports/${reportId}`);
    console.log('Retrieved Report data:', getReportDataResponse.data);

    if (!getReportDataResponse.data) return;

    if (getReportDataResponse.data.matchMode.includes('unranked')) return;

    // Get room data.
    const roomData = getReportDataResponse.data.roomData;
    console.log('Retrieved Room data:', roomData);

    let isHost = getReportDataResponse.data.host === user.id;

    if (!isHost) return;

    let matchResult = '';

    if (getReportDataResponse.data.matchMode.includes('singles')) {

        // Get match result.
        while (!matchResult) {
            message.reactions.cache.forEach(reaction => {
                if (reaction.count === 3) {
                    if (reaction.emoji.name === '1️⃣' || reaction.emoji.name === '2️⃣' || reaction.emoji.name === '❌') {
                        matchResult = reaction.emoji.name;
                    }
                }
            });

            if (!matchResult) await setTimeout(5000);
        }

        console.log('Match Result:', matchResult);

        if (matchResult === '1️⃣' || matchResult === '2️⃣') {

            let discordId = {
                winner: '',
                loser: ''
            };

            // Get Discord ID.
            if (matchResult === '1️⃣') {
                discordId.winner = getReportDataResponse.data['1️⃣'];
                discordId.loser = getReportDataResponse.data['2️⃣'];
            } else if (matchResult === '2️⃣') {
                discordId.winner = getReportDataResponse.data['2️⃣'];
                discordId.loser = getReportDataResponse.data['1️⃣'];
            }

            console.log('Retrieved Discord ID:', discordId);

            let playerData = {
                winner: {},
                loser: {}
            };

            // Get player data.
            playerData.winner = roomData.players.find(player => player.discordUserData.id === discordId.winner);
            playerData.loser = roomData.players.find(player => player.discordUserData.id === discordId.loser);
            console.log('Retrieved player data:', playerData);

            let beforeSkill = {
                winner: {},
                loser: {}
            };

            // Get before skill.
            beforeSkill.winner = playerData.winner.dxmatePlayerData.skill.singles;
            beforeSkill.loser = playerData.loser.dxmatePlayerData.skill.singles;
            console.log('Retrieved before skill:', beforeSkill);

            let afterSkill = {
                winner: {},
                loser: {}
            };

            // Update skill.
            const updateSkillResponse = await axios.post(dxmateApiBaseUrl + '/skill/singles/update', {
                winnerSkill: beforeSkill.winner,
                loserSkill: beforeSkill.loser
            });

            afterSkill.winner = updateSkillResponse.data.winner;
            afterSkill.loser = updateSkillResponse.data.loser;
            console.log('Updated skill:', afterSkill);

            // Save updated skill.
            await axios.post(dxmateApiBaseUrl + '/players/skill/singles/update', {
                discordId: discordId.winner,
                skill: afterSkill.winner
            });

            await axios.post(dxmateApiBaseUrl + '/players/skill/singles/update', {
                discordId: discordId.loser,
                skill: afterSkill.loser
            });

            console.log('Saved updated skill.');

            // Add Ranked Singles match count.
            await axios.post(dxmateApiBaseUrl + '/players/ranked-match-count/singles/add', {
                discordId: discordId.winner
            });

            await axios.post(dxmateApiBaseUrl + '/players/ranked-match-count/singles/add', {
                discordId: discordId.loser
            });

            console.log('Added Ranked Singles match count.');

            let beforeRankData = {
                winner: {},
                loser: {}
            };

            // Get before Rank data.
            beforeRankData.winner = playerData.winner.rankData;
            beforeRankData.loser = playerData.loser.rankData;

            console.log('Retrieved before Rank data:', beforeRankData);

            let afterRankData = {
                winner: {},
                loser: {}
            };

            // Get after Rank data.
            const getWinnerAfterRankDataResponse = await axios.get(dxmateApiBaseUrl + '/rank', {
                params: {
                    mu: afterSkill.winner.mu,
                    sigma: afterSkill.winner.sigma
                }
            });

            const getLoserAfterRankDataResponse = await axios.get(dxmateApiBaseUrl + '/rank', {
                params: {
                    mu: afterSkill.loser.mu,
                    sigma: afterSkill.loser.sigma
                }
            });

            afterRankData.winner = getWinnerAfterRankDataResponse.data;
            afterRankData.loser = getLoserAfterRankDataResponse.data;
            console.log('Retrieved After Rank data:', afterRankData);

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
                { name: 'Winner', value: `<@${discordId.winner}>`, inline: true },
                { name: 'Before', value: `${beforeRankData.winner.points} RP`, inline: true },
                { name: 'After', value: `${afterRankData.winner.points} RP`, inline: true },
                { name: 'Loser', value: `<@${discordId.loser}>`, inline: true },
                { name: 'Before', value: `${beforeRankData.loser.points} RP`, inline: true },
                { name: 'After', value: `${afterRankData.loser.points} RP`, inline: true },
            );

            // Get channel.
            const channel = reaction.message.channel;

            // Send match result embed.
            return await channel.send({ embeds: [matchResultEmbed] });
        } else {
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
            
            // Get channel.
            const channel = reaction.message.channel;

            // Send match cancel complete reply.
            return await channel.send(`<@${getReportDataResponse.data['1️⃣']}> <@${getReportDataResponse.data['2️⃣']}> Canceled match.`);
        }
    } else {

        // Get match result.
        while (!matchResult) {
            message.reactions.cache.forEach(reaction => {
                if (reaction.count === 5) {
                    if (reaction.emoji.name === '🔴' || reaction.emoji.name === '🔵' || reaction.emoji.name === '❌') {
                        matchResult = reaction.emoji.name;
                    }
                }
            });

            if (!matchResult) await setTimeout(5000);
        }

        console.log('Match Result:', matchResult);

        if (matchResult === '🔴' || matchResult === '🔵') {

            let discordId = {
                winner: [],
                loser: []
            };

            if (matchResult === '🔴') {
                discordId.winner = [ getReportDataResponse.data['🔴'][0], getReportDataResponse.data['🔴'][1] ];
                discordId.loser = [ getReportDataResponse.data['🔵'][0], getReportDataResponse.data['🔵'][1] ];
            } else {
                discordId.winner = [ getReportDataResponse.data['🔵'][0], getReportDataResponse.data['🔵'][1] ];
                discordId.loser = [ getReportDataResponse.data['🔴'][0], getReportDataResponse.data['🔴'][1] ];
            }

            console.log('Retrieved Discord ID:', discordId);

            let playerData = {
                winner: [],
                loser: []
            };

            // Get Player Data.
            playerData.winner = discordId.winner.map(dId => roomData.players.find(player => player.discordUserData.id === dId));
            playerData.loser = discordId.loser.map(dId => roomData.players.find(player => player.discordUserData.id === dId));
            console.log('Retrieved Player data:', playerData);

            let beforeSkill = {
                winner: [],
                loser: []
            };

            // Get before skill.
            beforeSkill.winner = playerData.winner.map(player => player.dxmatePlayerData.skill.doubles);
            beforeSkill.loser = playerData.loser.map(player => player.dxmatePlayerData.skill.doubles);
            console.log('Retrieved before skill:', beforeSkill);

            let afterSkill = {
                winner: [],
                loser: []
            };

            // Update skill.
            const updateDoublesSkillResponse = await axios.post(dxmateApiBaseUrl + '/skill/doubles/update', {
                winner1Skill: beforeSkill.winner[0],
                winner2Skill: beforeSkill.winner[1],
                loser1Skill: beforeSkill.loser[0],
                loser2Skill: beforeSkill.loser[1]
            });

            afterSkill.winner = updateDoublesSkillResponse.data.winners.slice(0, 2);
            afterSkill.loser = updateDoublesSkillResponse.data.losers.slice(0, 2);
            console.log('Retrieved updated skill:', afterSkill);

            // Save updated skill.
            for (let i = 0; i < afterSkill.winner.length; i++) {
                await axios.post(dxmateApiBaseUrl + '/players/skill/doubles/update', {
                    discordId: discordIds.winner[i],
                    skill: afterSkill.winner[i]
                });
            }

            for (let i = 0; i < afterSkill.loser.length; i++) {
                await axios.post(dxmateApiBaseUrl + '/players/skill/doubles/update', {
                    discordId: discordIds.loser[i],
                    skill: afterSkill.loser[i]
                });
            }

            console.log('Saved updated skill.');

            // Add Ranked Doubles count.
            for (let i = 0; i < discordIds.winner.length; i++) {
                await axios.post(dxmateApiBaseUrl + '/players/ranked-match-count/doubles/add', {
                    discordId: discordIds.winner[i]
                });
            }

            for (let i = 0; i < discordIds.loser.length; i++) {
                await axios.post(dxmateApiBaseUrl + '/players/ranked-match-count/doubles/add', {
                    discordId: discordIds.loser[i]
                });
            }

            console.log('Added Ranked Doubles count.');

            let beforeRankData = {
                winner: [],
                loser: []
            };

            // Get before Rank data.
            beforeRankData.winner = playerData.winner.map(player => player.rankData);
            beforeRankData.loser = playerData.loser.map(player => player.rankData);
            console.log('Retrieved before Rank data:', beforeRankData);

            let afterRankData = {
                winner: [],
                loser: []
            };

            // Get after Rank data.
            for (let i = 0; i < afterSkill.winner.length; i++) {
                let getWinnerAfterRankDataResponse = await axios.get(dxmateApiBaseUrl + '/rank', {
                    params: {
                        mu: afterSkill.winner[i].mu,
                        sigma: afterSkill.winner[i].sigma
                    }
                });

                afterRankData.winner.push(getWinnerAfterRankDataResponse.data);
            }

            for (let i = 0; i < afterSkill.loser.length; i++) {
                let getWinnerAfterRankDataResponse = await axios.get(dxmateApiBaseUrl + '/rank', {
                    params: {
                        mu: afterSkill.loser[i].mu,
                        sigma: afterSkill.loser[i].sigma
                    }
                });

                afterRankData.loser.push(getWinnerAfterRankDataResponse.data);
            }

            console.log('Retrieved updated Rank data:', afterRankData);

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
            .setTitle('Ranked Doubles Result');

            for (let i = 0; i < 2; i++) {
                matchResultEmbed.addFields(
                    { name: `Winner ${convertNumberToEmoji(i + 1)}`, value: `<@${discordIds.winner[i]}>`, inline: true },
                    { name: 'Before', value: `${beforeRankData.winner[i].points} RP`, inline: true },
                    { name: 'After', value: `${afterRankData.winner[i].points} RP`, inline: true }
                );
            }

            for (let i = 0; i < 2; i++) {
                matchResultEmbed.addFields(
                    { name: `Loser ${convertNumberToEmoji(i + 1)}`, value: `<@${discordIds.loser[i]}>`, inline: true },
                    { name: 'Before', value: `${beforeRankData.loser[i].points} RP`, inline: true },
                    { name: 'After', value: `${afterRankData.loser[i].points} RP`, inline: true }
                );
            }

            // Get channel.
            const channel = reaction.message.channel;

            // Send match result embed.
            return await channel.send({ embeds: [matchResultEmbed] });
        } else {
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
            
            // Get channel.
            const channel = reaction.message.channel;

            // Send match cancel complete reply.
            return await channel.send(`<@${getReportDataResponse.data['🔴'][0]}> <@${getReportDataResponse.data['🔴'][1]}> <@${getReportDataResponse.data['🔵'][0]}> <@${getReportDataResponse.data['🔵'][1]}> Canceled match.`);
        }
    }
});

// Log in to Discord.
client.login(process.env.DISCORD_BOT_TOKEN);