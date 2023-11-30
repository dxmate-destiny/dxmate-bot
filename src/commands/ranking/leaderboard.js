const { default: axios } = require('axios');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Get DXmate API base URL.
const dxmateApiBaseUrl = process.env.DXMATE_API_BASE_URL;

module.exports = {
    data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Displays the top 50 leaderboard.')
    .addStringOption((option) =>
        option
        .setName('mode')
        .setDescription('Select match mode you want to display.')
        .setRequired(true)
        .addChoices(
            { name: 'Singles', value: 'singles' },
            { name: 'Doubles', value: 'doubles' }
        )),
    async execute (interaction) {
        // Defer reply.
        await interaction.deferReply();

        // Get match mode from argument.
        const matchMode = interaction.options.getString('mode');
        console.log('Retrieved match mode:', matchMode);

        let top16Players = [];

        if (matchMode === 'singles') {
            // Get Singles Top 50 players.
            const getSinglesTop16PlayersResponse = await axios.get(dxmateApiBaseUrl + '/leaderboard/singles');
            
            top16Players = getSinglesTop16PlayersResponse.data;
            console.log('Retrieved Singles Top 16 players:', top16Players);
        } else {
            // Get Doubles Top 16 players.
            const getDoublesTop16PlayersResponse = await axios.get(dxmateApiBaseUrl + '/leaderboard/doubles');

            top16Players = getDoublesTop16PlayersResponse.data;
            console.log('Retrieved Doubles Top 16 plaeyrs:', top16Players);
        }

        // Create leaderboard embed.
        const leaderboardEmbed = new EmbedBuilder()
        .setTitle(`${matchMode === 'singles' ? 'Singles Top 16' : 'Doubles Top 16'}`)
        .setColor(0x0099FF);

        for (let i = 0; i < top16Players.length; i++) {
            // Get member data.
            const member = await interaction.guild.members.fetch(top16Players[i].discordId);

            // Get display name.
            const displayName = member ? member.displayName : top16Players[i].discordId;

            leaderboardEmbed.addFields({ name: `#${i + 1} ${displayName}`, value: `${top16Players[i].rankPoint} RP`, inline: false });
        }

        // Send leaderboard embed.
        await interaction.editReply({ embeds: [leaderboardEmbed] });
    }
}