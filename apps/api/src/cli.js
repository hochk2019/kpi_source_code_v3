import { startApiServer } from "./startApiServer.js";

const runtime = await startApiServer();

console.log(`[api] server-v4 listening on http://${runtime.listenAddress}`);
console.log(
  `[api] legacy db file: ${runtime.config.dbFile ?? "not configured (postgres runtime default)"}`,
);
