import Database from 'better-sqlite3';
import { ensureSqliteKvStore } from '../../../../server/sqliteMigrations.js';
import { readDeclarationRowsSnapshot } from '../../../../server/businessSnapshotSqlite.js';

import {
  normalizeCoCodeConfig,
  normalizeCoDiscrepancyConfig,
  normalizeCoDiscrepancyState,
  type CoCodeConfigDocument,
  type CoDiscrepancyConfigDocument,
  type CoDiscrepancyStateDocument,
} from './declarationCoMonitoring.js';
import {
  normalizeDeclarationAlertConfig,
  normalizeDeclarationAlertState,
  type DeclarationAlertConfigDocument,
  type DeclarationAlertStateDocument,
} from './declarationAlerts.js';
import {
  ECUS_SYNC_CONFIG_STORAGE_KEY,
  normalizeEcusSyncConfig,
  type EcusSyncConfigDocument,
} from './ecusSyncConfig.js';
import {
  applyDeclarationPatch,
  type DeclarationBatchPatchEntry,
  type DeclarationBatchPatchResult,
  buildDeclarationDeletionEvent,
  buildDeclarationUpdateEvent,
  cloneDeclarationRecord,
  compareDeclarationEventsDescending,
  createDeclarationRowKey,
  declarationTargetMatchesRow,
  type DeclarationImportCommitInput,
  type DeclarationActor,
  type DeletedDeclarationFilters,
  type DeletedDeclarationRecord,
  type DeclarationEventRecord,
  type DeclarationHistoryChange,
  type DeclarationStoreTarget,
  type DeclarationsStore,
  type NormalizedDeclarationPatch,
} from './declarationsStore.js';
import {
  hasCanonicalSqliteDeclarationRows,
  readCanonicalSqliteDeclarationRows,
  replaceCanonicalSqliteDeclarationRows,
  upsertCanonicalSqliteDeclarationRows,
} from './sqliteDeclarationRowsTable.js';

const DECLARATION_ROWS_STORAGE_KEY = 'decl_rows_v1';
const DECLARATION_HISTORY_STORAGE_KEY = 'decl_history_v1';
const DECLARATION_DELETE_LOG_STORAGE_KEY = 'decl_deleted_log_v1';
const CO_CODE_CONFIG_STORAGE_KEY = 'co_tax_code_config_v1';
const CO_DISCREPANCY_CONFIG_STORAGE_KEY = 'co_discrepancy_config_v1';
const CO_DISCREPANCY_STATE_STORAGE_KEY = 'co_discrepancy_state_v1';
const DECLARATION_ALERT_CONFIG_STORAGE_KEY = 'decl_alert_config_v1';
const DECLARATION_ALERT_STATE_STORAGE_KEY = 'decl_alert_state_v1';
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

  async patchDeclarationsBatch(
    entries: readonly DeclarationBatchPatchEntry[],
    actor: DeclarationActor,
  ): Promise<DeclarationBatchPatchResult[]> {
    return this.withDatabase((database) => {
      const patchEntries = Array.isArray(entries) ? entries : [];
      if (patchEntries.length === 0) {
        return [];
      }

      const canonicalRowsExist = hasCanonicalSqliteDeclarationRows(database);
      const rows = this.readRows(database);
      const rowIndexByKey = new Map<string, number>();
      rows.forEach((row, index) => {
        const key = createDeclarationRowKey(row.so_tk, row.nhanh ?? row.branch);
        if (key) {
          rowIndexByKey.set(key, index);
        }
      });

      const historyEntries: Array<{
        target: DeclarationStoreTarget;
        updatedAt: string;
        changes: DeclarationHistoryChange[];
      }> = [];
      const results: DeclarationBatchPatchResult[] = [];

      for (const entry of patchEntries) {
        const index = rowIndexByKey.get(entry.target.key);
        if (index === undefined) {
          throw new Error(`Declaration ${entry.target.key} is not available in the SQLite compatibility store.`);
        }

        const currentRow = cloneDeclarationRecord(rows[index]);
        const result = applyDeclarationPatch(currentRow, entry.normalizedPatch);
        const nextRow = cloneDeclarationRecord(result.nextRecord);
        rows[index] = nextRow;

        if (result.historyChanges.length > 0) {
          historyEntries.push({
            target: entry.target,
            updatedAt: `${nextRow.updatedAt ?? new Date().toISOString()}`,
            changes: result.historyChanges,
          });
        }

        results.push({
          key: entry.target.key,
          nextRecord: cloneDeclarationRecord(nextRow),
        });
      }

      if (!canonicalRowsExist) {
        replaceCanonicalSqliteDeclarationRows(database, rows);
      } else {
        upsertCanonicalSqliteDeclarationRows(
          database,
          results
            .map((entry) => {
              const index = rowIndexByKey.get(entry.key);
              if (index === undefined) {
                return null;
              }
              return {
                row: rows[index],
                sortOrder: index,
              };
            })
            .filter((entry): entry is { row: Record<string, unknown>; sortOrder: number } => entry !== null),
        );
      }

      for (const entry of historyEntries) {
        this.appendHistoryEntry(
          database,
          entry.target,
          entry.updatedAt,
          actor.username,
          entry.changes,
        );
      }

      return results;
    });
  }

  async patchDeclaration(
    target: DeclarationStoreTarget,
    normalizedPatch: NormalizedDeclarationPatch,
    actor: DeclarationActor,
  ): Promise<Record<string, unknown>> {
    return this.withDatabase((database) => {
      const canonicalRowsExist = hasCanonicalSqliteDeclarationRows(database);
      const rows = this.readRows(database);
      const index = rows.findIndex((row) => declarationTargetMatchesRow(row, target));
      if (index === -1) {
        throw new Error(`Declaration ${target.key} is not available in the SQLite compatibility store.`);
      }

      const currentRow = cloneDeclarationRecord(rows[index]);
      const result = applyDeclarationPatch(currentRow, normalizedPatch);
      const nextRow = result.nextRecord;
      rows[index] = cloneDeclarationRecord(nextRow);

      if (!canonicalRowsExist) {
        replaceCanonicalSqliteDeclarationRows(database, rows);
      } else {
        upsertCanonicalSqliteDeclarationRows(database, [{ row: rows[index], sortOrder: index }]);
      }

      if (result.historyChanges.length > 0) {
        this.appendHistoryEntry(database, target, nextRow.updatedAt, actor.username, result.historyChanges);
      }

      return cloneDeclarationRecord(nextRow);
    });
  }

  async commitImportedDeclarations(input: DeclarationImportCommitInput): Promise<void> {
    this.withDatabase((database) => {
      const canonicalRowsExist = hasCanonicalSqliteDeclarationRows(database);
      const rows = this.readRows(database);
      const changedKeys = new Set<string>();

      for (const entry of input.entries ?? []) {
        const nextRow = cloneDeclarationRecord(entry.nextRecord);
        if (!normalizeText(nextRow.declaration_id ?? nextRow.id)) {
          nextRow.declaration_id = `decl-${entry.key}`;
        }

        const index = rows.findIndex(
          (row) => createDeclarationRowKey(row.so_tk, row.nhanh ?? row.branch) === entry.key,
        );

        if (index >= 0) {
          rows[index] = nextRow;
          changedKeys.add(entry.key);
          continue;
        }

        rows.push(nextRow);
        changedKeys.add(entry.key);
      }

      if (!canonicalRowsExist) {
        replaceCanonicalSqliteDeclarationRows(database, rows);
      } else if (changedKeys.size > 0) {
        upsertCanonicalSqliteDeclarationRows(
          database,
          rows
            .map((row, index) => ({
              row,
              sortOrder: index,
              key: createDeclarationRowKey(row.so_tk, row.nhanh ?? row.branch ?? row.branch_code),
            }))
            .filter((entry) => entry.key && changedKeys.has(entry.key))
            .map(({ row, sortOrder }) => ({ row, sortOrder })),
        );
      }
    });
  }

  async listDeclarationEvents(target: DeclarationStoreTarget): Promise<DeclarationEventRecord[]> {
    return this.withDatabase((database) => {
      const historyEvents = this.readHistoryEvents(database, target);
      const deleteEvents = this.readDeletionEvents(database, target);
      return [...historyEvents, ...deleteEvents].sort(compareDeclarationEventsDescending);
    });
  }

  async listDeletedDeclarations(
    filters: DeletedDeclarationFilters = {},
  ): Promise<DeletedDeclarationRecord[]> {
    return this.withDatabase((database) => {
      const normalizedType = normalizeDeletedDeclarationFilterType(filters.type);
      const rangeFrom = normalizeDeletedDeclarationDate(filters.from);
      const rangeTo = normalizeDeletedDeclarationDate(filters.to);

      return this.readStoredArray(database, DECLARATION_DELETE_LOG_STORAGE_KEY)
        .map((entry, index) => normalizeDeletedDeclarationEntry(entry, index))
        .filter((entry): entry is StoredDeletedDeclarationEntry & { id: string } => Boolean(entry))
        .filter((entry) => {
          const entryType = normalizeStoredDeletedDeclarationType(entry.type);
          if (normalizedType && entryType !== normalizedType) {
            return false;
          }

          if (rangeFrom || rangeTo) {
            const entryDate = normalizeDeletedDeclarationDate(entry.deleted_at);
            if (rangeFrom && (!entryDate || entryDate < rangeFrom)) {
              return false;
            }
            if (rangeTo && (!entryDate || entryDate > rangeTo)) {
              return false;
            }
          }

          return true;
        })
        .map((entry) => toDeletedDeclarationRecord(entry));
    });
  }

  async readEcusSyncConfig(): Promise<EcusSyncConfigDocument | null> {
    return this.withDatabase((database) => {
      const parsed = this.readStoredObject(database, ECUS_SYNC_CONFIG_STORAGE_KEY);
      return parsed ? normalizeEcusSyncConfig(parsed) : null;
    });
  }

  async writeEcusSyncConfig(
    config: EcusSyncConfigDocument,
    _updatedBy: string | null,
  ): Promise<EcusSyncConfigDocument> {
    return this.withDatabase((database) => {
      const normalized = normalizeEcusSyncConfig(config);
      this.writeStoredObject(database, ECUS_SYNC_CONFIG_STORAGE_KEY, normalized);
      return normalizeEcusSyncConfig(normalized);
    });
  }

  async readCoCodeConfig(): Promise<CoCodeConfigDocument | null> {
    return this.withDatabase((database) => {
      const parsed = this.readStoredObject(database, CO_CODE_CONFIG_STORAGE_KEY);
      return parsed ? normalizeCoCodeConfig(parsed) : null;
    });
  }

  async writeCoCodeConfig(
    config: CoCodeConfigDocument,
    _updatedBy: string | null,
  ): Promise<CoCodeConfigDocument> {
    return this.withDatabase((database) => {
      const normalized = normalizeCoCodeConfig(config);
      this.writeStoredObject(database, CO_CODE_CONFIG_STORAGE_KEY, normalized);
      return normalizeCoCodeConfig(normalized);
    });
  }

  async readCoDiscrepancyConfig(): Promise<CoDiscrepancyConfigDocument | null> {
    return this.withDatabase((database) => {
      const parsed = this.readStoredObject(database, CO_DISCREPANCY_CONFIG_STORAGE_KEY);
      return parsed ? normalizeCoDiscrepancyConfig(parsed) : null;
    });
  }

  async writeCoDiscrepancyConfig(
    config: CoDiscrepancyConfigDocument,
    _updatedBy: string | null,
  ): Promise<CoDiscrepancyConfigDocument> {
    return this.withDatabase((database) => {
      const normalized = normalizeCoDiscrepancyConfig(config);
      this.writeStoredObject(database, CO_DISCREPANCY_CONFIG_STORAGE_KEY, normalized);
      return normalizeCoDiscrepancyConfig(normalized);
    });
  }

  async readCoDiscrepancyState(): Promise<CoDiscrepancyStateDocument | null> {
    return this.withDatabase((database) => {
      const parsed = this.readStoredObject(database, CO_DISCREPANCY_STATE_STORAGE_KEY);
      return parsed ? normalizeCoDiscrepancyState(parsed) : null;
    });
  }

  async writeCoDiscrepancyState(
    state: CoDiscrepancyStateDocument,
    _updatedBy: string | null,
  ): Promise<CoDiscrepancyStateDocument> {
    return this.withDatabase((database) => {
      const normalized = normalizeCoDiscrepancyState(state);
      this.writeStoredObject(database, CO_DISCREPANCY_STATE_STORAGE_KEY, normalized);
      return normalizeCoDiscrepancyState(normalized);
    });
  }

  async readDeclarationAlertConfig(): Promise<DeclarationAlertConfigDocument | null> {
    return this.withDatabase((database) => {
      const parsed = this.readStoredObject(database, DECLARATION_ALERT_CONFIG_STORAGE_KEY);
      return parsed ? normalizeDeclarationAlertConfig(parsed) : null;
    });
  }

  async writeDeclarationAlertConfig(
    config: DeclarationAlertConfigDocument,
    _updatedBy: string | null,
  ): Promise<DeclarationAlertConfigDocument> {
    return this.withDatabase((database) => {
      const normalized = normalizeDeclarationAlertConfig(config);
      this.writeStoredObject(database, DECLARATION_ALERT_CONFIG_STORAGE_KEY, normalized);
      return normalizeDeclarationAlertConfig(normalized);
    });
  }

  async readDeclarationAlertState(): Promise<DeclarationAlertStateDocument | null> {
    return this.withDatabase((database) => {
      const parsed = this.readStoredObject(database, DECLARATION_ALERT_STATE_STORAGE_KEY);
      return parsed ? normalizeDeclarationAlertState(parsed) : null;
    });
  }

  async writeDeclarationAlertState(
    state: DeclarationAlertStateDocument,
    _updatedBy: string | null,
  ): Promise<DeclarationAlertStateDocument> {
    return this.withDatabase((database) => {
      const normalized = normalizeDeclarationAlertState(state);
      this.writeStoredObject(database, DECLARATION_ALERT_STATE_STORAGE_KEY, normalized);
      return normalizeDeclarationAlertState(normalized);
    });
  }

  async markDeclarationsReviewed(keys: readonly string[], actor: string): Promise<number> {
    return this.withDatabase((database) => {
      const canonicalRowsExist = hasCanonicalSqliteDeclarationRows(database);
      const keySet = new Set(
        (Array.isArray(keys) ? keys : []).map((key) => normalizeText(key)).filter(Boolean),
      );
      if (keySet.size === 0) {
        return 0;
      }

      const rows = this.readRows(database);
      let updated = 0;
      const reviewedAt = new Date().toISOString();
      const nextRows = rows.map((row) => {
        const key = createDeclarationRowKey(row.so_tk, row.nhanh ?? row.branch ?? row.branch_code);
        if (!keySet.has(key) || row.reviewed === true) {
          return row;
        }

        updated += 1;
        return {
          ...cloneDeclarationRecord(row),
          reviewed: true,
          reviewed_at: reviewedAt,
          reviewed_by: actor || 'system',
        };
      });

      if (updated > 0) {
        if (!canonicalRowsExist) {
          replaceCanonicalSqliteDeclarationRows(database, nextRows);
        } else {
          upsertCanonicalSqliteDeclarationRows(
            database,
            nextRows
              .map((row, index) => ({
                row,
                sortOrder: index,
                key: createDeclarationRowKey(row.so_tk, row.nhanh ?? row.branch ?? row.branch_code),
              }))
              .filter((entry) => entry.key && keySet.has(entry.key))
              .map(({ row, sortOrder }) => ({ row, sortOrder })),
          );
        }
      }

      return updated;
    });
  }

  async unmarkDeclarationsReviewed(keys: readonly string[], _actor: string): Promise<number> {
    return this.withDatabase((database) => {
      const canonicalRowsExist = hasCanonicalSqliteDeclarationRows(database);
      const keySet = new Set(
        (Array.isArray(keys) ? keys : []).map((key) => normalizeText(key)).filter(Boolean),
      );
      if (keySet.size === 0) {
        return 0;
      }

      const rows = this.readRows(database);
      let updated = 0;
      const nextRows = rows.map((row) => {
        const key = createDeclarationRowKey(row.so_tk, row.nhanh ?? row.branch ?? row.branch_code);
        if (!keySet.has(key) || row.reviewed !== true) {
          return row;
        }

        updated += 1;
        const next = cloneDeclarationRecord(row);
        next.reviewed = false;
        delete next.reviewed_at;
        delete next.reviewed_by;
        return next;
      });

      if (updated > 0) {
        if (!canonicalRowsExist) {
          replaceCanonicalSqliteDeclarationRows(database, nextRows);
        } else {
          upsertCanonicalSqliteDeclarationRows(
            database,
            nextRows
              .map((row, index) => ({
                row,
                sortOrder: index,
                key: createDeclarationRowKey(row.so_tk, row.nhanh ?? row.branch ?? row.branch_code),
              }))
              .filter((entry) => entry.key && keySet.has(entry.key))
              .map(({ row, sortOrder }) => ({ row, sortOrder })),
          );
        }
      }

      return updated;
    });
  }

  private readRows(database: Database): Record<string, unknown>[] {
    const canonicalRows = readCanonicalSqliteDeclarationRows(database);
    if (canonicalRows.length > 0) {
      return canonicalRows;
    }

    const typedSnapshotRows = readDeclarationRowsSnapshot(database) ?? [];
    if (typedSnapshotRows.length > 0) {
      return typedSnapshotRows.map((entry) => cloneDeclarationRecord(entry));
    }

    const legacyRows = this.readStoredArray(database, DECLARATION_ROWS_STORAGE_KEY);
    return legacyRows
      .filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
      .map((entry) => cloneDeclarationRecord(entry as Record<string, unknown>));
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

  private readStoredObject(database: Database, key: string): Record<string, unknown> | null {
    this.ensureKvStore(database);
    const row = database.prepare(READ_KV_VALUE_SQL).get(key) as { value?: string | null } | undefined;
    if (!row?.value) {
      return null;
    }

    try {
      const parsed = JSON.parse(row.value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  private writeStoredObject(database: Database, key: string, value: Record<string, unknown>): void {
    this.ensureKvStore(database);
    database.prepare(UPSERT_KV_VALUE_SQL).run(key, JSON.stringify(value));
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

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : `${value ?? ''}`.trim();
}

function normalizeDeletedDeclarationDate(value: unknown): string {
  return normalizeText(value).slice(0, 10);
}

function normalizeDeletedDeclarationFilterType(value: unknown): 'soft' | 'hard' | null {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'soft' || normalized === 'hard') {
    return normalized;
  }
  return null;
}

function normalizeStoredDeletedDeclarationType(value: unknown): 'soft' | 'hard' {
  return normalizeText(value).toLowerCase() === 'hard' ? 'hard' : 'soft';
}

function toDeletedDeclarationRecord(
  entry: StoredDeletedDeclarationEntry & { id?: string },
): DeletedDeclarationRecord {
  const company = normalizeText(entry.company ?? entry.ten_dn);

  return {
    so_tk: normalizeText(entry.so_tk),
    nhanh: normalizeText(entry.nhanh),
    mst: normalizeText(entry.mst),
    company,
    ten_dn: company,
    type: normalizeStoredDeletedDeclarationType(entry.type),
    deleted_at: normalizeText(entry.deleted_at) || new Date().toISOString(),
    deleted_by: normalizeText(entry.deleted_by) || 'system',
  };
}
