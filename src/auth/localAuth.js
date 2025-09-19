import { pushAuditLog } from "@/lib/store.js";
import { getItem as getStorageItem, setItem as setStorageItem } from "@/lib/storageClient.js";

const SESSION_KEY = "kpi_auth";
const USERS_KEY = "kpi_users_v1";

export const PERMISSION_KEYS = [
  "importEdit",
  "mstEdit",
  "rulesEdit",
  "teamsEdit",
  "reportsExport",
  "accountManage",
];

const VIEW_ONLY_PERMISSIONS = Object.freeze({
  importEdit: false,
  mstEdit: false,
  rulesEdit: false,
  teamsEdit: false,
  reportsExport: true,
  accountManage: false,
});

const ADMIN_PERMISSIONS = Object.freeze({
  importEdit: true,
  mstEdit: true,
  rulesEdit: true,
  teamsEdit: true,
  reportsExport: true,
  accountManage: true,
});

const RAW_DEFAULT_USERS = [
  {
    username: "admin",
    password: "admin123",
    role: "admin",
    name: "Quản trị viên",
    permissions: ADMIN_PERMISSIONS,
  },
  {
    username: "nhanvien",
    password: "123456",
    role: "staff",
    name: "Nhân viên",
    permissions: {
      ...VIEW_ONLY_PERMISSIONS,
      importEdit: true,
    },
  },
];

function safeParse(json, fallback) {
  try {
    const parsed = JSON.parse(json);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

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
  const password = String(record?.password || "");
  const permissions = normalizePermissions(record?.permissions, role);
  return { username, password, role, name, permissions };
}

function persistUsers(users) {
  const normalized = users.map(normalizeUserRecord).filter(Boolean);
  normalized.sort((a, b) => a.username.localeCompare(b.username, "vi", { sensitivity: "base" }));
  setStorageItem(USERS_KEY, JSON.stringify(normalized));
  return normalized;
}

function loadUsers() {
  const raw = safeParse(getStorageItem(USERS_KEY), null);
  let normalized = Array.isArray(raw) ? raw.map(normalizeUserRecord).filter(Boolean) : [];
  if (!normalized.length) {
    normalized = RAW_DEFAULT_USERS.map(normalizeUserRecord).filter(Boolean);
    setStorageItem(USERS_KEY, JSON.stringify(normalized));
  }
  normalized.sort((a, b) => a.username.localeCompare(b.username, "vi", { sensitivity: "base" }));
  return normalized;
}

function sanitizeUserForSession(user) {
  return {
    username: user.username,
    role: user.role,
    name: user.name,
    permissions: normalizePermissions(user.permissions, user.role),
  };
}

function setSessionFromUser(user) {
  if (!user) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  const session = { ...sanitizeUserForSession(user), ts: Date.now() };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

function syncSessionForUser(user) {
  const current = getAuth();
  if (current && current.username === user.username) {
    return setSessionFromUser(user);
  }
  return null;
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
  const users = loadUsers();
  const user = users.find((entry) => entry.username.toLowerCase() === username.toLowerCase());
  if (user && user.password === password) {
    const session = setSessionFromUser(user);
    pushAuditLog({ actor: user.username, action: "auth.login", detail: "Đăng nhập thành công" });
    return { ok: true, user: session };
  }
  pushAuditLog({ actor: username || "unknown", action: "auth.login_fail", detail: "Đăng nhập thất bại" });
  return { ok: false, error: "Sai tài khoản hoặc mật khẩu" };
}

export function logout(actorName) {
  const session = getAuth();
  localStorage.removeItem(SESSION_KEY);
  if (session) {
    pushAuditLog({ actor: actorName || session.username, action: "auth.logout", detail: "Đăng xuất khỏi hệ thống" });
  }
}

export function getAuth() {
  try {
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (!stored) return null;
    const users = loadUsers();
    const user = users.find((entry) => entry.username === stored.username);
    if (!user) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return { ...sanitizeUserForSession(user), ts: stored.ts || Date.now() };
  } catch {
    return null;
  }
}

export function listAccounts() {
  return loadUsers().map((user) => sanitizeUserForSession(user));
}

export function getPermissionTemplate(role = "staff") {
  return normalizePermissions({}, role === "admin" ? "admin" : "staff");
}

export function createAccount(payload, { actor = "system" } = {}) {
  const users = loadUsers();
  const usernameRaw = String(payload?.username || "").trim();
  if (!usernameRaw) throw new Error("Vui lòng nhập tài khoản");
  const username = usernameRaw;
  const key = username.toLowerCase();
  if (users.some((user) => user.username.toLowerCase() === key)) {
    throw new Error("Tài khoản đã tồn tại");
  }
  const password = String(payload?.password || "").trim();
  if (password.length < 6) {
    throw new Error("Mật khẩu cần tối thiểu 6 ký tự");
  }
  const role = payload?.role === "admin" ? "admin" : "staff";
  const name = String(payload?.name || username).trim();
  const permissions = normalizePermissions(payload?.permissions, role);
  const updated = persistUsers([...users, { username, password, role, name, permissions }]);
  const created = updated.find((user) => user.username === username);
  if (created) {
    pushAuditLog({ actor, action: "account.create", detail: `Tạo tài khoản ${username} (${role})` });
  }
  return sanitizeUserForSession(created);
}

export function updateAccount(usernameInput, patch, { actor = "system" } = {}) {
  const users = loadUsers();
  const username = String(usernameInput || "").trim();
  const index = users.findIndex((user) => user.username === username);
  if (index < 0) throw new Error("Không tìm thấy tài khoản");
  const current = users[index];
  const nextRole = patch?.role === "admin" ? "admin" : current.role;
  if (current.role === "admin" && nextRole !== "admin") {
    const admins = users.filter((user) => user.role === "admin");
    if (admins.length <= 1) {
      throw new Error("Cần ít nhất một quản trị viên");
    }
  }
  const displayName = patch?.name ?? current.name ?? current.username;
  const next = {
    ...current,
    role: nextRole,
    name: String(displayName || "").trim(),
    permissions: normalizePermissions(patch?.permissions ?? current.permissions, nextRole),
  };
  const updated = persistUsers([
    ...users.slice(0, index),
    next,
    ...users.slice(index + 1),
  ]);
  const refreshed = updated.find((user) => user.username === username) || next;
  syncSessionForUser(refreshed);
  pushAuditLog({ actor, action: "account.update", detail: `Cập nhật tài khoản ${username}` });
  return sanitizeUserForSession(refreshed);
}

export function setAccountPassword(usernameInput, newPasswordInput, { actor = "system" } = {}) {
  const username = String(usernameInput || "").trim();
  const newPassword = String(newPasswordInput || "").trim();
  if (newPassword.length < 6) {
    throw new Error("Mật khẩu cần tối thiểu 6 ký tự");
  }
  const users = loadUsers();
  const index = users.findIndex((user) => user.username === username);
  if (index < 0) throw new Error("Không tìm thấy tài khoản");
  const next = { ...users[index], password: newPassword };
  const updated = persistUsers([
    ...users.slice(0, index),
    next,
    ...users.slice(index + 1),
  ]);
  const refreshed = updated.find((user) => user.username === username) || next;
  syncSessionForUser(refreshed);
  pushAuditLog({ actor, action: "account.reset_password", detail: `Đặt lại mật khẩu cho ${username}` });
  return true;
}

export function deleteAccount(usernameInput, { actor = "system" } = {}) {
  const username = String(usernameInput || "").trim();
  const users = loadUsers();
  const index = users.findIndex((user) => user.username === username);
  if (index < 0) throw new Error("Không tìm thấy tài khoản");
  const target = users[index];
  if (target.role === "admin") {
    const admins = users.filter((user) => user.role === "admin");
    if (admins.length <= 1) {
      throw new Error("Không thể xoá quản trị viên cuối cùng");
    }
  }
  const remaining = persistUsers([
    ...users.slice(0, index),
    ...users.slice(index + 1),
  ]);
  const session = getAuth();
  if (session?.username === username) {
    localStorage.removeItem(SESSION_KEY);
  }
  pushAuditLog({ actor, action: "account.delete", detail: `Xóa tài khoản ${username}` });
  return remaining.map((user) => sanitizeUserForSession(user));
}

export function changeOwnPassword(usernameInput, currentPasswordInput, newPasswordInput) {
  const username = String(usernameInput || "").trim();
  const currentPassword = String(currentPasswordInput || "");
  const newPassword = String(newPasswordInput || "").trim();
  if (newPassword.length < 6) {
    throw new Error("Mật khẩu mới cần tối thiểu 6 ký tự");
  }
  const users = loadUsers();
  const index = users.findIndex((user) => user.username === username);
  if (index < 0) throw new Error("Không tìm thấy tài khoản");
  if (users[index].password !== currentPassword) {
    throw new Error("Mật khẩu hiện tại không đúng");
  }
  const next = { ...users[index], password: newPassword };
  const updated = persistUsers([
    ...users.slice(0, index),
    next,
    ...users.slice(index + 1),
  ]);
  const refreshed = updated.find((user) => user.username === username) || next;
  const session = setSessionFromUser(refreshed);
  pushAuditLog({ actor: username, action: "account.change_password", detail: "Đổi mật khẩu cá nhân" });
  return session;
}
