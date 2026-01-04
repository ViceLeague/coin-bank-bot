// register-commands.js
import { REST, Routes } from 'discord.js';
import 'dotenv/config';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.GUILD_ID;

const commands = [
  {
    name: 'balance',
    description: 'Check your coin balance',
  },
  {
    name: 'addcoins',
    description: 'Add coins to a user (admin only)',
    options: [
      { name: 'user', type: 6, description: 'User to add coins to', required: true },
      { name: 'amount', type: 4, description: 'Amount of coins', required: true },
      { name: 'reason', type: 3, description: 'Reason', required: false },
    ],
  },
  {
    name: 'removecoins',
    description: 'Remove coins from a user (admin only)',
    options: [
      { name: 'user', type: 6, description: 'User to remove coins from', required: true },
      { name: 'amount', type: 4, description: 'Amount of coins to remove', required: true },
      { name: 'reason', type: 3, description: 'Reason', required: false },
    ],
  },
  {
    name: 'usecoins',
    description: 'Spend your coins',
    options: [
      { name: 'amount', type: 4, description: 'Amount of coins to use', required: true },
      { name: 'reason', type: 3, description: 'Reason', required: false },
    ],
  },
  {
    name: 'transactions',
    description: 'View your recent coin transactions',
  },
  {
    name: 'checkcoins',
    description: 'Admin: Check a user\'s coin balance',
    options: [{ name: 'user', type: 6, description: 'User to check', required: true }],
  },
  {
    name: 'usertransactions',
    description: 'Admin: View a user\'s transactions',
    options: [{ name: 'user', type: 6, description: 'User to check', required: true }],
  },
  {
    name: 'clearbuyers',
    description: 'Remove the Buyer role from all users (admin only)',
  },
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log('✅ Slash commands registered!');
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
  }
})();
