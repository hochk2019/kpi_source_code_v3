export const PERMISSION_KEYS = [
  "importEdit",
  "mstEdit",
  "rulesEdit",
  "teamsEdit",
  "syncManage",
  "reportsExport",
  "alertsManage",
  "auditView",
  "accountManage",
];

const VIEW_ONLY_PERMISSIONS = Object.freeze({
  importEdit: false,
  mstEdit: false,
  rulesEdit: false,
  teamsEdit: false,
  syncManage: false,
  reportsExport: true,
  alertsManage: false,
  auditView: false,
  accountManage: false,
});

const ADMIN_PERMISSIONS = Object.freeze({
  importEdit: true,
  mstEdit: true,
  rulesEdit: true,
  teamsEdit: true,
  syncManage: true,
  reportsExport: true,
  alertsManage: true,
  auditView: true,
  accountManage: true,
});

const MIN_PASSWORD_LENGTH = 6;

let sessionCache = null;
let accountCache = [];

function normalizePermissions(perms, role) {
  const roleKey = role === "admin" ? "admin" : "staff";
  const base = roleKey === "admin" ? ADMIN_PERMISSIONS : VIEW_ONLY_PERMISSIONS;
  const normalized = { ...base };
  if (perms && typeof perms === "object") {
    for (const key of PERMISSION_KEYS) {
      if (key === "reportsExport") {
        normalized[key] = perms[key] !== false;
      } else {
        normalized[key] = !!perms[key];
      }
    }
  }
  if (roleKey === "admin") {
    normalized.accountManage = true;
  }
  return normalized;
}

function normalizeUserRecord(record) {
  const username = String(record?.username || "").trim();
  if (!username) return null;
  const role = record?.role === "admin" ? "admin" : "staff";
  const name = String(record?.name || username).trim();
  const permissions = normalizePermissions(record?.permissions, role);
  return { username, role, name, permissions };
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

function buildUrl(path) {
  const base = resolveApiBase();
  if (!path) return base || "";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base || ""}${normalized}`;
}

async function requestJson(path, { method = "GET", body } = {}) {
  if (typeof fetch !== "function") {
    throw new Error("fetch không khả dụng");
  }
  const headers = new Headers();
  const init = { method, headers, credentials: "include" };
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(body);
  }
  const response = await fetch(buildUrl(path), init);
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
  return {
    username: user.username,
    role: user.role === "admin" ? "admin" : "staff",
    name: user.name || user.username,
    permissions: normalizePermissions(user.permissions, user.role),
  };
}

function setSessionFromUser(user) {
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
  return {
    username: "guest",
    role: "viewer",
    name: "Khách",
    permissions: { ...VIEW_ONLY_PERMISSIONS },
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

export function getPermissionTemplate(role = "staff") {
  return normalizePermissions({}, role === "admin" ? "admin" : "staff");
}

export async function reloadAccounts() {
  try {
    const payload = await requestJson("/api/auth/accounts");
    const accounts = setAccountCache(payload?.accounts ?? []);
    if (sessionCache) {
      const current = accounts.find((entry) => entry.username === sessionCache.username);
      if (current) {
        setSessionFromUser(current);
      }
    }
    return accounts;
  } catch (err) {
    throw err;
  }
}

export async function createAccount(payload, { actor = "system" } = {}) {
  try {
    const response = await requestJson("/api/auth/accounts", {
      method: "POST",
      body: { ...payload, actor },
    });
    setAccountCache(response?.accounts ?? []);
    return response?.account ?? null;
  } catch (err) {
    throw err;
  }
}

export async function updateAccount(usernameInput, patch, { actor = "system" } = {}) {
  try {
    const response = await requestJson(`/api/auth/accounts/${encodeURIComponent(usernameInput)}`, {
      method: "PATCH",
      body: { ...patch, actor },
    });
    const accounts = setAccountCache(response?.accounts ?? []);
    syncSessionForUser(response?.account);
    return response?.account ?? accounts.find((account) => account.username === usernameInput) ?? null;
  } catch (err) {
    throw err;
  }
}

export async function setAccountPassword(usernameInput, newPasswordInput, { actor = "system" } = {}) {
  const password = String(newPasswordInput || "").trim();
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Mật khẩu cần tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`);
  }
  try {
    const response = await requestJson(`/api/auth/accounts/${encodeURIComponent(usernameInput)}/password`, {
      method: "POST",
      body: { password, actor },
    });
    setAccountCache(response?.accounts ?? []);
    if (sessionCache?.username === usernameInput) {
      setSessionFromUser(null);
    }
    return true;
  } catch (err) {
    throw err;
  }
}

export async function deleteAccount(usernameInput, { actor = "system" } = {}) {
  try {
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
  } catch (err) {
    throw err;
  }
}

export async function changeOwnPassword(usernameInput, currentPasswordInput, newPasswordInput) {
  const username = String(usernameInput || "").trim();
  const currentPassword = String(currentPasswordInput || "");
  const newPassword = String(newPasswordInput || "").trim();
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Mật khẩu mới cần tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`);
  }
  try {
    const response = await requestJson("/api/auth/password/change", {
      method: "POST",
      body: { username, currentPassword, newPassword },
    });
    await reloadAccounts().catch(() => {});
    const session = setSessionFromUser(response?.account);
    return session;
  } catch (err) {
    throw err;
  }
}
