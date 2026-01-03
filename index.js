import "dotenv/config";
import express from "express";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
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

if (!DISCORD_TOKEN || !GUILD_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DISCORD_CLIENT_ID || !ADMIN_IDS || !BUYER_ROLE_ID) {
  console.error("❌ Missing required environment variables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  registerCommands();
});

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder().setName("balance").setDescription("Check your current coin balance"),
    new SlashCommandBuilder()
      .setName("addcoins")
      .setDescription("Add coins to a user (admin only)")
      .addUserOption(opt => opt.setName("user").setDescription("User").setRequired(true))
      .addIntegerOption(opt => opt.setName("amount").setDescription("Amount").setRequired(true))
      .addStringOption(opt => opt.setName("reason").setDescription("Reason").setRequired(false)),
    new SlashCommandBuilder()
      .setName("removecoins")
      .setDescription("Remove coins from a user (admin only)")
      .addUserOption(opt => opt.setName("user").setDescription("User").setRequired(true))
      .addIntegerOption(opt => opt.setName("amount").setDescription("Amount").setRequired(true))
      .addStringOption(opt => opt.setName("reason").setDescription("Reason").setRequired(false)),
    new SlashCommandBuilder()
      .setName("usecoins")
      .setDescription("Spend some of your coins")
      .addIntegerOption(opt => opt.setName("amount").setDescription("Amount").setRequired(true))
      .addStringOption(opt => opt.setName("reason").setDescription("Reason").setRequired(false)),
    new SlashCommandBuilder()
      .setName("transactions")
      .setDescription("View your recent coin activity"),
    new SlashCommandBuilder()
      .setName("checkcoins")
      .setDescription("Check another user's balance (admin only)")
      .addUserOption(opt => opt.setName("user").setDescription("User to check").setRequired(true)),
    new SlashCommandBuilder()
      .setName("usertransactions")
      .setDescription("View another user's transaction history (admin only)")
      .addUserOption(opt => opt.setName("user").setDescription("User").setRequired(true)),
    new SlashCommandBuilder()
      .setName("clearbuyers")
      .setDescription("Remove Buyer role from all users (admin only)"),
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  try {
    await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Slash commands registered.");
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
  }
}

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.commandName;
  const userId = interaction.user.id;
  const adminList = ADMIN_IDS.split(",");

  try {
    await interaction.deferReply({ ephemeral: true });

    if (command === "balance") {
      const { data, error } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", userId)
        .eq("guild_id", GUILD_ID)
        .single();

      const balance = error || !data ? 0 : data.balance;
      return interaction.editReply(`💰 Your balance is **${balance}** coins.`);
    }

    if (["addcoins", "removecoins"].includes(command)) {
      if (!adminList.includes(userId)) {
        return interaction.editReply("❌ You do not have permission to use this command.");
      }

      const user = interaction.options.getUser("user", true);
      const amount = interaction.options.getInteger("amount", true);
      const reason = interaction.options.getString("reason") || `${command} by admin`;

      const { data } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", user.id)
        .eq("guild_id", GUILD_ID)
        .single();

      const current = data?.balance ?? 0;
      const newBalance = command === "addcoins" ? current + amount : Math.max(current - amount, 0);

      await supabase.from("coin_balances").upsert({
        user_id: user.id,
        guild_id: GUILD_ID,
        balance: newBalance,
      });

      await supabase.from("transactions").insert({
        user_id: user.id,
        guild_id: GUILD_ID,
        amount: command === "addcoins" ? amount : -amount,
        reason,
      });

      return interaction.editReply(`✅ ${command === "addcoins" ? "Added" : "Removed"} **${amount}** coins from ${user}. New balance: **${newBalance}**`);
    }

    if (command === "usecoins") {
      const amount = interaction.options.getInteger("amount", true);
      const reason = interaction.options.getString("reason") || "used by user";

      const { data } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", userId)
        .eq("guild_id", GUILD_ID)
        .single();

      const current = data?.balance ?? 0;
      if (current < amount) {
        return interaction.editReply(`❌ Not enough coins. You have **${current}**, need **${amount}**.`);
      }

      const newBalance = current - amount;

      await supabase.from("coin_balances").upsert({
        user_id: userId,
        guild_id: GUILD_ID,
        balance: newBalance,
      });

      await supabase.from("transactions").insert({
        user_id: userId,
        guild_id: GUILD_ID,
        amount: -amount,
        reason,
      });

      return interaction.editReply(`✅ You used **${amount}** coins. Remaining: **${newBalance}**`);
    }

    if (command === "transactions") {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("guild_id", GUILD_ID)
        .order("timestamp", { ascending: false })
        .limit(5);

      if (!data || data.length === 0) {
        return interaction.editReply("📭 No transactions found.");
      }

      const lines = data.map(tx => {
        const sign = tx.amount > 0 ? "🟢" : "🔴";
        const ago = `<t:${Math.floor(new Date(tx.timestamp).getTime() / 1000)}:R>`;
        return `${sign} **${tx.amount}** coins — *${tx.reason}*\n🕒 ${ago}`;
      });

      return interaction.editReply({
        content: `📜 **Your Recent Transactions:**\n${lines.join("\n\n")}`,
      });
    }

    if (command === "checkcoins") {
      if (!adminList.includes(userId)) return interaction.editReply("❌ Admin only command.");
      const target = interaction.options.getUser("user", true);
      const { data } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", target.id)
        .eq("guild_id", GUILD_ID)
        .single();

      const balance = data?.balance ?? 0;
      return interaction.editReply(`👤 ${target.username} has **${balance}** coins.`);
    }

    if (command === "usertransactions") {
      if (!adminList.includes(userId)) return interaction.editReply("❌ Admin only command.");
      const target = interaction.options.getUser("user", true);
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", target.id)
        .eq("guild_id", GUILD_ID)
        .order("timestamp", { ascending: false })
        .limit(5);

      if (!data || data.length === 0) {
        return interaction.editReply(`📭 No transactions found for ${target.username}.`);
      }

      const lines = data.map(tx => {
        const sign = tx.amount > 0 ? "🟢" : "🔴";
        const ago = `<t:${Math.floor(new Date(tx.timestamp).getTime() / 1000)}:R>`;
        return `${sign} **${tx.amount}** coins — *${tx.reason}*\n🕒 ${ago}`;
      });

      return interaction.editReply({
        content: `📜 **Recent Transactions for ${target.username}:**\n${lines.join("\n\n")}`,
      });
    }

    if (command === "clearbuyers") {
      if (!adminList.includes(userId)) return interaction.editReply("❌ Admin only command.");

      const guild = await client.guilds.fetch(GUILD_ID);
      const members = await guild.members.fetch();

      let cleared = 0;
      for (const [, member] of members) {
        if (member.roles.cache.has(BUYER_ROLE_ID)) {
          await member.roles.remove(BUYER_ROLE_ID).catch(() => null);
          cleared++;
        }
      }

      return interaction.editReply(`✅ Removed Buyer role from ${cleared} member(s).`);
    }

    return interaction.editReply("❌ Unknown command.");
  } catch (err) {
    console.error("⚠️ Command Error:", err);
    if (interaction.isRepliable()) {
      try {
        await interaction.editReply("❌ Something went wrong. Try again later.");
      } catch {}
    }
  }
});

// Keep Alive
app.get("/", (req, res) => res.send("Coin Bank Bot is running ✅"));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// Login
client.login(DISCORD_TOKEN);
