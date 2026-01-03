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
      { name: 'user', description: 'User to add coins to', type: 6, required: true },
      { name: 'amount', description: 'Amount of coins', type: 4, required: true },
      { name: 'reason', description: 'Reason for adding coins', type: 3, required: false },
    ],
  },
  {
    name: 'removecoins',
    description: 'Remove coins from a user (admin only)',
    options: [
      { name: 'user', description: 'User to remove coins from', type: 6, required: true },
      { name: 'amount', description: 'Amount of coins to remove', type: 4, required: true },
      { name: 'reason', description: 'Reason for removing coins', type: 3, required: false },
    ],
  },
  {
    name: 'transactions',
    description: 'View your recent coin transactions',
  },
  {
    name: 'checkcoins',
    description: 'Check a user\'s coin balance (admin only)',
    options: [
      { name: 'user', description: 'User to check', type: 6, required: true },
    ],
  },
  {
    name: 'usertransactions',
    description: 'View another user\'s coin transaction history (admin only)',
    options: [
      { name: 'user', description: 'User to view transactions for', type: 6, required: true },
    ],
  },
  {
    name: 'clearbuyers',
    description: 'Remove the Buyer role from all users (admin only)',
  },
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('🔄 Registering slash commands...');
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log('✅ Slash commands registered!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
    process.exit(1);
  }
})();
