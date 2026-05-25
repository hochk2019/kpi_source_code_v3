import type { AuthAccountRecord, AuthSessionRecord } from './authTypes.js';

export interface AuthStore {
  listAccounts(): Promise<AuthAccountRecord[]>;
  saveAccounts(accounts: readonly AuthAccountRecord[]): Promise<void>;
  readSession(token: string): Promise<AuthSessionRecord | null>;
  createSession(username: string): Promise<AuthSessionRecord>;
  deleteSession(token: string): Promise<void>;
  deleteSessionsForUser(username: string): Promise<void>;
  reset?(): void;
}
