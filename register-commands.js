require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder().setName("balance").setDescription("Show your coin balance"),
  new SlashCommandBuilder()
    .setName("addcoins")
    .setDescription("Admin: add coins to a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setRequired(true)),
  new SlashCommandBuilder()
    .setName("usecoins")
    .setDescription("Use coins (tournament entry)")
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setRequired(true)),
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Registering slash commands...");
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("✅ Slash commands registered.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
