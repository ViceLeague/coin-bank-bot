import "dotenv/config";
import express from "express";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 10000;

// --- ENV ---
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DISCORD_TOKEN || !GUILD_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CLIENT_ID) {
  console.error("❌ Missing required environment variables.");
  process.exit(1);
} else {
  console.log("✅ ENV looks good");
}

// --- SUPABASE ---
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- DISCORD CLIENT ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  registerCommands(); // register slash commands when bot logs in
});

// --- REGISTER SLASH COMMANDS ---
async function registerCommands() {
  console.log("🔁 Registering slash commands to your guild...");

  const commands = [
    new SlashCommandBuilder()
      .setName("balance")
      .setDescription("Check your current coin balance"),
    new SlashCommandBuilder()
      .setName("addcoins")
      .setDescription("Add coins to a user (admin only)")
      .addUserOption(option =>
        option.setName("user").setDescription("User to give coins").setRequired(true)
      )
      .addIntegerOption(option =>
        option.setName("amount").setDescription("Amount of coins to add").setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("usecoins")
      .setDescription("Spend coins from your balance")
      .addIntegerOption(option =>
        option.setName("amount").setDescription("Amount to spend").setRequired(true)
      ),
  ].map(command => command.toJSON());

  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log("✅ Slash commands registered successfully.");
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
  }
}

// --- INTERACTION HANDLER ---
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    const userId = interaction.user.id;

    if (interaction.commandName === "balance") {
      const { data, error } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", userId)
        .eq("guild_id", GUILD_ID)
        .single();

      const balance = error || !data ? 0 : data.balance;

      return interaction.reply({
        content: `💰 Your balance is **${balance}** coins.`,
        ephemeral: true,
      });
    }

    if (interaction.commandName === "addcoins") {
      const target = interaction.options.getUser("user", true);
      const amount = interaction.options.getInteger("amount", true);

      const { data } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", target.id)
        .eq("guild_id", GUILD_ID)
        .single();

      const current = data?.balance ?? 0;
      const newBalance = current + amount;

      await supabase.from("coin_balances").upsert({
        user_id: target.id,
        guild_id: GUILD_ID,
        balance: newBalance,
      });

      return interaction.reply({
        content: `✅ Added **${amount}** coins to ${target}. New balance: **${newBalance}**`,
        ephemeral: true,
      });
    }

    if (interaction.commandName === "usecoins") {
      const amount = interaction.options.getInteger("amount", true);

      const { data } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", userId)
        .eq("guild_id", GUILD_ID)
        .single();

      const current = data?.balance ?? 0;

      if (current < amount) {
        return interaction.reply({
          content: `❌ Not enough coins. You have **${current}**, need **${amount}**.`,
          ephemeral: true,
        });
      }

      const newBalance = current - amount;

      await supabase.from("coin_balances").upsert({
        user_id: userId,
        guild_id: GUILD_ID,
        balance: newBalance,
      });

      return interaction.reply({
        content: `✅ You used **${amount}** coins. Remaining: **${newBalance}**`,
        ephemeral: true,
      });
    }
  } catch (err) {
    console.error("⚠️ Error in interaction handler:", err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "❌ Something went wrong.", ephemeral: true });
    }
  }
});

// --- EXPRESS KEEP-ALIVE ---
app.get("/", (req, res) => res.send("Coin Bank Bot is running ✅"));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// --- START BOT ---
console.log("🔐 Logging in to Discord...");
client.login(DISCORD_TOKEN);
