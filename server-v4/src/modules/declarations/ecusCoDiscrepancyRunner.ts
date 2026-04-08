import { createRequire } from 'node:module';

import type { DeclarationAsyncReader } from './declarationAsyncReader.js';
import type { DeclarationImportRange } from './declarationsStore.js';
import { DeclarationsHttpError } from './declarationsService.js';
import {
  createDefaultEcusSyncConfig,
  normalizeEcusSyncConfig,
  normalizeEcusTaxCodeList,
  readLegacyEcusSyncConfig,
  type EcusSyncConfigDocument,
} from './ecusSyncConfig.js';

type SqlConnectionConfig = {
  server?: string;
  database?: string;
  [key: string]: unknown;
};

type SqlBridgeModule = {
  buildSqlConnectionConfig: (config: unknown) => SqlConnectionConfig;
  createSqlPoolManager: () => unknown;
};

type EcusBridgeModule = {
  createEcusBridgeService: (options: Record<string, unknown>) => {
    fetchDeclarations: (
      range: DeclarationImportRange,
      config: unknown,
      options: {
        includeTaxCodesSet: Set<string>;
        excludeTaxCodesSet: Set<string>;
      },
    ) => AsyncIterable<unknown[]>;
  };
};

const require = createRequire(import.meta.url);
const { createEcusBridgeService } = require('@kpi/backend-shared/ecus') as EcusBridgeModule;
const { buildSqlConnectionConfig, createSqlPoolManager } =
  require('../../../../apps/ecus-bridge/src/sqlBridge.js') as SqlBridgeModule;

const RUNNER_CONNECTION_DEFAULTS = Object.freeze({
  server: '',
  database: '',
  user: '',
  password: '',
});

export type CoDiscrepancyRunnerResult = {
  rawRows: unknown[];
  fetched: number;
  limited: boolean;
  range: DeclarationImportRange;
};

export type EcusFetchOptions = {
  limit?: number;
  includeTaxCodes?: string[];
  excludeTaxCodes?: string[];
};

export interface CoDiscrepancyRunner {
  fetch(range: DeclarationImportRange, options?: EcusFetchOptions): Promise<CoDiscrepancyRunnerResult>;
}

export type EcusImportRunner = CoDiscrepancyRunner;

export function createDefaultCoDiscrepancyRunner(
  reader: DeclarationAsyncReader | null | undefined,
): CoDiscrepancyRunner {
  const sqlPoolManager = createSqlPoolManager();
  const defaultSyncConfig = createDefaultEcusSyncConfig({
    connectionDefaults: RUNNER_CONNECTION_DEFAULTS,
  });
  let currentConfig = defaultSyncConfig;
  const bridgeService = createEcusBridgeService({
    getEcusConfig: () => currentConfig,
    sqlPoolManager,
    loadAccountRecords: () => [],
    persistAccountRecords: () => {},
    sortAccountRecords: (records: unknown[]) => records,
    normalizeAccountRecordForStorage: (record: unknown) => record ?? {},
    normalizeRoleKey: (role: unknown) => normalizeStr(role) || 'user',
    normalizePermissionsForRole: (permissions: unknown) => permissions ?? {},
    normalizeAccountUpdatedAt: (value: unknown) =>
      new Date(
        typeof value === 'string' || typeof value === 'number' || value instanceof Date
          ? value
          : Date.now(),
      ).toISOString(),
    toNullableString,
    normalizeMST,
    normalizeStr,
    toISODate,
    safeParse,
    getValue: () => null,
    upsertValue: () => {},
    normalizeRangeDate,
    defaultSyncConfig,
    logger: console,
  });

  return {
    async fetch(range, options = {}) {
      currentConfig = loadEcusSyncConfig(reader);
      const connectionConfig = buildSqlConnectionConfig(currentConfig);
      if (!connectionConfig.server || !connectionConfig.database) {
        throw new DeclarationsHttpError(
          400,
          'bad_request',
          'Chưa cấu hình kết nối SQL Server cho chức năng đối soát C/O.',
        );
      }

      const normalizedRange = normalizeRange(range, currentConfig.rangeDays);
      const limit = normalizeLimit(options.limit);
      const collectionLimit = limit > 0 ? limit + 1 : 0;
      const rawRows: unknown[] = [];
      let fetched = 0;
      let limited = false;
      const includeTaxCodes = Array.isArray(options.includeTaxCodes)
        ? options.includeTaxCodes
        : currentConfig.includeTaxCodes;
      const excludeTaxCodes = Array.isArray(options.excludeTaxCodes)
        ? options.excludeTaxCodes
        : currentConfig.excludeTaxCodes;
      const includeTaxCodesSet = new Set(normalizeEcusTaxCodeList(includeTaxCodes));
      const excludeTaxCodesSet = new Set(normalizeEcusTaxCodeList(excludeTaxCodes));

      outer: for await (const batch of bridgeService.fetchDeclarations(normalizedRange, currentConfig, {
        includeTaxCodesSet,
        excludeTaxCodesSet,
      })) {
        const rows = Array.isArray(batch) ? batch : [];
        for (const row of rows) {
          fetched += 1;
          rawRows.push(row);
          if (collectionLimit > 0 && rawRows.length >= collectionLimit) {
            limited = true;
            break outer;
          }
        }
      }

      return {
        rawRows: limited && limit > 0 ? rawRows.slice(0, limit) : rawRows,
        fetched,
        limited,
        range: normalizedRange,
      };
    },
  };
}

function loadEcusSyncConfig(reader: DeclarationAsyncReader | null | undefined): EcusSyncConfigDocument {
  const legacyDbFile =
    reader && typeof reader.getLegacyDbFile === 'function' ? reader.getLegacyDbFile() : null;
  return normalizeEcusSyncConfig(readLegacyEcusSyncConfig(legacyDbFile), {
    connectionDefaults: RUNNER_CONNECTION_DEFAULTS,
  });
}

function normalizeRange(
  range: DeclarationImportRange | null | undefined,
  defaultRangeDays = 1,
): DeclarationImportRange {
  const from = normalizeStr(range?.from);
  const to = normalizeStr(range?.to);
  if (from || to) {
    return { from, to };
  }

  const days = normalizePositiveInteger(defaultRangeDays, 1);
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    from: formatRangeDate(start),
    to: formatRangeDate(end),
  };
}

function formatRangeDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeLimit(value: unknown): number {
  return normalizePositiveInteger(value, 0);
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.floor(parsed));
}

function normalizeStr(value: unknown): string {
  return `${value ?? ''}`.trim();
}

function normalizeMST(value: unknown): string {
  return normalizeStr(value).replace(/\s+/gu, '');
}

function toNullableString(value: unknown): string | null {
  const normalized = normalizeStr(value);
  return normalized || null;
}

function toISODate(value: unknown): string {
  if (!value) {
    return '';
  }

  const date = new Date(`${value}`);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function normalizeRangeDate(value: unknown, options: { isEnd?: boolean } = {}): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (options.isEnd) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
