import "dotenv/config";
import express from "express";
import { Client, GatewayIntentBits } from "discord.js";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 10000;

// --- ENV ---
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DISCORD_TOKEN) console.error("❌ Missing DISCORD_TOKEN");
if (!GUILD_ID) console.error("❌ Missing GUILD_ID");
if (!SUPABASE_URL) console.error("❌ Missing SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) console.error("❌ Missing SUPABASE_SERVICE_ROLE_KEY");

// --- SUPABASE ---
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- DISCORD CLIENT ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// --- COMMAND HANDLER ---
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    // /balance
    if (interaction.commandName === "balance") {
      const userId = interaction.user.id;

      const { data, error } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", userId)
        .eq("guild_id", GUILD_ID)
        .single();

      // If user not found, treat as 0
      const bal = error || !data ? 0 : (data.balance ?? 0);

      return interaction.reply({
        content: `💰 Your balance is **${bal}** coins`,
        ephemeral: true,
      });
    }

    // /addcoins (admin only is handled by Discord perms when you register it)
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
        content: `✅ Added **${amount}** coins to ${user}. New balance: **${next}**`,
        ephemeral: true,
      });
    }

    // /usecoins
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
    console.error("interaction error:", err);
    // If Discord expects a reply and we error, try to reply safely:
    if (interaction?.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "❌ Error. Try again.", ephemeral: true });
    }
  }
});

// --- KEEP RENDER WEB SERVICE ALIVE ---
app.get("/", (req, res) => res.send("Coin Bank Bot is running ✅"));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// --- LOGIN ---
client.login(DISCORD_TOKEN);

