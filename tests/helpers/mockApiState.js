import { buildReportingReadModels } from '../../server/reportingReadModels.js';

import { resolveReportingRule } from '../../server/reportingRuleSelection.js';

import {
  ADMIN_ROLE,
  DEFAULT_ROLE,
  getPermissionTemplate,
  normalizeRoleKey,
} from '../../packages/domain/src/accountRoles.js';
import {
  getPasswordMinLengthMessage,
  MIN_PASSWORD_LENGTH,
} from '../../packages/domain/src/passwordPolicy.js';

import {
  deleteReportSchedule,
  getDeclRows,
  getKpiAdjustments,
  getReportSchedules,
  getTeamRoster,
  saveReportSchedule,
} from '../../src/lib/store.js';

import { filterDeclRows, normalizeDeclSearchFilters } from '../../packages/domain/src/declSearch.js';

import { loadRuleSets, loadRules } from '../../src/lib/rules.js';



export function jsonResponse(payload, status = 200) {

  return {

    ok: status >= 200 && status < 300,

    status,

    json: async () => payload,

  };

}



export function createDefaultAccountsState() {

  const adminPermissions = getPermissionTemplate(ADMIN_ROLE);

  const staffPermissions = {
    ...getPermissionTemplate(DEFAULT_ROLE),
    importEdit: true,
  };

  const accounts = [

    { username: 'admin', role: 'admin', name: 'Quản trị viên', permissions: adminPermissions },

    { username: 'nhanvien', role: 'staff', name: 'Nhân viên', permissions: staffPermissions },

  ];

  const passwords = new Map([

    ['admin', 'admin123'],

    ['nhanvien', '12345678'],

  ]);

  return { accounts, passwords, currentUser: null };

}

function normalizePermissions(permissions, role) {

  const normalizedRole = normalizeRoleKey(role);

  const base = getPermissionTemplate(normalizedRole);

  const result = { ...base };

  if (permissions && typeof permissions === 'object') {

    for (const key of Object.keys(base)) {

      if (key === 'reportsExport') {

        result[key] = permissions[key] !== false;

      } else {

        result[key] = !!permissions[key];

      }

    }

  }

  if (normalizedRole === ADMIN_ROLE) {

    result.accountManage = true;

  }

  return result;

}

function normalizeText(value) {

  return typeof value === 'string' ? value.trim() : '';

}

function sanitizeAccount(account) {

  if (!account) {

    return null;

  }

  const username = normalizeText(account.username);

  const role = normalizeRoleKey(account.role);

  return {
    username,
    role,
    name: normalizeText(account.name) || username,
    permissions: normalizePermissions(account.permissions, role),
    memberId: normalizeText(account.memberId),
    memberName: normalizeText(account.memberName),
    teamId: normalizeText(account.teamId),
    teamName: normalizeText(account.teamName),
  };

}

function listClientAccounts(state) {

  return state.accounts.map((account) => sanitizeAccount(account)).filter(Boolean);

}

function findAccountIndex(state, usernameInput) {

  const username = normalizeText(usernameInput).toLowerCase();

  return state.accounts.findIndex((account) => normalizeText(account.username).toLowerCase() === username);

}

function extractAccountUsername(path) {

  const parts = String(path || '')
    .split('/')
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));

  const accountsIndex = parts.findIndex((part) => part === 'accounts');

  if (accountsIndex < 0 || accountsIndex + 1 >= parts.length) {

    return '';

  }

  return parts[accountsIndex + 1];

}

function parseSearchParams(url) {

  try {

    return new URL(url, 'http://localhost').searchParams;

  } catch {

    return new URLSearchParams();

  }

}

function buildReportingQuery(url) {

  const params = parseSearchParams(url);

  const requestedLimit = Number(params.get('limit'));

  return {

    from: normalizeText(params.get('from')),

    to: normalizeText(params.get('to')),

    ruleId: normalizeText(params.get('ruleId')),

    limit:

      Number.isFinite(requestedLimit) && requestedLimit > 0

        ? Math.trunc(requestedLimit)

        : undefined,

  };

}

function resolveReportingRules(ruleId) {

  const collection = loadRuleSets();

  const selected = resolveReportingRule(collection, ruleId);

  if (normalizeText(ruleId) && !selected) {

    throw new Error('Không tìm thấy bộ quy tắc KPI cần xem báo cáo.');

  }

  return selected || loadRules();

}

function buildMockScheduleAggregateStatus() {

  const datedRows = getDeclRows()
    .map((row) => normalizeText(row?.date))
    .filter(Boolean)
    .sort();

  if (!datedRows.length) {

    return {

      available: false,

      generatedAt: '',

      queryKey: '',

      total: 0,

      range: {

        from: '',

        to: '',

      },

    };

  }

  const lastDate = datedRows[datedRows.length - 1];

  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(lastDate);

  if (!match) {

    return {

      available: false,

      generatedAt: '',

      queryKey: '',

      total: 0,

      range: {

        from: '',

        to: '',

      },

    };

  }

  const year = Number(match[1]);

  const monthIndex = Number(match[2]) - 1;

  const lastDayOfMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  const from = `${match[1]}-${match[2]}-01`;

  const to = `${match[1]}-${match[2]}-${String(lastDayOfMonth).padStart(2, '0')}`;

  return {

    available: true,

    generatedAt: `${to}T00:00:00.000Z`,

    queryKey: `mock-default-${from}-${to}`,

    total: 1,

    range: {

      from,

      to,

    },

  };

}

function buildReportingViewPayload(url) {

  const query = buildReportingQuery(url);

  return buildReportingReadModels(getDeclRows(), {

    roster: getTeamRoster(),

    rules: resolveReportingRules(query.ruleId),

    from: query.from,

    to: query.to,

    adjustments: getKpiAdjustments(),

    limit: query.limit,

  });

}

function createReportingViewHandler(slice, errorMessage = 'Không thể tải báo cáo KPI') {

  return ({ url }) => {

    try {

      const reporting = buildReportingViewPayload(url);

      return jsonResponse({ ok: true, data: slice ? reporting[slice] : reporting });

    } catch (error) {

      return jsonResponse({ ok: false, error: error?.message || errorMessage }, 400);

    }

  };

}



export function createDefaultHandlers(state) {

  return {

    'GET /api/v4/reporting/view': createReportingViewHandler(),

    'GET /api/v4/reporting/schedules': () => {

      return jsonResponse({

        ok: true,

        data: {

          total: getReportSchedules().length,

          items: getReportSchedules(),

          aggregateStatus: buildMockScheduleAggregateStatus(),

        },

      });

    },
    'POST /api/v4/reporting/schedules': ({ init }) => {
      const body = safeParse(init?.body, {});
      const saved = saveReportSchedule(body, { actor: 'mock-api' });

      return jsonResponse({
        ok: true,
        data: {
          item: saved,
          total: getReportSchedules().length,
        },
      });
    },
    'DELETE /api/v4/reporting/schedules/:id': ({ url }) => {
      const scheduleId = normalisePath(url).split('/').filter(Boolean).pop() || '';
      const deleted = deleteReportSchedule(scheduleId, { actor: 'mock-api' });

      if (!deleted) {
        return jsonResponse({ ok: false, error: 'Không tìm thấy lịch báo cáo KPI' }, 404);
      }

      return jsonResponse({
        ok: true,
        data: {
          deleted: true,
          total: getReportSchedules().length,
        },
      });
    },

    'GET /api/v4/declarations/imports/search': ({ url }) => {

      let params;

      try {

        params = new URL(url, 'http://localhost').searchParams;

      } catch {

        params = new URLSearchParams();

      }

      const rawFilters = {};

      for (const [key, value] of params.entries()) {

        if (rawFilters[key]) {

          const existing = rawFilters[key];

          rawFilters[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];

        } else {

          rawFilters[key] = value;

        }

      }

      const filters = normalizeDeclSearchFilters(rawFilters);

      const allRows = getDeclRows();

      const sample = Array.isArray(allRows) ? allRows.slice(0, 2000) : [];

      const rows = filterDeclRows(sample, filters);

      const DEFAULT_PAGE_SIZE = 10;

      const MAX_PAGE_SIZE = 200;

      const requestedPage = Number(params.get('page'));

      const requestedPageSize = Number(params.get('pageSize'));

      const pageSizeCandidate =

        Number.isFinite(requestedPageSize) && requestedPageSize > 0

          ? Math.floor(requestedPageSize)

          : DEFAULT_PAGE_SIZE;

      const pageSize = Math.max(1, Math.min(pageSizeCandidate, MAX_PAGE_SIZE));

      const total = rows.length;

      const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

      const maxPage = Math.max(1, Math.ceil(total / pageSize));

      const safePage = Math.min(page, maxPage);

      const offset = (safePage - 1) * pageSize;

      const pagedRows = rows.slice(offset, offset + pageSize);

      return jsonResponse({ ok: true, total, page: safePage, pageSize, rows: pagedRows });

    },

    'GET /api/v4/declarations/imports/deleted-declarations': () =>

      jsonResponse({

        ok: true,

        rows: [],

      }),

    'GET /api/import/ecus/config': () =>

      jsonResponse({

        ok: true,

        config: {

          enabled: false,

          schedule: '0 * * * *',

          rangeDays: 1,

          connection: { server: '', database: '', user: '', hasPassword: false },

        },

      }),

    'GET /api/v4/declarations/imports/ecus-config': () =>

      jsonResponse({

        ok: true,

        config: {

          enabled: false,

          schedule: '0 * * * *',

          rangeDays: 1,

          connection: { server: '', database: '', user: '', hasPassword: false },

        },

      }),

    'GET /api/v4/declarations/imports/ecus-status': () =>

      jsonResponse({

        ok: true,

        backend: { ok: true, state: 'online', checkedAt: new Date().toISOString() },

        database: { ok: true, state: 'ready', checkedAt: new Date().toISOString() },

      }),

    'GET /api/import/alerts': () =>

      jsonResponse({

        ok: true,

        alerts: [],

        summary: { outstanding: 0, totalTracked: 0, lastEvaluatedAt: null },

      }),

    'GET /api/v4/declarations/imports/alerts': () =>

      jsonResponse({

        ok: true,

        alerts: [],

        summary: { outstanding: 0, totalTracked: 0, lastEvaluatedAt: null },

      }),

    'POST /api/import/alerts': () => jsonResponse({ ok: true, updated: [] }),

    'POST /api/import/ecus/run': () => jsonResponse({ ok: true, result: { imported: 0, fetched: 0, alerts: {} } }),

    'POST /api/v4/declarations/imports/ecus-commit': () =>
      jsonResponse({ ok: true, result: { imported: 0, fetched: 0, alerts: {} } }),

    'POST /api/import/ecus/preview': () =>

      jsonResponse({ ok: true, preview: { rows: [], limited: false, fetched: 0, range: { from: '', to: '' } } }),

    'POST /api/v4/declarations/imports/ecus-preview': () =>

      jsonResponse({ ok: true, preview: { rows: [], limited: false, fetched: 0, range: { from: '', to: '' } } }),

    'GET /api/v4/declarations/imports/co-codes': () =>
      jsonResponse({ ok: true, config: { whitelist: [], blacklist: [] } }),

    'PUT /api/v4/declarations/imports/co-codes': ({ init }) =>
      jsonResponse({ ok: true, config: safeParse(init?.body, {})?.config || { whitelist: [], blacklist: [] } }),

    'GET /api/v4/declarations/imports/co-discrepancy': () =>
      jsonResponse({
        ok: true,
        config: { enabled: false, cron: '', rangeDays: 3, threshold: 10, sampleLimit: 0 },
        state: null,
      }),

    'PUT /api/v4/declarations/imports/co-discrepancy/config': ({ init }) =>
      jsonResponse({
        ok: true,
        config:
          safeParse(init?.body, {})?.config || {
            enabled: false,
            cron: '',
            rangeDays: 3,
            threshold: 10,
            sampleLimit: 0,
          },
      }),

    'POST /api/v4/declarations/imports/co-discrepancy/run': () =>
      jsonResponse({
        ok: true,
        result: {
          config: { enabled: false, cron: '', rangeDays: 3, threshold: 10, sampleLimit: 0 },
          state: {
            lastRunAt: null,
            range: null,
            mismatchCount: 0,
            totalChecked: 0,
            status: 'ok',
            error: null,
            durationMs: 0,
            mismatches: [],
            triggered: false,
            limited: false,
            actor: null,
            reason: null,
          },
        },
      }),

    'POST /api/v4/declarations/imports/alerts/review': () => jsonResponse({ ok: true, updated: [] }),

    'POST /api/v4/declarations/imports/alerts/unreview': () => jsonResponse({ ok: true, updated: [] }),

    'GET /api/audit': () => jsonResponse({ ok: true, logs: [] }),

    'GET /api/v4/auth/accounts': () => jsonResponse({ ok: true, accounts: listClientAccounts(state) }),

    'POST /api/v4/auth/accounts': ({ init }) => {

      const body = safeParse(init?.body, {});

      const username = normalizeText(body?.username);

      if (!username) {

        return jsonResponse({ ok: false, error: 'Vui lòng nhập tài khoản' }, 400);

      }

      if (findAccountIndex(state, username) >= 0) {

        return jsonResponse({ ok: false, error: 'Tài khoản đã tồn tại' }, 400);

      }

      const password = normalizeText(body?.password);

      if (password.length < MIN_PASSWORD_LENGTH) {

        return jsonResponse({ ok: false, error: getPasswordMinLengthMessage() }, 400);

      }

      const role = normalizeRoleKey(body?.role);

      const account = sanitizeAccount({
        username,
        role,
        name: normalizeText(body?.name) || username,
        permissions: body?.permissions,
        memberId: body?.memberId,
        memberName: body?.memberName,
        teamId: body?.teamId,
        teamName: body?.teamName,
      });

      state.accounts.push(account);
      state.passwords.set(account.username, password);

      return jsonResponse({ ok: true, account, accounts: listClientAccounts(state) }, 201);

    },

    'PATCH /api/v4/auth/accounts/:username': ({ init, path }) => {

      const username = extractAccountUsername(path);

      const index = findAccountIndex(state, username);

      if (index < 0) {

        return jsonResponse({ ok: false, error: 'Không tìm thấy tài khoản' }, 404);

      }

      const body = safeParse(init?.body, {});

      const current = state.accounts[index];
      const role = normalizeRoleKey(body?.role ?? current.role);
      const hasField = (key) => Object.prototype.hasOwnProperty.call(body, key);
      const updated = sanitizeAccount({
        ...current,
        role,
        name: body?.name ?? current.name,
        permissions: body?.permissions ?? current.permissions,
        memberId: hasField('memberId') ? body?.memberId : current.memberId,
        memberName: hasField('memberName') ? body?.memberName : current.memberName,
        teamId: hasField('teamId') ? body?.teamId : current.teamId,
        teamName: hasField('teamName') ? body?.teamName : current.teamName,
      });

      state.accounts[index] = updated;

      if (state.currentUser?.username === updated.username) {

        state.currentUser = updated;

      }

      return jsonResponse({ ok: true, account: updated, accounts: listClientAccounts(state) });

    },

    'POST /api/v4/auth/accounts/:username/password': ({ init, path }) => {

      const username = extractAccountUsername(path);

      const index = findAccountIndex(state, username);

      if (index < 0) {

        return jsonResponse({ ok: false, error: 'Không tìm thấy tài khoản' }, 404);

      }

      const body = safeParse(init?.body, {});

      const password = normalizeText(body?.password);

      if (password.length < MIN_PASSWORD_LENGTH) {

        return jsonResponse({ ok: false, error: getPasswordMinLengthMessage() }, 400);

      }

      state.passwords.set(state.accounts[index].username, password);

      return jsonResponse({ ok: true, accounts: listClientAccounts(state) });

    },

    'DELETE /api/v4/auth/accounts/:username': ({ path }) => {

      const username = extractAccountUsername(path);

      const index = findAccountIndex(state, username);

      if (index < 0) {

        return jsonResponse({ ok: false, error: 'Không tìm thấy tài khoản' }, 404);

      }

      const [removed] = state.accounts.splice(index, 1);

      state.passwords.delete(removed.username);

      if (state.currentUser?.username === removed.username) {

        state.currentUser = null;

      }

      return jsonResponse({ ok: true, accounts: listClientAccounts(state) });

    },

    'POST /api/v4/auth/login': ({ init }) => {

      const body = safeParse(init?.body, {});

      const username = String(body?.username || '').trim().toLowerCase();

      const password = String(body?.password || '');

      const account = state.accounts.find((entry) => entry.username.toLowerCase() === username);

      if (!account) {

        return jsonResponse({ ok: false, error: 'Sai tài khoản hoặc mật khẩu' }, 401);

      }

      if (state.passwords.get(account.username) !== password) {

        return jsonResponse({ ok: false, error: 'Sai tài khoản hoặc mật khẩu' }, 401);

      }

      state.currentUser = sanitizeAccount(account);

      return jsonResponse({ ok: true, user: state.currentUser });

    },

    'GET /api/v4/auth/session': () => jsonResponse({ ok: true, user: state.currentUser }),

    'POST /api/v4/auth/logout': () => {

      state.currentUser = null;

      return jsonResponse({ ok: true });

    },

  };

}



export function safeParse(json, fallback) {

  try {

    return JSON.parse(json);

  } catch {

    return fallback;

  }

}



export function normalisePath(rawUrl) {

  try {

    const url = new URL(rawUrl, 'http://localhost');

    return url.pathname;

  } catch {

    return rawUrl.split('?')[0] || rawUrl;

  }

}



export function resolveHandler(map, method, path) {

  const normalizedPath = path.replace(/\/$/, '') || '/';

  const key = `${method} ${normalizedPath}`;

  if (map.has(key)) {

    return map.get(key);

  }

  if (map.has(normalizedPath)) {

    return map.get(normalizedPath);

  }

  const patternMatches = (patternPath, actualPath) => {

    const normalize = (value) => (value.replace(/\/$/, '') || '/').split('/').filter(Boolean);

    const patternParts = normalize(patternPath);
    const actualParts = normalize(actualPath);

    if (patternParts.length !== actualParts.length) {

      return false;

    }

    for (let index = 0; index < patternParts.length; index += 1) {

      const expected = patternParts[index];
      const actual = actualParts[index];

      if (expected.startsWith(':')) {

        continue;

      }

      if (expected !== actual) {

        return false;

      }

    }

    return true;

  };

  for (const [entryKey, handler] of map.entries()) {

    const match = /^([A-Z]+) (.+)$/.exec(entryKey);

    if (match) {

      const [, entryMethod, entryPath] = match;

      if (entryMethod === method && patternMatches(entryPath, normalizedPath)) {

        return handler;

      }

      continue;

    }

    if (patternMatches(entryKey, normalizedPath)) {

      return handler;

    }

  }

  return undefined;

}



export { normalizePermissions };

