import type Database from 'better-sqlite3';

export interface DatabaseInitState {
  seeded: boolean;
  insertedEntries: number;
  missingInserted: number;
  timestamp: string;
  dbFile: string;
}

export interface EcusMonitorHistory {
  version: number;
  entries: Record<string, unknown>[];
  updatedAt: string | null;
}

export interface EcusMonitorMetrics {
  generatedAt: string;
  totals: { entries: number };
  latest: Record<string, unknown> | null;
  windows: Record<string, Record<string, unknown>>;
  thresholds: Record<string, unknown>;
}

export function initializeDatabase(options?: { dbFile?: string }): Promise<Database.Database>;

export function getDatabaseHandle(): Database.Database;

export function getDatabaseInitState(): DatabaseInitState;

export function performDatabaseBackup(options?: {
  dbFile?: string;
  backupDir?: string;
  retention?: number;
  reason?: string;
  actor?: string;
  note?: unknown;
}): Promise<{ ok: boolean; file?: string; bytes?: number; reason?: string; error?: string }>;

export function resetDatabaseForTests(seedOverrides?: Record<string, unknown> | null): void;

export function getDataHealthSnapshot(options?: {
  backupHealth?: { ignoreIssueCodes?: string[] };
}): Promise<Record<string, unknown>>;

export function stopServer(): void;

export function waitForAccountSqlSyncIdle(): Promise<void>;

export function appendEcusMonitorHistory(
  snapshot: Record<string, unknown>,
  options?: { actor?: string; source?: string },
): { entry: Record<string, unknown>; totalEntries: number } | null;

export function getEcusMonitorHistory(): EcusMonitorHistory;

export function clearEcusMonitorHistory(options?: {
  actor?: string;
  source?: string;
}): EcusMonitorHistory;

export function buildEcusMonitorMetrics(options?: {
  history?: EcusMonitorHistory;
}): EcusMonitorMetrics;

export function buildEcusMonitorSeries(
  entries: Record<string, unknown>[],
  options?: { thresholds?: Record<string, unknown> },
): {
  name: string;
  unit: string;
  legend?: Record<string, number>;
  thresholds?: Record<string, unknown>;
  datapoints: [number, number][];
}[];
