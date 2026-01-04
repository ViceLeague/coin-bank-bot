// index.js (Professional Rewrite with All Fixes)
import { Client, GatewayIntentBits, Partials, EmbedBuilder } from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import express from 'express';
import 'dotenv/config';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.GuildMember],
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const ADMIN_IDS = process.env.ADMIN_IDS.split(',');
const BUYER_ROLE_ID = process.env.BUYER_ROLE_ID;

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  const getBalance = async (uid) => {
    const { data } = await supabase
      .from('coin_balances')
      .select('balance')
      .eq('user_id', uid)
      .eq('guild_id', guildId)
      .single();
    return data?.balance || 0;
  };

  const updateBalance = async (uid, newBalance) => {
    await supabase.from('coin_balances').upsert({
      user_id: uid,
      guild_id: guildId,
      balance: newBalance,
    });
  };

  const recordTransaction = async (uid, amount, reason, added_by, start, end) => {
    await supabase.from('transactions').insert({
      user_id: uid,
      guild_id: guildId,
      amount,
      reason,
      added_by,
      starting_balance: start,
      ending_balance: end,
    });
  };

  if (interaction.commandName === 'balance') {
    const balance = await getBalance(userId);
    return interaction.reply({ content: `You have **${balance}** coins.`, ephemeral: true });
  }

  if (interaction.commandName === 'addcoins') {
    if (!ADMIN_IDS.includes(userId)) return interaction.reply({ content: '❌ Admin only.', ephemeral: true });
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const start = await getBalance(target.id);
    const end = start + amount;
    await updateBalance(target.id, end);
    await recordTransaction(target.id, amount, reason, userId, start, end);
    return interaction.reply({ content: `✅ Added **${amount}** coins to <@${target.id}>.`, ephemeral: true });
  }

  if (interaction.commandName === 'removecoins') {
    if (!ADMIN_IDS.includes(userId)) return interaction.reply({ content: '❌ Admin only.', ephemeral: true });
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const start = await getBalance(target.id);
    if (start < amount) return interaction.reply({ content: '❌ Not enough coins.', ephemeral: true });
    const end = start - amount;
    await updateBalance(target.id, end);
    await recordTransaction(target.id, -amount, reason, userId, start, end);
    return interaction.reply({ content: `✅ Removed **${amount}** coins from <@${target.id}>.`, ephemeral: true });
  }

  if (interaction.commandName === 'usecoins') {
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'Used coins';
    const start = await getBalance(userId);
    if (start < amount) return interaction.reply({ content: '❌ Not enough coins.', ephemeral: true });
    const end = start - amount;
    await updateBalance(userId, end);
    await recordTransaction(userId, -amount, reason, userId, start, end);
    return interaction.reply({ content: `✅ You used **${amount}** coins.`, ephemeral: true });
  }

  if (interaction.commandName === 'transactions') {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (!data || data.length === 0) return interaction.reply({ content: '📍 No transactions found.', ephemeral: true });
    const embed = new EmbedBuilder()
      .setTitle('📜 Your Recent Transactions')
      .setColor('Gold')
      .setDescription(data.map(tx => `${tx.amount > 0 ? '🟢' : '🔴'} ${tx.amount} coins — _${tx.reason}_\n🕓 <t:${Math.floor(new Date(tx.created_at).getTime() / 1000)}:R>`).join('\n\n'));
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (interaction.commandName === 'checkcoins') {
    if (!ADMIN_IDS.includes(userId)) return interaction.reply({ content: '❌ Admin only.', ephemeral: true });
    const target = interaction.options.getUser('user');
    const balance = await getBalance(target.id);
    return interaction.reply({ content: `<@${target.id}> has **${balance}** coins.`, ephemeral: true });
  }

  if (interaction.commandName === 'usertransactions') {
    if (!ADMIN_IDS.includes(userId)) return interaction.reply({ content: '❌ Admin only.', ephemeral: true });
    const target = interaction.options.getUser('user');
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', target.id)
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (!data || data.length === 0) return interaction.reply({ content: '📍 No transactions for user.', ephemeral: true });
    const embed = new EmbedBuilder()
      .setTitle(`📒 ${target.username}'s Transactions`)
      .setColor('Blue')
      .setDescription(data.map(tx => `${tx.amount > 0 ? '🟢' : '🔴'} ${tx.amount} coins — _${tx.reason}_\n🕓 <t:${Math.floor(new Date(tx.created_at).getTime() / 1000)}:R>`).join('\n\n'));
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (interaction.commandName === 'clearbuyers') {
    if (!ADMIN_IDS.includes(userId)) return interaction.reply({ content: '❌ Admin only.', ephemeral: true });
    const role = interaction.guild.roles.cache.get(BUYER_ROLE_ID);
    if (!role) return interaction.reply({ content: '❌ Buyer role not found.', ephemeral: true });
    const members = await interaction.guild.members.fetch();
    let count = 0;
    for (const member of members.values()) {
      if (member.roles.cache.has(BUYER_ROLE_ID)) {
        await member.roles.remove(BUYER_ROLE_ID);
        count++;
      }
    }
    return interaction.reply({ content: `✅ Removed buyer role from ${count} users.`, ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);

const app = express();
app.get('/', (req, res) => res.send('Bot is alive'));
app.listen(10000, () => console.log('🌐 Web server running'));
