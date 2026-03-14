import type { Pool } from 'pg';

import type { BusinessSnapshotSourceKind } from '../../persistence/businessSnapshotReader.js';
import type { KpiRulesAsyncReader } from './kpiRulesAsyncReader.js';

type PoolLike = Pick<Pool, 'query'>;

type KpiRuleSetRow = {
  id?: unknown;
  name?: unknown;
  rules_jsonb?: unknown;
  is_active?: unknown;
  created_at?: unknown;
  activated_at?: unknown;
};

type RuleSetProjection = {
  isActive: boolean;
  ruleSet: Record<string, unknown>;
};

const READ_KPI_RULE_SETS_SQL =
  'SELECT id::text AS id, name, rules_jsonb, is_active, created_at, activated_at ' +
  'FROM kpi_rule_sets ' +
  'ORDER BY version_no ASC, created_at ASC';

export class PostgresKpiRulesAsyncReader implements KpiRulesAsyncReader {
  private readonly sourceKind: Extract<BusinessSnapshotSourceKind, 'dual-write' | 'relational-store'>;

  constructor(
    private readonly fallbackReader: KpiRulesAsyncReader,
    private readonly pool: PoolLike,
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
    return this.fallbackReader.getHotPathKeys();
  }

  getLegacyDbFile(): string | null {
    return this.fallbackReader.getLegacyDbFile();
  }

  async readRuleCollection(): Promise<unknown> {
    try {
      const result = await this.pool.query<KpiRuleSetRow>(READ_KPI_RULE_SETS_SQL);
      const collection = buildRuleCollection(result.rows);
      if (collection) {
        return collection;
      }
    } catch {
      // Fall back to the SQLite compatibility reader while Postgres rule-set materialization is incomplete.
    }

    return this.fallbackReader.readRuleCollection();
  }
}

function buildRuleCollection(rows: KpiRuleSetRow[] | undefined) {
  const mappedRows = (Array.isArray(rows) ? rows : [])
    .map((row, index) => toRuleSetProjection(row, index))
    .filter((entry): entry is RuleSetProjection => Boolean(entry));

  if (!mappedRows.length) {
    return null;
  }

  return {
    version: 2,
    activeId:
      mappedRows.find((entry) => entry.isActive)?.ruleSet.id ??
      mappedRows[mappedRows.length - 1]?.ruleSet.id ??
      '',
    sets: mappedRows.map((entry) => entry.ruleSet),
  };
}

function toRuleSetProjection(row: KpiRuleSetRow, index: number): RuleSetProjection | null {
  const payload = extractRuleSetPayload(parseRecord(row?.rules_jsonb));
  const id = normalizeText(payload?.id ?? row?.id) || `rule-${index + 1}`;
  const name = normalizeText(payload?.name ?? row?.name) || `Rule Set ${index + 1}`;
  const applyFrom = normalizeTimestamp(payload?.applyFrom ?? row?.activated_at);
  const updatedAt =
    normalizeTimestamp(payload?.updatedAt ?? row?.activated_at ?? row?.created_at) ||
    normalizeTimestamp(payload?.applyFrom ?? row?.activated_at ?? row?.created_at);

  return {
    isActive: toBoolean(row?.is_active),
    ruleSet: {
      ...(payload ?? {}),
      id,
      name,
      applyFrom,
      updatedAt,
    },
  };
}

function extractRuleSetPayload(value: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value.sets)) {
    const activeId = normalizeText(value.activeId);
    const matchingEntry = value.sets.find((entry) => {
      return isRecord(entry) && (!activeId || normalizeText(entry.id) === activeId);
    });
    return isRecord(matchingEntry) ? matchingEntry : null;
  }

  return value;
}

function parseRecord(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTimestamp(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    return '';
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 't';
  }

  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
