import fs from 'node:fs';

import Database from 'better-sqlite3';

import type {
  BusinessHotPathKey,
  BusinessSnapshotSourceKind,
} from '../../persistence/businessSnapshotReader.js';
import type { HqAgenciesAsyncReader } from './hqAgenciesAsyncReader.js';

type KvStoreRow = {
  value?: unknown;
};

const EMPTY_HOT_PATH_KEYS: readonly BusinessHotPathKey[] = Object.freeze([]);
const HQ_AGENCIES_STORAGE_KEY = 'hq_agencies_v1';
const HQ_HISTORY_STORAGE_KEY = 'hq_history_v1';
const READ_KV_VALUE_SQL = 'SELECT value FROM kv_store WHERE key = ?';

export class SqliteHqAgenciesAsyncReader implements HqAgenciesAsyncReader {
  private readonly sourceKind: Extract<BusinessSnapshotSourceKind, 'dual-write' | 'relational-store'>;

  constructor(
    private readonly dbFile: string,
    options: {
      sourceKind?: Extract<BusinessSnapshotSourceKind, 'dual-write' | 'relational-store'>;
    } = {},
  ) {
    this.sourceKind = options.sourceKind ?? 'dual-write';
  }

  getSourceKind() {
    return this.sourceKind;
  }

  getHotPathKeys() {
    return EMPTY_HOT_PATH_KEYS;
  }

  getLegacyDbFile(): string | null {
    return this.dbFile || null;
  }

  async readBindings(): Promise<unknown[]> {
    return this.readStoredArray(HQ_AGENCIES_STORAGE_KEY);
  }

  async readHistoryEntries(): Promise<unknown[]> {
    return this.readStoredArray(HQ_HISTORY_STORAGE_KEY);
  }

  private readStoredArray(key: string): unknown[] {
    const rawValue = this.readValue(key);
    if (typeof rawValue !== 'string' || !rawValue.trim()) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawValue);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private readValue(key: string): unknown {
    if (!this.dbFile || (this.dbFile !== ':memory:' && !fs.existsSync(this.dbFile))) {
      return null;
    }

    let database: InstanceType<typeof Database> | null = null;

    try {
      database = new Database(this.dbFile, {
        readonly: true,
        fileMustExist: this.dbFile !== ':memory:',
      });
      const row = database.prepare(READ_KV_VALUE_SQL).get(key) as KvStoreRow | undefined;
      return row?.value ?? null;
    } catch {
      return null;
    } finally {
      database?.close();
    }
  }
}
