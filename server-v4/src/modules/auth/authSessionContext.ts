import type { Request } from 'express';

import type { AuthStore } from './authStore.js';
import { getSessionTokenFromRequest, toUsernameKey } from './authShared.js';
import type { AuthAccountRecord } from './authTypes.js';

export async function readSessionAccount(
  authStore: AuthStore | null | undefined,
  token: string,
): Promise<AuthAccountRecord | null> {
  if (!authStore) {
    return null;
  }

  const normalizedToken = `${token ?? ''}`.trim();
  if (!normalizedToken) {
    return null;
  }

  const session = await authStore.readSession(normalizedToken);
  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    await authStore.deleteSession(normalizedToken);
    return null;
  }

  const accounts = await authStore.listAccounts();
  const account = accounts.find((entry) => toUsernameKey(entry.username) === toUsernameKey(session.username)) ?? null;
  if (!account) {
    await authStore.deleteSession(normalizedToken);
    return null;
  }

  return account;
}

export function readSessionTokenFromRequest(req: Request): string {
  return getSessionTokenFromRequest(req);
}
