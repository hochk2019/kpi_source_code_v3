/**
 * Migration 010: Declaration Events schema.
 * Stores event-sourced declaration mutations.
 * declaration_id references declarations table.
 */
import { computeChecksum, type MigrationFile } from '../migrationEngine.js';

const up = `
CREATE TABLE IF NOT EXISTS declaration_events (
  id BIGSERIAL PRIMARY KEY,
  declaration_id TEXT NOT NULL REFERENCES declarations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_username TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_declaration_events_declaration_id_occurred_at
  ON declaration_events(declaration_id, occurred_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_declaration_events_event_type
  ON declaration_events(event_type);

CREATE INDEX IF NOT EXISTS idx_declaration_events_occurred_at
  ON declaration_events(occurred_at DESC);
`;

const down = `
DROP TABLE IF EXISTS declaration_events CASCADE;
`;

export const migration010: MigrationFile = {
  version: 10,
  name: 'declaration_events_schema',
  up: up.trim(),
  down: down.trim(),
  checksum: computeChecksum(up.trim()),
};
