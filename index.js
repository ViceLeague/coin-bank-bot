// index.js — Full Working Bot
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

  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const username = interaction.user.username;

  const getBalance = async (uid) => {
    const { data, error } = await supabase
      .from('coin_balances')
      .select('balance')
      .eq('guild_id', guildId)
      .eq('user_id', uid)
      .single();
    return error || !data ? 0 : data.balance;
  };

  const updateBalance = async (uid, newBalance) => {
    return await supabase.from('coin_balances').upsert({
      guild_id: guildId,
      user_id: uid,
      balance: newBalance,
    });
  };

  const recordTransaction = async (uid, amount, reason, added_by, start, end) => {
    return await supabase.from('transactions').insert({
      guild_id: guildId,
      user_id: uid,
      amount,
      reason,
      added_by,
      starting_balance: start,
      ending_balance: end,
    });
  };

  if (interaction.commandName === 'balance') {
    const balance = await getBalance(userId);
    await interaction.reply({ content: `💰 You have **${balance}** coins.`, ephemeral: true });
  }

  if (interaction.commandName === 'addcoins') {
    if (!ADMIN_IDS.includes(userId)) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const start = await getBalance(target.id);
    const end = start + amount;
    await updateBalance(target.id, end);
    await recordTransaction(target.id, amount, reason, userId, start, end);
    await interaction.reply({ content: `✅ Added **${amount}** coins to <@${target.id}>. New balance: **${end}**`, ephemeral: true });
  }

  if (interaction.commandName === 'removecoins') {
    if (!ADMIN_IDS.includes(userId)) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const start = await getBalance(target.id);
    if (start < amount) return interaction.reply({ content: `❌ <@${target.id}> does not have enough coins.`, ephemeral: true });

    const end = start - amount;
    await updateBalance(target.id, end);
    await recordTransaction(target.id, -amount, reason, userId, start, end);
    await interaction.reply({ content: `✅ Removed **${amount}** coins from <@${target.id}>. New balance: **${end}**`, ephemeral: true });
  }

  if (interaction.commandName === 'usecoins') {
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'Usage';

    const start = await getBalance(userId);
    if (start < amount) return interaction.reply({ content: '❌ You do not have enough coins.', ephemeral: true });

    const end = start - amount;
    await updateBalance(userId, end);
    await recordTransaction(userId, -amount, reason, userId, start, end);
    await interaction.reply({ content: `✅ You used **${amount}** coins. Remaining: **${end}**`, ephemeral: true });
  }

  if (interaction.commandName === 'transactions') {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!data || data.length === 0) return interaction.reply({ content: '📍 No transactions found.', ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle('🧾 Your Recent Transactions:')
      .setColor('Gold')
      .setDescription(data.map(tx => `${tx.amount > 0 ? '🟢' : '🔴'} **${tx.amount}** coins — _${tx.reason}_\nBalance: ${tx.starting_balance} ➝ ${tx.ending_balance}\n<t:${Math.floor(new Date(tx.created_at).getTime() / 1000)}:R>`).join('\n\n'));

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (interaction.commandName === 'checkcoins') {
    if (!ADMIN_IDS.includes(userId)) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
    const target = interaction.options.getUser('user');
    const balance = await getBalance(target.id);
    await interaction.reply({ content: `<@${target.id}> has **${balance}** coins.`, ephemeral: true });
  }

  if (interaction.commandName === 'usertransactions') {
    if (!ADMIN_IDS.includes(userId)) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
    const target = interaction.options.getUser('user');

    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', target.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!data || data.length === 0) return interaction.reply({ content: `📍 No transactions found for <@${target.id}>.`, ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle(`📒 Recent Transactions for ${target.username}`)
      .setColor('Aqua')
      .setDescription(data.map(tx => `${tx.amount > 0 ? '🟢' : '🔴'} **${tx.amount}** coins — _${tx.reason}_\nBalance: ${tx.starting_balance} ➝ ${tx.ending_balance}\n<t:${Math.floor(new Date(tx.created_at).getTime() / 1000)}:R>`).join('\n\n'));

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (interaction.commandName === 'clearbuyers') {
    if (!ADMIN_IDS.includes(userId)) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
    const guild = interaction.guild;
    const role = guild.roles.cache.get(BUYER_ROLE_ID);
    if (!role) return interaction.reply({ content: '❌ Buyer role not found.', ephemeral: true });

    const members = await guild.members.fetch();
    const affected = [];
    for (const member of members.values()) {
      if (member.roles.cache.has(BUYER_ROLE_ID)) {
        await member.roles.remove(BUYER_ROLE_ID);
        affected.push(member.user.username);
      }
    }

    await interaction.reply({ content: `✅ Cleared Buyer role from ${affected.length} users.`, ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);

const app = express();
app.get('/', (req, res) => res.send('Coin Bank Bot is Live'));
app.listen(10000, () => console.log('🌐 Express server listening on port 10000'));
