import { vi } from 'vitest';

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

function createDefaultAccountsState() {
  const adminPermissions = {
    importEdit: true,
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
  return { accounts, passwords, currentUser: null };
}

function normalizePermissions(permissions, role) {
  const adminDefaults = {
    importEdit: true,
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

function createDefaultHandlers(state) {
  return {
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
      return jsonResponse({ ok: true, user: account });
    },
    'GET /api/auth/session': () => jsonResponse({ ok: true, user: state.currentUser }),
    'POST /api/auth/logout': () => {
      state.currentUser = null;
      return jsonResponse({ ok: true });
    },
  };
}

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function normalisePath(rawUrl) {
  try {
    const url = new URL(rawUrl, 'http://localhost');
    return url.pathname;
  } catch {
    return rawUrl.split('?')[0] || rawUrl;
  }
}

function resolveHandler(map, method, path) {
  const key = `${method} ${path}`;
  if (map.has(key)) {
    return map.get(key);
  }
  if (map.has(path)) {
    return map.get(path);
  }
  return map.get(`${method} ${path.replace(/\/$/, '')}`) ?? map.get(path.replace(/\/$/, ''));
}

export function installMockApi(overrides = {}) {
  const state = createDefaultAccountsState();
  const handlerMap = new Map();
  for (const [key, handler] of Object.entries(createDefaultHandlers(state))) {
    handlerMap.set(key, handler);
  }
  for (const [key, handler] of Object.entries(overrides)) {
    handlerMap.set(key, handler);
  }

  const fetchMock = vi.fn(async (input, init = {}) => {
    const method = (init.method || 'GET').toUpperCase();
    const url = typeof input === 'string' ? input : input?.url ?? '';
    const path = normalisePath(url);
    const handler = resolveHandler(handlerMap, method, path);
    if (handler) {
      return handler({ method, url, init, path });
    }

    if (path.startsWith('/api/auth/accounts/')) {
      const parts = path.split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      if (last === 'password') {
        const username = decodeURIComponent(parts[parts.length - 2] ?? '');
        const body = safeParse(init?.body, {});
        const password = String(body?.password || '').trim();
        if (!username) {
          return jsonResponse({ ok: false, error: 'Thiếu tài khoản' }, 400);
        }
        if (password.length < 6) {
          return jsonResponse({ ok: false, error: 'Mật khẩu cần tối thiểu 6 ký tự' }, 400);
        }
        const account = state.accounts.find((entry) => entry.username === username);
        if (!account) {
          return jsonResponse({ ok: false, error: 'Không tìm thấy tài khoản' }, 404);
        }
        state.passwords.set(username, password);
        if (state.currentUser?.username === username) {
          state.currentUser = null;
        }
        return jsonResponse({ ok: true, accounts: state.accounts.slice() });
      }

      const username = decodeURIComponent(last);
      if (method === 'PATCH') {
        const body = safeParse(init?.body, {});
        const account = state.accounts.find((entry) => entry.username === username);
        if (!account) {
          return jsonResponse({ ok: false, error: 'Không tìm thấy tài khoản' }, 404);
        }
        const nextRole = body?.role === 'admin' ? 'admin' : account.role;
        if (account.role === 'admin' && nextRole !== 'admin') {
          const adminCount = state.accounts.filter((entry) => entry.role === 'admin').length;
          if (adminCount <= 1) {
            return jsonResponse({ ok: false, error: 'Cần ít nhất một quản trị viên' }, 400);
          }
        }
        account.role = nextRole;
        account.name = String(body?.name ?? account.name ?? username).trim();
        account.permissions = normalizePermissions(body?.permissions ?? account.permissions, account.role);
        if (state.currentUser?.username === account.username) {
          state.currentUser = account;
        }
        return jsonResponse({ ok: true, account, accounts: state.accounts.slice() });
      }
      if (method === 'DELETE') {
        const account = state.accounts.find((entry) => entry.username === username);
        if (!account) {
          return jsonResponse({ ok: false, error: 'Không tìm thấy tài khoản' }, 404);
        }
        if (account.role === 'admin') {
          const adminCount = state.accounts.filter((entry) => entry.role === 'admin').length;
          if (adminCount <= 1) {
            return jsonResponse({ ok: false, error: 'Không thể xoá quản trị viên cuối cùng' }, 400);
          }
        }
        const index = state.accounts.findIndex((entry) => entry.username === username);
        state.accounts.splice(index, 1);
        state.passwords.delete(username);
        if (state.currentUser?.username === username) {
          state.currentUser = null;
        }
        return jsonResponse({ ok: true, accounts: state.accounts.slice() });
      }
    }

    if (path === '/api/auth/accounts' && method === 'POST') {
      const body = safeParse(init?.body, {});
      const username = String(body?.username || '').trim();
      if (!username) {
        return jsonResponse({ ok: false, error: 'Vui lòng nhập tài khoản' }, 400);
      }
      if (state.accounts.some((entry) => entry.username.toLowerCase() === username.toLowerCase())) {
        return jsonResponse({ ok: false, error: 'Tài khoản đã tồn tại' }, 400);
      }
      const password = String(body?.password || '').trim();
      if (password.length < 6) {
        return jsonResponse({ ok: false, error: 'Mật khẩu cần tối thiểu 6 ký tự' }, 400);
      }
      const role = body?.role === 'admin' ? 'admin' : 'staff';
      const account = {
        username,
        role,
        name: String(body?.name || username).trim(),
        permissions: normalizePermissions(body?.permissions, role),
      };
      state.accounts.push(account);
      state.passwords.set(username, password);
      return jsonResponse({ ok: true, account, accounts: state.accounts.slice() }, 201);
    }

    if (path === '/api/auth/password/change' && method === 'POST') {
      const body = safeParse(init?.body, {});
      const username = String(body?.username || '').trim();
      const currentPassword = String(body?.currentPassword || '');
      const newPassword = String(body?.newPassword || '').trim();
      if (!username) {
        return jsonResponse({ ok: false, error: 'Thiếu tài khoản cần đổi mật khẩu' }, 400);
      }
      if (newPassword.length < 6) {
        return jsonResponse({ ok: false, error: 'Mật khẩu mới cần tối thiểu 6 ký tự' }, 400);
      }
      if (state.passwords.get(username) !== currentPassword) {
        return jsonResponse({ ok: false, error: 'Mật khẩu hiện tại không đúng' }, 400);
      }
      state.passwords.set(username, newPassword);
      const account = state.accounts.find((entry) => entry.username === username);
      state.currentUser = account ?? null;
      return jsonResponse({ ok: true, account });
    }

    return jsonResponse({ ok: true });
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
