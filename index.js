import "dotenv/config";
import express from "express";
import { Client, GatewayIntentBits } from "discord.js";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 10000;

// --- ENV ---
const DISCORD_TOKEN = process.env.DISCORD_TOKEN?.trim();
const GUILD_ID = process.env.GUILD_ID?.trim();
const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!DISCORD_TOKEN) console.error("❌ Missing DISCORD_TOKEN");
if (!GUILD_ID) console.error("❌ Missing GUILD_ID");
if (!SUPABASE_URL) console.error("❌ Missing SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) console.error("❌ Missing SUPABASE_SERVICE_ROLE_KEY");

// Stop early if critical env vars missing (prevents “app did not respond” confusion)
if (!DISCORD_TOKEN || !GUILD_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ One or more required ENV vars missing. Fix Render env vars and redeploy.");
} else {
  console.log("✅ ENV looks good");
}

// --- SUPABASE ---
const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "");

// --- DISCORD CLIENT ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// helper: get balance, return 0 if none
async function getBalance(userId) {
  const { data, error } = await supabase
    .from("coin_balances")
    .select("balance")
    .eq("guild_id", GUILD_ID)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Supabase getBalance error:", error);
    return 0;
  }
  return data?.balance ?? 0;
}

async function setBalance(userId, newBalance) {
  const { error } = await supabase
    .from("coin_balances")
    .upsert(
      { guild_id: GUILD_ID, user_id: userId, balance: newBalance },
      { onConflict: "guild_id,user_id" }
    );

  if (error) console.error("Supabase setBalance error:", error);
}

// --- COMMAND HANDLER ---
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    // /balance
    if (interaction.commandName === "balance") {
      const bal = await getBalance(interaction.user.id);
      return interaction.reply({
        content: `💰 Your balance is **${bal}** coins`,
        ephemeral: true,
      });
    }

    // /addcoins
    if (interaction.commandName === "addcoins") {
      const user = interaction.options.getUser("user", true);
      const amount = interaction.options.getInteger("amount", true);

      const current = await getBalance(user.id);
      const next = current + amount;

      await setBalance(user.id, next);

      return interaction.reply({
        content: `✅ Added **${amount}** coins to ${user}. New balance: **${next}**`,
        ephemeral: true,
      });
    }

    // /usecoins
    if (interaction.commandName === "usecoins") {
      const amount = interaction.options.getInteger("amount", true);
      const userId = interaction.user.id;

      const current = await getBalance(userId);

      if (current < amount) {
        return interaction.reply({
          content: `❌ Not enough coins. You have **${current}**, need **${amount}**.`,
          ephemeral: true,
        });
      }

      const next = current - amount;
      await setBalance(userId, next);

      return interaction.reply({
        content: `✅ Used **${amount}** coins. New balance: **${next}**`,
        ephemeral: true,
      });
    }
  } catch (err) {
    console.error("interaction error:", err);
    if (interaction?.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "❌ Error. Try again.", ephemeral: true });
    }
  }
});

// --- KEEP RENDER WEB SERVICE ALIVE ---
app.get("/", (req, res) => res.status(200).send("Coin Bank Bot is running ✅"));
app.get("/health", (req, res) => res.status(200).json({ ok: true }));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// --- LOGIN ---
client.login(DISCORD_TOKEN).catch((e) => console.error("❌ Discord login failed:", e));
