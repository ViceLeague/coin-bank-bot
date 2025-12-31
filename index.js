import "dotenv/config";
import express from "express";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 10000;

// ENV Variables
const {
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  GUILD_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
} = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID || !GUILD_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing one or more required environment variables.");
  process.exit(1);
} else {
  console.log("✅ ENV looks good");
}

// Supabase Client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerCommands();
});

// Slash Command Registration
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("balance")
      .setDescription("Check your current coin balance"),
    new SlashCommandBuilder()
      .setName("addcoins")
      .setDescription("Add coins to a user (admin only)")
      .addUserOption(option =>
        option.setName("user").setDescription("User to add coins to").setRequired(true)
      )
      .addIntegerOption(option =>
        option.setName("amount").setDescription("Amount of coins to add").setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("usecoins")
      .setDescription("Spend coins from your balance")
      .addIntegerOption(option =>
        option.setName("amount").setDescription("Amount to use").setRequired(true)
      ),
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  try {
    console.log("🔁 Registering slash commands...");
    await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Slash commands registered.");
  } catch (error) {
    console.error("❌ Failed to register commands:", error);
  }
}

// Handle Slash Commands
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;
  const userId = interaction.user.id;

  try {
    if (commandName === "balance") {
      const { data, error } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", userId)
        .eq("guild_id", GUILD_ID)
        .single();

      const balance = error || !data ? 0 : data.balance ?? 0;

      await interaction.reply({
        content: `💰 Your balance is **${balance}** coins.`,
        ephemeral: true,
      });
    }

    if (commandName === "addcoins") {
      const target = interaction.options.getUser("user", true);
      const amount = interaction.options.getInteger("amount", true);

      const { data } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", target.id)
        .eq("guild_id", GUILD_ID)
        .single();

      const current = data?.balance ?? 0;
      const updated = current + amount;

      await supabase.from("coin_balances").upsert({
        user_id: target.id,
        guild_id: GUILD_ID,
        balance: updated,
      });

      await interaction.reply({
        content: `✅ Added **${amount}** coins to ${target.tag}. New balance: **${updated}**`,
        ephemeral: true,
      });
    }

    if (commandName === "usecoins") {
      const amount = interaction.options.getInteger("amount", true);

      const { data } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", userId)
        .eq("guild_id", GUILD_ID)
        .single();

      const current = data?.balance ?? 0;

      if (current < amount) {
        return await interaction.reply({
          content: `❌ You don't have enough coins. Current: **${current}**, Needed: **${amount}**`,
          ephemeral: true,
        });
      }

      const updated = current - amount;

      await supabase.from("coin_balances").upsert({
        user_id: userId,
        guild_id: GUILD_ID,
        balance: updated,
      });

      await interaction.reply({
        content: `✅ You used **${amount}** coins. Remaining: **${updated}**`,
        ephemeral: true,
      });
    }
  } catch (err) {
    console.error("⚠️ Interaction Error:", err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "❌ An error occurred.", ephemeral: true });
    }
  }
});

// Express Keep-Alive
app.get("/", (req, res) => res.send("Coin Bank Bot is running ✅"));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// Login
console.log("🔐 Logging in to Discord...");
client.login(DISCORD_TOKEN);
