// index.js (full code with all commands including updated /checkcoins, /usertransactions, and /clearbuyers)
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

  if (interaction.commandName === 'balance') {
    const { data, error } = await supabase
      .from('coin_balances')
      .select('balance')
      .eq('user_id', userId)
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
      .single();

    const newBalance = (existing?.balance || 0) + amount;

    await supabase.from('coin_balances').upsert({
      user_id: target.id,
      balance: newBalance,
    });

    await supabase.from('transactions').insert({
      user_id: target.id,
      amount,
      type: 'add',
      reason,
      added_by: userId,
    });

    await interaction.reply({ content: `✅ Added **${amount}** coins for <@${target.id}>. New balance: **${newBalance}**`, ephemeral: true });
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
      .single();

    const newBalance = Math.max((existing?.balance || 0) - amount, 0);

    await supabase.from('coin_balances').upsert({
      user_id: target.id,
      balance: newBalance,
    });

    await supabase.from('transactions').insert({
      user_id: target.id,
      amount: -amount,
      type: 'remove',
      reason,
      added_by: userId,
    });

    await interaction.reply({ content: `✅ Removed **${amount}** coins from <@${target.id}>. New balance: **${newBalance}**`, ephemeral: true });
  }

  if (interaction.commandName === 'transactions') {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(5);

    if (!data || data.length === 0) return interaction.reply({ content: '📍 No transactions found.', ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle('🧾 Your Recent Transactions:')
      .setColor('Gold')
      .setDescription(
        data.map(tx => {
          const emoji = tx.amount < 0 ? '🔴' : '🟢';
          return `${emoji} **${tx.amount}** coins — _${tx.reason || tx.type}_ by <@${tx.added_by}>\n🕓 <t:${Math.floor(new Date(tx.timestamp).getTime() / 1000)}:R>`;
        }).join('\n\n')
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (interaction.commandName === 'checkcoins') {
    if (!ADMIN_IDS.includes(userId)) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });

    const target = interaction.options.getUser('user');
    const { data, error } = await supabase
      .from('coin_balances')
      .select('balance')
      .eq('user_id', target.id)
      .single();

    const balance = error || !data ? 0 : data.balance;
    await interaction.reply({ content: `<@${target.id}> has **${balance}** coins.`, ephemeral: true });
  }

  if (interaction.commandName === 'usertransactions') {
    if (!ADMIN_IDS.includes(userId)) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });

    const target = interaction.options.getUser('user');
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', target.id)
      .order('timestamp', { ascending: false })
      .limit(5);

    if (!data || data.length === 0) return interaction.reply({ content: `📍 No transactions found for <@${target.id}>.`, ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle(`📒 Recent Transactions for ${target.username}`)
      .setColor('Aqua')
      .setDescription(
        data.map(tx => {
          const emoji = tx.amount < 0 ? '🔴' : '🟢';
          return `${emoji} **${tx.amount}** coins — _${tx.reason || tx.type}_ by <@${tx.added_by}>\n🕓 <t:${Math.floor(new Date(tx.timestamp).getTime() / 1000)}:R>`;
        }).join('\n\n')
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (interaction.commandName === 'clearbuyers') {
    if (!ADMIN_IDS.includes(userId)) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
    const guild = interaction.guild;
    const role = guild.roles.cache.get(BUYER_ROLE_ID);
    if (!role) return interaction.reply({ content: '❌ Buyer role not found.', ephemeral: true });

    const membersWithRole = await guild.members.fetch();
    const affected = [];

    for (const member of membersWithRole.values()) {
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
app.get('/', (req, res) => res.send('Coin Bank is alive!'));
app.listen(10000, () => console.log('🌐 Web server on 10000'));
