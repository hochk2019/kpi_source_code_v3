import { randomUUID } from 'node:crypto';

import type { Pool } from 'pg';

import type { KpiRuleCollection, KpiRuleSet } from './kpiRuleDefaults.js';
import { cloneKpiRuleCollection, type KpiRulesStore } from './kpiRulesStore.js';

type PoolLike = Pick<Pool, 'query'>;

const CREATE_KPI_RULE_SETS_TABLE_SQL =
  'CREATE TABLE IF NOT EXISTS kpi_rule_sets (' +
  'id UUID PRIMARY KEY, ' +
  'version_no BIGINT UNIQUE NOT NULL, ' +
  'name TEXT NOT NULL, ' +
  `rules_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb, ` +
  'is_active BOOLEAN NOT NULL DEFAULT FALSE, ' +
  'created_at TIMESTAMPTZ NOT NULL, ' +
  'created_by_account_id UUID NULL, ' +
  'activated_at TIMESTAMPTZ NULL, ' +
  'activated_by_account_id UUID NULL' +
  ')';

const CLEAR_RULE_SET_ROWS_SQL = 'DELETE FROM kpi_rule_sets';

const INSERT_RULE_SET_SQL =
  'INSERT INTO kpi_rule_sets (' +
  'id, version_no, name, rules_jsonb, is_active, created_at, created_by_account_id, activated_at, activated_by_account_id' +
  ') VALUES (' +
  '$1::uuid, $2, $3, $4::jsonb, $5, $6::timestamptz, $7::uuid, $8::timestamptz, $9::uuid' +
  ')';

export class PostgresKpiRulesStore implements KpiRulesStore {
  private initializationPromise: Promise<void> | null = null;

  constructor(private readonly pool: PoolLike) {}

  async writeRuleCollection(collection: KpiRuleCollection): Promise<KpiRuleCollection> {
    const normalized = cloneKpiRuleCollection(collection);
    await this.ensureInitialized();
    await this.pool.query(CLEAR_RULE_SET_ROWS_SQL);

    for (const [index, ruleSet] of normalized.sets.entries()) {
      await this.pool.query(INSERT_RULE_SET_SQL, toInsertParams(ruleSet, index, normalized.activeId));
    }

    return cloneKpiRuleCollection(normalized);
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = this.pool.query(CREATE_KPI_RULE_SETS_TABLE_SQL).then(() => undefined).catch((error) => {
        this.initializationPromise = null;
        throw error;
      });
    }

    await this.initializationPromise;
  }
}

function toInsertParams(ruleSet: KpiRuleSet, index: number, activeId: string): unknown[] {
  const isActive = ruleSet.id === activeId;
  const createdAt = normalizeTimestamp(ruleSet.updatedAt) ?? new Date().toISOString();
  const activatedAt = isActive ? normalizeTimestamp(ruleSet.applyFrom) ?? createdAt : null;

  return [
    randomUUID(),
    index + 1,
    ruleSet.name,
    JSON.stringify(ruleSet),
    isActive,
    createdAt,
    null,
    activatedAt,
    null,
  ];
}

function normalizeTimestamp(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
