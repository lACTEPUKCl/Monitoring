import { Client, GatewayIntentBits } from "discord.js";
import axios from "axios";
import dotenv from "dotenv";
import { HttpsProxyAgent } from "https-proxy-agent";
import { ProxyAgent, setGlobalDispatcher } from "undici";

dotenv.config();

const STATUS_UPDATE_INTERVAL = parseInt(
  process.env.STATUS_UPDATE_INTERVAL ?? "60000",
  10
);

if (isNaN(STATUS_UPDATE_INTERVAL) || STATUS_UPDATE_INTERVAL <= 0) {
  console.warn(
    "[WARN] Некорректное значение STATUS_UPDATE_INTERVAL, используем 60000 мс"
  );
}

process.on("uncaughtException", (err) => {
  console.error("[GLOBAL] Uncaught exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[GLOBAL] Unhandled rejection:", reason);
});

const proxyUrl = process.env.DISCORD_PROXY_URL;
let wsProxyAgent = null;

if (proxyUrl) {
  console.log("[BOT] Using Discord proxy:", proxyUrl);

  const restProxy = new ProxyAgent(proxyUrl);
  setGlobalDispatcher(restProxy);

  wsProxyAgent = new HttpsProxyAgent(proxyUrl);
}
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
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    ...(wsProxyAgent ? { ws: { agent: wsProxyAgent } } : {}),
  });

  const serverName = await getServerName(serverId);

  client.on("ready", () => {
    console.log(`Вошли как ${client.user.tag} на сервере ${serverName}!`);

    const interval =
      !isNaN(STATUS_UPDATE_INTERVAL) && STATUS_UPDATE_INTERVAL > 0
        ? STATUS_UPDATE_INTERVAL
        : 30000;

    setInterval(
      () => updateCustomStatus(client, serverId, maxPlayers),
      interval
    );
  });

  client.on("error", (err) => {
    console.error(
      `[CLIENT ERROR] ${serverName} (${serverId}):`,
      err && err.message ? err.message : err
    );
  });

  client.on("shardError", (err) => {
    console.error(
      `[SHARD ERROR] ${serverName} (${serverId}):`,
      err && err.message ? err.message : err
    );
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

    const attrs = response.data.data.attributes;
    const status = attrs.status;

    if (status === "dead") {
      const offlineText = "offline";

      client.user.setPresence({
        activities: [
          {
            name: offlineText,
            type: 4,
          },
        ],
      });

      console.log(
        `Сервер ${serverId} имеет статус 'dead' → выставляем Discord-статус: ${offlineText}`
      );
      return;
    }

    const players = attrs.players;
    let map = attrs.details.map;

    if (!map) {
      map = attrs.details?.reforger?.scenarioName;
    }

    const queueTemp = attrs.details.squad_publicQueue;
    const queue = queueTemp ? `+(${queueTemp})` : "";
    const customStatusString = `${players}/${maxPlayers}${queue} ${map}`;

    client.user.setPresence({
      activities: [
        {
          name: customStatusString,
          type: 4,
        },
      ],
    });

    console.log(
      `Пользовательский статус обновлен для сервера ${serverId}: ${customStatusString}`
    );
  } catch (error) {
    console.error(
      `Ошибка обновления пользовательского статуса для сервера ${serverId}:`,
      error
    );
  }
};

const START_DELAY_MS = 5000;

for (let i = 0; i < serverCount; i++) {
  const serverId = servers[i];
  const token = tokens[i];

  setTimeout(() => {
    console.log(`Инициализация клиента для сервера ${serverId}...`);
    initClient(token, serverId).then((client) => clients.push(client));
  }, i * START_DELAY_MS);
}
