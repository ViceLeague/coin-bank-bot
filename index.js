// index.js
import "dotenv/config";
import express from "express";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 10000;

// --- ENVIRONMENT VARIABLES ---
const {
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  GUILD_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID || !GUILD_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing environment variables.");
  process.exit(1);
} else {
  console.log("✅ ENV looks good");
}

// --- SUPABASE SETUP ---
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- DISCORD CLIENT SETUP ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  registerCommands(); // Only registers once bot is ready
});

// --- SLASH COMMAND REGISTRATION ---
async function registerCommands() {
  console.log("🔁 Registering slash commands...");

  const commands = [
    new SlashCommandBuilder()
      .setName("balance")
      .setDescription("Check your coin balance"),
    new SlashCommandBuilder()
      .setName("addcoins")
      .setDescription("Add coins to a user (admin only)")
      .addUserOption(opt => opt.setName("user").setDescription("Target user").setRequired(true))
      .addIntegerOption(opt => opt.setName("amount").setDescription("Coins to add").setRequired(true)),
    new SlashCommandBuilder()
      .setName("usecoins")
      .setDescription("Use your coins")
      .addIntegerOption(opt => opt.setName("amount").setDescription("Coins to spend").setRequired(true)),
  ].map(cmd => cmd.toJSON());

  try {
    const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
    await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log("✅ Slash commands registered.");
  } catch (err) {
    console.error("❌ Command registration failed:", err);
  }
}

// --- INTERACTION HANDLER ---
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;

  try {
    if (interaction.commandName === "balance") {
      const { data, error } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", userId)
        .eq("guild_id", GUILD_ID)
        .single();

      const balance = error || !data ? 0 : data.balance;

      await interaction.reply({
        content: `💰 You have **${balance}** coins.`,
        ephemeral: true,
      });

    } else if (interaction.commandName === "addcoins") {
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
        content: `✅ Added **${amount}** coins to ${target.username}. New balance: **${updated}**.`,
        ephemeral: true,
      });

    } else if (interaction.commandName === "usecoins") {
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
          content: `❌ You only have **${current}** coins, but you need **${amount}**.`,
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
        content: `✅ You spent **${amount}** coins. Remaining: **${updated}**.`,
        ephemeral: true,
      });
    }
  } catch (err) {
    console.error("⚠️ Error in command handler:", err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "❌ Something went wrong.", ephemeral: true });
    }
  }
});

// --- KEEP RENDER ALIVE ---
app.get("/", (req, res) => res.send("Coin Bank Bot is running ✅"));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// --- LOGIN TO DISCORD ---
console.log("🔐 Logging in to Discord...");
client.login(DISCORD_TOKEN);
