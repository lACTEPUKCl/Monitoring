import http from "node:http";
import https from "node:https";

// Native HTTP deliberately bypasses the Discord-only global proxy dispatcher.
export function readStatus(baseUrl, password) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl.replace(/\/$/, "")}/v1/status`);
    const request = (url.protocol === "https:" ? https : http).get(url, {
      headers: { Authorization: `Bearer ${password}` },
    }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
        if (body.length > 262144) request.destroy(new Error("response-too-large"));
      });
      response.on("error", reject);
      response.on("end", () => {
        try { resolve(JSON.parse(body)); } catch { reject(new Error("invalid-json")); }
      });
    });
    const timeout = setTimeout(() => request.destroy(new Error("timeout")), 8000);
    request.on("close", () => clearTimeout(timeout));
    request.on("error", reject);
  });
}

export function createWardogsMonitor({ baseUrl, password, key, logger = console, requestStatus = readStatus }) {
  return {
    start() {},
    async stop() {},
    async getInfo() {
      try {
        const status = await requestStatus(baseUrl, password);
        if (!Number.isInteger(status?.players?.current) || status.players.current < 0 ||
            !Number.isInteger(status.players.max) || status.players.max <= 0) {
          throw new Error("invalid-status");
        }
        return { online: true, playerCount: status.players.current, maxPlayers: status.players.max,
          currentLayer: typeof status.map === "string" ? status.map : "" };
      } catch {
        logger?.warn?.(`[monitoring] ${key}: Wardogs status unavailable`);
        return { online: false };
      }
    },
  };
}
