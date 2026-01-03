import { REST, Routes } from "discord.js";
import "dotenv/config";

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, GUILD_ID } = process.env;

const commands = [
  { name: "balance", description: "Check your coin balance" },
  {
    name: "addcoins",
    description: "Add coins (admin)",
    options: [
      { name: "user", type: 6, required: true, description: "User" },
      { name: "amount", type: 4, required: true, description: "Amount" },
      { name: "reason", type: 3, required: false, description: "Reason" },
    ],
  },
  {
    name: "removecoins",
    description: "Remove coins (admin)",
    options: [
      { name: "user", type: 6, required: true },
      { name: "amount", type: 4, required: true },
      { name: "reason", type: 3, required: false },
    ],
  },
  {
    name: "usecoins",
    description: "Spend coins",
    options: [
      { name: "amount", type: 4, required: true },
      { name: "reason", type: 3, required: false },
    ],
  },
  { name: "transactions", description: "View your transactions" },
  {
    name: "checkcoins",
    description: "Check user coins (admin)",
    options: [{ name: "user", type: 6, required: true }],
  },
  {
    name: "usertransactions",
    description: "View user transactions (admin)",
    options: [{ name: "user", type: 6, required: true }],
  },
];

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

await rest.put(
  Routes.applicationGuildCommands(DISCORD_CLIENT_ID, GUILD_ID),
  { body: commands }
);

console.log("✅ Slash commands registered");
