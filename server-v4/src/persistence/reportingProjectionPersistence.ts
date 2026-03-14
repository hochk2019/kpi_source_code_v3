import fs from 'node:fs';

import Database from 'better-sqlite3';

import {
  deleteReportingProjectionValue,
  ensureReportingProjectionTable,
  readReportingJobRunProjectionEntries,
  readReportingMonthlyAggregateProjectionEntries,
  readReportingProjectionValue,
  writeReportingProjectionValue,
} from '../../../server/reportingProjectionSqlite.js';

export type ReportingProjectionPayload = Record<string, unknown> | Record<string, unknown>[] | null;

export interface ReportingProjectionPersistence {
  readValue(key: string): Promise<ReportingProjectionPayload>;
  writeValue(key: string, value: ReportingProjectionPayload): Promise<void>;
  deleteValue(key: string): Promise<void>;
  readMonthlyAggregateEntries(snapshotKey: string): Promise<Record<string, unknown>[]>;
  readJobRunEntries(snapshotKey: string): Promise<Record<string, unknown>[]>;
}

export function createSqliteReportingProjectionPersistence(dbFile: string): ReportingProjectionPersistence {
  return {
    async readValue(key) {
      return withReadableDatabase(dbFile, null, (database) => {
        ensureReportingProjectionTable(database);
        return normalizeProjectionPayload(readReportingProjectionValue(database, key));
      });
    },
    async writeValue(key, value) {
      if (!isProjectionPayload(value)) {
        return;
      }

      withWritableDatabase(dbFile, (database) => {
        ensureReportingProjectionTable(database);
        writeReportingProjectionValue(database, key, value);
      });
    },
    async deleteValue(key) {
      withWritableDatabase(dbFile, (database) => {
        ensureReportingProjectionTable(database);
        deleteReportingProjectionValue(database, key);
      });
    },
    async readMonthlyAggregateEntries(snapshotKey) {
      return withReadableDatabase(dbFile, [], (database) => {
        ensureReportingProjectionTable(database);
        const rows = readReportingMonthlyAggregateProjectionEntries<Record<string, unknown>>(database, snapshotKey);
        return Array.isArray(rows) ? rows.filter(isRecord) : [];
      });
    },
    async readJobRunEntries(snapshotKey) {
      return withReadableDatabase(dbFile, [], (database) => {
        ensureReportingProjectionTable(database);
        const rows = readReportingJobRunProjectionEntries<Record<string, unknown>>(database, snapshotKey);
        return Array.isArray(rows) ? rows.filter(isRecord) : [];
      });
    },
  };
}

function withReadableDatabase<T>(
  dbFile: string,
  fallback: T,
  action: (database: InstanceType<typeof Database>) => T
): T {
  if (!canOpenDatabase(dbFile)) {
    return fallback;
  }

  let database: InstanceType<typeof Database> | null = null;

  try {
    database = new Database(dbFile, {
      readonly: true,
      fileMustExist: dbFile !== ':memory:',
    });
    return action(database);
  } catch {
    return fallback;
  } finally {
    database?.close();
  }
}

function withWritableDatabase(
  dbFile: string,
  action: (database: InstanceType<typeof Database>) => void
): void {
  if (!canOpenDatabase(dbFile)) {
    return;
  }

  let database: InstanceType<typeof Database> | null = null;

  try {
    database = new Database(dbFile, {
      fileMustExist: dbFile !== ':memory:',
    });
    action(database);
  } catch {
    // Projection persistence should not break runtime reads.
  } finally {
    database?.close();
  }
}

function canOpenDatabase(dbFile: string): boolean {
  return dbFile === ':memory:' || fs.existsSync(dbFile);
}

function normalizeProjectionPayload(value: unknown): ReportingProjectionPayload {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  return isRecord(value) ? value : null;
}

function isProjectionPayload(value: unknown): value is Exclude<ReportingProjectionPayload, null> {
  return isRecord(value) || (Array.isArray(value) && value.every(isRecord));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
