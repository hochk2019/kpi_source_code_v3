import fs from 'node:fs';

import Database from 'better-sqlite3';

import {
  DEFAULT_MONTHLY_REPORTING_AGGREGATE_KEY,
  MONTHLY_REPORTING_AGGREGATE_KEY,
  REPORT_SCHEDULE_STORAGE_KEY,
  readAdjustmentRowsSnapshot,
  readDeclarationRowsSnapshot,
  readMstAssignmentRowsSnapshot,
  readReportingProjectionValue,
  readRuleCollectionSnapshot,
  readTeamRosterSnapshot,
} from '@kpi/backend-shared/persistence';
import { readCanonicalSqliteDeclarationRows } from '../modules/declarations/sqliteDeclarationRowsTable.js';
import {
  LEGACY_BUSINESS_HOT_PATH_KEYS,
  type BusinessSnapshotReader,
  type BusinessSnapshotSourceKind,
} from './businessSnapshotReader.js';

const EMPTY_OBJECT = Object.freeze({});

export type SqliteBusinessSnapshotReaderOptions = {
  sourceKind?: Extract<BusinessSnapshotSourceKind, 'dual-write' | 'relational-store'>;
};

export class SqliteBusinessSnapshotReader implements BusinessSnapshotReader {
  private readonly sourceKind: Extract<BusinessSnapshotSourceKind, 'dual-write' | 'relational-store'>;

  constructor(
    private readonly dbFile: string,
    options: SqliteBusinessSnapshotReaderOptions = {},
  ) {
    this.sourceKind = options.sourceKind ?? 'dual-write';
  }

  getSourceKind() {
    return this.sourceKind;
  }

  getHotPathKeys() {
    return LEGACY_BUSINESS_HOT_PATH_KEYS;
  }

  getLegacyDbFile(): string {
    return this.dbFile;
  }

  readDeclarationRows(): unknown[] {
    const canonicalRows = this.readSnapshot((database) => readCanonicalSqliteDeclarationRows(database));
    if (Array.isArray(canonicalRows) && canonicalRows.length > 0) {
      return ensureArray(canonicalRows);
    }
    const typedSnapshot = this.readSnapshot((database) => readDeclarationRowsSnapshot(database));
    return ensureArray(typedSnapshot);
  }

  readMstAssignmentRows(): unknown[] {
    const typedSnapshot = this.readSnapshot((database) => readMstAssignmentRowsSnapshot(database));
    return ensureArray(typedSnapshot);
  }

  readTeamRoster(): unknown {
    return this.readSnapshot((database) => readTeamRosterSnapshot(database)) ?? EMPTY_OBJECT;
  }

  readRuleCollection(): unknown {
    const typedSnapshot = this.readSnapshot((database) => readRuleCollectionSnapshot(database));
    return typedSnapshot && typeof typedSnapshot === 'object' ? typedSnapshot : EMPTY_OBJECT;
  }

  readAdjustmentRows(): unknown[] {
    const typedSnapshot = this.readSnapshot((database) => readAdjustmentRowsSnapshot(database));
    return ensureArray(typedSnapshot);
  }

  readReportSchedules(): unknown[] {
    return ensureArray(this.readReportingProjection(REPORT_SCHEDULE_STORAGE_KEY));
  }

  readMonthlyAggregateSnapshot(): unknown {
    return this.readReportingProjection(MONTHLY_REPORTING_AGGREGATE_KEY);
  }

  readDefaultMonthlyAggregateSnapshot(): unknown {
    return this.readReportingProjection(DEFAULT_MONTHLY_REPORTING_AGGREGATE_KEY);
  }

  private readReportingProjection(key: string): unknown {
    return this.readSnapshot((database) => readReportingProjectionValue(database, key));
  }

  private readSnapshot<T>(readSnapshot: (database: InstanceType<typeof Database>) => T | null): T | null {
    if (!this.dbFile || (this.dbFile !== ':memory:' && !fs.existsSync(this.dbFile))) {
      return null;
    }

    let database: InstanceType<typeof Database> | null = null;

    try {
      database = new Database(this.dbFile, {
        readonly: true,
        fileMustExist: this.dbFile !== ':memory:',
      });
      return readSnapshot(database);
    } catch {
      return null;
    } finally {
      database?.close();
    }
  }
}

function ensureArray(input: unknown): unknown[] {
  return Array.isArray(input) ? input : [];
}
