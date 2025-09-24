import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import process from 'node:process';
import Database from 'better-sqlite3';
import cron from 'node-cron';
import sql from 'mssql';

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

const DB_FILE = resolveDbFile(process.env.KPI_DB_FILE);
const LEGACY_JSON = path.resolve(__dirname, 'data/db.json');
const DIST_DIR = path.resolve(__dirname, '../dist');

const DEFAULT_ECUS_SYNC_CONFIG = {
  enabled: false,
  schedule: '0 * * * *',
  rangeDays: 1,
  preferMonthFirst: false,
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

const DEFAULT_STORAGE = {
  decl_rows_v1: '[]',
  mst_rows_v2: '[]',
  kpi_rules_v2: JSON.stringify({ version: 1, points: { base: 1 } }),
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
  ecus_sync_config_v1: JSON.stringify(DEFAULT_ECUS_SYNC_CONFIG),
  decl_alert_config_v1: JSON.stringify(DEFAULT_ALERT_CONFIG),
  decl_alert_state_v1: JSON.stringify(DEFAULT_ALERT_STATE),
  kpi_users_v1: JSON.stringify([
    {
      username: 'admin',
      password: 'admin123',
      role: 'admin',
      name: 'Quản trị viên',
      permissions: {
        importEdit: true,
        mstEdit: true,
        rulesEdit: true,
        teamsEdit: true,
        syncManage: true,
        reportsExport: true,
        alertsManage: true,
        auditView: true,
        accountManage: true,
      },
    },
    {
      username: 'nhanvien',
      password: '123456',
      role: 'staff',
      name: 'Nhân viên',
      permissions: {
        importEdit: true,
        mstEdit: false,
        rulesEdit: false,
        teamsEdit: false,
        syncManage: false,
        reportsExport: true,
        alertsManage: false,
        auditView: false,
        accountManage: false,
      },
    },
  ]),
};

function normalizeValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}

async function initializeDatabase({ dbFile = DB_FILE } = {}) {
  if (dbFile !== ':memory:') {
    await fs.mkdir(path.dirname(dbFile), { recursive: true });
  }
  const database = new Database(dbFile);
  database.pragma('journal_mode = WAL');
  database.exec(
    'CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)'
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

export function resetDatabaseForTests() {
  if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
    throw new Error('resetDatabaseForTests chỉ sử dụng trong môi trường kiểm thử');
  }

  db.exec('DELETE FROM kv_store');
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

function pushImportLog(message) {
  const logs = getJSONValue('import_logs_v1', []);
  logs.unshift({ ts: new Date().toISOString(), msg: message });
  setJSONValue('import_logs_v1', logs.slice(0, 100));
}

function getDeclRows() {
  const rows = getJSONValue('decl_rows_v1', []);
  return Array.isArray(rows) ? rows : [];
}

function saveDeclRowsServer(newRows, { overwrite = false, actor = 'system', detail = '' } = {}) {
  const cleaned = Array.isArray(newRows) ? newRows : [];
  if (overwrite) {
    setJSONValue('decl_rows_v1', cleaned);
    pushAuditLog({ actor, action: 'decl.overwrite', detail: detail || `Ghi đè ${cleaned.length} tờ khai` });
    return cleaned.length;
  }

  const current = getDeclRows();
  const map = new Map();
  const keyOf = (row) => `${(row?.so_tk ?? '').toString()}_${normalizeStr(row?.nhanh || '')}`;
  for (const row of current) {
    map.set(keyOf(row), row);
  }
  for (const row of cleaned) {
    map.set(keyOf(row), row);
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
  return getJSONValue('kpi_rules_v2', { version: 1, points: { base: 1 } });
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
    const key = `${(row?.so_tk ?? '').toString()}_${normalizeStr(row?.nhanh || '')}`;
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
  return {
    server: connection.server || process.env.ECUS_SQL_SERVER || '',
    database: connection.database || process.env.ECUS_SQL_DATABASE || '',
    user: connection.user || process.env.ECUS_SQL_USER || '',
    password: connection.password || process.env.ECUS_SQL_PASSWORD || '',
    options: {
      encrypt: connection.options?.encrypt ?? false,
      trustServerCertificate: connection.options?.trustServerCertificate ?? true,
    },
  };
}

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
  if (!tokens.length) {
    const numeric = Number(str);
    if (Number.isFinite(numeric)) {
      return Math.max(0, Math.round(numeric));
    }
  }
  return tokens.length;
}

const COLUMN_ALIASES = Object.freeze({
  so_tk: ['so_tk', 'sotk', 'soTk', 'So_tk', 'SoTK', 'SO_TK'],
  date: [
    'ngay_dang_ky',
    'Ngay_dang_ky',
    'ngay_dk',
    'Ngay_dk',
    'NgayDK',
    'ngayKhai',
    'NgayKhai',
    'ngaylap',
  ],
  nhanh: ['nhanh', 'chi_cuc', 'Chi_cuc', 'chiCuc', 'ma_chi_cuc', 'ChiCuc'],
  mst: ['mst', 'MST', 'ma_so_thue', 'Ma_so_thue', 'maSoThue', 'MaSoThue', 'mst_dn', 'ma_so_thue_dn'],
  cong_ty: [
    'cong_ty',
    'Cong_ty',
    'ten_dn',
    'Ten_dn',
    'ten_doanh_nghiep',
    'TenDoanhNghiep',
    'doanh_nghiep',
    'ten_khach_hang',
  ],
  loai_hinh: ['loai_hinh', 'Loai_hinh', 'ma_loai_hinh', 'MaLoaiHinh'],
  num_items: ['num_items', 'muc_hang', 'Muc_hang', 'so_muc', 'So_muc', 'so_luong_mh', 'SoLuongMatHang'],
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
  ],
  nhan_vien: ['nhan_vien', 'Nhan_vien', 'nhanVien'],
  nhan_vien_import: [
    'nhan_vien_nhap',
    'Nhan_vien_nhap',
    'nv_nhap',
    'NVNhap',
    'NhanVienNhap',
  ],
  nhan_vien_export: [
    'nhan_vien_xuat',
    'Nhan_vien_xuat',
    'nv_xuat',
    'NVXuat',
    'NhanVienXuat',
  ],
  team: ['team', 'team_name', 'to_doi', 'To_doi', 'ten_to', 'ToDoi'],
});

function buildRecordKeyLookup(record) {
  const lookup = new Map();
  for (const key of Object.keys(record)) {
    lookup.set(key.toLowerCase(), key);
  }
  return lookup;
}

function readRecordValue(record, lookup, candidate) {
  if (!candidate && candidate !== 0) {
    return undefined;
  }
  const keyString = String(candidate);
  const actualKey = lookup.get(keyString.toLowerCase());
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

  return {
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
  };
}

async function fetchEcusDeclarations(range, config) {
  const connectionConfig = buildSqlConnectionConfig(config);
  if (!connectionConfig.server || !connectionConfig.database) {
    throw new Error('Chưa cấu hình máy chủ hoặc cơ sở dữ liệu SQL Server');
  }

  const pool = new sql.ConnectionPool(connectionConfig);
  const poolClose = () => pool.close().catch(() => {});
  await pool.connect();
  try {
    const request = pool.request();
    const fromDate = range.from ? new Date(range.from) : null;
    const toDate = range.to ? new Date(range.to) : null;
    if (fromDate) {
      request.input('from', sql.DateTime, fromDate);
    }
    if (toDate) {
      request.input('to', sql.DateTime, toDate);
    }
    const query = config.query || DEFAULT_ECUS_SYNC_CONFIG.query;
    const result = await request.query(query);
    return result?.recordset || [];
  } finally {
    await poolClose();
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

async function runEcusSync({ from, to, actor = 'system', reason = 'manual' } = {}) {
  const config = getEcusConfig();
  const range = computeRangeWindow(config, { from, to });
  const syncReason = reason || 'manual';
  const rawRows = await fetchEcusDeclarations(range, config);
  const rules = getRulesValue();
  const excludeSet = new Set(
    Array.isArray(rules?.license?.excludeCodes)
      ? rules.license.excludeCodes.map((code) => normalizeStr(code).toUpperCase())
      : [],
  );
  const context = {
    licenseExcludeSet: excludeSet,
    memberTeamMap: getMemberTeamMap(),
  };

  const mapped = rawRows
    .map((row) => mapEcusRow(row, config, context))
    .filter((row) => row && row.so_tk && row.date);

  const runAtIso = new Date().toISOString();

  const saved = saveDeclRowsServer(mapped, {
    overwrite: false,
    actor,
    detail: `Đồng bộ ${mapped.length} tờ khai từ ECUS (${range.from || '...'} → ${range.to || '...'}) [${syncReason}]`,
  });

  const alertSummary = evaluateDeclarationAlerts({ actor, reason: 'ecus-sync' });

  pushImportLog(
    `ECUS sync (${syncReason}) ${mapped.length} dòng (${range.from || '...'} → ${range.to || '...'}) – tổng lưu: ${saved}`,
  );

  const nextConfig = saveEcusConfig({
    lastRun: runAtIso,
    lastStatus: 'success',
    lastSummary: {
      runAt: runAtIso,
      rowsFetched: rawRows.length,
      rowsImported: mapped.length,
      totalStored: saved,
      range,
      alerts: alertSummary,
    },
  }, { preservePassword: true });

  return {
    config: nextConfig,
    fetched: rawRows.length,
    imported: mapped.length,
    storedTotal: saved,
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
const PORT = Number.parseInt(process.env.PORT || '4000', 10);

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/bootstrap', (req, res) => {
  const store = readStorage();
  res.json({ data: store });
});

app.put('/api/storage/:key', (req, res) => {
  const key = req.params.key;
  if (!key) {
    res.status(400).json({ ok: false, error: 'Thiếu key' });
    return;
  }
  const { value } = req.body || {};
  try {
    if (value === null || value === undefined) {
      deleteValue(key);
    } else {
      upsertValue(key, value);
    }
    if (key === 'decl_rows_v1') {
      evaluateDeclarationAlerts({ actor: req.body?.actor || 'api', reason: 'storage-put' });
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

app.put('/api/import/ecus/config', (req, res) => {
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

app.post('/api/import/ecus/run', async (req, res) => {
  try {
    const actor = req.body?.actor || 'api';
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
    const actor = req.body?.actor || 'api';
    const next = saveAlertConfig(req.body?.config || {});
    const summary = evaluateDeclarationAlerts({ actor, reason: 'alert-config' });
    res.json({ ok: true, config: next, summary });
  } catch (err) {
    res.status(400).json({ ok: false, error: err?.message || 'Không thể cập nhật cấu hình cảnh báo' });
  }
});

app.post('/api/import/alerts/review', (req, res) => {
  const keys = Array.isArray(req.body?.keys) ? req.body.keys : [];
  const actor = req.body?.actor || 'api';
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
  httpServer = app.listen(port, () => {
    console.log(`KPI storage server đang chạy tại http://localhost:${port}`);
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
