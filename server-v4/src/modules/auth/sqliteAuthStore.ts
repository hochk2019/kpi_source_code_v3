import Database from 'better-sqlite3';
import { ensureSqliteAuthTables } from '../../../../server/sqliteMigrations.js';

import type { AuthStore } from './authStore.js';
import type { AuthAccountRecord, AuthSessionRecord } from './authTypes.js';
import {
  AUTH_ACCOUNTS_STORAGE_KEY,
  createSessionRecord,
  normalizeStoredAccountRecord,
  normalizeStoredAccounts,
  sortAuthAccounts,
} from './authShared.js';

type SqliteSessionRow = {
  token?: unknown;
  username?: unknown;
  created_at?: unknown;
  expires_at?: unknown;
};

type KvRow = {
  value?: unknown;
};

export class SqliteAuthStore implements AuthStore {
  private database: Database | null = null;

  constructor(private readonly dbFile: string) {}

  async listAccounts(): Promise<AuthAccountRecord[]> {
    const db = this.getDatabase();
    const row = db
      .prepare('SELECT value FROM kv_store WHERE key = ?')
      .get(AUTH_ACCOUNTS_STORAGE_KEY) as KvRow | undefined;
    const raw = typeof row?.value === 'string' ? safeParse(row.value, []) : [];
    const { accounts, mutated } = normalizeStoredAccounts(raw);

    if (mutated) {
      await this.saveAccounts(accounts);
    }

    return accounts;
  }

  async saveAccounts(accounts: readonly AuthAccountRecord[]): Promise<void> {
    const db = this.getDatabase();
    const normalized = Array.from(accounts)
      .map((entry) => normalizeStoredAccountRecord(entry))
      .filter((entry): entry is AuthAccountRecord => Boolean(entry));
    sortAuthAccounts(normalized);

    db.prepare(
      'INSERT INTO kv_store (key, value) VALUES (?, ?) ' +
        'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    ).run(AUTH_ACCOUNTS_STORAGE_KEY, JSON.stringify(normalized));
  }

  async readSession(token: string): Promise<AuthSessionRecord | null> {
    const normalizedToken = `${token ?? ''}`.trim();
    if (!normalizedToken) {
      return null;
    }

    const row = this.getDatabase()
      .prepare('SELECT token, username, created_at, expires_at FROM auth_sessions WHERE token = ?')
      .get(normalizedToken) as SqliteSessionRow | undefined;

    return normalizeSessionRow(row);
  }

  async createSession(username: string): Promise<AuthSessionRecord> {
    const db = this.getDatabase();
    const session = createSessionRecord(username);

    db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(Date.now());
    db.prepare(
      'INSERT INTO auth_sessions (token, username, created_at, expires_at) VALUES (?, ?, ?, ?)',
    ).run(session.token, session.username, session.createdAt, session.expiresAt);

    return session;
  }

  async deleteSession(token: string): Promise<void> {
    const normalizedToken = `${token ?? ''}`.trim();
    if (!normalizedToken) {
      return;
    }

    this.getDatabase().prepare('DELETE FROM auth_sessions WHERE token = ?').run(normalizedToken);
  }

  async deleteSessionsForUser(username: string): Promise<void> {
    const normalizedUsername = `${username ?? ''}`.trim();
    if (!normalizedUsername) {
      return;
    }

    this.getDatabase()
      .prepare('DELETE FROM auth_sessions WHERE username = ?')
      .run(normalizedUsername);
  }

  private getDatabase(): Database {
    if (!this.database) {
      this.database = new Database(this.dbFile);
      ensureSqliteAuthTables(this.database);
    }

    return this.database;
  }
}

function normalizeSessionRow(row: SqliteSessionRow | undefined): AuthSessionRecord | null {
  if (!row) {
    return null;
  }

  const token = `${row.token ?? ''}`.trim();
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

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
