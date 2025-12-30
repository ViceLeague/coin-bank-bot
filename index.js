import "dotenv/config";
import express from "express";
import { Client, GatewayIntentBits } from "discord.js";
import { createClient } from "@supabase/supabase-js";

// --------------------
// EXPRESS (Render keep-alive)
// --------------------
const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => res.send("Coin Bank Bot is running ✅"));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// --------------------
// ENV
// --------------------
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const missing = [];
if (!DISCORD_TOKEN) missing.push("DISCORD_TOKEN");
if (!DISCORD_CLIENT_ID) missing.push("DISCORD_CLIENT_ID");
if (!GUILD_ID) missing.push("GUILD_ID");
if (!SUPABASE_URL) missing.push("SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");

if (missing.length) {
  console.error(`❌ Missing env vars: ${missing.join(", ")}`);
} else {
  console.log("✅ ENV looks good");
}

// --------------------
// SUPABASE
// --------------------
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --------------------
// DISCORD CLIENT
// --------------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// If Discord errors, we want to see them
client.on("error", (err) => console.error("❌ Discord client error:", err));
process.on("unhandledRejection", (reason) =>
  console.error("❌ Unhandled Rejection:", reason)
);
process.on("uncaughtException", (err) =>
  console.error("❌ Uncaught Exception:", err)
);

// --------------------
// COMMANDS
// --------------------
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

      const bal = error || !data ? 0 : (data.balance ?? 0);

      return interaction.reply({
        content: `💰 Your balance is **${bal}** coins`,
        ephemeral: true,
      });
    }

    // /addcoins
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

    if (
      interaction?.isRepliable() &&
      !interaction.replied &&
      !interaction.deferred
    ) {
      await interaction.reply({ content: "❌ Error. Try again.", ephemeral: true });
    }
  }
});

// --------------------
// LOGIN
// --------------------
console.log("🔐 Logging in to Discord...");
client.login(DISCORD_TOKEN).catch((e) => {
  console.error("❌ Discord login failed (token/permissions issue):", e);
});
