const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your coin balance'),

  new SlashCommandBuilder()
    .setName('addcoins')
    .setDescription('Add coins to a user')
    .addUserOption(option =>
      option.setName('user').setDescription('User to add coins to').setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount').setDescription('Amount of coins to add').setRequired(true))
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for adding coins').setRequired(false)),

  new SlashCommandBuilder()
    .setName('removecoins')
    .setDescription('Remove coins from a user')
    .addUserOption(option =>
      option.setName('user').setDescription('User to remove coins from').setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount').setDescription('Amount of coins to remove').setRequired(true))
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for removing coins').setRequired(false)),

  new SlashCommandBuilder()
    .setName('usecoins')
    .setDescription('Use your coins for something')
    .addIntegerOption(option =>
      option.setName('amount').setDescription('Amount of coins to use').setRequired(true))
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for using coins').setRequired(false)),

  new SlashCommandBuilder()
    .setName('transactions')
    .setDescription('View your recent coin transaction history'),

  new SlashCommandBuilder()
    .setName('usertransactions')
    .setDescription('Admin: View another user’s transactions')
    .addUserOption(option =>
      option.setName('user').setDescription('User to view').setRequired(true)),

  new SlashCommandBuilder()
    .setName('checkcoins')
    .setDescription('Admin: Check a user’s coin balance')
    .addUserOption(option =>
      option.setName('user').setDescription('User to check').setRequired(true)),

  new SlashCommandBuilder()
    .setName('clearbuyers')
    .setDescription('Admin: Remove buyer roles from all members'),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔁 Refreshing application (/) commands...');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands.map(command => command.toJSON()) },
    );

    console.log('✅ Slash commands registered successfully.');
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
  }
})();
