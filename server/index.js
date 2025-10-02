import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import process from 'node:process';
import Database from 'better-sqlite3';
import cron from 'node-cron';
import sql from 'mssql';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { generateReport } from './reportExport.js';
import { DEFAULT_RULES as SHARED_DEFAULT_RULES } from '../src/shared/defaultRules.js';
import { deriveCOStatus, parseCoLineCount } from '../src/shared/co.js';
import { recordSqlTimeout } from './sqlMonitor.js';

const moduleUrl = typeof import.meta !== 'undefined' ? import.meta.url || '' : '';
const __dirname = moduleUrl.startsWith('file:')
  ? fileURLToPath(new URL('.', moduleUrl))
  : path.resolve(process.cwd(), 'server');
function resolveDbFile(value) {
  if (!value) {
    return path.resolve(__dirname, 'data/storage.sqlite');
  }
  if (value === ':memory:') {
    return ':memory:';
  }
  if (path.isAbsolute(value)) {
    return value;
  }
  return path.resolve(__dirname, value);
}

function normalizeRangeDate(value, { isEnd = false } = {}) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    if (isEnd) {
      const end = new Date(value.getTime());
      end.setHours(23, 59, 59, 999);
      return end;
    }
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    if (isEnd) {
      date.setHours(23, 59, 59, 999);
    }
    return date;
  }

  const str = `${value}`.trim();
  if (!str) {
    return null;
  }

  const dateOnlyMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (dateOnlyMatch) {
    const [, yearRaw, monthRaw, dayRaw] = dateOnlyMatch;
    const year = Number.parseInt(yearRaw, 10);
    const month = Number.parseInt(monthRaw, 10);
    const day = Number.parseInt(dayRaw, 10);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }
    if (isEnd) {
      return new Date(year, month - 1, day, 23, 59, 59, 999);
    }
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export const DB_FILE = resolveDbFile(process.env.KPI_DB_FILE);
const LEGACY_JSON = path.resolve(__dirname, 'data/db.json');
const DIST_DIR = path.resolve(__dirname, '../dist');

const DEFAULT_ECUS_SYNC_CONFIG = {
  enabled: false,
  schedule: '0 * * * *',
  rangeDays: 1,
  preferMonthFirst: false,
  batchSize: 500,
  connection: {
    server: '',
    database: '',
    user: '',
    password: '',
    options: { encrypt: false, trustServerCertificate: true },
  },
  query:
    'SELECT so_tk, ngay_dang_ky, loai_hinh, mst, cong_ty, muc_hang, licenses, nhan_vien_nhap, nhan_vien_xuat FROM v_kpi_declarations WHERE ngay_dang_ky BETWEEN @from AND @to',
  columnMap: {
    so_tk: 'so_tk',
    date: 'ngay_dang_ky',
    loai_hinh: 'loai_hinh',
    mst: 'mst',
    cong_ty: 'cong_ty',
    num_items: 'muc_hang',
    licenses: 'licenses',
    nhan_vien_import: 'nhan_vien_nhap',
    nhan_vien_export: 'nhan_vien_xuat',
    co_count: 'co_count_num',
  },
  lastRun: null,
  lastStatus: null,
  lastSummary: null,
};

const DEFAULT_ALERT_CONFIG = {
  enabled: true,
  thresholdDays: 2,
  autoResolveReviewed: true,
  channel: 'audit',
};

const DEFAULT_ALERT_STATE = {
  entries: {},
  lastEvaluatedAt: null,
};

const ACCOUNT_PERMISSION_KEYS = [
  'importEdit',
  'mstEdit',
  'rulesEdit',
  'teamsEdit',
  'syncManage',
  'reportsExport',
  'alertsManage',
  'auditView',
  'accountManage',
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

const PASSWORD_SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 6;
const SESSION_COOKIE_NAME = 'kpi_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày

function shouldUseSecureCookies(req) {
  const preference = (process.env.KPI_COOKIE_SECURE || '').toString().trim().toLowerCase();
  if (['always', 'true', '1'].includes(preference)) {
    return true;
  }
  if (['never', 'false', '0'].includes(preference)) {
    return false;
  }
  const forwardedProto = req?.headers?.['x-forwarded-proto'];
  const proto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : typeof forwardedProto === 'string'
    ? forwardedProto.split(',')[0]
    : '';
  const normalizedProto = proto.trim().toLowerCase();
  return req?.secure || normalizedProto === 'https';
}

const DEFAULT_ACCOUNT_SEED = [
  {
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    name: 'Quản trị viên',
    permissions: ADMIN_PERMISSIONS,
  },
  {
    username: 'nhanvien',
    password: '123456',
    role: 'staff',
    name: 'Nhân viên',
    permissions: {
      ...VIEW_ONLY_PERMISSIONS,
      importEdit: true,
      reportsExport: true,
    },
  },
];

const STORAGE_PERMISSION_REQUIREMENTS = Object.freeze({
  decl_rows_v1: 'importEdit',
  import_logs_v1: 'importEdit',
  mst_rows_v2: 'mstEdit',
  team_roster_v1: 'teamsEdit',
  kpi_rules_v2: 'rulesEdit',
  hq_agencies_v1: 'mstEdit',
  decl_alert_config_v1: 'alertsManage',
  decl_alert_state_v1: 'alertsManage',
  ecus_sync_config_v1: 'syncManage',
});

function normalizePermissionsForRole(permissions, role = 'staff') {
  const roleKey = role === 'admin' ? 'admin' : 'staff';
  const base = roleKey === 'admin' ? ADMIN_PERMISSIONS : VIEW_ONLY_PERMISSIONS;
  const normalized = { ...base };
  if (permissions && typeof permissions === 'object') {
    for (const key of ACCOUNT_PERMISSION_KEYS) {
      if (key === 'reportsExport') {
        normalized[key] = permissions[key] !== false;
      } else {
        normalized[key] = !!permissions[key];
      }
    }
  }
  if (roleKey === 'admin') {
    normalized.accountManage = true;
  }
  return normalized;
}

function buildDefaultAccounts() {
  return DEFAULT_ACCOUNT_SEED.map((entry) => ({
    username: entry.username,
    passwordHash: bcrypt.hashSync(entry.password, PASSWORD_SALT_ROUNDS),
    role: entry.role,
    name: entry.name,
    permissions: normalizePermissionsForRole(entry.permissions, entry.role),
  }));
}

const DEFAULT_STORAGE = {
  decl_rows_v1: '[]',
  mst_rows_v2: '[]',
  kpi_rules_v2: JSON.stringify(SHARED_DEFAULT_RULES),
  team_roster_v1: JSON.stringify({
    version: 1,
    teams: [
      {
        id: 'team-1',
        name: 'Team 1',
        members: [
          { id: 'team-1-phuong', name: 'Phương' },
          { id: 'team-1-hanh', name: 'Hạnh' },
          { id: 'team-1-bao', name: 'Bảo' },
          { id: 'team-1-ha-be', name: 'Hà Bé' },
          { id: 'team-1-huong', name: 'Hương' },
        ],
      },
      {
        id: 'team-2',
        name: 'Team 2',
        members: [
          { id: 'team-2-tuan', name: 'Tuấn' },
          { id: 'team-2-hoa', name: 'Hòa' },
          { id: 'team-2-thu', name: 'Thu' },
          { id: 'team-2-hang', name: 'Hằng' },
          { id: 'team-2-huyen', name: 'Huyền' },
        ],
      },
      {
        id: 'team-3',
        name: 'Team 3',
        members: [
          { id: 'team-3-hoc', name: 'Học' },
          { id: 'team-3-thanh', name: 'Thanh' },
          { id: 'team-3-huy', name: 'Huy' },
          { id: 'team-3-linh', name: 'Linh' },
          { id: 'team-3-thao', name: 'Thảo' },
          { id: 'team-3-hung', name: 'Hưng' },
        ],
      },
    ],
  }),
  audit_logs_v1: '[]',
  import_logs_v1: '[]',
  hq_agencies_v1: '[]',
  ecus_sync_config_v1: JSON.stringify(DEFAULT_ECUS_SYNC_CONFIG),
  decl_alert_config_v1: JSON.stringify(DEFAULT_ALERT_CONFIG),
  decl_alert_state_v1: JSON.stringify(DEFAULT_ALERT_STATE),
  kpi_users_v1: JSON.stringify(buildDefaultAccounts()),
};

function normalizeValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export async function initializeDatabase({ dbFile = DB_FILE } = {}) {
  if (dbFile !== ':memory:') {
    await fs.mkdir(path.dirname(dbFile), { recursive: true });
  }
  const database = new Database(dbFile);
  database.pragma('journal_mode = WAL');
  database.exec(
    'CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)'
  );
  database.exec(
    'CREATE TABLE IF NOT EXISTS auth_sessions (token TEXT PRIMARY KEY, username TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)'
  );
  database.exec(
    'CREATE INDEX IF NOT EXISTS idx_auth_sessions_username ON auth_sessions(username)'
  );

  let seedData = { ...DEFAULT_STORAGE };
  try {
    const raw = await fs.readFile(LEGACY_JSON, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      seedData = { ...seedData, ...parsed };
    }
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      console.warn('Không thể đọc dữ liệu JSON cũ, tiếp tục với giá trị mặc định.', err);
    }
  }

  const existingKeys = new Set(
    database
      .prepare('SELECT key FROM kv_store')
      .all()
      .map((row) => row.key)
  );

  if (existingKeys.size === 0) {
    const insertMany = database.transaction((entries) => {
      const stmt = database.prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)');
      for (const [key, value] of entries) {
        stmt.run(key, normalizeValue(value));
      }
    });
    insertMany(Object.entries(seedData));
  } else {
    const missingEntries = Object.entries(seedData).filter(([key]) => !existingKeys.has(key));
    if (missingEntries.length > 0) {
      const insertMissing = database.transaction((entries) => {
        const stmt = database.prepare(
          'INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING'
        );
        for (const [key, value] of entries) {
          stmt.run(key, normalizeValue(value));
        }
      });
      insertMissing(missingEntries);
    }
  }

  return database;
}

const db = await initializeDatabase();

function pruneExpiredSessions() {
  try {
    db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(Date.now());
  } catch (err) {
    console.error('Không thể dọn dẹp phiên đăng nhập đã hết hạn', err);
  }
}

function parseCookies(header) {
  if (!header || typeof header !== 'string') {
    return {};
  }
  return header.split(';').reduce((acc, part) => {
    const [name, ...rest] = part.split('=');
    if (!name) return acc;
    const key = name.trim();
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('=')?.trim() ?? '');
    return acc;
  }, {});
}

function getSessionTokenFromRequest(req) {
  const cookies = parseCookies(req.headers?.cookie || '');
  return cookies[SESSION_COOKIE_NAME] || '';
}

function findAccountRecord(username) {
  if (!username) return null;
  const accounts = loadAccountRecords();
  return accounts.find((record) => record.username === username) || null;
}

function getSessionContext(req) {
  const token = getSessionTokenFromRequest(req);
  if (!token) return null;
  const row = db
    .prepare('SELECT token, username, created_at, expires_at FROM auth_sessions WHERE token = ?')
    .get(token);
  if (!row) {
    return null;
  }
  if (row.expires_at <= Date.now()) {
    deleteSessionToken(token);
    return null;
  }
  const account = findAccountRecord(row.username);
  if (!account) {
    deleteSessionToken(token);
    return null;
  }
  return { token: row.token, expiresAt: row.expires_at, account };
}

function setSessionCookie(req, res, token, expiresAt) {
  const secure = shouldUseSecureCookies(req);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    expires: new Date(expiresAt),
  });
}

function clearSessionCookie(req, res) {
  const secure = shouldUseSecureCookies(req);
  res.cookie(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    expires: new Date(0),
  });
}

function createSessionForUser(username) {
  if (!username) {
    throw new Error('Thiếu tài khoản để tạo phiên');
  }
  pruneExpiredSessions();
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  db.prepare('INSERT INTO auth_sessions (token, username, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    token,
    username,
    now,
    expiresAt
  );
  return { token, expiresAt };
}

function deleteSessionToken(token) {
  if (!token) return;
  try {
    db.prepare('DELETE FROM auth_sessions WHERE token = ?').run(token);
  } catch (err) {
    console.error('Không thể xoá phiên đăng nhập', err);
  }
}

function deleteSessionsForUser(username) {
  if (!username) return;
  try {
    db.prepare('DELETE FROM auth_sessions WHERE username = ?').run(username);
  } catch (err) {
    console.error('Không thể xoá phiên của người dùng', err);
  }
}

function resolveActor(req, fallback = 'api') {
  const session = getSessionContext(req);
  if (session?.account?.username) {
    return session.account.username;
  }
  if (req.body?.actor) {
    return req.body.actor;
  }
  if (req.query?.actor) {
    return req.query.actor;
  }
  return fallback;
}

function verifyStoragePermission(req, res, key) {
  const required = STORAGE_PERMISSION_REQUIREMENTS[key];
  if (!required) {
    return { context: getSessionContext(req), required, denied: false };
  }
  const context = getSessionContext(req);
  if (!context) {
    res.status(401).json({ ok: false, error: 'Bạn cần đăng nhập để thao tác với dữ liệu này' });
    return { context: null, required, denied: true };
  }
  const allowed = context.account?.permissions?.[required];
  if (!allowed) {
    res.status(403).json({ ok: false, error: 'Tài khoản hiện không có quyền chỉnh sửa mục này' });
    return { context, required, denied: true };
  }
  return { context, required, denied: false };
}

function requireAdminSyncManage(req, res) {
  const context = getSessionContext(req);
  if (!context) {
    res.status(401).json({ ok: false, error: 'Bạn cần đăng nhập bằng tài khoản quản trị.' });
    return { context: null, denied: true };
  }
  const account = context.account || {};
  if (account.role !== 'admin') {
    res.status(403).json({ ok: false, error: 'Chỉ tài khoản quản trị mới được phép thao tác đồng bộ ECUS.' });
    return { context, denied: true };
  }
  if (!account.permissions?.syncManage) {
    res.status(403).json({ ok: false, error: 'Tài khoản quản trị hiện chưa được cấp quyền quản lý đồng bộ ECUS.' });
    return { context, denied: true };
  }
  return { context, denied: false };
}

function setAttachmentHeaders(res, filename) {
  const original = filename || 'bao-cao-kpi.xlsx';
  const fallback = original.replace(/[^a-zA-Z0-9_.-]/g, '_') || 'bao-cao-kpi.xlsx';
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(original)}`,
  );
}

pruneExpiredSessions();

function readStorage() {
  const rows = db.prepare('SELECT key, value FROM kv_store').all();
  const store = { ...DEFAULT_STORAGE };
  for (const row of rows) {
    store[row.key] = row.value;
  }
  return store;
}

function getValue(key) {
  const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get(key);
  if (!row || row.value === undefined || row.value === null) {
    return DEFAULT_STORAGE[key] ?? null;
  }
  return row.value;
}

function upsertValue(key, value) {
  const normalized = normalizeValue(value);
  if (normalized === null) {
    db.prepare('DELETE FROM kv_store WHERE key = ?').run(key);
    return;
  }
  db.prepare(
    'INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, normalized);
}

function deleteValue(key) {
  db.prepare('DELETE FROM kv_store WHERE key = ?').run(key);
}

function safeParse(json, fallback) {
  if (json === null || json === undefined) return fallback;
  try {
    const parsed = JSON.parse(json);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function getJSONValue(key, fallback) {
  return safeParse(getValue(key), fallback);
}

function setJSONValue(key, value) {
  upsertValue(key, value === undefined ? null : JSON.stringify(value));
}

function sortAccountRecords(records) {
  return records.sort((a, b) => a.username.localeCompare(b.username, 'vi', { sensitivity: 'base' }));
}

function sanitizeAccountRecord(record) {
  if (!record) return null;
  return {
    username: record.username,
    role: record.role === 'admin' ? 'admin' : 'staff',
    name: record.name || record.username,
    permissions: normalizePermissionsForRole(record.permissions, record.role),
  };
}

function persistAccountRecords(records) {
  const normalized = Array.isArray(records) ? records.filter(Boolean) : [];
  sortAccountRecords(normalized);
  setJSONValue('kpi_users_v1', normalized);
  return normalized;
}

function loadAccountRecords() {
  const raw = getJSONValue('kpi_users_v1', []);
  const records = [];
  const seen = new Set();
  let mutated = false;

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const username = (entry?.username ?? '').toString().trim();
      if (!username) {
        mutated = true;
        continue;
      }
      const key = username.toLowerCase();
      if (seen.has(key)) {
        mutated = true;
        continue;
      }
      const role = entry?.role === 'admin' ? 'admin' : 'staff';
      const name = (entry?.name ?? username).toString().trim();
      let passwordHash = typeof entry?.passwordHash === 'string' ? entry.passwordHash : '';
      if (!passwordHash && entry?.password) {
        passwordHash = bcrypt.hashSync(String(entry.password), PASSWORD_SALT_ROUNDS);
        mutated = true;
      }
      if (!passwordHash) {
        mutated = true;
        continue;
      }
      const permissions = normalizePermissionsForRole(entry?.permissions, role);
      seen.add(key);
      records.push({ username, passwordHash, role, name, permissions });
    }
  }

  if (records.length === 0) {
    records.push(...buildDefaultAccounts());
    mutated = true;
  }

  if (!records.some((record) => record.role === 'admin')) {
    const [defaultAdmin] = buildDefaultAccounts();
    if (defaultAdmin) {
      records.push(defaultAdmin);
      mutated = true;
    }
  }

  sortAccountRecords(records);

  if (mutated) {
    setJSONValue('kpi_users_v1', records);
  }

  return records;
}

function listAccountsForClient() {
  return loadAccountRecords().map((record) => sanitizeAccountRecord(record));
}

function buildBootstrapSnapshot() {
  const store = readStorage();
  try {
    store.kpi_users_v1 = JSON.stringify(listAccountsForClient());
  } catch {
    store.kpi_users_v1 = '[]';
  }
  return store;
}

export function resetDatabaseForTests() {
  if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
    throw new Error('resetDatabaseForTests chỉ sử dụng trong môi trường kiểm thử');
  }

  db.exec('DELETE FROM kv_store');
  db.exec('DELETE FROM auth_sessions');
  const insertMany = db.transaction((entries) => {
    const stmt = db.prepare(
      'INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );
    for (const [key, value] of entries) {
      stmt.run(key, normalizeValue(value));
    }
  });
  insertMany(Object.entries(DEFAULT_STORAGE));
}

function normalizeStr(input) {
  return (input ?? '').toString().replace(/\s+/g, ' ').trim();
}

function normalizeMST(input) {
  return (input ?? '').toString().replace(/\D/g, '');
}

function normalizeName(input) {
  return normalizeStr(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getDeclarationKey(row) {
  if (!row || typeof row !== 'object') {
    return '';
  }
  const soTk = (row?.so_tk ?? '').toString();
  const branch = normalizeStr(row?.nhanh || '');
  return `${soTk}_${branch}`;
}

function toISODate(value, { preferMonthFirst = false } = {}) {
  const str = normalizeStr(value);
  if (!str) return '';

  const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  const pad = (v) => String(v).padStart(2, '0');
  const normalizeYear = (v) => {
    const num = Number.parseInt(v, 10);
    if (!Number.isFinite(num)) return '';
    if (v.length === 2) {
      return String(num >= 70 ? 1900 + num : 2000 + num);
    }
    return String(num).padStart(4, '0');
  };

  if (iso) {
    let [, y, m, d] = iso;
    const monthVal = Number.parseInt(m, 10);
    const dayVal = Number.parseInt(d, 10);
    if (monthVal > 12 && dayVal >= 1 && dayVal <= 12) {
      return `${normalizeYear(y)}-${pad(dayVal)}-${pad(monthVal)}`;
    }
    return `${normalizeYear(y)}-${pad(monthVal)}-${pad(dayVal)}`;
  }

  const slash = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:[ T].*)?$/);
  if (slash) {
    const [, first, second, year] = slash;
    const a = Number.parseInt(first, 10);
    const b = Number.parseInt(second, 10);
    const pick = () => {
      if (a > 12 && b <= 12) return { month: second, day: first };
      if (b > 12 && a <= 12) return { month: first, day: second };
      if (preferMonthFirst) return { month: first, day: second };
      return { month: second, day: first };
    };
    const { month, day } = pick();
    const normalizedYear = normalizeYear(year);
    if (!normalizedYear) return '';
    const monthNum = Number.parseInt(month, 10);
    const dayNum = Number.parseInt(day, 10);
    if (!Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) return '';
    if (!Number.isFinite(dayNum) || dayNum < 1 || dayNum > 31) return '';
    return `${normalizedYear}-${pad(monthNum)}-${pad(dayNum)}`;
  }

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
  }
  return '';
}

function isExportDecl(soTk, loaiHinh) {
  const number = (soTk ?? '').toString().replace(/\D/g, '');
  if (/^30\d{10}$/.test(number)) return true;
  if (/^10\d{10}$/.test(number)) return false;
  const type = normalizeStr(loaiHinh).toUpperCase();
  const exportTypes = new Set(['B11', 'B12', 'B13', 'E42', 'E52', 'E62', 'E82', 'G22', 'G23', 'G24', 'G61', 'H21']);
  const importTypes = new Set(['E11', 'E13', 'E15', 'E21', 'E31', 'E41', 'A11', 'A12', 'A41', 'A42', 'G13', 'G12', 'G51', 'H11']);
  if (exportTypes.has(type)) return true;
  if (importTypes.has(type)) return false;
  return false;
}

function pushAuditLog(entry) {
  const payload = {
    ts: new Date().toISOString(),
    actor: entry?.actor || 'system',
    action: entry?.action || 'unknown',
    detail: entry?.detail || '',
    meta: entry?.meta ?? null,
  };
  const logs = getJSONValue('audit_logs_v1', []);
  logs.unshift(payload);
  setJSONValue('audit_logs_v1', logs.slice(0, 200));
  return payload;
}

function countAdmins(records) {
  return records.filter((record) => record.role === 'admin').length;
}

function createAccountRecord(payload, { actor = 'system' } = {}) {
  const accounts = loadAccountRecords();
  const username = (payload?.username ?? '').toString().trim();
  if (!username) {
    throw new Error('Vui lòng nhập tài khoản');
  }
  const key = username.toLowerCase();
  if (accounts.some((record) => record.username.toLowerCase() === key)) {
    throw new Error('Tài khoản đã tồn tại');
  }
  const password = (payload?.password ?? '').toString().trim();
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Mật khẩu cần tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`);
  }
  const role = payload?.role === 'admin' ? 'admin' : 'staff';
  const name = (payload?.name ?? username).toString().trim();
  const permissions = normalizePermissionsForRole(payload?.permissions, role);
  const passwordHash = bcrypt.hashSync(password, PASSWORD_SALT_ROUNDS);
  accounts.push({ username, passwordHash, role, name, permissions });
  persistAccountRecords(accounts);
  pushAuditLog({ actor, action: 'account.create', detail: `Tạo tài khoản ${username} (${role})` });
  return sanitizeAccountRecord(accounts.find((record) => record.username === username));
}

function updateAccountRecord(usernameInput, patch, { actor = 'system' } = {}) {
  const username = (usernameInput ?? '').toString().trim();
  if (!username) {
    throw new Error('Thiếu tài khoản cần cập nhật');
  }
  const accounts = loadAccountRecords();
  const index = accounts.findIndex((record) => record.username === username);
  if (index < 0) {
    throw new Error('Không tìm thấy tài khoản');
  }
  const current = accounts[index];
  const nextRole = patch?.role === 'admin' ? 'admin' : current.role;
  if (current.role === 'admin' && nextRole !== 'admin' && countAdmins(accounts) <= 1) {
    throw new Error('Cần ít nhất một quản trị viên');
  }
  const name = (patch?.name ?? current.name ?? current.username).toString().trim();
  const permissions = normalizePermissionsForRole(patch?.permissions ?? current.permissions, nextRole);
  accounts[index] = { ...current, role: nextRole, name, permissions };
  persistAccountRecords(accounts);
  pushAuditLog({ actor, action: 'account.update', detail: `Cập nhật tài khoản ${username}` });
  return sanitizeAccountRecord(accounts[index]);
}

function setAccountPasswordRecord(usernameInput, newPasswordInput, { actor = 'system' } = {}) {
  const username = (usernameInput ?? '').toString().trim();
  if (!username) {
    throw new Error('Thiếu tài khoản cần đặt mật khẩu');
  }
  const newPassword = (newPasswordInput ?? '').toString().trim();
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Mật khẩu cần tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`);
  }
  const accounts = loadAccountRecords();
  const index = accounts.findIndex((record) => record.username === username);
  if (index < 0) {
    throw new Error('Không tìm thấy tài khoản');
  }
  const passwordHash = bcrypt.hashSync(newPassword, PASSWORD_SALT_ROUNDS);
  accounts[index] = { ...accounts[index], passwordHash };
  persistAccountRecords(accounts);
  deleteSessionsForUser(username);
  pushAuditLog({ actor, action: 'account.reset_password', detail: `Đặt lại mật khẩu cho ${username}` });
  return true;
}

function deleteAccountRecord(usernameInput, { actor = 'system' } = {}) {
  const username = (usernameInput ?? '').toString().trim();
  if (!username) {
    throw new Error('Thiếu tài khoản cần xóa');
  }
  const accounts = loadAccountRecords();
  const index = accounts.findIndex((record) => record.username === username);
  if (index < 0) {
    throw new Error('Không tìm thấy tài khoản');
  }
  const target = accounts[index];
  if (target.role === 'admin' && countAdmins(accounts) <= 1) {
    throw new Error('Không thể xoá quản trị viên cuối cùng');
  }
  accounts.splice(index, 1);
  persistAccountRecords(accounts);
  deleteSessionsForUser(username);
  pushAuditLog({ actor, action: 'account.delete', detail: `Xóa tài khoản ${username}` });
  return listAccountsForClient();
}

async function changeOwnPasswordRecord(usernameInput, currentPasswordInput, newPasswordInput) {
  const username = (usernameInput ?? '').toString().trim();
  if (!username) {
    throw new Error('Thiếu tài khoản cần đổi mật khẩu');
  }
  const currentPassword = (currentPasswordInput ?? '').toString();
  const newPassword = (newPasswordInput ?? '').toString().trim();
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Mật khẩu mới cần tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`);
  }
  const accounts = loadAccountRecords();
  const index = accounts.findIndex((record) => record.username === username);
  if (index < 0) {
    throw new Error('Không tìm thấy tài khoản');
  }
  const current = accounts[index];
  const ok = await bcrypt.compare(currentPassword, current.passwordHash);
  if (!ok) {
    throw new Error('Mật khẩu hiện tại không đúng');
  }
  const passwordHash = bcrypt.hashSync(newPassword, PASSWORD_SALT_ROUNDS);
  accounts[index] = { ...current, passwordHash };
  persistAccountRecords(accounts);
  pushAuditLog({ actor: username, action: 'account.change_password', detail: 'Đổi mật khẩu cá nhân' });
  return sanitizeAccountRecord(accounts[index]);
}

function pushImportLog(message) {
  const logs = getJSONValue('import_logs_v1', []);
  logs.unshift({ ts: new Date().toISOString(), msg: message });
  setJSONValue('import_logs_v1', logs.slice(0, 100));
}

function getDeclRows() {
  const rows = getJSONValue('decl_rows_v1', []);
  return Array.isArray(rows) ? rows : [];
}

// eslint-disable-next-line no-unused-vars
function saveDeclRowsServer(newRows, { overwrite = false, actor = 'system', detail = '' } = {}) {
  const cleaned = Array.isArray(newRows) ? newRows : [];
  if (overwrite) {
    setJSONValue('decl_rows_v1', cleaned);
    pushAuditLog({ actor, action: 'decl.overwrite', detail: detail || `Ghi đè ${cleaned.length} tờ khai` });
    return cleaned.length;
  }

  const current = getDeclRows();
  const map = new Map();
  for (const row of current) {
    map.set(getDeclarationKey(row), row);
  }
  for (const row of cleaned) {
    map.set(getDeclarationKey(row), row);
  }
  const merged = Array.from(map.values());
  setJSONValue('decl_rows_v1', merged);
  pushAuditLog({
    actor,
    action: 'decl.merge',
    detail: detail || `Hợp nhất ${cleaned.length} tờ khai (tổng ${merged.length})`,
  });
  return merged.length;
}

function getRulesValue() {
  return getJSONValue('kpi_rules_v2', SHARED_DEFAULT_RULES);
}

function getRosterValue() {
  return getJSONValue('team_roster_v1', { version: 1, teams: [] });
}

function getMemberTeamMap() {
  const roster = getRosterValue();
  const map = new Map();
  if (Array.isArray(roster?.teams)) {
    for (const team of roster.teams) {
      if (!team || typeof team !== 'object') continue;
      const teamName = normalizeStr(team.name || '');
      if (!Array.isArray(team.members)) continue;
      for (const member of team.members) {
        const memberName = normalizeStr(member?.name || '');
        if (!memberName) continue;
        map.set(normalizeName(memberName), { name: memberName, team: teamName });
      }
    }
  }
  return map;
}

function getMSTRows() {
  const rows = getJSONValue('mst_rows_v2', []);
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({
      mst: normalizeMST(row?.mst),
      company: normalizeStr(row?.company || ''),
      person_import: normalizeStr(row?.person_import || ''),
      person_export: normalizeStr(row?.person_export || ''),
      team: normalizeStr(row?.team || ''),
      effective_from: toISODate(row?.effective_from || ''),
    }))
    .filter((row) => row.mst)
    .sort((a, b) => {
      const byMst = a.mst.localeCompare(b.mst);
      if (byMst !== 0) return byMst;
      return (a.effective_from || '').localeCompare(b.effective_from || '');
    });
}

function getMSTForServer(mst, isoDate) {
  const target = normalizeMST(mst);
  if (!target) return null;
  const rows = getMSTRows().filter((row) => row.mst === target);
  if (!rows.length) return null;
  const dateVal = isoDate ? new Date(isoDate).getTime() : Number.POSITIVE_INFINITY;
  const ranked = rows
    .map((row) => {
      const ts = row.effective_from ? new Date(row.effective_from).getTime() : Number.NEGATIVE_INFINITY;
      const rank = ts <= dateVal ? dateVal - ts : Number.POSITIVE_INFINITY - ts;
      return { row, rank };
    })
    .sort((a, b) => a.rank - b.rank);
  return ranked[0]?.row || null;
}

function getEcusConfig() {
  const stored = getJSONValue('ecus_sync_config_v1', DEFAULT_ECUS_SYNC_CONFIG);
  const connection = {
    ...DEFAULT_ECUS_SYNC_CONFIG.connection,
    ...(stored?.connection || {}),
  };
  const columnMap = {
    ...DEFAULT_ECUS_SYNC_CONFIG.columnMap,
    ...(stored?.columnMap || {}),
  };
  return {
    ...DEFAULT_ECUS_SYNC_CONFIG,
    ...stored,
    connection,
    columnMap,
  };
}

function saveEcusConfig(config, { preservePassword = false } = {}) {
  const current = getEcusConfig();
  const connectionPatch = config?.connection || {};
  const nextConnection = {
    ...current.connection,
    ...connectionPatch,
  };
  if (preservePassword && connectionPatch.password === undefined) {
    nextConnection.password = current.connection.password || '';
  } else {
    nextConnection.password = connectionPatch.password ?? '';
  }

  const nextConfig = {
    ...current,
    ...config,
    connection: nextConnection,
    columnMap: {
      ...current.columnMap,
      ...(config?.columnMap || {}),
    },
  };
  setJSONValue('ecus_sync_config_v1', nextConfig);
  return nextConfig;
}

function formatEcusConfigForClient(config) {
  const source = config || getEcusConfig();
  const connection = { ...source.connection };
  const result = {
    ...source,
    connection,
  };
  connection.hasPassword = !!connection.password;
  connection.password = '';
  return result;
}

function getAlertConfig() {
  const stored = getJSONValue('decl_alert_config_v1', DEFAULT_ALERT_CONFIG);
  return { ...DEFAULT_ALERT_CONFIG, ...stored };
}

function saveAlertConfig(config) {
  const next = { ...getAlertConfig(), ...(config || {}) };
  setJSONValue('decl_alert_config_v1', next);
  return next;
}

function getAlertState() {
  const stored = getJSONValue('decl_alert_state_v1', DEFAULT_ALERT_STATE);
  const entries = stored?.entries && typeof stored.entries === 'object' ? stored.entries : {};
  return {
    entries,
    lastEvaluatedAt: stored?.lastEvaluatedAt || null,
  };
}

function saveAlertState(state) {
  const normalized = {
    entries: state?.entries && typeof state.entries === 'object' ? state.entries : {},
    lastEvaluatedAt: state?.lastEvaluatedAt || new Date().toISOString(),
  };
  setJSONValue('decl_alert_state_v1', normalized);
  return normalized;
}

function markDeclarationsReviewed(keys, { actor = 'system' } = {}) {
  if (!Array.isArray(keys) || keys.length === 0) return 0;
  const keySet = new Set(keys);
  let updatedCount = 0;
  const nextRows = getDeclRows().map((row) => {
    const key = getDeclarationKey(row);
    if (!keySet.has(key)) return row;
    if (row?.reviewed) return row;
    updatedCount += 1;
    return {
      ...row,
      reviewed: true,
      reviewed_at: new Date().toISOString(),
    };
  });
  if (updatedCount > 0) {
    setJSONValue('decl_rows_v1', nextRows);
    pushAuditLog({
      actor,
      action: 'decl.review',
      detail: `Đánh dấu đã rà soát ${updatedCount} tờ khai`,
      meta: { keys: Array.from(keySet) },
    });
  }
  return updatedCount;
}

function evaluateDeclarationAlerts({ actor = 'system', reason = 'auto' } = {}) {
  const config = getAlertConfig();
  const state = getAlertState();
  const entries = state.entries;
  if (!config.enabled) {
    return { total: getDeclRows().length, outstanding: 0, triggered: 0 };
  }

  const rows = getDeclRows();
  const thresholdDays = Number.isFinite(Number(config.thresholdDays)) ? Number(config.thresholdDays) : 0;
  const thresholdMs = Math.max(0, thresholdDays) * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const seenKeys = new Set();
  let triggered = 0;

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const soTk = (row.so_tk ?? '').toString();
    const key = `${soTk}_${normalizeStr(row.nhanh || '')}`;
    seenKeys.add(key);

    const hasStaff = !!normalizeStr(row.nhan_vien);
    const hasTeam = !!normalizeStr(row.team);
    const reviewed = !!row.reviewed;

    if ((hasStaff && hasTeam) || (reviewed && config.autoResolveReviewed !== false)) {
      if (entries[key]) {
        entries[key].resolved = true;
        entries[key].resolvedAt = nowIso;
      }
      continue;
    }

    const missing = [];
    if (!hasStaff) missing.push('nhân viên');
    if (!hasTeam) missing.push('tổ đội');
    if (!missing.length) continue;

    const dateISO = row.date || row.raw_date || '';
    const ts = dateISO ? new Date(dateISO).getTime() : Number.NaN;
    const overdue = Number.isNaN(ts) ? true : now - ts >= thresholdMs;
    if (!overdue) {
      continue;
    }

    const existing = entries[key] || {};
    const lastAlertAtTs = existing.lastAlertAt ? new Date(existing.lastAlertAt).getTime() : 0;
    const shouldAlert = !existing.lastAlertAt || now - lastAlertAtTs >= 60 * 60 * 1000;

    entries[key] = {
      key,
      so_tk: soTk,
      mst: normalizeStr(row.mst || ''),
      company: normalizeStr(row.cong_ty || ''),
      date: dateISO,
      team: row.team || '',
      staff: row.nhan_vien || '',
      missing,
      firstDetected: existing.firstDetected || nowIso,
      lastUpdated: nowIso,
      lastAlertAt: shouldAlert ? nowIso : existing.lastAlertAt,
      resolved: false,
    };

    if (shouldAlert) {
      triggered += 1;
      if (config.channel === 'audit') {
        pushAuditLog({
          actor,
          action: 'decl.alert',
          detail: `Tờ khai ${soTk} thiếu ${missing.join(' & ')}`,
          meta: {
            mst: row.mst || '',
            company: row.cong_ty || '',
            reason,
          },
        });
      }
    }
  }

  for (const key of Object.keys(entries)) {
    if (!seenKeys.has(key)) {
      delete entries[key];
      continue;
    }
    const entry = entries[key];
    if (!entry) continue;
    if (entry.resolved) continue;
    if (!entry.missing || entry.missing.length === 0) {
      entry.resolved = true;
      entry.resolvedAt = nowIso;
    }
  }

  if (config.autoResolveReviewed !== false) {
    for (const key of Object.keys(entries)) {
      const entry = entries[key];
      if (entry?.resolved) {
        delete entries[key];
      }
    }
  }

  const outstanding = Object.values(entries).filter((entry) => entry && entry.resolved !== true).length;
  saveAlertState({ entries, lastEvaluatedAt: nowIso });
  return { total: rows.length, outstanding, triggered };
}

function formatAlertEntries(entries) {
  return Object.values(entries || {})
    .map((entry) => ({
      key: entry.key,
      so_tk: entry.so_tk,
      mst: entry.mst,
      company: entry.company,
      date: entry.date,
      team: entry.team,
      staff: entry.staff,
      missing: entry.missing,
      firstDetected: entry.firstDetected,
      lastUpdated: entry.lastUpdated,
      lastAlertAt: entry.lastAlertAt,
      resolved: entry.resolved || false,
      resolvedAt: entry.resolvedAt || null,
    }))
    .sort((a, b) => {
      const timeA = a.lastAlertAt ? new Date(a.lastAlertAt).getTime() : 0;
      const timeB = b.lastAlertAt ? new Date(b.lastAlertAt).getTime() : 0;
      return timeB - timeA;
    });
}

function buildAlertPayload() {
  const config = getAlertConfig();
  const state = getAlertState();
  const alerts = formatAlertEntries(state.entries);
  const outstanding = alerts.filter((alert) => !alert.resolved).length;
  return {
    config,
    alerts,
    summary: {
      outstanding,
      totalTracked: alerts.length,
      lastEvaluatedAt: state.lastEvaluatedAt,
    },
  };
}

function buildSqlConnectionConfig(config) {
  const connection = config?.connection || {};
  const poolOptions = connection.pool && typeof connection.pool === 'object' ? connection.pool : undefined;
  const parseTimeout = (value) => {
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? num : undefined;
  };
  return {
    server: connection.server || process.env.ECUS_SQL_SERVER || '',
    database: connection.database || process.env.ECUS_SQL_DATABASE || '',
    user: connection.user || process.env.ECUS_SQL_USER || '',
    password: connection.password || process.env.ECUS_SQL_PASSWORD || '',
    options: {
      ...(connection.options || {}),
      encrypt: connection.options?.encrypt ?? false,
      trustServerCertificate: connection.options?.trustServerCertificate ?? true,
    },
    port: connection.port ? Number(connection.port) : undefined,
    connectionTimeout: parseTimeout(connection.connectionTimeout),
    requestTimeout: parseTimeout(connection.requestTimeout),
    pool: poolOptions,
  };
}

const SQL_POOL_DEFAULT_CONNECTION_TIMEOUT = 5000;
const SQL_POOL_DEFAULT_REQUEST_TIMEOUT = 10000;
const SQL_POOL_DEFAULT_OPTIONS = { max: 5, min: 0, idleTimeoutMillis: 5000 };
const SQL_CAPABILITY_CACHE = new Map();

async function resolveSqlPaginationCapabilities(pool, connectionConfig, requestTimeout) {
  const server = String(connectionConfig?.server ?? '').trim();
  const database = String(connectionConfig?.database ?? '').trim();
  if (!server || !database) {
    return null;
  }

  const cacheKey = `${server}::${database}`;
  const cached = SQL_CAPABILITY_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const request = pool.request();
    if (Number.isFinite(requestTimeout) && requestTimeout > 0) {
      request.timeout = requestTimeout;
    }
    request.input('dbName', sql.NVarChar, database);
    const result = await request.query(`
      SELECT
        CAST(SERVERPROPERTY('ProductVersion') AS NVARCHAR(128)) AS productVersion,
        CAST(SERVERPROPERTY('Edition') AS NVARCHAR(128)) AS edition,
        d.compatibility_level AS compatibilityLevel
      FROM sys.databases AS d
      WHERE d.name = @dbName;
    `);
    const row = result?.recordset?.[0] || {};
    const level = Number(row.compatibilityLevel);
    const compatibilityLevel = Number.isFinite(level) ? level : null;
    const supportsOffsetFetch = compatibilityLevel !== null ? compatibilityLevel >= 110 : false;
    if (!supportsOffsetFetch) {
      const levelText = compatibilityLevel === null ? 'unknown' : compatibilityLevel;
      console.warn(
        `SQL Server compatibility level ${levelText} does not support OFFSET/FETCH pagination; falling back to non-paginated sync.`
      );
    }
    const payload = {
      productVersion: row.productVersion || null,
      edition: row.edition || null,
      compatibilityLevel,
      supportsOffsetFetch,
    };

    SQL_CAPABILITY_CACHE.set(cacheKey, payload);
    return payload;
  } catch (err) {
    console.warn('Failed to discover SQL Server pagination capabilities', err);
    const fallback = { compatibilityLevel: null, supportsOffsetFetch: false };
    SQL_CAPABILITY_CACHE.set(cacheKey, fallback);
    return fallback;
  }
}


function createSqlPoolManager() {
  let pool = null;
  let poolKey = null;
  let connectPromise = null;

  const close = async () => {
    const pending = connectPromise;
    connectPromise = null;
    if (pending) {
      try {
        await pending;
      } catch {
        // bỏ qua lỗi kết nối đang xử lý
      }
    }
    if (pool) {
      const closing = pool;
      pool = null;
      poolKey = null;
      try {
        await closing.close();
      } catch {
        // bỏ qua lỗi đóng kết nối
      }
    }
  };

  const getPool = async (config) => {
    const { connectionTimeout, requestTimeout, pool: poolOptions, ...core } = config || {};
    const normalizedKey = JSON.stringify(core);
    if (pool && poolKey === normalizedKey) {
      if (pool.connected) {
        return pool;
      }
      if (!connectPromise) {
        connectPromise = pool.connect();
      }
      await connectPromise;
      connectPromise = null;
      return pool;
    }

    await close();
    const effectiveConnectionTimeout =
      connectionTimeout ?? SQL_POOL_DEFAULT_CONNECTION_TIMEOUT;
    const effectiveRequestTimeout = requestTimeout ?? SQL_POOL_DEFAULT_REQUEST_TIMEOUT;
    const effectivePoolOptions = {
      ...SQL_POOL_DEFAULT_OPTIONS,
      ...(poolOptions || {}),
    };
    const nextPool = new sql.ConnectionPool({
      ...core,
      connectionTimeout: effectiveConnectionTimeout,
      requestTimeout: effectiveRequestTimeout,
      pool: effectivePoolOptions,
    });
    pool = nextPool;
    poolKey = normalizedKey;
    connectPromise = nextPool.connect();
    try {
      await connectPromise;
    } catch (err) {
      await close();
      throw err;
    } finally {
      connectPromise = null;
    }
    return pool;
  };

  return {
    getPool,
    close,
  };
}

function registerSqlPoolShutdown(manager) {
  if (!manager) return;
  let shuttingDown = false;

  const handleSignal = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      await manager.close();
    } catch (err) {
      console.error('Không thể đóng SQL pool khi thoát ứng dụng', err);
    } finally {
      const exitCode = signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 0;
      process.exit(exitCode);
    }
  };

  process.on('exit', () => {
    if (shuttingDown) return;
    shuttingDown = true;
    manager.close().catch(() => {});
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      void handleSignal(signal);
    });
  }
}

const sqlPoolManager = createSqlPoolManager();
registerSqlPoolShutdown(sqlPoolManager);

function parseLicenseCount(rawValue, excludeSet) {
  if (rawValue === null || rawValue === undefined) return 0;
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return Math.max(0, Math.round(rawValue));
  }
  if (Array.isArray(rawValue)) {
    return rawValue
      .map((code) => normalizeStr(code).toUpperCase())
      .filter((code) => code && !excludeSet.has(code)).length;
  }
  if (rawValue && typeof rawValue === 'object') {
    const stack = [rawValue];
    const tokens = [];
    while (stack.length > 0) {
      const current = stack.pop();
      if (current === null || current === undefined) continue;
      if (Array.isArray(current)) {
        for (const item of current) {
          stack.push(item);
        }
        continue;
      }
      if (typeof current === 'object') {
        for (const value of Object.values(current)) {
          stack.push(value);
        }
        continue;
      }
      tokens.push(current);
    }
    if (tokens.length) {
      return tokens
        .map((token) => normalizeStr(token).toUpperCase())
        .filter((token) => token && !excludeSet.has(token)).length;
    }
    return 0;
  }

  const str = normalizeStr(rawValue);
  if (!str) return 0;
  const tokens = str.split(/[,;|]/g)
    .map((token) => normalizeStr(token).toUpperCase())
    .filter((token) => token && !excludeSet.has(token));
  if (tokens.length === 1) {
    const single = tokens[0];
    if (/^\d+(?:\.\d+)?$/.test(single)) {
      const numericSingle = Number(single);
      if (Number.isFinite(numericSingle)) {
        return Math.max(0, Math.round(numericSingle));
      }
    }
  }
  if (!tokens.length) {
    const numeric = Number(str);
    if (Number.isFinite(numeric)) {
      return Math.max(0, Math.round(numeric));
    }
  }
  return tokens.length;
}

function normalizeColumnKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

const COLUMN_ALIASES = Object.freeze({
  so_tk: [
    'so_tk',
    'sotk',
    'soTk',
    'So_tk',
    'SoTK',
    'SO_TK',
    'Số tờ khai',
    'So to khai',
    'Số tờ khai TM',
  ],
  date: [
    'ngay_dang_ky',
    'Ngay_dang_ky',
    'ngay_dk',
    'Ngay_dk',
    'NgayDK',
    'ngayKhai',
    'NgayKhai',
    'ngaylap',
    'Ngày đăng ký',
    'Ngay dang ky',
  ],
  nhanh: ['nhanh', 'chi_cuc', 'Chi_cuc', 'chiCuc', 'ma_chi_cuc', 'ChiCuc'],
  mst: [
    'mst',
    'MST',
    'ma_so_thue',
    'Ma_so_thue',
    'maSoThue',
    'MaSoThue',
    'mst_dn',
    'ma_so_thue_dn',
    'Mã số thuế',
    'Ma so thue',
  ],
  cong_ty: [
    'cong_ty',
    'Cong_ty',
    'ten_dn',
    'Ten_dn',
    'ten_doanh_nghiep',
    'TenDoanhNghiep',
    'doanh_nghiep',
    'ten_khach_hang',
    'Tên doanh nghiệp',
    'Ten doanh nghiep',
    'Tên khách hàng',
  ],
  loai_hinh: ['loai_hinh', 'Loai_hinh', 'ma_loai_hinh', 'MaLoaiHinh', 'Loại hình', 'Loai hinh'],
  num_items: [
    'num_items',
    'muc_hang',
    'Muc_hang',
    'so_muc',
    'So_muc',
    'so_luong_mh',
    'SoLuongMatHang',
    'Số mục hàng',
    'So muc hang',
  ],
  licenses: [
    'licenses',
    'license_codes',
    'ma_gp',
    'Ma_gp',
    'ds_gp',
    'DanhSachGiayPhep',
    'ds_giay_phep',
    'giay_phep',
    'GP',
    'Danh sách giấy phép',
    'Danh sach giay phep',
    'Số lượng GP',
    'So luong GP',
    'Số lượng giấy phép',
    'So luong giay phep',
  ],
  nhan_vien: ['nhan_vien', 'Nhan_vien', 'nhanVien', 'Nhân viên', 'Nhan vien'],
  nhan_vien_import: [
    'nhan_vien_nhap',
    'Nhan_vien_nhap',
    'nv_nhap',
    'NVNhap',
    'NhanVienNhap',
    'Nhân viên nhập',
    'Nhan vien nhap',
  ],
  nhan_vien_export: [
    'nhan_vien_xuat',
    'Nhan_vien_xuat',
    'nv_xuat',
    'NVXuat',
    'NhanVienXuat',
    'Nhân viên xuất',
    'Nhan vien xuat',
  ],
  team: ['team', 'team_name', 'to_doi', 'To_doi', 'ten_to', 'ToDoi', 'Tổ đội', 'To doi'],
  co_line_count: [
    'co_line_count',
    'coLineCount',
    'co_lines',
    'coLines',
    'co_line',
    'coLine',
    'co_count',
    'coCount',
    'so_dong_co',
    'So_dong_co',
    'sodongco',
    'so_dong_ap_co',
    'So_dong_ap_co',
    'dong_hang_ap_co',
    'Dong_hang_ap_co',
    'donghangapco',
    'co_lines_count',
    'coLineItems',
    'co_line_items',
    'CO_Count',
    'CO_LINES',
    'CO_Lines',
  ],
});

function buildRecordKeyLookup(record) {
  const lookup = new Map();
  for (const key of Object.keys(record)) {
    const lower = key.toLowerCase();
    if (!lookup.has(lower)) {
      lookup.set(lower, key);
    }
    const normalized = normalizeColumnKey(key);
    if (normalized && !lookup.has(normalized)) {
      lookup.set(normalized, key);
    }
  }
  return lookup;
}

function readRecordValue(record, lookup, candidate) {
  if (!candidate && candidate !== 0) {
    return undefined;
  }
  const keyString = String(candidate);
  let actualKey = lookup.get(keyString.toLowerCase());
  if (actualKey === undefined) {
    actualKey = lookup.get(normalizeColumnKey(keyString));
  }
  if (actualKey !== undefined) {
    return record[actualKey];
  }
  return undefined;
}

function mapEcusRow(record, config, context) {
  if (!record || typeof record !== 'object') return null;
  const columnMap = config.columnMap || {};
  const keyLookup = buildRecordKeyLookup(record);
  const getField = (name) => {
    const rawCandidates = [];
    const mapped = columnMap[name];
    if (Array.isArray(mapped)) {
      rawCandidates.push(...mapped);
    } else if (mapped) {
      rawCandidates.push(mapped);
    }
    rawCandidates.push(name);
    if (COLUMN_ALIASES[name]) {
      rawCandidates.push(...COLUMN_ALIASES[name]);
    }

    const seen = new Set();
    for (const candidate of rawCandidates) {
      const keyLower = String(candidate).toLowerCase();
      if (seen.has(keyLower)) continue;
      seen.add(keyLower);
      const value = readRecordValue(record, keyLookup, candidate);
      if (value !== undefined) {
        return value;
      }
    }
    return undefined;
  };

  const soTk = normalizeStr(getField('so_tk'));
  const nhanh = normalizeStr(getField('nhanh'));
  const rawDate = getField('date');
  const dateISO = rawDate instanceof Date
    ? toISODate(rawDate.toISOString(), { preferMonthFirst: config.preferMonthFirst })
    : toISODate(rawDate, { preferMonthFirst: config.preferMonthFirst });
  if (!soTk || !dateISO) return null;

  const mst = normalizeMST(getField('mst'));
  const company = normalizeStr(getField('cong_ty'));
  const loaiHinh = normalizeStr(getField('loai_hinh'));
  const numItemsRaw = getField('num_items');
  const numItems = Number.parseInt(numItemsRaw, 10);
  const licensesRaw = getField('licenses');
  const licenseCount = parseLicenseCount(
    licensesRaw !== undefined ? licensesRaw : getField('license_codes'),
    context.licenseExcludeSet,
  );
  const coLineRaw = getField('co_line_count');
  const coLineCount = parseCoLineCount(coLineRaw);

  let nhanVien = normalizeStr(getField('nhan_vien'));
  if (!nhanVien) {
    const importField = normalizeStr(getField('nhan_vien_import'));
    const exportField = normalizeStr(getField('nhan_vien_export'));
    nhanVien = importField || exportField || '';
  }
  let team = normalizeStr(getField('team'));

  const isExport = isExportDecl(soTk, loaiHinh);
  const mstAssignment = mst ? getMSTForServer(mst, dateISO) : null;
  if (!nhanVien && mstAssignment) {
    nhanVien = isExport ? mstAssignment.person_export || '' : mstAssignment.person_import || '';
  }
  if (!team && mstAssignment) {
    team = mstAssignment.team || '';
  }
  if (!team && nhanVien) {
    const info = context.memberTeamMap.get(normalizeName(nhanVien));
    if (info?.team) {
      team = info.team;
    }
  }

  const base = {
    date: dateISO,
    raw_date: rawDate instanceof Date ? rawDate.toISOString().slice(0, 10) : normalizeStr(rawDate),
    so_tk: soTk,
    nhanh,
    mst,
    cong_ty: company,
    loai_hinh: loaiHinh,
    num_items: Number.isFinite(numItems) ? numItems : 0,
    muc_hang: Number.isFinite(numItems) ? numItems : 0,
    licenses: licenseCount,
    so_luong_gp: licenseCount,
    nhan_vien: nhanVien,
    team,
    isExport,
    co_line_count: coLineCount,
  };
  return deriveCOStatus(record, base);
}

async function* fetchEcusDeclarations(range, config) {
  const connectionConfig = buildSqlConnectionConfig(config);
  if (!connectionConfig.server || !connectionConfig.database) {
    throw new Error('Chưa cấu hình máy chủ hoặc cơ sở dữ liệu SQL Server');
  }

  const pool = await sqlPoolManager.getPool(connectionConfig);
  const requestTimeout =
    connectionConfig.requestTimeout ?? SQL_POOL_DEFAULT_REQUEST_TIMEOUT;
  const queryText = (config.query || DEFAULT_ECUS_SYNC_CONFIG.query || '').trim();
  if (!queryText) {
    return;
  }
  const baseQuery = queryText.replace(/;\s*$/u, '');
  const configuredBatchSize = Number(config?.batchSize);
  const defaultBatchSize = Number(DEFAULT_ECUS_SYNC_CONFIG.batchSize);
  const normalizedBatchSize =
    Number.isFinite(configuredBatchSize) && configuredBatchSize > 0
      ? configuredBatchSize
      : defaultBatchSize;
  const batchSize =
    Number.isFinite(normalizedBatchSize) && normalizedBatchSize > 0
      ? Math.max(1, Math.floor(normalizedBatchSize))
      : 0;
  const fromDate = normalizeRangeDate(range.from);
  const toDate = normalizeRangeDate(range.to, { isEnd: true });

  const attachRangeParameters = (request) => {
    if (fromDate instanceof Date && !Number.isNaN(fromDate.getTime())) {
      request.input('from', sql.DateTime, fromDate);
    }
    if (toDate instanceof Date && !Number.isNaN(toDate.getTime())) {
      request.input('to', sql.DateTime, toDate);
    }
  };

  const lowerQuery = baseQuery.toLowerCase();
  const containsOffset = /\boffset\s+\d+/u.test(lowerQuery) || /\bfetch\s+next\s+/u.test(lowerQuery);
  let supportsOffsetFetch = true;
  if (batchSize > 0 && !containsOffset) {
    const capabilities = await resolveSqlPaginationCapabilities(pool, connectionConfig, requestTimeout);
    supportsOffsetFetch = capabilities?.supportsOffsetFetch !== false;
  }
  const supportsPagination = batchSize > 0 && !containsOffset && supportsOffsetFetch;

  if (!supportsPagination) {
    const request = pool.request();
    request.timeout = requestTimeout;
    attachRangeParameters(request);
    const result = await request.query(baseQuery);
    const rows = result?.recordset || [];
    if (rows.length > 0) {
      yield rows;
    }
    return;
  }

  const hasOrderBy = /order\s+by/u.test(lowerQuery);
  const wrappedQuery = hasOrderBy
    ? baseQuery
    : `SELECT * FROM (${baseQuery}) AS base_query ORDER BY (SELECT NULL)`;
  const pagedQuery = `${wrappedQuery} OFFSET @__offset ROWS FETCH NEXT @__limit ROWS ONLY`;

  let offset = 0;
  while (true) {
    const request = pool.request();
    request.timeout = requestTimeout;
    attachRangeParameters(request);
    request.input('__offset', sql.Int, offset);
    request.input('__limit', sql.Int, batchSize);
    const result = await request.query(pagedQuery);
    const rows = result?.recordset || [];
    if (!rows.length) {
      break;
    }
    yield rows;
    if (rows.length < batchSize) {
      break;
    }
    offset += rows.length;
  }
}

export async function checkSqlServerHealth() {
  const config = getEcusConfig();
  const connectionConfig = buildSqlConnectionConfig(config);
  if (!connectionConfig.server || !connectionConfig.database) {
    return {
      ok: false,
      state: 'not_configured',
      message: 'Chưa cấu hình máy chủ hoặc cơ sở dữ liệu SQL Server',
    };
  }
  try {
    const pool = await sqlPoolManager.getPool(connectionConfig);
    const request = pool.request();
    const timeout = connectionConfig.requestTimeout ?? 5000;
    request.timeout = timeout;
    await request.query('SELECT 1 AS ok');
    return {
      ok: true,
      state: 'ready',
      server: connectionConfig.server,
      database: connectionConfig.database,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    const timeout = isSqlTimeoutError(err);
    if (timeout) {
      recordSqlTimeout({ message: err?.message, context: { actor: 'healthcheck', reason: 'status-check' } });
    }
    return {
      ok: false,
      state: timeout ? 'timeout' : 'error',
      message: err?.message || 'Không thể kết nối SQL Server',
      code: err?.code || null,
      number: err?.number || null,
      checkedAt: new Date().toISOString(),
    };
  }
}

function computeRangeWindow(config, explicit) {
  if (explicit?.from || explicit?.to) {
    return {
      from: explicit.from || '',
      to: explicit.to || '',
    };
  }
  const days = Number.isFinite(Number(config.rangeDays)) ? Number(config.rangeDays) : 1;
  const end = new Date();
  const start = new Date(end.getTime() - Math.max(1, days) * 24 * 60 * 60 * 1000);
  const toISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { from: toISO(start), to: toISO(end) };
}

function buildEcusSyncContext(config) {
  const rules = getRulesValue();
  const excludeSet = new Set(
    Array.isArray(rules?.license?.exclude?.codes)
      ? rules.license.exclude.codes.map((code) => normalizeStr(code).toUpperCase())
      : [],
  );
  return {
    licenseExcludeSet: excludeSet,
    memberTeamMap: getMemberTeamMap(),
    config,
  };
}

async function previewEcusSync(rangeInput, { limit = 50 } = {}) {
  const config = getEcusConfig();
  const range = computeRangeWindow(config, rangeInput || {});
  const context = buildEcusSyncContext(config);
  const iterator = fetchEcusDeclarations(range, config);
  const existingRows = getDeclRows();
  const existingKeys = new Set(existingRows.map((row) => getDeclarationKey(row)));
  const normalizedLimit = Number.isFinite(Number(limit)) ? Math.max(0, Math.floor(Number(limit))) : 0;
  const rows = [];
  let totalFetched = 0;

  for await (const batch of iterator) {
    totalFetched += batch.length;
    for (const raw of batch) {
      const mapped = mapEcusRow(raw, config, context);
      if (!mapped) continue;
      const key = getDeclarationKey(mapped);
      rows.push({ ...mapped, status: existingKeys.has(key) ? 'existing' : 'new' });
      if (normalizedLimit > 0 && rows.length >= normalizedLimit) {
        return {
          rows,
          totalFetched,
          limited: true,
          range,
          config,
        };
      }
    }
  }

  return {
    rows,
    totalFetched,
    limited: false,
    range,
    config,
  };
}

async function runEcusSync({ from, to, actor = 'system', reason = 'manual' } = {}) {
  const config = getEcusConfig();
  const range = computeRangeWindow(config, { from, to });
  const syncReason = reason || 'manual';
  const rawIterator = fetchEcusDeclarations(range, config);
  const context = buildEcusSyncContext(config);
  const runAtIso = new Date().toISOString();
  const existingRows = getDeclRows();
  const existingCount = existingRows.length;
  const mergedMap = new Map();
  for (const row of existingRows) {
    if (!row) continue;
    mergedMap.set(getDeclarationKey(row), row);
  }

  let totalFetched = 0;
  let totalInserted = 0;
  let skippedExisting = 0;

  for await (const batch of rawIterator) {
    totalFetched += batch.length;
    const mappedBatch = batch
      .map((row) => mapEcusRow(row, config, context))
      .filter((row) => row && row.so_tk && row.date);
    for (const row of mappedBatch) {
      const key = getDeclarationKey(row);
      if (mergedMap.has(key)) {
        skippedExisting += 1;
        continue;
      }
      mergedMap.set(key, row);
      totalInserted += 1;
    }
  }

  const mergedRows = Array.from(mergedMap.values());
  setJSONValue('decl_rows_v1', mergedRows);
  pushAuditLog({
    actor,
    action: 'decl.merge',
    detail: `Đồng bộ ${totalInserted} tờ khai mới từ ECUS (${range.from || '...'} → ${range.to || '...'}) [${syncReason}] – giữ nguyên ${skippedExisting} tờ khai đã có – tổng lưu: ${mergedRows.length}`,
  });

  const alertSummary = evaluateDeclarationAlerts({ actor, reason: 'ecus-sync' });

  pushImportLog(
    `ECUS sync (${syncReason}) thêm ${totalInserted} dòng, bỏ qua ${skippedExisting} (${range.from || '...'} → ${range.to || '...'}) – tổng lưu: ${mergedRows.length}`,
  );

  const nextConfig = saveEcusConfig({
    lastRun: runAtIso,
    lastStatus: 'success',
    lastSummary: {
      runAt: runAtIso,
      rowsFetched: totalFetched,
      rowsInserted: totalInserted,
      rowsSkipped: skippedExisting,
      totalStored: mergedRows.length,
      existingBefore: existingCount,
      range,
      alerts: alertSummary,
    },
  }, { preservePassword: true });

  return {
    config: nextConfig,
    fetched: totalFetched,
    imported: totalInserted,
    skipped: skippedExisting,
    storedTotal: mergedRows.length,
    existingBefore: existingCount,
    existingAfter: mergedRows.length,
    range,
    alerts: alertSummary,
    runAt: runAtIso,
  };
}

async function runEcusSyncWithErrorHandling(params) {
  try {
    return await runEcusSync(params);
  } catch (err) {
    console.error('ECUS sync failed', err);
    if (isSqlTimeoutError(err)) {
      recordSqlTimeout({ message: err?.message, context: { actor: params?.actor, reason: params?.reason } });
    }
    saveEcusConfig({
      lastRun: new Date().toISOString(),
      lastStatus: `error: ${err.message}`,
    }, { preservePassword: true });
    pushAuditLog({
      actor: params?.actor || 'system',
      action: 'ecus.sync_error',
      detail: err.message || 'Đồng bộ ECUS thất bại',
    });
    throw err;
  }
}

function isSqlTimeoutError(err) {
  if (!err) return false;
  const message = String(err?.message || err).toLowerCase();
  if (message.includes('timeout')) return true;
  if (err?.code && String(err.code).toLowerCase().includes('timeout')) return true;
  if (err?.number && String(err.number).toLowerCase().includes('timeout')) return true;
  return false;
}

let scheduledSync = null;

function refreshEcusSchedule() {
  if (process.env.KPI_DISABLE_CRON === '1') {
    if (scheduledSync) {
      scheduledSync.stop();
      scheduledSync = null;
    }
    return;
  }
  if (scheduledSync) {
    scheduledSync.stop();
    scheduledSync = null;
  }
  const config = getEcusConfig();
  if (!config.enabled || !config.schedule) {
    return;
  }
  try {
    scheduledSync = cron.schedule(config.schedule, () => {
      runEcusSyncWithErrorHandling({ actor: 'scheduler', reason: 'scheduled' }).catch(() => {});
    });
  } catch (err) {
    console.error('Không thể thiết lập lịch đồng bộ ECUS:', err);
  }
}

export const app = express();
const PORT = Number.parseInt(process.env.PORT || '5000', 10);
const HOST = (process.env.KPI_LISTEN_HOST || '').trim() || '0.0.0.0';

function logServerAddresses(port, host) {
  const normalizedHost = host || '0.0.0.0';
  const displayHost = normalizedHost === '0.0.0.0' || normalizedHost === '::' ? 'localhost' : normalizedHost;
  console.log(`KPI storage server đang chạy tại http://${displayHost}:${port}`);
  if (normalizedHost === '0.0.0.0' || normalizedHost === '::') {
    console.log(`Có thể truy cập từ mạng LAN qua địa chỉ IP của máy chủ (ví dụ: http://192.168.x.x:${port}).`);
  } else {
    console.log(`Đang lắng nghe trên địa chỉ mạng: ${normalizedHost}`);
  }
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/bootstrap', (req, res) => {
  const store = buildBootstrapSnapshot();
  res.json({ data: store });
});

app.post('/api/reports/export', async (req, res) => {
  try {
    const context = getSessionContext(req);
    if (!context) {
      res.status(401).json({ ok: false, error: 'Bạn cần đăng nhập để xuất báo cáo' });
      return;
    }
    if (context.account?.permissions?.reportsExport === false) {
      res.status(403).json({ ok: false, error: 'Tài khoản hiện không được phép xuất báo cáo' });
      return;
    }

    const kind = typeof req.body?.kind === 'string' ? req.body.kind : '';
    if (!kind) {
      res.status(400).json({ ok: false, error: 'Thiếu loại báo cáo cần xuất' });
      return;
    }

    const payload = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {};
    const { buffer, filename } = await generateReport(kind, payload);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setAttachmentHeaders(res, filename);
    res.send(buffer);
  } catch (err) {
    console.error('Không thể xuất báo cáo', err);
    const status = err?.message && /không hợp lệ/i.test(err.message) ? 400 : 500;
    res.status(status).json({ ok: false, error: err?.message || 'Không thể xuất báo cáo' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const usernameInput = (req.body?.username ?? '').toString().trim();
    const passwordInput = (req.body?.password ?? '').toString();
    if (!usernameInput || !passwordInput) {
      res.status(400).json({ ok: false, error: 'Thiếu thông tin đăng nhập' });
      return;
    }
    const accounts = loadAccountRecords();
    const account = accounts.find(
      (record) => record.username.toLowerCase() === usernameInput.toLowerCase()
    );
    if (!account) {
      pushAuditLog({ actor: usernameInput || 'unknown', action: 'auth.login_fail', detail: 'Đăng nhập thất bại' });
      clearSessionCookie(req, res);
      res.status(401).json({ ok: false, error: 'Sai tài khoản hoặc mật khẩu' });
      return;
    }
    const ok = await bcrypt.compare(passwordInput, account.passwordHash);
    if (!ok) {
      pushAuditLog({ actor: usernameInput || 'unknown', action: 'auth.login_fail', detail: 'Đăng nhập thất bại' });
      clearSessionCookie(req, res);
      res.status(401).json({ ok: false, error: 'Sai tài khoản hoặc mật khẩu' });
      return;
    }
    deleteSessionsForUser(account.username);
    const { token, expiresAt } = createSessionForUser(account.username);
    setSessionCookie(req, res, token, expiresAt);
    const user = sanitizeAccountRecord(account);
    pushAuditLog({ actor: account.username, action: 'auth.login', detail: 'Đăng nhập thành công' });
    res.json({ ok: true, user, expiresAt });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Không thể đăng nhập' });
  }
});

app.get('/api/auth/session', (req, res) => {
  try {
    const context = getSessionContext(req);
    if (!context) {
      clearSessionCookie(req, res);
      res.json({ ok: true, user: null });
      return;
    }
    const user = sanitizeAccountRecord(context.account);
    res.json({ ok: true, user, expiresAt: context.expiresAt });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Không thể tải phiên đăng nhập' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  try {
    const context = getSessionContext(req);
    if (context) {
      deleteSessionToken(context.token);
      pushAuditLog({ actor: context.account.username, action: 'auth.logout', detail: 'Đăng xuất khỏi hệ thống' });
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Không thể đăng xuất' });
  }
});

app.get('/api/auth/accounts', (req, res) => {
  try {
    res.json({ ok: true, accounts: listAccountsForClient() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Không thể tải danh sách tài khoản' });
  }
});

app.post('/api/auth/accounts', (req, res) => {
  try {
    const actor = resolveActor(req);
    const account = createAccountRecord(req.body, { actor });
    res.status(201).json({ ok: true, account, accounts: listAccountsForClient() });
  } catch (err) {
    res.status(400).json({ ok: false, error: err?.message || 'Không thể tạo tài khoản' });
  }
});

app.patch('/api/auth/accounts/:username', (req, res) => {
  try {
    const actor = resolveActor(req);
    const account = updateAccountRecord(req.params.username, req.body, { actor });
    res.json({ ok: true, account, accounts: listAccountsForClient() });
  } catch (err) {
    const status = err?.message && err.message.includes('Không tìm thấy') ? 404 : 400;
    res.status(status).json({ ok: false, error: err?.message || 'Không thể cập nhật tài khoản' });
  }
});

app.post('/api/auth/accounts/:username/password', (req, res) => {
  try {
    const actor = resolveActor(req);
    setAccountPasswordRecord(req.params.username, req.body?.password, { actor });
    res.json({ ok: true, accounts: listAccountsForClient() });
  } catch (err) {
    const status = err?.message && err.message.includes('Không tìm thấy') ? 404 : 400;
    res.status(status).json({ ok: false, error: err?.message || 'Không thể đặt lại mật khẩu' });
  }
});

app.delete('/api/auth/accounts/:username', (req, res) => {
  try {
    const actor = resolveActor(req);
    const accounts = deleteAccountRecord(req.params.username, { actor });
    res.json({ ok: true, accounts });
  } catch (err) {
    const status = err?.message && err.message.includes('Không tìm thấy') ? 404 : 400;
    res.status(status).json({ ok: false, error: err?.message || 'Không thể xóa tài khoản' });
  }
});

app.post('/api/auth/password/change', async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body || {};
    const account = await changeOwnPasswordRecord(username, currentPassword, newPassword);
    deleteSessionsForUser(account?.username || username);
    const { token, expiresAt } = createSessionForUser(account?.username || username);
    setSessionCookie(req, res, token, expiresAt);
    res.json({ ok: true, account, expiresAt });
  } catch (err) {
    const status = err?.message && err.message.includes('Không tìm thấy') ? 404 : 400;
    res.status(status).json({ ok: false, error: err?.message || 'Không thể đổi mật khẩu' });
  }
});

app.put('/api/storage/:key', (req, res) => {
  const key = req.params.key;
  if (!key) {
    res.status(400).json({ ok: false, error: 'Thiếu key' });
    return;
  }
  if (key === 'kpi_users_v1') {
    res.status(403).json({ ok: false, error: 'Khoá này chỉ chỉnh sửa qua API tài khoản' });
    return;
  }
  const { value } = req.body || {};
  const { context, denied } = verifyStoragePermission(req, res, key);
  if (denied) {
    return;
  }
  const actor = context?.account?.username || resolveActor(req);
  try {
    if (value === null || value === undefined) {
      deleteValue(key);
    } else {
      upsertValue(key, value);
    }
    if (key === 'decl_rows_v1') {
      evaluateDeclarationAlerts({ actor, reason: 'storage-put' });
    }
    if (key === 'ecus_sync_config_v1') {
      refreshEcusSchedule();
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Lỗi ghi dữ liệu', err);
    res.status(500).json({ ok: false, error: 'Không thể ghi dữ liệu' });
  }
});

app.delete('/api/storage/:key', (req, res) => {
  const key = req.params.key;
  if (!key) {
    res.status(400).json({ ok: false, error: 'Thiếu key' });
    return;
  }
  if (key === 'kpi_users_v1') {
    res.status(403).json({ ok: false, error: 'Khoá này chỉ chỉnh sửa qua API tài khoản' });
    return;
  }
  const { denied } = verifyStoragePermission(req, res, key);
  if (denied) {
    return;
  }
  try {
    deleteValue(key);
    res.json({ ok: true });
  } catch (err) {
    console.error('Lỗi xóa dữ liệu', err);
    res.status(500).json({ ok: false, error: 'Không thể xóa dữ liệu' });
  }
});

app.get('/api/import/ecus/config', (req, res) => {
  const config = formatEcusConfigForClient(getEcusConfig());
  res.json({ ok: true, config });
});

app.get('/api/import/ecus/status', async (req, res) => {
  try {
    const database = await checkSqlServerHealth();
    const backend = {
      ok: true,
      state: 'online',
      checkedAt: new Date().toISOString(),
    };
    res.json({
      ok: true,
      backend,
      database,
      config: formatEcusConfigForClient(getEcusConfig()),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Không thể kiểm tra trạng thái ECUS' });
  }
});

app.put('/api/import/ecus/config', (req, res) => {
  const { denied } = requireAdminSyncManage(req, res);
  if (denied) {
    return;
  }
  try {
    const payload = req.body?.config ?? req.body ?? {};
    const preservePassword = !!(req.body && req.body.preservePassword);
    const next = saveEcusConfig(payload, { preservePassword });
    refreshEcusSchedule();
    res.json({ ok: true, config: formatEcusConfigForClient(next) });
  } catch (err) {
    res.status(400).json({ ok: false, error: err?.message || 'Không thể lưu cấu hình đồng bộ' });
  }
});

app.post('/api/import/ecus/preview', async (req, res) => {
  const { denied } = requireAdminSyncManage(req, res);
  if (denied) {
    return;
  }
  try {
    const { from, to, limit } = req.body || {};
    const preview = await previewEcusSync({ from, to }, { limit });
    res.json({
      ok: true,
      preview: {
        rows: preview.rows,
        limited: preview.limited,
        fetched: preview.totalFetched,
        range: preview.range,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Không thể xem trước dữ liệu đồng bộ' });
  }
});

app.post('/api/import/ecus/run', async (req, res) => {
  const { denied } = requireAdminSyncManage(req, res);
  if (denied) {
    return;
  }
  try {
    const actor = resolveActor(req);
    const { from, to } = req.body || {};
    const result = await runEcusSyncWithErrorHandling({ from, to, actor, reason: 'manual' });
    res.json({ ok: true, result: { ...result, config: formatEcusConfigForClient(result.config) } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Không thể đồng bộ ECUS' });
  }
});

app.get('/api/import/alerts', (req, res) => {
  const payload = buildAlertPayload();
  res.json({ ok: true, ...payload });
});

app.get('/api/import/alerts/config', (req, res) => {
  res.json({ ok: true, config: getAlertConfig() });
});

app.put('/api/import/alerts/config', (req, res) => {
  try {
    const actor = resolveActor(req);
    const next = saveAlertConfig(req.body?.config || {});
    const summary = evaluateDeclarationAlerts({ actor, reason: 'alert-config' });
    res.json({ ok: true, config: next, summary });
  } catch (err) {
    res.status(400).json({ ok: false, error: err?.message || 'Không thể cập nhật cấu hình cảnh báo' });
  }
});

app.post('/api/import/alerts/review', (req, res) => {
  const keys = Array.isArray(req.body?.keys) ? req.body.keys : [];
  const actor = resolveActor(req);
  const updated = markDeclarationsReviewed(keys, { actor });
  const summary = evaluateDeclarationAlerts({ actor, reason: 'manual-review' });
  res.json({ ok: true, updated, summary });
});

refreshEcusSchedule();

app.use(express.static(DIST_DIR));
app.get('*', async (req, res, next) => {
  try {
    await fs.access(path.join(DIST_DIR, 'index.html'));
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  } catch {
    next();
  }
});

let httpServer = null;

export function startServer(port = PORT) {
  if (httpServer) {
    return httpServer;
  }
  httpServer = app.listen(port, HOST, () => {
    logServerAddresses(port, HOST);
  });
  return httpServer;
}

export function stopServer() {
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
}

export function getDatabaseHandle() {
  return db;
}

if (process.env.KPI_SKIP_LISTEN !== '1') {
  startServer(PORT);
}
