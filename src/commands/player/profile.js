const { default: axios } = require('axios');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Get DXmate API base URL.
const dxmateApiBaseUrl = process.env.DXMATE_API_BASE_URL;

// Region map
const regionChoices = {
    'na': 'North America',
    'lac': 'Latin America & the Caribbean',
    'eu': 'Europe',
    'mena': 'Middle East & North Africa',
    'ssa': 'Sub-Saharan Africa',
    'rca': 'Russia & Central Asia',
    'sa': 'South Asia',
    'ea': 'East Asia',
    'sea': 'Southeast Asia',
    'sp': 'South Pacific'
};

module.exports = {
    data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Displays your DXmate player profile.'),
    async execute (interaction) {
        // Defer reply.
        await interaction.deferReply();

        // Get Discord user data.
        const discordUserData = {
            id: interaction.user.id,
            name: interaction.user.globalName || interaction.user.username,
            avatarUrl: interaction.user.displayAvatarURL({ dynamic: true, size: 512 })
        };
        console.log('Retrieved Discord user data:', discordUserData);

        // Check if the DXmate player is registered.
        const checkDxmatePlayerRegisteredResponse = await axios.get(dxmateApiBaseUrl + `/players/${discordUserData.id}/check`);
        console.log('Registered:', checkDxmatePlayerRegisteredResponse.data);

        if (!checkDxmatePlayerRegisteredResponse.data) {
            console.log('You are not registered yet.');
            return interaction.editReply('You are not registered yet. You can register using \"/register\".');
        }

        // Get DXmate player data.
        const getDxmatePlayerDataResponse = await axios.get(dxmateApiBaseUrl + `/players/${discordUserData.id}`);
        console.log('Retrieved DXmate player data:', getDxmatePlayerDataResponse.data);

        // Get Singles Rank data.
        const getSinglesRankDataResponse = await axios.get(dxmateApiBaseUrl + '/rank', {
            params: {
                mu: getDxmatePlayerDataResponse.data.skill.singles.mu,
                sigma: getDxmatePlayerDataResponse.data.skill.singles.sigma
            }
        });
        console.log('Retrieved Singles Rank data:', getSinglesRankDataResponse.data);

        // Get Doubles Rank data.
        const getDoublesRankDataResponse = await axios.get(dxmateApiBaseUrl + '/rank', {
            params: {
                mu: getDxmatePlayerDataResponse.data.skill.doubles.mu,
                sigma: getDxmatePlayerDataResponse.data.skill.doubles.sigma
            }
        });
        console.log('Retrieved Doubles Rank data:', getDoublesRankDataResponse.data);

        // Create DXmate player profile embed.
        const dxmatePlayerProfileEmbed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setAuthor({ name: discordUserData.name, iconURL: discordUserData.avatarUrl })
        .addFields(
            { name: 'Slippi Connect Code', value: getDxmatePlayerDataResponse.data.slippiConnectCode, inline: true },
            { name: 'Current Region', value: regionChoices[getDxmatePlayerDataResponse.data.region], inline: true },
            { name: 'Singles Rank', value: getSinglesRankDataResponse.data.name, inline: true },
            { name: 'Singles Rank Points', value: getSinglesRankDataResponse.data.points + ' RP', inline: true },
            { name: 'Ranked Singles Count', value: getDxmatePlayerDataResponse.data.rankedModeMatchCount.singles.toString(), inline: true },
            { name: 'Doubles Rank', value: getDoublesRankDataResponse.data.name, inline: true },
            { name: 'Doubles Rank Points', value: getDoublesRankDataResponse.data.points + ' RP', inline: true },
            { name: 'Ranked Doubles Count', value: getDxmatePlayerDataResponse.data.rankedModeMatchCount.doubles.toString(), inline: true },
        );

        // Send DXmate player profile embed.
        await interaction.editReply({ embeds: [dxmatePlayerProfileEmbed] });
    }
}