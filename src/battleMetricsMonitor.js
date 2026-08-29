// Совместимость для внешнего сервера, к RCON которого у нас нет доступа.
// Собственные RNS-серверы всегда используют createRconMonitor.
export function createBattleMetricsMonitor({ serverId, battleMetricsToken, logger = console, http = fetch }) {
  return {
    start() {},
    async getInfo() {
      try {
        const response = await http(`https://api.battlemetrics.com/servers/${serverId}`, {
          headers: { Authorization: `Bearer ${battleMetricsToken}` },
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error(`http-${response.status}`);
        const attrs = (await response.json())?.data?.attributes;
        if (!attrs || attrs.status === "dead") return { online: false };
        return {
          online: true,
          playerCount: attrs.players,
          maxPlayers: attrs.maxPlayers || 100,
          publicQueue: attrs.details?.squad_publicQueue || 0,
          reserveQueue: attrs.details?.squad_reserveQueue || 0,
          currentLayer: attrs.details?.map || attrs.details?.reforger?.scenarioName || "",
        };
      } catch (error) {
        logger?.warn?.(`[monitoring] BM ${serverId}: ${error?.message || error}`);
        return { online: false };
      }
    },
    async stop() {},
  };
}
