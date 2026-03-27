import Database from 'better-sqlite3';
import { ensureSqliteKvStore } from '../../../../server/sqliteMigrations.js';

import {
  HQ_AGENCIES_STORAGE_KEY,
  HQ_HISTORY_LIMIT,
  HQ_HISTORY_STORAGE_KEY,
  buildHqBindingDocument,
  cloneHqBindingDocument,
  cloneHqHistoryMutationEntries,
  normalizeHqHistoryMutationEntry,
  type HqAgencyBindingDocument,
  type HqAgencyHistoryMutationEntry,
  type HqAgenciesStore,
} from './hqAgenciesStore.js';

const READ_KV_VALUE_SQL = 'SELECT value FROM kv_store WHERE key = ?';
const UPSERT_KV_VALUE_SQL =
  'INSERT INTO kv_store (key, value) VALUES (?, ?) ' +
  'ON CONFLICT(key) DO UPDATE SET value = excluded.value';

export class SqliteHqAgenciesStore implements HqAgenciesStore {
  constructor(private readonly dbFile: string) {}

  async upsertBinding(
    binding: HqAgencyBindingDocument,
    historyEntries: readonly HqAgencyHistoryMutationEntry[],
  ): Promise<HqAgencyBindingDocument> {
    const normalizedBinding = cloneHqBindingDocument(binding);
    const normalizedHistory = cloneHqHistoryMutationEntries(historyEntries);

    return this.withDatabase((database) => {
      const rows = this.readBindings(database).filter((entry) => entry.mst !== normalizedBinding.mst);
      rows.push(normalizedBinding);
      this.writeBindings(database, rows);
      this.appendHistoryEntries(database, normalizedHistory);
      return cloneHqBindingDocument(normalizedBinding);
    });
  }

  async deleteBinding(mst: string, historyEntries: readonly HqAgencyHistoryMutationEntry[]): Promise<void> {
    const normalizedHistory = cloneHqHistoryMutationEntries(historyEntries);

    this.withDatabase((database) => {
      const rows = this.readBindings(database).filter((entry) => entry.mst !== mst);
      this.writeBindings(database, rows);
      this.appendHistoryEntries(database, normalizedHistory);
    });
  }

  private readBindings(database: Database): HqAgencyBindingDocument[] {
    const stored = this.readStoredArray(database, HQ_AGENCIES_STORAGE_KEY);
    return stored
      .map((entry) => buildHqBindingDocument((entry ?? {}) as Record<string, unknown>))
      .filter((entry): entry is HqAgencyBindingDocument => Boolean(entry))
      .sort(compareBindings);
  }

  private writeBindings(database: Database, rows: readonly HqAgencyBindingDocument[]): void {
    this.ensureKvStore(database);
    const serialized = JSON.stringify(rows.map((entry) => cloneHqBindingDocument(entry)).sort(compareBindings));
    database.prepare(UPSERT_KV_VALUE_SQL).run(HQ_AGENCIES_STORAGE_KEY, serialized);
  }

  private appendHistoryEntries(database: Database, nextEntries: readonly HqAgencyHistoryMutationEntry[]): void {
    if (nextEntries.length === 0) {
      return;
    }

    this.ensureKvStore(database);
    const existing = this.readStoredArray(database, HQ_HISTORY_STORAGE_KEY)
      .map((entry) => normalizeHqHistoryMutationEntry(entry))
      .filter((entry): entry is HqAgencyHistoryMutationEntry => Boolean(entry));
    const merged = [...cloneHqHistoryMutationEntries(nextEntries), ...existing]
      .sort(compareHistoryEntries)
      .slice(0, HQ_HISTORY_LIMIT);
    database.prepare(UPSERT_KV_VALUE_SQL).run(HQ_HISTORY_STORAGE_KEY, JSON.stringify(merged));
  }

  private readStoredArray(database: Database, key: string): unknown[] {
    this.ensureKvStore(database);
    const row = database.prepare(READ_KV_VALUE_SQL).get(key) as { value?: string | null } | undefined;
    if (!row?.value) {
      return [];
    }

    try {
      const parsed = JSON.parse(row.value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private ensureKvStore(database: Database): void {
    ensureSqliteKvStore(database);
  }

  private withDatabase<T>(work: (database: Database) => T): T {
    const database = new Database(this.dbFile);

    try {
      return work(database);
    } finally {
      database.close();
    }
  }
}

function compareBindings(left: HqAgencyBindingDocument, right: HqAgencyBindingDocument): number {
  const companyCompare = left.company.localeCompare(right.company, 'vi', { sensitivity: 'base' });
  if (companyCompare !== 0) {
    return companyCompare;
  }

  return left.mst.localeCompare(right.mst);
}

function compareHistoryEntries(
  left: HqAgencyHistoryMutationEntry,
  right: HqAgencyHistoryMutationEntry,
): number {
  return Date.parse(right.timestamp) - Date.parse(left.timestamp);
}
