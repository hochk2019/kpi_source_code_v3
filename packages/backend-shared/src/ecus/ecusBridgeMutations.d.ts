export interface EcusBridgeMutationOptions {
  getEcusConfig: () => Record<string, unknown>;
  computeRangeWindow: (config: Record<string, unknown>, rangeInput: unknown) => Record<string, unknown>;
  normalizeEcusTaxCodeList?: (value: unknown) => string[];
  buildEcusSyncContext?: (config: Record<string, unknown>) => Record<string, unknown>;
  shouldSkipByMst?: (row: unknown, includeSet: Set<string>, excludeSet: Set<string>) => boolean;
  mapEcusRow?: (row: unknown, config: Record<string, unknown>, context: Record<string, unknown>) => Record<string, unknown> | null;
  getDeclRows: () => Record<string, unknown>[];
  getDeclarationKey: (row: Record<string, unknown>) => string;
  mergeDeclarationRow?: (existing: Record<string, unknown>, incoming: Record<string, unknown>) => {
    row: Record<string, unknown>;
    changed: boolean;
    changedFields: string[];
    locked?: boolean;
  };
  writeDeclRows: (rows: Record<string, unknown>[]) => void;
  ensureMSTEntriesForDeclRows?: (rows: Record<string, unknown>[]) => void;
  pushAuditLog?: (entry: Record<string, unknown>) => void;
  evaluateDeclarationAlerts?: (rows: Record<string, unknown>[]) => unknown;
  pushImportLog?: (entry: Record<string, unknown>) => void;
  saveEcusConfig?: (config: Record<string, unknown>) => void;
  pushNotification?: (notification: Record<string, unknown>) => void;
  recordEcusMonitorSyncSuccess?: (entry: Record<string, unknown>) => void;
  recordEcusMonitorSyncFailure?: (error: unknown, context: Record<string, unknown>) => void;
  normalizeStr?: (value: unknown) => string;
}

export interface EcusBridgeSyncSummary {
  fetched: number;
  imported: number;
  updated: number;
  skipped: number;
  reviewLocked: number;
  runAt: string;
  actor: string;
  reason: string;
  range: Record<string, unknown>;
}

export interface EcusBridgePreviewResult {
  rows: Record<string, unknown>[];
  totalFetched: number;
  limited: boolean;
  range: Record<string, unknown>;
}

export interface EcusBridgeMutations {
  previewFetchedRows(
    rawRows: Record<string, unknown>[],
    options?: {
      rangeInput?: unknown;
      includeTaxCodes?: string[];
      excludeTaxCodes?: string[];
      limit?: number;
      [key: string]: unknown;
    },
  ): Promise<EcusBridgePreviewResult>;
  commitFetchedRows(
    rawRows: Record<string, unknown>[],
    options?: {
      rangeInput?: unknown;
      actor?: string;
      reason?: string;
      fetchedTotal?: number;
      includeTaxCodes?: string[];
      excludeTaxCodes?: string[];
      [key: string]: unknown;
    },
  ): Promise<EcusBridgeSyncSummary>;
}

export function createEcusBridgeMutations(options?: EcusBridgeMutationOptions): EcusBridgeMutations;
