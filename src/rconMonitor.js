import { Rcon } from "squad-rcon";

export function createRconMonitor({ id, key, host, port, password, logger = console, RconClass = Rcon }) {
  const rcon = new RconClass({
    id,
    host,
    port,
    password,
    autoReconnect: true,
    autoReconnectDelay: 5000,
    logEnabled: false,
  });
  let connected = false;

  rcon.on?.("connected", () => {
    connected = true;
    logger?.info?.(`[monitoring] ${key}: RCON подключён`);
  });
  rcon.on?.("close", () => { connected = false; });
  rcon.on?.("error", (error) => {
    connected = false;
    logger?.warn?.(`[monitoring] ${key}: RCON ${error?.message || error}`);
  });

  return {
    start() {
      rcon.init().catch((error) => logger?.warn?.(`[monitoring] ${key}: RCON init ${error?.message || error}`));
    },
    async getInfo() {
      try {
        const info = await rcon.getServerInfo();
        if (!info) throw new Error("empty-server-info");
        connected = true;
        return { online: true, ...info };
      } catch (error) {
        connected = false;
        logger?.warn?.(`[monitoring] ${key}: ShowServerInfo ${error?.message || error}`);
        return { online: false };
      }
    },
    async stop() { await rcon.close(); },
    isConnected: () => connected,
  };
}
