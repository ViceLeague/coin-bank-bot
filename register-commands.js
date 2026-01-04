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
    description: 'Add coins to a user',
    options: [
      { name: 'user', description: 'User', type: 6, required: true },
      { name: 'amount', description: 'Amount to add', type: 4, required: true },
      { name: 'reason', description: 'Reason', type: 3, required: false },
    ],
  },
  {
    name: 'removecoins',
    description: 'Remove coins from a user',
    options: [
      { name: 'user', description: 'User', type: 6, required: true },
      { name: 'amount', description: 'Amount to remove', type: 4, required: true },
      { name: 'reason', description: 'Reason', type: 3, required: false },
    ],
  },
  {
    name: 'transactions',
    description: 'See your last 5 transactions',
  },
  {
    name: 'usertransactions',
    description: 'See another user’s last 5 transactions (admin)',
    options: [
      { name: 'user', description: 'User', type: 6, required: true },
    ],
  },
  {
    name: 'checkcoins',
    description: 'Check a user’s balance (admin)',
    options: [
      { name: 'user', description: 'User', type: 6, required: true },
    ],
  },
  {
    name: 'clearbuyers',
    description: 'Remove Buyer role from everyone (admin)',
  },
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log('✅ Slash commands registered!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
    process.exit(1);
  }
})();
