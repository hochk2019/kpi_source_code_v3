const sql = require("mssql");

async function run() {
  const config = {
    server: process.env.ECUS_SQL_SERVER,
    database: process.env.ECUS_SQL_DATABASE,
    user: process.env.ECUS_SQL_USER,
    password: process.env.ECUS_SQL_PASSWORD,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    pool: {
      idleTimeoutMillis: 5000,
      max: 1,
    },
  };

  try {
    const pool = await sql.connect(config);
    const request = pool.request();
    request.input("dbName", sql.NVarChar, config.database);
    const result = await request.query(`
      SELECT
        SERVERPROPERTY('ProductVersion') AS productVersion,
        SERVERPROPERTY('ProductLevel') AS productLevel,
        SERVERPROPERTY('Edition') AS edition,
        SERVERPROPERTY('EngineEdition') AS engineEdition,
        d.name AS databaseName,
        d.compatibility_level AS compatibilityLevel
      FROM sys.databases AS d
      WHERE d.name = @dbName;
    `);
    console.log(JSON.stringify(result.recordset, null, 2));
    await pool.close();
  } catch (err) {
    console.error("Failed to query SQL Server:", err);
    process.exitCode = 1;
  } finally {
    sql.close();
  }
}

run();
