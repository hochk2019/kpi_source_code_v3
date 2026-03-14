import Database from 'better-sqlite3';

import {
  readDeclarationRowsSnapshot,
  writeDeclarationRowsSnapshot,
} from '../../../../server/businessSnapshotSqlite.js';
import {
  applyDeclarationPatch,
  buildDeclarationDeletionEvent,
  buildDeclarationUpdateEvent,
  cloneDeclarationRecord,
  compareDeclarationEventsDescending,
  createDeclarationRowKey,
  declarationTargetMatchesRow,
  type DeclarationActor,
  type DeclarationEventRecord,
  type DeclarationHistoryChange,
  type DeclarationStoreTarget,
  type DeclarationsStore,
  type NormalizedDeclarationPatch,
} from './declarationsStore.js';

const DECLARATION_ROWS_STORAGE_KEY = 'decl_rows_v1';
const DECLARATION_HISTORY_STORAGE_KEY = 'decl_history_v1';
const DECLARATION_DELETE_LOG_STORAGE_KEY = 'decl_deleted_log_v1';
const READ_KV_VALUE_SQL = 'SELECT value FROM kv_store WHERE key = ?';
const UPSERT_KV_VALUE_SQL =
  'INSERT INTO kv_store (key, value) VALUES (?, ?) ' +
  'ON CONFLICT(key) DO UPDATE SET value = excluded.value';

type StoredDeclarationHistoryEntry = {
  id?: unknown;
  ts?: unknown;
  timestamp?: unknown;
  actor?: unknown;
  changes?: unknown;
};

type StoredDeclarationHistoryStore = {
  rows?: Record<string, StoredDeclarationHistoryEntry[]>;
};

type StoredDeletedDeclarationEntry = {
  so_tk?: unknown;
  nhanh?: unknown;
  mst?: unknown;
  company?: unknown;
  ten_dn?: unknown;
  type?: unknown;
  deleted_at?: unknown;
  deleted_by?: unknown;
};

export class SqliteDeclarationsStore implements DeclarationsStore {
  constructor(private readonly dbFile: string) {}

  async patchDeclaration(
    target: DeclarationStoreTarget,
    normalizedPatch: NormalizedDeclarationPatch,
    actor: DeclarationActor,
  ): Promise<Record<string, unknown>> {
    return this.withDatabase((database) => {
      const rows = this.readRows(database);
      const index = rows.findIndex((row) => declarationTargetMatchesRow(row, target));
      if (index === -1) {
        throw new Error(`Declaration ${target.key} is not available in the SQLite compatibility store.`);
      }

      const currentRow = cloneDeclarationRecord(rows[index]);
      const result = applyDeclarationPatch(currentRow, normalizedPatch);
      const nextRow = result.nextRecord;
      rows[index] = cloneDeclarationRecord(nextRow);

      writeDeclarationRowsSnapshot(database, rows);
      this.writeStoredRows(database, rows);

      if (result.historyChanges.length > 0) {
        this.appendHistoryEntry(database, target, nextRow.updatedAt, actor.username, result.historyChanges);
      }

      return cloneDeclarationRecord(nextRow);
    });
  }

  async listDeclarationEvents(target: DeclarationStoreTarget): Promise<DeclarationEventRecord[]> {
    return this.withDatabase((database) => {
      const historyEvents = this.readHistoryEvents(database, target);
      const deleteEvents = this.readDeletionEvents(database, target);
      return [...historyEvents, ...deleteEvents].sort(compareDeclarationEventsDescending);
    });
  }

  private readRows(database: Database): Record<string, unknown>[] {
    const snapshotRows = readDeclarationRowsSnapshot(database);
    if (Array.isArray(snapshotRows) && snapshotRows.length > 0) {
      return snapshotRows
        .filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
        .map((entry) => cloneDeclarationRecord(entry as Record<string, unknown>));
    }

    const legacyRows = this.readStoredArray(database, DECLARATION_ROWS_STORAGE_KEY);
    return legacyRows
      .filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
      .map((entry) => cloneDeclarationRecord(entry as Record<string, unknown>));
  }

  private writeStoredRows(database: Database, rows: readonly Record<string, unknown>[]): void {
    this.ensureKvStore(database);
    database
      .prepare(UPSERT_KV_VALUE_SQL)
      .run(DECLARATION_ROWS_STORAGE_KEY, JSON.stringify(rows.map((row) => cloneDeclarationRecord(row))));
  }

  private appendHistoryEntry(
    database: Database,
    target: DeclarationStoreTarget,
    timestamp: unknown,
    actor: string,
    changes: readonly DeclarationHistoryChange[],
  ): void {
    this.ensureKvStore(database);
    const historyStore = this.readHistoryStore(database);
    const currentEntries = Array.isArray(historyStore.rows[target.key]) ? historyStore.rows[target.key] : [];
    const nextEntry = {
      id: `decl-${target.key}-${Date.now()}`,
      ts: typeof timestamp === 'string' ? timestamp : new Date().toISOString(),
      actor,
      changes: changes.map((change) => ({ ...change })),
    };

    historyStore.rows[target.key] = [nextEntry, ...currentEntries];
    database
      .prepare(UPSERT_KV_VALUE_SQL)
      .run(DECLARATION_HISTORY_STORAGE_KEY, JSON.stringify(historyStore));
  }

  private readHistoryEvents(database: Database, target: DeclarationStoreTarget): DeclarationEventRecord[] {
    const historyStore = this.readHistoryStore(database);
    const entries = Array.isArray(historyStore.rows[target.key]) ? historyStore.rows[target.key] : [];

    return entries
      .map((entry) =>
        buildDeclarationUpdateEvent({
          id: entry.id,
          timestamp: entry.ts ?? entry.timestamp,
          actor: entry.actor,
          changes: entry.changes,
        }),
      )
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }

  private readDeletionEvents(database: Database, target: DeclarationStoreTarget): DeclarationEventRecord[] {
    const rows = this.readStoredArray(database, DECLARATION_DELETE_LOG_STORAGE_KEY);

    return rows
      .map((entry, index) => normalizeDeletedDeclarationEntry(entry, index))
      .filter((entry): entry is StoredDeletedDeclarationEntry & { id: string } => Boolean(entry))
      .filter((entry) => createDeclarationRowKey(entry.so_tk, entry.nhanh) === target.key)
      .map((entry) =>
        buildDeclarationDeletionEvent({
          id: entry.id,
          timestamp: entry.deleted_at,
          actor: entry.deleted_by,
          deletionType: entry.type,
          snapshot: {
            so_tk: entry.so_tk,
            nhanh: entry.nhanh,
            mst: entry.mst,
            company: entry.company ?? entry.ten_dn,
          },
        }),
      );
  }

  private readHistoryStore(database: Database): { rows: Record<string, StoredDeclarationHistoryEntry[]> } {
    this.ensureKvStore(database);
    const row = database.prepare(READ_KV_VALUE_SQL).get(DECLARATION_HISTORY_STORAGE_KEY) as
      | { value?: string | null }
      | undefined;
    if (!row?.value) {
      return { rows: {} };
    }

    try {
      const parsed = JSON.parse(row.value) as StoredDeclarationHistoryStore;
      const sourceRows =
        parsed?.rows && typeof parsed.rows === 'object' && !Array.isArray(parsed.rows) ? parsed.rows : {};
      return {
        rows: sourceRows,
      };
    } catch {
      return { rows: {} };
    }
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
    database.exec('CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
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

function normalizeDeletedDeclarationEntry(
  value: unknown,
  index: number,
): (StoredDeletedDeclarationEntry & { id: string }) | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const entry = value as StoredDeletedDeclarationEntry;
  const soTk = `${entry.so_tk ?? ''}`.trim();
  const nhanh = `${entry.nhanh ?? ''}`.trim();
  if (!soTk) {
    return null;
  }

  const deletedAt = `${entry.deleted_at ?? ''}`.trim() || new Date().toISOString();

  return {
    ...entry,
    id: `decl-delete-${soTk}-${nhanh || 'branchless'}-${deletedAt}-${index}`,
    so_tk: soTk,
    nhanh,
    deleted_at: deletedAt,
  };
}
