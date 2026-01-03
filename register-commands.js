
import { REST, Routes } from "discord.js";
import "dotenv/config";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.GUILD_ID;

const commands = [
  {
    name: "balance",
    description: "Check your coin balance",
  },
  {
    name: "addcoins",
    description: "Add coins to a user (admin only)",
    options: [
      { name: "user", type: 6, description: "User", required: true },
      { name: "amount", type: 4, description: "Amount", required: true },
      { name: "reason", type: 3, description: "Reason", required: false },
    ],
  },
  {
    name: "removecoins",
    description: "Remove coins from a user (admin only)",
    options: [
      { name: "user", type: 6, description: "User", required: true },
      { name: "amount", type: 4, description: "Amount", required: true },
      { name: "reason", type: 3, description: "Reason", required: false },
    ],
  },
  {
    name: "usecoins",
    description: "Spend coins for entries or perks",
    options: [
      { name: "amount", type: 4, description: "Amount", required: true },
      { name: "reason", type: 3, description: "Reason", required: false },
    ],
  },
  {
    name: "transactions",
    description: "View your recent coin activity",
  },
];

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log("Registering slash commands...");
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });
    console.log("✅ Slash commands registered!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
