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
  const guildId = interaction.guild.id;

  // Helper: get current balance
  async function getBalance(userId) {
    const { data, error } = await supabase
      .from('coin_balances')
      .select('balance')
      .eq('user_id', userId)
      .eq('guild_id', guildId)
      .single();
    return error || !data ? 0 : data.balance;
  }

  // /balance
  if (interaction.commandName === 'balance') {
    const balance = await getBalance(userId);
    await interaction.reply({ content: `You have **${balance}** coins.`, ephemeral: true });
  }

  // /addcoins
  if (interaction.commandName === 'addcoins') {
    if (!ADMIN_IDS.includes(userId)) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });

    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const prevBalance = await getBalance(target.id);
    const newBalance = prevBalance + amount;

    await supabase.from('coin_balances').upsert({
      guild_id: guildId,
      user_id: target.id,
      balance: newBalance,
    });

    await supabase.from('transactions').insert({
      guild_id: guildId,
      user_id: target.id,
      amount,
      reason,
      starting_balance: prevBalance,
      ending_balance: newBalance,
      added_by: userId,
    });

    await interaction.reply({ content: `✅ Added **${amount}** coins to <@${target.id}>. New balance: **${newBalance}**`, ephemeral: true });
  }

  // /removecoins
  if (interaction.commandName === 'removecoins') {
    if (!ADMIN_IDS.includes(userId)) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });

    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const prevBalance = await getBalance(target.id);

    if (prevBalance < amount) {
      return interaction.reply({ content: `❌ <@${target.id}> only has **${prevBalance}** coins. Cannot remove ${amount}.`, ephemeral: true });
    }

    const newBalance = prevBalance - amount;

    await supabase.from('coin_balances').upsert({
      guild_id: guildId,
      user_id: target.id,
      balance: newBalance,
    });

    await supabase.from('transactions').insert({
      guild_id: guildId,
      user_id: target.id,
      amount: -amount,
      reason,
      starting_balance: prevBalance,
      ending_balance: newBalance,
      added_by: userId,
    });

    await interaction.reply({ content: `✅ Removed **${amount}** coins from <@${target.id}>. New balance: **${newBalance}**`, ephemeral: true });
  }

  // /transactions
  if (interaction.commandName === 'transactions') {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!data || data.length === 0) {
      return interaction.reply({ content: '📍 No transactions found.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('🧾 Your Recent Transactions')
      .setColor('Gold')
      .setDescription(
        data.map(tx => {
          const emoji = tx.amount < 0 ? '🔴' : '🟢';
          return `${emoji} **${tx.amount}** coins — _${tx.reason}_ by <@${tx.added_by}>\n💰 ${tx.starting_balance} ➜ ${tx.ending_balance}\n🕓 <t:${Math.floor(new Date(tx.created_at).getTime() / 1000)}:R>`;
        }).join('\n\n')
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // /usertransactions
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

    if (!data || data.length === 0) {
      return interaction.reply({ content: `📍 No transactions found for <@${target.id}>.`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`📒 Transactions for ${target.username}`)
      .setColor('Aqua')
      .setDescription(
        data.map(tx => {
          const emoji = tx.amount < 0 ? '🔴' : '🟢';
          return `${emoji} **${tx.amount}** coins — _${tx.reason}_ by <@${tx.added_by}>\n💰 ${tx.starting_balance} ➜ ${tx.ending_balance}\n🕓 <t:${Math.floor(new Date(tx.created_at).getTime() / 1000)}:R>`;
        }).join('\n\n')
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // /checkcoins
  if (interaction.commandName === 'checkcoins') {
    if (!ADMIN_IDS.includes(userId)) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });

    const target = interaction.options.getUser('user');
    const balance = await getBalance(target.id);
    await interaction.reply({ content: `<@${target.id}> has **${balance}** coins.`, ephemeral: true });
  }

  // /clearbuyers
  if (interaction.commandName === 'clearbuyers') {
    if (!ADMIN_IDS.includes(userId)) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });

    const role = interaction.guild.roles.cache.get(BUYER_ROLE_ID);
    if (!role) return interaction.reply({ content: '❌ Buyer role not found.', ephemeral: true });

    const members = await interaction.guild.members.fetch();
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
app.get('/', (req, res) => res.send('Coin Bank is running.'));
app.listen(10000, () => console.log('🌐 Web server started on port 10000'));

