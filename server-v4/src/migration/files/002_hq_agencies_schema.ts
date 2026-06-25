/**
 * Migration 002: HQ Agencies schema — tax_code_agency_bindings, binding_agents, binding_events.
 * This is a root entity (no FK to other domain tables).
 */
import { computeChecksum, type MigrationFile } from '../migrationEngine.js';

const up = `
CREATE TABLE IF NOT EXISTS tax_code_agency_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_code TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_account_id UUID NULL
);

CREATE TRIGGER trg_tax_code_agency_bindings_updated_at
  BEFORE UPDATE ON tax_code_agency_bindings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_tax_code_agency_bindings_tax_code
  ON tax_code_agency_bindings(tax_code);

CREATE TABLE IF NOT EXISTS tax_code_agency_binding_agents (
  id BIGSERIAL PRIMARY KEY,
  binding_id UUID NOT NULL REFERENCES tax_code_agency_bindings(id) ON DELETE CASCADE,
  agent_order SMALLINT NOT NULL,
  agent_name TEXT NOT NULL,
  agent_name_normalized TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_tax_code_agency_binding_agents_updated_at
  BEFORE UPDATE ON tax_code_agency_binding_agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_code_agency_binding_agents_unique
  ON tax_code_agency_binding_agents(binding_id, agent_name_normalized);

CREATE INDEX IF NOT EXISTS idx_tax_code_agency_binding_agents_name
  ON tax_code_agency_binding_agents(agent_name_normalized);

CREATE TABLE IF NOT EXISTS tax_code_agency_binding_events (
  id BIGSERIAL PRIMARY KEY,
  binding_id UUID NULL REFERENCES tax_code_agency_bindings(id) ON DELETE SET NULL,
  tax_code TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_username TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_code_agency_binding_events_tax_code_occurred_at
  ON tax_code_agency_binding_events(tax_code, occurred_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_tax_code_agency_binding_events_binding_id
  ON tax_code_agency_binding_events(binding_id);
`;

const down = `
DROP TABLE IF EXISTS tax_code_agency_binding_events CASCADE;
DROP TABLE IF EXISTS tax_code_agency_binding_agents CASCADE;
DROP TRIGGER IF EXISTS trg_tax_code_agency_bindings_updated_at ON tax_code_agency_bindings;
DROP TABLE IF EXISTS tax_code_agency_bindings CASCADE;
`;

export const migration002: MigrationFile = {
  version: 2,
  name: 'hq_agencies_schema',
  up: up.trim(),
  down: down.trim(),
  checksum: computeChecksum(up.trim()),
};
