const { default: axios } = require('axios');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Get DXmate API base URL.
const dxmateApiBaseUrl = process.env.DXMATE_API_BASE_URL;

module.exports = {
    data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Displays the top 50 leaderboard.'),
    async execute (interaction) {
        // Defer reply.
        await interaction.deferReply();

        // *First, create an overall leaderboard. In a future update, it will be possible to specify the region in options.

        // Get Top 50 players.

        // Create leaderboard embed.

        // Send leaderboard embed.
    }
}