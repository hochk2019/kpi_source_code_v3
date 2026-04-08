// Temporary quarantine layer for the remaining legacy API test suites.
export {
  app,
  getDataHealthSnapshot,
  getDatabaseHandle,
  getDatabaseInitState,
  initializeDatabase,
  performDatabaseBackup,
  resetDatabaseForTests,
  stopServer,
  waitForAccountSqlSyncIdle,
} from '../../../../server/index.js';

export {
  appendEcusMonitorHistory,
  buildEcusMonitorMetrics,
  buildEcusMonitorSeries,
  clearEcusMonitorHistory,
  getEcusMonitorHistory,
} from '../../../../server/index.js';
