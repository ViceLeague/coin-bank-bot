import "dotenv/config";
import { REST, Routes } from "discord.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error("Missing env vars. Need DISCORD_TOKEN, DISCORD_CLIENT_ID, GUILD_ID");
  process.exit(1);
}

const commands = [
  {
    name: "balance",
    description: "Check your coin balance",
  },
  {
    name: "addcoins",
    description: "Add coins to a user (admin only)",
    options: [
      {
        name: "user",
        description: "User to add coins to",
        type: 6,
        required: true,
      },
      {
        name: "amount",
        description: "Amount of coins",
        type: 4,
        required: true,
      },
    ],
  },
  {
    name: "usecoins",
    description: "Spend coins (tournament entry)",
    options: [
      {
        name: "amount",
        description: "Amount of coins to spend",
        type: 4,
        required: true,
      },
      {
        name: "reason",
        description: "Reason (ex: PC Tournament Entry)",
        type: 3,
        required: false,
      },
    ],
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
