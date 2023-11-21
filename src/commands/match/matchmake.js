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

        // Get Match Mode from argument.
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

        let isHost = false;

        // Search room.
        const searchRoomResponse = await axios.post(dxmateApiBaseUrl + '/rooms/search', {
            matchMode,
            discordUserData,
            dxmatePlayerData: getDxmatePlayerDataResponse.data,
            rankData: getRankDataResponse.data
        });

        // Get Room ID.
        let roomId = searchRoomResponse.data;
        console.log('Joined Room ID:', roomId);

        if (!roomId) {
            console.log('Room not found, so need to create room.');

            isHost = true;

             // Create room.
             const createRoomResponse = await axios.post(dxmateApiBaseUrl + '/rooms', {
                matchMode,
                discordUserData,
                dxmatePlayerData: getDxmatePlayerDataResponse.data,
                rankData: getRankDataResponse.data
            });

            // Get Room ID from create room response.
            roomId = createRoomResponse.data;
            console.log('Created Room ID:', roomId);
        }

        // Get max player count.
        const maxPlayerCount = matchMode.includes('singles') ? 2 : 4;
        console.log('Retrieved max player count:', maxPlayerCount);

        // Get room data.
        const getRoomDataResponse = await axios.get(dxmateApiBaseUrl + `/rooms/${roomId}`);
        console.log('Retrieved room data:', getRoomDataResponse.data);

        // Check if joined room is full.
        let isRoomFull = getRoomDataResponse.data.players.length === maxPlayerCount;
        console.log('Room is full:', isRoomFull);

        if (!isRoomFull) {
            console.log('Rom is not full.');

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

            console.log('Host:', isHost);

            if (isHost) {

                let waitCount = 0;

                while (!isRoomFull) {
                    // Wait 5 sec.
                    await setTimeout(5000);

                    // Get curent room data.
                    const getCurrentRoomDataResponse = await axios.get(dxmateApiBaseUrl + `/rooms/${roomId}`);
                    console.log('Retrieved Room data:', getCurrentRoomDataResponse.data);

                    // Check if joined room is full.
                    isRoomFull = getCurrentRoomDataResponse.data.players.length === maxPlayerCount;
                    console.log('Room is full:', isRoomFull);

                    if (!isRoomFull) {
                        // Add wait count.
                        waitCount++;
                        console.log('Added wait count:', waitCount);

                        if (waitCount === 25) {
                            console.log('Timed out.');

                            // Delete room data.
                            await axios.post(dxmateApiBaseUrl + '/rooms/delete', {
                                roomId
                            });
                            
                            console.log('Deleted room data.');

                            // Get defering reply.
                            const deferingReply = await interaction.fetchReply();
                            
                            if (deferingReply) {
                                // Delete defering reply.
                                await deferingReply.delete();
                                console.log('Deleted defering reply.');
                            }

                            // Send timeout message.
                            return await interaction.channel.send(`<@${discordUserData.id}> Matchmaking has timed out.`);
                        }

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
                }
            } else {

                while (!isRoomFull) {
                    // Wait 5 sec.
                    await setTimeout(5000);

                    // Get curent room data.
                    const getCurrentRoomDataResponse = await axios.get(dxmateApiBaseUrl + `/rooms/${roomId}`);
                    console.log('Retrieved Room data:', getCurrentRoomDataResponse.data);

                    if (!getCurrentRoomDataResponse.data) {
                        console.log('Timed out.');

                        // Get defering reply.
                        const deferingReply = await interaction.fetchReply();
                            
                        if (deferingReply) {
                            // Delete defering reply.
                            await deferingReply.delete();
                            console.log('Deleted defering reply.');
                        }

                        // Send timeout message.
                        return await interaction.channel.send(`<@${discordUserData.id}> Matchmaking has timed out.`);
                    }

                    // Check if joined room is full.
                    isRoomFull = getCurrentRoomDataResponse.data.players.length === maxPlayerCount;
                    console.log('Room is full:', isRoomFull);
                }
            }
        }

        console.log('Matchmaking completed.');

        if (!isHost) {
            // Get defering reply.
            const deferingReply = await interaction.fetchReply();

            if (deferingReply) {
                await deferingReply.delete();
                console.log('Deleted defering reply.');
            }

            return;
        }

        // Get matchmaking completed room data.
        const getMatchmakingCompletedRoomResponse = await axios.get(dxmateApiBaseUrl + `/rooms/${roomId}`);
        console.log('Retrieved Room data:', getMatchmakingCompletedRoomResponse.data);

        let roomData = getMatchmakingCompletedRoomResponse.data || {};

        if (matchMode.includes('doubles')) {
            // Create team.
            const createTeamResponse = await axios.post(dxmateApiBaseUrl + '/rooms/team/create', { players: roomData.players });
            console.log('Created team:', createTeamResponse.data);

            // Update players field.
            roomData.players = createTeamResponse.data;

            // Create Doubles Connect Code.
            const createDoublesConnectCodeResponse = await axios.get(dxmateApiBaseUrl + '/rooms/team/connect-code/create');
            console.log('Created Doubles connect code:', createDoublesConnectCodeResponse.data);

            // Add Doubles Connect Code to room data.
            roomData.doublesConnectCode = createDoublesConnectCodeResponse.data;
        }

        let reportData = { roomId, matchMode, roomData };

        // Create matchmaking complete embed message.
        let matchmakingCompleteEmbed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(convertToMatchModeName(matchMode));

        if (matchMode.includes('singles')) {
            for (let i = 0; i < roomData.players.length; i++) {
                // Get player data.
                const playerData = roomData.players[i];

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

        console.log('Created report data:', reportData);

        // Add match config data to embed.
        matchmakingCompleteEmbed.addFields(
            { name: 'Set Length', value: 'Best of 5', inline: true },
            { name: 'Starter Stage', value: 'Battlefield', inline: true }
        );

        if (matchMode.includes('doubles')) {
            // Add Doubles Connect Code to embed.
            matchmakingCompleteEmbed.addFields({ name: 'Doubles Connect Code', value: roomData.doublesConnectCode, inline: true });
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
        }

        // Get Report ID (Message ID).
        const reportId = matchmakingCompletedMessage.id;
        console.log('Retrieved Report ID:', reportId);

        // Save Report data.
        await axios.post(dxmateApiBaseUrl + '/reports', {
            reportId,
            reportData
        });
        console.log('Saved Report data.');

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