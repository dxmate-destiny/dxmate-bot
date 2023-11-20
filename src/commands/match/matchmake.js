const { default: axios } = require('axios');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { setTimeout } = require('timers/promises');
const { isEqual } = require('lodash');
const { convertToMatchModeName, convertNumberToEmoji, convertTeamToEmoji, convertTeamToName } = require('../../../modules/util');

// Get DXmate API base URL.
const dxmateApiBaseUrl = process.env.DXMATE_API_BASE_URL;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('matchmake')
		.setDescription('Start matchmaking.')
        .addStringOption((option) =>
            option
            .setName('mode')
            .setDescription('Select a match mode.')
            .setChoices(
                { name: 'Ranked Singles', value: 'ranked_singles' },
                { name: 'Ranked Doubles', value: 'ranked_doubles' },
                { name: 'Unranked Singles', value: 'unranked_singles' },
                { name: 'Unranked Doubles', value: 'unranked_doubles' }
            )
            .setRequired(true)),
	async execute(interaction) {
        // Defer reply.
        await interaction.deferReply();

        // Get Match Mode from argument value.
        const matchMode = interaction.options.getString('mode');
        console.log('Retrieved Match Mode:', matchMode);

        // Get Discord user data.
        const discordUserData = {
            id: interaction.user.id,
            name: interaction.user.globalName || interaction.user.username,
            avatarUrl: interaction.user.displayAvatarURL({ dynamic: true, size: 512 })
        };
        console.log('Retrieved Discord user data:', discordUserData);

        // Check if player is in a match.
        const checkPlayerInMatchResponse = await axios.get(dxmateApiBaseUrl + `/players/${discordUserData.id}/in-match/check`);

        if (checkPlayerInMatchResponse.data) {
            console.log('A player with this Discord ID is already in a match.');
            return await interaction.editReply(`<@${discordUserData.id}> You are already in a match.`);
        }

        // Get DXmate player data.
        const getDxmatePlayerDataResponse = await axios.get(dxmateApiBaseUrl + `/players/${discordUserData.id}`);
        console.log('Retrieved DXmate player data:', getDxmatePlayerDataResponse.data);

        if (matchMode === 'unranked_singles') {
            if (getDxmatePlayerDataResponse.data.rankedModeMatchCount.singles < 10) {
                return await interaction.editReply({ content: 'To participate in Unranked Singles, you must play at least 10 matches in Ranked Singles.', ephemeral: true });
            }
        } else if (matchMode === 'unranked_doubles') {
            if (getDxmatePlayerDataResponse.data.rankedModeMatchCount.doubles < 10) {
                return await interaction.editReply({ content: 'To participate in Unranked Doubles, you must play at least 10 matches in Ranked Doubles.', ephemeral: true });
            }
        }

        // Get Skill for selected mode.
        const skill = matchMode.includes('singles') ? getDxmatePlayerDataResponse.data.skill.singles : getDxmatePlayerDataResponse.data.skill.doubles;
        console.log('Retrieved Skill:', skill);

        // Get Rank data.
        const getRankDataResponse = await axios.get(dxmateApiBaseUrl + '/rank', {
            params: {
                mu: skill.mu,
                sigma: skill.sigma
            }
        });
        console.log('Retrieved Rank data:', getRankDataResponse.data);

        // Search room.
        const searchRoomResponse = await axios.post(dxmateApiBaseUrl + '/rooms/search', {
            matchMode,
            discordUserData,
            dxmatePlayerData: getDxmatePlayerDataResponse.data,
            rankData: getRankDataResponse.data
        });

        // Get Room ID from search room response.
        let roomId = searchRoomResponse.data;
        console.log('[Search] Room ID:', roomId);

        if (!roomId) {
            console.log('Room not found, so need to create room.');

            // Create room.
            const createRoomResponse = await axios.post(dxmateApiBaseUrl + '/rooms', {
                matchMode,
                discordUserData,
                dxmatePlayerData: getDxmatePlayerDataResponse.data,
                rankData: getRankDataResponse.data
            });

            // Get Room ID from create room response.
            roomId = createRoomResponse.data;
            console.log('[Create] Room ID:', roomId);
        }

        // Get max player count.
        const maxPlayerCount = matchMode.includes('singles') ? 2 : 4;
        console.log('Retrieved max player count:', maxPlayerCount);

        // Get room data.
        const getRoomDataResponse = await axios.get(dxmateApiBaseUrl + `/rooms/${roomId}`);

        // Get room data from response.
        let roomData = getRoomDataResponse.data;
        console.log('Retrieved Room data:', roomData);

        // Check if joined room is full.
        let isRoomFull = getRoomDataResponse.data.players.length === maxPlayerCount;
        console.log('Room is full:', isRoomFull);

        if (!isRoomFull) {
            console.log('Room is not full.');

            // Create seraching embed.
            const searchingEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .addFields(
                { name: 'Match Mode', value: convertToMatchModeName(matchMode), inline: true },
                { name: 'Players', value: `${getRoomDataResponse.data.players.length}/${maxPlayerCount}`, inline: true },
                { name: 'Status', value: 'Searching opponent...', inline: true }
            );

            // Send searching embed.
            await interaction.editReply({ embeds: [searchingEmbed], ephemeral: true });

            while (!isRoomFull) {
                // Wait 5 sec.
                await setTimeout(5000);

                // Get current room data.
                const getCurrentRoomDataResponse = await axios.get(dxmateApiBaseUrl + `/rooms/${roomId}`);
                console.log('Retrieved Room data:', getCurrentRoomDataResponse.data);

                isRoomFull = getCurrentRoomDataResponse.data.players.length === maxPlayerCount;
                console.log('Room is full:', isRoomFull);

                if (!isRoomFull) {
                    if (!isEqual(roomData, getCurrentRoomDataResponse.data)) {
                        console.log('Room data has been updated.');

                        // Create searchig embed.
                        const searchingEmbed = new EmbedBuilder()
                        .setColor(0x0099FF)
                        .addFields(
                            { name: 'Match Mode', value: convertToMatchModeName(matchMode), inline: true },
                            { name: 'Players', value: `${getCurrentRoomDataResponse.data.players.length}/${maxPlayerCount}`, inline: true },
                            { name: 'Status', value: 'Searching opponent...', inline: true }
                        );

                        // Send updated searching embed.
                        await interaction.editReply({ embeds: [searchingEmbed] });
                    }
                } else {
                    // Get room data.
                    roomData = getCurrentRoomDataResponse.data;
                    console.log('Retrieved Room data:', roomData);
                }
            }
        }

        console.log('Matchmaking completed.');

        // Get my player data from room data.
        const myPlayerData = roomData.players.find(item => item.discordUserData.id === discordUserData.id);
        console.log('Retrieved my player data:', myPlayerData);

        if (!myPlayerData.isHost) {
            // Get defering reply.
            const deferingReply = await interaction.fetchReply();

            if (deferingReply) {
                await deferingReply.delete();
                console.log('Deleted defering reply.');
            }

            return;
        }

        // If Match Mode is doubles, create team.
        if (matchMode.includes('doubles')) {
            // Create team.
            const createTeamResponse = await axios.post(dxmateApiBaseUrl + '/rooms/team/create', { players: roomData.players });
            console.log('Created team:', createTeamResponse.data);

            // Update players field.
            roomData.players = createTeamResponse.data;
        }

        let reportData = { roomId, matchMode };

        // Create matchmaking complete embed message.
        let matchmakingCompleteEmbed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(convertToMatchModeName(matchMode));

        if (matchMode.includes('singles')) {
            for (var i = 0; i < roomData.players.length; i++) {
                // Get player data.
                const playerData = roomData.players[i];
                console.log('Player Data:', playerData);

                // Link the port number and Discord ID.
                reportData[convertNumberToEmoji(i + 1)] = playerData.discordUserData.id;

                // Add player data to embed.
                matchmakingCompleteEmbed.addFields(
                    { name: `Player ${convertNumberToEmoji(i + 1)}`, value: `<@${playerData.discordUserData.id}>`, inline: true },
                    { name: 'Slippi Connect Code', value: playerData.dxmatePlayerData.slippiConnectCode, inline: true },
                    { name: 'Rank', value: `${playerData.rankData.name} ${playerData.rankData.points} RP`, inline: true }
                );
            }
        } else {
            // Link color ball and team.
            reportData['🔴'] = [];
            reportData['🔵'] = [];

            for (var i = 0; i < roomData.players.length; i++) {
                // Get player data.
                const playerData = roomData.players[i];
                console.log('Player Data:', playerData);

                // Add Discord ID.
                if (playerData.team === 'red') {
                    reportData['🔴'].push(playerData.discordUserData.id);
                } else {
                    reportData['🔵'].push(playerData.discordUserData.id);
                }

                // Add player data to embed.
                matchmakingCompleteEmbed.addFields(
                    { name: `Player ${convertNumberToEmoji(i + 1)}`, value: `<@${playerData.discordUserData.id}>`, inline: true },
                    { name: 'Team', value: `${convertTeamToEmoji(playerData.team)} ${convertTeamToName(playerData.team)}`, inline: true },
                    { name: 'Rank', value: `${playerData.rankData.name} ${playerData.rankData.points} RP`, inline: true }
                );
            }
        }

        console.log('Created Report Data:', reportData);

        // Add match config data to embed.
        matchmakingCompleteEmbed.addFields(
            { name: 'Set Length', value: 'Best of 5', inline: true },
            { name: 'Starter Stage', value: 'Battlefield', inline: true }
        );

        if (matchMode.includes('doubles')) {
            // Create Doubles Connect Code.
            const createDoublesConnectCode = await axios.get(dxmateApiBaseUrl + '/rooms/team/connect-code/create');
            console.log('Created Doubles connect code:', createDoublesConnectCode.data);

            // Add Doubles connect code to embed.
            matchmakingCompleteEmbed.addFields({ name: 'Doubles Connect Code', value: createDoublesConnectCode.data, inline: true });
        }

        // Send matchmaking complete emebd.
        const matchmakingCompletedMessage = await interaction.editReply({ embeds: [matchmakingCompleteEmbed], ephemeral: true });

        if (matchMode.includes('unranked')) {
            console.log('Unranked mode, so need to delete room data.');

            // Delete room data.
            await axios.post(dxmateApiBaseUrl + '/rooms/delete', {
                roomId
            });

            console.log('Deleted room data.');

            return;
        };

        // Get Report ID (Message ID).
        const reportId = matchmakingCompletedMessage.id;
        console.log('Retrieved Report ID:', reportId);

        // Save Report data.
        await axios.post(dxmateApiBaseUrl + '/reports', {
            reportId,
            reportData
        });
        console.log('Saved Report data.')

        if (matchMode.includes('singles')) {
            // Add Singles reaction.
            await matchmakingCompletedMessage.react('1️⃣');
            await matchmakingCompletedMessage.react('2️⃣');
            await matchmakingCompletedMessage.react('❌');
        } else {
            // Add Doubles reaction.
            await matchmakingCompletedMessage.react('🔴');
            await matchmakingCompletedMessage.react('🔵');
            await matchmakingCompletedMessage.react('❌');
        }
	},
};