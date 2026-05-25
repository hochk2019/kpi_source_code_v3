import type { Pool } from 'pg';

import type { AuthStore } from './authStore.js';
import type { AuthAccountRecord, AuthSessionRecord } from './authTypes.js';
import {
  createSessionRecord,
  normalizePermissionOverrides,
  normalizeStoredAccountRecord,
  normalizeStoredAccounts,
  sortAuthAccounts,
} from './authShared.js';

type PoolLike = Pick<Pool, 'query'>;

type AuthAccountRow = {
  username?: unknown;
  password_hash?: unknown;
  role?: unknown;
  display_name?: unknown;
  permissions_override?: unknown;
  updated_at?: unknown;
  member_id?: unknown;
  member_name?: unknown;
  team_id?: unknown;
  team_name?: unknown;
};

type AuthSessionRow = {
  session_token?: unknown;
  username?: unknown;
  created_at?: unknown;
  expires_at?: unknown;
};

const CREATE_AUTH_ACCOUNTS_TABLE_SQL =
  'CREATE TABLE IF NOT EXISTS auth_accounts (' +
  'username TEXT PRIMARY KEY, ' +
  'password_hash TEXT NOT NULL, ' +
  'role TEXT NOT NULL, ' +
  'display_name TEXT NOT NULL, ' +
  "permissions_override JSONB NOT NULL DEFAULT '{}'::jsonb, " +
  'member_id TEXT NULL, ' +
  'member_name TEXT NULL, ' +
  'team_id TEXT NULL, ' +
  'team_name TEXT NULL, ' +
  "status TEXT NOT NULL DEFAULT 'active', " +
  'updated_at TEXT NOT NULL' +
  ')';

const CREATE_AUTH_SESSIONS_TABLE_SQL =
  'CREATE TABLE IF NOT EXISTS auth_sessions (' +
  'session_token TEXT PRIMARY KEY, ' +
  'username TEXT NOT NULL REFERENCES auth_accounts(username) ON DELETE CASCADE, ' +
  'created_at BIGINT NOT NULL, ' +
  'expires_at BIGINT NOT NULL' +
  ')';

const CREATE_AUTH_SESSION_USERNAME_INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS idx_auth_sessions_username ON auth_sessions(username)';

const CREATE_AUTH_SESSION_EXPIRY_INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at)';

const READ_AUTH_ACCOUNTS_SQL =
  'SELECT username, password_hash, role, display_name, permissions_override, updated_at, member_id, member_name, team_id, team_name ' +
  'FROM auth_accounts ' +
  "WHERE status = 'active' " +
  'ORDER BY username ASC';

const UPSERT_AUTH_ACCOUNT_SQL =
  'INSERT INTO auth_accounts ' +
  '(username, password_hash, role, display_name, permissions_override, updated_at, member_id, member_name, team_id, team_name, status) ' +
  "VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, 'active') " +
  'ON CONFLICT (username) DO UPDATE SET ' +
  'password_hash = EXCLUDED.password_hash, ' +
  'role = EXCLUDED.role, ' +
  'display_name = EXCLUDED.display_name, ' +
  'permissions_override = EXCLUDED.permissions_override, ' +
  'updated_at = EXCLUDED.updated_at, ' +
  'member_id = EXCLUDED.member_id, ' +
  'member_name = EXCLUDED.member_name, ' +
  'team_id = EXCLUDED.team_id, ' +
  'team_name = EXCLUDED.team_name, ' +
  "status = 'active'";

const READ_AUTH_SESSION_SQL =
  'SELECT session_token, username, created_at, expires_at ' +
  'FROM auth_sessions ' +
  'WHERE session_token = $1';

const PRUNE_AUTH_SESSIONS_SQL = 'DELETE FROM auth_sessions WHERE expires_at <= $1';
const INSERT_AUTH_SESSION_SQL =
  'INSERT INTO auth_sessions (session_token, username, created_at, expires_at) VALUES ($1, $2, $3, $4)';
const DELETE_AUTH_SESSION_SQL = 'DELETE FROM auth_sessions WHERE session_token = $1';
const DELETE_AUTH_SESSIONS_FOR_USER_SQL = 'DELETE FROM auth_sessions WHERE username = $1';

export class PostgresAuthStore implements AuthStore {
  private initializationPromise: Promise<void> | null = null;

  constructor(private readonly pool: PoolLike) {}

  async listAccounts(): Promise<AuthAccountRecord[]> {
    await this.ensureInitialized();
    const result = await this.pool.query<AuthAccountRow>(READ_AUTH_ACCOUNTS_SQL);
    const { accounts, mutated } = normalizeStoredAccounts(
      result.rows.map((row) => ({
        username: row.username,
        passwordHash: row.password_hash,
        role: row.role,
        name: row.display_name,
        permissions: normalizePermissionOverrides(row.permissions_override),
        updatedAt: row.updated_at,
        memberId: row.member_id,
        memberName: row.member_name,
        teamId: row.team_id,
        teamName: row.team_name,
      })),
    );

    if (mutated) {
      await this.saveAccounts(accounts);
    }

    return accounts;
  }

  async saveAccounts(accounts: readonly AuthAccountRecord[]): Promise<void> {
    await this.ensureInitialized();
    const normalized = Array.from(accounts)
      .map((entry) => normalizeStoredAccountRecord(entry))
      .filter((entry): entry is AuthAccountRecord => Boolean(entry));
    sortAuthAccounts(normalized);

    for (const account of normalized) {
      await this.pool.query(UPSERT_AUTH_ACCOUNT_SQL, [
        account.username,
        account.passwordHash,
        account.role,
        account.name,
        JSON.stringify(account.permissions),
        account.updatedAt,
        account.memberId,
        account.memberName,
        account.teamId,
        account.teamName,
      ]);
    }
  }

  async readSession(token: string): Promise<AuthSessionRecord | null> {
    const normalizedToken = `${token ?? ''}`.trim();
    if (!normalizedToken) {
      return null;
    }

    await this.ensureInitialized();
    const result = await this.pool.query<AuthSessionRow>(READ_AUTH_SESSION_SQL, [normalizedToken]);
    return normalizeSessionRow(result.rows[0]);
  }

  async createSession(username: string): Promise<AuthSessionRecord> {
    await this.ensureInitialized();
    const session = createSessionRecord(username);

    await this.pool.query(PRUNE_AUTH_SESSIONS_SQL, [Date.now()]);
    await this.pool.query(INSERT_AUTH_SESSION_SQL, [
      session.token,
      session.username,
      session.createdAt,
      session.expiresAt,
    ]);

    return session;
  }

  async deleteSession(token: string): Promise<void> {
    const normalizedToken = `${token ?? ''}`.trim();
    if (!normalizedToken) {
      return;
    }

    await this.ensureInitialized();
    await this.pool.query(DELETE_AUTH_SESSION_SQL, [normalizedToken]);
  }

  async deleteSessionsForUser(username: string): Promise<void> {
    const normalizedUsername = `${username ?? ''}`.trim();
    if (!normalizedUsername) {
      return;
    }

    await this.ensureInitialized();
    await this.pool.query(DELETE_AUTH_SESSIONS_FOR_USER_SQL, [normalizedUsername]);
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = initializeAuthStorage(this.pool).catch((error) => {
        this.initializationPromise = null;
        throw error;
      });
    }

    await this.initializationPromise;
  }
}

async function initializeAuthStorage(pool: PoolLike): Promise<void> {
  await pool.query(CREATE_AUTH_ACCOUNTS_TABLE_SQL);
  await pool.query(CREATE_AUTH_SESSIONS_TABLE_SQL);
  await pool.query(CREATE_AUTH_SESSION_USERNAME_INDEX_SQL);
  await pool.query(CREATE_AUTH_SESSION_EXPIRY_INDEX_SQL);
}

function normalizeSessionRow(row: AuthSessionRow | undefined): AuthSessionRecord | null {
  if (!row) {
    return null;
  }

  const token = `${row.session_token ?? ''}`.trim();
  const username = `${row.username ?? ''}`.trim();
  const createdAt = normalizeTimestamp(row.created_at);
  const expiresAt = normalizeTimestamp(row.expires_at);

  if (!token || !username || createdAt === null || expiresAt === null) {
    return null;
  }

  return {
    token,
    username,
    createdAt,
    expiresAt,
  };
}

function normalizeTimestamp(value: unknown): number | null {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? Math.trunc(normalized) : null;
}
