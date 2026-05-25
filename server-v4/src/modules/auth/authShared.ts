import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';

import { readBootstrapAccountPassword } from '@kpi/backend-shared/auth';
import {
  ACCOUNT_PERMISSION_KEYS,
  ADMIN_ROLE,
  DEFAULT_ROLE,
  MANAGER_ROLE,
  TEAM_LEAD_ROLE,
  getPermissionTemplate,
  isAdminRole,
  mergePermissions,
  normalizeRoleKey,
} from '../../../../packages/domain/src/accountRoles.js';
import type { AuthAccountRecord, AuthAccountView, AuthSessionRecord } from './authTypes.js';

const PASSWORD_SALT_ROUNDS = 10;
const DEFAULT_ACCOUNT_SEED_UPDATED_AT = '2024-01-01T00:00:00.000Z';

const DEFAULT_ACCOUNT_SEED = [
  {
    username: 'admin',
    role: ADMIN_ROLE,
    name: 'Quản trị viên',
    permissions: getPermissionTemplate(ADMIN_ROLE),
  },
  {
    username: 'nhanvien',
    role: DEFAULT_ROLE,
    name: 'Nhân viên',
    permissions: mergePermissions(DEFAULT_ROLE, { importEdit: true, importUpload: true }),
  },
  {
    username: 'lead.hoc',
    role: TEAM_LEAD_ROLE,
    name: 'Học',
    permissions: getPermissionTemplate(TEAM_LEAD_ROLE),
  },
  {
    username: 'lead.phuong',
    role: TEAM_LEAD_ROLE,
    name: 'Phương',
    permissions: getPermissionTemplate(TEAM_LEAD_ROLE),
  },
  {
    username: 'lead.tuan',
    role: TEAM_LEAD_ROLE,
    name: 'Tuấn',
    permissions: getPermissionTemplate(TEAM_LEAD_ROLE),
  },
  {
    username: 'manager.hoangkimhoa',
    role: MANAGER_ROLE,
    name: 'Hoàng Kim Hòa',
    permissions: getPermissionTemplate(MANAGER_ROLE),
  },
  {
    username: 'manager.thuyha',
    role: MANAGER_ROLE,
    name: 'Thúy Hà',
    permissions: getPermissionTemplate(MANAGER_ROLE),
  },
  {
    username: 'manager.hoainam',
    role: MANAGER_ROLE,
    name: 'Hoài Nam',
    permissions: getPermissionTemplate(MANAGER_ROLE),
  },
] as const;

export const MIN_PASSWORD_LENGTH = 8;
export const SESSION_COOKIE_NAME = 'kpi_session';
export const CSRF_COOKIE_NAME = 'kpi_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const AUTH_ACCOUNTS_STORAGE_KEY = 'kpi_users_v1';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

export function sanitizeAuthAccount(record: AuthAccountRecord | null | undefined): AuthAccountView | null {
  if (!record) {
    return null;
  }

  const role = normalizeRoleKey(record.role);

  return {
    username: normalizeUsername(record.username),
    role,
    name: normalizeDisplayName(record.name, record.username),
    permissions: mergePermissions(role, record.permissions),
    memberId: normalizeNullableText(record.memberId, 160),
    memberName: normalizeNullableText(record.memberName, 255),
    teamId: normalizeNullableText(record.teamId, 160),
    teamName: normalizeNullableText(record.teamName, 255),
  };
}

export function normalizeStoredAccountRecord(value: unknown): AuthAccountRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const username = normalizeUsername(record.username);
  if (!username) {
    return null;
  }

  let passwordHash = normalizeText(record.passwordHash);
  if (!passwordHash && record.password) {
    passwordHash = bcrypt.hashSync(`${record.password}`, PASSWORD_SALT_ROUNDS);
  }
  if (!passwordHash) {
    return null;
  }

  const role = normalizeRoleKey(record.role);

  return {
    username,
    passwordHash,
    role,
    name: normalizeDisplayName(record.name, username),
    permissions: mergePermissions(role, normalizePermissionOverrides(record.permissions)),
    updatedAt: normalizeUpdatedAt(record.updatedAt ?? record.updated_at),
    memberId: normalizeNullableText(record.memberId ?? record.member_id, 160),
    memberName: normalizeNullableText(record.memberName ?? record.member_name, 255),
    teamId: normalizeNullableText(record.teamId ?? record.team_id, 160),
    teamName: normalizeNullableText(record.teamName ?? record.team_name, 255),
  };
}

export function normalizeStoredAccounts(raw: unknown): {
  accounts: AuthAccountRecord[];
  mutated: boolean;
} {
  const records: AuthAccountRecord[] = [];
  const seen = new Set<string>();
  let mutated = false;

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const normalized = normalizeStoredAccountRecord(entry);
      if (!normalized) {
        mutated = true;
        continue;
      }

      const key = toUsernameKey(normalized.username);
      if (seen.has(key)) {
        mutated = true;
        continue;
      }

      seen.add(key);
      records.push(normalized);
    }
  }

  const hasAdminAccount = records.some((entry) => isAdminRole(entry.role));
  const defaults = buildDefaultAccounts({
    requireAdmin: records.length === 0 || !hasAdminAccount,
  });

  if (records.length === 0) {
    if (defaults.length > 0) {
      records.push(...defaults);
      mutated = true;
    }
  } else {
    for (const account of defaults) {
      if (!records.some((entry) => toUsernameKey(entry.username) === toUsernameKey(account.username))) {
        records.push(account);
        mutated = true;
      }
    }
  }

  sortAuthAccounts(records);
  return { accounts: records, mutated };
}

export function buildDefaultAccounts(options: { requireAdmin?: boolean } = {}): AuthAccountRecord[] {
  const accounts: AuthAccountRecord[] = [];

  for (const entry of DEFAULT_ACCOUNT_SEED) {
    const password = readBootstrapAccountPassword(entry.username);
    if (!password) {
      continue;
    }

    const role = normalizeRoleKey(entry.role);
    accounts.push({
      username: entry.username,
      passwordHash: bcrypt.hashSync(password, PASSWORD_SALT_ROUNDS),
      role,
      name: entry.name,
      permissions: mergePermissions(role, entry.permissions),
      updatedAt: DEFAULT_ACCOUNT_SEED_UPDATED_AT,
      memberId: null,
      memberName: null,
      teamId: null,
      teamName: null,
    });
  }

  if (options.requireAdmin && !accounts.some((entry) => isAdminRole(entry.role))) {
    throw new Error('KPI_BOOTSTRAP_ADMIN_PASSWORD is required to bootstrap the admin account.');
  }

  sortAuthAccounts(accounts);
  return accounts;
}

export function createSessionRecord(username: string, now = Date.now()): AuthSessionRecord {
  return {
    token: crypto.randomBytes(32).toString('base64url'),
    username: normalizeUsername(username),
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
}

export function getSessionTokenFromRequest(req: Request): string {
  const cookies = getRequestCookies(req);
  return cookies[SESSION_COOKIE_NAME] ?? '';
}

export function createCsrfToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export function getRequestCookies(req: Request): Record<string, string> {
  return parseCookies(req.headers?.cookie ?? '');
}

export function shouldUseSecureCookies(req: Request): boolean {
  const preference = `${process.env.KPI_COOKIE_SECURE ?? ''}`.trim().toLowerCase();
  if (['always', 'true', '1'].includes(preference)) {
    return true;
  }
  if (['never', 'false', '0'].includes(preference)) {
    return false;
  }

  const forwardedProto = req?.headers?.['x-forwarded-proto'];
  const proto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : typeof forwardedProto === 'string'
      ? forwardedProto.split(',')[0]
      : '';

  return Boolean(req?.secure) || proto.trim().toLowerCase() === 'https';
}

export function setCsrfCookie(
  req: Request,
  res: Response,
  token: string,
  expiresAt?: number,
): void {
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: shouldUseSecureCookies(req),
    ...(expiresAt !== undefined ? { expires: new Date(expiresAt) } : {}),
  });
}

export function setSessionCookie(req: Request, res: Response, token: string, expiresAt: number): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookies(req),
    expires: new Date(expiresAt),
  });
  const csrfToken = getRequestCookies(req)[CSRF_COOKIE_NAME] ?? createCsrfToken();
  setCsrfCookie(req, res, csrfToken, expiresAt);
}

export function clearSessionCookie(req: Request, res: Response): void {
  res.cookie(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookies(req),
    expires: new Date(0),
  });
  setCsrfCookie(req, res, '', 0);
}

export function normalizeUsername(value: unknown): string {
  return normalizeText(value);
}

export function normalizeDisplayName(value: unknown, fallback: string): string {
  return normalizeText(value) || normalizeUsername(fallback);
}

export function toUsernameKey(value: unknown): string {
  return normalizeUsername(value).toLowerCase();
}

export function sortAuthAccounts(accounts: AuthAccountRecord[]): void {
  accounts.sort((left, right) => left.username.localeCompare(right.username, 'en'));
}

export function normalizeNullableText(value: unknown, maxLength = 255): string | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, maxLength);
}

export function normalizeUpdatedAt(value: unknown): string {
  if (!value) {
    return DEFAULT_ACCOUNT_SEED_UPDATED_AT;
  }

  const date = value instanceof Date ? value : new Date(`${value}`);
  if (Number.isNaN(date.getTime())) {
    return DEFAULT_ACCOUNT_SEED_UPDATED_AT;
  }

  return date.toISOString();
}

export function normalizePermissionOverrides(value: unknown): Record<string, boolean> {
  const overrides = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const normalized: Record<string, boolean> = {};

  for (const key of ACCOUNT_PERMISSION_KEYS) {
    if (key === 'reportsExport') {
      normalized[key] = (overrides as Record<string, unknown>)[key] !== false;
      continue;
    }
    normalized[key] = (overrides as Record<string, unknown>)[key] === true;
  }

  return normalized;
}

function parseCookies(headerValue: string): Record<string, string> {
  const header = typeof headerValue === 'string' ? headerValue : '';
  const entries = header.split(';');
  const cookies: Record<string, string> = {};

  for (const entry of entries) {
    const index = entry.indexOf('=');
    if (index <= 0) {
      continue;
    }
    const key = entry.slice(0, index).trim();
    if (!key) {
      continue;
    }
    const value = entry.slice(index + 1).trim();
    cookies[key] = decodeCookieValue(value);
  }

  return cookies;
}

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeText(value: unknown): string {
  return `${value ?? ''}`.trim();
}
