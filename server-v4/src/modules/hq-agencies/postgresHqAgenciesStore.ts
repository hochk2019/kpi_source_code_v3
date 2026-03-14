import { randomUUID } from 'node:crypto';

import type { Pool } from 'pg';

import {
  cloneHqBindingDocument,
  cloneHqHistoryMutationEntries,
  type HqAgencyBindingDocument,
  type HqAgencyHistoryMutationEntry,
  type HqAgenciesStore,
} from './hqAgenciesStore.js';
import { stripDiacritics } from '../../legacy/legacy-normalizers.js';

type PoolLike = Pick<Pool, 'query'>;

type BindingIdentityRow = {
  id?: unknown;
};

const CREATE_BINDINGS_TABLE_SQL =
  'CREATE TABLE IF NOT EXISTS tax_code_agency_bindings (' +
  'id UUID PRIMARY KEY, ' +
  'tax_code TEXT UNIQUE NOT NULL, ' +
  "company_name TEXT NOT NULL DEFAULT '', " +
  'updated_at TIMESTAMPTZ NOT NULL, ' +
  'updated_by_account_id UUID NULL' +
  ')';

const CREATE_AGENTS_TABLE_SQL =
  'CREATE TABLE IF NOT EXISTS tax_code_agency_binding_agents (' +
  'id BIGSERIAL PRIMARY KEY, ' +
  'binding_id UUID NOT NULL REFERENCES tax_code_agency_bindings(id) ON DELETE CASCADE, ' +
  'agent_order SMALLINT NOT NULL, ' +
  'agent_name TEXT NOT NULL, ' +
  'agent_name_normalized TEXT NOT NULL' +
  ')';

const CREATE_AGENTS_UNIQUE_INDEX_SQL =
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_code_agency_binding_agents_unique ' +
  'ON tax_code_agency_binding_agents(binding_id, agent_name_normalized)';

const CREATE_AGENTS_NAME_INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS idx_tax_code_agency_binding_agents_name ' +
  'ON tax_code_agency_binding_agents(agent_name_normalized)';

const CREATE_EVENTS_TABLE_SQL =
  'CREATE TABLE IF NOT EXISTS tax_code_agency_binding_events (' +
  'id BIGSERIAL PRIMARY KEY, ' +
  'binding_id UUID NULL REFERENCES tax_code_agency_bindings(id) ON DELETE SET NULL, ' +
  'tax_code TEXT NOT NULL, ' +
  'event_type TEXT NOT NULL, ' +
  `payload JSONB NOT NULL DEFAULT '{}'::jsonb, ` +
  'actor_username TEXT NOT NULL, ' +
  'occurred_at TIMESTAMPTZ NOT NULL' +
  ')';

const CREATE_EVENTS_TAX_CODE_INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS idx_tax_code_agency_binding_events_tax_code_occurred_at ' +
  'ON tax_code_agency_binding_events(tax_code, occurred_at DESC, id DESC)';

const UPSERT_BINDING_SQL =
  'INSERT INTO tax_code_agency_bindings (id, tax_code, company_name, updated_at, updated_by_account_id) ' +
  'VALUES ($1::uuid, $2, $3, $4::timestamptz, $5::uuid) ' +
  'ON CONFLICT (tax_code) DO UPDATE SET ' +
  'company_name = EXCLUDED.company_name, ' +
  'updated_at = EXCLUDED.updated_at, ' +
  'updated_by_account_id = EXCLUDED.updated_by_account_id ' +
  'RETURNING id::text AS id';

const READ_BINDING_ID_SQL =
  'SELECT id::text AS id ' +
  'FROM tax_code_agency_bindings ' +
  'WHERE tax_code = $1';

const DELETE_BINDING_AGENTS_SQL =
  'DELETE FROM tax_code_agency_binding_agents ' +
  'WHERE binding_id = $1::uuid';

const INSERT_BINDING_AGENT_SQL =
  'INSERT INTO tax_code_agency_binding_agents (binding_id, agent_order, agent_name, agent_name_normalized) ' +
  'VALUES ($1::uuid, $2, $3, $4)';

const INSERT_BINDING_EVENT_SQL =
  'INSERT INTO tax_code_agency_binding_events (binding_id, tax_code, event_type, payload, actor_username, occurred_at) ' +
  'VALUES ($1::uuid, $2, $3, $4::jsonb, $5, $6::timestamptz)';

const DELETE_BINDING_SQL =
  'DELETE FROM tax_code_agency_bindings ' +
  'WHERE tax_code = $1';

export class PostgresHqAgenciesStore implements HqAgenciesStore {
  private initializationPromise: Promise<void> | null = null;

  constructor(private readonly pool: PoolLike) {}

  async upsertBinding(
    binding: HqAgencyBindingDocument,
    historyEntries: readonly HqAgencyHistoryMutationEntry[],
  ): Promise<HqAgencyBindingDocument> {
    const normalizedBinding = cloneHqBindingDocument(binding);
    const normalizedHistory = cloneHqHistoryMutationEntries(historyEntries);

    await this.ensureInitialized();
    await this.pool.query('BEGIN');

    try {
      const bindingIdResult = await this.pool.query<BindingIdentityRow>(UPSERT_BINDING_SQL, [
        randomUUID(),
        normalizedBinding.mst,
        normalizedBinding.company,
        normalizedBinding.updatedAt,
        null,
      ]);
      const bindingId = `${bindingIdResult.rows[0]?.id ?? ''}`.trim();

      await this.pool.query(DELETE_BINDING_AGENTS_SQL, [bindingId]);
      for (const [index, agentName] of normalizedBinding.agents.entries()) {
        await this.pool.query(INSERT_BINDING_AGENT_SQL, [
          bindingId,
          index,
          agentName,
          normalizeAgentName(agentName),
        ]);
      }

      for (const entry of normalizedHistory) {
        await this.pool.query(INSERT_BINDING_EVENT_SQL, [
          bindingId,
          normalizedBinding.mst,
          entry.type,
          JSON.stringify({
            field: entry.field,
            from: entry.from,
            to: entry.to,
          }),
          entry.actor,
          entry.timestamp,
        ]);
      }

      await this.pool.query('COMMIT');
      return cloneHqBindingDocument(normalizedBinding);
    } catch (error) {
      await this.pool.query('ROLLBACK');
      throw error;
    }
  }

  async deleteBinding(mst: string, historyEntries: readonly HqAgencyHistoryMutationEntry[]): Promise<void> {
    const normalizedHistory = cloneHqHistoryMutationEntries(historyEntries);

    await this.ensureInitialized();
    await this.pool.query('BEGIN');

    try {
      const bindingRow = await this.pool.query<BindingIdentityRow>(READ_BINDING_ID_SQL, [mst]);
      const bindingId = `${bindingRow.rows[0]?.id ?? ''}`.trim() || null;

      for (const entry of normalizedHistory) {
        await this.pool.query(INSERT_BINDING_EVENT_SQL, [
          bindingId,
          mst,
          entry.type,
          JSON.stringify({
            field: entry.field,
            from: entry.from,
            to: entry.to,
          }),
          entry.actor,
          entry.timestamp,
        ]);
      }

      await this.pool.query(DELETE_BINDING_SQL, [mst]);
      await this.pool.query('COMMIT');
    } catch (error) {
      await this.pool.query('ROLLBACK');
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = initializeHqAgenciesStorage(this.pool).catch((error) => {
        this.initializationPromise = null;
        throw error;
      });
    }

    await this.initializationPromise;
  }
}

async function initializeHqAgenciesStorage(pool: PoolLike): Promise<void> {
  await pool.query(CREATE_BINDINGS_TABLE_SQL);
  await pool.query(CREATE_AGENTS_TABLE_SQL);
  await pool.query(CREATE_AGENTS_UNIQUE_INDEX_SQL);
  await pool.query(CREATE_AGENTS_NAME_INDEX_SQL);
  await pool.query(CREATE_EVENTS_TABLE_SQL);
  await pool.query(CREATE_EVENTS_TAX_CODE_INDEX_SQL);
}

function normalizeAgentName(value: string): string {
  return stripDiacritics(value.trim()).toLowerCase();
}
