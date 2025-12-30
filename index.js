import "dotenv/config";
import express from "express";
import { Client, GatewayIntentBits, REST, Routes } from "discord.js";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 10000;

// ---- ENV ----
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const REQUIRED = {
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  GUILD_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
};

const missing = Object.entries(REQUIRED)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  console.error("❌ Missing env vars:", missing.join(", "));
} else {
  console.log("✅ ENV looks good");
}

// ---- SUPABASE ----
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---- DISCORD ----
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Slash command definitions (Guild-scoped: fast updates)
const COMMANDS = [
  {
    name: "balance",
    description: "Show your coin balance",
  },
  {
    name: "addcoins",
    description: "Add coins to a user (admin)",
    default_member_permissions: "0", // admin-only control is better done via Discord role perms; keeping 0 prevents random use
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
    description: "Spend coins from your balance",
    options: [
      {
        name: "amount",
        description: "Coins to use",
        type: 4, // INTEGER
        required: true,
        min_value: 1,
      },
    ],
  },
];

// Register commands to your guild
async function registerGuildCommands() {
  try {
    console.log("🔁 Registering slash commands to your guild...");
    const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
    await rest.put(
      Routes.applicationGuildCommands(DISCORD_CLIENT_ID, GUILD_ID),
      { body: COMMANDS }
    );
    console.log("✅ Slash commands registered");
  } catch (err) {
    console.error("❌ Failed to register commands:", err?.message || err);
    if (err?.rawError) console.error("rawError:", err.rawError);
  }
}

// Ensure user row exists (optional helper)
async function ensureRow(userId) {
  // upsert "do nothing" style
  await supabase.from("coin_balances").upsert({
    user_id: userId,
    guild_id: GUILD_ID,
    balance: 0,
  }, { onConflict: "user_id,guild_id" });
}

// Read balance
async function getBalance(userId) {
  const { data, error } = await supabase
    .from("coin_balances")
    .select("balance")
    .eq("user_id", userId)
    .eq("guild_id", GUILD_ID)
    .single();

  // if row not found, treat as 0
  if (error || !data) return 0;
  return data.balance ?? 0;
}

// Set balance
async function setBalance(userId, balance) {
  await supabase.from("coin_balances").upsert(
    { user_id: userId, guild_id: GUILD_ID, balance },
    { onConflict: "user_id,guild_id" }
  );
}

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerGuildCommands();
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    // /balance
    if (interaction.commandName === "balance") {
      const userId = interaction.user.id;

      await ensureRow(userId);
      const bal = await getBalance(userId);

      return interaction.reply({
        content: `💰 Your balance is **${bal}** coins`,
        ephemeral: true,
      });
    }

    // /addcoins
    if (interaction.commandName === "addcoins") {
      const user = interaction.options.getUser("user", true);
      const amount = interaction.options.getInteger("amount", true);

      // Simple admin gate: require Manage Server or Administrator
      const member = interaction.member;
      const isAdmin =
        member?.permissions?.has?.("Administrator") ||
        member?.permissions?.has?.("ManageGuild");

      if (!isAdmin) {
        return interaction.reply({
          content: "❌ You don’t have permission to use this command.",
          ephemeral: true,
        });
      }

      await ensureRow(user.id);
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

      await ensureRow(userId);
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

// ---- Render web endpoint (keeps Web Service happy) ----
app.get("/", (req, res) => res.send("Coin Bank Bot is running ✅"));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// ---- Login ----
console.log("🔐 Logging in to Discord...");
client.login(DISCORD_TOKEN).catch((e) => {
  console.error("❌ Discord login failed:", e?.message || e);
});
