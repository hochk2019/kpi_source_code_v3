import { type Response } from 'express';
import { z, ZodError } from 'zod';

import type { RuntimePersistence } from '../../persistence/runtimePersistence.js';
import { createDefaultKpiRuleCollection } from '../../modules/kpi-rules/kpiRuleDefaults.js';
import { createEmptyTeamRoster } from '../../modules/teams/teamRosterDocument.js';
import { AuthHttpError, AuthService } from '../../modules/auth/authService.js';
import type { AuthAccountView } from '../../modules/auth/authTypes.js';
import { sanitizeAuthAccount, toUsernameKey } from '../../modules/auth/authShared.js';

const AUTH_ACCOUNTS_STORAGE_KEY = 'kpi_users_v1';
const DECLARATION_ROWS_STORAGE_KEY = 'decl_rows_v1';
const MST_ASSIGNMENTS_STORAGE_KEY = 'mst_rows_v2';
const MST_HISTORY_STORAGE_KEY = 'mst_history_v1';
const DECLARATION_HISTORY_STORAGE_KEY = 'decl_history_v1';
const KPI_RULES_STORAGE_KEY = 'kpi_rules_v2';
const TEAM_ROSTER_STORAGE_KEY = 'team_roster_v1';
const AUDIT_LOGS_STORAGE_KEY = 'audit_logs_v1';
const IMPORT_LOGS_STORAGE_KEY = 'import_logs_v1';
const HQ_AGENCIES_STORAGE_KEY = 'hq_agencies_v1';
const HQ_HISTORY_STORAGE_KEY = 'hq_history_v1';
const KPI_ADJUSTMENTS_STORAGE_KEY = 'kpi_adjustments_v1';
const KPI_ADJUSTMENT_SETTINGS_STORAGE_KEY = 'kpi_adjustment_settings_v1';
const KPI_REPORT_SCHEDULE_STORAGE_KEY = 'kpi_report_schedule_v1';
const COMMAND_CENTER_PINS_STORAGE_KEY = 'kpi_command_center_pins_v1';
const UI_LAYOUT_STORAGE_KEY = 'ui_layout_config_v1';
const LEGACY_BOOTSTRAP_STORAGE_KEYS = [
  AUTH_ACCOUNTS_STORAGE_KEY,
  DECLARATION_ROWS_STORAGE_KEY,
  MST_ASSIGNMENTS_STORAGE_KEY,
  MST_HISTORY_STORAGE_KEY,
  DECLARATION_HISTORY_STORAGE_KEY,
  KPI_RULES_STORAGE_KEY,
  TEAM_ROSTER_STORAGE_KEY,
  AUDIT_LOGS_STORAGE_KEY,
  IMPORT_LOGS_STORAGE_KEY,
  HQ_AGENCIES_STORAGE_KEY,
  HQ_HISTORY_STORAGE_KEY,
  KPI_ADJUSTMENTS_STORAGE_KEY,
  KPI_ADJUSTMENT_SETTINGS_STORAGE_KEY,
  KPI_REPORT_SCHEDULE_STORAGE_KEY,
  COMMAND_CENTER_PINS_STORAGE_KEY,
  UI_LAYOUT_STORAGE_KEY,
] as const;
const commandCenterPinsSchema = z.array(z.string().trim().min(1));
const commandCenterPinsProjectionSchema = z.object({
  pins: commandCenterPinsSchema,
});

export async function buildLegacyBootstrapSnapshot(
  persistence: RuntimePersistence,
): Promise<Record<string, string | null>> {
  const store: Record<string, string | null> = {};

  for (const key of LEGACY_BOOTSTRAP_STORAGE_KEYS) {
    const value = await readLegacyStorageValue(persistence, key);
    if (value !== undefined) {
      store[key] = normalizeLegacyBootstrapValue(value);
    }
  }

  return store;
}

export async function readLegacyStorageValue(
  persistence: RuntimePersistence,
  key: string,
): Promise<unknown | undefined> {
  switch (key) {
    case AUTH_ACCOUNTS_STORAGE_KEY:
      return listSanitizedAccounts(persistence);
    case DECLARATION_ROWS_STORAGE_KEY:
      return persistence.declarationsReader.readDeclarationRows();
    case MST_ASSIGNMENTS_STORAGE_KEY:
      return persistence.mstAssignmentsReader.readMstAssignmentRows();
    case MST_HISTORY_STORAGE_KEY:
      return [];
    case DECLARATION_HISTORY_STORAGE_KEY:
      return { rows: {} };
    case KPI_RULES_STORAGE_KEY:
      return (await persistence.kpiRulesReader.readRuleCollection()) || createDefaultKpiRuleCollection();
    case TEAM_ROSTER_STORAGE_KEY:
      return (await persistence.teamsReader.readTeamRoster()) || createEmptyTeamRoster();
    case AUDIT_LOGS_STORAGE_KEY:
      return [];
    case IMPORT_LOGS_STORAGE_KEY:
      return [];
    case HQ_AGENCIES_STORAGE_KEY:
      return persistence.hqAgenciesReader.readBindings();
    case HQ_HISTORY_STORAGE_KEY:
      return persistence.hqAgenciesReader.readHistoryEntries();
    case KPI_ADJUSTMENTS_STORAGE_KEY:
      return persistence.adjustmentsReader.readAdjustmentRows();
    case KPI_ADJUSTMENT_SETTINGS_STORAGE_KEY:
      return persistence.adjustmentsStore.readSettings();
    case KPI_REPORT_SCHEDULE_STORAGE_KEY:
      return [];
    case COMMAND_CENTER_PINS_STORAGE_KEY: {
      const stored = await persistence.projections.readValue(COMMAND_CENTER_PINS_STORAGE_KEY);
      if (Array.isArray(stored)) {
        return commandCenterPinsSchema.parse(stored);
      }
      if (stored) {
        return commandCenterPinsProjectionSchema.parse(stored).pins;
      }
      return [];
    }
    case UI_LAYOUT_STORAGE_KEY:
      return {};
    default:
      return undefined;
  }
}

export async function writeLegacyStorageValue(
  persistence: RuntimePersistence,
  key: string,
  value: unknown,
): Promise<unknown | undefined> {
  switch (key) {
    case COMMAND_CENTER_PINS_STORAGE_KEY: {
      const nextValue =
        value === null || value === undefined
          ? []
          : commandCenterPinsSchema.parse(normalizeLegacyStoragePayload(value));
      await persistence.projections.writeValue(COMMAND_CENTER_PINS_STORAGE_KEY, { pins: nextValue });
      return nextValue;
    }
    default:
      return undefined;
  }
}

export async function setAccountPassword(
  _persistence: RuntimePersistence,
  authService: AuthService,
  token: string,
  payload: { username: string; password: string },
): Promise<{ account: AuthAccountView; accounts: AuthAccountView[] }> {
  return authService.setAccountPassword(token, payload);
}

export async function requireAuthenticatedUser(
  authService: AuthService,
  token: string,
): Promise<AuthAccountView> {
  const result = await authService.restoreSession(token);
  if (!result.user) {
    throw new AuthHttpError(401, 'auth_required', 'Bạn cần đăng nhập.');
  }
  return result.user;
}

export async function deleteAccount(
  persistence: RuntimePersistence,
  authService: AuthService,
  token: string,
  username: string,
): Promise<{ accounts: AuthAccountView[] }> {
  await authService.listAccounts(token);
  const accounts = await persistence.authStore.listAccounts();
  const nextAccounts = accounts.filter((entry) => toUsernameKey(entry.username) !== toUsernameKey(username));
  if (nextAccounts.length === accounts.length) {
    throw new AuthHttpError(404, 'not_found', 'Không tìm thấy tài khoản.');
  }

  const adminCount = nextAccounts.filter((entry) => entry.role === 'admin').length;
  if (adminCount <= 0) {
    throw new AuthHttpError(400, 'invalid_request', 'Cần ít nhất một quản trị viên.');
  }

  await persistence.authStore.saveAccounts(nextAccounts);
  await persistence.authStore.deleteSessionsForUser(username);

  return {
    accounts: nextAccounts.map((entry) => sanitizeAuthAccount(entry)!).filter(Boolean),
  };
}

export async function changeOwnPassword(
  _persistence: RuntimePersistence,
  authService: AuthService,
  token: string,
  payload: { username: string; currentPassword: string; newPassword: string },
): Promise<{ account: AuthAccountView; token: string; expiresAt: number }> {
  return authService.changeOwnPassword(token, payload);
}

export function handleLegacyAuthError(error: unknown, res: Response, context: string): void {
  if (error instanceof ZodError) {
    respondWithLegacyError(res, 400, 'validation_error', `Invalid request for ${context}.`, error.flatten());
    return;
  }

  if (error instanceof AuthHttpError) {
    respondWithLegacyError(res, error.statusCode, error.code, error.message);
    return;
  }

  respondWithLegacyError(res, 500, 'internal_error', `Failed to ${context}.`);
}

function normalizeLegacyBootstrapValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'string' ? value : JSON.stringify(value);
}

function normalizeLegacyStoragePayload(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

async function listSanitizedAccounts(persistence: RuntimePersistence): Promise<AuthAccountView[]> {
  const accounts = await persistence.authStore.listAccounts();
  return accounts.map((entry) => sanitizeAuthAccount(entry)!).filter(Boolean);
}

function respondWithLegacyError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  res.status(statusCode).json({
    ok: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  });
}
