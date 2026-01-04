// index.js
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
  const username = interaction.user.username;
  const guildId = interaction.guild?.id;

  if (interaction.commandName === 'balance') {
    const { data, error } = await supabase
      .from('coin_balances')
      .select('balance')
      .eq('user_id', userId)
      .eq('guild_id', guildId)
      .single();

    const balance = error || !data ? 0 : data.balance;
    await interaction.reply({ content: `You have **${balance}** coins.`, ephemeral: true });
  }

  if (interaction.commandName === 'addcoins') {
    if (!ADMIN_IDS.includes(userId)) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });

    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const { data: existing } = await supabase
      .from('coin_balances')
      .select('balance')
      .eq('user_id', target.id)
      .eq('guild_id', guildId)
      .single();

    const newBalance = (existing?.balance || 0) + amount;

    await supabase.from('coin_balances').upsert({
      user_id: target.id,
      guild_id: guildId,
      balance: newBalance,
    });

    await supabase.from('transactions').insert({
      user_id: target.id,
      guild_id: guildId,
      amount,
      reason,
      type: 'add',
      added_by: userId,
    });

    await interaction.reply({ content: `✅ Added **${amount}** coins to <@${target.id}>. New balance: **${newBalance}**`, ephemeral: true });
  }

  if (interaction.commandName === 'removecoins') {
    if (!ADMIN_IDS.includes(userId)) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });

    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const { data: existing } = await supabase
      .from('coin_balances')
      .select('balance')
      .eq('user_id', target.id)
      .eq('guild_id', guildId)
      .single();

    const currentBalance = existing?.balance || 0;
    if (currentBalance < amount) {
      return interaction.reply({ content: `❌ <@${target.id}> only has **${currentBalance}** coins. Cannot remove ${amount}.`, ephemeral: true });
    }

    const newBalance = currentBalance - amount;

    await supabase.from('coin_balances').upsert({
      user_id: target.id,
      guild_id: guildId,
      balance: newBalance,
    });

    await supabase.from('transactions').insert({
      user_id: target.id,
      guild_id: guildId,
      amount: -amount,
      reason,
      type: 'remove',
      added_by: userId,
    });

    await interaction.reply({ content: `✅ Removed **${amount}** coins from <@${target.id}>. New balance: **${newBalance}**`, ephemeral: true });
  }

  if (interaction.commandName === 'usecoins') {
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'Used coins';

    const { data: existing } = await supabase
      .from('coin_balances')
      .select('balance')
      .eq('user_id', userId)
      .eq('guild_id', guildId)
      .single();

    const currentBalance = existing?.balance || 0;
    if (currentBalance < amount) {
      return interaction.reply({ content: `❌ You only have **${currentBalance}** coins.`, ephemeral: true });
    }

    const newBalance = currentBalance - amount;

    await supabase.from('coin_balances').upsert({
      user_id: userId,
      guild_id: guildId,
      balance: newBalance,
    });

    await supabase.from('transactions').insert({
      user_id: userId,
      guild_id: guildId,
      amount: -amount,
      reason,
      type: 'use',
      added_by: userId,
    });

    await interaction.reply({ content: `✅ You used **${amount}** coins. New balance: **${newBalance}**`, ephemeral: true });
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
      .setTitle('🧾 Your Recent Transactions')
      .setColor('Gold')
      .setDescription(
        data.map(tx => {
          const emoji = tx.amount < 0 ? '🔴' : '🟢';
          return `${emoji} **${tx.amount}** coins — _${tx.reason || tx.type}_\n🕓 <t:${Math.floor(new Date(tx.created_at).getTime() / 1000)}:R>`;
        }).join('\n\n')
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (interaction.commandName === 'checkcoins') {
    if (!ADMIN_IDS.includes(userId)) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });

    const target = interaction.options.getUser('user');
    const { data } = await supabase
      .from('coin_balances')
      .select('balance')
      .eq('user_id', target.id)
      .eq('guild_id', guildId)
      .single();

    const balance = data?.balance || 0;
    await interaction.reply({ content: `<@${target.id}> has **${balance}** coins.`, ephemeral: true });
  }

  if (interaction.commandName === 'usertransactions') {
    if (!ADMIN_IDS.includes(userId)) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });

    const target = interaction.options.getUser('user');
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', target.id)
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!data || data.length === 0) return interaction.reply({ content: `📍 No transactions found for <@${target.id}>.`, ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle(`📒 Transactions for ${target.username}`)
      .setColor('Aqua')
      .setDescription(
        data.map(tx => {
          const emoji = tx.amount < 0 ? '🔴' : '🟢';
          return `${emoji} **${tx.amount}** coins — _${tx.reason || tx.type}_\n🕓 <t:${Math.floor(new Date(tx.created_at).getTime() / 1000)}:R>`;
        }).join('\n\n')
      );

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

    await interaction.reply({ content: `✅ Removed Buyer role from ${affected.length} users.`, ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);

const app = express();
app.get('/', (_, res) => res.send('✅ Coin Bank Bot is alive'));
app.listen(10000, () => console.log('🌐 Express server on port 10000'));
