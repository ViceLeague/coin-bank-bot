import "dotenv/config";
import express from "express";
import { Client, GatewayIntentBits } from "discord.js";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 10000;

const {
  DISCORD_TOKEN,
  GUILD_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_IDS,
  BUYER_ROLE_ID,
} = process.env;

if (!DISCORD_TOKEN || !GUILD_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_IDS || !BUYER_ROLE_ID) {
  console.error("❌ Missing env vars");
  process.exit(1);
}

const adminList = ADMIN_IDS.split(",");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.commandName;
  const userId = interaction.user.id;

  await interaction.deferReply({ ephemeral: true });

  try {
    /* ================== CLEAR BUYERS ================== */
    if (command === "clearbuyers") {
      if (!adminList.includes(userId)) {
        return interaction.editReply("❌ Admin only command.");
      }

      const guild = await client.guilds.fetch(GUILD_ID);
      const members = await guild.members.fetch();

      let removed = 0;

      for (const member of members.values()) {
        if (member.roles.cache.has(BUYER_ROLE_ID)) {
          await member.roles.remove(BUYER_ROLE_ID);
          removed++;
        }
      }

      return interaction.editReply(
        `🧹 Buyer role removed from **${removed}** users. Tournament closed.`
      );
    }

    /* ================== OTHER COMMANDS ================== */
    if (command === "balance") {
      const { data } = await supabase
        .from("coin_balances")
        .select("balance")
        .eq("user_id", userId)
        .eq("guild_id", GUILD_ID)
        .single();

      return interaction.editReply(
        `💰 You have **${data?.balance ?? 0}** coins.`
      );
    }

    return interaction.editReply("⚠️ Command handled.");
  } catch (err) {
    console.error(err);
    return interaction.editReply("❌ Something went wrong.");
  }
});

/* Keep Render Alive */
app.get("/", (_, res) => res.send("Coin Bank Bot Running"));
app.listen(PORT, () => console.log(`🌐 Web server on ${PORT}`));

client.login(DISCORD_TOKEN);

