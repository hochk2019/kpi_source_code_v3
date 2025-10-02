const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.resolve(__dirname, "../server/data/storage.sqlite");
const db = new Database(dbPath, { readonly: true });

try {
  const row = db.prepare("SELECT value FROM kv_store WHERE key = ?").get("ecus_sync_config_v1");
  if (!row || row.value === undefined || row.value === null) {
    console.log("No ECUS config found.");
  } else {
    console.log(row.value);
  }
} catch (err) {
  console.error("Failed to read ECUS config:", err);
  process.exitCode = 1;
} finally {
  db.close();
}
