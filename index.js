import "dotenv/config";
import express from "express";
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} from "discord.js";
import { createClient } from "@supabase/supabase-js";

/* =========================
   BASIC SETUP
========================= */

const app = express();
const PORT = process.env.PORT || 10000;

const {
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  GUILD_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
} = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID || !GUILD_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

console.log("✅ ENV variables loaded");

/* =========================
   SUPABASE
========================= */

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

/* =========================
   DISCORD CLIENT
========================= */

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

/* =========================
   READY + REGISTER COMMANDS
========================= */

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerSlashCommands();
});

async function registerSlashCommands() {
  console.log("🔁 Registering slash commands...");

  const commands = [
    new SlashCommandBuilder()
      .setName("balance")
      .setDescription("Check your coin balance"),

    new SlashCommandBuilder()
      .setName("addcoins")
      .setDescription("Add coins to a user")
      .addUserOption(opt =>
        opt.setName("user").setDescription("User").setRequired(true)
      )
      .addIntegerOption(opt =>
        opt.setName("amount").setDescription("Coins").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("usecoins")
      .setDescription("Spend coins")
      .addIntegerOption(opt =>
        opt.setName("amount").setDescription("Coins").setRequired(true)
      ),
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  try {
    await rest.put(
      Routes.applicationGuildCommands(DISCORD_CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("✅ Slash commands registered");
  } catch (err) {
    console.error("❌ Command registration failed:", err);
  }
}

/* =========================
   INTERACTION HANDLER
========================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    /* ---------- /balance ---------- */
    if (interaction.commandName === "balance") {
      console.log("📥 /balance received");

      // 🔑 THIS FIXES "APPLICATION DID NOT RESPOND"
      await interaction.deferReply({ ephemeral: true });

      const { data, error } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", interaction.user.id)
        .eq("guild_id", interaction.guildId)
        .single();

      console.log("📊 Supabase /balance result:", { data, error });

      const balance = data?.balance ?? 0;

      return interaction.editReply({
        content: `💰 Your balance is **${balance}** coins`
      });
    }

    /* ---------- /addcoins ---------- */
    if (interaction.commandName === "addcoins") {
      await interaction.deferReply({ ephemeral: true });

      const user = interaction.options.getUser("user");
      const amount = interaction.options.getInteger("amount");

      const { data } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", user.id)
        .eq("guild_id", interaction.guildId)
        .single();

      const newBalance = (data?.balance ?? 0) + amount;

      await supabase.from("coin_balances").upsert({
        user_id: user.id,
        guild_id: interaction.guildId,
        balance: newBalance
      });

      return interaction.editReply({
        content: `✅ Added **${amount}** coins to ${user}. New balance: **${newBalance}**`
      });
    }

    /* ---------- /usecoins ---------- */
    if (interaction.commandName === "usecoins") {
      await interaction.deferReply({ ephemeral: true });

      const amount = interaction.options.getInteger("amount");

      const { data } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", interaction.user.id)
        .eq("guild_id", interaction.guildId)
        .single();

      const current = data?.balance ?? 0;

      if (current < amount) {
        return interaction.editReply({
          content: `❌ Not enough coins. You have **${current}**`
        });
      }

      const newBalance = current - amount;

      await supabase.from("coin_balances").upsert({
        user_id: interaction.user.id,
        guild_id: interaction.guildId,
        balance: newBalance
      });

      return interaction.editReply({
        content: `✅ Used **${amount}** coins. Remaining: **${newBalance}**`
      });
    }

  } catch (err) {
    console.error("❌ Interaction error:", err);

    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ An unexpected error occurred.",
        ephemeral: true
      });
    }
  }
});

/* =========================
   KEEP RENDER ALIVE
========================= */

app.get("/", (_, res) => res.send("Coin Bank Bot running ✅"));
app.listen(PORT, () =>
  console.log(`🌐 Web server running on port ${PORT}`)
);

/* =========================
   LOGIN
========================= */

console.log("🔐 Logging in to Discord...");
client.login(DISCORD_TOKEN);
