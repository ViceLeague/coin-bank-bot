import "dotenv/config";
import express from "express";
import { Client, GatewayIntentBits, REST, Routes, PermissionFlagsBits } from "discord.js";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 10000;

// ===== ENV =====
const DISCORD_TOKEN = process.env.DISCORD_TOKEN?.trim();
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID?.trim();
const GUILD_ID = process.env.GUILD_ID?.trim();
const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

function envOk() {
  const missing = [];
  if (!DISCORD_TOKEN) missing.push("DISCORD_TOKEN");
  if (!DISCORD_CLIENT_ID) missing.push("DISCORD_CLIENT_ID");
  if (!GUILD_ID) missing.push("GUILD_ID");
  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length) {
    console.error("❌ Missing env vars:", missing.join(", "));
    return false;
  }
  console.log("✅ ENV looks good");
  return true;
}

// ===== SUPABASE =====
const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "");

// ===== DISCORD CLIENT =====
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// IMPORTANT: show if login fails
client.on("error", (e) => console.error("❌ Discord client error:", e));
process.on("unhandledRejection", (e) => console.error("❌ UnhandledRejection:", e));
process.on("uncaughtException", (e) => console.error("❌ UncaughtException:", e));

// ===== DATABASE HELPERS =====
async function getBalance(userId) {
  const { data, error } = await supabase
    .from("coin_balances")
    .select("balance")
    .eq("user_id", userId)
    .eq("guild_id", GUILD_ID)
    .maybeSingle();

  if (error) console.error("Supabase getBalance error:", error);
  return data?.balance ?? 0;
}

async function setBalance(userId, balance) {
  const { error } = await supabase.from("coin_balances").upsert({
    user_id: userId,
    guild_id: GUILD_ID,
    balance,
  });

  if (error) console.error("Supabase setBalance error:", error);
}

// ===== SLASH COMMANDS (AUTO REGISTER ON START) =====
// This removes the need for Render Shell/premium.
// Each deploy will ensure commands exist in your server.
async function registerGuildCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  const commands = [
    {
      name: "balance",
      description: "Check your coin balance",
    },
    {
      name: "addcoins",
      description: "Add coins to a user (Admin only)",
      default_member_permissions: PermissionFlagsBits.Administrator.toString(),
      options: [
        {
          name: "user",
          description: "User to add coins to",
          type: 6, // USER
          required: true,
        },
        {
          name: "amount",
          description: "Coins to add",
          type: 4, // INTEGER
          required: true,
          min_value: 1,
        },
      ],
    },
    {
      name: "usecoins",
      description: "Spend coins (subtract from your balance)",
      options: [
        {
          name: "amount",
          description: "Coins to spend",
          type: 4, // INTEGER
          required: true,
          min_value: 1,
        },
      ],
    },
  ];

  try {
    console.log("🔁 Registering slash commands to your guild...");
    await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log("✅ Slash commands registered/updated");
  } catch (err) {
    console.error("❌ Slash command registration failed:", err);
  }
}

// ===== INTERACTIONS =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "balance") {
      const bal = await getBalance(interaction.user.id);
      return interaction.reply({ content: `💰 Your balance is **${bal}** coins`, ephemeral: true });
    }

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

    if (interaction.commandName === "usecoins") {
      const amount = interaction.options.getInteger("amount", true);

      const current = await getBalance(interaction.user.id);
      if (current < amount) {
        return interaction.reply({
          content: `❌ Not enough coins. You have **${current}**, need **${amount}**.`,
          ephemeral: true,
        });
      }

      const next = current - amount;
      await setBalance(interaction.user.id, next);

      return interaction.reply({
        content: `✅ Used **${amount}** coins. New balance: **${next}**`,
        ephemeral: true,
      });
    }
  } catch (err) {
    console.error("interaction error:", err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "❌ Error. Try again.", ephemeral: true });
    }
  }
});

// ===== KEEP RENDER WEB SERVICE ALIVE =====
app.get("/", (req, res) => res.send("Coin Bank Bot is running ✅"));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// ===== START =====
(async () => {
  if (!envOk()) return;

  // Register commands first (no shell needed)
  await registerGuildCommands();

  // Login after
  try {
    console.log("🔐 Logging in to Discord...");
    await client.login(DISCORD_TOKEN);
  } catch (e) {
    console.error("❌ Login failed:", e);
  }
})();
