import "dotenv/config";
import express from "express";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 10000;

// ENV setup
const { DISCORD_TOKEN, DISCORD_CLIENT_ID, GUILD_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID || !GUILD_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing environment variables.");
  process.exit(1);
}

console.log("✅ ENV variables loaded.");

// Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerSlashCommands();
});

// Register slash commands
async function registerSlashCommands() {
  console.log("🔁 Registering slash commands...");

  const commands = [
    new SlashCommandBuilder()
      .setName("balance")
      .setDescription("Check your coin balance."),
    new SlashCommandBuilder()
      .setName("addcoins")
      .setDescription("Add coins to a user.")
      .addUserOption(option =>
        option.setName("user").setDescription("User to add coins to").setRequired(true))
      .addIntegerOption(option =>
        option.setName("amount").setDescription("Number of coins to add").setRequired(true)),
    new SlashCommandBuilder()
      .setName("usecoins")
      .setDescription("Spend your coins.")
      .addIntegerOption(option =>
        option.setName("amount").setDescription("Amount to spend").setRequired(true)),
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Slash commands registered.");
  } catch (error) {
    console.error("❌ Error registering commands:", error);
  }
}

// Handle interactions
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  try {
    switch (interaction.commandName) {
      case "balance": {
        const { data, error } = await supabase
          .from("coin_balances")
          .select("balance")
          .eq("user_id", userId)
          .eq("guild_id", guildId)
          .single();

        console.log("Supabase /balance query result:", { data, error });

        const balance = error || !data ? 0 : data.balance;

        await interaction.reply({
          content: `💰 You have **${balance}** coins.`,
          ephemeral: true,
        });
        break;
      }

      case "addcoins": {
        const target = interaction.options.getUser("user");
        const amount = interaction.options.getInteger("amount");

        const { data } = await supabase
          .from("coin_balances")
          .select("balance")
          .eq("user_id", target.id)
          .eq("guild_id", guildId)
          .single();

        const newBalance = (data?.balance || 0) + amount;

        await supabase.from("coin_balances").upsert({
          user_id: target.id,
          guild_id: guildId,
          balance: newBalance,
        });

        await interaction.reply({
          content: `✅ Added **${amount}** coins to ${target}. New balance: **${newBalance}**.`,
          ephemeral: true,
        });
        break;
      }

      case "usecoins": {
        const amount = interaction.options.getInteger("amount");

        const { data } = await supabase
          .from("coin_balances")
          .select("balance")
          .eq("user_id", userId)
          .eq("guild_id", guildId)
          .single();

        const current = data?.balance || 0;

        if (current < amount) {
          await interaction.reply({
            content: `❌ Not enough coins. You have **${current}**, but need **${amount}**.`,
            ephemeral: true,
          });
          return;
        }

        const newBalance = current - amount;

        await supabase.from("coin_balances").upsert({
          user_id: userId,
          guild_id: guildId,
          balance: newBalance,
        });

        await interaction.reply({
          content: `✅ You spent **${amount}** coins. Remaining: **${newBalance}**.`,
          ephemeral: true,
        });
        break;
      }
    }
  } catch (err) {
    console.error("⚠️ Interaction error:", err);
    if (interaction.isRepliable()) {
      await interaction.reply({ content: "❌ An error occurred.", ephemeral: true });
    }
  }
});

// Express keep-alive
app.get("/", (_, res) => res.send("✅ Coin Bank Bot is running!"));
app.listen(PORT, () => {
  console.log(`🌐 Express server live at http://localhost:${PORT}`);
});

// Start bot
console.log("🔐 Logging in...");
client.login(DISCORD_TOKEN);
