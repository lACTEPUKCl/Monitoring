import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { loadServerConfigs } from "../src/config.js";
import { createRconMonitor } from "../src/rconMonitor.js";
import { formatPresence } from "../src/status.js";

test("formatPresence выводит игроков, обе очереди и карту", () => {
  assert.deepEqual(formatPresence({
    online: true,
    playerCount: 98,
    maxPlayers: 100,
    publicQueue: 4,
    reserveQueue: 1,
    currentLayer: "Narva_RAAS_v1",
  }), { text: "98/100+(5) Narva_RAAS_v1", status: "online" });
  assert.deepEqual(formatPresence({ online: false }), { text: "offline", status: "dnd" });
});

test("loadServerConfigs собирает прямую RCON-конфигурацию", () => {
  const configs = loadServerConfigs({
    SERVER_COUNT: "1",
    RCON_HOST_1: "10.89.0.2",
    RCON_PORT_1: "21122",
    RCON_PASSWORD_1: "secret",
    DISCORD_TOKEN_1: "discord",
    SERVER_NAME_1: "Модовый 1",
  });
  assert.equal(configs[0].host, "10.89.0.2");
  assert.equal(configs[0].port, 21122);
});

test("RCON monitor получает ShowServerInfo без BattleMetrics", async () => {
  class FakeRcon extends EventEmitter {
    init() { this.emit("connected"); return Promise.resolve(); }
    getServerInfo() { return Promise.resolve({ playerCount: 7, maxPlayers: 100, currentLayer: "Jensen" }); }
    close() { return Promise.resolve(); }
  }
  const monitor = createRconMonitor({ id: 1, key: "mod-1", host: "127.0.0.1", port: 21122, password: "x", RconClass: FakeRcon, logger: null });
  monitor.start();
  assert.equal((await monitor.getInfo()).playerCount, 7);
  assert.equal(monitor.isConnected(), true);
});
