import fs from "node:fs";

function positiveInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function loadServerConfigs(env = process.env) {
  const count = positiveInt(env.SERVER_COUNT);
  if (!count) throw new Error("SERVER_COUNT должен быть положительным числом");

  let fileConfigs = [];
  if (env.RCON_CONFIG_FILE) {
    const parsed = JSON.parse(fs.readFileSync(env.RCON_CONFIG_FILE, "utf8"));
    if (!Array.isArray(parsed)) throw new Error("RCON_CONFIG_FILE должен содержать массив");
    fileConfigs = parsed;
  }

  return Array.from({ length: count }, (_, offset) => {
    const index = offset + 1;
    const mode = String(env[`MONITOR_MODE_${index}`] || "rcon").trim().toLowerCase();
    const discordToken = String(env[`DISCORD_TOKEN_${index}`] || "").trim();
    if (!discordToken) throw new Error(`Не задан DISCORD_TOKEN_${index}`);
    if (mode === "battlemetrics") {
      const serverId = String(env[`SERVER_ID_${index}`] || "").trim();
      const battleMetricsToken = String(env.BATTLEMETRICS_TOKEN || "").trim();
      if (!serverId || !battleMetricsToken) throw new Error(`Неполная BattleMetrics-конфигурация сервера ${index}`);
      return { mode, key: `bm-${serverId}`, serverId, battleMetricsToken, discordToken };
    }
    if (mode !== "rcon") throw new Error(`Неизвестный MONITOR_MODE_${index}: ${mode}`);
    const wantedKey = String(env[`RCON_KEY_${index}`] || "").trim();
    const fromFile = wantedKey
      ? fileConfigs.find((entry) => entry.key === wantedKey)
      : fileConfigs[offset];
    const host = String(env[`RCON_HOST_${index}`] || fromFile?.host || "").trim();
    const port = positiveInt(env[`RCON_PORT_${index}`] || fromFile?.port);
    const password = String(env[`RCON_PASSWORD_${index}`] || fromFile?.password || fromFile?.token || "").trim();
    const key = wantedKey || fromFile?.key || `server-${index}`;
    const name = String(env[`SERVER_NAME_${index}`] || fromFile?.name || key).trim();
    if (!host || !port || !password || !discordToken) {
      throw new Error(`Неполная конфигурация сервера ${index} (${key})`);
    }
    return { mode, key, name, host, port, password, discordToken };
  });
}
