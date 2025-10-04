process.env.KPI_SKIP_LISTEN = '1';
const { getEcusConfig } = await import('./server/index.js');
const config = getEcusConfig();
console.log(JSON.stringify(config.columnMap, null, 2));
