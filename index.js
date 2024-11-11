import { Client, GatewayIntentBits } from "discord.js";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const serverCount = parseInt(process.env.SERVER_COUNT, 10);
if (isNaN(serverCount) || serverCount <= 0) {
  console.error("Некорректное значение SERVER_COUNT в .env файле.");
  process.exit(1);
}

const servers = [];
const tokens = [];
const clients = [];

for (let i = 1; i <= serverCount; i++) {
  const serverId = process.env[`SERVER_ID_${i}`];
  const token = process.env[`DISCORD_TOKEN_${i}`];
  if (!serverId || !token) {
    console.error(
      `SERVER_ID_${i} или DISCORD_TOKEN_${i} не найдены в .env файле.`
    );
    process.exit(1);
  }
  servers.push(serverId);
  tokens.push(token);
}

const getServerName = async (serverId) => {
  try {
    const response = await axios.get(
      `https://api.battlemetrics.com/servers/${serverId}`
    );
    return response.data.data.attributes.name;
  } catch (error) {
    console.error(`Ошибка получения названия сервера ${serverId}:`, error);
    return `Сервер ${serverId}`;
  }
};

const initClient = async (token, serverId, maxPlayers = 100) => {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const serverName = await getServerName(serverId);

  client.on("ready", () => {
    console.log(`Вошли как ${client.user.tag} на сервере ${serverName}!`);
    setInterval(() => updateCustomStatus(client, serverId, maxPlayers), 30000);
  });

  client.login(token).catch((error) => {
    console.error(`Ошибка входа для сервера ${serverName}:`, error);
  });

  return client;
};

const updateCustomStatus = async (client, serverId, maxPlayers) => {
  try {
    const response = await axios.get(
      `https://api.battlemetrics.com/servers/${serverId}`
    );

    const serverStatus = response.data.data.attributes.status;
    let customStatusString;
    console.log(serverStatus);

    if (serverStatus === "offline") {
      customStatusString = `offline`;
    } else {
      const players = response.data.data.attributes.players;
      let map = response.data.data.attributes.details.map;

      if (!map) {
        map = response.data.data.attributes.details.reforger.scenarioName;
      }

      const queueTemp = response.data.data.attributes.details.squad_publicQueue;
      const queue = queueTemp ? `+(${queueTemp})` : "";
      customStatusString = `${players}/${maxPlayers}${queue} ${map}`;
    }

    client.user.setPresence({
      activities: [
        {
          name: customStatusString,
          type: 4,
        },
      ],
    });
  } catch (error) {
    console.error(
      `Ошибка обновления пользовательского статуса для сервера ${serverId}:`,
      error
    );
  }
};

for (let i = 0; i < serverCount; i++) {
  console.log(`Инициализация клиента для сервера ${servers[i]}...`);
  initClient(tokens[i], servers[i]).then((client) => clients.push(client));
}
