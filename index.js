import "dotenv/config";
import express from "express";
import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 10000;

const {
  DISCORD_TOKEN,
  GUILD_ID,
  SUPABASE_URL,
  SUPABASE_KEY,
  ADMIN_IDS,
  BUYER_ROLE_ID,
} = process.env;

const ADMIN_LIST = ADMIN_IDS.split(",");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.commandName;
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;

  try {
    await interaction.deferReply({ ephemeral: true });

    /* ===================== BALANCE ===================== */
    if (command === "balance") {
      const { data } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("guild_id", guildId)
        .eq("user_id", userId)
        .single();

      return interaction.editReply(
        `💰 Your balance is **${data?.balance ?? 0}** coins`
      );
    }

    /* ===================== ADD / REMOVE COINS ===================== */
    if (["addcoins", "removecoins"].includes(command)) {
      if (!ADMIN_LIST.includes(userId))
        return interaction.editReply("❌ Admin only command.");

      const target = interaction.options.getUser("user", true);
      const amount = interaction.options.getInteger("amount", true);
      const reason =
        interaction.options.getString("reason") || `${command} by admin`;

      const { data } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("guild_id", guildId)
        .eq("user_id", target.id)
        .single();

      const starting = data?.balance ?? 0;
      const ending =
        command === "addcoins"
          ? starting + amount
          : Math.max(starting - amount, 0);

      await supabase.from("coin_balances").upsert({
        guild_id: guildId,
        user_id: target.id,
        balance: ending,
      });

      await supabase.from("transactions").insert({
        guild_id: guildId,
        user_id: target.id,
        amount: command === "addcoins" ? amount : -amount,
        reason,
        starting_balance: starting,
        ending_balance: ending,
      });

      return interaction.editReply(
        `✅ ${command === "addcoins" ? "Added" : "Removed"} **${amount}** coins for <@${target.id}>\n` +
        `📊 **${starting} → ${ending}**`
      );
    }

    /* ===================== USE COINS ===================== */
    if (command === "usecoins") {
      const amount = interaction.options.getInteger("amount", true);
      const reason =
        interaction.options.getString("reason") || "Used coins";

      const { data } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("guild_id", guildId)
        .eq("user_id", userId)
        .single();

      const starting = data?.balance ?? 0;
      if (starting < amount)
        return interaction.editReply("❌ Not enough coins.");

      const ending = starting - amount;

      await supabase.from("coin_balances").upsert({
        guild_id: guildId,
        user_id: userId,
        balance: ending,
      });

      await supabase.from("transactions").insert({
        guild_id: guildId,
        user_id: userId,
        amount: -amount,
        reason,
        starting_balance: starting,
        ending_balance: ending,
      });

      return interaction.editReply(
        `✅ Used **${amount}** coins\n📊 **${starting} → ${ending}**`
      );
    }

    /* ===================== TRANSACTIONS (SELF) ===================== */
    if (command === "transactions") {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("guild_id", guildId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!data || data.length === 0)
        return interaction.editReply("📭 No transactions found.");

      const embed = new EmbedBuilder()
        .setTitle("📜 Your Transactions")
        .setColor(0x00ff99)
        .setDescription(
          data
            .map(
              (t) =>
                `${t.amount > 0 ? "🟢" : "🔴"} **${t.amount}** coins\n` +
                `📊 ${t.starting_balance} → ${t.ending_balance}\n` +
                `📝 ${t.reason}\n` +
                `🕒 <t:${Math.floor(
                  new Date(t.created_at).getTime() / 1000
                )}:R>`
            )
            .join("\n\n")
        );

      return interaction.editReply({ embeds: [embed] });
    }

    /* ===================== CHECK COINS (ADMIN) ===================== */
    if (command === "checkcoins") {
      if (!ADMIN_LIST.includes(userId))
        return interaction.editReply("❌ Admin only.");

      const target = interaction.options.getUser("user", true);

      const { data } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("guild_id", guildId)
        .eq("user_id", target.id)
        .single();

      return interaction.editReply(
        `👤 <@${target.id}> has **${data?.balance ?? 0}** coins`
      );
    }

    /* ===================== USER TRANSACTIONS (ADMIN) ===================== */
    if (command === "usertransactions") {
      if (!ADMIN_LIST.includes(userId))
        return interaction.editReply("❌ Admin only.");

      const target = interaction.options.getUser("user", true);

      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("guild_id", guildId)
        .eq("user_id", target.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!data || data.length === 0)
        return interaction.editReply("📭 No transactions found.");

      const embed = new EmbedBuilder()
        .setTitle(`📜 Transactions for ${target.username}`)
        .setColor(0xffcc00)
        .setDescription(
          data
            .map(
              (t) =>
                `${t.amount > 0 ? "🟢" : "🔴"} **${t.amount}** coins\n` +
                `📊 ${t.starting_balance} → ${t.ending_balance}\n` +
                `📝 ${t.reason}\n` +
                `🕒 <t:${Math.floor(
                  new Date(t.created_at).getTime() / 1000
                )}:R>`
            )
            .join("\n\n")
        );

      return interaction.editReply({ embeds: [embed] });
    }

  } catch (err) {
    console.error(err);
    return interaction.editReply("❌ Error processing command.");
  }
});

/* KEEP ALIVE */
app.get("/", (_, res) => res.send("Coin Bank Bot is running"));
app.listen(PORT, () => console.log(`🌐 Server on ${PORT}`));

client.login(DISCORD_TOKEN);
