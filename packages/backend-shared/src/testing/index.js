// Modular test harness — all business logic is self-contained.
// The Express internal proxy uses a mock/minimal app for legacy tests until they are 
// fully retired. Production dependencies use server-v4 directly.
import express from 'express';
export const app = express();

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

