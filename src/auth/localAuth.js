import {

  ACCOUNT_PERMISSION_KEYS,

  ADMIN_ROLE,

  DEFAULT_ROLE,

  getPermissionTemplate as getRolePermissionTemplate,

  listRoleOptions,

  mergePermissions,

  normalizeRoleKey,

} from "../../packages/domain/src/accountRoles.js";



export const PERMISSION_KEYS = [...ACCOUNT_PERMISSION_KEYS];

export const ROLE_OPTIONS = listRoleOptions();

export { ADMIN_ROLE, DEFAULT_ROLE, TEAM_LEAD_ROLE, MANAGER_ROLE } from "../../packages/domain/src/accountRoles.js";



export function normalizeRole(role) {

  return normalizeRoleKey(role);

}



const MIN_PASSWORD_LENGTH = 6;



let sessionCache = null;

let accountCache = [];



const LEGACY_SESSION_TOKEN_STORAGE_KEY = 'kpi_session_token';



function clearLegacySessionToken() {

  if (typeof window === 'undefined') {

    return;

  }

  try {

    window.localStorage?.removeItem(LEGACY_SESSION_TOKEN_STORAGE_KEY);

  } catch {

    // ignore storage errors

  }

}



export function getSessionToken() {

  clearLegacySessionToken();

  return null;

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

  clearLegacySessionToken();

  const headers =

    baseHeaders instanceof Headers ? new Headers(baseHeaders) : new Headers(baseHeaders || undefined);

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

  const memberId = typeof user.memberId === "string" ? user.memberId.trim() : "";

  const memberName = typeof user.memberName === "string" ? user.memberName.trim() : "";

  const teamId = typeof user.teamId === "string" ? user.teamId.trim() : "";

  const teamName = typeof user.teamName === "string" ? user.teamName.trim() : "";

  return {

    username: user.username,

    role,

    name: user.name || user.username,

    permissions: normalizePermissions(user.permissions, role),

    memberId: memberId || null,

    memberName: memberName || null,

    teamId: teamId || null,

    teamName: teamName || null,

  };

}



function setSessionFromUser(user) {

  clearLegacySessionToken();

  if (!user) {

    sessionCache = null;

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

  const permissions = getRolePermissionTemplate(DEFAULT_ROLE);

  permissions.adjustSubmit = false;
  permissions.adjustApprove = false;
  permissions.adjustOverridePoints = false;

  return {

    username: "guest",

    role: "viewer",

    name: "Khách",

    permissions,

    memberId: null,

    memberName: null,

    teamId: null,

    teamName: null,

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



export async function createAccount(payload) {

  const response = await requestJson("/api/auth/accounts", {

    method: "POST",

    body: { ...payload },

  });

  setAccountCache(response?.accounts ?? []);

  return response?.account ?? null;

}



export async function updateAccount(usernameInput, patch) {

  const response = await requestJson(`/api/auth/accounts/${encodeURIComponent(usernameInput)}`, {

    method: "PATCH",

    body: { ...patch },

  });

  const accounts = setAccountCache(response?.accounts ?? []);

  syncSessionForUser(response?.account);

  return response?.account ?? accounts.find((account) => account.username === usernameInput) ?? null;

}



export async function setAccountPassword(usernameInput, newPasswordInput) {

  const password = String(newPasswordInput || "").trim();

  if (password.length < MIN_PASSWORD_LENGTH) {

    throw new Error(`Mật khẩu cần tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`);

  }

  const response = await requestJson(`/api/auth/accounts/${encodeURIComponent(usernameInput)}/password`, {

    method: "POST",

    body: { password },

  });

  setAccountCache(response?.accounts ?? []);

  if (sessionCache?.username === usernameInput) {

    setSessionFromUser(null);

  }

  return true;

}



export async function deleteAccount(usernameInput) {

  const response = await requestJson(`/api/auth/accounts/${encodeURIComponent(usernameInput)}`, {

    method: "DELETE",

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

  await reloadAccounts().catch(() => {});

  const session = setSessionFromUser(response?.account);

  return session;

}

