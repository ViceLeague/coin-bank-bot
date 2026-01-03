import { REST, Routes } from "discord.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error("Missing env vars");
  process.exit(1);
}

const commands = [
  { name: "balance", description: "Check your coin balance" },

  {
    name: "addcoins",
    description: "Add coins to a user (admin only)",
    options: [
      { name: "user", description: "User", type: 6, required: true },
      { name: "amount", description: "Amount", type: 4, required: true },
      { name: "reason", description: "Reason", type: 3, required: false },
    ],
  },

  {
    name: "removecoins",
    description: "Remove coins from a user (admin only)",
    options: [
      { name: "user", description: "User", type: 6, required: true },
      { name: "amount", description: "Amount", type: 4, required: true },
      { name: "reason", description: "Reason", type: 3, required: false },
    ],
  },

  {
    name: "usecoins",
    description: "Spend some of your coins",
    options: [
      { name: "amount", description: "Amount", type: 4, required: true },
      { name: "reason", description: "Reason", type: 3, required: false },
    ],
  },

  {
    name: "transactions",
    description: "View recent coin activity",
  },
];

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  console.log("Registering slash commands...");
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands,
  });
  console.log("✅ Slash commands registered");
  process.exit(0);
})();
