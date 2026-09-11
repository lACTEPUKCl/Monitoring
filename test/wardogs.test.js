import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createWardogsMonitor, readStatus } from "../src/wardogsMonitor.js";
import { loadServerConfigs } from "../src/config.js";
import { formatPresence } from "../src/status.js";

test("Wardogs config coexists with Squad and validates credentials", () => {
  const env = { SERVER_COUNT: "2", DISCORD_TOKEN_1: "a", RCON_HOST_1: "localhost", RCON_PORT_1: "1234", RCON_PASSWORD_1: "s",
    SERVER_GAME_2: "wardogs", DISCORD_TOKEN_2: "b", RCON_URL_2: "http://localhost:8888", RCON_PASSWORD_2: "w" };
  const configs = loadServerConfigs(env);
  assert.equal(configs[0].host, "localhost");
  assert.equal(configs[1].game, "wardogs");
  assert.throws(() => loadServerConfigs({ ...env, RCON_PASSWORD_2: "" }));
  assert.throws(() => loadServerConfigs({ ...env, RCON_URL_2: "ftp://localhost" }));
});

test("Wardogs zero players is online; unknown data is not fabricated", async () => {
  const monitor = createWardogsMonitor({ logger: null, requestStatus: async () => ({players:{current:0,max:100},map:"Bakurani"}) });
  assert.deepEqual(formatPresence(await monitor.getInfo()), {text:"0/100 Bakurani",status:"online"});
  for (const result of [{}, {players:{current:-1,max:100}}, {players:{current:0}}]) {
    assert.deepEqual(await createWardogsMonitor({logger:null,requestStatus:async()=>result}).getInfo(), {online:false});
  }
  assert.deepEqual(await createWardogsMonitor({logger:null,requestStatus:async()=>{throw Error("secret");}}).getInfo(), {online:false});
});

test("HTTP adapter uses bearer auth and refuses redirects", async () => {
  const server = http.createServer((req,res) => {
    assert.equal(req.headers.authorization, "Bearer example");
    if (req.url === "/v1/status") res.end(JSON.stringify({players:{current:2,max:100},map:"Bakurani"}));
    else { res.writeHead(302,{Location:"http://example.com"}); res.end(); }
  });
  await new Promise(resolve => server.listen(0,"127.0.0.1",resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await readStatus(url,"example")).players.current,2);
    await assert.rejects(readStatus(`${url}/redirect`,"example"), /HTTP 302/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
