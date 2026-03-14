import { vi } from 'vitest';

import {

  createDefaultAccountsState,

  createDefaultHandlers,

  jsonResponse,

  normalisePath,

  normalizePermissions,

  resolveHandler,

  safeParse,

} from './mockApiState.js';



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

        if (Object.prototype.hasOwnProperty.call(body, 'memberId')) {

          const memberId = typeof body.memberId === 'string' ? body.memberId.trim() : '';

          account.memberId = memberId || null;

        }

        if (Object.prototype.hasOwnProperty.call(body, 'memberName')) {

          const memberName = typeof body.memberName === 'string' ? body.memberName.trim() : '';

          account.memberName = memberName || null;

        }

        if (Object.prototype.hasOwnProperty.call(body, 'teamId')) {

          const teamId = typeof body.teamId === 'string' ? body.teamId.trim() : '';

          account.teamId = teamId || null;

        }

        if (Object.prototype.hasOwnProperty.call(body, 'teamName')) {

          const teamName = typeof body.teamName === 'string' ? body.teamName.trim() : '';

          account.teamName = teamName || null;

        }

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

        memberId: typeof body?.memberId === 'string' && body.memberId.trim() ? body.memberId.trim() : null,

        memberName: typeof body?.memberName === 'string' && body.memberName.trim() ? body.memberName.trim() : null,

        teamId: typeof body?.teamId === 'string' && body.teamId.trim() ? body.teamId.trim() : null,

        teamName: typeof body?.teamName === 'string' && body.teamName.trim() ? body.teamName.trim() : null,

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

        return jsonResponse({ ok: false, error: "Thi???u tA?i kho???n c??\u0015n ?`??\u0007i m??-t kh??cu" }, 400);

      }

      if (newPassword.length < 6) {

        return jsonResponse({ ok: false, error: "M??-t kh??cu m??>i c??\u0015n t??`i thi???u 6 kA? t???" }, 400);

      }

      if (state.passwords.get(username) !== currentPassword) {

        return jsonResponse({ ok: false, error: "M??-t kh??cu hi???n t???i khA'ng ?`A?ng" }, 400);

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

