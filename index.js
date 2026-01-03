import "dotenv/config";
import express from "express";
import { Client, GatewayIntentBits } from "discord.js";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 10000;

const {
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  GUILD_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_IDS,
} = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID || !GUILD_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_IDS) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

console.log("✅ ENV variables loaded");

// Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Discord
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const adminList = ADMIN_IDS.split(",");

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ---------- INTERACTIONS ----------
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  const userId = interaction.user.id;

  try {
    await interaction.deferReply({ ephemeral: true });

    // ---------- BALANCE ----------
    if (commandName === "balance") {
      const { data } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("guild_id", GUILD_ID)
        .eq("user_id", userId)
        .single();

      const balance = data?.balance ?? 0;
      return interaction.editReply(`💰 Your balance is **${balance}** coins.`);
    }

    // ---------- ADD / REMOVE COINS (ADMIN) ----------
    if (commandName === "addcoins" || commandName === "removecoins") {
      if (!adminList.includes(userId)) {
        return interaction.editReply("❌ Admin only command.");
      }

      const targetUser = interaction.options.getUser("user", true);
      const amount = interaction.options.getInteger("amount", true);
      const reason = interaction.options.getString("reason") || `${commandName} by admin`;

      const { data } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("guild_id", GUILD_ID)
        .eq("user_id", targetUser.id)
        .single();

      const starting = data?.balance ?? 0;
      const ending =
        commandName === "addcoins"
          ? starting + amount
          : Math.max(starting - amount, 0);

      await supabase.from("coin_balances").upsert({
        guild_id: GUILD_ID,
        user_id: targetUser.id,
        balance: ending,
      });

      await supabase.from("transactions").insert({
        guild_id: GUILD_ID,
        user_id: targetUser.id,
        amount: commandName === "addcoins" ? amount : -amount,
        reason,
        starting_balance: starting,
        ending_balance: ending,
      });

      return interaction.editReply(
        `✅ ${commandName === "addcoins" ? "Added" : "Removed"} **${amount}** coins for ${targetUser}\n💱 ${starting} → ${ending}`
      );
    }

    // ---------- USE COINS ----------
    if (commandName === "usecoins") {
      const amount = interaction.options.getInteger("amount", true);
      const reason = interaction.options.getString("reason") || "Used coins";

      const { data } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("guild_id", GUILD_ID)
        .eq("user_id", userId)
        .single();

      const starting = data?.balance ?? 0;
      if (starting < amount) {
        return interaction.editReply(`❌ Not enough coins. You have **${starting}**.`);
      }

      const ending = starting - amount;

      await supabase.from("coin_balances").upsert({
        guild_id: GUILD_ID,
        user_id: userId,
        balance: ending,
      });

      await supabase.from("transactions").insert({
        guild_id: GUILD_ID,
        user_id: userId,
        amount: -amount,
        reason,
        starting_balance: starting,
        ending_balance: ending,
      });

      return interaction.editReply(`✅ Used **${amount}** coins\n💱 ${starting} → ${ending}`);
    }

    // ---------- TRANSACTIONS ----------
    if (commandName === "transactions") {
      const isAdmin = adminList.includes(userId);

      const query = supabase
        .from("transactions")
        .select("user_id, amount, reason, created_at, starting_balance, ending_balance")
        .eq("guild_id", GUILD_ID)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!isAdmin) query.eq("user_id", userId);

      const { data } = await query;

      if (!data || data.length === 0) {
        return interaction.editReply("📭 No transactions found.");
      }

      const lines = data.map(tx => {
        const who = isAdmin ? ` <@${tx.user_id}>` : "";
        return (
          `${tx.amount > 0 ? "🟢" : "🔴"} **${tx.amount} coins** — ${tx.reason}${who}\n` +
          `💱 ${tx.starting_balance} → ${tx.ending_balance}\n` +
          `🕒 <t:${Math.floor(new Date(tx.created_at).getTime() / 1000)}:R>`
        );
      });

      return interaction.editReply(`📜 **Recent Transactions:**\n\n${lines.join("\n\n")}`);
    }

  } catch (err) {
    console.error("❌ Command error:", err);
    await interaction.editReply("❌ Something went wrong.");
  }
});

// ---------- KEEP ALIVE ----------
app.get("/", (_, res) => res.send("Coin Bank Bot is running ✅"));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// ---------- LOGIN ----------
client.login(DISCORD_TOKEN);
