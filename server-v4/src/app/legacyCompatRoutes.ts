import bcrypt from 'bcryptjs';
import express, { type Response, type Router } from 'express';
import { ZodError, z } from 'zod';

import type { RuntimePersistence } from '../persistence/runtimePersistence.js';
import { DeclarationsController } from '../modules/declarations/DeclarationsController.js';
import { DeclarationsAlertsService } from '../modules/declarations/declarationsAlertsService.js';
import { DeclarationsCoMonitoringService } from '../modules/declarations/declarationsCoMonitoringService.js';
import {
  createDefaultEcusSqlHealthCheck,
  DeclarationsEcusSyncService,
  type EcusSqlHealthCheck,
} from '../modules/declarations/declarationsEcusSyncService.js';
import { DeclarationsImportService } from '../modules/declarations/declarationsImportService.js';
import { DeclarationsRepository } from '../modules/declarations/DeclarationsRepository.js';
import { DeclarationsService } from '../modules/declarations/declarationsService.js';
import {
  createDefaultCoDiscrepancyRunner,
  type CoDiscrepancyRunner,
} from '../modules/declarations/ecusCoDiscrepancyRunner.js';
import { createDefaultKpiRuleCollection } from '../modules/kpi-rules/kpiRuleDefaults.js';
import { createEmptyTeamRoster } from '../modules/teams/teamRosterDocument.js';
import { AuthHttpError, AuthService } from '../modules/auth/authService.js';
import type { AuthAccountRecord, AuthAccountView } from '../modules/auth/authTypes.js';
import {
  MIN_PASSWORD_LENGTH,
  clearSessionCookie,
  getSessionTokenFromRequest,
  sanitizeAuthAccount,
  setSessionCookie,
  sortAuthAccounts,
  toUsernameKey,
} from '../modules/auth/authShared.js';

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
  UI_LAYOUT_STORAGE_KEY,
] as const;

const loginBodySchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

const createAccountBodySchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().trim().min(MIN_PASSWORD_LENGTH),
  role: z.string().trim().optional(),
  name: z.string().trim().optional(),
  permissions: z.record(z.boolean()).optional(),
  memberId: z.string().trim().nullable().optional(),
  memberName: z.string().trim().nullable().optional(),
  teamId: z.string().trim().nullable().optional(),
  teamName: z.string().trim().nullable().optional(),
});

const updateAccountBodySchema = z.object({
  role: z.string().trim().optional(),
  name: z.string().trim().optional(),
  permissions: z.record(z.boolean()).optional(),
  memberId: z.string().trim().nullable().optional(),
  memberName: z.string().trim().nullable().optional(),
  teamId: z.string().trim().nullable().optional(),
  teamName: z.string().trim().nullable().optional(),
});

const setPasswordBodySchema = z.object({
  password: z.string().trim().min(MIN_PASSWORD_LENGTH),
});

const changeOwnPasswordBodySchema = z.object({
  username: z.string().trim().min(1),
  currentPassword: z.string().min(1),
  newPassword: z.string().trim().min(MIN_PASSWORD_LENGTH),
});

export function buildLegacyCompatRouter(
  persistence: RuntimePersistence,
  options: {
    ecusImportRunner?: CoDiscrepancyRunner;
    coDiscrepancyRunner?: CoDiscrepancyRunner;
    sqlHealthCheck?: EcusSqlHealthCheck;
  } = {},
): Router {
  const router = express.Router();
  const authService = new AuthService(persistence.authStore);
  const declarationsRepository = new DeclarationsRepository(persistence.declarationsReader);
  const declarationsService = new DeclarationsService(
    declarationsRepository,
    persistence.declarationsStore,
  );
  const ecusFetchRunner =
    options.ecusImportRunner ??
    options.coDiscrepancyRunner ??
    createDefaultCoDiscrepancyRunner(persistence.declarationsReader);
  const declarationsImportService = new DeclarationsImportService(
    declarationsRepository,
    persistence.declarationsStore,
    ecusFetchRunner,
  );
  const declarationsAlertsService = new DeclarationsAlertsService(
    declarationsRepository,
    persistence.declarationsStore,
  );
  const declarationsCoMonitoringService = new DeclarationsCoMonitoringService(
    declarationsRepository,
    declarationsImportService,
    persistence.declarationsStore,
    options.coDiscrepancyRunner ?? ecusFetchRunner,
  );
  const declarationsEcusSyncService = new DeclarationsEcusSyncService(
    persistence.declarationsStore,
    options.sqlHealthCheck ?? createDefaultEcusSqlHealthCheck(),
  );
  const declarationsController = new DeclarationsController(
    declarationsService,
    declarationsImportService,
    declarationsAlertsService,
    declarationsCoMonitoringService,
    declarationsEcusSyncService,
    persistence.authStore,
  );

  router.get('/api/health', async (_req, res) => {
    res.status(200).json({
      ok: true,
      version: 'legacy-compat',
      source: persistence.sourceKind,
    });
  });

  router.post('/api/auth/login', async (req, res) => {
    try {
      const payload = loginBodySchema.parse(req.body ?? {});
      const result = await authService.login(payload);
      setSessionCookie(req, res, result.token, result.expiresAt);
      res.status(200).json({
        ok: true,
        user: result.user,
        expiresAt: result.expiresAt,
      });
    } catch (error) {
      clearSessionCookie(req, res);
      handleLegacyAuthError(error, res, 'login');
    }
  });

  router.get('/api/auth/session', async (req, res) => {
    try {
      const token = getSessionTokenFromRequest(req);
      const result = await authService.restoreSession(token);
      if (result.clearCookie) {
        clearSessionCookie(req, res);
      }
      res.status(200).json({
        ok: true,
        user: result.user,
        expiresAt: result.expiresAt,
      });
    } catch (error) {
      handleLegacyAuthError(error, res, 'restore session');
    }
  });

  router.post('/api/auth/logout', async (req, res) => {
    try {
      await authService.logout(getSessionTokenFromRequest(req));
      clearSessionCookie(req, res);
      res.status(200).json({ ok: true });
    } catch (error) {
      handleLegacyAuthError(error, res, 'logout');
    }
  });

  router.get('/api/auth/accounts', async (req, res) => {
    try {
      const result = await authService.listAccounts(getSessionTokenFromRequest(req));
      res.status(200).json({
        ok: true,
        accounts: result.accounts,
      });
    } catch (error) {
      handleLegacyAuthError(error, res, 'list accounts');
    }
  });

  router.post('/api/auth/accounts', async (req, res) => {
    try {
      const payload = createAccountBodySchema.parse(req.body ?? {});
      const result = await authService.createAccount(getSessionTokenFromRequest(req), payload);
      res.status(201).json({
        ok: true,
        account: result.account,
        accounts: result.accounts,
      });
    } catch (error) {
      handleLegacyAuthError(error, res, 'create account');
    }
  });

  router.patch('/api/auth/accounts/:username', async (req, res) => {
    try {
      const payload = updateAccountBodySchema.parse(req.body ?? {});
      const result = await authService.updateAccount(
        getSessionTokenFromRequest(req),
        `${req.params.username ?? ''}`,
        payload,
      );
      res.status(200).json({
        ok: true,
        account: result.account,
        accounts: result.accounts,
      });
    } catch (error) {
      handleLegacyAuthError(error, res, 'update account');
    }
  });

  router.post('/api/auth/accounts/:username/password', async (req, res) => {
    try {
      const payload = setPasswordBodySchema.parse(req.body ?? {});
      const result = await setAccountPassword(persistence, authService, getSessionTokenFromRequest(req), {
        username: `${req.params.username ?? ''}`.trim(),
        password: payload.password,
      });
      res.status(200).json({
        ok: true,
        account: result.account,
        accounts: result.accounts,
      });
    } catch (error) {
      handleLegacyAuthError(error, res, 'set account password');
    }
  });

  router.delete('/api/auth/accounts/:username', async (req, res) => {
    try {
      const result = await deleteAccount(
        persistence,
        authService,
        getSessionTokenFromRequest(req),
        `${req.params.username ?? ''}`.trim(),
      );
      res.status(200).json({
        ok: true,
        accounts: result.accounts,
      });
    } catch (error) {
      handleLegacyAuthError(error, res, 'delete account');
    }
  });

  router.post('/api/auth/password/change', async (req, res) => {
    try {
      const payload = changeOwnPasswordBodySchema.parse(req.body ?? {});
      const result = await changeOwnPassword(
        persistence,
        authService,
        getSessionTokenFromRequest(req),
        payload,
      );
      setSessionCookie(req, res, result.token, result.expiresAt);
      res.status(200).json({
        ok: true,
        account: result.account,
        expiresAt: result.expiresAt,
      });
    } catch (error) {
      handleLegacyAuthError(error, res, 'change password');
    }
  });

  router.get('/api/bootstrap', async (req, res) => {
    try {
      await requireAuthenticatedUser(authService, getSessionTokenFromRequest(req));
      const store = await buildLegacyBootstrapSnapshot(persistence);
      res.status(200).json({ data: store });
    } catch (error) {
      handleLegacyAuthError(error, res, 'bootstrap application data');
    }
  });

  router.post('/api/import/ecus/preview', (req, res) => void declarationsController.previewEcusImport(req, res));
  router.post('/api/import/ecus/run', (req, res) => void declarationsController.commitEcusImport(req, res));
  router.get('/api/import/ecus/config', (req, res) => void declarationsController.readLegacyEcusConfig(req, res));
  router.get('/api/import/ecus/status', (req, res) => void declarationsController.readLegacyEcusStatus(req, res));
  router.put('/api/import/ecus/config', (req, res) => void declarationsController.updateLegacyEcusConfig(req, res));
  router.get('/api/import/alerts', (req, res) => void declarationsController.listImportAlerts(req, res));
  router.get('/api/import/deleted-declarations', async (req, res) => {
    try {
      await requireAuthenticatedUser(authService, getSessionTokenFromRequest(req));
      const rows = await persistence.declarationsStore.listDeletedDeclarations({
        type: getSingleLegacyQueryValue(req.query?.type),
        from: getSingleLegacyQueryValue(req.query?.from),
        to: getSingleLegacyQueryValue(req.query?.to),
      });
      res.status(200).json({
        ok: true,
        rows,
      });
    } catch (error) {
      handleLegacyAuthError(error, res, 'load deleted declarations');
    }
  });
  router.get('/api/import/search', (req, res) =>
    void declarationsController.searchLegacyImportDeclarations(req, res),
  );
  router.get('/api/import/alerts/config', (req, res) =>
    void declarationsController.readImportAlertConfig(req, res),
  );
  router.put('/api/import/alerts/config', (req, res) =>
    void declarationsController.updateImportAlertConfig(req, res),
  );
  router.post('/api/import/alerts/review', (req, res) =>
    void declarationsController.markImportAlertsReviewed(req, res),
  );
  router.post('/api/import/alerts/unreview', (req, res) =>
    void declarationsController.unmarkImportAlertsReviewed(req, res),
  );
  router.get('/api/import/co-codes', (req, res) => void declarationsController.readCoCodeConfig(req, res));
  router.put('/api/import/co-codes', (req, res) => void declarationsController.updateCoCodeConfig(req, res));
  router.get('/api/import/co-discrepancy', (req, res) =>
    void declarationsController.readCoDiscrepancy(req, res),
  );
  router.post('/api/import/co-discrepancy/run', (req, res) =>
    void declarationsController.runCoDiscrepancy(req, res),
  );
  router.put('/api/import/co-discrepancy/config', (req, res) =>
    void declarationsController.updateCoDiscrepancyConfig(req, res),
  );

  router.get('/api/storage/:key', async (req, res) => {
    try {
      await requireAuthenticatedUser(authService, getSessionTokenFromRequest(req));
      const key = `${req.params.key ?? ''}`.trim();
      const value = await readLegacyStorageValue(persistence, key);
      if (value === undefined) {
        res.status(404).json({
          ok: false,
          error: `Unknown storage key: ${key}`,
        });
        return;
      }

      res.status(200).json({
        ok: true,
        key,
        value,
        raw: value === null ? null : JSON.stringify(value),
      });
    } catch (error) {
      handleLegacyAuthError(error, res, 'read storage key');
    }
  });

  return router;
}

async function buildLegacyBootstrapSnapshot(
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

async function readLegacyStorageValue(
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
    case UI_LAYOUT_STORAGE_KEY:
      return {};
    default:
      return undefined;
  }
}

function normalizeLegacyBootstrapValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'string' ? value : JSON.stringify(value);
}

function getSingleLegacyQueryValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || null;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string' && entry.trim()) {
        return entry.trim();
      }
    }
  }

  return null;
}

async function requireAuthenticatedUser(authService: AuthService, token: string): Promise<AuthAccountView> {
  const result = await authService.restoreSession(token);
  if (!result.user) {
    throw new AuthHttpError(401, 'auth_required', 'Bạn cần đăng nhập.');
  }
  return result.user;
}

async function setAccountPassword(
  persistence: RuntimePersistence,
  authService: AuthService,
  token: string,
  payload: { username: string; password: string },
): Promise<{ account: AuthAccountView; accounts: AuthAccountView[] }> {
  await authService.listAccounts(token);
  const accounts = await persistence.authStore.listAccounts();
  const index = accounts.findIndex((entry) => toUsernameKey(entry.username) === toUsernameKey(payload.username));
  if (index < 0) {
    throw new AuthHttpError(404, 'not_found', 'Không tìm thấy tài khoản.');
  }

  const current = accounts[index];
  const nextAccount: AuthAccountRecord = {
    ...current,
    passwordHash: bcrypt.hashSync(payload.password.trim(), 10),
    updatedAt: new Date().toISOString(),
  };
  accounts[index] = nextAccount;
  sortAuthAccounts(accounts);
  await persistence.authStore.saveAccounts(accounts);

  return {
    account: sanitizeAuthAccount(nextAccount)!,
    accounts: accounts.map((entry) => sanitizeAuthAccount(entry)!).filter(Boolean),
  };
}

async function deleteAccount(
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

async function changeOwnPassword(
  persistence: RuntimePersistence,
  authService: AuthService,
  token: string,
  payload: { username: string; currentPassword: string; newPassword: string },
): Promise<{ account: AuthAccountView; token: string; expiresAt: number }> {
  const sessionUser = await requireAuthenticatedUser(authService, token);
  if (toUsernameKey(sessionUser.username) !== toUsernameKey(payload.username)) {
    throw new AuthHttpError(403, 'forbidden', 'Bạn chỉ có thể đổi mật khẩu của chính mình.');
  }

  const accounts = await persistence.authStore.listAccounts();
  const index = accounts.findIndex(
    (entry) => toUsernameKey(entry.username) === toUsernameKey(payload.username),
  );
  if (index < 0) {
    throw new AuthHttpError(404, 'not_found', 'Không tìm thấy tài khoản.');
  }

  const current = accounts[index];
  const matches = await bcrypt.compare(payload.currentPassword, current.passwordHash);
  if (!matches) {
    throw new AuthHttpError(401, 'invalid_credentials', 'Mật khẩu hiện tại không đúng.');
  }

  const nextAccount: AuthAccountRecord = {
    ...current,
    passwordHash: bcrypt.hashSync(payload.newPassword.trim(), 10),
    updatedAt: new Date().toISOString(),
  };
  accounts[index] = nextAccount;
  sortAuthAccounts(accounts);
  await persistence.authStore.saveAccounts(accounts);
  await persistence.authStore.deleteSessionsForUser(nextAccount.username);
  const session = await persistence.authStore.createSession(nextAccount.username);

  return {
    account: sanitizeAuthAccount(nextAccount)!,
    token: session.token,
    expiresAt: session.expiresAt,
  };
}

async function listSanitizedAccounts(persistence: RuntimePersistence): Promise<AuthAccountView[]> {
  const accounts = await persistence.authStore.listAccounts();
  return accounts.map((entry) => sanitizeAuthAccount(entry)!).filter(Boolean);
}

function handleLegacyAuthError(error: unknown, res: Response, context: string): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      ok: false,
      error: `Invalid request for ${context}.`,
      details: error.flatten(),
    });
    return;
  }

  if (error instanceof AuthHttpError) {
    res.status(error.statusCode).json({
      ok: false,
      error: error.message,
      code: error.code,
    });
    return;
  }

  res.status(500).json({
    ok: false,
    error: `Failed to ${context}.`,
  });
}
