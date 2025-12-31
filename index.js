import "dotenv/config";
import express from "express";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 10000;

// --- ENV ---
const { DISCORD_TOKEN, GUILD_ID, DISCORD_CLIENT_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!DISCORD_TOKEN || !GUILD_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DISCORD_CLIENT_ID) {
  console.error("❌ Missing environment variables.");
  process.exit(1);
} else {
  console.log("✅ ENV variables loaded");
}

// --- Supabase ---
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Discord Client ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  registerCommands();
});

// --- Register Slash Commands ---
async function registerCommands() {
  console.log("🔁 Registering slash commands...");

  const commands = [
    new SlashCommandBuilder()
      .setName("balance")
      .setDescription("Check your current coin balance"),
    new SlashCommandBuilder()
      .setName("addcoins")
      .setDescription("Add coins to a user")
      .addUserOption(option => option.setName("user").setDescription("User").setRequired(true))
      .addIntegerOption(option => option.setName("amount").setDescription("Amount").setRequired(true)),
    new SlashCommandBuilder()
      .setName("usecoins")
      .setDescription("Spend some of your coins")
      .addIntegerOption(option => option.setName("amount").setDescription("Amount").setRequired(true)),
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  try {
    await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log("✅ Slash commands registered.");
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
  }
}

// --- Interaction Handler ---
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;
  const command = interaction.commandName;

  try {
    await interaction.deferReply({ ephemeral: true });

    if (command === "balance") {
      const { data, error } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", userId)
        .eq("guild_id", GUILD_ID)
        .single();

      console.log("Supabase /balance query result:", data, error);

      const balance = error || !data ? 0 : data.balance;

      return interaction.editReply(`💰 Your balance is **${balance}** coins.`);
    }

    if (command === "addcoins") {
      const user = interaction.options.getUser("user", true);
      const amount = interaction.options.getInteger("amount", true);

      const { data } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", user.id)
        .eq("guild_id", GUILD_ID)
        .single();

      const current = data?.balance ?? 0;
      const newBalance = current + amount;

      await supabase.from("coin_balances").upsert({
        user_id: user.id,
        guild_id: GUILD_ID,
        balance: newBalance,
      });

      return interaction.editReply(`✅ Added **${amount}** coins to ${user}. New balance: **${newBalance}**`);
    }

    if (command === "usecoins") {
      const amount = interaction.options.getInteger("amount", true);

      const { data } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", userId)
        .eq("guild_id", GUILD_ID)
        .single();

      const current = data?.balance ?? 0;

      if (current < amount) {
        return interaction.editReply(`❌ Not enough coins. You have **${current}**, need **${amount}**.`);
      }

      const newBalance = current - amount;

      await supabase.from("coin_balances").upsert({
        user_id: userId,
        guild_id: GUILD_ID,
        balance: newBalance,
      });

      return interaction.editReply(`✅ You used **${amount}** coins. Remaining: **${newBalance}**`);
    }

    return interaction.editReply("❌ Unknown command.");
  } catch (err) {
    console.error("⚠️ Command Error:", err);
    if (interaction.isRepliable()) {
      try {
        await interaction.editReply({ content: "❌ Something went wrong. Try again later." });
      } catch {
        // If already replied or error again, do nothing
      }
    }
  }
});

// --- Express keep-alive ---
app.get("/", (req, res) => res.send("Coin Bank Bot is running ✅"));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// --- Login Bot ---
console.log("🔐 Logging in to Discord...");
client.login(DISCORD_TOKEN);
