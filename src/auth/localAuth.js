import {

  ACCOUNT_PERMISSION_KEYS,

  ADMIN_ROLE,

  DEFAULT_ROLE,

  getPermissionTemplate as getRolePermissionTemplate,

  listRoleOptions,

  mergePermissions,

  normalizeRoleKey,

} from "../../packages/domain/src/accountRoles.js";
import {
  getNewPasswordMinLengthMessage,
  getPasswordMinLengthMessage,
  MIN_PASSWORD_LENGTH,
} from "../../packages/domain/src/passwordPolicy.js";



export const PERMISSION_KEYS = [...ACCOUNT_PERMISSION_KEYS];

export const ROLE_OPTIONS = listRoleOptions();

export { ADMIN_ROLE, DEFAULT_ROLE, TEAM_LEAD_ROLE, MANAGER_ROLE } from "../../packages/domain/src/accountRoles.js";
export {
  getNewPasswordMinLengthMessage,
  getPasswordMinLengthMessage,
  getPasswordMinLengthPlaceholder,
  MIN_PASSWORD_LENGTH,
} from "../../packages/domain/src/passwordPolicy.js";



export function normalizeRole(role) {

  return normalizeRoleKey(role);

}



let sessionCache = null;

let accountCache = [];



const LEGACY_SESSION_TOKEN_STORAGE_KEY = 'kpi_session_token';
const CSRF_COOKIE_NAME = 'kpi_csrf';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const UNSAFE_HTTP_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const LEGACY_AUTH_BASE = '/api/auth';



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

function normalizeApiBase(rawBase) {
  if (typeof rawBase !== "string") {
    return "";
  }

  const trimmed = rawBase.trim();
  if (!trimmed || trimmed === "/") {
    return "";
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function shouldPreferDevProxy(base) {
  if (!base) {
    return false;
  }

  if (typeof window === "undefined") {
    return false;
  }

  if (typeof import.meta === "undefined" || import.meta.env?.DEV !== true) {
    return false;
  }

  if (!(base.startsWith("http://") || base.startsWith("https://"))) {
    return false;
  }

  try {
    const targetOrigin = new URL(base).origin;
    return targetOrigin !== window.location.origin;
  } catch {
    return false;
  }
}



function resolveApiBase() {

  if (apiBaseCache !== null) {

    return apiBaseCache;

  }

  let base = "";

  if (typeof import.meta !== "undefined") {

    base = import.meta.env?.VITE_API_BASE ?? "";

  }

  const normalizedBase = normalizeApiBase(base);
  apiBaseCache = shouldPreferDevProxy(normalizedBase) ? "" : normalizedBase;

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

function readCookie(name) {

  if (typeof document === 'undefined') {

    return '';

  }

  const entries = `${document.cookie || ''}`.split(';');
  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed.startsWith(`${name}=`)) {
      continue;
    }
    return decodeURIComponent(trimmed.slice(name.length + 1));
  }

  return '';

}

function shouldAttachCsrfHeader(method) {

  return UNSAFE_HTTP_METHODS.has(`${method || 'GET'}`.trim().toUpperCase());

}



export function fetchWithAuth(path, init = {}) {

  if (typeof fetch !== 'function') {

    throw new Error('fetch khA\'ng kh??? d???ng');

  }

  const finalInit = { ...init };

  finalInit.headers = createAuthHeaders(init.headers);
  if (shouldAttachCsrfHeader(finalInit.method) && !finalInit.headers.has(CSRF_HEADER_NAME)) {
    const csrfToken = readCookie(CSRF_COOKIE_NAME);
    if (csrfToken) {
      finalInit.headers.set(CSRF_HEADER_NAME, csrfToken);
    }
  }

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
    const error = new Error(message);
    error.status = response.status;
    throw error;

  }

  return payload;

}

function readResponseData(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const data = payload.data;
  return data && typeof data === "object" ? data : null;
}

function readAuthUser(payload) {
  const data = readResponseData(payload);
  return data?.user ?? payload?.user ?? data?.account ?? payload?.account ?? null;
}

function readAuthAccount(payload) {
  const data = readResponseData(payload);
  return data?.account ?? payload?.account ?? null;
}

function readAuthAccounts(payload) {
  const data = readResponseData(payload);
  const accounts = data?.accounts ?? payload?.accounts ?? [];
  return Array.isArray(accounts) ? accounts : [];
}

function isRouteNotFoundError(error) {
  if (!error) {
    return false;
  }

  if (Number(error.status) === 404) {
    return true;
  }

  const message = String(error.message || "").trim().toLowerCase();
  return message.includes("http 404") || message.includes("not found");
}

async function requestJsonWithFallback(paths, options = {}) {
  const candidates = Array.isArray(paths) ? paths.filter(Boolean) : [paths].filter(Boolean);
  if (!candidates.length) {
    throw new Error("Thiếu đường dẫn API để gọi");
  }

  let lastError = null;
  for (let index = 0; index < candidates.length; index += 1) {
    const path = candidates[index];
    const hasNextCandidate = index < candidates.length - 1;
    try {
      return await requestJson(path, options);
    } catch (error) {
      lastError = error;
      if (!hasNextCandidate || !isRouteNotFoundError(error)) {
        throw error;
      }
    }
  }

  throw lastError || new Error("Không thể hoàn tất yêu cầu API");
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

function authRoutes(...segments) {
  const normalizedSegments = segments
    .map((segment) => String(segment || "").replace(/^\/+|\/+$/g, ""))
    .filter(Boolean);
  const suffix = normalizedSegments.length ? `/${normalizedSegments.join("/")}` : "";
  return [`/api/v4/auth${suffix}`, `${LEGACY_AUTH_BASE}${suffix}`];
}

const AUTH_LOGIN_ROUTES = [...authRoutes("login"), "/api/login"];
const AUTH_SESSION_ROUTES = [...authRoutes("session"), "/api/session"];
const AUTH_LOGOUT_ROUTES = [...authRoutes("logout"), "/api/logout"];
const AUTH_ACCOUNTS_ROUTES = authRoutes("accounts");

function toUserFacingLoginError(error) {
  const status = Number(error?.status);
  const rawMessage = String(error?.message || "").trim();
  const normalized = rawMessage.toLowerCase();

  if (!rawMessage) {
    return "Không đăng nhập được. Vui lòng thử lại.";
  }

  if (
    normalized.includes("sai tài khoản") ||
    normalized.includes("sai mat khau") ||
    normalized.includes("invalid credential") ||
    status === 401
  ) {
    return "Sai tài khoản hoặc mật khẩu";
  }

  if (status === 404 || normalized.includes("http 404")) {
    return "Không tìm thấy API đăng nhập. Vui lòng kiểm tra API base/proxy.";
  }

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("load failed") ||
    normalized.includes("cors") ||
    normalized.includes("err_network")
  ) {
    return "Không kết nối được máy chủ đăng nhập. Vui lòng kiểm tra proxy/CORS.";
  }

  if (status === 429 || normalized.includes("too many request")) {
    return "Bạn thử đăng nhập quá nhiều lần. Vui lòng đợi một lúc rồi thử lại.";
  }

  return rawMessage;
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

    const payload = await requestJsonWithFallback(AUTH_LOGIN_ROUTES, {

      method: "POST",

      body: { username, password },

    });

    const session = setSessionFromUser(readAuthUser(payload));

    await reloadAccounts().catch(() => {});

    return { ok: true, user: session };

  } catch (err) {

    return { ok: false, error: toUserFacingLoginError(err) };

  }

}



export async function loadSession() {

  try {

    const payload = await requestJsonWithFallback(AUTH_SESSION_ROUTES);

    const sessionUser = readAuthUser(payload);
    const session = setSessionFromUser(sessionUser);

    if (sessionUser) {

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

    await requestJsonWithFallback(AUTH_LOGOUT_ROUTES, { method: "POST" });

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

  const payload = await requestJsonWithFallback(AUTH_ACCOUNTS_ROUTES);

  const accounts = setAccountCache(readAuthAccounts(payload));

  if (sessionCache) {

    const current = accounts.find((entry) => entry.username === sessionCache.username);

    if (current) {

      setSessionFromUser(current);

    }

  }

  return accounts;

}



export async function createAccount(payload) {

  const response = await requestJsonWithFallback(AUTH_ACCOUNTS_ROUTES, {

    method: "POST",

    body: { ...payload },

  });

  setAccountCache(readAuthAccounts(response));

  return readAuthAccount(response);

}



export async function updateAccount(usernameInput, patch) {

  const response = await requestJsonWithFallback(authRoutes("accounts", encodeURIComponent(usernameInput)), {

    method: "PATCH",

    body: { ...patch },

  });

  const accounts = setAccountCache(readAuthAccounts(response));
  const updatedAccount = readAuthAccount(response);

  syncSessionForUser(updatedAccount);

  return updatedAccount ?? accounts.find((account) => account.username === usernameInput) ?? null;

}



export async function setAccountPassword(usernameInput, newPasswordInput) {

  const password = String(newPasswordInput || "").trim();

  if (password.length < MIN_PASSWORD_LENGTH) {

    throw new Error(getPasswordMinLengthMessage());

  }

  const response = await requestJsonWithFallback(
    authRoutes("accounts", encodeURIComponent(usernameInput), "password"),
    {

      method: "POST",

      body: { password },

    },
  );

  setAccountCache(readAuthAccounts(response));

  if (sessionCache?.username === usernameInput) {

    setSessionFromUser(null);

  }

  return true;

}



export async function deleteAccount(usernameInput) {

  const response = await requestJsonWithFallback(authRoutes("accounts", encodeURIComponent(usernameInput)), {

    method: "DELETE",

  });

  const accounts = setAccountCache(readAuthAccounts(response));

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

    throw new Error(getNewPasswordMinLengthMessage());

  }

  const response = await requestJsonWithFallback(authRoutes("password", "change"), {

    method: "POST",

    body: { username, currentPassword, newPassword },

  });

  await reloadAccounts().catch(() => {});

  const session = setSessionFromUser(readAuthAccount(response) ?? readAuthUser(response));

  return session;

}

