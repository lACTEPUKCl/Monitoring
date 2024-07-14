import { Client, GatewayIntentBits } from "discord.js";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const serverIds = [
  process.env.SERVERID1,
  process.env.SERVERID2,
  process.env.SERVERID3,
  process.env.SERVERID4,
  process.env.SERVERID5,
  process.env.SERVERID6,
  process.env.SERVERID7,
  process.env.SERVERID8,
];
const tokens = [
  process.env.DISCORD_TOKEN1,
  process.env.DISCORD_TOKEN2,
  process.env.DISCORD_TOKEN3,
  process.env.DISCORD_TOKEN4,
  process.env.DISCORD_TOKEN5,
  process.env.DISCORD_TOKEN6,
  process.env.DISCORD_TOKEN7,
  process.env.DISCORD_TOKEN8,
];
const clients = [];

for (let i = 0; i < serverIds.length; i++) {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });
  clients.push(client);

  const token = tokens[i];
  const serverId = serverIds[i];

  client.on("ready", () => {
    console.log(`Вошли как ${client.user.tag} на сервере ${serverId}!`);
    const maxPlayers = "100";
    setInterval(() => updateActivity(client, serverId, maxPlayers), 30000);
  });

  client.login(token);
}

async function updateActivity(client, serverId, maxPlayers) {
  try {
    const response = await axios.get(
      `https://api.battlemetrics.com/servers/${serverId}`
    );
    const players = response.data.data.attributes.players;
    const map = response.data.data.attributes.details.map;
    const queueTemp = response.data.data.attributes.details.squad_publicQueue;
    const queue = queueTemp ? `+(${queueTemp})` : "";
    const activityString = `${players}/${maxPlayers}${queue} ${map}`;
    client.user.setPresence({ activities: [{ name: activityString }] });
  } catch (e) {}
}
