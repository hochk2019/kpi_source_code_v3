/**
 * Migration 003: Auth schema — auth_accounts, auth_sessions.
 * auth_sessions FK → auth_accounts.
 */
import { computeChecksum, type MigrationFile } from '../migrationEngine.js';

const up = `
CREATE TABLE IF NOT EXISTS auth_accounts (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  display_name TEXT NOT NULL,
  permissions_override JSONB NOT NULL DEFAULT '{}'::jsonb,
  member_id TEXT NULL,
  member_name TEXT NULL,
  team_id TEXT NULL,
  team_name TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_auth_accounts_updated_at
  BEFORE UPDATE ON auth_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_auth_accounts_status
  ON auth_accounts(status);

CREATE TABLE IF NOT EXISTS auth_sessions (
  session_token TEXT PRIMARY KEY,
  username TEXT NOT NULL REFERENCES auth_accounts(username) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_username
  ON auth_sessions(username);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
  ON auth_sessions(expires_at);
`;

const down = `
DROP TABLE IF EXISTS auth_sessions CASCADE;
DROP TRIGGER IF EXISTS trg_auth_accounts_updated_at ON auth_accounts;
DROP TABLE IF EXISTS auth_accounts CASCADE;
`;

export const migration003: MigrationFile = {
  version: 3,
  name: 'auth_schema',
  up: up.trim(),
  down: down.trim(),
  checksum: computeChecksum(up.trim()),
};
