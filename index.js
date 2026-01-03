// ============================
// 📁 index.js (Full Rewrite)
// ============================
import "dotenv/config";
import express from "express";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 10000;

const {
  DISCORD_TOKEN,
  GUILD_ID,
  DISCORD_CLIENT_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_IDS,
  BUYER_ROLE_ID,
} = process.env;

if (!DISCORD_TOKEN || !GUILD_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DISCORD_CLIENT_ID || !ADMIN_IDS) {
  console.error("❌ Missing environment variables.");
  process.exit(1);
} else {
  console.log("✅ ENV variables loaded");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const adminList = ADMIN_IDS.split(",");

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, user, guild, options } = interaction;
  const userId = user.id;
  const guildId = guild.id;

  try {
    await interaction.deferReply({ ephemeral: true });

    // /balance
    if (commandName === "balance") {
      const { data, error } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", userId)
        .eq("guild_id", guildId)
        .single();

      const balance = error || !data ? 0 : data.balance;
      return interaction.editReply(`💰 Your balance is **${balance}** coins.`);
    }

    // /addcoins & /removecoins (admin only)
    if (["addcoins", "removecoins"].includes(commandName)) {
      if (!adminList.includes(userId)) return interaction.editReply("❌ You do not have permission to use this command.");

      const target = options.getUser("user", true);
      const amount = options.getInteger("amount", true);
      const reason = options.getString("reason") || `${commandName} by admin`;

      const { data } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", target.id)
        .eq("guild_id", guildId)
        .single();

      const current = data?.balance ?? 0;
      const newBalance = commandName === "addcoins" ? current + amount : Math.max(current - amount, 0);

      await supabase.from("coin_balances").upsert({ user_id: target.id, guild_id: guildId, balance: newBalance });
      await supabase.from("transactions").insert({ user_id: target.id, guild_id: guildId, amount: commandName === "addcoins" ? amount : -amount, reason });

      return interaction.editReply(`✅ ${commandName === "addcoins" ? "Added" : "Removed"} **${amount}** coins for <@${target.id}>. New balance: **${newBalance}**`);
    }

    // /usecoins
    if (commandName === "usecoins") {
      const amount = options.getInteger("amount", true);
      const reason = options.getString("reason") || "used by user";

      const { data } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", userId)
        .eq("guild_id", guildId)
        .single();

      const current = data?.balance ?? 0;
      if (current < amount) return interaction.editReply(`❌ Not enough coins. You have **${current}**, need **${amount}**.`);

      const newBalance = current - amount;

      await supabase.from("coin_balances").upsert({ user_id: userId, guild_id: guildId, balance: newBalance });
      await supabase.from("transactions").insert({ user_id: userId, guild_id: guildId, amount: -amount, reason });

      return interaction.editReply(`✅ You used **${amount}** coins. Remaining: **${newBalance}**`);
    }

    // /transactions
    if (commandName === "transactions") {
      const { data, error } = await supabase
        .from("transactions")
        .select("amount, reason, inserted_at")
        .eq("user_id", userId)
        .eq("guild_id", guildId)
        .order("inserted_at", { ascending: false })
        .limit(5);

      if (error || !data || data.length === 0) return interaction.editReply("📭 No transactions found.");

      const lines = data.map(tx => {
        const emoji = tx.amount >= 0 ? "🟢" : "🔴";
        const timestamp = `<t:${Math.floor(new Date(tx.inserted_at).getTime() / 1000)}:R>`;
        return `${emoji} **${tx.amount}** coins — *${tx.reason}*\n🕒 ${timestamp}`;
      });

      const embed = new EmbedBuilder()
        .setTitle("📑 Your Recent Transactions:")
        .setDescription(lines.join("\n\n"))
        .setColor(0x00AE86);

      return interaction.editReply({ embeds: [embed] });
    }

    // /checkcoins (admin)
    if (commandName === "checkcoins") {
      if (!adminList.includes(userId)) return interaction.editReply("❌ Admins only.");

      const target = options.getUser("user", true);
      const { data } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", target.id)
        .eq("guild_id", guildId)
        .single();

      const balance = data?.balance ?? 0;
      return interaction.editReply(`🔍 <@${target.id}> has **${balance}** coins.`);
    }

    // /usertransactions (admin)
    if (commandName === "usertransactions") {
      if (!adminList.includes(userId)) return interaction.editReply("❌ Admins only.");

      const target = options.getUser("user", true);
      const { data } = await supabase
        .from("transactions")
        .select("amount, reason, inserted_at")
        .eq("user_id", target.id)
        .eq("guild_id", guildId)
        .order("inserted_at", { ascending: false })
        .limit(5);

      if (!data || data.length === 0) return interaction.editReply(`📭 No transactions found for <@${target.id}>.`);

      const lines = data.map(tx => {
        const emoji = tx.amount >= 0 ? "🟢" : "🔴";
        const timestamp = `<t:${Math.floor(new Date(tx.inserted_at).getTime() / 1000)}:R>`;
        return `${emoji} **${tx.amount}** coins — *${tx.reason}*\n🕒 ${timestamp}`;
      });

      const embed = new EmbedBuilder()
        .setTitle(`📑 Transactions for <@${target.id}>:`)
        .setDescription(lines.join("\n\n"))
        .setColor(0xFFD700);

      return interaction.editReply({ embeds: [embed] });
    }

    return interaction.editReply("❌ Unknown command.");
  } catch (err) {
    console.error("⚠️ Command Error:", err);
    try {
      await interaction.editReply("❌ Something went wrong. Try again later.");
    } catch {}
  }
});

app.get("/", (_, res) => res.send("Bot is running ✅"));
app.listen(PORT, () => console.log(`🌐 Server listening on port ${PORT}`));
client.login(DISCORD_TOKEN);
