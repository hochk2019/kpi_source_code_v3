import { getDeclRows } from '../../src/lib/store.js';

import { filterDeclRows, normalizeDeclSearchFilters } from '../../src/shared/declSearch.js';



export function jsonResponse(payload, status = 200) {

  return {

    ok: status >= 200 && status < 300,

    status,

    json: async () => payload,

  };

}



export function createDefaultAccountsState() {

  const adminPermissions = {

    importEdit: true,

    importUpload: true,

    mstEdit: true,

    rulesEdit: true,

    teamsEdit: true,

    syncManage: true,

    reportsExport: true,

    alertsManage: true,

    auditView: true,

    accountManage: true,

  };

  const staffPermissions = {

    importEdit: true,

    importUpload: false,

    mstEdit: false,

    rulesEdit: false,

    teamsEdit: false,

    syncManage: false,

    reportsExport: true,

    alertsManage: false,

    auditView: false,

    accountManage: false,

  };

  const accounts = [

    { username: 'admin', role: 'admin', name: 'Quản trị viên', permissions: adminPermissions },

    { username: 'nhanvien', role: 'staff', name: 'Nhân viên', permissions: staffPermissions },

  ];

  const passwords = new Map([

    ['admin', 'admin123'],

    ['nhanvien', '123456'],

  ]);

  return { accounts, passwords, currentUser: null, sessionToken: null };

}



function normalizePermissions(permissions, role) {

  const adminDefaults = {

    importEdit: true,

    importUpload: true,

    mstEdit: true,

    rulesEdit: true,

    teamsEdit: true,

    syncManage: true,

    reportsExport: true,

    alertsManage: true,

    auditView: true,

    accountManage: true,

  };

  const staffDefaults = {

    importEdit: false,

    importUpload: false,

    mstEdit: false,

    rulesEdit: false,

    teamsEdit: false,

    syncManage: false,

    reportsExport: true,

    alertsManage: false,

    auditView: false,

    accountManage: false,

  };

  const base = role === 'admin' ? adminDefaults : staffDefaults;

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

  if (role === 'admin') {

    result.accountManage = true;

  }

  return result;

}



export function createDefaultHandlers(state) {

  return {

    'GET /api/import/search': ({ url }) => {

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

    'GET /api/import/alerts': () =>

      jsonResponse({

        ok: true,

        alerts: [],

        summary: { outstanding: 0, totalTracked: 0, lastEvaluatedAt: null },

      }),

    'POST /api/import/alerts': () => jsonResponse({ ok: true, updated: [] }),

    'POST /api/import/ecus/run': () => jsonResponse({ ok: true, result: { imported: 0, fetched: 0, alerts: {} } }),

    'POST /api/import/ecus/preview': () =>

      jsonResponse({ ok: true, preview: { rows: [], limited: false, fetched: 0, range: { from: '', to: '' } } }),

    'GET /api/audit': () => jsonResponse({ ok: true, logs: [] }),

    'GET /api/auth/accounts': () => jsonResponse({ ok: true, accounts: state.accounts.slice() }),

    'POST /api/auth/login': ({ init }) => {

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

      state.currentUser = account;

      state.sessionToken = `mock-token-${account.username}-${Date.now()}`;

      return jsonResponse({ ok: true, user: account, token: state.sessionToken });

    },

    'GET /api/auth/session': () => jsonResponse({ ok: true, user: state.currentUser, token: state.sessionToken }),

    'POST /api/auth/logout': () => {

      state.currentUser = null;

      state.sessionToken = null;

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

  const key = `${method} ${path}`;

  if (map.has(key)) {

    return map.get(key);

  }

  if (map.has(path)) {

    return map.get(path);

  }

  return map.get(`${method} ${path.replace(/\/$/, '')}`) ?? map.get(path.replace(/\/$/, ''));

}



export { normalizePermissions };

