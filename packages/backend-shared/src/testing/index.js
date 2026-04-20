// Modular test harness — all business logic is self-contained in serverTestHarness.js.
// TODO (cng-sr1.6 final step): migrate `app` to a server-v4 Express instance,
// then remove this last remaining import from server/index.js.
export { app } from '../../../../server/index.js';

export {
  getDataHealthSnapshot,
  getDatabaseHandle,
  getDatabaseInitState,
  initializeDatabase,
  performDatabaseBackup,
  resetDatabaseForTests,
  stopServer,
  waitForAccountSqlSyncIdle,
  appendEcusMonitorHistory,
  buildEcusMonitorMetrics,
  buildEcusMonitorSeries,
  clearEcusMonitorHistory,
  getEcusMonitorHistory,
} from './serverTestHarness.js';

