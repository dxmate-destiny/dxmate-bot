const { default: axios } = require('axios');
const { SlashCommandBuilder } = require('discord.js');

const dxmateApiBaseUrl = process.env.DXMATE_API_BASE_URL;

module.exports = {
    data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register a new DXmate player.')
    .addStringOption((option) =>
        option
        .setName('slippi_connect_code')
        .setDescription('Enter your Slippi Connect Code (e.g. ABC#123).')
        .setRequired(true))
    .addStringOption((option) => 
        option
        .setName('region')
        .setDescription('Select your region.')
        .setRequired(true)
        .addChoices(
            { name: 'North America', value: 'na' },
            { name: 'Latin America & the Caribbean', value: 'lac' },
            { name: 'Europe', value: 'eu' },
            { name: 'Middle East & North Africa', value: 'mena' },
            { name: 'Sub-Saharan Africa', value: 'ssa' },
            { name: 'Russia & Central Asia', value: 'rca' },
            { name: 'South Asia', value: 'sa' },
            { name: 'East Asia', value: 'ea' },
            { name: 'Southeast Asia', value: 'sea' },
            { name: 'South Pacific', value: 'sp' }
        )),
    async execute (interaction) {
        // Defer reply.
        await interaction.deferReply();

        // Get Discord ID.
        const discordId = interaction.user.id;
        console.log('Retrieved Discord ID:', discordId);

        // Get Slippi Connect Code from argument.
        const slippiConnectCode = interaction.options.getString('slippi_connect_code');
        console.log('Retrieved Slippi Connect Code:', slippiConnectCode);

        // Get Region from argument.
        const region = interaction.options.getString('region');
        console.log('Retrieved Region:', region);

        // Check if the DXmate player is already registered.
        const checkDxmatePlayerRegisteredResponse = await axios.get(dxmateApiBaseUrl + `/players/${discordId}/check`);
        console.log('Registered:', checkDxmatePlayerRegisteredResponse.data);

        if (checkDxmatePlayerRegisteredResponse.data) {
            console.log('Player with this Discord ID is already registered');
            return interaction.editReply('Player with this Discord ID is already registered.');
        }

        // Register a new DXmate player.
        await axios.post(dxmateApiBaseUrl + '/players', {
            discordId,
            slippiConnectCode,
            region
        });
        console.log('Registered a new DXmate player.');

        interaction.editReply('✅ Successfully registered.');
    }   
}