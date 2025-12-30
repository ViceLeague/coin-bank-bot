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

if (!DISCORD_TOKEN || !GUILD_ID || !CLIENT_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing one or more environment variables.");
  process.exit(1);
} else {
  console.log("✅ ENV looks good");
}

// --- SUPABASE ---
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- DISCORD CLIENT ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // --- Register Slash Commands ---
  console.log("🔁 Registering slash commands to your guild...");

  const commands = [
    new SlashCommandBuilder()
      .setName("balance")
      .setDescription("Check your coin balance"),
    new SlashCommandBuilder()
      .setName("addcoins")
      .setDescription("Add coins to a user")
      .addUserOption(option =>
        option.setName("user").setDescription("User to add coins to").setRequired(true))
      .addIntegerOption(option =>
        option.setName("amount").setDescription("Amount of coins").setRequired(true)),
    new SlashCommandBuilder()
      .setName("usecoins")
      .setDescription("Spend coins from your balance")
      .addIntegerOption(option =>
        option.setName("amount").setDescription("How many coins to use").setRequired(true)),
  ].map(command => command.toJSON());

  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("✅ Slash commands registered successfully.");
  } catch (err) {
    console.error("❌ Error registering slash commands:", err);
  }
});

// --- INTERACTION HANDLER ---
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "balance") {
      const userId = interaction.user.id;

      const { data, error } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", userId)
        .eq("guild_id", GUILD_ID)
        .single();

      const bal = error || !data ? 0 : (data.balance ?? 0);

      return interaction.reply({
        content: `💰 Your balance is **${bal}** coins`,
        ephemeral: true,
      });
    }

    if (interaction.commandName === "addcoins") {
      const user = interaction.options.getUser("user", true);
      const amount = interaction.options.getInteger("amount", true);

      const { data } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", user.id)
        .eq("guild_id", GUILD_ID)
        .single();

      const current = data?.balance ?? 0;
      const next = current + amount;

      await supabase.from("coin_balances").upsert({
        user_id: user.id,
        guild_id: GUILD_ID,
        balance: next,
      });

      return interaction.reply({
        content: `✅ Added **${amount}** coins to ${user.username}. New balance: **${next}**`,
        ephemeral: true,
      });
    }

    if (interaction.commandName === "usecoins") {
      const amount = interaction.options.getInteger("amount", true);
      const userId = interaction.user.id;

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

      const next = current - amount;

      await supabase.from("coin_balances").upsert({
        user_id: userId,
        guild_id: GUILD_ID,
        balance: next,
      });

      return interaction.reply({
        content: `✅ Used **${amount}** coins. New balance: **${next}**`,
        ephemeral: true,
      });
    }
  } catch (err) {
    console.error("❌ interaction error:", err);
    if (interaction?.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "❌ Error. Try again.", ephemeral: true });
    }
  }
});

// --- KEEP RENDER ALIVE ---
app.get("/", (req, res) => res.send("Coin Bank Bot is running ✅"));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// --- LOGIN ---
console.log("🔐 Logging in to Discord...");
client.login(DISCORD_TOKEN);
