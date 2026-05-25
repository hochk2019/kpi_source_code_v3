export interface EcusBridgeServiceOptions {
  getEcusConfig: () => Record<string, unknown>;
  sqlPoolManager: { getPool(config: unknown): Promise<unknown> };
  loadAccountRecords: () => Record<string, unknown>[];
  persistAccountRecords: (records: Record<string, unknown>[], options?: unknown) => void;
  sortAccountRecords: (records: Record<string, unknown>[]) => void;
  normalizeAccountRecordForStorage: (record: Record<string, unknown>) => Record<string, unknown> | null;
  normalizeRoleKey: (value: unknown) => string;
  normalizePermissionsForRole: (permissions: unknown, role: string) => Record<string, unknown>;
  normalizeAccountUpdatedAt: (value: unknown) => string;
  toNullableString: (value: unknown, options?: { maxLength?: number }) => string | null;
  normalizeMST: (value: unknown) => string;
  normalizeStr: (value: unknown) => string;
  toISODate: (value: unknown) => string;
  safeParse: (value: unknown, fallback: unknown) => unknown;
  getValue: (key: string) => string | null;
  upsertValue: (key: string, value: string, options?: unknown) => void;
  normalizeRangeDate: (value: unknown, options?: { isEnd?: boolean }) => Date | null;
  recordSqlTimeout?: (error: unknown) => void;
  isSqlTimeoutError?: (error: unknown) => boolean;
  logger?: { error(...args: unknown[]): void; [method: string]: ((...args: unknown[]) => void) | unknown };
  buildConnectionConfig?: (config: unknown) => Record<string, unknown>;
  resolvePaginationCapabilities?: (pool: unknown, config: unknown, timeout: number) => Promise<Record<string, unknown>>;
  requestTimeoutDefault?: number;
  defaultSyncConfig?: Record<string, unknown>;
  mstHistoryTableName?: string;
  accountSyncTableName?: string;
  mstHistoryMaxEntries?: number;
  accountSyncMinIntervalMs?: number;
}

export interface EcusBridgeService {
  getConnectionSummary(config?: Record<string, unknown>): { server: string | null; database: string | null };
  hasConfiguredConnection(config?: Record<string, unknown>): boolean;
  hasMstHistorySqlConfig(): boolean;
  scheduleMstHistorySyncFromJson(jsonValue: string): Promise<void>;
  maybeSyncMstHistoryFromSql(): Promise<void>;
  scheduleAccountSync(records: Record<string, unknown>[]): Promise<void>;
  waitForAccountSyncIdle(): Promise<void>;
  maybeSyncAccountsFromSql(options?: { force?: boolean }): Promise<boolean>;
  resetAccountSyncState(): void;
  fetchDeclarations(
    range: { from: unknown; to: unknown },
    config: Record<string, unknown>,
    options?: {
      includeTaxCodesSet?: Set<string>;
      excludeTaxCodesSet?: Set<string>;
      [key: string]: unknown;
    },
  ): AsyncGenerator<Record<string, unknown>[]>;
  checkSqlServerHealth(): Promise<{
    ok: boolean;
    state: string;
    message?: string;
    server?: string;
    database?: string;
    code?: string | null;
    number?: string | null;
    checkedAt: string;
  }>;
}

export function createEcusBridgeService(options: EcusBridgeServiceOptions): EcusBridgeService;
