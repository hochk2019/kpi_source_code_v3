import {
  ACCOUNT_PERMISSION_KEYS,
  ADMIN_ROLE,
  DEFAULT_ROLE,
  getPermissionTemplate as getRolePermissionTemplate,
  listRoleOptions,
  mergePermissions,
  normalizeRoleKey,
} from "../shared/accountRoles.js";

export const PERMISSION_KEYS = [...ACCOUNT_PERMISSION_KEYS];
export const ROLE_OPTIONS = listRoleOptions();
export { ADMIN_ROLE, DEFAULT_ROLE, TEAM_LEAD_ROLE, MANAGER_ROLE } from "../shared/accountRoles.js";

export function normalizeRole(role) {
  return normalizeRoleKey(role);
}

const MIN_PASSWORD_LENGTH = 6;

let sessionCache = null;
let accountCache = [];

const SESSION_TOKEN_STORAGE_KEY = 'kpi_session_token';
let sessionTokenCache = null;
let sessionTokenLoaded = false;

function getBrowserStorage() {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function loadSessionTokenFromStorage() {
  if (sessionTokenLoaded) {
    return sessionTokenCache;
  }
  sessionTokenLoaded = true;
  const storage = getBrowserStorage();
  if (!storage) {
    sessionTokenCache = null;
    return sessionTokenCache;
  }
  try {
    const value = storage.getItem(SESSION_TOKEN_STORAGE_KEY);
    if (value && typeof value === 'string') {
      const trimmed = value.trim();
      sessionTokenCache = trimmed ? trimmed : null;
    } else {
      sessionTokenCache = null;
    }
  } catch {
    sessionTokenCache = null;
  }
  return sessionTokenCache;
}

function setSessionToken(token) {
  const normalized = typeof token === 'string' ? token.trim() : '';
  sessionTokenCache = normalized || null;
  sessionTokenLoaded = true;
  const storage = getBrowserStorage();
  if (storage) {
    try {
      if (sessionTokenCache) {
        storage.setItem(SESSION_TOKEN_STORAGE_KEY, sessionTokenCache);
      } else {
        storage.removeItem(SESSION_TOKEN_STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }
  return sessionTokenCache;
}

export function getSessionToken() {
  return sessionTokenLoaded ? sessionTokenCache : loadSessionTokenFromStorage();
}

function normalizePermissions(perms, role) {
  const roleKey = normalizeRoleKey(role);
  return mergePermissions(roleKey, perms);
}

function normalizeUserRecord(record) {
  const username = String(record?.username || "").trim();
  if (!username) return null;
  const role = normalizeRoleKey(record?.role);
  const name = String(record?.name || username).trim();
  const permissions = normalizePermissions(record?.permissions, role);
  const memberId = typeof record?.memberId === "string" ? record.memberId.trim() : "";
  const memberName = typeof record?.memberName === "string" ? record.memberName.trim() : "";
  const teamId = typeof record?.teamId === "string" ? record.teamId.trim() : "";
  const teamName = typeof record?.teamName === "string" ? record.teamName.trim() : "";
  return {
    username,
    role,
    name,
    permissions,
    memberId: memberId || null,
    memberName: memberName || null,
    teamId: teamId || null,
    teamName: teamName || null,
  };
}

function setAccountCache(accounts) {
  const normalized = Array.isArray(accounts) ? accounts.map(normalizeUserRecord).filter(Boolean) : [];
  accountCache = normalized;
  return accountCache;
}

let apiBaseCache = null;

function resolveApiBase() {
  if (apiBaseCache !== null) {
    return apiBaseCache;
  }
  let base = "";
  if (typeof import.meta !== "undefined") {
    base = import.meta.env?.VITE_API_BASE ?? "";
  }
  if (typeof base !== "string") {
    base = "";
  }
  base = base.trim();
  apiBaseCache = base.endsWith("/") ? base.slice(0, -1) : base;
  return apiBaseCache;
}

export function buildUrl(path) {
  const base = resolveApiBase();
  if (!path) return base || "";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base || ""}${normalized}`;
}

export function createAuthHeaders(baseHeaders) {
  const headers =
    baseHeaders instanceof Headers ? new Headers(baseHeaders) : new Headers(baseHeaders || undefined);
  const token = getSessionToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

export function fetchWithAuth(path, init = {}) {
  if (typeof fetch !== 'function') {
    throw new Error('fetch khA\'ng kh??? d???ng');
  }
  const finalInit = { ...init };
  finalInit.headers = createAuthHeaders(init.headers);
  if (finalInit.credentials === undefined) {
    finalInit.credentials = 'include';
  }
  const target = buildUrl(path);
  return fetch(target, finalInit);
}

async function requestJson(path, { method = "GET", body } = {}) {
  const headers = new Headers();
  const init = { method, headers };
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(body);
  }
  const response = await fetchWithAuth(path, init);
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = payload?.error || payload?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

function sanitizeUserForSession(user) {
  if (!user) return null;
  const role = normalizeRoleKey(user.role);
  return {
    username: user.username,
    role,
    name: user.name || user.username,
    permissions: normalizePermissions(user.permissions, role),
  };
}

function setSessionFromUser(user) {
  if (!user) {
    sessionCache = null;
    setSessionToken(null);
    return null;
  }
  const session = { ...sanitizeUserForSession(user), ts: Date.now() };
  sessionCache = session;
  return session;
}

function syncSessionForUser(user) {
  if (sessionCache && user && sessionCache.username === user.username) {
    return setSessionFromUser(user);
  }
  return null;
}

function loadUsers() {
  return accountCache.slice();
}

export function getViewerAuth() {
  return {
    username: "guest",
    role: "viewer",
    name: "Khách",
    permissions: getRolePermissionTemplate(DEFAULT_ROLE),
  };
}

export async function login(usernameInput, passwordInput) {
  const username = String(usernameInput || "").trim();
  const password = String(passwordInput || "");
  if (!username || !password) {
    return { ok: false, error: "Sai tài khoản hoặc mật khẩu" };
  }
  try {
    const payload = await requestJson("/api/auth/login", {
      method: "POST",
      body: { username, password },
    });
    setSessionToken(payload?.token ?? null);
    const session = setSessionFromUser(payload?.user);
    await reloadAccounts().catch(() => {});
    return { ok: true, user: session };
  } catch (err) {
    return { ok: false, error: err?.message || "Sai tài khoản hoặc mật khẩu" };
  }
}

export async function loadSession() {
  try {
    const payload = await requestJson("/api/auth/session");
    const session = setSessionFromUser(payload?.user);
    if (payload?.token) {
      setSessionToken(payload.token);
    }
    if (payload?.user) {
      await reloadAccounts().catch(() => {});
    }
    return session;
  } catch (err) {
    setSessionFromUser(null);
    throw err;
  }
}

export async function logout() {
  try {
    await requestJson("/api/auth/logout", { method: "POST" });
  } catch {
    // bỏ qua lỗi đăng xuất
  } finally {
    setSessionFromUser(null);
  }
}

export function getAuth() {
  return sessionCache;
}

export function listAccounts() {
  return loadUsers();
}

export function getPermissionTemplate(role = DEFAULT_ROLE) {
  return getRolePermissionTemplate(role);
}

export async function reloadAccounts() {
  const payload = await requestJson("/api/auth/accounts");
  const accounts = setAccountCache(payload?.accounts ?? []);
  if (sessionCache) {
    const current = accounts.find((entry) => entry.username === sessionCache.username);
    if (current) {
      setSessionFromUser(current);
    }
  }
  return accounts;
}

export async function createAccount(payload, { actor = "system" } = {}) {
  const response = await requestJson("/api/auth/accounts", {
    method: "POST",
    body: { ...payload, actor },
  });
  setAccountCache(response?.accounts ?? []);
  return response?.account ?? null;
}

export async function updateAccount(usernameInput, patch, { actor = "system" } = {}) {
  const response = await requestJson(`/api/auth/accounts/${encodeURIComponent(usernameInput)}`, {
    method: "PATCH",
    body: { ...patch, actor },
  });
  const accounts = setAccountCache(response?.accounts ?? []);
  syncSessionForUser(response?.account);
  return response?.account ?? accounts.find((account) => account.username === usernameInput) ?? null;
}

export async function setAccountPassword(usernameInput, newPasswordInput, { actor = "system" } = {}) {
  const password = String(newPasswordInput || "").trim();
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Mật khẩu cần tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`);
  }
  const response = await requestJson(`/api/auth/accounts/${encodeURIComponent(usernameInput)}/password`, {
    method: "POST",
    body: { password, actor },
  });
  setAccountCache(response?.accounts ?? []);
  if (sessionCache?.username === usernameInput) {
    setSessionFromUser(null);
  }
  return true;
}

export async function deleteAccount(usernameInput, { actor = "system" } = {}) {
  const response = await requestJson(`/api/auth/accounts/${encodeURIComponent(usernameInput)}`, {
    method: "DELETE",
    body: { actor },
  });
  const accounts = setAccountCache(response?.accounts ?? []);
  const session = getAuth();
  if (session?.username === usernameInput) {
    setSessionFromUser(null);
  }
  return accounts;
}

export async function changeOwnPassword(usernameInput, currentPasswordInput, newPasswordInput) {
  const username = String(usernameInput || "").trim();
  const currentPassword = String(currentPasswordInput || "");
  const newPassword = String(newPasswordInput || "").trim();
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Mật khẩu mới cần tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`);
  }
  const response = await requestJson("/api/auth/password/change", {
    method: "POST",
    body: { username, currentPassword, newPassword },
  });
  setSessionToken(response?.token ?? null);
  await reloadAccounts().catch(() => {});
  const session = setSessionFromUser(response?.account);
  return session;
}
