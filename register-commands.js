// register-commands.js
import { REST, Routes } from 'discord.js';
import 'dotenv/config';

const commands = [
  {
    name: 'balance',
    description: 'Check your coin balance',
  },
  {
    name: 'addcoins',
    description: 'Add coins to a user (admin only)',
    options: [
      { name: 'user', type: 6, description: 'User', required: true },
      { name: 'amount', type: 4, description: 'Amount', required: true },
      { name: 'reason', type: 3, description: 'Reason', required: false },
    ],
  },
  {
    name: 'removecoins',
    description: 'Remove coins from a user (admin only)',
    options: [
      { name: 'user', type: 6, description: 'User', required: true },
      { name: 'amount', type: 4, description: 'Amount', required: true },
      { name: 'reason', type: 3, description: 'Reason', required: false },
    ],
  },
  {
    name: 'usecoins',
    description: 'Use your coins (e.g. for entry)',
    options: [
      { name: 'amount', type: 4, description: 'Amount to spend', required: true },
      { name: 'reason', type: 3, description: 'Reason', required: false },
    ],
  },
  {
    name: 'transactions',
    description: 'See your recent transactions',
  },
  {
    name: 'checkcoins',
    description: 'Check someone\'s coins (admin only)',
    options: [
      { name: 'user', type: 6, description: 'User to check', required: true },
    ],
  },
  {
    name: 'usertransactions',
    description: 'See user transaction history (admin only)',
    options: [
      { name: 'user', type: 6, description: 'User', required: true },
    ],
  },
  {
    name: 'clearbuyers',
    description: 'Clear Buyer role from all users',
  },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔁 Registering slash commands...');
    await rest.put(Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.GUILD_ID), {
      body: commands,
    });
    console.log('✅ Slash commands updated!');
  } catch (err) {
    console.error('❌ Error registering commands:', err);
  }
})();
