export function formatPresence(info) {
  if (!info?.online) return { text: "offline", status: "dnd" };
  const players = Number(info.playerCount) || 0;
  const maxPlayers = Number(info.maxPlayers) || 100;
  const queueCount = (Number(info.publicQueue) || 0) + (Number(info.reserveQueue) || 0);
  const queue = queueCount > 0 ? `+(${queueCount})` : "";
  const map = String(info.currentLayer || "карта загружается").trim();
  return { text: `${players}/${maxPlayers}${queue} ${map}`, status: "online" };
}
