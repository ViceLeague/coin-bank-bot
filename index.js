import express from "express";
import { Client, GatewayIntentBits } from "discord.js";
import pg from "pg";

const app = express();
const PORT = process.env.PORT || 10000;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get("/health", (req, res) => {
  res.send("OK");
});

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});
