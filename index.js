import "dotenv/config";
import express from "express";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import { createClient } from "@supabase/supabase-js";

// --- Setup Express for keep-alive ---
const app = express();
const PORT = process.env.PORT || 10000;
app.get("/", (_, res) => res.send("✅ Coin Bank Bot is running."));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// --- Load environment variables ---
const {
  DISCORD_TOKEN,
  GUILD_ID,
  DISCORD_CLIENT_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_IDS // comma-separated Discord user IDs of admins
} = process.env;

if (!DISCORD_TOKEN || !GUILD_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DISCORD_CLIENT_ID) {
  console.error("❌ Missing required environment variables.");
  process.exit(1);
}

const adminIds = ADMIN_IDS ? ADMIN_IDS.split(",") : [];

// --- Supabase Setup ---
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Discord Client Setup ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// --- Register Commands ---
const commands = [
  new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Check your current coin balance"),
  new SlashCommandBuilder()
    .setName("addcoins")
    .setDescription("Admins: Add coins to a user")
    .addUserOption(opt => opt.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(opt => opt.setName("amount").setDescription("Amount").setRequired(true)),
  new SlashCommandBuilder()
    .setName("usecoins")
    .setDescription("Spend coins")
    .addIntegerOption(opt => opt.setName("amount").setDescription("Amount").setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

// --- Register Slash Commands ---
async function registerCommands() {
  try {
    await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Slash commands registered.");
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
  }
}

// --- Handle Commands ---
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, user, options } = interaction;
  const userId = user.id;

  try {
    await interaction.deferReply({ ephemeral: true });

    // --- /balance ---
    if (commandName === "balance") {
      const { data, error } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", userId)
        .eq("guild_id", GUILD_ID)
        .single();

      const balance = error || !data ? 0 : data.balance;
      return interaction.editReply(`💰 Your balance is **${balance}** coins.`);
    }

    // --- /addcoins ---
    if (commandName === "addcoins") {
      if (!adminIds.includes(userId)) {
        return interaction.editReply("❌ You do not have permission to use this command.");
      }

      const target = options.getUser("user", true);
      const amount = options.getInteger("amount", true);

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

      return interaction.editReply(`✅ Added **${amount}** coins to ${target.username}. New balance: **${newBalance}**.`);
    }

    // --- /usecoins ---
    if (commandName === "usecoins") {
      const amount = options.getInteger("amount", true);

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

      return interaction.editReply(`✅ You used **${amount}** coins. Remaining: **${newBalance}**.`);
    }

    return interaction.editReply("❌ Unknown command.");
  } catch (err) {
    console.error("⚠️ Command Error:", err);
    if (interaction.isRepliable()) {
      try {
        await interaction.editReply("❌ Something went wrong.");
      } catch {}
    }
  }
});

// --- Start Bot ---
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  registerCommands();
});

client.login(DISCORD_TOKEN);
