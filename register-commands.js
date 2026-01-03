import { REST, Routes } from "discord.js";
import "dotenv/config";

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID || !GUILD_ID) {
  console.error("Missing env vars.");
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
    description: "Spend your coins",
    options: [
      { name: "amount", type: 4, description: "Amount to spend", required: true },
      { name: "reason", type: 3, description: "Reason", required: false },
    ],
  },
  {
    name: "transactions",
    description: "View your recent coin activity",
  },
  {
    name: "checkcoins",
    description: "Admin: Check a user’s coin balance",
    options: [{ name: "user", type: 6, description: "User", required: true }],
  },
  {
    name: "usertransactions",
    description: "Admin: View a user’s recent transactions",
    options: [{ name: "user", type: 6, description: "User", required: true }],
  },
];

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log("⏳ Registering commands...");
    await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Commands registered!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
    process.exit(1);
  }
})();

