import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import { HttpsProxyAgent } from "https-proxy-agent";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import { loadServerConfigs } from "./src/config.js";
import { createRconMonitor } from "./src/rconMonitor.js";
import { createBattleMetricsMonitor } from "./src/battleMetricsMonitor.js";
import { formatPresence } from "./src/status.js";

dotenv.config();

const intervalMs = Number(process.env.STATUS_UPDATE_INTERVAL) > 0
  ? Number(process.env.STATUS_UPDATE_INTERVAL)
  : 30_000;
const configs = loadServerConfigs(process.env);
let wsProxyAgent = null;
if (process.env.DISCORD_PROXY_URL) {
  console.log("[monitoring] Discord proxy включён");
  setGlobalDispatcher(new ProxyAgent(process.env.DISCORD_PROXY_URL));
  wsProxyAgent = new HttpsProxyAgent(process.env.DISCORD_PROXY_URL);
}

const workers = configs.map((config, index) => {
  const monitor = config.mode === "battlemetrics"
    ? createBattleMetricsMonitor({ ...config, logger: console })
    : createRconMonitor({ ...config, id: index + 1, logger: console });
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    ...(wsProxyAgent ? { ws: { agent: wsProxyAgent } } : {}),
  });
  let timer = null;

  async function update() {
    const info = await monitor.getInfo();
    const presence = formatPresence(info);
    client.user?.setPresence({ activities: [{ name: presence.text, type: 4 }], status: presence.status });
    console.log(`[monitoring] ${config.key}: ${presence.text}`);
  }

  client.once("ready", () => {
    console.log(`[monitoring] ${config.key}: Discord ${client.user.tag}`);
    void update();
    timer = setInterval(update, intervalMs);
  });
  client.on("error", (error) => console.error(`[monitoring] ${config.key}: Discord error`, error));
  monitor.start();
  void client.login(config.discordToken);

  return {
    stop: async () => {
      if (timer) clearInterval(timer);
      client.destroy();
      await monitor.stop();
    },
  };
});

async function shutdown() {
  await Promise.allSettled(workers.map((worker) => worker.stop()));
  process.exit(0);
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
process.on("unhandledRejection", (error) => console.error("[monitoring] unhandled rejection", error));
process.on("uncaughtException", (error) => console.error("[monitoring] uncaught exception", error));
