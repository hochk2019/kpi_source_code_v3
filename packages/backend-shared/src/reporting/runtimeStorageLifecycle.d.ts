export function normalizeStorageValue(value: unknown): string | null;

export function syncReportingProjectionSeeds(
  database: unknown,
  readValue: (key: string) => string | null,
  options?: {
    safeParse?: (json: unknown, fallback: unknown) => unknown;
    writeProjectionValue?: (database: unknown, key: string, value: unknown, options?: unknown) => void;
    updatedAt?: string;
    source?: string;
  },
): void;

export function hydrateRuntimeStorageSnapshots(options?: {
  database?: unknown;
  readValue?: (key: string) => string | null;
  safeParse?: (json: unknown, fallback: unknown) => unknown;
  normalizeDeclRows?: (rows: unknown) => { normalizedRows: unknown[] };
  writeDeclarationRowsSnapshot?: (database: unknown, rows: unknown[], options?: unknown) => void;
  writeMstAssignmentRowsSnapshot?: (database: unknown, rows: unknown[], options?: unknown) => void;
  writeTeamRosterSnapshot?: (database: unknown, roster: unknown, options?: unknown) => void;
  writeRuleCollectionSnapshot?: (database: unknown, collection: unknown, options?: unknown) => void;
  loadRulesSnapshot?: () => Record<string, unknown> | null;
  persistRulesSnapshot?: (value: string, options?: unknown) => void;
  writeAdjustmentRowsSnapshot?: (database: unknown, rows: unknown[], options?: unknown) => void;
  writeProjectionValue?: (database: unknown, key: string, value: unknown, options?: unknown) => void;
  defaultRules?: unknown;
  seeded?: boolean;
  source?: string;
  updatedAt?: string;
  logger?: { warn(...args: unknown[]): void; [method: string]: ((...args: unknown[]) => void) | unknown };
}): void;

export interface RuntimeStorageLifecycleOptions {
  defaultStorage?: Record<string, string>;
  safeParse?: (json: unknown, fallback: unknown) => unknown;
  normalizeDeclRows?: (rows: unknown) => { normalizedRows: unknown[] };
  scheduleMstHistorySyncFromJson?: (jsonValue: string) => void;
  writeTeamRosterSnapshot?: (database: unknown, roster: unknown, options?: unknown) => void;
  deleteTeamRosterSnapshot?: (database: unknown) => void;
  writeDeclarationRowsSnapshot?: (database: unknown, rows: unknown[], options?: unknown) => void;
  deleteDeclarationRowsSnapshot?: (database: unknown) => void;
  writeMstAssignmentRowsSnapshot?: (database: unknown, rows: unknown[], options?: unknown) => void;
  deleteMstAssignmentRowsSnapshot?: (database: unknown) => void;
  writeRuleCollectionSnapshot?: (database: unknown, collection: unknown, options?: unknown) => void;
  persistRulesSnapshot?: (value: string, options?: unknown) => void;
  loadRulesSnapshot?: () => Record<string, unknown> | null;
  writeAdjustmentRowsSnapshot?: (database: unknown, rows: unknown[], options?: unknown) => void;
  deleteAdjustmentRowsSnapshot?: (database: unknown) => void;
  writeProjectionValue?: (database: unknown, key: string, value: unknown, options?: unknown) => void;
  refreshReportingAggregate?: (key: string, options?: unknown) => void;
  getRulesSeed?: (rules: unknown) => unknown;
  defaultRules?: unknown;
  aiChatHistoryPrefix?: string;
  listAccountsForClient?: () => unknown[];
  logger?: { warn(...args: unknown[]): void; [method: string]: ((...args: unknown[]) => void) | unknown };
  getDatabase?: () => unknown;
  database?: unknown;
}

export interface RuntimeStorageLifecycle {
  buildBootstrapSnapshot(options?: { keys?: string[] | null }): Record<string, string>;
  deleteValue(key: string, runtimeOptions?: { actor?: string; source?: string }): void;
  getJSONValue(key: string, fallback?: unknown): unknown;
  getValue(key: string): string | null;
  hydrateSqliteSnapshots(hydrateOptions?: Record<string, unknown>): void;
  readStorage(keys?: string[] | null): Record<string, string>;
  setJSONValue(key: string, value: unknown, runtimeOptions?: { actor?: string; source?: string }): void;
  upsertValue(key: string, value: unknown, runtimeOptions?: { actor?: string; source?: string; skipMstHistorySync?: boolean }): void;
}

export function createRuntimeStorageLifecycle(options?: RuntimeStorageLifecycleOptions): RuntimeStorageLifecycle;
