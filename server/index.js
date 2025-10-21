import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import https from 'node:https';
import process from 'node:process';
import Database from 'better-sqlite3';
import cron from 'node-cron';
import sql from 'mssql';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { generateReport } from './reportExport.js';
import { buildReportData } from '../src/lib/reports.js';
import { buildDefaultAiProviders } from './aiProviders/index.js';
import { normalizeSqlUnicodeRecord } from './ecus/sqlUnicode.js';
import { getSecureSqlCredentials } from './ecus/secureCredentials.js';
import { deliverAlertNotification, hasAlertTargets } from './alerts/delivery.js';
import { loadAiHttpsConfig } from './https/aiHttpsConfig.js';
import { DEFAULT_RULES as SHARED_DEFAULT_RULES } from '../src/shared/defaultRules.js';
import { getRulesSeed, persistRulesSnapshot, loadRulesSnapshot, listRulesHistory } from './rulesPersistence.js';
import { deriveCOStatus, parseCoLineCount, setPreferentialCodeConfig } from '../src/shared/co.js';
import { filterDeclRows, normalizeDeclSearchFilters } from '../src/shared/declSearch.js';
import {
  ADMIN_ROLE,
  DEFAULT_ROLE,
  TEAM_LEAD_ROLE,
  MANAGER_ROLE,
  ROLE_LABELS,
  ACCOUNT_PERMISSION_KEYS,
  getPermissionTemplate as getRolePermissionTemplate,
  normalizeRoleKey,
  mergePermissions,
  isAdminRole,
} from '../src/shared/accountRoles.js';
import { translateBackupReason, translateBackupFailure } from '../src/shared/backupMessages.js';
import { recordSqlTimeout, getSqlTimeoutEvents, onSqlTimeout } from './sqlMonitor.js';
import {
  pushNotification,
  listNotifications,
  registerSseClient,
} from './notificationBus.js';
import { getTrainingResources } from './trainingResources.js';
import { addFeedbackEntry, getFeedbackSummary, listFeedbackEntries } from './feedbackStore.js';
import cronstrue from 'cronstrue';
import 'cronstrue/locales/vi.js';

const moduleUrl = typeof import.meta !== 'undefined' ? import.meta.url || '' : '';
const __dirname = moduleUrl.startsWith('file:')
  ? fileURLToPath(new URL('.', moduleUrl))
  : path.resolve(process.cwd(), 'server');
const execFileAsync = promisify(execFile);
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

function resolveBackupDir(value) {
  if (!value) {
    return path.resolve(__dirname, 'data/backups');
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
      end.setHours(23, 59, 59, 997);
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
      date.setHours(23, 59, 59, 997);
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
      return new Date(year, month - 1, day, 23, 59, 59, 997);
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
export const DB_BACKUP_DIR = resolveBackupDir(process.env.KPI_DB_BACKUP_DIR);
const LEGACY_JSON = path.resolve(__dirname, 'data/db.json');
const DIST_DIR = path.resolve(__dirname, '../dist');
const DEFAULT_BACKUP_CRON = (process.env.KPI_DB_BACKUP_CRON || '0 3 * * *').trim();
const envBackupRetentionRaw = process.env.KPI_DB_BACKUP_RETENTION ?? '14';
const envBackupRetentionParsed = Number.parseInt(envBackupRetentionRaw, 10);
const DB_BACKUP_RETENTION =
  Number.isFinite(envBackupRetentionParsed) && envBackupRetentionParsed >= 0
    ? envBackupRetentionParsed
    : 14;

const DEFAULT_ECUS_SCHEDULE_PRESET = Object.freeze({
  mode: 'daily',
  value: 1,
  time: '03:00',
});


const LEGACY_KPI_DECLARATIONS_REGEX = /from\s+kpi_declarations/i;

function normalizeEcusQueryInput(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    return DEFAULT_ECUS_SYNC_CONFIG.query;
  }
  if (LEGACY_KPI_DECLARATIONS_REGEX.test(text)) {
    return DEFAULT_ECUS_SYNC_CONFIG.query;
  }
  return text;
}

function normalizeEcusColumnMap(map = {}) {
  const normalized = { ...map };
  if (normalized.licenses === 'licenses') {
    normalized.licenses = 'license_count';
  }
  const coValue = normalized.co_line_count || normalized.co_count || 'co_count_num';
  normalized.co_line_count = coValue;
  normalized.co_count = coValue;
  return normalized;
}

const SCHEDULE_VALUE_LIMITS = Object.freeze({
  minutes: { min: 1, max: 60 },
  hours: { min: 1, max: 24 },
  daily: { min: 1, max: 31 },
});

const DEFAULT_ECUS_SYNC_CONFIG = {
  enabled: false,
  schedule: '0 3 * * *',
  schedulePreset: DEFAULT_ECUS_SCHEDULE_PRESET,
  rangeDays: 1,
  preferMonthFirst: false,
  batchSize: 500,
  includeTaxCodes: [],
  excludeTaxCodes: [],
  connection: {
    server: 'Server',
    database: 'ECUS5VNACCS',
    user: 'sa',
    password: '',
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
  },
  query: [
    'SELECT',
    '  CAST(lp.So_TK AS nvarchar(50)) AS so_tk,',
    '  CAST(lp.Ngay_DK AS date) AS ngay_dang_ky,',
    '  LTRIM(RTRIM(lp.Ma_LH)) AS loai_hinh,',
    '  LTRIM(RTRIM(lp.Ma_DN)) AS mst,',
    '  LTRIM(RTRIM(lp.TEN_DV)) AS cong_ty,',
    '  ISNULL(items.muc_hang, 0) AS muc_hang,',
    '  ISNULL(licenses.license_count, 0) AS license_count,',
    "  ISNULL(licenses.license_codes, N'') AS license_codes,",
    '  ISNULL(co_counts.co_count_num, 0) AS co_count_num',
    'FROM dbo.DTBLP AS lp',
    'LEFT JOIN dbo.DTOKHAIMD AS md ON md._DToKhaiMDID = lp._DTokhaiMDID',
    'LEFT JOIN dbo.DTOKHAIMD_VNACCS2 AS md2 ON md2._DToKhaiMDID = lp._DTokhaiMDID',
    'OUTER APPLY (',
    '  SELECT COUNT(*) AS muc_hang',
    '  FROM dbo.DHANGMDDK AS h',
    '  WHERE h._DToKhaiMDID = lp._DTokhaiMDID',
    ') AS items',
    'OUTER APPLY (',
    '  SELECT',
    '    COUNT(*) AS license_count,',
    '    STUFF((',
    "      SELECT ',' + codes2.code",
    '      FROM (',
    '        SELECT DISTINCT LTRIM(RTRIM(code)) AS code',
    '        FROM (',
    '          SELECT md.MA_GP AS code',
    '          UNION ALL SELECT md2.MA_GP2',
    '          UNION ALL SELECT md2.MA_GP3',
    '          UNION ALL SELECT md2.MA_GP4',
    '          UNION ALL SELECT md2.MA_GP5',
    '        ) AS raw_codes2',
    "        WHERE LTRIM(RTRIM(code)) <> ''",
    '      ) AS codes2',
    "      FOR XML PATH(''), TYPE",
    "    ).value('.', 'nvarchar(max)'), 1, 1, '') AS license_codes",
    '  FROM (',
    '    SELECT DISTINCT LTRIM(RTRIM(code)) AS code',
    '    FROM (',
    '      SELECT md.MA_GP AS code',
    '      UNION ALL SELECT md2.MA_GP2',
    '      UNION ALL SELECT md2.MA_GP3',
    '      UNION ALL SELECT md2.MA_GP4',
    '      UNION ALL SELECT md2.MA_GP5',
    '    ) AS raw_codes',
    "    WHERE LTRIM(RTRIM(code)) <> ''",
    '  ) AS codes',
    ') AS licenses',
    'OUTER APPLY (',
    '  SELECT COUNT(*) AS co_count_num',
    '  FROM dbo.DHANGMDDK AS h2',
    '  WHERE h2._DToKhaiMDID = lp._DTokhaiMDID',
    "    AND LEFT(UPPER(LTRIM(RTRIM(CAST(h2.TS_XNK_MA_BT AS nvarchar(10))))), 3) LIKE 'B%'",
    "    AND LEFT(UPPER(LTRIM(RTRIM(CAST(h2.TS_XNK_MA_BT AS nvarchar(10))))), 3) NOT IN ('B01', 'B02', 'B03', 'B30')",
    ') AS co_counts',
    'WHERE lp.Ngay_DK >= @from AND lp.Ngay_DK < DATEADD(DAY, 1, @to)',
  'ORDER BY lp.Ngay_DK, so_tk',
].join('\n'),
  columnMap: {
    so_tk: 'so_tk',
    date: 'ngay_dang_ky',
    loai_hinh: 'loai_hinh',
    mst: 'mst',
    cong_ty: 'cong_ty',
    num_items: 'muc_hang',
    licenses: 'license_count',
    nhan_vien_import: 'nhan_vien_nhap',
    nhan_vien_export: 'nhan_vien_xuat',
    co_line_count: 'co_count_num',
    co_count: 'co_count_num',
  },
  lastRun: null,
  lastStatus: null,
  lastSummary: null,
};

function clampScheduleValueForMode(mode, rawValue, fallback = DEFAULT_ECUS_SCHEDULE_PRESET.value) {
  const limits = SCHEDULE_VALUE_LIMITS[mode] || { min: 1, max: Number.MAX_SAFE_INTEGER };
  const candidate = Number.parseInt(rawValue, 10);
  if (Number.isFinite(candidate)) {
    if (candidate < limits.min) return limits.min;
    if (candidate > limits.max) return limits.max;
    return candidate;
  }
  const fallbackCandidate = Number.parseInt(fallback, 10);
  if (Number.isFinite(fallbackCandidate)) {
    if (fallbackCandidate < limits.min) return limits.min;
    if (fallbackCandidate > limits.max) return limits.max;
    return fallbackCandidate;
  }
  return limits.min;
}

function normalizeScheduleTimeInput(value, fallback = DEFAULT_ECUS_SCHEDULE_PRESET.time) {
  const base = typeof fallback === 'string' && fallback ? fallback : DEFAULT_ECUS_SCHEDULE_PRESET.time;
  if (typeof value !== 'string') {
    return base;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return base;
  }
  const match = trimmed.match(/^(\d{1,2})(?::(\d{1,2}))?$/u);
  if (!match) {
    return base;
  }
  let hours = Number.parseInt(match[1], 10);
  let minutes = match[2] === undefined ? 0 : Number.parseInt(match[2], 10);
  if (!Number.isFinite(hours) || hours < 0) {
    hours = 0;
  }
  if (!Number.isFinite(minutes) || minutes < 0) {
    minutes = 0;
  }
  hours = Math.min(Math.max(hours, 0), 23);
  minutes = Math.min(Math.max(minutes, 0), 59);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function normalizeSchedulePreset(input, fallback = DEFAULT_ECUS_SCHEDULE_PRESET) {
  const base = fallback && typeof fallback === 'object' ? fallback : DEFAULT_ECUS_SCHEDULE_PRESET;
  const rawMode = typeof input?.mode === 'string' ? input.mode.trim().toLowerCase() : base.mode;
  const validModes = new Set(['minutes', 'hours', 'daily', 'custom']);
  const mode = validModes.has(rawMode) ? rawMode : base.mode;
  const value = clampScheduleValueForMode(mode, input?.value, base.value);
  const time = mode === 'minutes'
    ? '00:00'
    : normalizeScheduleTimeInput(input?.time ?? base.time, base.time);
  const cron = normalizeCronExpression(input?.cron ?? input?.schedule ?? base.cron ?? DEFAULT_ECUS_SYNC_CONFIG.schedule);
  return {
    mode,
    value,
    time,
    cron,
  };
}

function buildCronFromPreset(preset, fallbackCron = DEFAULT_ECUS_SYNC_CONFIG.schedule) {
  if (!preset) {
    return normalizeCronExpression(fallbackCron);
  }
  const normalized = normalizeSchedulePreset(preset);
  const { mode, value, time, cron } = normalized;
  const [hour = 0, minute = 0] = time.split(':').map((part) => Number.parseInt(part, 10) || 0);
  if (mode === 'minutes') {
    if (value <= 1) {
      return '* * * * *';
    }
    return `*/${value} * * * *`;
  }
  if (mode === 'hours') {
    if (value <= 1) {
      return `${minute} * * * *`;
    }
    return `${minute} */${value} * * *`;
  }
  if (mode === 'daily') {
    const dayField = value <= 1 ? '*' : `*/${value}`;
    return `${minute} ${hour} ${dayField} * *`;
  }
  return normalizeCronExpression(cron || fallbackCron);
}

function deriveSchedulePreset(cronExpr, fallback = DEFAULT_ECUS_SCHEDULE_PRESET) {
  const fallbackPreset = normalizeSchedulePreset(fallback);
  const cron = normalizeCronExpression(cronExpr);
  if (!cron) {
    return { ...fallbackPreset, mode: 'custom', cron: '' };
  }
  const parts = cron.split(/\s+/u).filter(Boolean);
  if (parts.length === 6) {
    parts.shift();
  }
  if (parts.length < 5) {
    return { ...fallbackPreset, mode: 'custom', cron };
  }
  const [minuteRaw, hourRaw, domRaw, monthRaw, dowRaw] = parts;
  const minuteNum = Number.parseInt(minuteRaw, 10);
  const hourNum = Number.parseInt(hourRaw, 10);

  if ((minuteRaw === '*' || minuteRaw.startsWith('*/')) && hourRaw === '*' && domRaw === '*' && monthRaw === '*' && dowRaw === '*') {
    const interval = minuteRaw.startsWith('*/') ? Number.parseInt(minuteRaw.slice(2), 10) : 1;
    const safeInterval = Number.isFinite(interval) && interval > 0 ? interval : 1;
    return {
      mode: 'minutes',
      value: clampScheduleValueForMode('minutes', safeInterval, fallbackPreset.value),
      time: '00:00',
      cron,
    };
  }

  if (!Number.isNaN(minuteNum) && (hourRaw === '*' || hourRaw.startsWith('*/')) && domRaw === '*' && monthRaw === '*' && dowRaw === '*') {
    const interval = hourRaw.startsWith('*/') ? Number.parseInt(hourRaw.slice(2), 10) : 1;
    const safeInterval = Number.isFinite(interval) && interval > 0 ? interval : 1;
    const minutes = Math.min(Math.max(minuteNum, 0), 59);
    return {
      mode: 'hours',
      value: clampScheduleValueForMode('hours', safeInterval, fallbackPreset.value),
      time: normalizeScheduleTimeInput(`00:${String(minutes).padStart(2, '0')}`, fallbackPreset.time),
      cron,
    };
  }

  if (!Number.isNaN(minuteNum) && !Number.isNaN(hourNum) && monthRaw === '*' && dowRaw === '*') {
    const timeLabel = normalizeScheduleTimeInput(`${hourNum}:${minuteNum}`, fallbackPreset.time);
    if (domRaw === '*' || domRaw === '*/1') {
      return {
        mode: 'daily',
        value: clampScheduleValueForMode('daily', 1, fallbackPreset.value),
        time: timeLabel,
        cron,
      };
    }
    if (domRaw.startsWith('*/')) {
      const interval = Number.parseInt(domRaw.slice(2), 10);
      if (Number.isFinite(interval) && interval > 0) {
        return {
          mode: 'daily',
          value: clampScheduleValueForMode('daily', interval, fallbackPreset.value),
          time: timeLabel,
          cron,
        };
      }
    }
  }

  return { ...fallbackPreset, mode: 'custom', cron };
}

function resolveSchedulePresetFromConfig(config) {
  if (config?.schedulePreset && typeof config.schedulePreset === 'object') {
    return normalizeSchedulePreset(config.schedulePreset);
  }
  if (
    config &&
    (config.scheduleMode !== undefined ||
      config.scheduleValue !== undefined ||
      config.scheduleTime !== undefined)
  ) {
    return normalizeSchedulePreset({
      mode: config.scheduleMode,
      value: config.scheduleValue,
      time: config.scheduleTime,
      cron: config.schedule,
    });
  }
  if (config?.schedule) {
    return deriveSchedulePreset(config.schedule);
  }
  return normalizeSchedulePreset(DEFAULT_ECUS_SCHEDULE_PRESET);
}

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

const databaseInitState = {
  seeded: false,
  insertedEntries: 0,
  missingInserted: 0,
  timestamp: null,
  dbFile: null,
};

let dbBackupJob = null;
let coDiscrepancyJob = null;
let backupInProgress = false;
let restoreInProgress = false;
const backupScheduleMeta = {
  active: false,
  reasons: [],
  lastError: null,
  refreshedAt: null,
  cron: '',
  description: '',
};

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

const DEFAULT_ACCOUNT_SEED_UPDATED_AT = '2024-01-01T00:00:00.000Z';

const DEFAULT_ACCOUNT_SEED = [
  {
    username: 'admin',
    password: 'admin123',
    role: ADMIN_ROLE,
    name: 'Quản trị viên',
    permissions: getRolePermissionTemplate(ADMIN_ROLE),
  },
  {
    username: 'nhanvien',
    password: '123456',
    role: DEFAULT_ROLE,
    name: 'Nhân viên',
    permissions: mergePermissions(DEFAULT_ROLE, { importEdit: true }),
  },
  {
    username: 'lead.hoc',
    password: 'Hoc@2024',
    role: TEAM_LEAD_ROLE,
    name: 'Học',
    permissions: getRolePermissionTemplate(TEAM_LEAD_ROLE),
  },
  {
    username: 'lead.phuong',
    password: 'Phuong@2024',
    role: TEAM_LEAD_ROLE,
    name: 'Phương',
    permissions: getRolePermissionTemplate(TEAM_LEAD_ROLE),
  },
  {
    username: 'lead.tuan',
    password: 'Tuan@2024',
    role: TEAM_LEAD_ROLE,
    name: 'Tuấn',
    permissions: getRolePermissionTemplate(TEAM_LEAD_ROLE),
  },
  {
    username: 'manager.hoangkimhoa',
    password: 'Hoa@2024',
    role: MANAGER_ROLE,
    name: 'Hoàng Kim Hòa',
    permissions: getRolePermissionTemplate(MANAGER_ROLE),
  },
  {
    username: 'manager.thuyha',
    password: 'ThuyHa@2024',
    role: MANAGER_ROLE,
    name: 'Thúy Hà',
    permissions: getRolePermissionTemplate(MANAGER_ROLE),
  },
  {
    username: 'manager.hoainam',
    password: 'Nam@2024',
    role: MANAGER_ROLE,
    name: 'Hoài Nam',
    permissions: getRolePermissionTemplate(MANAGER_ROLE),
  },
];

const AI_CONFIG_KEY = 'ai_provider_config_v1';
const AI_CACHE_KEY = 'ai_usage_cache_v1';
const AI_CHAT_HISTORY_PREFIX = 'ai_chat_history__';
const MAX_AI_HISTORY_MESSAGES = 50;
const MAX_AI_MESSAGE_LENGTH = 6000;
const MAX_AI_SCOPE_LENGTH = 120;
const MAX_AI_PROVIDER_LENGTH = 120;

const STORAGE_PERMISSION_REQUIREMENTS = Object.freeze({
  decl_rows_v1: 'importEdit',
  import_logs_v1: 'importEdit',
  mst_rows_v2: 'mstEdit',
  team_roster_v1: 'teamsEdit',
  kpi_rules_v2: 'rulesEdit',
  hq_agencies_v1: 'mstEdit',
  hq_history_v1: 'mstEdit',
  decl_alert_config_v1: 'alertsManage',
  decl_alert_state_v1: 'alertsManage',
  ecus_sync_config_v1: 'syncManage',
  co_tax_code_config_v1: 'syncManage',
  co_discrepancy_config_v1: 'syncManage',
  co_discrepancy_state_v1: 'syncManage',
  kpi_adjustments_v1: 'adjustSubmit',
  [AI_CONFIG_KEY]: 'aiAssistManage',
  [AI_CACHE_KEY]: 'aiAssistManage',
});

const ACCOUNT_PERMISSION_LABELS = Object.freeze({
  importEdit: 'Import Data – chỉnh sửa & lưu',
  mstEdit: 'Gán MST – chỉnh sửa',
  rulesEdit: 'Quy tắc KPI – chỉnh sửa',
  teamsEdit: 'Quản lý tổ đội – chỉnh sửa',
  syncManage: 'Đồng bộ ECUS – cấu hình & chạy tay',
  reportsExport: 'Báo cáo KPI – xuất file',
  alertsManage: 'Quản lý cảnh báo tờ khai thiếu thông tin',
  auditView: 'Xem nhật ký hệ thống',
  accountManage: 'Quản lý tài khoản',
  adjustSubmit: 'Điểm KPI +/- thêm – gửi đề xuất',
  adjustApprove: 'Điểm KPI +/- thêm – duyệt đề xuất',
  aiAssistUse: 'Trợ lý AI – sử dụng',
  aiAssistManage: 'Trợ lý AI – cấu hình',
});

function normalizePermissionsForRole(permissions, role = DEFAULT_ROLE) {
  return mergePermissions(role, permissions);
}

function normalizeAccountUpdatedAt(value) {
  if (!value) {
    return DEFAULT_ACCOUNT_SEED_UPDATED_AT;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return DEFAULT_ACCOUNT_SEED_UPDATED_AT;
  }
  return date.toISOString();
}

function buildDefaultAccounts() {
  return DEFAULT_ACCOUNT_SEED.map((entry) => {
    const role = normalizeRoleKey(entry.role);
    return {
      username: entry.username,
      passwordHash: bcrypt.hashSync(entry.password, PASSWORD_SALT_ROUNDS),
      role,
      name: entry.name,
      permissions: normalizePermissionsForRole(entry.permissions, role),
      updatedAt: DEFAULT_ACCOUNT_SEED_UPDATED_AT,
    };
  });
}

function normalizeRetentionCopies(value) {
  if (value === undefined) {
    return null;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      return null;
    }
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }
    return parsed;
  }
  return null;
}

const DEFAULT_BACKUP_CONFIG = {
  cron: DEFAULT_BACKUP_CRON,
  retentionCopies: normalizeRetentionCopies(DB_BACKUP_RETENTION) ?? 14,
};

const DEFAULT_CO_PREFERENTIAL_BLACKLIST = Object.freeze(['B01', 'B03', 'B30', 'B02']);

const DEFAULT_CO_CODE_CONFIG = Object.freeze({
  version: 1,
  whitelist: [],
  blacklist: DEFAULT_CO_PREFERENTIAL_BLACKLIST,
  updatedAt: null,
  updatedBy: null,
});

const DEFAULT_CO_DISCREPANCY_CONFIG = Object.freeze({
  enabled: false,
  cron: '30 4 * * *',
  rangeDays: 3,
  threshold: 10,
  sampleLimit: 500,
  updatedAt: null,
  updatedBy: null,
});

const DEFAULT_CO_DISCREPANCY_STATE = Object.freeze({
  lastRunAt: null,
  range: null,
  mismatchCount: 0,
  totalChecked: 0,
  status: 'idle',
  error: null,
  durationMs: 0,
  mismatches: [],
  triggered: false,
  limited: false,
  actor: null,
  reason: null,
});

const AI_CACHE_LIMIT = 50;

function createDefaultAiConfig(env = process.env) {
  const { providers, defaultProviderId, fallbackProviderId } = buildDefaultAiProviders(env);
  return {
    version: 1,
    enabled: true,
    defaultProvider: defaultProviderId,
    fallbackProvider: fallbackProviderId,
    temperature: 0.2,
    maxTokens: 800,
    maxInputLength: 4000,
    timeoutMs: 25000,
    systemPrompt:
      'Bạn là trợ lý KPI nội bộ cho bộ phận khai báo hải quan. Luôn trả lời ngắn gọn, súc tích bằng tiếng Việt, ưu tiên bullet và chỉ dựa trên dữ liệu được cung cấp.',
    caching: {
      enabled: true,
      ttlMinutes: 72 * 60,
      maxEntries: AI_CACHE_LIMIT,
    },
    providers,
    updatedAt: null,
    updatedBy: null,
  };
}

const DEFAULT_AI_CONFIG = Object.freeze(createDefaultAiConfig());

const DEFAULT_AI_USAGE_CACHE = Object.freeze({
  version: 1,
  entries: [],
});

const AI_SNAPSHOT_CACHE_KEY = 'ai_snapshot_cache_v1';
const AI_SNAPSHOT_CACHE_TTL_MS = 15 * 60 * 1000;
const AI_SNAPSHOT_CACHE_LIMIT = 8;
const DEFAULT_AI_SNAPSHOT_CACHE = Object.freeze({
  version: 1,
  entries: [],
});

const AI_INSIGHTS_KEY = 'ai_insights_v1';
const AI_INSIGHT_MAX_ENTRIES = 30;
const AI_INSIGHT_FEEDBACK_COMMENT_LIMIT = 400;
const DEFAULT_AI_INSIGHTS = Object.freeze({
  version: 1,
  entries: [],
  state: {
    lastRunAt: null,
    lastStatus: 'never',
    lastError: null,
    lastProviderId: null,
  },
  schedule: {
    cron: null,
    nextRun: null,
  },
});

const DEFAULT_DUPLICATE_POLICY_CONFIG = Object.freeze({
  autoNotifyAfterDays: 7,
  notifyCooldownHours: 24,
  evaluationWindowDays: 14,
  autoLockEnabled: true,
  autoLockAfterGroups: 12,
  minGroupSizeForLock: 2,
  autoUnlockAfterDays: 3,
});

const DEFAULT_DUPLICATE_POLICY_STATE = Object.freeze({
  lastEvaluatedAt: null,
  notifiedGroups: {},
  lockedSources: {},
});

const FILTER_PRESETS_KEY = 'filter_presets_v1';
const FILTER_PRESET_VERSION = 1;
const FILTER_PRESET_SCOPE_DEFAULT = 'data-importer';
const KNOWN_FILTER_PRESET_SCOPES = new Set([FILTER_PRESET_SCOPE_DEFAULT, 'report-viewer']);
const FILTER_PRESET_MAX_PER_SCOPE = 20;

const EXPORT_AUDIT_DEFAULT_LIMIT = 50;
const EXPORT_AUDIT_MAX_LIMIT = 200;
const EXPORT_AUDIT_MAX_RANGE_DAYS = 60;
const DECL_SEARCH_DEFAULT_PAGE_SIZE = 10;
const DECL_SEARCH_MAX_PAGE_SIZE = 200;

const ECUS_MONITOR_HISTORY_KEY = 'ecus_monitor_history_v1';
const DEFAULT_ECUS_MONITOR_HISTORY = Object.freeze({
  version: 1,
  entries: [],
  updatedAt: null,
});

const DEFAULT_ECUS_MONITOR_HISTORY_OPTIONS = Object.freeze({
  maxEntries: 7 * 24 * 4, // 7 ngày với chu kỳ 15 phút
  dedupeMinutes: 5,
});

const DEFAULT_STORAGE = {
  decl_rows_v1: '[]',
  mst_rows_v2: '[]',
  mst_history_v1: '[]',
  kpi_rules_v2: JSON.stringify(getRulesSeed(SHARED_DEFAULT_RULES)),
  kpi_adjustments_v1: '[]',
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
  hq_history_v1: '[]',
  ecus_sync_config_v1: JSON.stringify(DEFAULT_ECUS_SYNC_CONFIG),
  decl_alert_config_v1: JSON.stringify(DEFAULT_ALERT_CONFIG),
  decl_alert_state_v1: JSON.stringify(DEFAULT_ALERT_STATE),
  kpi_users_v1: JSON.stringify(buildDefaultAccounts()),
  db_backup_config_v1: JSON.stringify(DEFAULT_BACKUP_CONFIG),
  co_tax_code_config_v1: JSON.stringify(DEFAULT_CO_CODE_CONFIG),
  co_discrepancy_config_v1: JSON.stringify(DEFAULT_CO_DISCREPANCY_CONFIG),
  duplicate_policy_config_v1: JSON.stringify(DEFAULT_DUPLICATE_POLICY_CONFIG),
  duplicate_policy_state_v1: JSON.stringify(DEFAULT_DUPLICATE_POLICY_STATE),
  co_discrepancy_state_v1: JSON.stringify(DEFAULT_CO_DISCREPANCY_STATE),
  filter_presets_v1: JSON.stringify({ version: 1, users: {} }),
  [ECUS_MONITOR_HISTORY_KEY]: JSON.stringify(DEFAULT_ECUS_MONITOR_HISTORY),
  [AI_CONFIG_KEY]: JSON.stringify(DEFAULT_AI_CONFIG),
  [AI_CACHE_KEY]: JSON.stringify(DEFAULT_AI_USAGE_CACHE),
  [AI_SNAPSHOT_CACHE_KEY]: JSON.stringify(DEFAULT_AI_SNAPSHOT_CACHE),
  [AI_INSIGHTS_KEY]: JSON.stringify(DEFAULT_AI_INSIGHTS),
};

function normalizeValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export async function initializeDatabase({ dbFile = DB_FILE } = {}) {
  const targetFile = dbFile === ':memory:' ? ':memory:' : path.resolve(dbFile);
  databaseInitState.seeded = false;
  databaseInitState.insertedEntries = 0;
  databaseInitState.missingInserted = 0;
  databaseInitState.timestamp = new Date().toISOString();
  databaseInitState.dbFile = targetFile;

  if (targetFile !== ':memory:') {
    await fs.mkdir(path.dirname(targetFile), { recursive: true });
  }
  const database = new Database(targetFile);
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
  database.exec(
    'CREATE TABLE IF NOT EXISTS export_audit (\n' +
      '  id INTEGER PRIMARY KEY AUTOINCREMENT,\n' +
      '  created_at TEXT NOT NULL,\n' +
      '  issued_at TEXT,\n' +
      '  username TEXT NOT NULL,\n' +
      '  display_name TEXT,\n' +
      '  role TEXT,\n' +
      '  report_kind TEXT NOT NULL,\n' +
      '  filename TEXT,\n' +
      '  signature TEXT,\n' +
      '  short_signature TEXT,\n' +
      '  filter_summary TEXT,\n' +
      '  filters TEXT,\n' +
      '  ip_address TEXT,\n' +
      '  request_id TEXT,\n' +
      '  user_agent TEXT\n' +
      ')'
  );
  database.exec('CREATE INDEX IF NOT EXISTS idx_export_audit_created_at ON export_audit(created_at)');
  database.exec('CREATE INDEX IF NOT EXISTS idx_export_audit_username ON export_audit(username)');

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
    databaseInitState.seeded = true;
    databaseInitState.insertedEntries = Object.keys(seedData).length;
    databaseInitState.missingInserted = 0;
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
      databaseInitState.seeded = false;
      databaseInitState.insertedEntries = 0;
      databaseInitState.missingInserted = missingEntries.length;
    } else {
      databaseInitState.seeded = false;
      databaseInitState.insertedEntries = 0;
      databaseInitState.missingInserted = 0;
    }
  }

  try {
    const row = database.prepare('SELECT value FROM kv_store WHERE key = ?').get('kpi_rules_v2');
    const rawRules = row?.value || null;
    if (typeof rawRules === 'string' && rawRules) {
      const currentSnapshot = loadRulesSnapshot();
      const existingRules = currentSnapshot?.rules || null;
      const parsedRules = safeParse(rawRules, null);
      if (parsedRules && JSON.stringify(existingRules) !== JSON.stringify(parsedRules)) {
        const source = databaseInitState.seeded ? 'bootstrap-seed' : 'bootstrap-sync';
        persistRulesSnapshot(rawRules, { actor: 'system', source });
      }
    }
  } catch (err) {
    console.warn('Không thể đồng bộ file quy tắc KPI khi khởi tạo', err);
  }

  return database;
}

async function ensureBackupDirectory(backupDir) {
  if (!backupDir || backupDir === ':memory:') {
    throw new Error('Thư mục sao lưu không hợp lệ.');
  }
  await fs.mkdir(backupDir, { recursive: true });
}

async function rotateBackups(backupDir, retention) {
  const limit = Number.isFinite(retention) && retention >= 0 ? Math.trunc(retention) : null;
  if (limit === null) {
    return;
  }
  const entries = await fs.readdir(backupDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.startsWith('storage-') || !entry.name.endsWith('.sqlite')) {
      continue;
    }
    const fullPath = path.join(backupDir, entry.name);
    try {
      const stats = await fs.stat(fullPath);
      files.push({ path: fullPath, mtime: stats.mtimeMs });
    } catch {
      // ignore file that disappeared
    }
  }
  files.sort((a, b) => b.mtime - a.mtime);
  if (limit === 0) {
    return;
  }
  while (files.length > limit) {
    const removed = files.pop();
    if (!removed) break;
    try {
      await fs.rm(removed.path);
    } catch (err) {
      console.warn('Không thể xóa bản sao lưu cũ', removed.path, err);
    }
  }
}

export async function performDatabaseBackup({
  dbFile = DB_FILE,
  backupDir = DB_BACKUP_DIR,
  retention,
  reason = 'manual',
  actor = 'system',
  note = null,
} = {}) {
  const logOutcome = (status, meta = {}) => {
    const detailReason = meta.reason || reason || 'không rõ';
    const { note: metaNote, ...restMeta } = meta ?? {};
    pushAuditLog({
      actor,
      action: 'db.backup',
      detail:
        status === 'success'
          ? `Sao lưu CSDL (${detailReason})`
          : `Sao lưu CSDL thất bại (${detailReason})`,
      result: status,
      note: metaNote ?? note,
      meta: { status, reason: detailReason, ...restMeta },
    });
  };

  const logFailure = (failureReason, extraMeta = {}) => {
    logOutcome('failure', { reason: failureReason, ...extraMeta });
  };

  if (!dbFile || dbFile === ':memory:') {
    logFailure('memory_db', { dbFile });
    return { ok: false, reason: 'memory_db' };
  }
  if (!backupDir || backupDir === ':memory:') {
    logFailure('invalid_backup_dir', { backupDir });
    return { ok: false, reason: 'invalid_backup_dir' };
  }
  if (restoreInProgress) {
    logFailure('restore_in_progress', { dbFile, backupDir });
    return { ok: false, reason: 'restore_in_progress' };
  }
  const sourceFile = dbFile === ':memory:' ? null : path.resolve(dbFile);
  if (!sourceFile) {
    logFailure('memory_db', { dbFile });
    return { ok: false, reason: 'memory_db' };
  }
  if (backupInProgress) {
    logFailure('in_progress', { dbFile, backupDir });
    return { ok: false, reason: 'in_progress' };
  }
  backupInProgress = true;
  try {
    await fs.access(sourceFile);
  } catch {
    backupInProgress = false;
    logFailure('missing_source', { dbFile: sourceFile });
    return { ok: false, reason: 'missing_source' };
  }

  let retentionLimit = null;
  if (Number.isFinite(retention) && retention >= 0) {
    retentionLimit = Math.trunc(retention);
  } else {
    const config = getBackupConfig();
    let retentionFromConfig = false;
    if (config) {
      if (config.retentionCopies === null) {
        retentionLimit = null;
        retentionFromConfig = true;
      } else if (Number.isFinite(config.retentionCopies) && config.retentionCopies >= 0) {
        retentionLimit = Math.trunc(config.retentionCopies);
        retentionFromConfig = true;
      }
    }
    if (!retentionFromConfig) {
      if (Number.isFinite(DB_BACKUP_RETENTION) && DB_BACKUP_RETENTION >= 0) {
        retentionLimit = Math.trunc(DB_BACKUP_RETENTION);
      } else {
        retentionLimit = null;
      }
    }
  }

  try {
    await ensureBackupDirectory(backupDir);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `storage-${timestamp}.sqlite`;
    const destination = path.join(backupDir, filename);
    await fs.copyFile(sourceFile, destination);
    const stats = await fs.stat(destination);
    await rotateBackups(backupDir, retentionLimit);
    logOutcome('success', { reason, file: destination, bytes: stats.size, retention: retentionLimit });
    console.log(`💾 Đã sao lưu CSDL tới ${destination}`);
    return { ok: true, file: destination, bytes: stats.size, reason };
  } catch (err) {
    console.error('Không thể sao lưu CSDL:', err);
    logFailure('error', { error: err?.message || String(err) });
    return { ok: false, error: err?.message || String(err) };
  } finally {
    backupInProgress = false;
  }
}

function normalizeBackupAuditEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const ts = typeof entry.ts === 'string' ? entry.ts : null;
  const actor = entry.actor || 'system';
  const action = entry.action || 'unknown';
  const detail = entry.detail || '';
  const meta = entry.meta ?? null;
  const result = entry.result ?? null;
  const note = entry.note ?? null;
  const category = entry.category || inferAuditCategory(action);
  return { ts, actor, action, detail, meta, result, note, category };
}

async function listBackupFiles({ backupDir = DB_BACKUP_DIR, limit = 50 } = {}) {
  if (!backupDir || backupDir === ':memory:') {
    return [];
  }
  const targetDir = path.resolve(backupDir);
  let entries;
  try {
    entries = await fs.readdir(targetDir, { withFileTypes: true });
  } catch (err) {
    if (err?.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.startsWith('storage-') || !entry.name.endsWith('.sqlite')) {
      continue;
    }
    const fullPath = path.join(targetDir, entry.name);
    try {
      const stats = await fs.stat(fullPath);
      files.push({
        filename: entry.name,
        path: fullPath,
        bytes: stats.size,
        modifiedAt: stats.mtime ? new Date(stats.mtime).toISOString() : null,
      });
    } catch {
      // skip files we can't stat
    }
  }
  files.sort((a, b) => {
    const aTime = a.modifiedAt ? Date.parse(a.modifiedAt) : 0;
    const bTime = b.modifiedAt ? Date.parse(b.modifiedAt) : 0;
    return bTime - aTime;
  });
  const sliceLimit = Number.isFinite(limit) && limit > 0 ? Math.min(files.length, Math.trunc(limit)) : files.length;
  return files.slice(0, sliceLimit).map((file) => ({
    filename: file.filename,
    bytes: file.bytes,
    modifiedAt: file.modifiedAt,
  }));
}

async function restoreDatabaseBackup({
  filename,
  backupDir = DB_BACKUP_DIR,
  dbFile = DB_FILE,
  actor = 'system',
  note = null,
} = {}) {
  const logOutcome = (status, meta = {}) => {
    const name = meta.filename || filename || 'không xác định';
    const { note: metaNote, ...restMeta } = meta ?? {};
    pushAuditLog({
      actor,
      action: 'db.restore',
      detail:
        status === 'success'
          ? `Khôi phục CSDL từ ${name}`
          : `Khôi phục CSDL thất bại (${name})`,
      result: status,
      note: metaNote ?? note,
      meta: { filename: name, ...restMeta },
    });
  };

  const safeFilename = typeof filename === 'string' ? filename.trim() : '';
  if (!safeFilename) {
    logOutcome('failure', { reason: 'missing_filename' });
    return { ok: false, reason: 'missing_filename' };
  }
  if (!backupDir || backupDir === ':memory:') {
    logOutcome('failure', { reason: 'invalid_backup_dir' });
    return { ok: false, reason: 'invalid_backup_dir' };
  }
  if (!dbFile || dbFile === ':memory:') {
    logOutcome('failure', { reason: 'memory_db' });
    return { ok: false, reason: 'memory_db' };
  }
  if (restoreInProgress) {
    logOutcome('failure', { reason: 'restore_in_progress' });
    return { ok: false, reason: 'restore_in_progress' };
  }
  if (backupInProgress) {
    logOutcome('failure', { reason: 'backup_in_progress' });
    return { ok: false, reason: 'backup_in_progress' };
  }

  const targetDir = path.resolve(backupDir);
  const resolvedSource = path.resolve(targetDir, path.basename(safeFilename));
  if (!resolvedSource.startsWith(targetDir)) {
    logOutcome('failure', { reason: 'invalid_filename', filename: safeFilename });
    return { ok: false, reason: 'invalid_filename' };
  }

  let stats;
  try {
    stats = await fs.stat(resolvedSource);
  } catch (err) {
    logOutcome('failure', { reason: err?.code === 'ENOENT' ? 'missing_file' : 'stat_failed', error: err?.message, filename: safeFilename });
    return { ok: false, reason: err?.code === 'ENOENT' ? 'missing_file' : 'stat_failed' };
  }

  const targetFile = path.resolve(dbFile);
  const tempFile = `${targetFile}.restore-${Date.now()}.tmp`;
  const backupBeforeRestore = `${targetFile}.pre-restore-${Date.now()}.bak`;

  restoreInProgress = true;
  const previousDb = db;
  try {
    if (previousDb && typeof previousDb.close === 'function') {
      previousDb.close();
    }
    await fs.mkdir(path.dirname(targetFile), { recursive: true });
    try {
      await fs.copyFile(targetFile, backupBeforeRestore);
    } catch (err) {
      if (err?.code !== 'ENOENT') {
        console.warn('Không thể tạo bản sao DB hiện tại trước khi restore:', err);
      }
    }

    await fs.copyFile(resolvedSource, tempFile);
    await fs.rename(tempFile, targetFile);

    db = await initializeDatabase({ dbFile: targetFile });
    refreshDatabaseBackupSchedule();
    applyCoCodeConfig(getCoCodeConfig());
    if (typeof refreshCoDiscrepancySchedule === 'function') {
      refreshCoDiscrepancySchedule();
    }

    logOutcome('success', {
      filename: safeFilename,
      file: resolvedSource,
      bytes: stats.size,
      backupBeforeRestore,
    });
    console.log(`♻️ Đã khôi phục CSDL từ ${resolvedSource}`);
    return { ok: true, file: resolvedSource, bytes: stats.size, backupBeforeRestore };
  } catch (err) {
    console.error('Không thể khôi phục CSDL:', err);
    logOutcome('failure', {
      reason: 'error',
      error: err?.message || String(err),
      filename: safeFilename,
    });
    try {
      if (!db || db === previousDb) {
        db = await initializeDatabase({ dbFile: targetFile });
      }
    } catch (reopenErr) {
      console.error('Không thể mở lại CSDL sau khi restore thất bại:', reopenErr);
    }
    return { ok: false, error: err?.message || 'Không thể khôi phục CSDL' };
  } finally {
    restoreInProgress = false;
    try {
      await fs.rm(tempFile);
    } catch {
      // ignore temp cleanup errors
    }
  }
}

function nextBackupRunISO() {
  if (!backupScheduleMeta.active || !dbBackupJob || typeof dbBackupJob.nextDates !== 'function') {
    return null;
  }
  try {
    const next = dbBackupJob.nextDates();
    if (!next) return null;
    if (typeof next.toISO === 'function') {
      return next.toISO();
    }
    if (typeof next.toDate === 'function') {
      return next.toDate().toISOString();
    }
    if (next instanceof Date) {
      return next.toISOString();
    }
    const candidate = new Date(next);
    return Number.isNaN(candidate.getTime()) ? null : candidate.toISOString();
  } catch {
    return null;
  }
}

function formatNextRunHuman(isoValue) {
  if (!isoValue) {
    return null;
  }
  try {
    return new Date(isoValue).toLocaleString('vi-VN', {
      hour12: false,
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

const SEVERITY_PRIORITY = Object.freeze({
  good: 0,
  info: 1,
  warning: 2,
  critical: 3,
});

function escalateSeverity(current, next) {
  const currentRank = SEVERITY_PRIORITY[current] ?? 0;
  const nextRank = SEVERITY_PRIORITY[next] ?? 0;
  return nextRank > currentRank ? next : current;
}

function parseTimestamp(value) {
  if (!value) {
    return null;
  }
  try {
    const ts = Date.parse(value);
    return Number.isNaN(ts) ? null : ts;
  } catch {
    return null;
  }
}

function formatBytes(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }
  if (num === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let size = num;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const digits = size >= 10 || unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
}

async function collectDatabaseStorageDetails() {
  const databaseInfo = {
    file: DB_FILE,
    mode: DB_FILE === ':memory:' ? 'memory' : 'file',
    sizeBytes: null,
    sizeLabel: null,
    lastModifiedAt: null,
    error: null,
    warningCode: null,
    sqliteStats: null,
    sqliteStatsError: null,
  };

  const diskInfo = {
    path: DB_FILE === ':memory:' ? null : path.dirname(DB_FILE),
    totalBytes: null,
    freeBytes: null,
    usedBytes: null,
    usedPercent: null,
    freePercent: null,
    totalLabel: null,
    freeLabel: null,
    usedLabel: null,
    error: null,
    warningCode: null,
    method: null,
  };

  if (databaseInfo.mode === 'memory') {
    databaseInfo.error = 'CSDL đang chạy ở chế độ bộ nhớ (:memory:).';
    databaseInfo.warningCode = 'memory_db';
    return { database: databaseInfo, disk: diskInfo };
  }

  try {
    const stats = await fs.stat(DB_FILE);
    databaseInfo.sizeBytes = stats.size;
    databaseInfo.sizeLabel = formatBytes(stats.size);
    databaseInfo.lastModifiedAt = stats.mtime ? new Date(stats.mtime).toISOString() : null;
  } catch (err) {
    databaseInfo.error = err?.message || String(err);
  }

  try {
    if (db && typeof db.pragma === 'function') {
      const pageSize = Number(db.pragma('page_size', { simple: true }));
      const pageCount = Number(db.pragma('page_count', { simple: true }));
      const freelistCount = Number(db.pragma('freelist_count', { simple: true }));
      if (Number.isFinite(pageSize) && Number.isFinite(pageCount) && pageCount >= 0) {
        const freePages = Number.isFinite(freelistCount) && freelistCount > 0 ? freelistCount : 0;
        const usedPages = Math.max(0, pageCount - freePages);
        const usedBytes = usedPages * pageSize;
        const freeBytes = freePages * pageSize;
        databaseInfo.sqliteStats = {
          pageSizeBytes: pageSize,
          pageCount,
          freelistCount: freePages,
          usedBytes,
          freeBytes,
          usedPercent: pageCount > 0 ? (usedPages / pageCount) * 100 : null,
          freePercent: pageCount > 0 ? (freePages / pageCount) * 100 : null,
        };
      }
    }
  } catch (err) {
    databaseInfo.sqliteStatsError = err?.message || String(err);
  }

  const assignDiskMetrics = (metrics, { method, warningCode = null, error = null } = {}) => {
    if (!metrics) {
      return;
    }
    const { totalBytes, freeBytes, usedBytes } = metrics;
    if (Number.isFinite(totalBytes) && totalBytes > 0) {
      diskInfo.totalBytes = totalBytes;
      diskInfo.totalLabel = formatBytes(totalBytes);
    }
    if (Number.isFinite(freeBytes) && freeBytes >= 0) {
      diskInfo.freeBytes = freeBytes;
      diskInfo.freeLabel = formatBytes(freeBytes);
    }
    if (Number.isFinite(usedBytes) && usedBytes >= 0) {
      diskInfo.usedBytes = usedBytes;
      diskInfo.usedLabel = formatBytes(usedBytes);
    }
    if (Number.isFinite(totalBytes) && totalBytes > 0) {
      diskInfo.usedPercent = Number.isFinite(usedBytes) ? (usedBytes / totalBytes) * 100 : null;
      diskInfo.freePercent = Number.isFinite(freeBytes) ? (freeBytes / totalBytes) * 100 : null;
    }
    diskInfo.method = method || null;
    diskInfo.warningCode = warningCode || null;
    diskInfo.error = error || null;
  };

  const readDiskUsageWithStatfs = async (targetPath) => {
    if (typeof fs.statfs !== 'function') {
      return null;
    }
    const fsStats = await fs.statfs(targetPath);
    const blockSize = Number(fsStats?.bsize || fsStats?.frsize || 0);
    const totalBlocks = Number(fsStats?.blocks || 0);
    const freeBlocks = Number(fsStats?.bavail ?? fsStats?.bfree ?? 0);
    if (!Number.isFinite(totalBlocks) || totalBlocks <= 0 || !Number.isFinite(blockSize) || blockSize <= 0) {
      return null;
    }
    const totalBytes = totalBlocks * blockSize;
    const freeBytes = Math.max(0, freeBlocks * blockSize);
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    return { totalBytes, freeBytes, usedBytes };
  };

  const readDiskUsageWithDf = async (targetPath) => {
    const result = await execFileAsync('df', ['-Pk', targetPath], { timeout: 5000 });
    const output = result.stdout?.toString()?.trim();
    if (!output) {
      throw new Error('Không nhận được phản hồi từ lệnh df');
    }
    const lines = output.split(/\r?\n/);
    const dataLine = lines[lines.length - 1];
    if (!dataLine) {
      throw new Error('Không thể phân tích kết quả df');
    }
    const parts = dataLine.trim().split(/\s+/);
    if (parts.length < 4) {
      throw new Error('Thiếu thông tin dung lượng từ df');
    }
    const totalBytes = Number(parts[1]) * 1024;
    const usedBytes = Number(parts[2]) * 1024;
    const freeBytes = Number(parts[3]) * 1024;
    if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
      throw new Error('Kết quả df không hợp lệ');
    }
    return {
      totalBytes,
      usedBytes: Number.isFinite(usedBytes) && usedBytes >= 0 ? usedBytes : Math.max(0, totalBytes - freeBytes),
      freeBytes: Number.isFinite(freeBytes) && freeBytes >= 0 ? freeBytes : Math.max(0, totalBytes - usedBytes),
    };
  };

  const readDiskUsageWithPowerShell = async (targetPath) => {
    const parsed = path.win32.parse(path.resolve(targetPath));
    const driveName = parsed.root?.replace(/[:\\/]/g, '') || null;
    if (!driveName) {
      throw new Error('Không xác định được ổ đĩa Windows');
    }
    const psArgs = [
      '-NoProfile',
      '-Command',
      `Get-PSDrive -Name '${driveName}' | Select-Object @{Name="Total";Expression={$_.Used + $_.Free}},Used,Free | ConvertTo-Json -Compress`,
    ];
    const result = await execFileAsync('powershell.exe', psArgs, { windowsHide: true, timeout: 5000 });
    const raw = result.stdout?.toString()?.trim();
    if (!raw) {
      throw new Error('PowerShell không trả về dữ liệu');
    }
    const parsedJson = JSON.parse(raw);
    const totalBytes = Number(parsedJson?.Total ?? parsedJson?.total ?? 0);
    const usedBytes = Number(parsedJson?.Used ?? parsedJson?.used ?? 0);
    const freeBytes = Number(parsedJson?.Free ?? parsedJson?.free ?? 0);
    if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
      throw new Error('PowerShell trả về dữ liệu ổ đĩa không hợp lệ');
    }
    return {
      totalBytes,
      usedBytes: Number.isFinite(usedBytes) && usedBytes >= 0 ? usedBytes : Math.max(0, totalBytes - freeBytes),
      freeBytes: Number.isFinite(freeBytes) && freeBytes >= 0 ? freeBytes : Math.max(0, totalBytes - usedBytes),
    };
  };

  if (diskInfo.path) {
    let metrics = null;
    let warningCode = null;
    let error = null;
    if (!metrics) {
      try {
        metrics = await readDiskUsageWithStatfs(diskInfo.path);
        if (metrics) {
          assignDiskMetrics(metrics, { method: 'statfs' });
        }
      } catch (err) {
        warningCode = 'statfs_error';
        error = err?.message || String(err);
      }
    }
    if (!metrics && process.platform === 'win32') {
      try {
        metrics = await readDiskUsageWithPowerShell(diskInfo.path);
        if (metrics) {
          assignDiskMetrics(metrics, { method: 'powershell' });
        }
      } catch (err) {
        warningCode = 'windows_ps_error';
        error = err?.message || String(err);
      }
    }
    if (!metrics && process.platform !== 'win32') {
      try {
        metrics = await readDiskUsageWithDf(diskInfo.path);
        if (metrics) {
          assignDiskMetrics(metrics, { method: 'df' });
        }
      } catch (err) {
        warningCode = 'disk_command_error';
        error = err?.message || String(err);
      }
    }
    if (!metrics) {
      diskInfo.warningCode = warningCode || 'statfs_not_supported';
      diskInfo.error = error || 'Không thể xác định dung lượng ổ đĩa từ hệ thống.';
      if (diskInfo.warningCode === 'statfs_not_supported') {
        diskInfo.error = 'statfs_not_supported';
      }
    }
  }

  return { database: databaseInfo, disk: diskInfo };
}

function evaluateBackupHealth(summary) {
  const schedule = summary?.schedule || {};
  const issues = [];
  let severity = 'good';
  const now = Date.now();
  const lastSuccessTs = parseTimestamp(summary?.lastSuccess?.ts);
  const lastFailureTs = parseTimestamp(summary?.lastFailure?.ts);
  const minutesSinceSuccess = lastSuccessTs !== null ? Math.floor((now - lastSuccessTs) / 60000) : null;

  if (!lastSuccessTs) {
    severity = 'critical';
    issues.push({
      severity: 'critical',
      code: 'backup_missing',
      message: 'Chưa ghi nhận bản sao lưu thành công nào. Vui lòng kiểm tra tác vụ sao lưu.',
    });
  } else if (minutesSinceSuccess >= 72 * 60) {
    severity = 'critical';
    const hours = Math.floor(minutesSinceSuccess / 60);
    issues.push({
      severity: 'critical',
      code: 'backup_overdue',
      message: `Lần sao lưu gần nhất đã cách đây ${hours} giờ. Nên chạy lại sao lưu ngay lập tức.`,
    });
  } else if (minutesSinceSuccess >= 36 * 60) {
    severity = 'warning';
    const hours = Math.floor(minutesSinceSuccess / 60);
    issues.push({
      severity: 'warning',
      code: 'backup_stale',
      message: `Đã ${hours} giờ kể từ bản sao lưu gần nhất. Nên kiểm tra lịch sao lưu tự động.`,
    });
  }

  if (schedule.active === false) {
    severity = escalateSeverity(severity, 'warning');
    issues.push({
      severity: 'warning',
      code: 'schedule_inactive',
      message: 'Lịch sao lưu đang tắt, cần bật lại để đảm bảo an toàn dữ liệu.',
    });
  }

  if (Array.isArray(schedule.reasons)) {
    for (const reason of schedule.reasons) {
      const description = translateBackupReason(reason);
      if (!description) continue;
      const level = reason === 'schedule_error' ? 'critical' : 'warning';
      severity = escalateSeverity(severity, level);
      issues.push({ severity: level, code: `schedule_reason_${reason}`, message: description });
    }
  }

  if (lastFailureTs && (!lastSuccessTs || lastFailureTs > lastSuccessTs)) {
    const failureLabel = new Date(lastFailureTs).toLocaleString('vi-VN', { hour12: false });
    severity = escalateSeverity(severity, 'warning');
    issues.push({
      severity: 'warning',
      code: 'backup_failure_recent',
      message: `Có lỗi sao lưu gần nhất lúc ${failureLabel}.`,
    });
  }

  return {
    severity,
    issues,
    minutesSinceLastSuccess: minutesSinceSuccess,
    lastSuccessAt: lastSuccessTs ? new Date(lastSuccessTs).toISOString() : null,
    lastFailureAt: lastFailureTs ? new Date(lastFailureTs).toISOString() : null,
  };
}

function evaluateDiskHealth(storage) {
  const issues = [];
  let severity = 'good';
  const databaseInfo = storage?.database || {};
  const diskInfo = storage?.disk || {};

  if (databaseInfo.warningCode === 'memory_db') {
    severity = escalateSeverity(severity, 'warning');
    issues.push({
      severity: 'warning',
      code: 'database_memory_mode',
      message: 'CSDL đang chạy ở chế độ :memory:, hãy cấu hình file .sqlite để có thể sao lưu.',
    });
  } else if (databaseInfo.error) {
    severity = escalateSeverity(severity, 'warning');
    issues.push({
      severity: 'warning',
      code: 'database_stat_error',
      message: `Không thể đọc thông tin file CSDL: ${databaseInfo.error}`,
    });
  }

  if (diskInfo.error) {
    const level = diskInfo.warningCode === 'statfs_not_supported' ? 'info' : 'warning';
    severity = escalateSeverity(severity, level);
    const message =
      diskInfo.warningCode === 'statfs_not_supported'
        ? 'Không thể xác định dung lượng ổ đĩa trên hệ điều hành hiện tại.'
        : `Không thể lấy thông tin dung lượng ổ đĩa: ${diskInfo.error}`;
    issues.push({ severity: level, code: diskInfo.warningCode || 'disk_stat_error', message });
  }

  if (typeof diskInfo.usedPercent === 'number') {
    if (diskInfo.usedPercent >= 95) {
      severity = escalateSeverity(severity, 'critical');
      issues.push({
        severity: 'critical',
        code: 'disk_usage_critical',
        message: `Ổ đĩa chứa CSDL đã dùng ${diskInfo.usedPercent.toFixed(1)}% dung lượng.`,
      });
    } else if (diskInfo.usedPercent >= 85) {
      severity = escalateSeverity(severity, 'warning');
      issues.push({
        severity: 'warning',
        code: 'disk_usage_high',
        message: `Ổ đĩa chứa CSDL đã dùng ${diskInfo.usedPercent.toFixed(1)}% dung lượng.`,
      });
    }
  }

  if (typeof diskInfo.freeBytes === 'number' && diskInfo.freeBytes > 0) {
    if (diskInfo.freeBytes < 2 * 1024 * 1024 * 1024) {
      severity = escalateSeverity(severity, 'warning');
      issues.push({
        severity: 'warning',
        code: 'disk_free_low',
        message: `Dung lượng trống chỉ còn ${formatBytes(diskInfo.freeBytes)}.`,
      });
    }
  }

  return { severity, issues };
}

function buildBackupSummary({ limit = 10 } = {}) {
  const logs = getJSONValue('audit_logs_v1', []);
  const backupLogs = Array.isArray(logs)
    ? logs.filter((entry) => entry && entry.action === 'db.backup')
    : [];
  const clamp = Number.isFinite(limit) && limit > 0 ? Math.min(limit, backupLogs.length) : backupLogs.length;
  const recent = backupLogs.slice(0, clamp).map((entry) => normalizeBackupAuditEntry(entry)).filter(Boolean);
  const lastSuccess = normalizeBackupAuditEntry(
    backupLogs.find((entry) => entry?.meta?.status === 'success') || null
  );
  const lastFailure = normalizeBackupAuditEntry(
    backupLogs.find((entry) => entry?.meta?.status === 'failure') || null
  );
  const config = getBackupConfig();
  const cronExpr = normalizeCronExpression(config.cron);
  const retention =
    Number.isFinite(config.retentionCopies) && config.retentionCopies >= 0 ? config.retentionCopies : null;
  const nextRun = nextBackupRunISO();
  const nextRunHuman = formatNextRunHuman(nextRun);
  const description = backupScheduleMeta.description || describeCronExpression(cronExpr);

  return {
    schedule: {
      cron: cronExpr,
      cronDescription: description,
      retentionCopies: retention,
      directory: DB_BACKUP_DIR,
      active: backupScheduleMeta.active,
      reasons: [...backupScheduleMeta.reasons],
      lastError: backupScheduleMeta.lastError,
      refreshedAt: backupScheduleMeta.refreshedAt,
      nextRun,
      nextRunHuman,
    },
    lastSuccess,
    lastFailure,
    recent,
  };
}

function refreshDatabaseBackupSchedule() {
  if (dbBackupJob) {
    dbBackupJob.stop();
    dbBackupJob = null;
  }
  backupScheduleMeta.active = false;
  backupScheduleMeta.reasons = [];
  backupScheduleMeta.lastError = null;
  backupScheduleMeta.refreshedAt = new Date().toISOString();
  const config = getBackupConfig();
  const cronExpr = normalizeCronExpression(config.cron);
  backupScheduleMeta.cron = cronExpr;
  backupScheduleMeta.description = describeCronExpression(cronExpr);
  if (process.env.KPI_DISABLE_CRON === '1') {
    backupScheduleMeta.reasons.push('cron_disabled_env');
    return;
  }
  if (!cronExpr || cronExpr.toLowerCase() === 'never') {
    backupScheduleMeta.reasons.push('cron_disabled_config');
    return;
  }
  if (DB_FILE === ':memory:' || DB_BACKUP_DIR === ':memory:') {
    if (DB_FILE === ':memory:') {
      backupScheduleMeta.reasons.push('memory_db');
    }
    if (DB_BACKUP_DIR === ':memory:') {
      backupScheduleMeta.reasons.push('memory_backup_dir');
    }
    return;
  }
  if (typeof cron.validate === 'function' && !cron.validate(cronExpr)) {
    backupScheduleMeta.reasons.push('invalid_cron_expression');
    return;
  }
  try {
    dbBackupJob = cron.schedule(cronExpr, () => {
      performDatabaseBackup({ reason: 'scheduled' }).catch((err) => {
        console.error('Cron sao lưu CSDL thất bại:', err);
      });
    });
    backupScheduleMeta.active = true;
  } catch (err) {
    console.error('Không thể thiết lập lịch sao lưu CSDL:', err);
    backupScheduleMeta.lastError = err?.message || String(err);
    backupScheduleMeta.reasons.push('schedule_error');
  }
}

let db = await initializeDatabase();
refreshDatabaseBackupSchedule();
applyCoCodeConfig(getCoCodeConfig());
if (typeof refreshCoDiscrepancySchedule === 'function') {
  refreshCoDiscrepancySchedule();
}

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
  const role = normalizeRoleKey(account.role);
  if (!(isAdminRole(role) || role === MANAGER_ROLE)) {
    res.status(403).json({ ok: false, error: 'Chỉ tài khoản quản trị mới được phép thao tác đồng bộ ECUS.' });
    return { context, denied: true };
  }
  if (!account.permissions?.syncManage) {
    res.status(403).json({ ok: false, error: 'Tài khoản quản trị hiện chưa được cấp quyền quản lý đồng bộ ECUS.' });
    return { context, denied: true };
  }
  return { context, denied: false };
}

function requireDuplicatePolicyManage(req, res) {
  const context = getSessionContext(req);
  if (!context) {
    res.status(401).json({ ok: false, error: 'Bạn cần đăng nhập bằng tài khoản quản trị.' });
    return { context: null, denied: true };
  }
  const account = context.account || {};
  const role = normalizeRoleKey(account.role);
  if (!(isAdminRole(role) || role === MANAGER_ROLE)) {
    res.status(403).json({ ok: false, error: 'Chỉ quản trị viên hoặc quản lý mới được phép chỉnh sửa chính sách trùng 11 số.' });
    return { context, denied: true };
  }
  if (!account.permissions?.syncManage) {
    res.status(403).json({ ok: false, error: 'Tài khoản hiện chưa được cấp quyền quản lý dữ liệu nhập khẩu.' });
    return { context, denied: true };
  }
  return { context, denied: false };
}

function requireAdminBackupManage(req, res) {
  const context = getSessionContext(req);
  if (!context) {
    res.status(401).json({ ok: false, error: 'Bạn cần đăng nhập bằng tài khoản quản trị.' });
    return { context: null, denied: true };
  }
  const account = context.account || {};
  if (!isAdminRole(normalizeRoleKey(account.role))) {
    res.status(403).json({ ok: false, error: 'Chỉ tài khoản quản trị mới được phép chỉnh sửa lịch sao lưu.' });
    return { context, denied: true };
  }
  if (!account.permissions?.accountManage) {
    res.status(403).json({ ok: false, error: 'Tài khoản hiện chưa được cấp quyền quản trị hệ thống.' });
    return { context, denied: true };
  }
  return { context, denied: false };
}

function requireHqHistoryAccess(req, res) {
  const context = getSessionContext(req);
  if (!context) {
    res.status(401).json({ ok: false, error: 'Bạn cần đăng nhập để xem lịch sử Đại lý HQ.' });
    return { context: null, denied: true };
  }
  const account = context.account || {};
  if (!(account.permissions?.mstEdit || account.permissions?.auditView || account.permissions?.accountManage)) {
    res.status(403).json({ ok: false, error: 'Tài khoản hiện không có quyền xem lịch sử Đại lý HQ.' });
    return { context, denied: true };
  }
  return { context, denied: false };
}

function requireAuditView(req, res) {
  const context = getSessionContext(req);
  if (!context) {
    res.status(401).json({ ok: false, error: 'Bạn cần đăng nhập để xem nhật ký sao lưu.' });
    return { context: null, denied: true };
  }
  const account = context.account || {};
  if (!(account.permissions?.auditView || account.permissions?.accountManage)) {
    res.status(403).json({ ok: false, error: 'Tài khoản hiện không có quyền xem nhật ký hệ thống.' });
    return { context, denied: true };
  }
  return { context, denied: false };
}

function requireExportAuditView(req, res) {
  const context = getSessionContext(req);
  if (!context) {
    res.status(401).json({ ok: false, error: 'Bạn cần đăng nhập để xem lịch sử export.' });
    return { context: null, denied: true };
  }
  const account = context.account || {};
  if (!(account.permissions?.auditView || account.permissions?.accountManage)) {
    res.status(403).json({ ok: false, error: 'Tài khoản hiện không có quyền xem lịch sử export.' });
    return { context, denied: true };
  }
  return { context, denied: false };
}

function requireAiAssistUsage(req, res) {
  const context = getSessionContext(req);
  if (!context) {
    res.status(401).json({ ok: false, error: 'Vui lòng đăng nhập để sử dụng trợ lý AI.' });
    return { context: null, denied: true };
  }
  const account = context.account || {};
  if (account.permissions?.aiAssistUse !== true) {
    res.status(403).json({ ok: false, error: 'Bạn không có quyền sử dụng trợ lý AI.' });
    return { context, denied: true };
  }
  return { context, denied: false };
}

function requireAiAssistManage(req, res) {
  const context = getSessionContext(req);
  if (!context) {
    res.status(401).json({ ok: false, error: 'Vui lòng đăng nhập bằng tài khoản quản trị.' });
    return { context: null, denied: true };
  }
  const account = context.account || {};
  if (account.permissions?.aiAssistManage !== true) {
    res.status(403).json({ ok: false, error: 'Tài khoản hiện không có quyền cấu hình trợ lý AI.' });
    return { context, denied: true };
  }
  return { context, denied: false };
}

function requireRulesManage(req, res) {
  const context = getSessionContext(req);
  if (!context) {
    res.status(401).json({ ok: false, error: 'Vui lòng đăng nhập để quản lý quy tắc KPI.' });
    return { context: null, denied: true };
  }
  const account = context.account || {};
  if (account.permissions?.rulesEdit !== true && account.permissions?.accountManage !== true) {
    res.status(403).json({ ok: false, error: 'Tài khoản hiện không có quyền chỉnh sửa quy tắc KPI.' });
    return { context, denied: true };
  }
  return { context, denied: false };
}

function requireFeedbackReview(req, res) {
  const context = getSessionContext(req);
  if (!context) {
    res.status(401).json({ ok: false, error: 'Vui lòng đăng nhập để xem phản hồi người dùng.' });
    return { context: null, denied: true };
  }
  const account = context.account || {};
  const role = normalizeRoleKey(account.role);
  if (!(isAdminRole(role) || role === MANAGER_ROLE)) {
    res.status(403).json({ ok: false, error: 'Chỉ quản trị viên hoặc trưởng bộ phận mới xem được phản hồi người dùng.' });
    return { context, denied: true };
  }
  return { context, denied: false };
}

function requireNotificationAccess(req, res) {
  const context = getSessionContext(req);
  if (!context) {
    res.status(401).json({ ok: false, error: 'Vui lòng đăng nhập để xem thông báo hệ thống.' });
    return { context: null, denied: true };
  }
  const account = context.account || {};
  if (account.permissions && account.permissions.notificationView === false) {
    res.status(403).json({ ok: false, error: 'Tài khoản hiện không được phép xem thông báo hệ thống.' });
    return { context, denied: true };
  }
  return { context, denied: false };
}

function createAiHistoryId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildAiHistoryKey(username) {
  const normalized = (username ?? '').toString().trim();
  if (!normalized) {
    throw new Error('Thiếu thông tin tài khoản để lưu lịch sử AI.');
  }
  return `${AI_CHAT_HISTORY_PREFIX}${normalized}`;
}

function sanitizeAiHistoryUsage(usage) {
  if (!usage || typeof usage !== 'object') {
    return null;
  }
  const prompt = Number(usage.promptTokens ?? usage.prompt_tokens);
  const completion = Number(usage.completionTokens ?? usage.completion_tokens);
  const total = Number(usage.totalTokens ?? usage.total_tokens);
  const normalized = {};
  if (Number.isFinite(prompt) && prompt >= 0) {
    normalized.promptTokens = Math.trunc(prompt);
  }
  if (Number.isFinite(completion) && completion >= 0) {
    normalized.completionTokens = Math.trunc(completion);
  }
  if (Number.isFinite(total) && total >= 0) {
    normalized.totalTokens = Math.trunc(total);
  }
  return Object.keys(normalized).length ? normalized : null;
}

function sanitizeAiHistoryMessage(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const role = entry.role;
  if (role !== 'user' && role !== 'assistant' && role !== 'error') {
    return null;
  }
  const rawText = entry.text === undefined || entry.text === null ? '' : String(entry.text);
  const text = rawText.length > MAX_AI_MESSAGE_LENGTH ? rawText.slice(0, MAX_AI_MESSAGE_LENGTH) : rawText;
  const scope = typeof entry.scope === 'string'
    ? entry.scope.trim().slice(0, MAX_AI_SCOPE_LENGTH)
    : '';
  const providerId = typeof entry.providerId === 'string'
    ? entry.providerId.trim().slice(0, MAX_AI_PROVIDER_LENGTH)
    : '';
  const createdAtSource = entry.createdAt ? new Date(entry.createdAt) : new Date();
  const createdAt = Number.isNaN(createdAtSource.getTime())
    ? new Date().toISOString()
    : createdAtSource.toISOString();
  return {
    id:
      typeof entry.id === 'string' && entry.id.trim()
        ? entry.id.trim()
        : createAiHistoryId(),
    role,
    text,
    scope,
    providerId: providerId || null,
    cached: entry.cached === true,
    usage: sanitizeAiHistoryUsage(entry.usage),
    createdAt,
  };
}

function clampAiHistoryMessages(messages) {
  const list = Array.isArray(messages) ? messages.filter(Boolean) : [];
  if (list.length <= MAX_AI_HISTORY_MESSAGES) {
    return list;
  }
  return list.slice(list.length - MAX_AI_HISTORY_MESSAGES);
}

function loadAiChatHistory(username) {
  const key = buildAiHistoryKey(username);
  const raw = getValue(key);
  if (!raw) {
    return { messages: [], updatedAt: null };
  }
  const parsed = safeParse(raw, null);
  if (Array.isArray(parsed)) {
    const sanitized = clampAiHistoryMessages(parsed.map((item) => sanitizeAiHistoryMessage(item)).filter(Boolean));
    return { messages: sanitized, updatedAt: null };
  }
  if (parsed && typeof parsed === 'object') {
    const baseMessages = Array.isArray(parsed.messages) ? parsed.messages : [];
    const sanitized = clampAiHistoryMessages(baseMessages.map((item) => sanitizeAiHistoryMessage(item)).filter(Boolean));
    const updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null;
    return { messages: sanitized, updatedAt };
  }
  return { messages: [], updatedAt: null };
}

function saveAiChatHistory(username, messages, { actor = 'system' } = {}) {
  const key = buildAiHistoryKey(username);
  const sanitized = clampAiHistoryMessages(
    (Array.isArray(messages) ? messages : []).map((item) => sanitizeAiHistoryMessage(item)).filter(Boolean)
  );
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    messages: sanitized,
  };
  upsertValue(key, JSON.stringify(payload), { actor, source: 'ai-history' });
  return payload;
}

function deleteAiChatHistory(username, { actor = 'system' } = {}) {
  const key = buildAiHistoryKey(username);
  deleteValue(key, { actor, source: 'ai-history-delete' });
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

function upsertValue(key, value, options = {}) {
  const { skipMstHistorySync = false, actor = 'system', source = 'storage' } = options || {};
  const normalized = normalizeValue(value);
  if (normalized === null) {
    deleteValue(key, { actor, source: source || 'storage-delete', skipMstHistorySync });
    return;
  }
  db.prepare(
    'INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, normalized);
  if (key === 'mst_history_v1' && !skipMstHistorySync) {
    scheduleMstHistorySqlSyncFromJson(normalized);
  }
  if (key === 'kpi_rules_v2') {
    persistRulesSnapshot(normalized, { actor, source });
  }
}

function deleteValue(key, options = {}) {
  const { actor = 'system', source = 'storage-delete', skipMstHistorySync = false } = options || {};
  db.prepare('DELETE FROM kv_store WHERE key = ?').run(key);
  if (key === 'mst_history_v1' && !skipMstHistorySync) {
    scheduleMstHistorySqlSyncFromJson('[]');
  }
  if (key === 'kpi_rules_v2') {
    persistRulesSnapshot(JSON.stringify(getRulesSeed(SHARED_DEFAULT_RULES)), {
      actor,
      source,
    });
  }
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

function setJSONValue(key, value, options = {}) {
  upsertValue(key, value === undefined ? null : JSON.stringify(value), options);
}

function cloneJson(value) {
  if (value === null || value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

function sanitizePresetTimestamp(value, fallbackIso) {
  const fallback = fallbackIso || new Date().toISOString();
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) {
      const date = new Date(trimmed);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
  }
  return fallback;
}

function sanitizePresetName(name) {
  const fallback = 'Bộ lọc đã lưu';
  if (typeof name !== 'string') {
    return fallback;
  }
  const normalized = name.trim().replace(/\s+/gu, ' ');
  if (!normalized) {
    return fallback;
  }
  return normalized.slice(0, 80);
}

function sanitizeFilterPresetScope(scope) {
  if (typeof scope !== 'string') {
    return FILTER_PRESET_SCOPE_DEFAULT;
  }
  const normalized = scope.trim().toLowerCase();
  if (!normalized) {
    return FILTER_PRESET_SCOPE_DEFAULT;
  }
  if (KNOWN_FILTER_PRESET_SCOPES.has(normalized)) {
    return normalized;
  }
  if (/^[a-z0-9._-]{1,40}$/iu.test(normalized)) {
    return normalized;
  }
  return FILTER_PRESET_SCOPE_DEFAULT;
}

function sanitizePresetDateValue(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    if (/^\d{4}-\d{2}-\d{2}$/u.test(trimmed)) {
      return trimmed;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/u.test(trimmed)) {
      return trimmed;
    }
    return trimmed.slice(0, 32);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      const iso = date.toISOString().slice(0, 10);
      return iso;
    }
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return '';
}

function sanitizePresetFilters(input) {
  if (!input || typeof input !== 'object') {
    return {};
  }
  const result = {};
  if (typeof input.query === 'string' && input.query.trim()) {
    result.query = input.query.trim().slice(0, 160);
  }
  if (input.range && typeof input.range === 'object') {
    const from = sanitizePresetDateValue(input.range.from);
    const to = sanitizePresetDateValue(input.range.to);
    if (from || to) {
      result.range = { from, to };
    }
  }
  if (typeof input.datePreset === 'string' && input.datePreset.trim()) {
    result.datePreset = input.datePreset.trim().slice(0, 40);
  }
  if (typeof input.coFilterMode === 'string' && input.coFilterMode.trim()) {
    result.coFilterMode = input.coFilterMode.trim().slice(0, 40);
  }
  const coFilterMinRaw = input.coFilterMin;
  if (coFilterMinRaw !== undefined && coFilterMinRaw !== null) {
    const parsed = Number(coFilterMinRaw);
    if (Number.isFinite(parsed)) {
      result.coFilterMin = Math.max(0, Math.round(parsed));
    }
  }
  if (typeof input.filterNoStaff === 'boolean') {
    result.filterNoStaff = input.filterNoStaff;
  }
  if (typeof input.filterNoTeam === 'boolean') {
    result.filterNoTeam = input.filterNoTeam;
  }
  if (typeof input.filterDuplicate11 === 'boolean') {
    result.filterDuplicate11 = input.filterDuplicate11;
  }
  if (typeof input.team === 'string' && input.team.trim()) {
    result.team = input.team.trim().slice(0, 80);
  }
  if (Array.isArray(input.teams)) {
    const teams = Array.from(
      new Set(
        input.teams
          .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
          .filter((entry) => entry)
      )
    ).slice(0, 10);
    if (teams.length > 0) {
      result.teams = teams;
    }
  }
  return result;
}

function sanitizeFilterPresetRecord(entry, { now } = {}) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const current = now || new Date().toISOString();
  const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : crypto.randomUUID();
  const scope = sanitizeFilterPresetScope(entry.scope);
  const filters = sanitizePresetFilters(entry.filters);
  if (Object.keys(filters).length === 0) {
    return null;
  }
  const name = sanitizePresetName(entry.name);
  const createdAt = sanitizePresetTimestamp(entry.createdAt, current);
  const updatedAtBase = sanitizePresetTimestamp(entry.updatedAt, createdAt);
  const updatedAt = updatedAtBase < createdAt ? createdAt : updatedAtBase;
  return { id, scope, name, filters, createdAt, updatedAt };
}

function getPresetTime(value) {
  if (!value) {
    return 0;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 0;
  }
  return date.getTime();
}

function sortPresetsByUpdatedAt(list = []) {
  return [...list].sort((a = {}, b = {}) => getPresetTime(b.updatedAt || b.createdAt) - getPresetTime(a.updatedAt || a.createdAt));
}

function rebuildPresetCollection(existing = [], options = {}) {
  const { upsert = null, removeId = null } = options || {};
  const groups = new Map();
  for (const item of existing) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    if (removeId && item.id === removeId) {
      continue;
    }
    const scopeKey = item.scope || FILTER_PRESET_SCOPE_DEFAULT;
    if (upsert && upsert.id === item.id) {
      continue;
    }
    const list = groups.get(scopeKey) || [];
    list.push(item);
    groups.set(scopeKey, list);
  }
  if (upsert) {
    const scopeKey = upsert.scope || FILTER_PRESET_SCOPE_DEFAULT;
    const list = groups.get(scopeKey) || [];
    list.unshift(upsert);
    groups.set(scopeKey, list);
  }
  const combined = [];
  for (const list of groups.values()) {
    const sorted = sortPresetsByUpdatedAt(list);
    combined.push(...sorted.slice(0, FILTER_PRESET_MAX_PER_SCOPE));
  }
  return sortPresetsByUpdatedAt(combined);
}

function normalizeFilterPresetList(list = []) {
  if (!Array.isArray(list)) {
    return [];
  }
  const normalized = [];
  const seen = new Set();
  const now = new Date().toISOString();
  for (const entry of list) {
    const preset = sanitizeFilterPresetRecord(entry, { now });
    if (!preset) {
      continue;
    }
    const key = `${preset.scope}:${preset.id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(preset);
  }
  return rebuildPresetCollection(normalized);
}

function loadFilterPresetState(username) {
  const storeRaw =
    getJSONValue(FILTER_PRESETS_KEY, { version: FILTER_PRESET_VERSION, users: {} }) || {};
  const store = {
    version: FILTER_PRESET_VERSION,
    users: {},
  };
  if (storeRaw && typeof storeRaw === 'object') {
    const users = storeRaw.users && typeof storeRaw.users === 'object' ? storeRaw.users : {};
    store.users = { ...users };
  }
  const userKey = `${username || ''}`.trim().toLowerCase();
  if (!userKey) {
    return { store, userKey: '', entry: { presets: [], updatedAt: null } };
  }
  const entry = store.users[userKey];
  const presets = normalizeFilterPresetList(entry?.presets || []);
  const updatedAt = presets[0]?.updatedAt
    || (entry?.updatedAt ? sanitizePresetTimestamp(entry.updatedAt) : null);
  return { store, userKey, entry: { presets, updatedAt } };
}

function listFilterPresetsForUser(username, { scope } = {}) {
  const normalizedScope = scope ? sanitizeFilterPresetScope(scope) : null;
  const { entry } = loadFilterPresetState(username);
  const list = normalizedScope
    ? entry.presets.filter((item) => item.scope === normalizedScope)
    : entry.presets;
  return {
    presets: sortPresetsByUpdatedAt(list),
    updatedAt: entry.updatedAt || null,
  };
}

function createFilterPresetForUser(username, payload = {}, { actor = 'system' } = {}) {
  const { store, userKey, entry } = loadFilterPresetState(username);
  if (!userKey) {
    const error = new Error('Thiếu thông tin tài khoản để lưu bộ lọc.');
    error.code = 'INVALID_USER';
    throw error;
  }
  const filters = sanitizePresetFilters(payload.filters);
  if (Object.keys(filters).length === 0) {
    const error = new Error('Không có điều kiện lọc hợp lệ để lưu.');
    error.code = 'INVALID_FILTERS';
    throw error;
  }
  const scope = sanitizeFilterPresetScope(payload.scope);
  const name = sanitizePresetName(payload.name);
  const now = new Date().toISOString();
  const preset = {
    id: crypto.randomUUID(),
    scope,
    name,
    filters,
    createdAt: now,
    updatedAt: now,
  };
  const nextPresets = rebuildPresetCollection(entry.presets, { upsert: preset });
  const updatedAt = nextPresets[0]?.updatedAt || now;
  store.users[userKey] = { presets: nextPresets, updatedAt };
  setJSONValue(FILTER_PRESETS_KEY, store, { actor, source: 'filter-presets-upsert' });
  return { preset, presets: nextPresets, updatedAt };
}

function updateFilterPresetForUser(username, presetId, payload = {}, { actor = 'system' } = {}) {
  const id = `${presetId || ''}`.trim();
  if (!id) {
    const error = new Error('Thiếu mã bộ lọc cần cập nhật.');
    error.code = 'INVALID_ID';
    throw error;
  }
  const { store, userKey, entry } = loadFilterPresetState(username);
  if (!userKey) {
    const error = new Error('Thiếu thông tin tài khoản để cập nhật bộ lọc.');
    error.code = 'INVALID_USER';
    throw error;
  }
  const existing = entry.presets.find((item) => item.id === id);
  if (!existing) {
    const error = new Error('Không tìm thấy bộ lọc đã lưu tương ứng.');
    error.code = 'NOT_FOUND';
    throw error;
  }
  const filters =
    Object.prototype.hasOwnProperty.call(payload, 'filters')
      ? sanitizePresetFilters(payload.filters)
      : existing.filters;
  if (Object.keys(filters).length === 0) {
    const error = new Error('Không có điều kiện lọc hợp lệ để lưu.');
    error.code = 'INVALID_FILTERS';
    throw error;
  }
  const name =
    Object.prototype.hasOwnProperty.call(payload, 'name')
      ? sanitizePresetName(payload.name)
      : existing.name;
  const now = new Date().toISOString();
  const preset = {
    ...existing,
    name,
    filters,
    updatedAt: now,
  };
  const nextPresets = rebuildPresetCollection(entry.presets, { upsert: preset });
  const updatedAt = nextPresets[0]?.updatedAt || now;
  store.users[userKey] = { presets: nextPresets, updatedAt };
  setJSONValue(FILTER_PRESETS_KEY, store, { actor, source: 'filter-presets-upsert' });
  return { preset, presets: nextPresets, updatedAt };
}

function deleteFilterPresetForUser(username, presetId, { actor = 'system' } = {}) {
  const id = `${presetId || ''}`.trim();
  if (!id) {
    const error = new Error('Thiếu mã bộ lọc cần xoá.');
    error.code = 'INVALID_ID';
    throw error;
  }
  const { store, userKey, entry } = loadFilterPresetState(username);
  if (!userKey) {
    const error = new Error('Thiếu thông tin tài khoản để xoá bộ lọc.');
    error.code = 'INVALID_USER';
    throw error;
  }
  const existing = entry.presets.find((item) => item.id === id);
  if (!existing) {
    const error = new Error('Không tìm thấy bộ lọc đã lưu tương ứng.');
    error.code = 'NOT_FOUND';
    throw error;
  }
  const nextPresets = rebuildPresetCollection(entry.presets, { removeId: id });
  if (nextPresets.length === 0) {
    const nextStore = { ...store.users };
    delete nextStore[userKey];
    store.users = nextStore;
    setJSONValue(FILTER_PRESETS_KEY, store, { actor, source: 'filter-presets-delete' });
    return { deleted: id, presets: [], updatedAt: null, removed: existing };
  }
  const updatedAt = nextPresets[0]?.updatedAt || new Date().toISOString();
  store.users[userKey] = { presets: nextPresets, updatedAt };
  setJSONValue(FILTER_PRESETS_KEY, store, { actor, source: 'filter-presets-delete' });
  return { deleted: id, presets: nextPresets, updatedAt, removed: existing };
}

function toFiniteNumber(value, fallback) {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  const text = `${value}`.trim();
  if (!text) {
    return fallback;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toPositiveInt(value, fallback) {
  const parsed = toFiniteNumber(value, fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function toNonNegativeInt(value, fallback) {
  const parsed = toFiniteNumber(value, fallback);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function mergeAiCaching(baseCaching = {}, overrideCaching = {}) {
  const enabled = overrideCaching.enabled !== undefined ? !!overrideCaching.enabled : baseCaching.enabled !== undefined
    ? !!baseCaching.enabled
    : true;
  const ttlMinutes = toPositiveInt(
    overrideCaching.ttlMinutes !== undefined ? overrideCaching.ttlMinutes : baseCaching.ttlMinutes,
    DEFAULT_AI_CONFIG.caching.ttlMinutes
  );
  const maxEntries = toPositiveInt(
    overrideCaching.maxEntries !== undefined ? overrideCaching.maxEntries : baseCaching.maxEntries,
    DEFAULT_AI_CONFIG.caching.maxEntries || AI_CACHE_LIMIT
  );
  return {
    enabled,
    ttlMinutes,
    maxEntries,
  };
}

function normalizeAiProviderEntry(sourceProvider, baseProvider = {}) {
  const source = sourceProvider && typeof sourceProvider === 'object' ? sourceProvider : {};
  const base = baseProvider && typeof baseProvider === 'object' ? baseProvider : {};
  const id = `${source.id || source.providerId || base.id || ''}`.trim();
  if (!id) {
    return null;
  }
  const result = cloneJson(base) || {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  result.id = id;
  result.label = `${result.label || id}`.trim();
  result.type = `${result.type || base.type || 'custom'}`.trim();
  if (result.endpoint !== undefined && result.endpoint !== null) {
    result.endpoint = `${result.endpoint}`.trim();
  } else if (base.endpoint) {
    result.endpoint = `${base.endpoint}`.trim();
  } else {
    result.endpoint = '';
  }
  if (result.deployment !== undefined && result.deployment !== null) {
    result.deployment = `${result.deployment}`.trim();
  } else if (base.deployment) {
    result.deployment = `${base.deployment}`.trim();
  }
  if (result.apiVersion !== undefined && result.apiVersion !== null) {
    result.apiVersion = `${result.apiVersion}`.trim();
  } else if (base.apiVersion) {
    result.apiVersion = `${base.apiVersion}`.trim();
  }
  if (result.apiKeyEnv !== undefined && result.apiKeyEnv !== null) {
    result.apiKeyEnv = `${result.apiKeyEnv}`.trim();
  } else if (base.apiKeyEnv) {
    result.apiKeyEnv = `${base.apiKeyEnv}`.trim();
  }
  if (result.model !== undefined && result.model !== null) {
    result.model = `${result.model}`.trim();
  } else if (base.model) {
    result.model = `${base.model}`.trim();
  }
  result.enabled = result.enabled !== undefined ? !!result.enabled : base.enabled !== undefined ? !!base.enabled : true;
  if (result.temperature !== undefined) {
    const parsedTemp = toFiniteNumber(result.temperature, base.temperature ?? DEFAULT_AI_CONFIG.temperature);
    result.temperature = Number.isFinite(parsedTemp) ? parsedTemp : DEFAULT_AI_CONFIG.temperature;
  } else if (base.temperature !== undefined) {
    const parsedTemp = toFiniteNumber(base.temperature, DEFAULT_AI_CONFIG.temperature);
    result.temperature = Number.isFinite(parsedTemp) ? parsedTemp : DEFAULT_AI_CONFIG.temperature;
  } else {
    result.temperature = DEFAULT_AI_CONFIG.temperature;
  }
  if (result.maxTokens !== undefined) {
    result.maxTokens = toPositiveInt(result.maxTokens, base.maxTokens ?? DEFAULT_AI_CONFIG.maxTokens);
  } else if (base.maxTokens !== undefined) {
    result.maxTokens = toPositiveInt(base.maxTokens, DEFAULT_AI_CONFIG.maxTokens);
  }
  const hasApiKeyProp = Object.prototype.hasOwnProperty.call(source, 'apiKey');
  if (hasApiKeyProp) {
    const trimmedKey = `${source.apiKey ?? ''}`.trim();
    if (trimmedKey) {
      result.apiKey = trimmedKey;
    } else {
      delete result.apiKey;
    }
  } else if (base.apiKey) {
    result.apiKey = base.apiKey;
  }
  if (source?.clearStoredKey === true) {
    delete result.apiKey;
  }
  delete result.clearStoredKey;
  return result;
}

function mergeAiProviders(currentProviders = [], overrideProviders = []) {
  const map = new Map();
  for (const provider of currentProviders) {
    if (!provider || typeof provider !== 'object') continue;
    const normalized = normalizeAiProviderEntry(provider, provider);
    if (normalized) {
      map.set(normalized.id, normalized);
    }
  }
  if (Array.isArray(overrideProviders)) {
    for (const provider of overrideProviders) {
      if (!provider || typeof provider !== 'object') continue;
      const id = `${provider.id || provider.providerId || ''}`.trim();
      if (!id) continue;
      const base = map.get(id) || {};
      const normalized = normalizeAiProviderEntry({ ...provider, id }, base);
      if (normalized) {
        map.set(id, normalized);
      }
    }
  }
  return Array.from(map.values());
}

function mergeAiConfig(baseConfig, overrideConfig) {
  const merged = cloneJson(DEFAULT_AI_CONFIG) || {};
  const sources = [baseConfig, overrideConfig];
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    if (source.version) {
      merged.version = source.version;
    }
    if (source.enabled !== undefined) {
      merged.enabled = !!source.enabled;
    }
    if (source.defaultProvider !== undefined) {
      const provider = `${source.defaultProvider}`.trim();
      if (provider) {
        merged.defaultProvider = provider;
      }
    }
    if (source.fallbackProvider !== undefined) {
      const fallback = `${source.fallbackProvider}`.trim();
      merged.fallbackProvider = fallback || null;
    }
    if (source.temperature !== undefined) {
      const temp = toFiniteNumber(source.temperature, merged.temperature);
      if (Number.isFinite(temp)) {
        merged.temperature = temp;
      }
    }
    if (source.maxTokens !== undefined) {
      merged.maxTokens = toPositiveInt(source.maxTokens, merged.maxTokens);
    }
    if (source.maxInputLength !== undefined) {
      merged.maxInputLength = toPositiveInt(source.maxInputLength, merged.maxInputLength);
    }
    if (source.timeoutMs !== undefined) {
      merged.timeoutMs = toPositiveInt(source.timeoutMs, merged.timeoutMs);
    }
    if (source.systemPrompt !== undefined && source.systemPrompt !== null) {
      const prompt = `${source.systemPrompt}`.trim();
      if (prompt) {
        merged.systemPrompt = prompt;
      }
    }
    if (source.caching) {
      merged.caching = mergeAiCaching(merged.caching, source.caching);
    }
    if (Array.isArray(source.providers)) {
      merged.providers = mergeAiProviders(merged.providers, source.providers);
    }
    if (source.updatedAt) {
      merged.updatedAt = new Date(source.updatedAt).toISOString();
    }
    if (source.updatedBy) {
      merged.updatedBy = `${source.updatedBy}`.trim() || merged.updatedBy;
    }
  }
  return merged;
}

function getAiConfig() {
  const stored = getJSONValue(AI_CONFIG_KEY, null);
  if (!stored || typeof stored !== 'object') {
    return cloneJson(DEFAULT_AI_CONFIG);
  }
  return mergeAiConfig(DEFAULT_AI_CONFIG, stored);
}

function buildAiProviderSummary(provider, { defaultProviderId, fallbackProviderId } = {}) {
  if (!provider || typeof provider !== 'object') {
    return null;
  }
  const id = `${provider.id || ''}`.trim();
  if (!id) {
    return null;
  }
  return {
    id,
    label: `${provider.label || id}`.trim() || id,
    type: `${provider.type || 'custom'}`.trim() || 'custom',
    enabled: provider.enabled !== false,
    isDefault: id === defaultProviderId,
    isFallback: fallbackProviderId ? id === fallbackProviderId : false,
  };
}

function buildAiProfile(config) {
  const normalized = config && typeof config === 'object' ? config : DEFAULT_AI_CONFIG;
  const cachingEnabled = normalized?.caching?.enabled !== false;
  const ttlMinutes = cachingEnabled
    ? toPositiveInt(normalized?.caching?.ttlMinutes, DEFAULT_AI_CONFIG.caching.ttlMinutes)
    : 0;
  const maxEntries = toPositiveInt(normalized?.caching?.maxEntries, AI_CACHE_LIMIT);
  const providersRaw = Array.isArray(normalized?.providers) ? normalized.providers : [];
  const providers = providersRaw
    .map((provider) => buildAiProviderSummary(provider, {
      defaultProviderId: normalized?.defaultProvider,
      fallbackProviderId: normalized?.fallbackProvider,
    }))
    .filter(Boolean);
  return {
    enabled: normalized?.enabled !== false,
    defaultProvider: `${normalized?.defaultProvider || ''}`.trim() || null,
    fallbackProvider: `${normalized?.fallbackProvider || ''}`.trim() || null,
    providers,
    caching: {
      enabled: cachingEnabled,
      ttlMinutes,
      maxEntries,
    },
    updatedAt: normalized?.updatedAt || null,
    updatedBy: normalized?.updatedBy || null,
  };
}

function maskProviderSecrets(provider) {
  if (!provider || typeof provider !== 'object') {
    return null;
  }
  const cloned = { ...provider };
  if (cloned.apiKey) {
    const preview = cloned.apiKey.length > 4 ? cloned.apiKey.slice(-4) : cloned.apiKey;
    cloned.hasApiKey = true;
    cloned.apiKeyPreview = preview;
  } else {
    cloned.hasApiKey = false;
    cloned.apiKeyPreview = '';
  }
  delete cloned.apiKey;
  delete cloned.clearStoredKey;
  return cloned;
}

function buildAiConfigForClient(config) {
  const normalized = config && typeof config === 'object' ? config : DEFAULT_AI_CONFIG;
  const cloned = cloneJson(normalized) || {};
  if (Array.isArray(cloned.providers)) {
    cloned.providers = cloned.providers.map((provider) => maskProviderSecrets(provider)).filter(Boolean);
  }
  return cloned;
}

function setAiConfig(configUpdate, { actor = 'system' } = {}) {
  const existing = getAiConfig();
  const merged = mergeAiConfig(existing, configUpdate || {});
  merged.updatedAt = new Date().toISOString();
  merged.updatedBy = actor;
  setJSONValue(AI_CONFIG_KEY, merged, { actor, source: 'ai-config' });
  pushAuditLog({ actor, action: 'ai.config.update', detail: 'Cập nhật cấu hình trợ lý AI' });
  return merged;
}

function getAiCacheSnapshotRaw() {
  const raw = getJSONValue(AI_CACHE_KEY, DEFAULT_AI_USAGE_CACHE);
  if (!raw || typeof raw !== 'object') {
    return cloneJson(DEFAULT_AI_USAGE_CACHE);
  }
  const entries = Array.isArray(raw.entries) ? raw.entries : [];
  return { version: 1, entries: entries.map((entry) => ({ ...entry })) };
}

function pruneAiCache(ttlMs, maxEntries = AI_CACHE_LIMIT) {
  const snapshot = getAiCacheSnapshotRaw();
  const now = Date.now();
  let mutated = false;
  const filtered = [];
  for (const entry of snapshot.entries) {
    if (!entry || typeof entry !== 'object') {
      mutated = true;
      continue;
    }
    const createdTime = Date.parse(entry.createdAt || entry.created_at || 0);
    if (ttlMs && Number.isFinite(ttlMs) && ttlMs > 0 && Number.isFinite(createdTime)) {
      if (now - createdTime > ttlMs) {
        mutated = true;
        continue;
      }
    }
    filtered.push({ ...entry, createdAt: Number.isFinite(createdTime) ? new Date(createdTime).toISOString() : new Date().toISOString() });
  }
  filtered.sort((a, b) => {
    const aTime = Date.parse(a.createdAt || 0) || 0;
    const bTime = Date.parse(b.createdAt || 0) || 0;
    return bTime - aTime;
  });
  const normalizedLimit = Number.isFinite(maxEntries) && maxEntries > 0 ? Math.floor(maxEntries) : AI_CACHE_LIMIT;
  if (filtered.length > normalizedLimit) {
    filtered.length = normalizedLimit;
    mutated = true;
  }
  const result = { version: 1, entries: filtered };
  if (mutated) {
    setJSONValue(AI_CACHE_KEY, result, { actor: 'system', source: 'ai-cache-prune' });
  }
  return { cache: result, mutated };
}

function normalizeAiCacheEntry(entry) {
  const key = `${entry?.key || ''}`.trim();
  if (!key) {
    throw new Error('Thiếu khoá cache AI.');
  }
  const providerId = `${entry?.providerId || ''}`.trim();
  if (!providerId) {
    throw new Error('Thiếu mã nhà cung cấp AI.');
  }
  const scope = `${entry?.scope || 'general'}`.trim() || 'general';
  const prompt = entry?.prompt !== undefined && entry?.prompt !== null ? `${entry.prompt}` : '';
  const response = entry?.response !== undefined && entry?.response !== null ? `${entry.response}` : '';
  const actor = `${entry?.actor || 'system'}`.trim() || 'system';
  const context = entry?.context !== undefined && entry?.context !== null ? `${entry.context}` : null;
  const usage = entry?.usage && typeof entry.usage === 'object' ? { ...entry.usage } : null;
  const createdAt = entry?.createdAt && !Number.isNaN(Date.parse(entry.createdAt))
    ? new Date(entry.createdAt).toISOString()
    : new Date().toISOString();
  const tokensEstimated = entry?.tokensEstimated !== undefined ? toNonNegativeInt(entry.tokensEstimated, null) : null;
  return {
    key,
    providerId,
    scope,
    prompt,
    response,
    actor,
    createdAt,
    context,
    usage,
    tokensEstimated,
  };
}

function storeAiCacheEntry(entry, { actor = 'system', ttlMs, maxEntries = AI_CACHE_LIMIT } = {}) {
  const normalized = normalizeAiCacheEntry(entry);
  const { cache } = pruneAiCache(ttlMs, maxEntries);
  const nextEntries = cache.entries.filter((item) => item?.key !== normalized.key);
  nextEntries.unshift(normalized);
  while (nextEntries.length > maxEntries) {
    nextEntries.pop();
  }
  const result = { version: 1, entries: nextEntries };
  setJSONValue(AI_CACHE_KEY, result, { actor, source: 'ai-cache-store' });
  return normalized;
}

function normalizeSnapshotRange(range = {}) {
  const from = `${range?.from || ''}`.trim();
  const to = `${range?.to || ''}`.trim();
  return { from, to };
}

function normalizeSnapshotFilters(filters = {}) {
  return {
    includeTaxCodes: normalizeEcusTaxCodeList(filters?.includeTaxCodes ?? filters?.include ?? []),
    excludeTaxCodes: normalizeEcusTaxCodeList(filters?.excludeTaxCodes ?? filters?.exclude ?? []),
  };
}

function pruneAiSnapshotCache({
  ttlMs = AI_SNAPSHOT_CACHE_TTL_MS,
  maxEntries = AI_SNAPSHOT_CACHE_LIMIT,
  actor = 'system',
} = {}) {
  const raw = getJSONValue(AI_SNAPSHOT_CACHE_KEY, DEFAULT_AI_SNAPSHOT_CACHE) || {};
  const entries = Array.isArray(raw?.entries) ? raw.entries : [];
  const now = Date.now();
  const normalizedTtl = Number.isFinite(ttlMs) && ttlMs > 0 ? Math.floor(ttlMs) : 0;
  const normalizedLimit = Number.isFinite(maxEntries) && maxEntries > 0 ? Math.floor(maxEntries) : AI_SNAPSHOT_CACHE_LIMIT;
  const cleaned = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const key = `${entry.key || ''}`.trim();
    if (!key) {
      continue;
    }
    const cachedAtIso = entry.cachedAt && !Number.isNaN(Date.parse(entry.cachedAt))
      ? new Date(entry.cachedAt).toISOString()
      : new Date().toISOString();
    const cachedTs = Date.parse(cachedAtIso);
    if (normalizedTtl > 0 && (!Number.isFinite(cachedTs) || cachedTs + normalizedTtl < now)) {
      continue;
    }
    const range = normalizeSnapshotRange(entry.range || {});
    const filters = normalizeSnapshotFilters(entry.filters || {});
    cleaned.push({
      key,
      cachedAt: cachedAtIso,
      range,
      filters,
      snapshot: entry.snapshot && typeof entry.snapshot === 'object' ? entry.snapshot : null,
    });
  }
  cleaned.sort((a, b) => new Date(b.cachedAt).getTime() - new Date(a.cachedAt).getTime());
  const limited = normalizedLimit > 0 ? cleaned.slice(0, normalizedLimit) : cleaned;
  const result = { version: 1, entries: limited };
  const previous = JSON.stringify(entries);
  const nextSerialized = JSON.stringify(limited);
  if (previous !== nextSerialized) {
    setJSONValue(AI_SNAPSHOT_CACHE_KEY, result, { actor, source: 'ai-snapshot-prune' });
  }
  return { cache: result, mutated: previous !== nextSerialized };
}

function storeAiSnapshotCacheEntry(entry, {
  actor = 'system',
  ttlMs = AI_SNAPSHOT_CACHE_TTL_MS,
  maxEntries = AI_SNAPSHOT_CACHE_LIMIT,
} = {}) {
  const key = `${entry?.key || ''}`.trim();
  if (!key) {
    throw new Error('Thiếu khoá cache snapshot AI.');
  }
  const cachedAtIso = entry?.cachedAt && !Number.isNaN(Date.parse(entry.cachedAt))
    ? new Date(entry.cachedAt).toISOString()
    : new Date().toISOString();
  const range = normalizeSnapshotRange(entry?.range || {});
  const filters = normalizeSnapshotFilters(entry?.filters || {});
  const snapshot = entry?.snapshot && typeof entry.snapshot === 'object' ? cloneJson(entry.snapshot) : null;
  const { cache } = pruneAiSnapshotCache({ ttlMs, maxEntries, actor });
  const entries = cache.entries.filter((item) => item?.key !== key);
  entries.unshift({ key, cachedAt: cachedAtIso, range, filters, snapshot });
  const normalizedLimit = Number.isFinite(maxEntries) && maxEntries > 0 ? Math.floor(maxEntries) : AI_SNAPSHOT_CACHE_LIMIT;
  const limited = normalizedLimit > 0 ? entries.slice(0, normalizedLimit) : entries;
  const result = { version: 1, entries: limited };
  setJSONValue(AI_SNAPSHOT_CACHE_KEY, result, { actor, source: 'ai-snapshot-store' });
  return { key, cachedAt: cachedAtIso, range, filters, snapshot };
}

function getAiSnapshotCacheEntry(key, {
  ttlMs = AI_SNAPSHOT_CACHE_TTL_MS,
  maxEntries = AI_SNAPSHOT_CACHE_LIMIT,
} = {}) {
  if (!key) {
    return null;
  }
  const { cache } = pruneAiSnapshotCache({ ttlMs, maxEntries });
  const entry = cache.entries.find((item) => item?.key === key);
  if (!entry) {
    return null;
  }
  return {
    key: entry.key,
    cachedAt: entry.cachedAt,
    range: { ...entry.range },
    filters: {
      includeTaxCodes: Array.from(entry.filters?.includeTaxCodes || []),
      excludeTaxCodes: Array.from(entry.filters?.excludeTaxCodes || []),
    },
    snapshot: entry.snapshot && typeof entry.snapshot === 'object' ? cloneJson(entry.snapshot) : null,
  };
}

function createAiInsightId() {
  return `ins-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDateOnly(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatRangeLabel(range = {}) {
  const fromDate = normalizeRangeDate(range?.from);
  const toDate = normalizeRangeDate(range?.to);
  if (!fromDate && !toDate) {
    return 'Khoảng thời gian không xác định';
  }
  if (fromDate && toDate) {
    const fromText = formatDateOnly(fromDate);
    const toText = formatDateOnly(toDate);
    if (fromText === toText) {
      return fromText;
    }
    return `${fromText || '...'} → ${toText || '...'}`;
  }
  if (fromDate) {
    return `${formatDateOnly(fromDate)} → ...`;
  }
  if (toDate) {
    return `... → ${formatDateOnly(toDate)}`;
  }
  return 'Khoảng thời gian không xác định';
}

function computePreviousRange(range = {}) {
  const fromDate = normalizeRangeDate(range?.from);
  const toDate = normalizeRangeDate(range?.to);
  if (!fromDate || !toDate) {
    return null;
  }
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.max(0, Math.round((toDate.getTime() - fromDate.getTime()) / dayMs));
  const windowDays = diffDays + 1;
  const prevTo = new Date(fromDate.getTime() - dayMs);
  if (Number.isNaN(prevTo.getTime())) {
    return null;
  }
  const prevFrom = new Date(prevTo.getTime() - Math.max(0, windowDays - 1) * dayMs);
  if (Number.isNaN(prevFrom.getTime())) {
    return null;
  }
  return { from: formatDateOnly(prevFrom), to: formatDateOnly(prevTo) };
}

function computeAiInsightSignature({ providerId, snapshot, previousSnapshot }) {
  const hash = crypto.createHash('sha1');
  hash.update(`${providerId || ''}`);
  if (snapshot && typeof snapshot === 'object') {
    hash.update(
      JSON.stringify({
        range: snapshot.range || null,
        summary: snapshot.summary || null,
        totals: snapshot.totals || null,
        filters: snapshot.filters || null,
        topStaff: Array.isArray(snapshot.topStaff)
          ? snapshot.topStaff.slice(0, 5).map((item) => ({
              key: item.key,
              name: item.name,
              declarations: item.declarations,
              totalKpi: item.totalKpi,
            }))
          : [],
        topTeams: Array.isArray(snapshot.topTeams)
          ? snapshot.topTeams.slice(0, 5).map((item) => ({
              key: item.key,
              name: item.name,
              declarations: item.declarations,
              totalKpi: item.totalKpi,
            }))
          : [],
      })
    );
  }
  if (previousSnapshot && typeof previousSnapshot === 'object') {
    hash.update(
      JSON.stringify({
        range: previousSnapshot.range || null,
        summary: previousSnapshot.summary || null,
      })
    );
  }
  return hash.digest('hex');
}

function extractMstStats(snapshot, previousSnapshot, { limit = 5 } = {}) {
  const currentCounts = new Map();
  if (snapshot && Array.isArray(snapshot.rawDeclarations)) {
    for (const row of snapshot.rawDeclarations) {
      const mst = normalizeMST(row?.mst);
      if (!mst) {
        continue;
      }
      currentCounts.set(mst, (currentCounts.get(mst) || 0) + 1);
    }
  }
  const topEntries = Array.from(currentCounts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return a[0].localeCompare(b[0], 'vi', { sensitivity: 'base' });
  });
  const currentSet = new Set(currentCounts.keys());
  const previousSet = new Set();
  if (previousSnapshot && Array.isArray(previousSnapshot.rawDeclarations)) {
    for (const row of previousSnapshot.rawDeclarations) {
      const mst = normalizeMST(row?.mst);
      if (mst) {
        previousSet.add(mst);
      }
    }
  }
  const newMsts = Array.from(currentSet).filter((mst) => !previousSet.has(mst));
  const dropped = Array.from(previousSet).filter((mst) => !currentSet.has(mst));
  return {
    top: limit > 0 ? topEntries.slice(0, limit) : topEntries,
    newMsts: limit > 0 ? newMsts.slice(0, limit) : newMsts,
    dropped: limit > 0 ? dropped.slice(0, limit) : dropped,
  };
}

function buildAiInsightPromptData(snapshot, previousSnapshot) {
  const rangeLabel = formatRangeLabel(snapshot?.range || {});
  const previousRangeLabel = previousSnapshot ? formatRangeLabel(previousSnapshot.range || {}) : null;
  const numberFormatter = new Intl.NumberFormat('vi-VN');
  const decimalFormatter = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const summary = snapshot?.summary || {};
  const previousSummary = previousSnapshot?.summary || {};
  const metricsConfig = [
    { key: 'declarations', label: 'Tổng tờ khai' },
    { key: 'import', label: 'Tờ khai nhập khẩu' },
    { key: 'export', label: 'Tờ khai xuất khẩu' },
    { key: 'kpi', label: 'Điểm KPI' },
    { key: 'items', label: 'Mục hàng' },
    { key: 'licenses', label: 'Giấy phép' },
  ];
  const metrics = metricsConfig.map(({ key, label }) => {
    const currentValue = Number(summary?.[key] ?? 0);
    const previousValue = Number(previousSummary?.[key] ?? 0);
    const delta = currentValue - previousValue;
    const deltaPercent = previousValue > 0 ? (delta / previousValue) * 100 : null;
    return {
      key,
      label,
      current: Number.isFinite(currentValue) ? currentValue : 0,
      previous: Number.isFinite(previousValue) ? previousValue : 0,
      delta: Number.isFinite(delta) ? delta : 0,
      deltaPercent: Number.isFinite(deltaPercent) ? deltaPercent : null,
    };
  });

  function formatMetricValue(metric) {
    if (!Number.isFinite(metric.current)) {
      return '0';
    }
    if (metric.key === 'kpi') {
      return decimalFormatter.format(metric.current);
    }
    return numberFormatter.format(metric.current);
  }

  function describeMetric(metric) {
    const base = `${metric.label}: ${formatMetricValue(metric)}`;
    if (!Number.isFinite(metric.previous) || metric.previous === 0) {
      if (metric.current === metric.previous) {
        return `${base} (không đổi so với kỳ trước)`;
      }
      if (metric.previous === 0 && metric.current > 0) {
        return `${base} (tăng từ 0 so với kỳ trước)`;
      }
      if (metric.previous === 0 && metric.current === 0) {
        return `${base} (không có dữ liệu ở cả hai kỳ)`;
      }
      return `${base} (kỳ trước ${numberFormatter.format(metric.previous || 0)})`;
    }
    if (metric.delta === 0) {
      return `${base} (không đổi so với kỳ trước)`;
    }
    const direction = metric.delta > 0 ? 'tăng' : 'giảm';
    const magnitude = metric.key === 'kpi'
      ? decimalFormatter.format(Math.abs(metric.delta))
      : numberFormatter.format(Math.abs(metric.delta));
    const percentValue = Number.isFinite(metric.deltaPercent)
      ? Math.round(metric.deltaPercent * 10) / 10
      : null;
    const percentText = percentValue !== null
      ? `${percentValue >= 0 ? '+' : ''}${decimalFormatter.format(Math.abs(percentValue))}%`
      : '';
    return `${base} (${direction} ${magnitude}${percentText ? ` ${percentText}` : ''} so với kỳ trước)`;
  }

  const metricLines = metrics.map((metric) => describeMetric(metric));
  const topStaffList = Array.isArray(snapshot?.topStaff) ? snapshot.topStaff.slice(0, 3) : [];
  const topStaffLine = topStaffList
    .map((item) =>
      `${item.name || 'Chưa gán'} (${numberFormatter.format(Number(item.declarations || 0))} tờ khai, ${decimalFormatter.format(
        Number(item.totalKpi || 0)
      )} KPI)`
    )
    .join('; ');
  const topTeamsList = Array.isArray(snapshot?.topTeams) ? snapshot.topTeams.slice(0, 3) : [];
  const topTeamsLine = topTeamsList
    .map((item) =>
      `${item.name || 'Chưa gán tổ'} (${numberFormatter.format(Number(item.declarations || 0))} tờ khai, ${decimalFormatter.format(
        Number(item.totalKpi || 0)
      )} KPI)`
    )
    .join('; ');
  const adjustmentsTotals = snapshot?.adjustments?.totals || {};
  const adjustmentsLine = `Điều chỉnh KPI: ${numberFormatter.format(Number(adjustmentsTotals.approved || 0))} duyệt / ${numberFormatter.format(
    Number(adjustmentsTotals.pending || 0)
  )} chờ / ${numberFormatter.format(Number(adjustmentsTotals.rejected || 0))} từ chối, tổng điểm ảnh hưởng ${decimalFormatter.format(
    Number(adjustmentsTotals.totalPoints || 0)
  )}.`;
  const mstStats = extractMstStats(snapshot, previousSnapshot, { limit: 5 });
  const mstTopLine = mstStats.top
    .map(([mst, count]) => `${mst}: ${numberFormatter.format(count)} tờ khai`)
    .join('; ');
  const mstNewLine = mstStats.newMsts.join(', ');
  const mstDroppedLine = mstStats.dropped.join(', ');

  const lines = [];
  lines.push(
    'Bạn là trợ lý phân tích KPI cho bộ phận khai báo hải quan. Hãy tạo tối đa 5 gạch đầu dòng bằng tiếng Việt, tập trung vào xu hướng đáng chú ý và hành động khuyến nghị.'
  );
  lines.push(`Khoảng thời gian phân tích: ${rangeLabel}.`);
  if (previousRangeLabel) {
    lines.push(`Kỳ so sánh trước: ${previousRangeLabel}.`);
  }
  lines.push('Số liệu chính:');
  for (const line of metricLines) {
    lines.push(`- ${line}`);
  }
  if (topStaffLine) {
    lines.push(`Nhân sự nổi bật: ${topStaffLine}.`);
  }
  if (topTeamsLine) {
    lines.push(`Tổ đội nổi bật: ${topTeamsLine}.`);
  }
  if (mstTopLine) {
    lines.push(`Mã số thuế phát sinh nhiều: ${mstTopLine}.`);
  }
  if (mstNewLine) {
    lines.push(`Mã số thuế mới xuất hiện: ${mstNewLine}.`);
  }
  if (mstDroppedLine) {
    lines.push(`Mã số thuế giảm mạnh hoặc biến mất: ${mstDroppedLine}.`);
  }
  lines.push(adjustmentsLine);
  lines.push('Hãy nêu rõ xu hướng tăng/giảm, cảnh báo rủi ro và đề xuất hành động ưu tiên.');

  return {
    prompt: lines.join('\n'),
    meta: {
      rangeLabel,
      previousRangeLabel,
      metrics,
      highlights: {
        topStaff: topStaffList.map((item) => ({
          key: item.key || null,
          name: item.name || null,
          declarations: Number(item.declarations || 0),
          totalKpi: Number(item.totalKpi || 0),
        })),
        topTeams: topTeamsList.map((item) => ({
          key: item.key || null,
          name: item.name || null,
          declarations: Number(item.declarations || 0),
          totalKpi: Number(item.totalKpi || 0),
        })),
        mstTop: mstStats.top.map(([mst, count]) => ({ mst, declarations: count })),
        mstNew: mstStats.newMsts,
        mstDropped: mstStats.dropped,
        adjustments: {
          pending: Number(adjustmentsTotals.pending || 0),
          approved: Number(adjustmentsTotals.approved || 0),
          rejected: Number(adjustmentsTotals.rejected || 0),
          totalPoints: Number(adjustmentsTotals.totalPoints || 0),
        },
      },
    },
  };
}

function normalizeAiInsightFeedback(feedback) {
  if (!feedback || typeof feedback !== 'object') {
    return { totals: { helpful: 0, notHelpful: 0 }, items: {} };
  }
  const totals = {
    helpful: toNonNegativeInt(feedback?.totals?.helpful, 0),
    notHelpful: toNonNegativeInt(feedback?.totals?.notHelpful, 0),
  };
  const items = {};
  const rawItems = feedback.items && typeof feedback.items === 'object' ? feedback.items : {};
  for (const [username, value] of Object.entries(rawItems)) {
    const normalizedName = typeof username === 'string' ? username.trim() : '';
    if (!normalizedName) {
      continue;
    }
    const helpful = value?.helpful === true;
    const comment =
      typeof value?.comment === 'string' && value.comment.trim()
        ? value.comment.trim().slice(0, AI_INSIGHT_FEEDBACK_COMMENT_LIMIT)
        : null;
    const updatedAt = value?.updatedAt && !Number.isNaN(Date.parse(value.updatedAt))
      ? new Date(value.updatedAt).toISOString()
      : null;
    items[normalizedName] = { helpful, comment, updatedAt };
  }
  if (totals.helpful === 0 && totals.notHelpful === 0) {
    for (const entry of Object.values(items)) {
      if (entry.helpful) {
        totals.helpful += 1;
      } else {
        totals.notHelpful += 1;
      }
    }
  }
  return { totals, items };
}

function normalizeAiInsightEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : createAiInsightId();
  const createdAt = entry.createdAt && !Number.isNaN(Date.parse(entry.createdAt))
    ? new Date(entry.createdAt).toISOString()
    : new Date().toISOString();
  return {
    id,
    createdAt,
    providerId: typeof entry.providerId === 'string' && entry.providerId.trim() ? entry.providerId.trim() : null,
    status: typeof entry.status === 'string' ? entry.status : 'success',
    response: typeof entry.response === 'string' ? entry.response : '',
    promptPreview: typeof entry.promptPreview === 'string' ? entry.promptPreview : null,
    tokens: entry.tokens && typeof entry.tokens === 'object' ? entry.tokens : null,
    range: normalizeSnapshotRange(entry.range || {}),
    filters: normalizeSnapshotFilters(entry.filters || {}),
    snapshotCacheKey: typeof entry.snapshotCacheKey === 'string' ? entry.snapshotCacheKey : null,
    snapshotGeneratedAt: typeof entry.snapshotGeneratedAt === 'string' ? entry.snapshotGeneratedAt : null,
    signature: typeof entry.signature === 'string' ? entry.signature : null,
    meta: entry.meta && typeof entry.meta === 'object' ? entry.meta : null,
    feedback: normalizeAiInsightFeedback(entry.feedback),
  };
}

function getAiInsightsStore() {
  const raw = getJSONValue(AI_INSIGHTS_KEY, DEFAULT_AI_INSIGHTS) || {};
  const entries = [];
  if (Array.isArray(raw.entries)) {
    for (const entry of raw.entries) {
      const normalized = normalizeAiInsightEntry(entry);
      if (!normalized) {
        continue;
      }
      entries.push(normalized);
    }
  }
  entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const limited = AI_INSIGHT_MAX_ENTRIES > 0 ? entries.slice(0, AI_INSIGHT_MAX_ENTRIES) : entries;
  const stateRaw = raw.state && typeof raw.state === 'object' ? raw.state : {};
  const scheduleRaw = raw.schedule && typeof raw.schedule === 'object' ? raw.schedule : {};
  const state = {
    lastRunAt: typeof stateRaw.lastRunAt === 'string' ? stateRaw.lastRunAt : null,
    lastStatus: typeof stateRaw.lastStatus === 'string' ? stateRaw.lastStatus : 'never',
    lastError: typeof stateRaw.lastError === 'string' ? stateRaw.lastError : null,
    lastProviderId: typeof stateRaw.lastProviderId === 'string' ? stateRaw.lastProviderId : null,
  };
  const schedule = {
    cron: typeof scheduleRaw.cron === 'string' ? scheduleRaw.cron : null,
    nextRun: typeof scheduleRaw.nextRun === 'string' ? scheduleRaw.nextRun : null,
  };
  return {
    version: raw.version || DEFAULT_AI_INSIGHTS.version,
    entries: limited,
    state,
    schedule,
  };
}

function setAiInsightsStore(store, options = {}) {
  const payload = {
    version: store?.version || DEFAULT_AI_INSIGHTS.version,
    entries: Array.isArray(store?.entries) ? store.entries.map((entry) => cloneJson(entry)) : [],
    state: {
      lastRunAt: store?.state?.lastRunAt || null,
      lastStatus: store?.state?.lastStatus || 'never',
      lastError: store?.state?.lastError || null,
      lastProviderId: store?.state?.lastProviderId || null,
    },
    schedule: {
      cron: store?.schedule?.cron || null,
      nextRun: store?.schedule?.nextRun || null,
    },
  };
  setJSONValue(AI_INSIGHTS_KEY, payload, options);
}

function sanitizeAiInsightForClient(entry, { username } = {}) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const feedback = entry.feedback && typeof entry.feedback === 'object' ? entry.feedback : { totals: { helpful: 0, notHelpful: 0 }, items: {} };
  const totals = feedback.totals || {};
  const items = feedback.items || {};
  const viewerName = typeof username === 'string' ? username.trim() : '';
  const viewerRaw = viewerName ? items[viewerName] : null;
  const viewer = viewerRaw
    ? {
        helpful: viewerRaw.helpful === true,
        comment: viewerRaw.comment || null,
        updatedAt: viewerRaw.updatedAt || null,
      }
    : null;
  return {
    insightId: entry.id,
    createdAt: entry.createdAt,
    providerId: entry.providerId || null,
    status: entry.status || 'success',
    response: entry.response || '',
    range: entry.range || null,
    meta: entry.meta || null,
    tokens: entry.tokens || null,
    filters: entry.filters || null,
    snapshotCacheKey: entry.snapshotCacheKey || null,
    feedback: {
      helpful: toNonNegativeInt(totals.helpful, 0),
      notHelpful: toNonNegativeInt(totals.notHelpful, 0),
      viewer,
    },
  };
}

async function runAiInsightGeneration(rangeInput = {}, { actor = 'system', providerId, useCache = true } = {}) {
  const config = getAiConfig();
  if (config?.enabled === false) {
    const error = new Error('Tính năng trợ lý AI đang tạm tắt.');
    error.statusCode = 503;
    throw error;
  }
  const provider = selectAiProvider(config, providerId);
  if (!provider) {
    const error = new Error('Chưa tìm thấy nhà cung cấp AI khả dụng.');
    error.statusCode = 503;
    throw error;
  }
  const store = getAiInsightsStore();
  const nowIso = new Date().toISOString();
  let snapshotResult;
  try {
    snapshotResult = await buildAiKpiSnapshot(rangeInput || {}, { actor, useCache });
  } catch (err) {
    setAiInsightsStore(
      {
        ...store,
        state: {
          lastRunAt: nowIso,
          lastStatus: 'error',
          lastError: err?.message || 'Không thể lấy snapshot KPI',
          lastProviderId: null,
        },
      },
      { actor, source: 'ai-insight-state' }
    );
    throw err;
  }

  const snapshot = snapshotResult?.snapshot || null;
  if (!snapshot || (snapshot.summary?.declarations ?? 0) === 0) {
    setAiInsightsStore(
      {
        ...store,
        state: {
          lastRunAt: nowIso,
          lastStatus: 'skipped:no_data',
          lastError: null,
          lastProviderId: null,
        },
      },
      { actor, source: 'ai-insight-state' }
    );
    return { skipped: true, reason: 'no_data' };
  }

  let previousSnapshot = null;
  const previousRange = computePreviousRange(snapshot.range || {});
  if (previousRange) {
    try {
      const previousResult = await buildAiKpiSnapshot(previousRange, { actor, useCache: true });
      previousSnapshot = previousResult.snapshot || null;
    } catch {
      previousSnapshot = null;
    }
  }

  const signature = computeAiInsightSignature({ providerId: provider.id, snapshot, previousSnapshot });
  const existing = store.entries.find((entry) => entry.signature === signature && entry.providerId === provider.id);
  if (existing && useCache !== false) {
    setAiInsightsStore(
      {
        ...store,
        state: {
          lastRunAt: nowIso,
          lastStatus: 'cached',
          lastError: null,
          lastProviderId: provider.id,
        },
      },
      { actor, source: 'ai-insight-state' }
    );
    const sanitized = sanitizeAiInsightForClient(existing, { username: actor });
    return { cached: true, insight: sanitized, signature, snapshotCached: snapshotResult.cached };
  }

  const promptData = buildAiInsightPromptData(snapshot, previousSnapshot);
  const systemPrompt = buildSystemPrompt(
    config.systemPrompt,
    'Bạn đang ở chế độ phân tích dữ liệu KPI. Luôn bám sát số liệu đã cho và trả lời bằng tiếng Việt trang trọng.'
  );
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: promptData.prompt });

  const signal = buildAbortSignal(Math.min(toPositiveInt(config.timeoutMs, DEFAULT_AI_CONFIG.timeoutMs) || DEFAULT_AI_CONFIG.timeoutMs, 60000));
  const temperature = toFiniteNumber(provider.temperature, config.temperature);
  const maxTokens = Math.min(toPositiveInt(provider.maxTokens, config.maxTokens) || DEFAULT_AI_CONFIG.maxTokens, 1024);

  let result;
  try {
    result = await dispatchAiChat(
      provider,
      { messages, temperature, maxTokens },
      { signal }
    );
  } catch (err) {
    setAiInsightsStore(
      {
        ...store,
        state: {
          lastRunAt: nowIso,
          lastStatus: 'error',
          lastError: err?.message || 'Không thể gọi mô hình AI',
          lastProviderId: provider.id,
        },
      },
      { actor, source: 'ai-insight-state' }
    );
    throw err;
  }

  const usage = normalizeAiUsage(result?.usage, promptData.prompt, result?.message);
  const entry = normalizeAiInsightEntry({
    id: createAiInsightId(),
    createdAt: nowIso,
    providerId: provider.id,
    status: 'success',
    response: truncateText(result?.message || '', 6000),
    promptPreview: truncateText(promptData.prompt || '', 2000),
    tokens: usage,
    range: snapshot.range || {},
    filters: snapshot.filters || {},
    snapshotCacheKey: snapshotResult.cacheKey || null,
    snapshotGeneratedAt: snapshot.generatedAt || null,
    signature,
    meta: {
      ...(promptData.meta || {}),
      previousRange,
      snapshotCached: !!snapshotResult.cached,
    },
    feedback: { totals: { helpful: 0, notHelpful: 0 }, items: {} },
  });

  const entries = [entry, ...store.entries.filter((item) => item.id !== entry.id)].slice(0, AI_INSIGHT_MAX_ENTRIES);
  const nextStore = {
    version: store.version || DEFAULT_AI_INSIGHTS.version,
    entries,
    state: {
      lastRunAt: nowIso,
      lastStatus: 'success',
      lastError: null,
      lastProviderId: provider.id,
    },
    schedule: store.schedule || cloneJson(DEFAULT_AI_INSIGHTS.schedule),
  };
  setAiInsightsStore(nextStore, { actor, source: 'ai-insight-store' });

  pushAuditLog({
    actor,
    action: 'ai.insight.generate',
    detail: `Sinh insight KPI (${provider.id})`,
    meta: {
      range: entry.range,
      signature,
      snapshotCacheKey: entry.snapshotCacheKey,
      highlights: promptData.meta?.highlights || null,
    },
  });

  const sanitized = sanitizeAiInsightForClient(entry, { username: actor });
  return { insight: sanitized, signature, snapshotCached: snapshotResult.cached };
}

function submitAiInsightFeedback(insightId, username, payload = {}, { actor = 'system' } = {}) {
  const normalizedId = typeof insightId === 'string' ? insightId.trim() : '';
  if (!normalizedId) {
    throw new Error('Thiếu mã insight để phản hồi.');
  }
  const normalizedUser = typeof username === 'string' ? username.trim() : '';
  if (!normalizedUser) {
    throw new Error('Không xác định được tài khoản gửi phản hồi.');
  }
  if (payload.helpful !== true && payload.helpful !== false) {
    throw new Error('Vui lòng chọn đánh giá hữu ích hoặc chưa hữu ích.');
  }

  const store = getAiInsightsStore();
  const entries = store.entries.map((entry) => ({ ...entry, feedback: normalizeAiInsightFeedback(entry.feedback) }));
  const index = entries.findIndex((entry) => entry.id === normalizedId);
  if (index === -1) {
    throw new Error('Không tìm thấy insight để phản hồi.');
  }

  const comment =
    typeof payload.comment === 'string' && payload.comment.trim()
      ? payload.comment.trim().slice(0, AI_INSIGHT_FEEDBACK_COMMENT_LIMIT)
      : null;
  const updatedAt = new Date().toISOString();
  const feedbackItems = { ...entries[index].feedback.items, [normalizedUser]: { helpful: payload.helpful === true, comment, updatedAt } };
  const totals = { helpful: 0, notHelpful: 0 };
  for (const value of Object.values(feedbackItems)) {
    if (value.helpful) {
      totals.helpful += 1;
    } else {
      totals.notHelpful += 1;
    }
  }

  entries[index] = {
    ...entries[index],
    feedback: { totals, items: feedbackItems },
  };

  setAiInsightsStore(
    {
      version: store.version || DEFAULT_AI_INSIGHTS.version,
      entries,
      state: store.state,
      schedule: store.schedule,
    },
    { actor, source: 'ai-insight-feedback' }
  );

  pushAuditLog({
    actor,
    action: 'ai.insight.feedback',
    detail: `Phản hồi insight ${normalizedId}`,
    meta: { helpful: payload.helpful === true, comment },
  });

  return {
    totals,
    feedback: {
      helpful: payload.helpful === true,
      comment,
      updatedAt,
    },
  };
}

function computeAiSnapshotCacheKey({ range, includeTaxCodes = [], excludeTaxCodes = [], config = {} } = {}) {
  const normalizedRange = normalizeSnapshotRange(range || {});
  const includeList = normalizeEcusTaxCodeList(includeTaxCodes);
  const excludeList = normalizeEcusTaxCodeList(excludeTaxCodes);
  const queryText = `${config?.query || ''}`.trim();
  const queryHash = crypto.createHash('sha1').update(queryText).digest('hex');
  const signature = {
    from: normalizedRange.from,
    to: normalizedRange.to,
    include: includeList,
    exclude: excludeList,
    server: normalizeStr(config?.connection?.server || ''),
    database: normalizeStr(config?.connection?.database || ''),
    preferMonthFirst: !!config?.preferMonthFirst,
    query: queryHash,
  };
  const hash = crypto.createHash('sha1');
  hash.update(JSON.stringify(signature));
  return hash.digest('hex');
}

function normalizeEcusTaxCodeList(input) {
  if (!input && input !== 0) {
    return [];
  }
  const values = Array.isArray(input) ? input : `${input}`.split(/[;\n\r,]+/u);
  const set = new Set();
  for (const value of values) {
    const normalized = normalizeMST(value);
    if (normalized) {
      set.add(normalized);
    }
  }
  return Array.from(set).sort();
}

function clearAiCache({ actor = 'system' } = {}) {
  setJSONValue(AI_CACHE_KEY, cloneJson(DEFAULT_AI_USAGE_CACHE), { actor, source: 'ai-cache-clear' });
  pushAuditLog({ actor, action: 'ai.cache.clear', detail: 'Xóa cache trợ lý AI' });
}

function computeAiCacheKey({ providerId, prompt, scope, context }) {
  const hash = crypto.createHash('sha256');
  hash.update(`${providerId || ''}`);
  hash.update('\n::prompt::\n');
  hash.update(`${prompt || ''}`);
  hash.update('\n::scope::\n');
  hash.update(`${scope || ''}`);
  hash.update('\n::context::\n');
  hash.update(`${context || ''}`);
  return hash.digest('hex');
}

function truncateText(text, limit) {
  const str = `${text ?? ''}`;
  if (!limit || !Number.isFinite(limit) || limit <= 0) {
    return str;
  }
  if (str.length <= limit) {
    return str;
  }
  return `${str.slice(0, limit)}…`;
}

function buildAbortSignal(timeoutMs) {
  const ms = toPositiveInt(timeoutMs, DEFAULT_AI_CONFIG.timeoutMs);
  if (!ms) {
    return undefined;
  }
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

function estimateTokensFromText(text) {
  const str = `${text ?? ''}`;
  if (!str) {
    return 0;
  }
  return Math.max(1, Math.ceil(str.length / 4));
}

function normalizeAiUsage(rawUsage, prompt, response) {
  const usage = rawUsage && typeof rawUsage === 'object' ? { ...rawUsage } : {};
  const promptTokens = toNonNegativeInt(
    usage.prompt_tokens ?? usage.promptTokens,
    estimateTokensFromText(prompt)
  );
  const completionTokens = toNonNegativeInt(
    usage.completion_tokens ?? usage.completionTokens,
    estimateTokensFromText(response)
  );
  const totalTokens = toNonNegativeInt(
    usage.total_tokens ?? usage.totalTokens,
    promptTokens + completionTokens
  );
  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

function buildSystemPrompt(basePrompt, overridePrompt) {
  const base = `${basePrompt ?? ''}`.trim();
  const extra = `${overridePrompt ?? ''}`.trim();
  if (base && extra) {
    return `${base}\n\n${extra}`;
  }
  return base || extra || DEFAULT_AI_CONFIG.systemPrompt;
}

function selectAiProvider(config, preferredId) {
  const providers = Array.isArray(config?.providers) ? config.providers : [];
  if (providers.length === 0) {
    return null;
  }
  const enabledProviders = providers
    .map((provider) => normalizeAiProviderEntry(provider, provider))
    .filter((provider) => provider && provider.enabled !== false);
  if (enabledProviders.length === 0) {
    return null;
  }
  const normalizedPreferred = `${preferredId || ''}`.trim();
  if (normalizedPreferred) {
    const found = enabledProviders.find((provider) => provider.id === normalizedPreferred);
    if (found) {
      return found;
    }
  }
  const defaultId = `${config?.defaultProvider || ''}`.trim();
  if (defaultId) {
    const foundDefault = enabledProviders.find((provider) => provider.id === defaultId);
    if (foundDefault) {
      return foundDefault;
    }
  }
  return enabledProviders[0];
}

async function callAzureOpenAiChat(provider, payload, { signal } = {}) {
  const endpoint = `${provider.endpoint || ''}`.trim();
  const deployment = `${provider.deployment || ''}`.trim();
  const apiVersion = `${provider.apiVersion || '2024-08-01-preview'}`.trim() || '2024-08-01-preview';
  const apiKeyEnv = `${provider.apiKeyEnv || 'AZURE_OPENAI_KEY'}`.trim() || 'AZURE_OPENAI_KEY';
  const apiKey = provider.apiKey || process.env[apiKeyEnv];
  if (!endpoint) {
    throw new Error('Chưa cấu hình endpoint Azure OpenAI.');
  }
  if (!deployment) {
    throw new Error('Chưa cấu hình deployment Azure OpenAI.');
  }
  if (!apiKey) {
    throw new Error(`Thiếu khóa API ${apiKeyEnv} cho Azure OpenAI.`);
  }
  const url = `${endpoint.replace(/\/?$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
  const body = {
    messages: payload.messages,
    temperature: payload.temperature,
    max_tokens: payload.maxTokens,
    top_p: payload.topP,
    frequency_penalty: payload.frequencyPenalty,
    presence_penalty: payload.presencePenalty,
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure OpenAI trả về ${response.status}: ${truncateText(errorText, 200)}`);
  }
  const data = await response.json();
  const message = data?.choices?.[0]?.message?.content || '';
  return {
    message,
    usage: data?.usage || null,
  };
}

async function callOpenAiChat(provider, payload, { signal } = {}) {
  const endpoint = `${provider.endpoint || 'https://api.openai.com/v1'}`.trim() || 'https://api.openai.com/v1';
  const model = `${provider.model || 'gpt-4o-mini'}`.trim() || 'gpt-4o-mini';
  const apiKeyEnv = `${provider.apiKeyEnv || 'OPENAI_API_KEY'}`.trim() || 'OPENAI_API_KEY';
  const apiKey = provider.apiKey || process.env[apiKeyEnv];
  if (!apiKey) {
    throw new Error(`Thiếu khóa API ${apiKeyEnv} cho OpenAI.`);
  }
  const baseUrl = endpoint.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;
  const body = {
    model,
    messages: payload.messages,
    temperature: toFiniteNumber(
      payload.temperature,
      provider.temperature ?? DEFAULT_AI_CONFIG.temperature
    ),
    max_tokens: toPositiveInt(
      payload.maxTokens,
      provider.maxTokens ?? DEFAULT_AI_CONFIG.maxTokens
    ),
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI trả về ${response.status}: ${truncateText(errorText, 200)}`);
  }
  const data = await response.json();
  const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
  const message = choice?.message?.content || '';
  return {
    message,
    usage: data?.usage ?? null,
  };
}

async function callDeepseekChat(provider, payload, { signal } = {}) {
  const endpoint = `${provider.endpoint || 'https://api.deepseek.com/v1'}`.trim() || 'https://api.deepseek.com/v1';
  const model = `${provider.model || 'deepseek-chat'}`.trim() || 'deepseek-chat';
  const apiKeyEnv = `${provider.apiKeyEnv || 'DEEPSEEK_API_KEY'}`.trim() || 'DEEPSEEK_API_KEY';
  const apiKey = provider.apiKey || process.env[apiKeyEnv];
  if (!apiKey) {
    throw new Error(`Thiếu khóa API ${apiKeyEnv} cho DeepSeek.`);
  }
  const baseUrl = endpoint.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;
  const body = {
    model,
    messages: payload.messages,
    temperature: toFiniteNumber(
      payload.temperature,
      provider.temperature ?? DEFAULT_AI_CONFIG.temperature
    ),
    max_tokens: toPositiveInt(
      payload.maxTokens,
      provider.maxTokens ?? DEFAULT_AI_CONFIG.maxTokens
    ),
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek trả về ${response.status}: ${truncateText(errorText, 200)}`);
  }
  const data = await response.json();
  const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
  const message = choice?.message?.content || data?.output || '';
  return {
    message,
    usage: data?.usage ?? null,
  };
}

async function callQwenChat(provider, payload, { signal } = {}) {
  const endpoint = `${provider.endpoint || 'https://dashscope.aliyuncs.com/compatible-mode/v1'}`.trim() ||
    'https://dashscope.aliyuncs.com/compatible-mode/v1';
  const model = `${provider.model || 'qwen-plus'}`.trim() || 'qwen-plus';
  const apiKeyEnv = `${provider.apiKeyEnv || 'QWEN_API_KEY'}`.trim() || 'QWEN_API_KEY';
  const apiKey = provider.apiKey || process.env[apiKeyEnv];
  if (!apiKey) {
    throw new Error(`Thiếu khóa API ${apiKeyEnv} cho Qwen.`);
  }
  const baseUrl = endpoint.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;
  const body = {
    model,
    messages: payload.messages,
    temperature: toFiniteNumber(
      payload.temperature,
      provider.temperature ?? DEFAULT_AI_CONFIG.temperature
    ),
    max_tokens: toPositiveInt(
      payload.maxTokens,
      provider.maxTokens ?? DEFAULT_AI_CONFIG.maxTokens
    ),
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Qwen trả về ${response.status}: ${truncateText(errorText, 200)}`);
  }
  const data = await response.json();
  const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
  const message = choice?.message?.content || data?.output_text || '';
  return {
    message,
    usage: data?.usage ?? null,
  };
}

async function callBaiduErnieChat(provider, payload, { signal } = {}) {
  const endpoint = `${
    provider.endpoint ||
    'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions'
  }`.trim() || 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions';
  const model = `${provider.model || 'ernie-speed-128k'}`.trim() || 'ernie-speed-128k';
  const apiKeyEnv = `${provider.apiKeyEnv || 'BAIDU_QIANFAN_ACCESS_TOKEN'}`.trim() ||
    'BAIDU_QIANFAN_ACCESS_TOKEN';
  const accessToken = provider.apiKey || process.env[apiKeyEnv];
  if (!accessToken) {
    throw new Error(`Thiếu access token ${apiKeyEnv} cho Baidu Qianfan.`);
  }
  const hasQuery = endpoint.includes('?');
  const url = `${endpoint}${hasQuery ? '&' : '?'}access_token=${encodeURIComponent(accessToken)}`;
  const body = {
    messages: payload.messages,
    temperature: toFiniteNumber(
      payload.temperature,
      provider.temperature ?? DEFAULT_AI_CONFIG.temperature
    ),
    max_output_tokens: toPositiveInt(
      payload.maxTokens,
      provider.maxTokens ?? DEFAULT_AI_CONFIG.maxTokens
    ),
    stream: false,
    model,
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Baidu Qianfan trả về ${response.status}: ${truncateText(errorText, 200)}`);
  }
  const data = await response.json();
  const message = `${data?.result || data?.output || ''}`.trim();
  const usage = data?.usage
    ? {
        prompt_tokens: toNonNegativeInt(data.usage.prompt_tokens, 0),
        completion_tokens: toNonNegativeInt(data.usage.completion_tokens, 0),
        total_tokens: toNonNegativeInt(
          data.usage.total_tokens,
          toNonNegativeInt(data.usage.prompt_tokens, 0) + toNonNegativeInt(data.usage.completion_tokens, 0)
        ),
      }
    : null;
  return {
    message,
    usage,
  };
}

async function callZaiChat(provider, payload, { signal } = {}) {
  const endpoint = `${provider.endpoint || 'https://api.z-ai.com/v1'}`.trim() || 'https://api.z-ai.com/v1';
  const model = `${provider.model || 'zai-chat-pro'}`.trim() || 'zai-chat-pro';
  const apiKeyEnv = `${provider.apiKeyEnv || 'ZAI_API_KEY'}`.trim() || 'ZAI_API_KEY';
  const apiKey = provider.apiKey || process.env[apiKeyEnv];
  if (!apiKey) {
    throw new Error(`Thiếu khóa API ${apiKeyEnv} cho Z.AI.`);
  }
  const baseUrl = endpoint.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;
  const body = {
    model,
    messages: payload.messages,
    temperature: toFiniteNumber(
      payload.temperature,
      provider.temperature ?? DEFAULT_AI_CONFIG.temperature
    ),
    max_tokens: toPositiveInt(
      payload.maxTokens,
      provider.maxTokens ?? DEFAULT_AI_CONFIG.maxTokens
    ),
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Z.AI trả về ${response.status}: ${truncateText(errorText, 200)}`);
  }
  const data = await response.json();
  const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
  const message = choice?.message?.content || data?.output || '';
  return {
    message,
    usage: data?.usage ?? null,
  };
}

const OLLAMA_CACHE_DEFAULT_TTL_MS = 30 * 1000;
const OLLAMA_CACHE_DEFAULT_LIMIT = 25;
const OLLAMA_DEFAULT_RETRY_ATTEMPTS = 2;
const OLLAMA_DEFAULT_RETRY_DELAY_MS = 250;
const ollamaTransientCache = new Map();

function computeOllamaCacheKey(provider, payload) {
  const hasher = crypto.createHash('sha1');
  hasher.update(`${provider.endpoint || ''}`);
  hasher.update('|');
  hasher.update(`${provider.model || ''}`);
  hasher.update('|');
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const normalizedMessages = messages.map((entry) => ({
    role: `${entry?.role || ''}`,
    content: `${entry?.content || ''}`,
  }));
  hasher.update(JSON.stringify(normalizedMessages));
  hasher.update('|');
  hasher.update(`${payload?.temperature ?? ''}`);
  hasher.update('|');
  hasher.update(`${payload?.maxTokens ?? ''}`);
  return hasher.digest('hex');
}

function pruneOllamaCache(now = Date.now(), limit = OLLAMA_CACHE_DEFAULT_LIMIT) {
  for (const [key, entry] of ollamaTransientCache.entries()) {
    if (!entry || typeof entry !== 'object') {
      ollamaTransientCache.delete(key);
      continue;
    }
    if (now - entry.timestamp > entry.ttlMs) {
      ollamaTransientCache.delete(key);
    }
  }
  while (ollamaTransientCache.size > Math.max(1, limit)) {
    const oldestKey = ollamaTransientCache.keys().next().value;
    if (!oldestKey) break;
    ollamaTransientCache.delete(oldestKey);
  }
}

function readOllamaCache(cacheKey, now = Date.now()) {
  if (!cacheKey || !ollamaTransientCache.has(cacheKey)) {
    return null;
  }
  const entry = ollamaTransientCache.get(cacheKey);
  if (!entry || now - entry.timestamp > entry.ttlMs) {
    ollamaTransientCache.delete(cacheKey);
    return null;
  }
  return cloneJson(entry.result);
}

function writeOllamaCache(cacheKey, result, { ttlMs, limit }) {
  if (!cacheKey) {
    return;
  }
  const now = Date.now();
  const normalizedTtl = Math.max(500, Number.isFinite(ttlMs) ? Number(ttlMs) : OLLAMA_CACHE_DEFAULT_TTL_MS);
  const normalizedLimit = Math.max(1, Number.isFinite(limit) ? Number(limit) : OLLAMA_CACHE_DEFAULT_LIMIT);
  ollamaTransientCache.set(cacheKey, {
    result: cloneJson(result),
    timestamp: now,
    ttlMs: normalizedTtl,
  });
  pruneOllamaCache(now, normalizedLimit);
}

async function callOllamaChat(provider, payload, { signal } = {}) {
  const endpoint = `${provider.endpoint || 'http://localhost:11434'}`.trim() || 'http://localhost:11434';
  const model = `${provider.model || 'llama3.1:8b'}`.trim() || 'llama3.1:8b';
  const body = {
    model,
    messages: payload.messages,
    stream: false,
    options: {
      temperature: payload.temperature ?? provider.temperature ?? DEFAULT_AI_CONFIG.temperature,
      num_predict: payload.maxTokens ?? provider.maxTokens ?? DEFAULT_AI_CONFIG.maxTokens,
    },
  };
  const ttlMs = toPositiveInt(provider.cacheTtlMs, OLLAMA_CACHE_DEFAULT_TTL_MS);
  const cacheLimit = toPositiveInt(provider.cacheLimit, OLLAMA_CACHE_DEFAULT_LIMIT);
  const cacheKey = computeOllamaCacheKey(provider, payload);
  pruneOllamaCache(Date.now(), cacheLimit);
  const cached = readOllamaCache(cacheKey);
  if (cached) {
    return cached;
  }
  const attempts = Math.max(1, toPositiveInt(provider.retryAttempts, OLLAMA_DEFAULT_RETRY_ATTEMPTS));
  const retryDelayMs = toPositiveInt(provider.retryDelayMs, OLLAMA_DEFAULT_RETRY_DELAY_MS);
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (signal?.aborted) {
      const abortError = new Error('Yêu cầu Ollama đã bị hủy.');
      abortError.name = 'AbortError';
      throw abortError;
    }
    try {
      const response = await fetch(`${endpoint.replace(/\/?$/, '')}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama trả về ${response.status}: ${truncateText(errorText, 200)}`);
      }
      const data = await response.json();
      let message = '';
      if (typeof data?.message?.content === 'string') {
        message = data.message.content;
      } else if (Array.isArray(data?.message)) {
        message = data.message.map((part) => part?.content || '').join('\n').trim();
      }
      const result = {
        message,
        usage: {
          prompt_tokens: data?.prompt_eval_count,
          completion_tokens: data?.eval_count,
          total_tokens:
            (toNonNegativeInt(data?.prompt_eval_count, 0) || 0) +
            (toNonNegativeInt(data?.eval_count, 0) || 0),
        },
      };
      writeOllamaCache(cacheKey, result, { ttlMs, limit: cacheLimit });
      return result;
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === attempts - 1;
      if (isLastAttempt) {
        console.error('Gọi Ollama thất bại', {
          endpoint,
          model,
          error: err?.message || err,
        });
        throw err;
      }
      console.warn('Thử lại kết nối Ollama', {
        endpoint,
        model,
        attempt: attempt + 1,
        error: err?.message || err,
      });
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  throw lastError || new Error('Không thể gọi Ollama.');
}

const DEFAULT_ECUS_MONITOR_ALERT_OPTIONS = Object.freeze({
  failureThreshold: 3,
  failureCooldownMinutes: 120,
  staleThresholdMinutes: 60,
  staleCooldownMinutes: 60,
  dashboardUrl: '',
});

const ECUS_MONITOR_ALERT_STATE_KEY = 'ecus_monitor_alert_state_v1';
const DEFAULT_ECUS_MONITOR_ALERT_STATE = Object.freeze({
  consecutiveErrors: 0,
  lastErrorAt: null,
  lastErrorMessage: null,
  lastErrorMeta: null,
  lastSuccessAt: null,
  lastFailureAlertAt: null,
  lastFailureAlertAttemptAt: null,
  lastStaleAlertAt: null,
  lastStaleAlertAttemptAt: null,
  lastAlertAttemptAt: null,
  lastAlertDeliveredAt: null,
  lastDeliveredChannels: [],
  lastAlertSummary: null,
});


function convertMessagesToGooglePayload(messages = []) {
  const normalized = Array.isArray(messages) ? messages : [];
  const contents = [];
  const systemParts = [];
  for (const entry of normalized) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const text = `${entry.content ?? ''}`.trim();
    if (!text) {
      continue;
    }
    const role = `${entry.role || 'user'}`.trim().toLowerCase();
    if (role === 'system') {
      systemParts.push({ text });
      continue;
    }
    if (role === 'assistant' || role === 'model') {
      contents.push({ role: 'model', parts: [{ text }] });
      continue;
    }
    contents.push({ role: 'user', parts: [{ text }] });
  }

  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: 'Xin chào' }] });
  }

  const systemInstruction =
    systemParts.length > 0
      ? {
          role: 'system',
          parts: systemParts,
        }
      : null;

  return { contents, systemInstruction };
}

async function callGoogleAiStudioChat(provider, payload, { signal } = {}) {
  const endpoint = `${provider.endpoint || 'https://generativelanguage.googleapis.com'}`.trim() ||
    'https://generativelanguage.googleapis.com';
  const model = `${provider.model || 'gemini-1.5-flash'}`.trim() || 'gemini-1.5-flash';
  const apiKeyEnv = `${provider.apiKeyEnv || 'GOOGLE_AI_STUDIO_API_KEY'}`.trim() || 'GOOGLE_AI_STUDIO_API_KEY';
  const apiKey = provider.apiKey || process.env[apiKeyEnv];
  if (!apiKey) {
    throw new Error(`Thiếu khóa API ${apiKeyEnv} cho Google AI Studio.`);
  }
  const baseUrl = endpoint.replace(/\/+$/, '');
  const url = `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const { contents, systemInstruction } = convertMessagesToGooglePayload(payload.messages);
  const generationConfig = {
    temperature: toFiniteNumber(
      payload.temperature,
      provider.temperature ?? DEFAULT_AI_CONFIG.temperature
    ),
    maxOutputTokens: toPositiveInt(
      payload.maxTokens,
      provider.maxTokens ?? DEFAULT_AI_CONFIG.maxTokens
    ),
  };
  const body = {
    contents,
    generationConfig,
    responseMimeType: 'text/plain',
  };
  if (systemInstruction) {
    body.systemInstruction = systemInstruction;
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google AI Studio trả về ${response.status}: ${truncateText(errorText, 200)}`);
  }
  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  let message = '';
  if (Array.isArray(parts)) {
    message = parts
      .map((part) => `${part?.text ?? ''}`.trim())
      .filter((text) => text)
      .join('\n')
      .trim();
  }
  const usageMetadata = data?.usageMetadata;
  const usage = usageMetadata
    ? {
        prompt_tokens: usageMetadata.promptTokenCount,
        completion_tokens: usageMetadata.candidatesTokenCount,
        total_tokens: usageMetadata.totalTokenCount,
      }
    : null;
  return {
    message,
    usage,
  };
}

function convertMessagesToAnthropicPayload(messages = []) {
  const normalized = Array.isArray(messages) ? messages : [];
  const conversation = [];
  const systemParts = [];
  for (const entry of normalized) {
    if (!entry || typeof entry !== 'object') continue;
    const text = `${entry.content ?? ''}`.trim();
    if (!text) continue;
    const role = `${entry.role || 'user'}`.trim().toLowerCase();
    if (role === 'system') {
      systemParts.push(text);
      continue;
    }
    const content = [{ type: 'text', text }];
    if (role === 'assistant') {
      conversation.push({ role: 'assistant', content });
      continue;
    }
    conversation.push({ role: 'user', content });
  }
  if (conversation.length === 0) {
    conversation.push({ role: 'user', content: [{ type: 'text', text: 'Xin chào' }] });
  }
  const system = systemParts.length ? systemParts.join('\n\n') : undefined;
  return { system, messages: conversation };
}

async function callAnthropicChat(provider, payload, { signal } = {}) {
  const endpoint = `${provider.endpoint || 'https://api.anthropic.com'}`.trim() || 'https://api.anthropic.com';
  const model = `${provider.model || 'claude-3-5-sonnet-20241022'}`.trim() || 'claude-3-5-sonnet-20241022';
  const apiKeyEnv = `${provider.apiKeyEnv || 'ANTHROPIC_API_KEY'}`.trim() || 'ANTHROPIC_API_KEY';
  const apiVersion = `${provider.apiVersion || '2023-06-01'}`.trim() || '2023-06-01';
  const apiKey = provider.apiKey || process.env[apiKeyEnv];
  if (!apiKey) {
    throw new Error(`Thiếu khóa API ${apiKeyEnv} cho Anthropic.`);
  }
  const baseUrl = endpoint.replace(/\/+$/, '');
  const url = `${baseUrl}/v1/messages`;
  const { system, messages } = convertMessagesToAnthropicPayload(payload.messages);
  const body = {
    model,
    max_tokens: toPositiveInt(
      payload.maxTokens,
      provider.maxTokens ?? DEFAULT_AI_CONFIG.maxTokens
    ),
    temperature: toFiniteNumber(
      payload.temperature,
      provider.temperature ?? DEFAULT_AI_CONFIG.temperature
    ),
    messages,
  };
  if (system) {
    body.system = system;
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': apiVersion,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic trả về ${response.status}: ${truncateText(errorText, 200)}`);
  }
  const data = await response.json();
  const parts = Array.isArray(data?.content) ? data.content : [];
  const message = parts
    .map((part) => `${part?.text ?? ''}`.trim())
    .filter((text) => text)
    .join('\n')
    .trim();
  const usage = data?.usage
    ? {
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens,
        total_tokens:
          toNonNegativeInt(data.usage.input_tokens, 0) + toNonNegativeInt(data.usage.output_tokens, 0),
      }
    : null;
  return {
    message,
    usage,
  };
}

async function dispatchAiChat(provider, payload, { signal } = {}) {
  const type = `${provider.type || ''}`.trim().toLowerCase();
  if (type === 'azure' || type === 'azure-openai') {
    return callAzureOpenAiChat(provider, payload, { signal });
  }
  if (type === 'openai' || type === 'openai-chat') {
    return callOpenAiChat(provider, payload, { signal });
  }
  if (type === 'ollama' || type === 'ollama-local') {
    return callOllamaChat(provider, payload, { signal });
  }
  if (type === 'anthropic' || type === 'claude') {
    return callAnthropicChat(provider, payload, { signal });
  }
  if (type === 'google-ai-studio' || type === 'google' || type === 'gemini') {
    return callGoogleAiStudioChat(provider, payload, { signal });
  }
  if (type === 'deepseek' || type === 'deepseek-chat') {
    return callDeepseekChat(provider, payload, { signal });
  }
  if (type === 'qwen' || type === 'dashscope' || type === 'ali-qwen') {
    return callQwenChat(provider, payload, { signal });
  }
  if (type === 'baidu' || type === 'ernie' || type === 'qianfan' || type === 'baidu-ernie') {
    return callBaiduErnieChat(provider, payload, { signal });
  }
  if (type === 'zai' || type === 'z.ai' || type === 'zaichat') {
    return callZaiChat(provider, payload, { signal });
  }
  throw new Error(`Nhà cung cấp AI ${provider.id} chưa được hỗ trợ.`);
}

function summarizeAiCacheEntries(entries, { promptLimit = 160, responseLimit = 200 } = {}) {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries.map((entry) => ({
    key: entry.key,
    providerId: entry.providerId,
    scope: entry.scope,
    actor: entry.actor,
    createdAt: entry.createdAt,
    promptPreview: truncateText(entry.prompt, promptLimit),
    responsePreview: truncateText(entry.response, responseLimit),
    usage: entry.usage || null,
  }));
}

function sortAccountRecords(records) {
  return records.sort((a, b) => a.username.localeCompare(b.username, 'vi', { sensitivity: 'base' }));
}

function describeRole(role) {
  const key = normalizeRoleKey(role);
  return ROLE_LABELS[key] || key || 'không rõ';
}

function describePermissionChange(key, enabled) {
  const label = ACCOUNT_PERMISSION_LABELS[key] || key;
  return `${label}: ${enabled ? 'bật' : 'tắt'}`;
}

function summarizePermissionChanges(previous = {}, next = {}) {
  const diffs = [];
  for (const key of ACCOUNT_PERMISSION_KEYS) {
    const prevValue = key === 'reportsExport' ? previous?.[key] !== false : previous?.[key] === true;
    const nextValue = key === 'reportsExport' ? next?.[key] !== false : next?.[key] === true;
    if (prevValue !== nextValue) {
      diffs.push({ key, before: prevValue, after: nextValue });
    }
  }
  return diffs;
}

function sanitizeAccountRecord(record) {
  if (!record) return null;
  const role = normalizeRoleKey(record.role);
  const name = record.name || record.username;
  return {
    username: record.username,
    role,
    name,
    permissions: normalizePermissionsForRole(record.permissions, role),
    memberId: toNullableString(record.memberId, { maxLength: 160 }),
    memberName: toNullableString(record.memberName, { maxLength: 255 }),
    teamId: toNullableString(record.teamId, { maxLength: 160 }),
    teamName: toNullableString(record.teamName, { maxLength: 255 }),
  };
}

function normalizeAccountRecordForStorage(record) {
  if (!record) return null;
  const role = normalizeRoleKey(record.role);
  return {
    username: (record.username ?? '').toString().trim(),
    passwordHash: (record.passwordHash ?? '').toString(),
    role,
    name: (record.name ?? record.username ?? '').toString().trim(),
    permissions: normalizePermissionsForRole(record.permissions, role),
    updatedAt: normalizeAccountUpdatedAt(record.updatedAt),
    memberId: toNullableString(record.memberId, { maxLength: 160 }),
    memberName: toNullableString(record.memberName, { maxLength: 255 }),
    teamId: toNullableString(record.teamId, { maxLength: 160 }),
    teamName: toNullableString(record.teamName, { maxLength: 255 }),
  };
}

function persistAccountRecords(records, options = {}) {
  const { skipSqlSync = false } = options || {};
  const normalized = Array.isArray(records)
    ? records
        .map((entry) => normalizeAccountRecordForStorage(entry))
        .filter((entry) => entry && entry.username && entry.passwordHash)
    : [];
  sortAccountRecords(normalized);
  setJSONValue('kpi_users_v1', normalized);
  if (!skipSqlSync) {
    scheduleAccountSqlSync(normalized.map((entry) => ({ ...entry }))); // clone to tránh mutate ngoài ý muốn
  }
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
      const role = normalizeRoleKey(entry?.role);
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
      const updatedAt = normalizeAccountUpdatedAt(entry?.updatedAt || entry?.updated_at);
      const memberId = toNullableString(entry?.memberId ?? entry?.member_id, { maxLength: 160 });
      const memberName = toNullableString(entry?.memberName ?? entry?.member_name, { maxLength: 255 });
      const teamId = toNullableString(entry?.teamId ?? entry?.team_id, { maxLength: 160 });
      const teamName = toNullableString(entry?.teamName ?? entry?.team_name, { maxLength: 255 });
      seen.add(key);
      records.push({ username, passwordHash, role, name, permissions, updatedAt, memberId, memberName, teamId, teamName });
    }
  }

  const defaults = buildDefaultAccounts();

  if (records.length === 0) {
    records.push(...defaults);
    mutated = true;
  } else {
    for (const account of defaults) {
      if (!records.some((record) => record.username === account.username)) {
        records.push(account);
        mutated = true;
      }
    }
  }

  if (!records.some((record) => normalizeRoleKey(record.role) === ADMIN_ROLE)) {
    const defaultAdmin = defaults.find((account) => normalizeRoleKey(account.role) === ADMIN_ROLE);
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
  for (const key of Object.keys(store)) {
    if (key.startsWith(AI_CHAT_HISTORY_PREFIX)) {
      delete store[key];
    }
  }
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
  db.exec('DELETE FROM export_audit');
  const insertMany = db.transaction((entries) => {
    const stmt = db.prepare(
      'INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );
    for (const [key, value] of entries) {
      stmt.run(key, normalizeValue(value));
    }
  });
  insertMany(Object.entries(DEFAULT_STORAGE));
  resetAccountSyncState();
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

function normalizeDeclarationNumber(input, { length = 11 } = {}) {
  const raw = (input ?? '').toString();
  if (!raw.trim()) {
    return '';
  }
  const digitsOnly = raw.replace(/[^0-9]/g, '');
  if (!digitsOnly) {
    return '';
  }
  const maxLength = Number.isFinite(length) && length > 0 ? length : 11;
  if (digitsOnly.length >= maxLength) {
    return digitsOnly.slice(0, maxLength);
  }
  return digitsOnly.padStart(maxLength, '0');
}

function normalizeDeclarationRow(row) {
  if (!row || typeof row !== 'object') {
    return null;
  }
  const cloned = { ...row };
  const originalNumber = (row.so_tk_full ?? row.so_tk ?? '').toString();
  const normalizedNumber = normalizeDeclarationNumber(originalNumber || row.so_tk);
  cloned.so_tk = normalizedNumber;
  if (originalNumber) {
    cloned.so_tk_full = originalNumber;
    const suffix = normalizedNumber ? originalNumber.slice(normalizedNumber.length) : originalNumber;
    cloned.so_tk_suffix = suffix || '';
  }
  if (!cloned.nhanh && cloned.branch) {
    cloned.nhanh = cloned.branch;
  }
  return cloned;
}

function getDeclarationKey(row) {
  if (!row || typeof row !== 'object') {
    return '';
  }
  const soTk = normalizeDeclarationNumber(row?.so_tk ?? row?.so_tk_full ?? '');
  if (!soTk) {
    return '';
  }
  const branch = normalizeStr(row?.nhanh || row?.branch || '');
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

function parseDateFilterParam(value, { endOfDay = false } = {}) {
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = normalizeStr(raw);
  if (!normalized) {
    return null;
  }
  const iso = toISODate(normalized);
  if (!iso) {
    return null;
  }
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }
  return date.toISOString();
}

function clampPositiveInt(value, { min = 1, max = Number.MAX_SAFE_INTEGER, fallback = 1 } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  const normalized = Math.trunc(numeric);
  if (Number.isNaN(normalized)) {
    return fallback;
  }
  if (normalized < min) {
    return min;
  }
  if (normalized > max) {
    return max;
  }
  return normalized;
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

function inferAuditCategory(action) {
  if (typeof action !== 'string' || !action) {
    return 'khac';
  }
  const normalized = action.trim();
  const separatorIndex = normalized.indexOf('.');
  if (separatorIndex <= 0) {
    return normalized;
  }
  return normalized.slice(0, separatorIndex);
}

function normalizeAuditNote(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const text = `${value}`.trim();
  if (!text) {
    return null;
  }
  return text.normalize('NFC');
}

function pushAuditLog(entry) {
  const payload = {
    ts: new Date().toISOString(),
    actor: entry?.actor || 'system',
    action: entry?.action || 'unknown',
    category: entry?.category || inferAuditCategory(entry?.action || 'unknown'),
    detail: entry?.detail || '',
    result:
      entry?.result === null || entry?.result === undefined
        ? null
        : `${entry.result}`.trim() || null,
    note: normalizeAuditNote(entry?.note),
    meta: entry?.meta ?? null,
  };
  const logs = getJSONValue('audit_logs_v1', []);
  logs.unshift(payload);
  setJSONValue('audit_logs_v1', logs.slice(0, 200));
  return payload;
}

function toNullableString(value, { maxLength = 2048, trim = true } = {}) {
  if (value === null || value === undefined) {
    return null;
  }
  const text = `${value}`;
  const normalized = trim ? text.trim() : text;
  if (!normalized) {
    return null;
  }
  const asNfc = normalized.normalize('NFC');
  if (asNfc.length > maxLength) {
    return asNfc.slice(0, maxLength);
  }
  return asNfc;
}

function stringifyFiltersForAudit(filters) {
  if (filters === null || filters === undefined) {
    return null;
  }
  if (typeof filters === 'string') {
    return toNullableString(filters, { maxLength: 4096, trim: true });
  }
  try {
    const json = JSON.stringify(filters);
    return toNullableString(json, { maxLength: 4096, trim: true });
  } catch {
    return null;
  }
}

function recordReportExportAudit(entry = {}) {
  const createdAt = new Date();
  const roleValue = entry?.role ? normalizeRoleKey(entry.role) : null;
  const payload = {
    created_at: createdAt.toISOString(),
    issued_at: entry?.issuedAt ? toNullableString(entry.issuedAt, { maxLength: 64 }) : null,
    username: toNullableString(entry?.username, { maxLength: 128 }) || 'unknown',
    display_name: toNullableString(entry?.displayName, { maxLength: 256 }),
    role: toNullableString(roleValue, { maxLength: 64 }),
    report_kind: toNullableString(entry?.kind, { maxLength: 128 }) || 'unknown',
    filename: toNullableString(entry?.filename, { maxLength: 512 }),
    signature: toNullableString(entry?.signature, { maxLength: 128 }),
    short_signature: toNullableString(entry?.shortSignature, { maxLength: 64 }),
    filter_summary: toNullableString(entry?.filterSummary, { maxLength: 1024, trim: false }),
    filters: stringifyFiltersForAudit(entry?.filters),
    ip_address: toNullableString(entry?.ipAddress, { maxLength: 128 }),
    request_id: toNullableString(entry?.requestId, { maxLength: 128 }),
    user_agent: toNullableString(entry?.userAgent, { maxLength: 512, trim: false }),
  };

  try {
    db.prepare(
      `INSERT INTO export_audit (
        created_at,
        issued_at,
        username,
        display_name,
        role,
        report_kind,
        filename,
        signature,
        short_signature,
        filter_summary,
        filters,
        ip_address,
        request_id,
        user_agent
      ) VALUES (
        @created_at,
        @issued_at,
        @username,
        @display_name,
        @role,
        @report_kind,
        @filename,
        @signature,
        @short_signature,
        @filter_summary,
        @filters,
        @ip_address,
        @request_id,
        @user_agent
      )`
    ).run(payload);
  } catch (err) {
    console.error('Không thể ghi lịch sử xuất báo cáo', err);
  }

  return payload;
}

function countAdmins(records) {
  return records.filter((record) => normalizeRoleKey(record.role) === ADMIN_ROLE).length;
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
  const role = normalizeRoleKey(payload?.role);
  const name = (payload?.name ?? username).toString().trim();
  const permissions = normalizePermissionsForRole(payload?.permissions, role);
  const rosterInfo = resolveAccountRosterInfo(payload);
  const passwordHash = bcrypt.hashSync(password, PASSWORD_SALT_ROUNDS);
  const updatedAt = new Date().toISOString();
  accounts.push({
    username,
    passwordHash,
    role,
    name,
    permissions,
    updatedAt,
    memberId: rosterInfo.memberId,
    memberName: rosterInfo.memberName,
    teamId: rosterInfo.teamId,
    teamName: rosterInfo.teamName,
  });
  persistAccountRecords(accounts);
  const summaryParts = [`vai trò ${describeRole(role)}`];
  if (rosterInfo.memberId) {
    summaryParts.push(`gắn nhân viên ${formatRosterLabel(rosterInfo)}`);
  }
  const detail = summaryParts.length
    ? `Tạo tài khoản ${username}: ${summaryParts.join('; ')}`
    : `Tạo tài khoản ${username}`;
  pushAuditLog({
    actor,
    action: 'account.create',
    detail,
    meta: {
      username,
      role,
      permissions,
      member: rosterInfo,
    },
  });
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
  const nextRole = normalizeRoleKey(patch?.role ?? current.role);
  const currentRole = normalizeRoleKey(current.role);
  if (currentRole === ADMIN_ROLE && nextRole !== ADMIN_ROLE && countAdmins(accounts) <= 1) {
    throw new Error('Cần ít nhất một quản trị viên');
  }
  const name = (patch?.name ?? current.name ?? current.username).toString().trim();
  const permissions = normalizePermissionsForRole(patch?.permissions ?? current.permissions, nextRole);
  const rosterInfo = resolveAccountRosterInfo(patch, current);
  const updatedAt = new Date().toISOString();
  accounts[index] = {
    ...current,
    role: nextRole,
    name,
    permissions,
    updatedAt,
    memberId: rosterInfo.memberId,
    memberName: rosterInfo.memberName,
    teamId: rosterInfo.teamId,
    teamName: rosterInfo.teamName,
  };
  persistAccountRecords(accounts);

  const permissionDiffs = summarizePermissionChanges(current.permissions, permissions);
  const detailParts = [];
  if (currentRole !== nextRole) {
    detailParts.push(`vai trò ${describeRole(currentRole)} → ${describeRole(nextRole)}`);
  }
  if ((current.name || '') !== name) {
    const before = current.name ? `"${current.name}"` : 'mặc định';
    const after = name ? `"${name}"` : 'mặc định';
    detailParts.push(`tên hiển thị ${before} → ${after}`);
  }
  const previousRoster = {
    memberId: current.memberId ?? null,
    memberName: current.memberName ?? null,
    teamId: current.teamId ?? null,
    teamName: current.teamName ?? null,
  };
  const rosterChanged =
    (previousRoster.memberId || null) !== (rosterInfo.memberId || null) ||
    (previousRoster.teamId || null) !== (rosterInfo.teamId || null);
  if (rosterChanged) {
    detailParts.push(
      `nhân viên KPI ${formatRosterLabel(previousRoster)} → ${formatRosterLabel(rosterInfo)}`
    );
  }
  if (permissionDiffs.length) {
    const summaries = permissionDiffs.map((entry) => describePermissionChange(entry.key, entry.after));
    detailParts.push(`quyền: ${summaries.join(', ')}`);
  }

  const detail = detailParts.length
    ? `Cập nhật tài khoản ${username}: ${detailParts.join('; ')}`
    : `Cập nhật tài khoản ${username}`;

  pushAuditLog({
    actor,
    action: 'account.update',
    detail,
    meta: {
      username,
      previous: {
        role: currentRole,
        name: current.name,
        permissions: current.permissions,
        member: previousRoster,
      },
      current: {
        role: nextRole,
        name,
        permissions,
        member: rosterInfo,
      },
      changes: {
        role: currentRole !== nextRole,
        name: (current.name || '') !== name,
        member: rosterChanged,
        permissions: permissionDiffs,
      },
    },
  });
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
  const updatedAt = new Date().toISOString();
  accounts[index] = { ...accounts[index], passwordHash, updatedAt };
  persistAccountRecords(accounts);
  deleteSessionsForUser(username);
  const target = accounts[index];
  pushAuditLog({
    actor,
    action: 'account.reset_password',
    detail: `Đặt lại mật khẩu cho ${username}`,
    meta: {
      username,
      role: normalizeRoleKey(target.role),
      performedAt: updatedAt,
      member: {
        memberId: target.memberId ?? null,
        memberName: target.memberName ?? null,
        teamId: target.teamId ?? null,
        teamName: target.teamName ?? null,
      },
    },
  });
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
  if (normalizeRoleKey(target.role) === ADMIN_ROLE && countAdmins(accounts) <= 1) {
    throw new Error('Không thể xoá quản trị viên cuối cùng');
  }
  accounts.splice(index, 1);
  persistAccountRecords(accounts);
  deleteSessionsForUser(username);
  const rosterInfo = {
    memberId: target.memberId ?? null,
    memberName: target.memberName ?? null,
    teamId: target.teamId ?? null,
    teamName: target.teamName ?? null,
  };
  const displayName = target.name && target.name !== username ? ` (${target.name})` : '';
  pushAuditLog({
    actor,
    action: 'account.delete',
    detail: `Xóa tài khoản ${username}${displayName}`,
    meta: {
      username,
      role: normalizeRoleKey(target.role),
      member: rosterInfo,
    },
  });
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
  accounts[index] = { ...current, passwordHash, updatedAt: new Date().toISOString() };
  persistAccountRecords(accounts);
  pushAuditLog({ actor: username, action: 'account.change_password', detail: 'Đổi mật khẩu cá nhân' });
  return sanitizeAccountRecord(accounts[index]);
}

function normalizeLogDeclarationList(list, limit = 200) {
  if (!Array.isArray(list) || list.length === 0) {
    return [];
  }
  const normalized = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const soTkFull = (entry.so_tk_full ?? entry.so_tk ?? entry.number ?? '').toString();
    const soTk = normalizeDeclarationNumber(soTkFull || entry.so_tk);
    if (!soTk) {
      continue;
    }
    const branch = normalizeStr(entry.nhanh || entry.branch || '');
    const fields = Array.isArray(entry.fields)
      ? Array.from(new Set(entry.fields.map((f) => String(f || '').trim()).filter(Boolean)))
      : undefined;
    const record = {
      so_tk: soTk,
      so_tk_full: soTkFull || undefined,
      nhanh: branch,
      branch,
      fields: fields && fields.length ? fields : undefined,
    };
    normalized.push(record);
    if (normalized.length >= limit) {
      break;
    }
  }
  return normalized;
}

function pushImportLog(entry, extraMeta = null) {
  const logs = getJSONValue('import_logs_v1', []);
  const timestamp = new Date().toISOString();
  let record;
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    const {
      msg,
      message,
      kind = 'info',
      actor = 'system',
      summary = null,
      meta = null,
      updatedDeclarations = [],
      insertedDeclarations = [],
      lockedDeclarations = [],
    } = entry;
    const normalizedUpdated = normalizeLogDeclarationList(updatedDeclarations);
    const normalizedInserted = normalizeLogDeclarationList(insertedDeclarations);
    const normalizedLocked = normalizeLogDeclarationList(lockedDeclarations);
    record = {
      ts: timestamp,
      kind,
      actor,
      msg: String(message ?? msg ?? ''),
      summary: summary && typeof summary === 'object' ? { ...summary } : summary ?? null,
      meta: meta && typeof meta === 'object' ? { ...meta } : meta ?? null,
      updatedDeclarations: normalizedUpdated.length ? normalizedUpdated : undefined,
      insertedDeclarations: normalizedInserted.length ? normalizedInserted : undefined,
      lockedDeclarations: normalizedLocked.length ? normalizedLocked : undefined,
    };
  } else {
    const meta = extraMeta && typeof extraMeta === 'object' ? { ...extraMeta } : null;
    record = {
      ts: timestamp,
      kind: 'info',
      actor: 'system',
      msg: entry == null ? '' : String(entry),
      meta,
    };
  }
  const cleaned = Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
  logs.unshift(cleaned);
  setJSONValue('import_logs_v1', logs.slice(0, 100));
}

function normalizeDeclRows(rows) {
  const input = Array.isArray(rows) ? rows : [];
  const map = new Map();
  let changed = false;
  let missingIndex = 0;
  for (const entry of input) {
    if (!entry || typeof entry !== 'object') {
      changed = true;
      continue;
    }
    const normalized = normalizeDeclarationRow(entry) || entry;
    if (normalized !== entry) {
      changed = true;
    }
    const key = getDeclarationKey(normalized);
    if (!key) {
      missingIndex += 1;
      map.set(`__missing__${missingIndex}`, normalized);
      continue;
    }
    if (!map.has(key)) {
      map.set(key, normalized);
      continue;
    }
    const existing = map.get(key);
    const { row: mergedRow, changed: mergedChanged } = mergeDeclarationRow(existing, normalized);
    map.set(key, mergedRow);
    if (mergedChanged) {
      changed = true;
    }
  }
  const normalizedRows = Array.from(map.values());
  if (normalizedRows.length !== input.length) {
    changed = true;
  }
  return { normalizedRows, changed };
}

function writeDeclRows(rows) {
  const { normalizedRows, changed } = normalizeDeclRows(rows);
  if (changed) {
    setJSONValue('decl_rows_v1', normalizedRows);
    return normalizedRows;
  }
  setJSONValue('decl_rows_v1', normalizedRows);
  return normalizedRows;
}

function getDeclRows() {
  const rows = getJSONValue('decl_rows_v1', []);
  const { normalizedRows, changed } = normalizeDeclRows(rows);
  if (changed) {
    setJSONValue('decl_rows_v1', normalizedRows);
  }
  return normalizedRows;
}

// eslint-disable-next-line no-unused-vars
function saveDeclRowsServer(newRows, { overwrite = false, actor = 'system', detail = '' } = {}) {
  const cleaned = Array.isArray(newRows) ? newRows : [];
  const normalizedInput = cleaned
    .map((row) => normalizeDeclarationRow(row))
    .filter((row) => row && typeof row === 'object');

  if (overwrite) {
    const stored = writeDeclRows(normalizedInput);
    pushAuditLog({ actor, action: 'decl.overwrite', detail: detail || `Ghi đè ${stored.length} tờ khai` });
    return stored.length;
  }

  const current = getDeclRows();
  const combined = Array.isArray(current)
    ? current.concat(normalizedInput)
    : normalizedInput;
  const { normalizedRows } = normalizeDeclRows(combined);
  writeDeclRows(normalizedRows);
  pushAuditLog({
    actor,
    action: 'decl.merge',
    detail: detail || `Hợp nhất ${normalizedInput.length} tờ khai (tổng ${normalizedRows.length})`,
  });
  return normalizedRows.length;
}

function getRulesValue() {
  return getJSONValue('kpi_rules_v2', SHARED_DEFAULT_RULES);
}

function getRosterValue() {
  return getJSONValue('team_roster_v1', { version: 1, teams: [] });
}

function findRosterMemberById(memberIdInput) {
  const memberId = toNullableString(memberIdInput, { maxLength: 160 });
  if (!memberId) {
    return null;
  }
  const roster = getRosterValue();
  if (!Array.isArray(roster?.teams)) {
    return null;
  }
  for (const team of roster.teams) {
    if (!team || typeof team !== 'object') continue;
    const rawTeamId = toNullableString(team.id, { maxLength: 160 });
    const teamName = toNullableString(team.name, { maxLength: 255 });
    if (!Array.isArray(team.members)) continue;
    for (const member of team.members) {
      if (!member || typeof member !== 'object') continue;
      const normalizedId = toNullableString(member.id, { maxLength: 160 });
      if (normalizedId === memberId) {
        return {
          memberId,
          memberName: toNullableString(member.name, { maxLength: 255 }) ?? null,
          teamId: rawTeamId,
          teamName,
        };
      }
    }
  }
  return null;
}

function resolveAccountRosterInfo(payload, base = {}) {
  const baseInfo = {
    memberId: base?.memberId ?? null,
    memberName: base?.memberName ?? null,
    teamId: base?.teamId ?? null,
    teamName: base?.teamName ?? null,
  };
  if (!payload || typeof payload !== 'object') {
    return baseInfo;
  }
  const hasMemberId = Object.prototype.hasOwnProperty.call(payload, 'memberId');
  const hasMemberName = Object.prototype.hasOwnProperty.call(payload, 'memberName');
  const hasTeamId = Object.prototype.hasOwnProperty.call(payload, 'teamId');
  const hasTeamName = Object.prototype.hasOwnProperty.call(payload, 'teamName');
  if (!hasMemberId && !hasMemberName && !hasTeamId && !hasTeamName) {
    return baseInfo;
  }

  const rawMemberId = hasMemberId ? toNullableString(payload.memberId, { maxLength: 160 }) : baseInfo.memberId;
  if (!rawMemberId) {
    return { memberId: null, memberName: null, teamId: null, teamName: null };
  }

  const rosterMatch = findRosterMemberById(rawMemberId);
  if (rosterMatch) {
    return rosterMatch;
  }

  const memberName = hasMemberName ? toNullableString(payload.memberName, { maxLength: 255 }) : baseInfo.memberName;
  const teamId = hasTeamId ? toNullableString(payload.teamId, { maxLength: 160 }) : baseInfo.teamId;
  const teamName = hasTeamName ? toNullableString(payload.teamName, { maxLength: 255 }) : baseInfo.teamName;

  return {
    memberId: rawMemberId,
    memberName,
    teamId,
    teamName,
  };
}

function formatRosterLabel(info) {
  if (!info || !info.memberId) {
    return 'không gắn nhân viên';
  }
  const name = info.memberName || info.memberId;
  return info.teamName ? `${name} (${info.teamName})` : name;
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

function normalizeLicenseCode(value) {
  const str = normalizeStr(value);
  if (!str) return '';
  return str.toUpperCase();
}

function normalizeAgencyKey(value) {
  let str = normalizeStr(value);
  if (!str) return '';
  let previous = null;
  while (str && str !== previous) {
    previous = str;
    str = str.replace(/^[\s"'([{<]+|[\s"'(){}\]}>]+$/g, '');
    str = normalizeStr(str);
  }
  if (!str) return '';
  return str.toUpperCase();
}

function splitAgencyValues(value) {
  if (Array.isArray(value)) {
    return value.map((part) => normalizeStr(part)).filter(Boolean);
  }
  const str = normalizeStr(value);
  if (!str) return [];
  return str
    .split(/[,;|]/g)
    .map((part) => normalizeStr(part))
    .filter(Boolean);
}

function getHqAgencyEntries() {
  const raw = getJSONValue('hq_agencies_v1', []);
  const rows = Array.isArray(raw) ? raw : [];
  const entries = [];
  for (const row of rows) {
    const mst = normalizeMST(row?.mst);
    if (!mst) continue;
    const company = normalizeStr(row?.company || row?.cong_ty || row?.customer || '');
    const agentRaw =
      row?.agent ??
      row?.agency ??
      row?.dai_ly ??
      row?.dai_ly_hq ??
      row?.['Đại lý HQ'] ??
      row?.['Dai ly HQ'] ??
      '';
    const agentListSet = new Set();
    const normalizedAgentKeys = new Set();
    const pushAgent = (value) => {
      const normalized = normalizeStr(value);
      if (!normalized) return;
      agentListSet.add(normalized);
      const key = normalizeAgencyKey(normalized);
      if (key) {
        normalizedAgentKeys.add(key);
      }
    };
    if (Array.isArray(row?.agents)) {
      for (const value of row.agents) {
        pushAgent(value);
      }
    }
    if (agentRaw) {
      for (const part of splitAgencyValues(agentRaw)) {
        pushAgent(part);
      }
    }
    const agentList = Array.from(agentListSet);
    const agent = agentList.join(', ');
    entries.push({
      mst,
      company,
      agent,
      normalizedAgents: Array.from(normalizedAgentKeys).filter(Boolean),
    });
  }
  return entries;
}

function mapHqAgenciesByMST() {
  const map = new Map();
  for (const entry of getHqAgencyEntries()) {
    if (!entry) continue;
    if (!map.has(entry.mst)) {
      map.set(entry.mst, entry);
    }
  }
  return map;
}

const HQ_HISTORY_MAX_ENTRIES = 500;

function normalizeHqHistoryEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }
  const normalized = [];
  for (const entry of entries) {
    if (!entry) continue;
    const mst = normalizeMST(entry.mst);
    if (!mst) continue;
    const timestamp = new Date(entry.timestamp || entry.changed_at || entry.ts || Date.now());
    if (Number.isNaN(timestamp.getTime())) {
      continue;
    }
    const field = clampLength(normalizeStr(entry.field) || 'field', 64);
    const type = clampLength(normalizeStr(entry.type) || 'update', 32);
    const actor = clampLength(normalizeStr(entry.actor) || 'system', 128);
    const fromValue = clampLength(normalizeStr(entry.from) || '', 255);
    const toValue = clampLength(normalizeStr(entry.to) || '', 255);
    normalized.push({
      id: clampLength(entry.id || `hq-${mst}-${field}-${timestamp.getTime()}`, 120),
      mst,
      field,
      from: fromValue,
      to: toValue,
      actor,
      timestamp,
      type,
    });
  }
  normalized.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return normalized.slice(0, HQ_HISTORY_MAX_ENTRIES);
}

function serializeHqHistoryEntries(entries) {
  return entries.map((entry) => ({
    id: entry.id,
    mst: entry.mst,
    field: entry.field,
    from: entry.from,
    to: entry.to,
    actor: entry.actor,
    timestamp: entry.timestamp.toISOString(),
    type: entry.type,
  }));
}

function listHqHistoryEntries() {
  const rawValue = getValue('hq_history_v1');
  const parsed = safeParse(rawValue, []);
  const normalized = normalizeHqHistoryEntries(parsed);
  const serialized = JSON.stringify(serializeHqHistoryEntries(normalized));
  if (serialized !== rawValue) {
    upsertValue('hq_history_v1', serialized);
  }
  return normalized;
}

function parseHistoryParamList(value, normalizer) {
  if (Array.isArray(value)) {
    return parseHistoryParamList(value[0], normalizer);
  }
  const str = normalizeStr(value);
  if (!str) return [];
  const parts = str
    .split(/[,;|\s]+/g)
    .map((part) => (typeof normalizer === 'function' ? normalizer(part) : part))
    .filter(Boolean);
  return Array.from(new Set(parts));
}

function parseHistoryLowerBound(value) {
  if (Array.isArray(value)) {
    return parseHistoryLowerBound(value[0]);
  }
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function parseHistoryUpperBound(value) {
  if (Array.isArray(value)) {
    return parseHistoryUpperBound(value[0]);
  }
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

function formatHqHistoryEntry(entry) {
  return {
    id: entry.id,
    mst: entry.mst,
    field: entry.field,
    from: entry.from,
    to: entry.to,
    actor: entry.actor,
    timestamp: entry.timestamp.toISOString(),
    type: entry.type,
  };
}

function queryHqHistoryEntries(params = {}) {
  const entries = listHqHistoryEntries();
  let filtered = entries.slice();

  const mstList = parseHistoryParamList(params.mst, normalizeMST);
  if (mstList.length > 0) {
    const mstSet = new Set(mstList);
    filtered = filtered.filter((entry) => mstSet.has(entry.mst));
  }

  const typeList = parseHistoryParamList(params.type, (value) => normalizeStr(value).toLowerCase());
  if (typeList.length > 0) {
    const typeSet = new Set(typeList);
    filtered = filtered.filter((entry) => typeSet.has(entry.type.toLowerCase()));
  }

  const fieldList = parseHistoryParamList(params.field, (value) => normalizeStr(value).toLowerCase());
  if (fieldList.length > 0) {
    const fieldSet = new Set(fieldList);
    filtered = filtered.filter((entry) => fieldSet.has(entry.field.toLowerCase()));
  }

  const actorFilter = normalizeStr(Array.isArray(params.actor) ? params.actor[0] : params.actor).toLowerCase();
  if (actorFilter) {
    filtered = filtered.filter((entry) => entry.actor.toLowerCase() === actorFilter);
  }

  const search = normalizeStr(Array.isArray(params.q) ? params.q[0] : params.q).toLowerCase();
  if (search) {
    filtered = filtered.filter((entry) => {
      return (
        entry.mst.includes(search) ||
        entry.field.toLowerCase().includes(search) ||
        entry.actor.toLowerCase().includes(search) ||
        (entry.from && entry.from.toLowerCase().includes(search)) ||
        (entry.to && entry.to.toLowerCase().includes(search))
      );
    });
  }

  const fromDate = parseHistoryLowerBound(params.from);
  if (fromDate) {
    const fromTs = fromDate.getTime();
    filtered = filtered.filter((entry) => entry.timestamp.getTime() >= fromTs);
  }

  const toDate = parseHistoryUpperBound(params.to);
  if (toDate) {
    const toTs = toDate.getTime();
    filtered = filtered.filter((entry) => entry.timestamp.getTime() <= toTs);
  }

  filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const limitRaw = Number.parseInt(Array.isArray(params.limit) ? params.limit[0] : params.limit, 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, HQ_HISTORY_MAX_ENTRIES) : 100;
  const entriesForClient = filtered.slice(0, limit).map((entry) => formatHqHistoryEntry(entry));

  return {
    total: filtered.length,
    limit,
    entries: entriesForClient,
  };
}

function normalizeCodeList(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return value.split(/[,;|]/g);
  }
  return [];
}

function buildLicenseExcludeContext(rules) {
  const excludeSet = new Set();
  const agencyMap = new Map();

  const globalCodes = normalizeCodeList(rules?.license?.exclude?.codes);
  for (const code of globalCodes) {
    const normalized = normalizeLicenseCode(code);
    if (!normalized) continue;
    excludeSet.add(normalized);
  }

  const agencyEntries = Array.isArray(rules?.license?.exclude?.agencies)
    ? rules.license.exclude.agencies
    : [];
  for (const entry of agencyEntries) {
    if (!entry) continue;
    const agencyKey = normalizeAgencyKey(entry.agency);
    if (!agencyKey) continue;
    const codeList = normalizeCodeList(entry.codes);
    if (!codeList.length) continue;
    const normalizedCodes = codeList
      .map((code) => normalizeLicenseCode(code))
      .filter(Boolean);
    if (!normalizedCodes.length) continue;
    const existing = agencyMap.get(agencyKey) || new Set();
    for (const code of normalizedCodes) {
      existing.add(code);
    }
    agencyMap.set(agencyKey, existing);
  }

  return { excludeSet, agencyMap };
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

function normalizeCronExpression(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return `${value}`.trim();
}

function getBackupConfig() {
  const stored = getJSONValue('db_backup_config_v1', DEFAULT_BACKUP_CONFIG) || {};
  const cronExpr = normalizeCronExpression(stored?.cron);
  const fallbackCron = normalizeCronExpression(DEFAULT_BACKUP_CONFIG.cron);
  const cronValue = cronExpr || fallbackCron || '';
  const hasStoredRetention = Object.prototype.hasOwnProperty.call(stored, 'retentionCopies');
  let retention = null;
  if (hasStoredRetention) {
    if (stored.retentionCopies === null) {
      retention = null;
    } else {
      const normalized = normalizeRetentionCopies(stored.retentionCopies);
      retention = normalized ?? null;
    }
  } else {
    const fallbackRetention = normalizeRetentionCopies(DEFAULT_BACKUP_CONFIG.retentionCopies);
    retention = fallbackRetention ?? null;
  }
  return {
    cron: cronValue,
    retentionCopies: retention,
  };
}

function saveBackupConfig(config) {
  const stored = getJSONValue('db_backup_config_v1', DEFAULT_BACKUP_CONFIG) || {};
  const nextCron = normalizeCronExpression(config?.cron ?? stored?.cron ?? DEFAULT_BACKUP_CONFIG.cron);
  let nextRetention;
  if (config && Object.prototype.hasOwnProperty.call(config, 'retentionCopies')) {
    if (config.retentionCopies === null) {
      nextRetention = null;
    } else {
      nextRetention = normalizeRetentionCopies(config.retentionCopies);
      if (nextRetention === null) {
        nextRetention = null;
      }
    }
  } else if (Object.prototype.hasOwnProperty.call(stored, 'retentionCopies')) {
    if (stored.retentionCopies === null) {
      nextRetention = null;
    } else {
      nextRetention = normalizeRetentionCopies(stored.retentionCopies);
      if (nextRetention === null) {
        nextRetention = null;
      }
    }
  } else {
    nextRetention = normalizeRetentionCopies(DEFAULT_BACKUP_CONFIG.retentionCopies);
    if (nextRetention === null) {
      nextRetention = null;
    }
  }

  setJSONValue('db_backup_config_v1', { cron: nextCron, retentionCopies: nextRetention });
  return getBackupConfig();
}

function describeCronExpression(expression) {
  const cronExpr = normalizeCronExpression(expression);
  if (!cronExpr) {
    return '';
  }
  if (cronExpr.toLowerCase() === 'never') {
    return 'Không chạy tự động';
  }
  if (typeof cron.validate === 'function' && !cron.validate(cronExpr)) {
    return 'Biểu thức cron không hợp lệ';
  }
  try {
    const output = cronstrue.toString(cronExpr, {
      locale: 'vi',
      use24HourTimeFormat: true,
      throwExceptionOnParseError: false,
    });
    if (!output || /lỗi/i.test(output) || /error/i.test(output)) {
      return 'Không thể diễn giải biểu thức cron';
    }
    const parts = cronExpr.split(/\s+/);
    if (parts.length >= 5) {
      const dayOfMonth = parts[2];
      const dayOfWeek = parts[4];
      const isDaily = ['*', '?'].includes(dayOfMonth) && ['*', '?'].includes(dayOfWeek);
      if (isDaily && /^Vào\s+\d{1,2}:\d{2}$/u.test(output)) {
        return `${output} hằng ngày`;
      }
    }
    return output;
  } catch (err) {
    console.warn('Khong the dien giai bieu thuc cron', cronExpr, err);
    return 'Không thể diễn giải biểu thức cron';
  }
}

function getEcusConfig() {
  const stored = getJSONValue('ecus_sync_config_v1', DEFAULT_ECUS_SYNC_CONFIG);
  const connection = {
    ...DEFAULT_ECUS_SYNC_CONFIG.connection,
    ...(stored?.connection || {}),
  };
  connection.options = {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    ...(connection.options || {}),
  };
  const rawColumnMap = {
    ...DEFAULT_ECUS_SYNC_CONFIG.columnMap,
    ...(stored?.columnMap || {}),
  };
  const columnMap = normalizeEcusColumnMap(rawColumnMap);
  const query = normalizeEcusQueryInput(stored?.query);
  const basePreset = resolveSchedulePresetFromConfig(stored);
  let schedule;
  if (basePreset.mode === 'custom') {
    schedule = normalizeCronExpression(stored?.schedule) || normalizeCronExpression(basePreset.cron) || DEFAULT_ECUS_SYNC_CONFIG.schedule;
  } else {
    schedule = buildCronFromPreset(basePreset) || normalizeCronExpression(stored?.schedule) || DEFAULT_ECUS_SYNC_CONFIG.schedule;
  }
  schedule = normalizeCronExpression(schedule) || DEFAULT_ECUS_SYNC_CONFIG.schedule;
  const schedulePreset = {
    ...normalizeSchedulePreset({ ...basePreset, cron: schedule }, basePreset),
    cron: schedule,
  };
  const rangeDaysNumber = Number.parseInt(stored?.rangeDays, 10);
  const rangeDays = Number.isFinite(rangeDaysNumber) && rangeDaysNumber > 0
    ? rangeDaysNumber
    : DEFAULT_ECUS_SYNC_CONFIG.rangeDays;
  const sanitizedStored = {
    ...stored,
    query,
  };
  const includeTaxCodes = normalizeEcusTaxCodeList(stored?.includeTaxCodes ?? DEFAULT_ECUS_SYNC_CONFIG.includeTaxCodes);
  const excludeTaxCodes = normalizeEcusTaxCodeList(stored?.excludeTaxCodes ?? DEFAULT_ECUS_SYNC_CONFIG.excludeTaxCodes);
  return {
    ...DEFAULT_ECUS_SYNC_CONFIG,
    ...sanitizedStored,
    schedule,
    schedulePreset,
    rangeDays,
    preferMonthFirst: !!stored?.preferMonthFirst,
    connection,
    columnMap,
    query,
    includeTaxCodes,
    excludeTaxCodes,
  };
}


function saveEcusConfig(config, { preservePassword = false } = {}) {
  const current = getEcusConfig();
  const connectionPatch = config?.connection || {};
  const nextConnection = {
    ...current.connection,
    ...connectionPatch,
  };
  nextConnection.options = {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    ...(nextConnection.options || {}),
  };
  if (preservePassword && connectionPatch.password === undefined) {
    nextConnection.password = current.connection.password || '';
  } else {
    nextConnection.password = connectionPatch.password ?? '';
  }
  nextConnection.hasPassword = nextConnection.password
    ? true
    : connectionPatch.hasPassword === true || current.connection?.hasPassword === true;

  const rangeDaysNumber = Number.parseInt(config?.rangeDays, 10);
  const nextRangeDays = Number.isFinite(rangeDaysNumber) && rangeDaysNumber > 0
    ? rangeDaysNumber
    : current.rangeDays;

  const schedulePresetInput = config?.schedulePreset ?? {
    mode: config?.scheduleMode,
    value: config?.scheduleValue,
    time: config?.scheduleTime,
    cron: config?.schedule,
  };
  let schedulePreset = normalizeSchedulePreset(schedulePresetInput, current.schedulePreset);
  let schedule;
  if (schedulePreset.mode === 'custom') {
    const customCron = normalizeCronExpression(config?.schedule ?? schedulePreset.cron ?? current.schedule);
    schedule = customCron || current.schedule || DEFAULT_ECUS_SYNC_CONFIG.schedule;
  } else {
    schedule = buildCronFromPreset(schedulePreset) || current.schedule || DEFAULT_ECUS_SYNC_CONFIG.schedule;
  }
  schedule = normalizeCronExpression(schedule) || DEFAULT_ECUS_SYNC_CONFIG.schedule;
  schedulePreset = { ...schedulePreset, cron: schedule };

  const columnMapPatch = config?.columnMap || {};

  const nextConfig = {
    ...current,
    ...config,
    enabled: config?.enabled !== undefined ? !!config.enabled : current.enabled,
    rangeDays: nextRangeDays,
    preferMonthFirst: config?.preferMonthFirst !== undefined ? !!config.preferMonthFirst : current.preferMonthFirst,
    schedule,
    schedulePreset,
    connection: nextConnection,
    columnMap: {
      ...current.columnMap,
      ...columnMapPatch,
    },
  };

  nextConfig.columnMap = normalizeEcusColumnMap(nextConfig.columnMap);
  nextConfig.query = normalizeEcusQueryInput(nextConfig.query);
  const includeProvided = config && Object.prototype.hasOwnProperty.call(config, 'includeTaxCodes');
  const excludeProvided = config && Object.prototype.hasOwnProperty.call(config, 'excludeTaxCodes');
  const nextInclude = includeProvided
    ? normalizeEcusTaxCodeList(config.includeTaxCodes)
    : normalizeEcusTaxCodeList(nextConfig.includeTaxCodes);
  const nextExclude = excludeProvided
    ? normalizeEcusTaxCodeList(config.excludeTaxCodes)
    : normalizeEcusTaxCodeList(nextConfig.excludeTaxCodes);
  nextConfig.includeTaxCodes = nextInclude;
  nextConfig.excludeTaxCodes = nextExclude;

  delete nextConfig.scheduleMode;
  delete nextConfig.scheduleValue;
  delete nextConfig.scheduleTime;
  delete nextConfig.scheduleDescription;

  setJSONValue('ecus_sync_config_v1', nextConfig);
  return nextConfig;
}


function getEcusMonitorAlertOptions() {
  const failureThreshold = Math.max(
    1,
    toPositiveInt(
      process.env.ECUS_ALERT_FAILURE_THRESHOLD || process.env.KPI_ALERT_FAILURE_THRESHOLD,
      DEFAULT_ECUS_MONITOR_ALERT_OPTIONS.failureThreshold
    ) || DEFAULT_ECUS_MONITOR_ALERT_OPTIONS.failureThreshold
  );
  const failureCooldownMinutes = Math.max(
    5,
    toPositiveInt(
      process.env.ECUS_ALERT_FAILURE_COOLDOWN_MINUTES || process.env.KPI_ALERT_FAILURE_COOLDOWN_MINUTES,
      DEFAULT_ECUS_MONITOR_ALERT_OPTIONS.failureCooldownMinutes
    ) || DEFAULT_ECUS_MONITOR_ALERT_OPTIONS.failureCooldownMinutes
  );
  const staleThresholdMinutes = Math.max(
    1,
    toPositiveInt(
      process.env.ECUS_ALERT_STALE_THRESHOLD_MINUTES || process.env.KPI_ALERT_STALE_THRESHOLD_MINUTES,
      DEFAULT_ECUS_MONITOR_ALERT_OPTIONS.staleThresholdMinutes
    ) || DEFAULT_ECUS_MONITOR_ALERT_OPTIONS.staleThresholdMinutes
  );
  const staleCooldownMinutes = Math.max(
    5,
    toPositiveInt(
      process.env.ECUS_ALERT_STALE_COOLDOWN_MINUTES || process.env.KPI_ALERT_STALE_COOLDOWN_MINUTES,
      DEFAULT_ECUS_MONITOR_ALERT_OPTIONS.staleCooldownMinutes
    ) || DEFAULT_ECUS_MONITOR_ALERT_OPTIONS.staleCooldownMinutes
  );
  const dashboardUrl =
    (process.env.ECUS_ALERT_DASHBOARD_URL || process.env.KPI_ALERT_DASHBOARD_URL || '').trim() ||
    DEFAULT_ECUS_MONITOR_ALERT_OPTIONS.dashboardUrl;

  return {
    failureThreshold,
    failureCooldownMinutes,
    staleThresholdMinutes,
    staleCooldownMinutes,
    dashboardUrl,
  };
}

function normalizeIsoTimestamp(value) {
  if (!value) {
    return new Date().toISOString();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return new Date().toISOString();
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    return trimmed;
  }
  const fallback = new Date(value);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toISOString();
  }
  return new Date().toISOString();
}

function getEcusMonitorAlertState() {
  const stored = getJSONValue(ECUS_MONITOR_ALERT_STATE_KEY, DEFAULT_ECUS_MONITOR_ALERT_STATE) || {};
  const merged = { ...DEFAULT_ECUS_MONITOR_ALERT_STATE, ...stored };
  merged.consecutiveErrors = toNonNegativeInt(merged.consecutiveErrors, 0);
  merged.lastDeliveredChannels = Array.isArray(merged.lastDeliveredChannels)
    ? merged.lastDeliveredChannels
        .map((channel) => `${channel}`.trim())
        .filter((channel) => channel.length > 0)
        .slice(-5)
    : [];
  if (merged.lastAlertSummary && typeof merged.lastAlertSummary === 'object') {
    merged.lastAlertSummary = { ...merged.lastAlertSummary };
  } else {
    merged.lastAlertSummary = null;
  }
  return merged;
}

function saveEcusMonitorAlertState(patch, { actor = 'system', source = 'ecus-monitor-alerts' } = {}) {
  const current = getEcusMonitorAlertState();
  const next = { ...current, ...(patch || {}) };
  next.consecutiveErrors = toNonNegativeInt(next.consecutiveErrors, 0);
  next.lastDeliveredChannels = Array.isArray(next.lastDeliveredChannels)
    ? next.lastDeliveredChannels
        .map((channel) => `${channel}`.trim())
        .filter((channel) => channel.length > 0)
        .slice(-5)
    : [];
  if (next.lastAlertSummary && typeof next.lastAlertSummary === 'object') {
    next.lastAlertSummary = { ...next.lastAlertSummary };
  } else {
    next.lastAlertSummary = null;
  }
  setJSONValue(ECUS_MONITOR_ALERT_STATE_KEY, next, { actor, source });
  return next;
}

function recordEcusMonitorSyncSuccess({ runAt, actor = 'system' } = {}) {
  const normalizedAt = normalizeIsoTimestamp(runAt);
  saveEcusMonitorAlertState(
    {
      consecutiveErrors: 0,
      lastSuccessAt: normalizedAt,
      lastErrorMessage: null,
      lastErrorMeta: null,
    },
    { actor, source: 'ecus-monitor-success' }
  );
}

function recordEcusMonitorSyncFailure(error, { actor = 'system', reason = 'unknown' } = {}) {
  const state = getEcusMonitorAlertState();
  const consecutiveErrors = Math.min(999, (state.consecutiveErrors || 0) + 1);
  const messageSource = error?.message || error || 'Đồng bộ ECUS thất bại';
  const message = `${messageSource}`.trim().slice(0, 500) || 'Đồng bộ ECUS thất bại';
  const sanitizedActor = `${actor || 'system'}`.trim().slice(0, 64) || 'system';
  const sanitizedReason = `${reason || 'unknown'}`.trim().slice(0, 64) || 'unknown';
  saveEcusMonitorAlertState(
    {
      consecutiveErrors,
      lastErrorAt: normalizeIsoTimestamp(new Date()),
      lastErrorMessage: message,
      lastErrorMeta: { actor: sanitizedActor, reason: sanitizedReason },
    },
    { actor: sanitizedActor, source: 'ecus-monitor-error' }
  );
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  if (Number.isFinite(num)) {
    return num;
  }
  return null;
}

function sanitizeMonitorHistoryEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const capturedAtRaw = entry.capturedAt || entry.timestamp || entry.generatedAt;
  const capturedAt = normalizeIsoTimestamp(capturedAtRaw || new Date());
  const issues = Array.isArray(entry.issues)
    ? entry.issues
        .map((issue) => `${issue}`.trim())
        .filter((issue) => issue.length > 0)
        .slice(0, 10)
    : [];
  const triggeredAlerts = Array.isArray(entry.triggeredAlerts)
    ? entry.triggeredAlerts
        .map((trigger) => `${trigger}`.trim())
        .filter((trigger) => trigger.length > 0)
        .slice(0, 5)
    : [];

  return {
    version: 1,
    capturedAt,
    severity: `${entry.severity || 'normal'}`.trim() || 'normal',
    syncStatus: entry.syncStatus ? `${entry.syncStatus}`.trim() : null,
    staleMinutes: toNullableNumber(entry.staleMinutes),
    rowsFetched: toNullableNumber(entry.rowsFetched),
    rowsInserted: toNullableNumber(entry.rowsInserted),
    rowsUpdated: toNullableNumber(entry.rowsUpdated),
    rowsSkipped: toNullableNumber(entry.rowsSkipped),
    totalStored: toNullableNumber(entry.totalStored),
    durationMs: toNullableNumber(entry.durationMs),
    runAt: entry.runAt ? normalizeIsoTimestamp(entry.runAt) : null,
    consecutiveErrors: toNonNegativeInt(entry.consecutiveErrors, 0),
    lastErrorMessage: entry.lastErrorMessage ? `${entry.lastErrorMessage}`.trim().slice(0, 500) : null,
    lastSuccessAt: entry.lastSuccessAt ? normalizeIsoTimestamp(entry.lastSuccessAt) : null,
    lastFailureAlertAt: entry.lastFailureAlertAt ? normalizeIsoTimestamp(entry.lastFailureAlertAt) : null,
    lastStaleAlertAt: entry.lastStaleAlertAt ? normalizeIsoTimestamp(entry.lastStaleAlertAt) : null,
    lastAlertDeliveredAt: entry.lastAlertDeliveredAt ? normalizeIsoTimestamp(entry.lastAlertDeliveredAt) : null,
    databaseState: entry.databaseState ? `${entry.databaseState}`.trim().slice(0, 120) : null,
    databaseLatencyMs: toNullableNumber(entry.databaseLatencyMs),
    issues,
    triggeredAlerts,
    actor: entry.actor ? `${entry.actor}`.trim().slice(0, 80) : null,
  };
}

function getEcusMonitorHistory() {
  const stored = getJSONValue(ECUS_MONITOR_HISTORY_KEY, DEFAULT_ECUS_MONITOR_HISTORY) || {};
  const entries = Array.isArray(stored.entries) ? stored.entries : [];
  return {
    version: 1,
    entries: entries
      .map((entry) => sanitizeMonitorHistoryEntry(entry))
      .filter((entry) => entry !== null),
    updatedAt: stored.updatedAt ? normalizeIsoTimestamp(stored.updatedAt) : null,
  };
}

function saveEcusMonitorHistory(state, { actor = 'system', source = 'ecus-monitor-history' } = {}) {
  const payload = {
    version: 1,
    entries: Array.isArray(state.entries) ? state.entries.slice(0) : [],
    updatedAt: state.updatedAt ? normalizeIsoTimestamp(state.updatedAt) : new Date().toISOString(),
  };
  setJSONValue(ECUS_MONITOR_HISTORY_KEY, payload, { actor, source });
  return payload;
}

function clearEcusMonitorHistory({ actor = 'system', source = 'ecus-monitor-history-reset' } = {}) {
  return saveEcusMonitorHistory(
    {
      version: 1,
      entries: [],
      updatedAt: new Date().toISOString(),
    },
    { actor, source }
  );
}

function appendEcusMonitorHistory(snapshot, { actor = 'system', source = 'ecus-monitor-history' } = {}) {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }
  const history = getEcusMonitorHistory();
  const options = DEFAULT_ECUS_MONITOR_HISTORY_OPTIONS;
  const maxEntries = Math.max(1, toPositiveInt(options.maxEntries, 7 * 24 * 4) || 7 * 24 * 4);
  const dedupeMinutes = Math.max(0, toPositiveInt(options.dedupeMinutes, 5) || 0);

  const alertState = snapshot.alertState || {};
  const syncState = snapshot.sync || {};
  const database = snapshot.database || {};
  const entry = sanitizeMonitorHistoryEntry({
    capturedAt: snapshot.generatedAt || new Date().toISOString(),
    severity: snapshot.severity || 'normal',
    syncStatus: syncState.lastStatus || null,
    staleMinutes: syncState.staleMinutes,
    rowsFetched: syncState.rowsFetched ?? syncState.lastSummary?.rowsFetched,
    rowsInserted: syncState.rowsInserted ?? syncState.lastSummary?.rowsInserted,
    rowsUpdated: syncState.rowsUpdated ?? syncState.lastSummary?.rowsUpdated,
    rowsSkipped: syncState.rowsSkipped ?? syncState.lastSummary?.rowsSkipped,
    totalStored: syncState.totalStored ?? syncState.lastSummary?.totalStored,
    runAt: syncState.lastRunAt || null,
    durationMs: syncState.durationMs ?? syncState.lastSummary?.durationMs,
    consecutiveErrors: alertState.consecutiveErrors,
    lastErrorMessage: alertState.lastErrorMessage,
    lastSuccessAt: alertState.lastSuccessAt,
    lastFailureAlertAt: alertState.lastFailureAlertAt,
    lastStaleAlertAt: alertState.lastStaleAlertAt,
    lastAlertDeliveredAt: alertState.lastAlertDeliveredAt,
    databaseState: database.state || (database.ok === false ? 'error' : 'ok'),
    databaseLatencyMs: database.latencyMs ?? database.durationMs,
    issues: snapshot.issues || [],
    triggeredAlerts: snapshot.alertDispatch?.triggered || [],
    actor,
  });

  if (!entry) {
    return null;
  }

  const entries = Array.isArray(history.entries) ? history.entries.slice(0) : [];
  const dedupeMs = dedupeMinutes * 60000;
  const lastEntry = entries[entries.length - 1] || null;
  if (lastEntry && dedupeMs > 0) {
    const lastTime = Date.parse(lastEntry.capturedAt);
    const currentTime = Date.parse(entry.capturedAt);
    if (Number.isFinite(lastTime) && Number.isFinite(currentTime) && currentTime - lastTime <= dedupeMs) {
      const comparableKeys = ['severity', 'syncStatus', 'staleMinutes', 'consecutiveErrors'];
      const isEquivalent = comparableKeys.every((key) => {
        const previousValue = lastEntry[key] ?? null;
        const currentValue = entry[key] ?? null;
        return previousValue === currentValue;
      });
      if (isEquivalent) {
        entries[entries.length - 1] = { ...entry };
      } else {
        entries.push(entry);
      }
    } else {
      entries.push(entry);
    }
  } else {
    entries.push(entry);
  }

  const limitedEntries = entries.slice(-maxEntries);
  const saved = saveEcusMonitorHistory(
    {
      version: 1,
      entries: limitedEntries,
      updatedAt: entry.capturedAt,
    },
    { actor, source }
  );

  return {
    entry,
    totalEntries: saved.entries.length,
  };
}

function summarizeMonitorHistory(entries, { windowMinutes, staleThresholdMinutes } = {}) {
  const now = Date.now();
  const windowMs = Number.isFinite(windowMinutes) ? windowMinutes * 60000 : null;
  const cutoff = windowMs ? now - windowMs : null;
  const filtered = Array.isArray(entries)
    ? entries.filter((entry) => {
        if (!entry || typeof entry !== 'object') return false;
        const ts = Date.parse(entry.capturedAt);
        if (!Number.isFinite(ts)) {
          return false;
        }
        if (cutoff !== null && ts < cutoff) {
          return false;
        }
        return true;
      })
    : [];

  if (filtered.length === 0) {
    return {
      from: cutoff ? new Date(cutoff).toISOString() : null,
      to: new Date(now).toISOString(),
      sampleCount: 0,
      successCount: 0,
      warningCount: 0,
      errorCount: 0,
      averageStaleMinutes: null,
      maxStaleMinutes: null,
      minStaleMinutes: null,
      staleBreaches: 0,
      consecutiveErrorMax: 0,
      lastSuccessAt: null,
      lastWarningAt: null,
      lastErrorAt: null,
    };
  }

  let successCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let staleSum = 0;
  let staleSamples = 0;
  let maxStale = null;
  let minStale = null;
  let staleBreaches = 0;
  let consecutiveErrorMax = 0;
  let currentConsecutiveError = 0;
  let lastSuccessAt = null;
  let lastWarningAt = null;
  let lastErrorAt = null;

  const normalizedThreshold = Number.isFinite(staleThresholdMinutes)
    ? Math.max(0, staleThresholdMinutes)
    : DEFAULT_ECUS_MONITOR_ALERT_OPTIONS.staleThresholdMinutes;

  for (const entry of filtered) {
    const severity = `${entry.severity || ''}`.toLowerCase();
    const status = `${entry.syncStatus || ''}`.toLowerCase();
    const timestamp = Date.parse(entry.capturedAt);
    if (status.startsWith('error') || severity === 'critical') {
      errorCount += 1;
      currentConsecutiveError += 1;
      if (!lastErrorAt || timestamp > Date.parse(lastErrorAt)) {
        lastErrorAt = entry.runAt || entry.capturedAt;
      }
    } else if (severity === 'warning' || status.includes('warning')) {
      warningCount += 1;
      currentConsecutiveError = 0;
      if (!lastWarningAt || timestamp > Date.parse(lastWarningAt)) {
        lastWarningAt = entry.runAt || entry.capturedAt;
      }
    } else {
      successCount += 1;
      currentConsecutiveError = 0;
      if (!lastSuccessAt || timestamp > Date.parse(lastSuccessAt)) {
        lastSuccessAt = entry.runAt || entry.capturedAt;
      }
    }
    if (currentConsecutiveError > consecutiveErrorMax) {
      consecutiveErrorMax = currentConsecutiveError;
    }

    if (entry.staleMinutes !== null && entry.staleMinutes !== undefined) {
      const staleValue = Number(entry.staleMinutes);
      if (Number.isFinite(staleValue)) {
        staleSum += staleValue;
        staleSamples += 1;
        maxStale = maxStale === null ? staleValue : Math.max(maxStale, staleValue);
        minStale = minStale === null ? staleValue : Math.min(minStale, staleValue);
        if (staleValue >= normalizedThreshold) {
          staleBreaches += 1;
        }
      }
    }
  }

  const averageStaleMinutes = staleSamples > 0 ? Number((staleSum / staleSamples).toFixed(2)) : null;

  return {
    from: cutoff ? new Date(cutoff).toISOString() : null,
    to: new Date(now).toISOString(),
    sampleCount: filtered.length,
    successCount,
    warningCount,
    errorCount,
    averageStaleMinutes,
    maxStaleMinutes: maxStale,
    minStaleMinutes: minStale,
    staleBreaches,
    consecutiveErrorMax,
    lastSuccessAt,
    lastWarningAt,
    lastErrorAt,
  };
}

function buildEcusMonitorMetrics({ history } = {}) {
  const effectiveHistory = history || getEcusMonitorHistory();
  const entries = Array.isArray(effectiveHistory.entries) ? effectiveHistory.entries : [];
  const thresholds = getEcusMonitorAlertOptions();
  const windowConfigs = [
    { key: '24h', minutes: 24 * 60 },
    { key: '7d', minutes: 7 * 24 * 60 },
    { key: '30d', minutes: 30 * 24 * 60 },
  ];
  const windows = {};
  for (const config of windowConfigs) {
    windows[config.key] = summarizeMonitorHistory(entries, {
      windowMinutes: config.minutes,
      staleThresholdMinutes: thresholds.staleThresholdMinutes,
    });
  }

  windows.all = summarizeMonitorHistory(entries, {
    windowMinutes: null,
    staleThresholdMinutes: thresholds.staleThresholdMinutes,
  });

  const latest = entries.length ? entries[entries.length - 1] : null;

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      entries: entries.length,
    },
    latest,
    windows,
    thresholds,
  };
}

function buildEcusMonitorSeries(entries, { thresholds } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const latencySeries = [];
  const statusSeries = [];
  const consecutiveSeries = [];
  const rowsInsertedSeries = [];
  const rowsUpdatedSeries = [];
  const rowsFetchedSeries = [];

  const statusMap = {
    success: 1,
    normal: 1,
    warning: 0.5,
    error: 0,
    critical: 0,
  };

  for (const entry of list) {
    const timestamp = Date.parse(entry.capturedAt);
    if (!Number.isFinite(timestamp)) {
      continue;
    }
    if (entry.staleMinutes !== null && entry.staleMinutes !== undefined) {
      const value = Number(entry.staleMinutes);
      if (Number.isFinite(value)) {
        latencySeries.push([value, timestamp]);
      }
    }
    const severity = `${entry.severity || ''}`.toLowerCase();
    const status = `${entry.syncStatus || ''}`.toLowerCase();
    const statusKey = status.startsWith('error')
      ? 'error'
      : severity === 'critical'
      ? 'critical'
      : severity === 'warning' || status.includes('warning')
      ? 'warning'
      : 'success';
    statusSeries.push([statusMap[statusKey] ?? 0, timestamp]);

    const consecutive = Number(entry.consecutiveErrors);
    if (Number.isFinite(consecutive)) {
      consecutiveSeries.push([consecutive, timestamp]);
    }

    const rowsInserted = toNullableNumber(entry.rowsInserted);
    if (rowsInserted !== null) {
      rowsInsertedSeries.push([rowsInserted, timestamp]);
    }

    const rowsUpdated = toNullableNumber(entry.rowsUpdated);
    if (rowsUpdated !== null) {
      rowsUpdatedSeries.push([rowsUpdated, timestamp]);
    }

    const rowsFetched = toNullableNumber(entry.rowsFetched);
    if (rowsFetched !== null) {
      rowsFetchedSeries.push([rowsFetched, timestamp]);
    }
  }

  const result = [];
  if (latencySeries.length) {
    result.push({
      name: 'ecus_sync_stale_minutes',
      unit: 'minutes',
      thresholds: {
        warning: thresholds?.staleThresholdMinutes || DEFAULT_ECUS_MONITOR_ALERT_OPTIONS.staleThresholdMinutes,
      },
      datapoints: latencySeries,
    });
  }
  if (statusSeries.length) {
    result.push({
      name: 'ecus_sync_status',
      unit: 'ratio',
      legend: {
        success: 1,
        warning: 0.5,
        error: 0,
      },
      datapoints: statusSeries,
    });
  }
  if (consecutiveSeries.length) {
    result.push({
      name: 'ecus_sync_consecutive_errors',
      unit: 'count',
      datapoints: consecutiveSeries,
    });
  }
  if (rowsInsertedSeries.length) {
    result.push({
      name: 'ecus_sync_rows_inserted',
      unit: 'rows',
      datapoints: rowsInsertedSeries,
    });
  }
  if (rowsUpdatedSeries.length) {
    result.push({
      name: 'ecus_sync_rows_updated',
      unit: 'rows',
      datapoints: rowsUpdatedSeries,
    });
  }
  if (rowsFetchedSeries.length) {
    result.push({
      name: 'ecus_sync_rows_fetched',
      unit: 'rows',
      datapoints: rowsFetchedSeries,
    });
  }

  return result;
}


function formatEcusConfigForClient(config) {
  const source = config || getEcusConfig();
  const connection = { ...source.connection };
  const derivedPreset = deriveSchedulePreset(source.schedule, source.schedulePreset);
  const schedulePreset = {
    ...normalizeSchedulePreset(source.schedulePreset || derivedPreset, derivedPreset),
  };
  schedulePreset.cron = normalizeCronExpression(schedulePreset.cron || source.schedule);
  const scheduleDescription = describeCronExpression(source.schedule);
  const result = {
    ...source,
    connection,
    schedulePreset,
    scheduleMode: schedulePreset.mode,
    scheduleValue: schedulePreset.value,
    scheduleTime: schedulePreset.time,
    scheduleDescription,
  };
  connection.hasPassword = connection.password
    ? true
    : connection.hasPassword === true || source.connection?.hasPassword === true;
  connection.password = '';
  result.includeTaxCodes = Array.isArray(source.includeTaxCodes)
    ? [...source.includeTaxCodes]
    : [];
  result.excludeTaxCodes = Array.isArray(source.excludeTaxCodes)
    ? [...source.excludeTaxCodes]
    : [];
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

function normalizeCodeListForConfig(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  const set = new Set();
  for (const item of list) {
    const normalized = normalizeStr(item).toUpperCase();
    if (!normalized) continue;
    set.add(normalized);
  }
  return Array.from(set);
}

function getCoCodeConfig() {
  const stored = getJSONValue('co_tax_code_config_v1', DEFAULT_CO_CODE_CONFIG);
  const whitelist = normalizeCodeListForConfig(stored?.whitelist);
  const blacklist = normalizeCodeListForConfig(stored?.blacklist);
  return {
    version: Number.isInteger(stored?.version) ? stored.version : DEFAULT_CO_CODE_CONFIG.version,
    whitelist,
    blacklist,
    updatedAt: stored?.updatedAt || null,
    updatedBy: stored?.updatedBy || null,
  };
}

function applyCoCodeConfig(config) {
  setPreferentialCodeConfig({
    whitelist: Array.isArray(config?.whitelist) ? config.whitelist : [],
    blacklist: Array.isArray(config?.blacklist) ? config.blacklist : [],
  });
}

function saveCoCodeConfig(input, { actor = 'system' } = {}) {
  const current = getCoCodeConfig();
  const hasWhitelist = Object.prototype.hasOwnProperty.call(input || {}, 'whitelist');
  const hasBlacklist = Object.prototype.hasOwnProperty.call(input || {}, 'blacklist');
  const whitelist = hasWhitelist ? normalizeCodeListForConfig(input?.whitelist) : current.whitelist;
  const blacklist = hasBlacklist ? normalizeCodeListForConfig(input?.blacklist) : current.blacklist;
  const next = {
    version: Number.isInteger(current.version) ? current.version : 1,
    whitelist,
    blacklist,
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  };
  setJSONValue('co_tax_code_config_v1', next);
  applyCoCodeConfig(next);
  return next;
}

function normalizeInteger(value, fallback, { min = Number.NEGATIVE_INFINITY } = {}) {
  const parsed = Number.isFinite(Number(value)) ? Math.floor(Number(value)) : null;
  if (parsed === null) {
    return fallback;
  }
  return parsed < min ? min : parsed;
}

function getCoDiscrepancyConfig() {
  const stored = getJSONValue('co_discrepancy_config_v1', DEFAULT_CO_DISCREPANCY_CONFIG);
  const enabled = stored?.enabled === true;
  const cronExpr = typeof stored?.cron === 'string' && stored.cron.trim()
    ? stored.cron.trim()
    : DEFAULT_CO_DISCREPANCY_CONFIG.cron;
  const rangeDays = normalizeInteger(stored?.rangeDays, DEFAULT_CO_DISCREPANCY_CONFIG.rangeDays, { min: 1 });
  const threshold = normalizeInteger(stored?.threshold, DEFAULT_CO_DISCREPANCY_CONFIG.threshold, { min: 1 });
  const sampleLimit = normalizeInteger(stored?.sampleLimit, DEFAULT_CO_DISCREPANCY_CONFIG.sampleLimit, { min: 0 });
  return {
    enabled,
    cron: cronExpr,
    rangeDays,
    threshold,
    sampleLimit,
    updatedAt: stored?.updatedAt || null,
    updatedBy: stored?.updatedBy || null,
  };
}

function saveCoDiscrepancyConfig(input, { actor = 'system' } = {}) {
  const current = getCoDiscrepancyConfig();
  const enabled = input?.enabled === true;
  const cronExpr = typeof input?.cron === 'string' && input.cron.trim()
    ? input.cron.trim()
    : current.cron;
  const rangeDays = normalizeInteger(input?.rangeDays, current.rangeDays, { min: 1 });
  const threshold = normalizeInteger(input?.threshold, current.threshold, { min: 1 });
  const sampleLimit = normalizeInteger(input?.sampleLimit, current.sampleLimit, { min: 0 });
  const next = {
    enabled,
    cron: cronExpr,
    rangeDays,
    threshold,
    sampleLimit,
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  };
  setJSONValue('co_discrepancy_config_v1', next);
  return next;
}

function getCoDiscrepancyState() {
  const stored = getJSONValue('co_discrepancy_state_v1', DEFAULT_CO_DISCREPANCY_STATE);
  const mismatches = Array.isArray(stored?.mismatches) ? stored.mismatches : [];
  return {
    ...DEFAULT_CO_DISCREPANCY_STATE,
    ...stored,
    mismatches,
  };
}

function saveCoDiscrepancyState(state) {
  const mismatches = Array.isArray(state?.mismatches)
    ? state.mismatches.slice(0, 200)
    : [];
  const range = state?.range && typeof state.range === 'object'
    ? {
        from: String(state.range.from || ''),
        to: String(state.range.to || ''),
      }
    : null;
  const next = {
    ...DEFAULT_CO_DISCREPANCY_STATE,
    ...state,
    mismatches,
    range,
    status: typeof state?.status === 'string' ? state.status : DEFAULT_CO_DISCREPANCY_STATE.status,
  };
  setJSONValue('co_discrepancy_state_v1', next);
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
    writeDeclRows(nextRows);
    pushAuditLog({
      actor,
      action: 'decl.review',
      detail: `Đánh dấu đã rà soát ${updatedCount} tờ khai`,
      meta: { keys: Array.from(keySet) },
    });
    pushNotification({
      type: 'import.alerts.reviewed',
      severity: 'info',
      title: 'Đánh dấu đã rà soát tờ khai',
      message: `Đã cập nhật trạng thái cho ${updatedCount} tờ khai.`,
      meta: { actor, count: updatedCount },
    });
  }
  return updatedCount;
}

function unmarkDeclarationsReviewed(keys, { actor = 'system' } = {}) {
  if (!Array.isArray(keys) || keys.length === 0) return 0;
  const keySet = new Set(keys);
  let updatedCount = 0;
  const nextRows = getDeclRows().map((row) => {
    const key = getDeclarationKey(row);
    if (!keySet.has(key)) return row;
    if (!row?.reviewed) return row;
    updatedCount += 1;
    const next = { ...row };
    delete next.reviewed;
    delete next.reviewed_at;
    delete next.reviewed_by;
    return next;
  });
  if (updatedCount > 0) {
    writeDeclRows(nextRows);
    pushAuditLog({
      actor,
      action: 'decl.unreview',
      detail: `Bo danh dau da ra soat ${updatedCount} to khai`,
      meta: { keys: Array.from(keySet) },
    });
    pushNotification({
      type: 'import.alerts.unreviewed',
      severity: 'info',
      title: 'Bo danh dau da ra soat',
      message: `Da bo khoa ${updatedCount} to khai.`,
      meta: { actor, count: updatedCount },
    });
  }
  return updatedCount;
}

function evaluateDeclarationAlerts({ actor = 'system', reason = 'auto' } = {}) {
  const config = getAlertConfig();
  const state = getAlertState();
  const previousOutstanding = Object.values(state.entries || {}).filter(
    (entry) => entry && entry.resolved !== true
  ).length;
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
  const summary = { total: rows.length, outstanding, triggered };

  if (triggered > 0) {
    pushNotification({
      type: 'import.alerts.triggered',
      severity: 'warning',
      title: `${triggered} cảnh báo dữ liệu tờ khai`,
      message: `Có ${triggered} tờ khai thiếu thông tin cần xử lý (${reason}).`,
      meta: {
        actor,
        reason,
        triggered,
        outstanding,
      },
    });
  } else if (previousOutstanding > 0 && outstanding === 0) {
    pushNotification({
      type: 'import.alerts.cleared',
      severity: 'success',
      title: 'Đã xử lý toàn bộ cảnh báo tờ khai',
      message: 'Tất cả cảnh báo thiếu thông tin đã được giải quyết.',
      meta: { actor, reason },
    });
  }

  return summary;
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

function resolveRowTimestamp(row) {
  const candidates = [
    row?.updatedAt,
    row?.updated_at,
    row?.syncedAt,
    row?.synced_at,
    row?.importedAt,
    row?.imported_at,
    row?.savedAt,
    row?.saved_at,
    row?.cacheUpdatedAt,
    row?.cache_updated_at,
    row?.date,
    row?.raw_date,
  ];
  for (const value of candidates) {
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return { ts: date.getTime(), iso: date.toISOString() };
    }
  }
  return { ts: 0, iso: null };
}

function describeDuplicateRow(row) {
  const timestamp = resolveRowTimestamp(row);
  return {
    so_tk: row?.so_tk || '',
    so_tk_full: row?.so_tk_full || row?.so_tk || '',
    branch: normalizeStr(row?.nhanh || row?.branch || ''),
    mst: normalizeStr(row?.mst || ''),
    company: normalizeStr(row?.cong_ty || ''),
    staff: normalizeStr(row?.nhan_vien || ''),
    team: normalizeStr(row?.team || ''),
    source: normalizeStr(row?.source || row?.origin || row?._source || ''),
    updatedAt: timestamp.iso,
  };
}

function normalizeDuplicateSourceKey(value) {
  const normalized = normalizeStr(value || '');
  if (normalized) {
    return normalized;
  }
  return 'Không xác định';
}

function summarizeDuplicateGroups(rows, options = {}) {
  const now = Date.now();
  const lockedSourceInput =
    options?.lockedSources && typeof options.lockedSources === 'object' ? options.lockedSources : {};
  const lockedSourceMap = new Map();
  for (const [sourceKey, meta] of Object.entries(lockedSourceInput)) {
    const normalizedKey = normalizeDuplicateSourceKey(sourceKey);
    lockedSourceMap.set(normalizedKey, { ...meta });
  }

  const map = new Map();
  for (const row of rows) {
    const normalized = normalizeDeclarationNumber(row?.so_tk ?? row?.so_tk_full ?? '');
    if (!normalized) {
      continue;
    }
    const prefix = normalized.slice(0, 11);
    if (!prefix) {
      continue;
    }
    const branch = normalizeStr(row?.nhanh || row?.branch || '');
    const key = `${prefix}_${branch}`;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push({ row, timestamp: resolveRowTimestamp(row) });
  }

  const groups = [];
  const sourceStatsMap = new Map();
  const statusCounts = {
    awaitingAction: 0,
    pendingReview: 0,
    locked: 0,
  };
  let duplicateRows = 0;

  for (const [key, entries] of map.entries()) {
    if (!entries || entries.length <= 1) {
      continue;
    }
    const sorted = entries
      .slice()
      .sort((a, b) => (b.timestamp.ts || 0) - (a.timestamp.ts || 0));
    const keeper = describeDuplicateRow(sorted[0]?.row || {});
    const duplicates = sorted.slice(1).map((item) => describeDuplicateRow(item.row));
    duplicateRows += duplicates.length;

    const oldest = sorted[sorted.length - 1]?.timestamp || { ts: 0, iso: null };
    const latest = sorted[0]?.timestamp || { ts: 0, iso: null };
    const ageDays = oldest.ts ? Math.max(0, Math.floor((now - oldest.ts) / (24 * 60 * 60 * 1000))) : 0;

    const reviewEntries = entries.filter((entry) => entry.row?.duplicate_review_pending);
    let reviewMeta = null;
    if (reviewEntries.length > 0) {
      const candidates = reviewEntries
        .map((entry) => {
          const updatedRaw = entry.row?.duplicate_review_updated_at;
          const updatedDate = updatedRaw ? new Date(updatedRaw) : null;
          const updatedValid = updatedDate && !Number.isNaN(updatedDate.getTime());
          const baseTimestamp = resolveRowTimestamp(entry.row);
          const ts = updatedValid ? updatedDate.getTime() : baseTimestamp.ts;
          const iso = updatedValid ? updatedDate.toISOString() : baseTimestamp.iso;
          return {
            ts,
            iso,
            note: (entry.row?.duplicate_review_note ?? '').toString(),
            actor: (entry.row?.duplicate_review_actor ?? '').toString(),
          };
        })
        .filter((item) => Number.isFinite(item.ts))
        .sort((a, b) => a.ts - b.ts);
      if (candidates.length > 0) {
        const chosen = candidates[0];
        reviewMeta = {
          ts: chosen.ts,
          updatedAt: chosen.iso,
          note: normalizeStr(chosen.note),
          actor: normalizeStr(chosen.actor),
        };
      }
    }

    const sources = new Set();
    for (const entry of entries) {
      sources.add(normalizeDuplicateSourceKey(entry.row?.source ?? entry.row?.origin ?? entry.row?._source));
    }
    if (sources.size === 0) {
      sources.add('Không xác định');
    }
    const lockedSources = Array.from(sources).filter((source) => lockedSourceMap.has(source));
    const baseStatus = reviewMeta ? 'pending_review' : 'awaiting_action';
    const status = lockedSources.length > 0 ? 'locked' : baseStatus;
    if (status === 'pending_review') {
      statusCounts.pendingReview += 1;
    } else if (status === 'awaiting_action') {
      statusCounts.awaitingAction += 1;
    } else if (status === 'locked') {
      statusCounts.locked += 1;
    }

    const pendingReference = reviewMeta
      ? { ts: reviewMeta.ts, iso: reviewMeta.updatedAt }
      : oldest;

    const reviewPayload = reviewMeta
      ? {
          pending: true,
          updatedAt: reviewMeta.updatedAt,
          actor: reviewMeta.actor || null,
          note: reviewMeta.note || '',
        }
      : {
          pending: false,
          updatedAt: null,
          actor: null,
          note: '',
        };

    const groupPayload = {
      key,
      prefix: key.split('_')[0],
      branch: key.split('_')[1] || '',
      total: entries.length,
      keep: keeper,
      duplicates,
      latestUpdatedAt: keeper.updatedAt,
      latestUpdatedAtTs: latest.ts || null,
      oldestUpdatedAt: oldest.iso,
      oldestUpdatedAtTs: oldest.ts || null,
      ageDays,
      status,
      baseStatus,
      review: reviewPayload,
      sources: Array.from(sources),
      lockedSources,
      pendingSince: pendingReference?.iso || null,
      pendingSinceTs: pendingReference?.ts ?? null,
    };
    groups.push(groupPayload);

    for (const source of sources) {
      if (!sourceStatsMap.has(source)) {
        sourceStatsMap.set(source, {
          source,
          totalGroups: 0,
          awaitingActionGroups: 0,
          pendingReviewGroups: 0,
          lockedGroups: 0,
          totalRows: 0,
          latestActivity: null,
          oldestPendingAt: null,
          locked: false,
          lockedAt: null,
          lockedReason: '',
        });
      }
      const stats = sourceStatsMap.get(source);
      stats.totalGroups += 1;
      stats.totalRows += entries.length;
      if (baseStatus === 'awaiting_action') {
        stats.awaitingActionGroups += 1;
      }
      if (baseStatus === 'pending_review') {
        stats.pendingReviewGroups += 1;
      }
      if (status === 'locked') {
        stats.lockedGroups += 1;
      }
      if (latest.ts && (!stats.latestActivity || new Date(stats.latestActivity).getTime() < latest.ts)) {
        stats.latestActivity = latest.iso;
      }
      const candidatePending = pendingReference?.ts || null;
      if (
        candidatePending &&
        (!stats.oldestPendingAt || new Date(stats.oldestPendingAt).getTime() > candidatePending)
      ) {
        stats.oldestPendingAt = new Date(candidatePending).toISOString();
      }
      const lockedMeta = lockedSourceMap.get(source);
      if (lockedMeta) {
        stats.locked = true;
        stats.lockedAt = lockedMeta.lockedAt || lockedMeta.updatedAt || null;
        stats.lockedReason = lockedMeta.reason || lockedMeta.note || '';
      }
    }
  }

  const sortedGroups = groups
    .slice()
    .sort((a, b) => {
      if (b.total !== a.total) {
        return b.total - a.total;
      }
      const timeA = a.latestUpdatedAtTs || 0;
      const timeB = b.latestUpdatedAtTs || 0;
      return timeB - timeA;
    });

  const sourceBreakdown = Array.from(sourceStatsMap.values()).sort((a, b) => {
    if (b.totalGroups !== a.totalGroups) {
      return b.totalGroups - a.totalGroups;
    }
    const latestA = a.latestActivity ? new Date(a.latestActivity).getTime() : 0;
    const latestB = b.latestActivity ? new Date(b.latestActivity).getTime() : 0;
    return latestB - latestA;
  });

  return {
    totalGroups: map.size,
    duplicateGroups: groups.length,
    duplicateRows,
    groups: sortedGroups,
    statusCounts,
    sourceBreakdown,
  };
}

function getDuplicatePolicyConfig() {
  const stored = getJSONValue('duplicate_policy_config_v1', DEFAULT_DUPLICATE_POLICY_CONFIG) || {};
  const base = DEFAULT_DUPLICATE_POLICY_CONFIG;
  const autoNotifyAfterDays = toNonNegativeInt(stored.autoNotifyAfterDays, base.autoNotifyAfterDays);
  const notifyCooldownHours = toPositiveInt(stored.notifyCooldownHours, base.notifyCooldownHours);
  const evaluationWindowDays = toPositiveInt(stored.evaluationWindowDays, base.evaluationWindowDays);
  const autoLockAfterGroups = toPositiveInt(stored.autoLockAfterGroups, base.autoLockAfterGroups);
  const minGroupSizeForLock = toPositiveInt(stored.minGroupSizeForLock, base.minGroupSizeForLock);
  const autoUnlockAfterDays = toNonNegativeInt(stored.autoUnlockAfterDays, base.autoUnlockAfterDays);
  let autoLockEnabled;
  if (stored.autoLockEnabled === true) {
    autoLockEnabled = true;
  } else if (stored.autoLockEnabled === false) {
    autoLockEnabled = false;
  } else {
    autoLockEnabled = base.autoLockEnabled;
  }
  return {
    autoNotifyAfterDays,
    notifyCooldownHours,
    evaluationWindowDays,
    autoLockEnabled,
    autoLockAfterGroups,
    minGroupSizeForLock,
    autoUnlockAfterDays,
  };
}

function saveDuplicatePolicyConfig(input, { actor = 'system' } = {}) {
  const current = getDuplicatePolicyConfig();
  const next = {
    autoNotifyAfterDays: toNonNegativeInt(input?.autoNotifyAfterDays, current.autoNotifyAfterDays),
    notifyCooldownHours: toPositiveInt(input?.notifyCooldownHours, current.notifyCooldownHours),
    evaluationWindowDays: toPositiveInt(input?.evaluationWindowDays, current.evaluationWindowDays),
    autoLockEnabled:
      input?.autoLockEnabled === true
        ? true
        : input?.autoLockEnabled === false
        ? false
        : current.autoLockEnabled,
    autoLockAfterGroups: toPositiveInt(input?.autoLockAfterGroups, current.autoLockAfterGroups),
    minGroupSizeForLock: toPositiveInt(input?.minGroupSizeForLock, current.minGroupSizeForLock),
    autoUnlockAfterDays: toNonNegativeInt(input?.autoUnlockAfterDays, current.autoUnlockAfterDays),
  };
  setJSONValue('duplicate_policy_config_v1', next, { actor, source: 'duplicate-policy-config' });
  return next;
}

function getDuplicatePolicyState() {
  const stored = getJSONValue('duplicate_policy_state_v1', DEFAULT_DUPLICATE_POLICY_STATE) || {};
  const notifiedGroups =
    stored?.notifiedGroups && typeof stored.notifiedGroups === 'object' ? { ...stored.notifiedGroups } : {};
  const sanitizedNotified = {};
  for (const [key, value] of Object.entries(notifiedGroups)) {
    if (!key) continue;
    if (!value) continue;
    sanitizedNotified[key] = value;
  }

  const lockedSourcesRaw =
    stored?.lockedSources && typeof stored.lockedSources === 'object' ? stored.lockedSources : {};
  const lockedSources = {};
  for (const [sourceKey, meta] of Object.entries(lockedSourcesRaw)) {
    if (!meta || typeof meta !== 'object') {
      continue;
    }
    const normalizedKey = normalizeDuplicateSourceKey(sourceKey);
    lockedSources[normalizedKey] = {
      lockedAt: meta.lockedAt || null,
      lockedBy: meta.lockedBy || null,
      reason: meta.reason || meta.note || '',
      note: meta.note || '',
      auto: meta.auto === true,
      manual: meta.manual === true,
      unlockedAt: meta.unlockedAt || null,
      unlockedBy: meta.unlockedBy || null,
    };
  }

  return {
    lastEvaluatedAt: stored?.lastEvaluatedAt || null,
    notifiedGroups: sanitizedNotified,
    lockedSources,
  };
}

function saveDuplicatePolicyState(state, { actor = 'system', source = 'duplicate-policy-state' } = {}) {
  const notifiedGroups =
    state?.notifiedGroups && typeof state.notifiedGroups === 'object' ? state.notifiedGroups : {};
  const sanitizedNotified = {};
  for (const [key, value] of Object.entries(notifiedGroups)) {
    if (!key) continue;
    if (!value) continue;
    sanitizedNotified[key] = value;
  }

  const lockedSources = {};
  if (state?.lockedSources && typeof state.lockedSources === 'object') {
    for (const [sourceKey, meta] of Object.entries(state.lockedSources)) {
      if (!meta || typeof meta !== 'object') {
        continue;
      }
      const normalizedKey = normalizeDuplicateSourceKey(sourceKey);
      lockedSources[normalizedKey] = {
        lockedAt: meta.lockedAt || null,
        lockedBy: meta.lockedBy || null,
        reason: meta.reason || meta.note || '',
        note: meta.note || '',
        auto: meta.auto === true,
        manual: meta.manual === true,
        unlockedAt: meta.unlockedAt || null,
        unlockedBy: meta.unlockedBy || null,
      };
    }
  }

  const payload = {
    lastEvaluatedAt: state?.lastEvaluatedAt || null,
    notifiedGroups: sanitizedNotified,
    lockedSources,
  };
  setJSONValue('duplicate_policy_state_v1', payload, { actor, source });
  return payload;
}

function evaluateDuplicatePolicies({
  summary,
  config,
  state,
  actor = 'system',
  force = false,
} = {}) {
  const effectiveConfig = config || getDuplicatePolicyConfig();
  const currentState = state || getDuplicatePolicyState();
  const now = Date.now();
  const isoNow = new Date(now).toISOString();
  const currentNotified = { ...(currentState.notifiedGroups || {}) };
  const currentLockedSources = { ...(currentState.lockedSources || {}) };
  const groupSummary = summary || summarizeDuplicateGroups(getDeclRows(), { lockedSources: currentLockedSources });
  const groupKeys = new Set(groupSummary.groups.map((group) => group.key));

  const autoNotifyAfterDays = toNonNegativeInt(
    effectiveConfig.autoNotifyAfterDays,
    DEFAULT_DUPLICATE_POLICY_CONFIG.autoNotifyAfterDays
  );
  const notifyCooldownHours = toPositiveInt(
    effectiveConfig.notifyCooldownHours,
    DEFAULT_DUPLICATE_POLICY_CONFIG.notifyCooldownHours
  );
  const notifyCooldownMs = Math.max(1, notifyCooldownHours) * 60 * 60 * 1000;

  let stateChanged = false;
  let lockedChanged = false;
  const triggered = {
    overdue: [],
    locks: [],
    unlocks: [],
  };

  if (autoNotifyAfterDays > 0) {
    const thresholdMs = autoNotifyAfterDays * 24 * 60 * 60 * 1000;
    for (const group of groupSummary.groups) {
      if (!group?.key) continue;
      const baseStatus = group.baseStatus || group.status;
      if (!['awaiting_action', 'pending_review'].includes(baseStatus)) {
        continue;
      }
      const referenceTs = group.pendingSinceTs || group.oldestUpdatedAtTs || group.latestUpdatedAtTs || 0;
      if (!referenceTs) continue;
      if (now - referenceTs < thresholdMs) {
        continue;
      }
      const lastNotified = currentNotified[group.key]
        ? new Date(currentNotified[group.key]).getTime()
        : 0;
      if (!force && lastNotified && now - lastNotified < notifyCooldownMs) {
        continue;
      }
      currentNotified[group.key] = isoNow;
      stateChanged = true;
      triggered.overdue.push({
        groupKey: group.key,
        ageDays: group.ageDays,
        status: baseStatus,
        sources: group.sources,
      });
      pushNotification({
        type: 'duplicate.policy.overdue',
        severity: 'warning',
        title: 'Nhóm trùng 11 số tồn đọng',
        message: `Nhóm ${group.prefix} (${group.total} bản ghi) đã tồn tại ${group.ageDays} ngày chưa xử lý.`,
        meta: {
          groupKey: group.key,
          ageDays: group.ageDays,
          status: baseStatus,
          sources: group.sources,
        },
      });
    }
  }

  for (const key of Object.keys(currentNotified)) {
    if (!groupKeys.has(key)) {
      delete currentNotified[key];
      stateChanged = true;
    }
  }

  if (effectiveConfig.autoLockEnabled) {
    const evaluationWindowDays = toPositiveInt(
      effectiveConfig.evaluationWindowDays,
      DEFAULT_DUPLICATE_POLICY_CONFIG.evaluationWindowDays
    );
    const evaluationWindowMs = evaluationWindowDays * 24 * 60 * 60 * 1000;
    const autoLockAfterGroups = toPositiveInt(
      effectiveConfig.autoLockAfterGroups,
      DEFAULT_DUPLICATE_POLICY_CONFIG.autoLockAfterGroups
    );
    const minGroupSizeForLock = toPositiveInt(
      effectiveConfig.minGroupSizeForLock,
      DEFAULT_DUPLICATE_POLICY_CONFIG.minGroupSizeForLock
    );
    const autoUnlockAfterDays = toNonNegativeInt(
      effectiveConfig.autoUnlockAfterDays,
      DEFAULT_DUPLICATE_POLICY_CONFIG.autoUnlockAfterDays
    );
    const autoUnlockMs = autoUnlockAfterDays > 0 ? autoUnlockAfterDays * 24 * 60 * 60 * 1000 : null;

    const counters = new Map();
    for (const group of groupSummary.groups) {
      if (!group?.sources) continue;
      if (group.total < minGroupSizeForLock) continue;
      const newestTs = group.latestUpdatedAtTs || group.oldestUpdatedAtTs || 0;
      if (evaluationWindowMs > 0 && newestTs && now - newestTs > evaluationWindowMs) {
        continue;
      }
      for (const sourceRaw of group.sources) {
        const source = normalizeDuplicateSourceKey(sourceRaw);
        if (!counters.has(source)) {
          counters.set(source, { awaiting: 0, pendingReview: 0, total: 0 });
        }
        const bucket = counters.get(source);
        bucket.total += 1;
        if ((group.baseStatus || group.status) === 'awaiting_action') {
          bucket.awaiting += 1;
        }
        if ((group.baseStatus || group.status) === 'pending_review') {
          bucket.pendingReview += 1;
        }
      }
    }

    for (const [source, info] of counters.entries()) {
      if (info.awaiting >= autoLockAfterGroups && !currentLockedSources[source]) {
        currentLockedSources[source] = {
          lockedAt: isoNow,
          lockedBy: actor,
          reason: `Tự động khóa do ${info.awaiting} nhóm trùng chưa xử lý trong ${evaluationWindowDays} ngày`,
          note: '',
          auto: true,
          manual: false,
          unlockedAt: null,
          unlockedBy: null,
        };
        pushNotification({
          type: 'duplicate.policy.lock',
          severity: 'error',
          title: `Khóa nguồn ${source}`,
          message: `Nguồn ${source} bị khóa vì có ${info.awaiting} nhóm trùng chờ xử lý trong ${evaluationWindowDays} ngày gần đây.`,
          meta: { source, awaiting: info.awaiting },
        });
        pushAuditLog({
          actor,
          action: 'duplicate.policy.lock',
          detail: `Khóa nguồn ${source} do ${info.awaiting} nhóm trùng tồn đọng`,
        });
        triggered.locks.push({ source, awaiting: info.awaiting });
        lockedChanged = true;
      }
    }

    for (const [source, meta] of Object.entries(currentLockedSources)) {
      const info = counters.get(source) || { awaiting: 0 };
      const lockedAtTs = meta?.lockedAt ? new Date(meta.lockedAt).getTime() : 0;
      const unlockThreshold = Math.max(1, Math.floor(autoLockAfterGroups / 2));
      const shouldUnlockByCount = info.awaiting < unlockThreshold;
      const shouldUnlockByTime = autoUnlockMs && lockedAtTs && now - lockedAtTs >= autoUnlockMs;
      const isManual = meta?.manual === true;
      if ((shouldUnlockByCount || shouldUnlockByTime) && !isManual) {
        delete currentLockedSources[source];
        pushNotification({
          type: 'duplicate.policy.unlock',
          severity: 'success',
          title: `Mở khóa nguồn ${source}`,
          message: shouldUnlockByCount
            ? `Nguồn ${source} đã giảm xuống còn ${info.awaiting} nhóm trùng và được mở khóa.`
            : `Nguồn ${source} được mở khóa sau ${autoUnlockAfterDays} ngày giám sát.`,
          meta: { source },
        });
        pushAuditLog({
          actor,
          action: 'duplicate.policy.unlock',
          detail: `Mở khóa nguồn ${source}`,
        });
        triggered.unlocks.push({ source });
        lockedChanged = true;
      }
    }
  }

  const nextState = {
    lastEvaluatedAt:
      lockedChanged || stateChanged ? isoNow : currentState.lastEvaluatedAt || currentState.lastEvaluatedAt,
    notifiedGroups: currentNotified,
    lockedSources: currentLockedSources,
  };

  if (lockedChanged || stateChanged) {
    saveDuplicatePolicyState(nextState, { actor, source: 'duplicate-policy-eval' });
  }

  return {
    state: nextState,
    stateChanged: lockedChanged || stateChanged,
    lockedSourcesChanged: lockedChanged,
    summary: groupSummary,
    policyStats: {
      overdueTriggered: triggered.overdue.length,
      autoLocked: triggered.locks.length,
      autoUnlocked: triggered.unlocks.length,
      lockedSourceCount: Object.keys(nextState.lockedSources || {}).length,
    },
  };
}

async function buildDataHealthSummary() {
  const rows = getDeclRows();
  const policyConfig = getDuplicatePolicyConfig();
  const policyState = getDuplicatePolicyState();
  let duplicateSummary = summarizeDuplicateGroups(rows, { lockedSources: policyState.lockedSources });
  const evaluation = evaluateDuplicatePolicies({
    summary: duplicateSummary,
    config: policyConfig,
    state: policyState,
    actor: 'system',
  });
  const effectiveState = evaluation?.state || policyState;
  if (evaluation?.lockedSourcesChanged) {
    duplicateSummary = summarizeDuplicateGroups(rows, { lockedSources: effectiveState.lockedSources });
  } else if (evaluation?.summary) {
    duplicateSummary = evaluation.summary;
  }
  const alertPayload = buildAlertPayload();
  const ecusConfig = getEcusConfig();
  const sqlTimeouts = getSqlTimeoutEvents().slice(-10).reverse();
  const [storageDetails, sqlHealth] = await Promise.all([
    collectDatabaseStorageDetails(),
    checkSqlServerHealth().catch((error) => ({
      ok: false,
      state: 'error',
      message: error?.message || 'Không thể kiểm tra SQL Server',
    })),
  ]);
  const backupSummary = buildBackupSummary({ limit: 6 });
  const backupHealth = evaluateBackupHealth(backupSummary);
  const diskHealth = evaluateDiskHealth(storageDetails);
  const overallStorageSeverity = escalateSeverity(backupHealth.severity, diskHealth.severity);
  const storage = {
    database: storageDetails.database,
    disk: storageDetails.disk,
    backup: { ...backupSummary, health: backupHealth },
    health: {
      severity: overallStorageSeverity,
      issues: [...backupHealth.issues, ...diskHealth.issues],
    },
  };
  const notifications = listNotifications({ limit: 20 });
  const lockedSourcesList = Object.entries(effectiveState.lockedSources || {}).map(([source, meta]) => ({
    source,
    lockedAt: meta?.lockedAt || null,
    lockedBy: meta?.lockedBy || null,
    reason: meta?.reason || '',
    note: meta?.note || '',
    auto: meta?.auto === true,
    manual: meta?.manual === true,
    unlockedAt: meta?.unlockedAt || null,
    unlockedBy: meta?.unlockedBy || null,
  }));

  return {
    totals: {
      declarations: rows.length,
      duplicateGroups: duplicateSummary.duplicateGroups,
      duplicateRows: duplicateSummary.duplicateRows,
      duplicatesAwaiting: duplicateSummary.statusCounts?.awaitingAction || 0,
      duplicatesPendingReview: duplicateSummary.statusCounts?.pendingReview || 0,
      duplicatesLocked: duplicateSummary.statusCounts?.locked || 0,
      alertsOutstanding: alertPayload.summary.outstanding,
    },
    duplicates: {
      groups: duplicateSummary.groups.slice(0, 10),
      statusCounts: duplicateSummary.statusCounts,
      sourceBreakdown: duplicateSummary.sourceBreakdown.slice(0, 12),
      policy: {
        config: policyConfig,
        lastEvaluatedAt: effectiveState.lastEvaluatedAt || null,
        lockedSources: lockedSourcesList,
        stats: evaluation?.policyStats || null,
      },
    },
    alerts: {
      outstanding: alertPayload.summary.outstanding,
      totalTracked: alertPayload.summary.totalTracked,
      lastEvaluatedAt: alertPayload.summary.lastEvaluatedAt,
      recent: alertPayload.alerts.slice(0, 10),
    },
    sync: {
      lastRunAt: ecusConfig?.lastSummary?.runAt || ecusConfig?.lastRun || null,
      lastStatus: ecusConfig?.lastStatus || null,
      lastSummary: ecusConfig?.lastSummary || null,
    },
    sqlServer: {
      timeoutEvents: sqlTimeouts,
      health: sqlHealth,
    },
    storage,
    notifications,
  };
}

export async function getDataHealthSnapshot() {
  return buildDataHealthSummary();
}

function formatAlertTimestamp(input) {
  if (!input) {
    return 'Chưa xác định';
  }
  try {
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) {
      return 'Không xác định';
    }
    const timezone = (process.env.KPI_TIMEZONE || 'Asia/Ho_Chi_Minh').trim() || 'Asia/Ho_Chi_Minh';
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short',
      hour12: false,
      timeZone: timezone,
    }).format(date);
  } catch {
    return `${input}`;
  }
}

function shouldThrottleAlert(lastIso, cooldownMinutes, now = Date.now()) {
  if (!lastIso) {
    return false;
  }
  const ts = new Date(lastIso).getTime();
  if (!Number.isFinite(ts)) {
    return false;
  }
  const cooldownMs = Math.max(1, Number(cooldownMinutes) || 0) * 60000;
  return now - ts < cooldownMs;
}

async function dispatchEcusMonitorAlerts(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return { triggered: [] };
  }
  if (!hasAlertTargets()) {
    return { triggered: [] };
  }
  const options = getEcusMonitorAlertOptions();
  const state = getEcusMonitorAlertState();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const triggers = [];

  if (options.failureThreshold > 0 && state.consecutiveErrors >= options.failureThreshold) {
    const lastAttempt = state.lastFailureAlertAttemptAt || state.lastFailureAlertAt;
    if (!shouldThrottleAlert(lastAttempt, options.failureCooldownMinutes, now)) {
      const message = `Đồng bộ ECUS đã thất bại ${state.consecutiveErrors} lần liên tiếp (gần nhất lúc ${formatAlertTimestamp(
        state.lastErrorAt
      )}).`;
      triggers.push({ type: 'failure', severity: 'critical', message });
    }
  }

  const staleMinutes = Number.isFinite(snapshot?.sync?.staleMinutes) ? snapshot.sync.staleMinutes : null;
  if (staleMinutes !== null && staleMinutes > options.staleThresholdMinutes) {
    const lastAttempt = state.lastStaleAlertAttemptAt || state.lastStaleAlertAt;
    if (!shouldThrottleAlert(lastAttempt, options.staleCooldownMinutes, now)) {
      const message = `Dữ liệu ECUS đã trễ ${staleMinutes} phút (ngưỡng cảnh báo ${options.staleThresholdMinutes} phút).`;
      const severity =
        staleMinutes >= Math.max(options.staleThresholdMinutes * 2, 180) || snapshot.severity === 'critical'
          ? 'critical'
          : 'warning';
      triggers.push({ type: 'stale', severity, message });
    }
  }

  if (!triggers.length) {
    return { triggered: [] };
  }

  const severity = triggers.some((trigger) => trigger.severity === 'critical' || snapshot.severity === 'critical')
    ? 'critical'
    : triggers.some((trigger) => trigger.severity === 'warning')
      ? 'warning'
      : 'info';

  const subjectDetails = [];
  if (triggers.some((trigger) => trigger.type === 'failure')) {
    subjectDetails.push(`${state.consecutiveErrors} lần lỗi liên tiếp`);
  }
  if (triggers.some((trigger) => trigger.type === 'stale') && staleMinutes !== null) {
    subjectDetails.push(`Độ trễ ${staleMinutes} phút`);
  }
  const subjectSuffix = subjectDetails.length ? `: ${subjectDetails.join(' & ')}` : '';
  const subject = `[KPI] Cảnh báo đồng bộ ECUS${subjectSuffix}`;

  const introLines = ['Hệ thống phát hiện sự cố giám sát đồng bộ ECUS.'];
  for (const trigger of triggers) {
    introLines.push(trigger.message);
  }
  introLines.push('Vui lòng kiểm tra tác vụ đồng bộ ECUS, kết nối SQL Server và chạy lại khi cần.');
  const text = introLines.join('\n');

  const issueSet = new Set();
  const combinedIssues = Array.isArray(snapshot.issues) ? snapshot.issues : [];
  for (const issue of combinedIssues) {
    if (!issue) continue;
    const normalized = `${issue}`.trim();
    if (normalized) {
      issueSet.add(normalized);
    }
  }
  for (const trigger of triggers) {
    const normalized = `${trigger.message}`.trim();
    if (normalized) {
      issueSet.add(normalized);
    }
  }
  if (state.lastErrorMessage) {
    issueSet.add(`Lỗi gần nhất: ${state.lastErrorMessage}`);
  }
  const issues = Array.from(issueSet);

  const facts = [
    {
      name: 'Lần chạy gần nhất',
      value: snapshot?.sync?.lastRunAt ? formatAlertTimestamp(snapshot.sync.lastRunAt) : 'Chưa có',
    },
    {
      name: 'Độ trễ hiện tại',
      value: staleMinutes !== null ? `${staleMinutes} phút` : 'Không xác định',
    },
    {
      name: 'Lỗi liên tiếp',
      value: `${state.consecutiveErrors}`,
    },
  ];
  if (state.lastSuccessAt) {
    facts.push({ name: 'Lần thành công gần nhất', value: formatAlertTimestamp(state.lastSuccessAt) });
  }
  const sqlState = snapshot?.database?.ok === false
    ? snapshot.database?.state || 'Lỗi kết nối'
    : snapshot?.database?.state || 'Ổn định';
  facts.push({ name: 'SQL Server', value: sqlState });

  const result = await deliverAlertNotification({
    subject,
    text,
    severity,
    issues,
    facts,
    link: options.dashboardUrl || null,
  });

  const updatePatch = {
    lastAlertAttemptAt: nowIso,
  };
  if (triggers.some((trigger) => trigger.type === 'failure')) {
    updatePatch.lastFailureAlertAttemptAt = nowIso;
  }
  if (triggers.some((trigger) => trigger.type === 'stale')) {
    updatePatch.lastStaleAlertAttemptAt = nowIso;
  }

  if (result.successes.length) {
    updatePatch.lastDeliveredChannels = result.successes;
    updatePatch.lastAlertDeliveredAt = nowIso;
    updatePatch.lastAlertSummary = {
      subject,
      severity,
      triggered: triggers.map((trigger) => trigger.type),
      deliveredVia: result.successes,
      issues: issues.slice(0, 10),
    };
    if (triggers.some((trigger) => trigger.type === 'failure')) {
      updatePatch.lastFailureAlertAt = nowIso;
    }
    if (triggers.some((trigger) => trigger.type === 'stale')) {
      updatePatch.lastStaleAlertAt = nowIso;
    }
  }

  saveEcusMonitorAlertState(updatePatch, { actor: 'system', source: 'ecus-monitor-alerts-dispatch' });

  if (result.failures.length) {
    for (const failure of result.failures) {
      console.error(`Không thể gửi cảnh báo ECUS qua ${failure.target}`, failure.error);
    }
  }

  return {
    triggered: triggers.map((trigger) => trigger.type),
    severity,
    delivered: result.successes,
  };
}

async function buildEcusSyncMonitorSnapshot() {
  const [database, config] = await Promise.all([
    checkSqlServerHealth().catch((error) => ({
      ok: false,
      state: 'error',
      message: error?.message || 'Không thể kiểm tra SQL Server',
      checkedAt: new Date().toISOString(),
    })),
    Promise.resolve(getEcusConfig()),
  ]);

  const lastSummary = config?.lastSummary || {};
  const lastRunAt = lastSummary.runAt || config?.lastRun || null;
  const lastStatus = config?.lastStatus || lastSummary.status || null;
  const now = Date.now();
  const lastRunDate = lastRunAt ? new Date(lastRunAt) : null;
  const staleMinutes =
    lastRunDate && Number.isFinite(lastRunDate.getTime())
      ? Math.max(0, Math.round((now - lastRunDate.getTime()) / 60000))
      : null;

  const severityThreshold = {
    warning: 90,
    critical: 180,
  };

  const issues = [];
  let severity = 'normal';

  if (!database?.ok) {
    severity = 'critical';
    issues.push(
      database?.message ||
        'Không thể kết nối SQL Server ECUS. Vui lòng kiểm tra cấu hình hoặc trạng thái dịch vụ.',
    );
  }

  if (typeof lastStatus === 'string' && lastStatus.toLowerCase().startsWith('error')) {
    severity = 'critical';
    issues.push('Lần đồng bộ gần nhất kết thúc với trạng thái lỗi.');
  }

  if (staleMinutes === null) {
    severity = severity === 'critical' ? 'critical' : 'warning';
    issues.push('Chưa có thống kê lần đồng bộ gần nhất.');
  } else if (staleMinutes > severityThreshold.critical) {
    severity = 'critical';
    issues.push(`Lần đồng bộ gần nhất đã cách đây ${staleMinutes} phút (vượt ngưỡng ${severityThreshold.critical} phút).`);
  } else if (staleMinutes > severityThreshold.warning && severity !== 'critical') {
    severity = 'warning';
    issues.push(
      `Lần đồng bộ gần nhất đã cách đây ${staleMinutes} phút (vượt ngưỡng ${severityThreshold.warning} phút cảnh báo).`,
    );
  }

  if (!issues.length && severity !== 'critical') {
    severity = 'normal';
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    severity,
    issues,
    thresholds: severityThreshold,
    sync: {
      lastRunAt,
      lastStatus,
      staleMinutes,
      rowsFetched: lastSummary.rowsFetched ?? null,
      rowsInserted: lastSummary.rowsInserted ?? null,
      rowsUpdated: lastSummary.rowsUpdated ?? null,
      rowsSkipped: lastSummary.rowsSkipped ?? null,
      totalStored: lastSummary.totalStored ?? null,
      range: lastSummary.range || null,
      alerts: lastSummary.alerts || null,
    },
    database,
  };

  try {
    const dispatchResult = await dispatchEcusMonitorAlerts(snapshot);
    if (dispatchResult && typeof dispatchResult === 'object') {
      snapshot.alertDispatch = dispatchResult;
    }
  } catch (err) {
    console.error('Không thể gửi cảnh báo giám sát ECUS', err);
  }

  const alertState = getEcusMonitorAlertState();
  snapshot.alertState = {
    consecutiveErrors: alertState.consecutiveErrors,
    lastErrorAt: alertState.lastErrorAt,
    lastErrorMessage: alertState.lastErrorMessage,
    lastErrorMeta: alertState.lastErrorMeta || null,
    lastSuccessAt: alertState.lastSuccessAt,
    lastFailureAlertAt: alertState.lastFailureAlertAt || null,
    lastFailureAlertAttemptAt: alertState.lastFailureAlertAttemptAt || null,
    lastStaleAlertAt: alertState.lastStaleAlertAt || null,
    lastStaleAlertAttemptAt: alertState.lastStaleAlertAttemptAt || null,
    lastAlertAttemptAt: alertState.lastAlertAttemptAt || null,
    lastAlertDeliveredAt: alertState.lastAlertDeliveredAt || null,
    lastDeliveredChannels: alertState.lastDeliveredChannels,
    lastAlertSummary: alertState.lastAlertSummary,
  };

  try {
    const historyResult = appendEcusMonitorHistory(snapshot, {
      actor: 'system',
      source: 'ecus-monitor-snapshot',
    });
    if (historyResult && historyResult.entry) {
      snapshot.history = {
        recordedAt: historyResult.entry.capturedAt,
        totalEntries: historyResult.totalEntries,
      };
    }
  } catch (err) {
    console.error('Không thể lưu lịch sử giám sát ECUS', err);
  }

  return snapshot;
}

function buildSqlConnectionConfig(config) {
  const connection = config?.connection || {};
  const poolOptions = connection.pool && typeof connection.pool === 'object' ? connection.pool : undefined;
  const parseTimeout = (value) => {
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? num : undefined;
  };
  const secureCredentials = getSecureSqlCredentials();
  const server = `${connection.server || secureCredentials.server || ''}`.trim();
  const database = `${connection.database || secureCredentials.database || ''}`.trim();
  const user = `${connection.user || secureCredentials.user || ''}`.trim();
  const password = connection.password || secureCredentials.password || '';
  return {
    server,
    database,
    user,
    password,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
      ...(connection.options || {}),
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

const DEFAULT_MST_HISTORY_TABLE_NAME =
  (process.env.KPI_MST_HISTORY_TABLE || 'dbo.KPI_MST_HISTORY').trim() || 'dbo.KPI_MST_HISTORY';
const MST_HISTORY_MAX_ENTRIES = 500;

function parseSqlTableName(input) {
  const trimmed = `${input ?? ''}`.trim();
  if (!trimmed) {
    return null;
  }
  const rawParts = trimmed.split('.').map((part) => part.trim()).filter(Boolean);
  if (!rawParts.length || rawParts.length > 2) {
    return null;
  }
  const normalizedParts = rawParts
    .map((part) => part.replace(/[^a-zA-Z0-9_]/g, ''))
    .filter(Boolean);
  if (!normalizedParts.length || normalizedParts.length > 2) {
    return null;
  }
  if (normalizedParts.length === 1) {
    normalizedParts.unshift('dbo');
  }
  const objectId = normalizedParts.join('.');
  const quoted = normalizedParts.map((part) => `[${part}]`).join('.');
  const indexName = normalizedParts.join('_');
  return { objectId, quoted, indexName };
}

const MST_HISTORY_TABLE = parseSqlTableName(DEFAULT_MST_HISTORY_TABLE_NAME);
let mstHistoryEnsurePromise = null;
let mstHistorySyncPromise = null;

const DEFAULT_ACCOUNT_SYNC_TABLE_NAME =
  (process.env.KPI_ACCOUNT_SYNC_TABLE || 'dbo.KPI_USER_ROLES').trim() || 'dbo.KPI_USER_ROLES';
const ACCOUNT_SYNC_TABLE = parseSqlTableName(DEFAULT_ACCOUNT_SYNC_TABLE_NAME);
let accountTableEnsurePromise = null;
let accountSyncPromise = null;
let accountPullPromise = null;
let lastAccountPullAt = 0;
const ACCOUNT_SYNC_MIN_INTERVAL_MS = 5000;

function clampLength(value, max) {
  if (!value) return '';
  const str = `${value}`;
  return str.length > max ? str.slice(0, max) : str;
}

function resolveEffectiveFrom(entry) {
  if (!entry) return '';
  const direct = entry.effective_from || entry.effectiveFrom;
  const normalizedDirect = toISODate(direct || '');
  if (normalizedDirect) {
    return normalizedDirect;
  }
  const rowKey = `${entry.rowKey || ''}`;
  const parts = rowKey.split('__');
  if (parts.length >= 2) {
    const iso = toISODate(parts[1]);
    if (iso) {
      return iso;
    }
  }
  return '';
}

function normalizeMstHistoryEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }
  const normalized = [];
  for (const entry of entries) {
    if (!entry) continue;
    const mst = normalizeMST(entry.mst);
    if (!mst) continue;
    const timestamp = new Date(entry.timestamp || Date.now());
    if (Number.isNaN(timestamp.getTime())) {
      timestamp.setTime(Date.now());
    }
    const field = normalizeStr(entry.field) || 'field';
    const rowKey = normalizeStr(entry.rowKey) || `${mst}__${resolveEffectiveFrom(entry)}`;
    const actor = normalizeStr(entry.actor) || 'system';
    const type = normalizeStr(entry.type) || 'update';
    const effectiveFrom = resolveEffectiveFrom(entry);
    const normalizedEntry = {
      id: clampLength(entry.id || `mst-${mst}-${field}-${timestamp.getTime()}`, 120),
      mst,
      field: clampLength(field, 64),
      from: clampLength(normalizeStr(entry.from), 255),
      to: clampLength(normalizeStr(entry.to), 255),
      actor: clampLength(actor, 128),
      timestamp,
      rowKey: clampLength(rowKey, 128),
      effectiveFrom: clampLength(effectiveFrom, 32),
      type: clampLength(type, 32),
    };
    normalized.push(normalizedEntry);
  }
  normalized.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return normalized.slice(0, MST_HISTORY_MAX_ENTRIES);
}

function resolveMstHistorySqlConfig() {
  if (!MST_HISTORY_TABLE) {
    return null;
  }
  const config = getEcusConfig();
  const connectionConfig = buildSqlConnectionConfig(config);
  if (!connectionConfig.server || !connectionConfig.database) {
    return null;
  }
  return { connectionConfig, table: MST_HISTORY_TABLE };
}

async function ensureMstHistoryTable(pool, tableMeta) {
  if (!pool || !tableMeta) {
    return false;
  }
  if (mstHistoryEnsurePromise) {
    return mstHistoryEnsurePromise;
  }
  mstHistoryEnsurePromise = (async () => {
    try {
      const request = pool.request();
      const createSql = `
        IF OBJECT_ID('${tableMeta.objectId}', 'U') IS NULL
        BEGIN
          CREATE TABLE ${tableMeta.quoted} (
            id NVARCHAR(128) NOT NULL PRIMARY KEY,
            mst NVARCHAR(32) NOT NULL,
            field NVARCHAR(64) NOT NULL,
            from_value NVARCHAR(255) NULL,
            to_value NVARCHAR(255) NULL,
            actor NVARCHAR(128) NULL,
            changed_at DATETIME NOT NULL,
            row_key NVARCHAR(128) NULL,
            effective_from NVARCHAR(32) NULL,
            change_type NVARCHAR(32) NOT NULL
          );
          CREATE INDEX IX_${tableMeta.indexName}_mst_changed_at ON ${tableMeta.quoted}(mst, changed_at);
        END
      `;
      await request.query(createSql);
      return true;
    } catch (err) {
      console.error('Không thể đảm bảo bảng lịch sử Gán MST tồn tại', err);
      recordSqlTimeout(err);
      return false;
    } finally {
      mstHistoryEnsurePromise = null;
    }
  })();
  return mstHistoryEnsurePromise;
}

async function syncMstHistoryToSql(entries) {
  const config = resolveMstHistorySqlConfig();
  if (!config) {
    return;
  }
  try {
    const pool = await sqlPoolManager.getPool(config.connectionConfig);
    const ready = await ensureMstHistoryTable(pool, config.table);
    if (!ready) {
      return;
    }
    const normalizedEntries = normalizeMstHistoryEntries(entries);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const cleanupRequest = new sql.Request(transaction);
      await cleanupRequest.query(`DELETE FROM ${config.table.quoted};`);
      if (normalizedEntries.length) {
        const insert = new sql.PreparedStatement(transaction);
        insert.input('id', sql.NVarChar(128));
        insert.input('mst', sql.NVarChar(32));
        insert.input('field', sql.NVarChar(64));
        insert.input('from', sql.NVarChar(255));
        insert.input('to', sql.NVarChar(255));
        insert.input('actor', sql.NVarChar(128));
        insert.input('changed_at', sql.DateTime);
        insert.input('row_key', sql.NVarChar(128));
        insert.input('effective_from', sql.NVarChar(32));
        insert.input('change_type', sql.NVarChar(32));
        await insert.prepare(
          `INSERT INTO ${config.table.quoted} (id, mst, field, from_value, to_value, actor, changed_at, row_key, effective_from, change_type)
           VALUES (@id, @mst, @field, @from, @to, @actor, @changed_at, @row_key, @effective_from, @change_type)`
        );
        try {
          for (const entry of normalizedEntries) {
            await insert.execute({
              id: entry.id,
              mst: entry.mst,
              field: entry.field,
              from: entry.from,
              to: entry.to,
              actor: entry.actor,
              changed_at: entry.timestamp,
              row_key: entry.rowKey,
              effective_from: entry.effectiveFrom,
              change_type: entry.type,
            });
          }
        } finally {
          await insert.unprepare().catch(() => {});
        }
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback().catch(() => {});
      throw err;
    }
  } catch (err) {
    if (isSqlTimeoutError(err)) {
      recordSqlTimeout(err);
    }
    console.error('Không thể đồng bộ lịch sử Gán MST lên SQL Server', err);
  }
}

async function fetchMstHistoryFromSql() {
  const config = resolveMstHistorySqlConfig();
  if (!config) {
    return [];
  }
  try {
    const pool = await sqlPoolManager.getPool(config.connectionConfig);
    const ready = await ensureMstHistoryTable(pool, config.table);
    if (!ready) {
      return [];
    }
    const request = pool.request();
    request.input('limit', sql.Int, MST_HISTORY_MAX_ENTRIES);
    const result = await request.query(
      `SELECT TOP (@limit)
         id,
         mst,
         field,
         from_value,
         to_value,
         actor,
         changed_at,
         row_key,
         effective_from,
         change_type
       FROM ${config.table.quoted}
       ORDER BY changed_at DESC, id DESC;`
    );
    const rows = Array.isArray(result?.recordset) ? result.recordset : [];
    return rows
      .map((row) => {
        const mst = normalizeMST(row?.mst);
        if (!mst) return null;
        const timestamp = row?.changed_at instanceof Date ? row.changed_at : new Date(row?.changed_at);
        if (Number.isNaN(timestamp?.getTime?.())) {
          return null;
        }
        return {
          id: clampLength(row?.id, 120),
          mst,
          field: clampLength(normalizeStr(row?.field), 64),
          from: clampLength(normalizeStr(row?.from_value), 255),
          to: clampLength(normalizeStr(row?.to_value), 255),
          actor: clampLength(normalizeStr(row?.actor), 128),
          timestamp: timestamp.toISOString(),
          rowKey: clampLength(normalizeStr(row?.row_key) || `${mst}__${toISODate(row?.effective_from || '')}`, 128),
          type: clampLength(normalizeStr(row?.change_type), 32) || 'update',
        };
      })
      .filter(Boolean);
  } catch (err) {
    if (isSqlTimeoutError(err)) {
      recordSqlTimeout(err);
    }
    console.error('Không thể tải lịch sử Gán MST từ SQL Server', err);
    return [];
  }
}

async function maybeSyncMstHistoryFromSql() {
  const entries = await fetchMstHistoryFromSql();
  if (!entries.length) {
    return;
  }
  const normalized = JSON.stringify(entries);
  const current = getValue('mst_history_v1');
  if (current !== normalized) {
    upsertValue('mst_history_v1', normalized, { skipMstHistorySync: true });
  }
}

function scheduleMstHistorySqlSyncFromJson(jsonValue) {
  const entries = safeParse(jsonValue, []);
  if (!Array.isArray(entries)) {
    return;
  }
  const queue = mstHistorySyncPromise
    ? mstHistorySyncPromise.catch(() => {}).then(() => syncMstHistoryToSql(entries))
    : syncMstHistoryToSql(entries);
  mstHistorySyncPromise = queue
    .catch((err) => {
      console.error('Đồng bộ lịch sử Gán MST lên SQL Server thất bại', err);
    })
    .finally(() => {
      if (mstHistorySyncPromise === queue) {
        mstHistorySyncPromise = null;
      }
    });
}

function resolveAccountSqlConfig() {
  if (!ACCOUNT_SYNC_TABLE) {
    return null;
  }
  const config = getEcusConfig();
  const connectionConfig = buildSqlConnectionConfig(config);
  let serverName = String(connectionConfig.server || '').trim();
  if (!serverName || /^server$/i.test(serverName)) {
    const envServer = String(process.env.ECUS_SQL_SERVER || '').trim();
    if (!envServer || /^server$/i.test(envServer)) {
      return null;
    }
    connectionConfig.server = envServer;
    serverName = envServer;
  }
  if (!connectionConfig.database) {
    return null;
  }
  return { connectionConfig, table: ACCOUNT_SYNC_TABLE };
}

async function ensureAccountSyncTable(pool, tableMeta) {
  if (!pool || !tableMeta) {
    return false;
  }
  if (accountTableEnsurePromise) {
    return accountTableEnsurePromise;
  }
  accountTableEnsurePromise = (async () => {
    try {
      const request = pool.request();
      const createSql = `
        IF OBJECT_ID('${tableMeta.objectId}', 'U') IS NULL
        BEGIN
          CREATE TABLE ${tableMeta.quoted} (
            username NVARCHAR(128) NOT NULL PRIMARY KEY,
            password_hash NVARCHAR(255) NOT NULL,
            role NVARCHAR(32) NOT NULL,
            name NVARCHAR(255) NULL,
            permissions NVARCHAR(MAX) NOT NULL,
            updated_at DATETIME NOT NULL
          );
        END
      `;
      await request.query(createSql);
      const alterSql = `
        IF COL_LENGTH('${tableMeta.objectId}', 'member_id') IS NULL
        BEGIN
          ALTER TABLE ${tableMeta.quoted} ADD member_id NVARCHAR(128) NULL;
        END;
        IF COL_LENGTH('${tableMeta.objectId}', 'member_name') IS NULL
        BEGIN
          ALTER TABLE ${tableMeta.quoted} ADD member_name NVARCHAR(255) NULL;
        END;
        IF COL_LENGTH('${tableMeta.objectId}', 'team_id') IS NULL
        BEGIN
          ALTER TABLE ${tableMeta.quoted} ADD team_id NVARCHAR(128) NULL;
        END;
        IF COL_LENGTH('${tableMeta.objectId}', 'team_name') IS NULL
        BEGIN
          ALTER TABLE ${tableMeta.quoted} ADD team_name NVARCHAR(255) NULL;
        END;
      `;
      await request.query(alterSql);
      return true;
    } catch (err) {
      if (isSqlTimeoutError(err)) {
        recordSqlTimeout({ message: err?.message, context: { feature: 'account-sync', action: 'ensure-table' } });
      }
      console.error('Không thể đảm bảo bảng phân quyền tài khoản tồn tại', err);
      return false;
    } finally {
      accountTableEnsurePromise = null;
    }
  })();
  return accountTableEnsurePromise;
}

function escapeSqlLiteral(value, { nvarchar = false } = {}) {
  if (value === null || value === undefined) {
    return nvarchar ? "N''" : "''";
  }
  const text = `${value}`.replace(/'/g, "''");
  return nvarchar ? `N'${text}'` : `'${text}'`;
}

function serializeAccountRecordForSql(record) {
  if (!record) {
    return null;
  }
  const normalized = normalizeAccountRecordForStorage(record);
  if (!normalized) {
    return null;
  }
  return {
    username: normalized.username,
    passwordHash: normalized.passwordHash,
    role: normalized.role,
    name: normalized.name,
    permissions: normalized.permissions,
    permissionsJson: JSON.stringify(normalized.permissions || {}),
    updatedAt: normalized.updatedAt,
    memberId: normalized.memberId ?? null,
    memberName: normalized.memberName ?? null,
    teamId: normalized.teamId ?? null,
    teamName: normalized.teamName ?? null,
  };
}

function normalizeSqlAccountRow(row) {
  if (!row) return null;
  const username = normalizeStr(row.username);
  if (!username) {
    return null;
  }
  const passwordHash = (row.password_hash ?? row.passwordHash ?? '').toString().trim();
  if (!passwordHash) {
    return null;
  }
  const role = normalizeRoleKey(row.role);
  const name = normalizeStr(row.name) || username;
  const permissionsSource = row.permissions;
  let parsedPermissions = null;
  if (typeof permissionsSource === 'string' && permissionsSource.trim()) {
    try {
      parsedPermissions = JSON.parse(permissionsSource);
    } catch {
      parsedPermissions = null;
    }
  } else if (permissionsSource && typeof permissionsSource === 'object') {
    parsedPermissions = permissionsSource;
  }
  const permissions = normalizePermissionsForRole(parsedPermissions, role);
  const updatedAtRaw = row.updated_at || row.updatedAt;
  const updatedAt = normalizeAccountUpdatedAt(updatedAtRaw);
  const memberId = toNullableString(row.member_id ?? row.memberId, { maxLength: 160 });
  const memberName = toNullableString(row.member_name ?? row.memberName, { maxLength: 255 });
  const teamId = toNullableString(row.team_id ?? row.teamId, { maxLength: 160 });
  const teamName = toNullableString(row.team_name ?? row.teamName, { maxLength: 255 });
  return { username, passwordHash, role, name, permissions, updatedAt, memberId, memberName, teamId, teamName };
}

async function syncAccountsToSql(records) {
  const config = resolveAccountSqlConfig();
  if (!config) {
    return;
  }
  try {
    const pool = await sqlPoolManager.getPool(config.connectionConfig);
    const ready = await ensureAccountSyncTable(pool, config.table);
    if (!ready) {
      return;
    }
    const serialized = Array.isArray(records)
      ? records.map((record) => serializeAccountRecordForSql(record)).filter(Boolean)
      : [];
    const statements = serialized.map((record) => {
      const username = escapeSqlLiteral(record.username, { nvarchar: true });
      const passwordHash = escapeSqlLiteral(record.passwordHash, { nvarchar: true });
      const role = escapeSqlLiteral(record.role, { nvarchar: true });
      const name = escapeSqlLiteral(record.name || record.username, { nvarchar: true });
      const permissions = escapeSqlLiteral(record.permissionsJson || '{}', { nvarchar: true });
      const updatedAt = `CONVERT(DATETIME, ${escapeSqlLiteral(record.updatedAt, { nvarchar: true })}, 126)`;
      const memberId = escapeSqlLiteral(record.memberId, { nvarchar: true });
      const memberName = escapeSqlLiteral(record.memberName, { nvarchar: true });
      const teamId = escapeSqlLiteral(record.teamId, { nvarchar: true });
      const teamName = escapeSqlLiteral(record.teamName, { nvarchar: true });
      return `INSERT INTO ${config.table.quoted} (username, password_hash, role, name, permissions, updated_at, member_id, member_name, team_id, team_name)
VALUES (${username}, ${passwordHash}, ${role}, ${name}, ${permissions}, ${updatedAt}, ${memberId}, ${memberName}, ${teamId}, ${teamName});`;
    });
    const batch = [
      'BEGIN TRY',
      'BEGIN TRANSACTION;',
      `DELETE FROM ${config.table.quoted};`,
      ...statements,
      'COMMIT TRANSACTION;',
      'END TRY',
      'BEGIN CATCH',
      '  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;',
      '  THROW;',
      'END CATCH;',
    ].join('\n');
    await pool.request().query(batch);
  } catch (err) {
    if (isSqlTimeoutError(err)) {
      recordSqlTimeout({ message: err?.message, context: { feature: 'account-sync', action: 'push' } });
    }
    console.error('Không thể đồng bộ tài khoản lên SQL Server', err);
  }
}

function scheduleAccountSqlSync(records) {
  if (!Array.isArray(records)) {
    return;
  }
  const payload = records.map((record) => ({ ...record }));
  const queue = accountSyncPromise
    ? accountSyncPromise.catch(() => {}).then(() => syncAccountsToSql(payload))
    : syncAccountsToSql(payload);
  accountSyncPromise = queue
    .catch(() => {})
    .finally(() => {
      if (accountSyncPromise === queue) {
        accountSyncPromise = null;
      }
    });
}

async function maybeSyncAccountsFromSql({ force = false } = {}) {
  const config = resolveAccountSqlConfig();
  if (!config) {
    return false;
  }
  const now = Date.now();
  if (!force) {
    if (accountPullPromise) {
      return accountPullPromise;
    }
    if (lastAccountPullAt && now - lastAccountPullAt < ACCOUNT_SYNC_MIN_INTERVAL_MS) {
      return false;
    }
  }
  if (accountPullPromise) {
    return accountPullPromise;
  }
  accountPullPromise = (async () => {
    try {
      const pool = await sqlPoolManager.getPool(config.connectionConfig);
      const ready = await ensureAccountSyncTable(pool, config.table);
      if (!ready) {
        return false;
      }
      const result = await pool
        .request()
        .query(
          `SELECT username, password_hash, role, name, permissions, updated_at, member_id, member_name, team_id, team_name FROM ${config.table.quoted};`
        );
      const rows = Array.isArray(result?.recordset) ? result.recordset : [];
      const sqlRecords = rows.map((row) => normalizeSqlAccountRow(row)).filter(Boolean);
      if (!sqlRecords.length) {
        return false;
      }
      const currentRecords = loadAccountRecords();
      const currentMap = new Map();
      for (const record of currentRecords) {
        currentMap.set(record.username.toLowerCase(), normalizeAccountRecordForStorage(record));
      }
      let changed = false;
      for (const sqlRecord of sqlRecords) {
        const key = sqlRecord.username.toLowerCase();
        const existing = currentMap.get(key);
        if (!existing) {
          currentMap.set(key, sqlRecord);
          changed = true;
          continue;
        }
        const existingTime = Date.parse(existing.updatedAt) || 0;
        const sqlTime = Date.parse(sqlRecord.updatedAt) || 0;
        if (sqlTime >= existingTime) {
          const diff =
            existing.passwordHash !== sqlRecord.passwordHash ||
            existing.role !== sqlRecord.role ||
            existing.name !== sqlRecord.name ||
            JSON.stringify(existing.permissions) !== JSON.stringify(sqlRecord.permissions) ||
            sqlTime > existingTime;
          if (diff) {
            currentMap.set(key, sqlRecord);
            changed = true;
          }
        }
      }
      const merged = Array.from(currentMap.values());
      sortAccountRecords(merged);
      const serializedMerged = JSON.stringify(merged);
      const serializedCurrent = JSON.stringify(
        currentRecords.map((record) => normalizeAccountRecordForStorage(record)).sort((a, b) =>
          a.username.localeCompare(b.username, 'vi', { sensitivity: 'base' })
        )
      );
      if (changed || serializedMerged !== serializedCurrent) {
        persistAccountRecords(merged, { skipSqlSync: true });
      }
      return changed;
    } catch (err) {
      if (isSqlTimeoutError(err)) {
        recordSqlTimeout({ message: err?.message, context: { feature: 'account-sync', action: 'pull' } });
      }
      console.error('Không thể tải tài khoản từ SQL Server', err);
      return false;
    } finally {
      lastAccountPullAt = Date.now();
      accountPullPromise = null;
    }
  })();
  return accountPullPromise;
}

function resetAccountSyncState() {
  accountSyncPromise = null;
  accountPullPromise = null;
  accountTableEnsurePromise = null;
  lastAccountPullAt = 0;
}

function extractNormalizedLicenseCodes(rawValue) {
  if (rawValue === null || rawValue === undefined) return [];
  const normalized = new Set();
  const stack = [rawValue];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === null || current === undefined) {
      continue;
    }
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
    const str = normalizeStr(current);
    if (!str) {
      continue;
    }
    const tokens = str
      .split(/[\s,;|]+/g)
      .map((token) => normalizeStr(token).toUpperCase())
      .filter((token) => token && !/^\d+(?:\.\d+)?$/.test(token));
    for (const token of tokens) {
      normalized.add(token);
    }
  }
  return Array.from(normalized);
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
  const normalizedRecord = normalizeSqlUnicodeRecord(record);
  const columnMap = config.columnMap || {};
  const keyLookup = buildRecordKeyLookup(normalizedRecord);
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
      const value = readRecordValue(normalizedRecord, keyLookup, candidate);
      if (value !== undefined) {
        return value;
      }
    }
    return undefined;
  };

  const soTkRaw = normalizeStr(getField('so_tk'));
  const soTk = normalizeDeclarationNumber(soTkRaw);
  const nhanh = normalizeStr(getField('nhanh'));
  const rawDate = getField('date');
  const dateISO = rawDate instanceof Date
    ? toISODate(rawDate.toISOString(), { preferMonthFirst: config.preferMonthFirst })
    : toISODate(rawDate, { preferMonthFirst: config.preferMonthFirst });
  if (!soTk || !dateISO) return null;

  const mst = normalizeMST(getField('mst'));
  let company = normalizeStr(getField('cong_ty'));
  const loaiHinh = normalizeStr(getField('loai_hinh'));
  const numItemsRaw = getField('num_items');
  const numItems = Number.parseInt(numItemsRaw, 10);
  const licensesRaw = getField('licenses');
  const licenseCodesRaw = getField('license_codes');
  let licenseSourceCodes = extractNormalizedLicenseCodes(licenseCodesRaw);
  if (!licenseSourceCodes.length) {
    licenseSourceCodes = extractNormalizedLicenseCodes(licensesRaw);
  }
  if (!licenseSourceCodes.length) {
    const perFieldCodes = [];
    for (let i = 1; i <= 5; i += 1) {
      const field = getField(`license_code_${i}`);
      if (!field) continue;
      const normalized = normalizeStr(field).toUpperCase();
      if (normalized) {
        perFieldCodes.push(normalized);
      }
    }
    if (perFieldCodes.length) {
      licenseSourceCodes = perFieldCodes;
    }
  }
  const uniqueLicenseSourceCodes = Array.from(new Set(licenseSourceCodes));

  const baseExcludeSet =
    context?.licenseExcludeSet instanceof Set ? context.licenseExcludeSet : new Set();
  const agencyExcludeMap =
    context?.licenseAgencyExcludeMap instanceof Map ? context.licenseAgencyExcludeMap : null;
  const hqAgencyMap = context?.hqAgencyMap instanceof Map ? context.hqAgencyMap : null;

  const normalizedAgencyKeys = new Set();
  const collectAgencyKeys = (value) => {
    if (!value) return;
    const normalizedFull = normalizeAgencyKey(value);
    if (normalizedFull) {
      normalizedAgencyKeys.add(normalizedFull);
    }
    for (const part of splitAgencyValues(value)) {
      const key = normalizeAgencyKey(part);
      if (key) {
        normalizedAgencyKeys.add(key);
      }
    }
    const parentMatches = String(value)
      .match(/\(([^)]+)\)/g);
    if (parentMatches) {
      for (const segment of parentMatches) {
        const inner = segment.replace(/^\(|\)$/g, '');
        const innerKey = normalizeAgencyKey(inner);
        if (innerKey) {
          normalizedAgencyKeys.add(innerKey);
        }
      }
    }
  };

  const recordAgencyRaw = normalizeStr(getField('agency'));
  const recordDaiLyRaw = normalizeStr(getField('dai_ly'));
  let agency = recordAgencyRaw || recordDaiLyRaw || '';
  collectAgencyKeys(recordAgencyRaw);
  collectAgencyKeys(recordDaiLyRaw);

  let agencyInfo = null;
  if (mst && hqAgencyMap) {
    agencyInfo = hqAgencyMap.get(mst) || null;
  }
  if (agencyInfo) {
    if (!agency && agencyInfo.agent) {
      agency = agencyInfo.agent;
    }
    if (!company && agencyInfo.company) {
      company = agencyInfo.company;
    }
    if (Array.isArray(agencyInfo.normalizedAgents)) {
      for (const key of agencyInfo.normalizedAgents) {
        if (key) {
          normalizedAgencyKeys.add(key);
        }
      }
    } else if (agencyInfo.agent) {
      collectAgencyKeys(agencyInfo.agent);
    }
  }

  collectAgencyKeys(agency);

  let effectiveExcludeSet = baseExcludeSet;
  if (agencyExcludeMap && normalizedAgencyKeys.size) {
    for (const key of normalizedAgencyKeys) {
      const agencyCodes = agencyExcludeMap.get(key);
      if (!agencyCodes || agencyCodes.size === 0) {
        continue;
      }
      if (effectiveExcludeSet === baseExcludeSet) {
        effectiveExcludeSet = new Set(baseExcludeSet);
      }
      for (const code of agencyCodes) {
        effectiveExcludeSet.add(code);
      }
    }
  }

  let licenseCount;
  let includedLicenseCodes = [];
  let excludedLicenseCodes = [];
  if (uniqueLicenseSourceCodes.length) {
    for (const code of uniqueLicenseSourceCodes) {
      if (effectiveExcludeSet.has(code)) {
        excludedLicenseCodes.push(code);
      } else {
        includedLicenseCodes.push(code);
      }
    }
    licenseCount = includedLicenseCodes.length;
  } else {
    licenseCount = parseLicenseCount(licensesRaw, effectiveExcludeSet);
  }
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
    so_tk_full: soTkRaw,
    so_tk_suffix: soTkRaw.slice(soTk.length),
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
    agency,
    dai_ly: agency,
    isExport,
    co_line_count: coLineCount,
    licenseCodes: includedLicenseCodes,
    licenseSourceCodes: uniqueLicenseSourceCodes,
    licenseExcludedCodes: excludedLicenseCodes,
  };
  const normalizedBase = normalizeDeclarationRow(base) || base;
  return deriveCOStatus(normalizedRecord, normalizedBase);
}

function isEqualValue(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i += 1) {
      if (!isEqualValue(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
  return Object.is(a, b);
}

function normalizeValueArray(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== null && item !== undefined)
      .map((item) => normalizeStr(item));
  }
  if (value === null || value === undefined) {
    return [];
  }
  if (typeof value === 'string') {
    return value
      .split(/[\s,;|]+/g)
      .map((part) => normalizeStr(part))
      .filter(Boolean);
  }
  return [];
}

function mergeDeclarationRow(existing, incoming) {
  if (!existing) {
    return { row: incoming, changed: true, changedFields: Object.keys(incoming || {}) };
  }
  if (existing?.reviewed && incoming?.__forceReviewedOverride !== true) {
    return { row: existing, changed: false, changedFields: [], locked: true };
  }
  const merged = { ...existing };
  let changed = false;
  const changedFields = new Set();

  const markChanged = (field) => {
    changed = true;
    if (field) {
      changedFields.add(field);
    }
  };

  const assign = (field, value) => {
    if (!isEqualValue(merged[field], value)) {
      merged[field] = value;
      markChanged(field);
    }
  };

  const skipFields = new Set([
    'nhan_vien',
    'team',
    'agency',
    'dai_ly',
    'licenses',
    'so_luong_gp',
    'reviewed',
    'reviewed_at',
    'so_tk',
    'so_tk_full',
    'so_tk_suffix',
  ]);

  for (const [key, value] of Object.entries(incoming)) {
    if (skipFields.has(key)) {
      continue;
    }
    if (key === 'co_line_count') {
      assign(key, parseCoLineCount(value));
      continue;
    }
    if (key === 'co') {
      assign(key, normalizeStr(value || ''));
      continue;
    }
    if (key === 'has_co') {
      assign(key, !!value);
      continue;
    }
    if (key === 'co_codes' || key === 'licenseCodes') {
      assign(key, normalizeValueArray(value));
      continue;
    }
    assign(key, value);
  }

  const fillIfBlank = (field) => {
    const current = normalizeStr(merged[field] || '');
    const incomingValue = normalizeStr(incoming[field] || '');
    if (!current && incomingValue) {
      assign(field, incoming[field]);
    }
  };

  fillIfBlank('nhan_vien');
  fillIfBlank('team');
  fillIfBlank('agency');
  fillIfBlank('dai_ly');

  const fillNumeric = (field) => {
    const rawIncoming = incoming[field];
    if (rawIncoming === undefined || rawIncoming === null || rawIncoming === '') {
      return;
    }
    const incomingNumber = Number(rawIncoming);
    if (!Number.isFinite(incomingNumber)) {
      return;
    }
    assign(field, incomingNumber);
  };

  fillNumeric('licenses');
  fillNumeric('so_luong_gp');

  return { row: merged, changed, changedFields: Array.from(changedFields) };
}

async function* fetchEcusDeclarations(range, config, options = {}) {
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
  const includeFilterSet = options?.includeTaxCodesSet instanceof Set
    ? new Set(Array.from(options.includeTaxCodesSet).map((value) => normalizeMST(value)).filter(Boolean))
    : new Set();
  const excludeFilterSet = options?.excludeTaxCodesSet instanceof Set
    ? new Set(Array.from(options.excludeTaxCodesSet).map((value) => normalizeMST(value)).filter(Boolean))
    : new Set();
  const includeFilterList = Array.from(includeFilterSet);
  const excludeFilterList = Array.from(excludeFilterSet);
  const applyIncludeInSql = includeFilterList.length > 0 && includeFilterList.length <= 50;
  const applyExcludeInSql = excludeFilterList.length > 0 && excludeFilterList.length <= 50;
  let workingQuery = baseQuery;
  if (applyIncludeInSql || applyExcludeInSql) {
    const alias = 'filtered_source';
    const clauses = [];
    if (applyIncludeInSql) {
      const placeholders = includeFilterList.map((_, idx) => `@__include${idx}`);
      clauses.push(`${alias}.mst IN (${placeholders.join(', ')})`);
    }
    if (applyExcludeInSql) {
      const placeholders = excludeFilterList.map((_, idx) => `@__exclude${idx}`);
      clauses.push(`${alias}.mst NOT IN (${placeholders.join(', ')})`);
    }
    workingQuery = `SELECT * FROM (${baseQuery}) AS ${alias} WHERE ${clauses.join(' AND ')}`;
  }
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

  const attachFilterParameters = (request) => {
    includeFilterList.forEach((mst, idx) => {
      request.input(`__include${idx}`, sql.NVarChar, mst);
    });
    excludeFilterList.forEach((mst, idx) => {
      request.input(`__exclude${idx}`, sql.NVarChar, mst);
    });
  };

  const lowerQuery = workingQuery.toLowerCase();
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
    attachFilterParameters(request);
    const result = await request.query(workingQuery);
    const rows = result?.recordset || [];
    if (rows.length > 0) {
      yield rows;
    }
    return;
  }

  const hasOrderBy = /order\s+by/u.test(lowerQuery);
  const wrappedQuery = hasOrderBy
    ? workingQuery
    : `SELECT * FROM (${workingQuery}) AS base_query ORDER BY (SELECT NULL)`;
  const pagedQuery = `${wrappedQuery} OFFSET @__offset ROWS FETCH NEXT @__limit ROWS ONLY`;

  let offset = 0;
  while (true) {
    const request = pool.request();
    request.timeout = requestTimeout;
    attachRangeParameters(request);
    attachFilterParameters(request);
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
  const { excludeSet, agencyMap } = buildLicenseExcludeContext(rules || {});
  return {
    licenseExcludeSet: excludeSet,
    licenseAgencyExcludeMap: agencyMap,
    hqAgencyMap: mapHqAgenciesByMST(),
    memberTeamMap: getMemberTeamMap(),
    config,
    includeTaxCodesSet: new Set(Array.isArray(config?.includeTaxCodes) ? config.includeTaxCodes : []),
    excludeTaxCodesSet: new Set(Array.isArray(config?.excludeTaxCodes) ? config.excludeTaxCodes : []),
  };
}

function shouldSkipByMst(row, includeSet, excludeSet) {
  const mst = normalizeMST(row?.mst);
  if (includeSet instanceof Set && includeSet.size > 0) {
    if (!mst || !includeSet.has(mst)) {
      return true;
    }
  }
  if (excludeSet instanceof Set && excludeSet.size > 0) {
    if (mst && excludeSet.has(mst)) {
      return true;
    }
  }
  return false;
}

async function previewEcusSync(rangeInput, { limit = 50, includeTaxCodes = null, excludeTaxCodes = null } = {}) {
  const config = getEcusConfig();
  const range = computeRangeWindow(config, rangeInput || {});
  const includeList = includeTaxCodes === null
    ? Array.isArray(config.includeTaxCodes)
      ? config.includeTaxCodes
      : []
    : normalizeEcusTaxCodeList(includeTaxCodes);
  const excludeList = excludeTaxCodes === null
    ? Array.isArray(config.excludeTaxCodes)
      ? config.excludeTaxCodes
      : []
    : normalizeEcusTaxCodeList(excludeTaxCodes);
  const includeSet = new Set(includeList);
  const excludeSet = new Set(excludeList);
  const context = buildEcusSyncContext({ ...config, includeTaxCodes: includeList, excludeTaxCodes: excludeList });
  const iterator = fetchEcusDeclarations(range, config, {
    includeTaxCodesSet: includeSet,
    excludeTaxCodesSet: excludeSet,
  });
  const existingRows = getDeclRows();
  const existingMap = new Map();
  for (const row of existingRows) {
    const key = getDeclarationKey(row);
    if (key) {
      existingMap.set(key, row);
    }
  }
  const normalizedLimit = Number.isFinite(Number(limit)) ? Math.max(0, Math.floor(Number(limit))) : 0;
  const rows = [];
  let totalFetched = 0;

  for await (const batch of iterator) {
    totalFetched += batch.length;
    for (const raw of batch) {
      const mapped = mapEcusRow(raw, config, context);
      if (!mapped) continue;
      if (shouldSkipByMst(mapped, includeSet, excludeSet)) {
        continue;
      }
      const key = getDeclarationKey(mapped);
      const existing = key ? existingMap.get(key) : null;
      const locked = !!existing?.reviewed;
      rows.push({ ...mapped, status: existing ? 'existing' : 'new', locked });
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

async function runEcusSync({
  from,
  to,
  actor = 'system',
  reason = 'manual',
  includeTaxCodes = null,
  excludeTaxCodes = null,
} = {}) {
  const config = getEcusConfig();
  const range = computeRangeWindow(config, { from, to });
  const syncReason = reason || 'manual';
  const includeList = includeTaxCodes === null
    ? Array.isArray(config.includeTaxCodes)
      ? config.includeTaxCodes
      : []
    : normalizeEcusTaxCodeList(includeTaxCodes);
  const excludeList = excludeTaxCodes === null
    ? Array.isArray(config.excludeTaxCodes)
      ? config.excludeTaxCodes
      : []
    : normalizeEcusTaxCodeList(excludeTaxCodes);
  const includeSet = new Set(includeList);
  const excludeSet = new Set(excludeList);
  const rawIterator = fetchEcusDeclarations(range, config, {
    includeTaxCodesSet: includeSet,
    excludeTaxCodesSet: excludeSet,
  });
  const context = buildEcusSyncContext({ ...config, includeTaxCodes: includeList, excludeTaxCodes: excludeList });
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
  let updatedExisting = 0;
  let reviewLocked = 0;

  const updatedMap = new Map();
  const insertedMap = new Map();
  const lockedMap = new Map();

  for await (const batch of rawIterator) {
    totalFetched += batch.length;
    const mappedBatch = batch
      .map((row) => mapEcusRow(row, config, context))
      .filter((row) => row && row.so_tk && row.date);
    for (const row of mappedBatch) {
      if (shouldSkipByMst(row, includeSet, excludeSet)) {
        continue;
      }
      const key = getDeclarationKey(row);
      if (!key) {
        continue;
      }
      if (mergedMap.has(key)) {
        const existing = mergedMap.get(key);
        const {
          row: mergedRow,
          changed,
          changedFields = [],
          locked,
        } = mergeDeclarationRow(existing, row);
        if (locked) {
          skippedExisting += 1;
          reviewLocked += 1;
          if (!lockedMap.has(key)) {
            lockedMap.set(key, {
              so_tk: existing.so_tk,
              so_tk_full: existing.so_tk_full || row.so_tk_full || existing.so_tk,
              nhanh: normalizeStr(existing.nhanh || existing.branch || ''),
            });
          }
          continue;
        }
        mergedMap.set(key, mergedRow);
        if (changed) {
          updatedExisting += 1;
          const entry = updatedMap.get(key) || {
            so_tk: mergedRow.so_tk,
            so_tk_full: mergedRow.so_tk_full || row.so_tk_full || existing.so_tk_full || row.so_tk,
            nhanh: normalizeStr(mergedRow.nhanh || mergedRow.branch || ''),
            fields: new Set(),
          };
          for (const field of changedFields) {
            entry.fields.add(field);
          }
          updatedMap.set(key, entry);
        } else {
          skippedExisting += 1;
        }
        continue;
      }
      mergedMap.set(key, row);
      totalInserted += 1;
      insertedMap.set(key, {
        so_tk: row.so_tk,
        so_tk_full: row.so_tk_full || row.so_tk,
        nhanh: normalizeStr(row.nhanh || row.branch || ''),
      });
    }
  }

  const mergedRows = Array.from(mergedMap.values());
  const storedRows = writeDeclRows(mergedRows);
  const totalStored = storedRows.length;
  const skipLabel = reviewLocked > 0
    ? `bo qua ${skippedExisting} (khoa ${reviewLocked})`
    : `bo qua ${skippedExisting}`;

  pushAuditLog({
    actor,
    action: 'decl.merge',
    detail: `Dong bo ${totalInserted} to khai moi tu ECUS (${range.from || '...'} -> ${range.to || '...'}) [${syncReason}] - cap nhat ${updatedExisting} - ${skipLabel} - tong luu: ${totalStored}`,
  });

  const alertSummary = evaluateDeclarationAlerts({ actor, reason: 'ecus-sync' });

  const updatedEntries = Array.from(updatedMap.values()).map((entry) => ({
    so_tk: entry.so_tk,
    so_tk_full: entry.so_tk_full,
    nhanh: entry.nhanh,
    fields: Array.from(entry.fields),
  }));
  const insertedEntries = Array.from(insertedMap.values());
  const lockedEntries = Array.from(lockedMap.values());

  const filterNoticeParts = [];
  if (includeSet.size > 0) {
    filterNoticeParts.push(`chỉ MST: ${Array.from(includeSet).join(', ')}`);
  }
  if (excludeSet.size > 0) {
    filterNoticeParts.push(`loại trừ MST: ${Array.from(excludeSet).join(', ')}`);
  }
  const filterSummary = filterNoticeParts.length ? ` | lọc ${filterNoticeParts.join('; ')}` : '';

  pushImportLog({
    kind: 'ecus-sync',
    actor,
    message: `ECUS sync (${syncReason}) +${totalInserted} / cap nhat ${updatedExisting} / ${skipLabel} (${range.from || '...'} -> ${range.to || '...'}) - tong luu: ${totalStored}${filterSummary}`,
    summary: {
      reason: syncReason,
      range,
      fetched: totalFetched,
      inserted: totalInserted,
      updated: updatedExisting,
      skipped: skippedExisting,
      locked: reviewLocked,
      stored: totalStored,
      includeTaxCodes: Array.from(includeSet),
      excludeTaxCodes: Array.from(excludeSet),
    },
    updatedDeclarations: updatedEntries,
    insertedDeclarations: insertedEntries,
    lockedDeclarations: lockedEntries,
  });

  const updatedSummary = updatedEntries.slice(0, 200).map((entry) => ({
    so_tk: entry.so_tk,
    nhanh: entry.nhanh,
  }));
  const insertedSummary = insertedEntries.slice(0, 200).map((entry) => ({
    so_tk: entry.so_tk,
    nhanh: entry.nhanh,
  }));
  const lockedSummary = lockedEntries.slice(0, 200).map((entry) => ({
    so_tk: entry.so_tk,
    nhanh: entry.nhanh,
  }));
  const updatedKeySet = new Set(updatedEntries.map((entry) => `${entry.so_tk}_${entry.nhanh || ''}`));
  const updatedKeys = Array.from(updatedKeySet).slice(0, 400);
  const lockedKeys = Array.from(lockedMap.keys()).slice(0, 400);

  const nextConfig = saveEcusConfig({
    lastRun: runAtIso,
    lastStatus: 'success',
    lastSummary: {
      runAt: runAtIso,
      rowsFetched: totalFetched,
      rowsInserted: totalInserted,
      rowsUpdated: updatedExisting,
      rowsSkipped: skippedExisting,
      rowsReviewLocked: reviewLocked,
      totalStored,
      existingBefore: existingCount,
      range,
      alerts: alertSummary,
      updatedDeclarations: updatedSummary,
      insertedDeclarations: insertedSummary,
      updatedKeys,
      lockedDeclarations: lockedSummary,
      lockedKeys,
      includeTaxCodes: Array.from(includeSet),
      excludeTaxCodes: Array.from(excludeSet),
    },
  }, { preservePassword: true });

  pushNotification({
    type: 'ecus.sync.completed',
    severity: 'info',
    title: 'Đồng bộ ECUS hoàn tất',
    message:  `+${totalInserted} / cap nhat ${updatedExisting} / ${skipLabel} (tong ${totalStored})`,
    meta: {
      actor,
      reason: syncReason,
      fetched: totalFetched,
      inserted: totalInserted,
      updated: updatedExisting,
      skipped: skippedExisting,
      locked: reviewLocked,
      stored: totalStored,
      range,
      alerts: alertSummary,
      includeTaxCodes: Array.from(includeSet),
      excludeTaxCodes: Array.from(excludeSet),
    },
  });

  recordEcusMonitorSyncSuccess({ runAt: runAtIso, actor });

  return {
    config: nextConfig,
    fetched: totalFetched,
    imported: totalInserted,
    updated: updatedExisting,
    skipped: skippedExisting,
    reviewLocked,
    storedTotal: totalStored,
    existingBefore: existingCount,
    existingAfter: totalStored,
    range,
    alerts: alertSummary,
    runAt: runAtIso,
    updatedDeclarations: updatedSummary,
    insertedDeclarations: insertedSummary,
    lockedDeclarations: lockedSummary,
    includeTaxCodes: Array.from(includeSet),
    excludeTaxCodes: Array.from(excludeSet),
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
    recordEcusMonitorSyncFailure(err, { actor: params?.actor, reason: params?.reason });
    saveEcusConfig({
      lastRun: new Date().toISOString(),
      lastStatus: `error: ${err.message}`,
    }, { preservePassword: true });
    pushAuditLog({
      actor: params?.actor || 'system',
      action: 'ecus.sync_error',
      detail: err.message || 'Đồng bộ ECUS thất bại',
    });
    pushNotification({
      type: 'ecus.sync.error',
      severity: 'error',
      title: 'Đồng bộ ECUS thất bại',
      message: err?.message || 'Không thể đồng bộ dữ liệu từ ECUS.',
      meta: { actor: params?.actor || 'system', reason: params?.reason || 'unknown' },
    });
    throw err;
  }
}

async function buildAiKpiSnapshot(rangeInput = {}, {
  useCache = true,
  includeTaxCodes = null,
  excludeTaxCodes = null,
  actor = 'system',
} = {}) {
  const config = getEcusConfig();
  const connectionConfig = buildSqlConnectionConfig(config);
  if (!connectionConfig.server || !connectionConfig.database) {
    const error = new Error('Chưa cấu hình kết nối SQL Server để lấy snapshot KPI.');
    error.statusCode = 400;
    throw error;
  }

  const range = computeRangeWindow(config, rangeInput || {});
  const includeList = includeTaxCodes === null
    ? Array.isArray(config.includeTaxCodes)
      ? config.includeTaxCodes
      : []
    : normalizeEcusTaxCodeList(includeTaxCodes);
  const excludeList = excludeTaxCodes === null
    ? Array.isArray(config.excludeTaxCodes)
      ? config.excludeTaxCodes
      : []
    : normalizeEcusTaxCodeList(excludeTaxCodes);

  const cacheKey = computeAiSnapshotCacheKey({
    range,
    includeTaxCodes: includeList,
    excludeTaxCodes: excludeList,
    config,
  });
  const cacheTtl = AI_SNAPSHOT_CACHE_TTL_MS;
  if (useCache !== false) {
    const cached = getAiSnapshotCacheEntry(cacheKey, { ttlMs: cacheTtl, maxEntries: AI_SNAPSHOT_CACHE_LIMIT });
    if (cached?.snapshot) {
      return { snapshot: cached.snapshot, cached: true, cacheKey };
    }
  }

  const includeSet = new Set(includeList);
  const excludeSet = new Set(excludeList);
  const context = buildEcusSyncContext({ ...config, includeTaxCodes: includeList, excludeTaxCodes: excludeList });
  const iterator = fetchEcusDeclarations(range, config, {
    includeTaxCodesSet: includeSet,
    excludeTaxCodesSet: excludeSet,
  });

  const mappedRows = [];
  let totalFetched = 0;
  try {
    for await (const batch of iterator) {
      totalFetched += batch.length;
      for (const raw of batch) {
        const mapped = mapEcusRow(raw, config, context);
        if (!mapped) continue;
        if (shouldSkipByMst(mapped, includeSet, excludeSet)) {
          continue;
        }
        mappedRows.push(mapped);
      }
    }
  } catch (err) {
    if (isSqlTimeoutError(err)) {
      recordSqlTimeout({ message: err?.message, context: { actor, reason: 'ai-snapshot' } });
      const timeoutError = new Error('Kết nối SQL Server bị quá thời gian khi lấy snapshot KPI.');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw err;
  }

  const roster = getRosterValue();
  const rules = getRulesValue();
  const adjustments = getJSONValue('kpi_adjustments_v1', []);
  const report = buildReportData(mappedRows, {
    roster,
    rules,
    from: range.from,
    to: range.to,
    adjustments: Array.isArray(adjustments) ? adjustments : [],
  });

  const summarySource = report?.summary || {};
  const summary = {
    declarations: Number(summarySource.decls || 0),
    decls: Number(summarySource.decls || 0),
    import: Number(summarySource.import || 0),
    export: Number(summarySource.export || 0),
    items: Number(summarySource.items || 0),
    licenses: Number(summarySource.licenses || 0),
    companyCount: Number(summarySource.companyCount || 0),
    kpi: Number(summarySource.kpi || 0),
    co: Number(summarySource.co || 0),
    coLines: Number(summarySource.coLines || 0),
    licenseSummary: summarySource.licenseSummary || '—',
    licenseSamples: Array.isArray(summarySource.licenseCodes)
      ? summarySource.licenseCodes.slice(0, 12)
      : [],
    adjustmentTotals: cloneJson(summarySource.adjustmentTotals || {}),
  };

  const staffList = Array.isArray(report?.staff?.list) ? report.staff.list : [];
  const topStaff = staffList.slice(0, 10).map((entry) => ({
    key: entry.key,
    name: entry.name,
    declarations: Number(entry?.stats?.decls || 0),
    totalKpi: Number(entry?.stats?.kpi || 0),
    items: Number(entry?.stats?.items || 0),
    teams: Array.isArray(entry?.teamNames) ? entry.teamNames : [],
    adjustmentSummary: cloneJson(entry?.adjustmentSummary || {}),
  }));

  const teams = Array.isArray(report?.teams?.list) ? report.teams.list : [];
  const topTeams = teams.slice(0, 10).map((team) => ({
    key: team.key,
    name: team.name,
    declarations: Number(team?.stats?.decls || 0),
    totalKpi: Number(team?.stats?.kpi || 0),
    members: Array.isArray(team?.members)
      ? team.members.slice(0, 5).map((member) => ({
          key: member.key,
          name: member.name,
          declarations: Number(member?.stats?.decls || 0),
          totalKpi: Number(member?.stats?.kpi || 0),
        }))
      : [],
    adjustmentSummary: cloneJson(team?.adjustmentSummary || {}),
  }));

  const trendSeries = Array.isArray(report?.trend?.series) ? report.trend.series : [];
  const monthlyTrend = trendSeries.map((item) => ({
    month: item.period || '',
    period: item.period || '',
    declarations: Number(item.decls || item.declarations || 0),
    items: Number(item.items || 0),
    licenses: Number(item.licenses || 0),
    kpi: Number(item.kpi || 0),
  }));
  const teamTrendSeries = Array.isArray(report?.trend?.teamSeries)
    ? cloneJson(report.trend.teamSeries)
    : [];
  const comparisonTrend = report?.trend?.comparison ? cloneJson(report.trend.comparison) : null;

  const adjustmentsMeta = report?.adjustments || {};
  const adjustmentsSummary = {
    totals: {
      pending: Number(adjustmentsMeta.pendingCount || 0),
      approved: Number(adjustmentsMeta.approvedCount || 0),
      rejected: Number(adjustmentsMeta.rejectedCount || 0),
      applied: Number(adjustmentsMeta.appliedCount || 0),
      totalPoints: Number(adjustmentsMeta.totalPoints || 0),
    },
    totalsByCategory: cloneJson(adjustmentsMeta.totalsByCategory || {}),
    staffSummaries: cloneJson(adjustmentsMeta.staffSummaries || []),
    teamSummaries: cloneJson(adjustmentsMeta.teamSummaries || []),
    sample: Array.isArray(adjustmentsMeta.list) ? adjustmentsMeta.list.slice(0, 20) : [],
  };

  const rawDeclarations = Array.isArray(report?.rows)
    ? report.rows
        .filter((row) => !row?.isAdjustment)
        .slice(0, 50)
        .map((row) => ({
          date: row.date || '',
          so_tk: row.so_tk || '',
          mst: row.mst || '',
          cong_ty: row.cong_ty || '',
          loai_hinh: row.loai_hinh || '',
          nhan_vien: row.nhan_vien || '',
          team: row.team || '',
          kpi: Number(row.kpi || 0),
          num_items: Number(row.num_items || 0),
          licenses: Number(row.licenses || 0),
          isExport: !!row.isExport,
          hasCO: !!row.hasCO,
          licenseCodes: Array.isArray(row.licenseCodes) ? row.licenseCodes.slice(0, 10) : [],
        }))
    : [];

  const snapshot = {
    generatedAt: new Date().toISOString(),
    range: { from: range.from || '', to: range.to || '' },
    filters: { includeTaxCodes: includeList, excludeTaxCodes: excludeList },
    source: {
      server: connectionConfig.server,
      database: connectionConfig.database,
    },
    summary,
    totals: {
      rowsFetched: totalFetched,
      declarations: mappedRows.length,
    },
    topStaff,
    topTeams,
    trends: {
      monthly: monthlyTrend,
      teamSeries: teamTrendSeries,
      comparison: comparisonTrend,
    },
    adjustments: adjustmentsSummary,
    rawDeclarations,
  };

  storeAiSnapshotCacheEntry(
    {
      key: cacheKey,
      cachedAt: snapshot.generatedAt,
      range: snapshot.range,
      filters: snapshot.filters,
      snapshot,
    },
    { actor, ttlMs: cacheTtl, maxEntries: AI_SNAPSHOT_CACHE_LIMIT }
  );

  return { snapshot, cached: false, cacheKey };
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
      try {
        scheduledSync.stop();
      } catch (err) {
        console.warn('Khong the dung lich dong bo ECUS hien tai', err);
      }
      scheduledSync = null;
    }
    return;
  }

  if (scheduledSync) {
    try {
      scheduledSync.stop();
    } catch (err) {
      console.warn('Khong the dung lich dong bo ECUS hien tai', err);
    }
    scheduledSync = null;
  }

  const config = getEcusConfig();
  if (!config.enabled || !config.schedule) {
    return;
  }

  const cronExpr = normalizeCronExpression(config.schedule);
  if (!cronExpr) {
    return;
  }
  if (typeof cron.validate === 'function' && !cron.validate(cronExpr)) {
    console.warn('ECUS sync cron expression invalid:', cronExpr);
    return;
  }

  try {
    scheduledSync = cron.schedule(cronExpr, () => {
      runEcusSyncWithErrorHandling({ actor: 'scheduler', reason: 'scheduled' }).catch(() => {});
    });
  } catch (err) {
    console.error('Không thể thiết lập lịch đồng bộ ECUS:', err);
  }
}

async function runCoDiscrepancyCheck({ actor = 'system', reason = 'auto', range = null } = {}) {
  const config = getCoDiscrepancyConfig();
  const ecusConfig = getEcusConfig();
  const connectionConfig = buildSqlConnectionConfig(ecusConfig);
  if (!connectionConfig.server || !connectionConfig.database) {
    const error = new Error('Chưa cấu hình kết nối SQL Server cho chức năng đối soát C/O.');
    error.statusCode = 400;
    throw error;
  }
  const effectiveRange = range && typeof range === 'object'
    ? {
        from: range.from || '',
        to: range.to || '',
      }
    : computeRangeWindow({ rangeDays: config.rangeDays }, {});
  const limit = Number.isFinite(Number(config.sampleLimit))
    ? Math.max(0, Math.floor(Number(config.sampleLimit)))
    : 0;
  const startedAt = Date.now();
  try {
    const preview = await previewEcusSync(effectiveRange, { limit });
    const rows = Array.isArray(preview?.rows) ? preview.rows : [];
    const storedRows = getDeclRows();
    const storedMap = new Map();
    for (const row of storedRows) {
      const key = getDeclarationKey(row);
      if (!key) continue;
      storedMap.set(key, row);
    }
    const mismatches = [];
    for (const row of rows) {
      const key = getDeclarationKey(row);
      if (!key) {
        continue;
      }
      const stored = storedMap.get(key);
      if (!stored) {
        continue;
      }
      const storedCount = Number(stored?.co_line_count) || 0;
      const remoteCount = Number(row?.co_line_count) || 0;
      const storedHasCo = !!(stored?.has_co || storedCount > 0 || (stored?.co && stored.co.trim()));
      const remoteHasCo = !!(row?.has_co || remoteCount > 0 || (row?.co && row.co.trim()));
      if (storedCount === remoteCount && storedHasCo === remoteHasCo) {
        continue;
      }
      mismatches.push({
        key,
        so_tk: row.so_tk,
        so_tk_full: row.so_tk_full || row.so_tk,
        nhanh: normalizeStr(row.nhanh || row.branch || ''),
        stored: {
          co_line_count: storedCount,
          has_co: storedHasCo,
          co: stored?.co || '',
          co_codes: Array.isArray(stored?.co_codes) ? stored.co_codes : [],
        },
        remote: {
          co_line_count: remoteCount,
          has_co: remoteHasCo,
          co: row.co || '',
          co_codes: Array.isArray(row?.co_codes) ? row.co_codes : [],
        },
      });
    }
    const mismatchCount = mismatches.length;
    const totalChecked = rows.length;
    const limited = !!preview?.limited;
    const durationMs = Date.now() - startedAt;
    const triggered = mismatchCount >= config.threshold;
    const state = saveCoDiscrepancyState({
      lastRunAt: new Date().toISOString(),
      range: effectiveRange,
      mismatchCount,
      totalChecked,
      mismatches: mismatches.slice(0, 200),
      limited,
      durationMs,
      status: 'ok',
      triggered,
      actor,
      reason,
      error: null,
    });
    if (triggered) {
      pushImportLog({
        kind: 'co-discrepancy',
        actor,
        message: `Kiem tra CO: ${mismatchCount}/${totalChecked} to khai lech thong tin (nguong ${config.threshold})`,
        summary: {
          range: effectiveRange,
          mismatchCount,
          totalChecked,
          threshold: config.threshold,
          durationMs,
        },
        updatedDeclarations: mismatches,
      });
      pushAuditLog({
        actor,
        action: 'co.discrepancy',
        detail: `Phat hien ${mismatchCount} to khai lech thong tin CO`,
        meta: { range: effectiveRange, totalChecked, threshold: config.threshold },
      });
    }
    return { ok: true, config, state };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const fallbackRange = range && typeof range === 'object'
      ? { from: range.from || '', to: range.to || '' }
      : computeRangeWindow({ rangeDays: config.rangeDays }, {});
    saveCoDiscrepancyState({
      lastRunAt: new Date().toISOString(),
      range: fallbackRange,
      mismatchCount: 0,
      totalChecked: 0,
      mismatches: [],
      limited: false,
      durationMs,
      status: 'error',
      triggered: false,
      actor,
      reason,
      error: err?.message || 'Unknown error',
    });
    pushImportLog({
      kind: 'co-discrepancy',
      actor,
      message: `Kiem tra CO that bai: ${err?.message || 'Unknown error'}`,
      summary: { range: fallbackRange, error: err?.message || 'Unknown error' },
    });
    let errorToThrow = err;
    if (!errorToThrow || typeof errorToThrow !== 'object') {
      errorToThrow = new Error('Khong the chay kiem tra CO');
    }
    if (!errorToThrow.statusCode) {
      if (isSqlTimeoutError(err)) {
        errorToThrow = new Error('Kết nối SQL Server bị quá thời gian khi chạy đối soát C/O.');
        errorToThrow.statusCode = 504;
      } else if (err && typeof err === 'object' && (err.code === 'ELOGIN' || err.code === 'ESOCKET')) {
        errorToThrow = new Error('Không thể đăng nhập SQL Server để đối soát C/O.');
        errorToThrow.statusCode = 502;
      } else {
        errorToThrow.statusCode = 500;
      }
    }
    throw errorToThrow;
  }
}

function refreshCoDiscrepancySchedule() {
  if (coDiscrepancyJob) {
    try {
      coDiscrepancyJob.stop();
    } catch (err) {
      console.warn('Khong the dung lich kiem tra CO hien tai', err);
    }
    coDiscrepancyJob = null;
  }
  if (process.env.KPI_DISABLE_CRON === '1') {
    return;
  }
  const config = getCoDiscrepancyConfig();
  if (!config.enabled) {
    return;
  }
  const cronExpr = normalizeCronExpression(config.cron);
  if (!cronExpr || cronExpr.toLowerCase() === 'never') {
    return;
  }
  if (typeof cron.validate === 'function' && !cron.validate(cronExpr)) {
    console.warn('CO discrepancy cron expression invalid:', cronExpr);
    return;
  }
  try {
    coDiscrepancyJob = cron.schedule(cronExpr, () => {
      runCoDiscrepancyCheck({ actor: 'scheduler', reason: 'scheduled' }).catch((err) => {
        console.error('Chay lich kiem tra CO that bai', err);
      });
    });
  } catch (err) {
    console.error('Khong the thiet lap lich kiem tra CO:', err);
  }
}


export const app = express();

onSqlTimeout((event) => {
  pushNotification({
    type: 'sql.timeout',
    severity: 'warning',
    title: 'SQL Server phản hồi chậm',
    message: event?.message || 'Ghi nhận lỗi timeout khi kết nối SQL Server.',
    meta: event?.context ? { context: event.context } : null,
  });
});
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

function logAiHttpsAddresses({ port, host, certPath }) {
  const normalizedHost = host || '127.0.0.1';
  const displayHost = normalizedHost === '0.0.0.0' || normalizedHost === '::' ? 'localhost' : normalizedHost;
  console.log(`[AI HTTPS] Đang phục vụ endpoint AI qua https://${displayHost}:${port}`);
  if (certPath) {
    console.log(`[AI HTTPS] Sử dụng chứng chỉ: ${certPath}`);
  }
}

export {
  runEcusSyncWithErrorHandling,
  previewEcusSync,
  runEcusSync,
  getEcusConfig,
  saveEcusConfig,
  formatEcusConfigForClient,
  buildEcusSyncMonitorSnapshot,
  getEcusMonitorHistory,
  appendEcusMonitorHistory,
  clearEcusMonitorHistory,
  buildEcusMonitorMetrics,
  buildEcusMonitorSeries,
};


app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

const monitorAccessToken = (process.env.MONITOR_ACCESS_TOKEN || '').trim();

app.get('/api/internal/monitor/ecus-sync', async (req, res) => {
  if (!monitorAccessToken) {
    res.status(503).json({ ok: false, error: 'Chưa cấu hình MONITOR_ACCESS_TOKEN trên máy chủ.' });
    return;
  }

  const providedToken = String(req.get('x-monitor-token') || req.query.token || '').trim();
  if (!providedToken || providedToken !== monitorAccessToken) {
    res.status(403).json({ ok: false, error: 'Token xác thực không hợp lệ.' });
    return;
  }

  try {
    const snapshot = await buildEcusSyncMonitorSnapshot();
    res.json({ ok: true, snapshot });
  } catch (err) {
    console.error('Không thể tạo snapshot giám sát ECUS', err);
    res.status(500).json({ ok: false, error: err?.message || 'Không thể tổng hợp trạng thái đồng bộ ECUS.' });
  }
});

app.get('/api/internal/monitor/ecus-sync/metrics', async (req, res) => {
  if (!monitorAccessToken) {
    res.status(503).json({ ok: false, error: 'Chưa cấu hình MONITOR_ACCESS_TOKEN trên máy chủ.' });
    return;
  }

  const providedToken = String(req.get('x-monitor-token') || req.query.token || '').trim();
  if (!providedToken || providedToken !== monitorAccessToken) {
    res.status(403).json({ ok: false, error: 'Token xác thực không hợp lệ.' });
    return;
  }

  try {
    const history = getEcusMonitorHistory();
    const metrics = buildEcusMonitorMetrics({ history });
    const limit = toPositiveInt(req.query?.limit, 288) || 288;
    const boundedLimit = Math.max(1, Math.min(limit, history.entries.length || limit));
    const entries = history.entries.slice(-boundedLimit);
    const series = buildEcusMonitorSeries(entries, { thresholds: metrics.thresholds });

    metrics.history = {
      totalEntries: history.entries.length,
      returnedEntries: entries.length,
      updatedAt: history.updatedAt,
      entries,
    };
    metrics.series = series;

    res.json({ ok: true, metrics });
  } catch (err) {
    console.error('Không thể tổng hợp dữ liệu dashboard giám sát ECUS', err);
    res.status(500).json({ ok: false, error: 'Không thể tổng hợp dữ liệu dashboard giám sát ECUS.' });
  }
});

app.get('/api/filter-presets', (req, res) => {
  const context = getSessionContext(req);
  if (!context) {
    res.status(401).json({ ok: false, error: 'Bạn cần đăng nhập để sử dụng bộ lọc đã lưu.' });
    return;
  }
  try {
    const scope = sanitizeFilterPresetScope(req.query?.scope);
    const { presets, updatedAt } = listFilterPresetsForUser(context.account.username, { scope });
    res.json({ ok: true, scope, presets, updatedAt });
  } catch (err) {
    console.error('Không thể tải bộ lọc đã lưu', err);
    res.status(500).json({ ok: false, error: 'Không thể tải bộ lọc đã lưu.' });
  }
});

app.post('/api/filter-presets', (req, res) => {
  const context = getSessionContext(req);
  if (!context) {
    res.status(401).json({ ok: false, error: 'Bạn cần đăng nhập để lưu bộ lọc.' });
    return;
  }
  try {
    const result = createFilterPresetForUser(context.account.username, req.body || {}, {
      actor: context.account.username,
    });
    pushAuditLog({
      actor: context.account.username,
      action: 'filter.preset.create',
      detail: `Tạo bộ lọc "${result.preset.name}" (scope ${result.preset.scope})`,
    });
    res.status(201).json({ ok: true, preset: result.preset, updatedAt: result.updatedAt });
  } catch (err) {
    console.error('Không thể lưu bộ lọc đã lưu', err);
    if (err?.code === 'INVALID_FILTERS') {
      res.status(400).json({ ok: false, error: 'Không có điều kiện lọc hợp lệ để lưu.' });
      return;
    }
    if (err?.code === 'INVALID_USER') {
      res.status(400).json({ ok: false, error: 'Thiếu thông tin tài khoản để lưu bộ lọc.' });
      return;
    }
    res.status(500).json({ ok: false, error: 'Không thể lưu bộ lọc đã lưu.' });
  }
});

app.put('/api/filter-presets/:presetId', (req, res) => {
  const context = getSessionContext(req);
  if (!context) {
    res.status(401).json({ ok: false, error: 'Bạn cần đăng nhập để cập nhật bộ lọc.' });
    return;
  }
  try {
    const result = updateFilterPresetForUser(context.account.username, req.params.presetId, req.body || {}, {
      actor: context.account.username,
    });
    pushAuditLog({
      actor: context.account.username,
      action: 'filter.preset.update',
      detail: `Cập nhật bộ lọc "${result.preset.name}"`,
    });
    res.json({ ok: true, preset: result.preset, updatedAt: result.updatedAt });
  } catch (err) {
    console.error('Không thể cập nhật bộ lọc đã lưu', err);
    if (err?.code === 'INVALID_ID') {
      res.status(400).json({ ok: false, error: 'Thiếu mã bộ lọc cần cập nhật.' });
      return;
    }
    if (err?.code === 'INVALID_FILTERS') {
      res.status(400).json({ ok: false, error: 'Không có điều kiện lọc hợp lệ để lưu.' });
      return;
    }
    if (err?.code === 'NOT_FOUND') {
      res.status(404).json({ ok: false, error: 'Không tìm thấy bộ lọc đã lưu tương ứng.' });
      return;
    }
    if (err?.code === 'INVALID_USER') {
      res.status(400).json({ ok: false, error: 'Thiếu thông tin tài khoản để cập nhật bộ lọc.' });
      return;
    }
    res.status(500).json({ ok: false, error: 'Không thể cập nhật bộ lọc đã lưu.' });
  }
});

app.delete('/api/filter-presets/:presetId', (req, res) => {
  const context = getSessionContext(req);
  if (!context) {
    res.status(401).json({ ok: false, error: 'Bạn cần đăng nhập để xoá bộ lọc.' });
    return;
  }
  try {
    const result = deleteFilterPresetForUser(context.account.username, req.params.presetId, {
      actor: context.account.username,
    });
    pushAuditLog({
      actor: context.account.username,
      action: 'filter.preset.delete',
      detail: `Xoá bộ lọc "${result.removed?.name || req.params.presetId}"`,
    });
    res.json({ ok: true, deleted: result.deleted, updatedAt: result.updatedAt });
  } catch (err) {
    console.error('Không thể xoá bộ lọc đã lưu', err);
    if (err?.code === 'INVALID_ID') {
      res.status(400).json({ ok: false, error: 'Thiếu mã bộ lọc cần xoá.' });
      return;
    }
    if (err?.code === 'NOT_FOUND') {
      res.status(404).json({ ok: false, error: 'Không tìm thấy bộ lọc đã lưu tương ứng.' });
      return;
    }
    if (err?.code === 'INVALID_USER') {
      res.status(400).json({ ok: false, error: 'Thiếu thông tin tài khoản để xoá bộ lọc.' });
      return;
    }
    res.status(500).json({ ok: false, error: 'Không thể xoá bộ lọc đã lưu.' });
  }
});

app.get('/api/data-health/summary', async (req, res) => {
  try {
    const summary = await buildDataHealthSummary();
    res.json({ ok: true, summary });
  } catch (err) {
    console.error('Không thể xây dựng báo cáo sức khỏe dữ liệu', err);
    res.status(500).json({ ok: false, error: err?.message || 'Không thể tải sức khỏe dữ liệu' });
  }
});

app.get('/api/duplicate-policy', (req, res) => {
  const { denied } = requireDuplicatePolicyManage(req, res);
  if (denied) {
    return;
  }
  try {
    const config = getDuplicatePolicyConfig();
    const state = getDuplicatePolicyState();
    const summary = summarizeDuplicateGroups(getDeclRows(), { lockedSources: state.lockedSources });
    res.json({
      ok: true,
      config,
      state: {
        lastEvaluatedAt: state.lastEvaluatedAt || null,
        notifiedCount: Object.keys(state.notifiedGroups || {}).length,
        lockedSources: Object.entries(state.lockedSources || {}).map(([source, meta]) => ({
          source,
          lockedAt: meta?.lockedAt || null,
          lockedBy: meta?.lockedBy || null,
          reason: meta?.reason || '',
          note: meta?.note || '',
          auto: meta?.auto === true,
          manual: meta?.manual === true,
          unlockedAt: meta?.unlockedAt || null,
          unlockedBy: meta?.unlockedBy || null,
        })),
      },
      summary: {
        statusCounts: summary.statusCounts,
        sourceBreakdown: summary.sourceBreakdown,
      },
    });
  } catch (err) {
    console.error('Không thể tải chính sách trùng 11 số', err);
    res.status(500).json({ ok: false, error: 'Không thể tải chính sách trùng 11 số' });
  }
});

app.put('/api/duplicate-policy', (req, res) => {
  const { denied, context } = requireDuplicatePolicyManage(req, res);
  if (denied) {
    return;
  }
  const actor = context?.account?.username || 'system';
  try {
    const body = req.body || {};
    let config = getDuplicatePolicyConfig();
    if (body.config && typeof body.config === 'object') {
      config = saveDuplicatePolicyConfig(body.config, { actor });
    }

    let state = getDuplicatePolicyState();
    let stateChanged = false;
    const nextLocked = { ...(state.lockedSources || {}) };

    if (Array.isArray(body.unlockSources)) {
      for (const entry of body.unlockSources) {
        const key = normalizeDuplicateSourceKey(entry);
        if (!key) continue;
        if (nextLocked[key]) {
          delete nextLocked[key];
          stateChanged = true;
          pushNotification({
            type: 'duplicate.policy.unlock',
            severity: 'success',
            title: `Mở khóa nguồn ${key}`,
            message: `Nguồn ${key} được mở khóa thủ công bởi ${actor}.`,
            meta: { source: key, actor },
          });
          pushAuditLog({ actor, action: 'duplicate.policy.unlock', detail: `Mở khóa nguồn ${key} thủ công` });
        }
      }
    }

    if (Array.isArray(body.lockSources)) {
      for (const entry of body.lockSources) {
        if (!entry) continue;
        const sourceKey = normalizeDuplicateSourceKey(entry.source || entry.name || entry.key || entry);
        if (!sourceKey) continue;
        const note = typeof entry.note === 'string' ? entry.note : '';
        const reason = typeof entry.reason === 'string' && entry.reason.trim()
          ? entry.reason.trim()
          : 'Khóa thủ công bởi quản trị viên';
        nextLocked[sourceKey] = {
          lockedAt: new Date().toISOString(),
          lockedBy: actor,
          reason,
          note,
          auto: false,
          manual: true,
          unlockedAt: null,
          unlockedBy: null,
        };
        pushNotification({
          type: 'duplicate.policy.lock',
          severity: 'warning',
          title: `Khóa nguồn ${sourceKey}`,
          message: `Nguồn ${sourceKey} bị khóa thủ công bởi ${actor}.`,
          meta: { source: sourceKey, actor },
        });
        pushAuditLog({ actor, action: 'duplicate.policy.lock', detail: `Khóa nguồn ${sourceKey} thủ công` });
        stateChanged = true;
      }
    }

    if (stateChanged) {
      state = { ...state, lockedSources: nextLocked };
      saveDuplicatePolicyState(state, { actor, source: 'duplicate-policy-manual' });
    }

    const evaluation = evaluateDuplicatePolicies({ config, state, actor, force: true });
    const effectiveState = evaluation?.state || state;
    const summary = evaluation?.summary || summarizeDuplicateGroups(getDeclRows(), {
      lockedSources: effectiveState.lockedSources,
    });

    res.json({
      ok: true,
      config,
      state: {
        lastEvaluatedAt: effectiveState.lastEvaluatedAt || null,
        lockedSources: Object.entries(effectiveState.lockedSources || {}).map(([source, meta]) => ({
          source,
          lockedAt: meta?.lockedAt || null,
          lockedBy: meta?.lockedBy || null,
          reason: meta?.reason || '',
          note: meta?.note || '',
          auto: meta?.auto === true,
          manual: meta?.manual === true,
          unlockedAt: meta?.unlockedAt || null,
          unlockedBy: meta?.unlockedBy || null,
        })),
      },
      summary: {
        statusCounts: summary.statusCounts,
        sourceBreakdown: summary.sourceBreakdown,
      },
    });
  } catch (err) {
    console.error('Không thể cập nhật chính sách trùng 11 số', err);
    res.status(500).json({ ok: false, error: 'Không thể cập nhật chính sách trùng 11 số' });
  }
});

app.get('/api/training-resources', async (req, res) => {
  try {
    const resources = await getTrainingResources();
    res.json({ ok: true, resources });
  } catch (err) {
    console.error('Không thể tải danh sách tài liệu đào tạo', err);
    res.status(500).json({ ok: false, error: 'Không thể tải tài liệu đào tạo' });
  }
});

app.get('/api/feedback/summary', async (req, res) => {
  try {
    const summary = await getFeedbackSummary();
    res.json({ ok: true, summary });
  } catch (err) {
    console.error('Không thể tổng hợp phản hồi người dùng', err);
    res.status(500).json({ ok: false, error: 'Không thể tổng hợp phản hồi' });
  }
});

app.get('/api/feedback', async (req, res) => {
  const { denied } = requireFeedbackReview(req, res);
  if (denied) {
    return;
  }
  try {
    const limitRaw = Number.parseInt(req.query?.limit ?? '50', 10);
    const entries = await listFeedbackEntries({
      limit: Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 50,
    });
    res.json({ ok: true, entries });
  } catch (err) {
    console.error('Không thể tải phản hồi người dùng', err);
    res.status(500).json({ ok: false, error: 'Không thể tải phản hồi người dùng' });
  }
});

app.post('/api/feedback', async (req, res) => {
  const session = getSessionContext(req);
  const body = req.body || {};
  try {
    const entry = await addFeedbackEntry({
      category: typeof body.category === 'string' ? body.category : 'khac',
      rating: body.rating,
      message: body.message,
      actor: session?.account?.username || body.actor,
      contact: body.contact,
      meta: body.meta,
    });
    pushNotification({
      type: 'feedback.new',
      severity: 'info',
      title: 'Phản hồi mới từ người dùng',
      message: `${entry.actor || 'Người dùng ẩn danh'} vừa gửi góp ý: ${entry.category}`,
      meta: { feedbackId: entry.id },
    });
    res.status(201).json({ ok: true, entry });
  } catch (err) {
    console.error('Không thể lưu phản hồi người dùng', err);
    res.status(400).json({ ok: false, error: err?.message || 'Không thể lưu phản hồi' });
  }
});

app.get('/api/notifications', (req, res) => {
  const { denied } = requireNotificationAccess(req, res);
  if (denied) {
    return;
  }
  try {
    const limitRaw = Number.parseInt(req.query?.limit ?? '50', 10);
    const events = listNotifications({ limit: Number.isFinite(limitRaw) ? limitRaw : 50 });
    res.json({ ok: true, events });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Không thể tải thông báo' });
  }
});

app.get('/api/notifications/stream', (req, res) => {
  const { denied } = requireNotificationAccess(req, res);
  if (denied) {
    if (!res.headersSent) {
      res.end();
    }
    return;
  }
  registerSseClient(res);
});

app.get('/api/bootstrap', async (req, res) => {
  try {
    await maybeSyncMstHistoryFromSql();
  } catch (err) {
    console.warn('Không thể đồng bộ lịch sử Gán MST khi bootstrap', err);
  }
  try {
    await maybeSyncAccountsFromSql();
  } catch (err) {
    console.warn('Không thể đồng bộ tài khoản từ SQL Server khi bootstrap', err);
  }
  const store = buildBootstrapSnapshot();
  res.json({ data: store });
});

app.get('/api/hq/history', (req, res) => {
  const { denied } = requireHqHistoryAccess(req, res);
  if (denied) {
    return;
  }
  try {
    const result = queryHqHistoryEntries(req.query || {});
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Không thể tải lịch sử Đại lý HQ', err);
    res.status(500).json({ ok: false, error: 'Không thể tải lịch sử Đại lý HQ' });
  }
});

app.get('/api/admin/backups/summary', (req, res) => {
  const { denied } = requireAuditView(req, res);
  if (denied) {
    return;
  }
  try {
    const limitRaw = Number.parseInt(req.query?.limit ?? '10', 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 10;
    const summary = buildBackupSummary({ limit });
    res.json({ ok: true, summary });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Không thể tải thông tin sao lưu' });
  }
});

app.get('/api/admin/backups/files', async (req, res) => {
  const { denied } = requireAdminBackupManage(req, res);
  if (denied) {
    return;
  }
  try {
    const limitRaw = Number.parseInt(req.query?.limit ?? '50', 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 50;
    const files = await listBackupFiles({ limit });
    res.json({ ok: true, files });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Không thể tải danh sách bản sao lưu' });
  }
});

app.post('/api/admin/backups/run', async (req, res) => {
  const { context, denied } = requireAdminBackupManage(req, res);
  if (denied) {
    return;
  }
  try {
    const body = req.body ?? {};
    const reasonRaw = typeof body.reason === 'string' ? body.reason.trim() : '';
    const reason = reasonRaw || 'manual';
    const note = typeof body.note === 'string' ? body.note : null;
    const retention = Number.isFinite(body.retention) ? Number(body.retention) : undefined;
    const result = await performDatabaseBackup({
      reason,
      retention,
      actor: context.account?.username || 'system',
      note,
    });
    if (result?.ok === false) {
      const message =
        translateBackupFailure(result.reason) ||
        translateBackupReason(result.reason) ||
        'Không thể sao lưu CSDL.';
      const status = ['in_progress', 'restore_in_progress'].includes(result.reason) ? 409 : 400;
      res.status(status).json({ ok: false, error: message, reason: result.reason });
      return;
    }
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Không thể thực hiện sao lưu ngay' });
  }
});

app.post('/api/admin/backups/schedule', (req, res) => {
  const { context, denied } = requireAdminBackupManage(req, res);
  if (denied) {
    return;
  }
  try {
    const body = req.body ?? {};
    const cronExpr = normalizeCronExpression(body?.cron);
    if (!cronExpr) {
      res.status(400).json({ ok: false, error: 'Vui lòng nhập biểu thức cron.' });
      return;
    }
    if (cronExpr.toLowerCase() !== 'never' && typeof cron.validate === 'function' && !cron.validate(cronExpr)) {
      res.status(400).json({ ok: false, error: 'Biểu thức cron không hợp lệ.' });
      return;
    }
    const hasRetentionField =
      Object.prototype.hasOwnProperty.call(body, 'retentionCopies') ||
      Object.prototype.hasOwnProperty.call(body, 'retention');
    let retentionValue;
    if (hasRetentionField) {
      const rawRetention = Object.prototype.hasOwnProperty.call(body, 'retentionCopies')
        ? body.retentionCopies
        : body.retention;
      if (rawRetention === null || (typeof rawRetention === 'string' && rawRetention.trim() === '')) {
        retentionValue = null;
      } else if (typeof rawRetention === 'number') {
        if (!Number.isFinite(rawRetention) || rawRetention < 0) {
          res
            .status(400)
            .json({ ok: false, error: 'Số bản sao lưu giữ lại phải là số nguyên không âm.', field: 'retentionCopies' });
          return;
        }
        retentionValue = Math.trunc(rawRetention);
      } else if (typeof rawRetention === 'string') {
        const trimmed = rawRetention.trim();
        if (!/^\d+$/u.test(trimmed)) {
          res
            .status(400)
            .json({ ok: false, error: 'Số bản sao lưu giữ lại phải là số nguyên không âm.', field: 'retentionCopies' });
          return;
        }
        retentionValue = Number.parseInt(trimmed, 10);
      } else {
        res
          .status(400)
          .json({ ok: false, error: 'Số bản sao lưu giữ lại phải là số nguyên không âm.', field: 'retentionCopies' });
        return;
      }
    }

    const config = saveBackupConfig(
      hasRetentionField ? { cron: cronExpr, retentionCopies: retentionValue } : { cron: cronExpr }
    );
    refreshDatabaseBackupSchedule();
    const actor = context.account?.username || 'system';
    pushAuditLog({
      actor,
      action: 'db.backup_schedule.update',
      detail: 'Cập nhật lịch sao lưu CSDL',
      meta: { cron: cronExpr, retentionCopies: config.retentionCopies },
    });
    const summary = buildBackupSummary();
    res.json({ ok: true, config, summary });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Không thể cập nhật lịch sao lưu' });
  }
});

app.post('/api/admin/backups/restore', async (req, res) => {
  const { context, denied } = requireAdminBackupManage(req, res);
  if (denied) {
    return;
  }
  try {
    const body = req.body ?? {};
    const filename = typeof body.filename === 'string' ? body.filename : '';
    const note = typeof body.note === 'string' ? body.note : null;
    const result = await restoreDatabaseBackup({
      filename,
      actor: context.account?.username || 'system',
      note,
    });
    if (result?.ok === false) {
      const message =
        translateBackupFailure(result.reason) ||
        translateBackupReason(result.reason) ||
        'Không thể khôi phục CSDL.';
      const conflictReasons = ['restore_in_progress', 'backup_in_progress'];
      const status = conflictReasons.includes(result.reason)
        ? 409
        : result.reason === 'missing_filename'
        ? 400
        : 400;
      res.status(status).json({ ok: false, error: message, reason: result.reason });
      return;
    }
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Không thể khôi phục CSDL' });
  }
});

app.get('/api/admin/audit/export', (req, res) => {
  const { denied } = requireAuditView(req, res);
  if (denied) {
    return;
  }

  const fromDate = normalizeRangeDate(req.query?.from);
  const toDate = normalizeRangeDate(req.query?.to, { isEnd: true });
  const type = typeof req.query?.type === 'string' ? req.query.type.trim().toLowerCase() : '';
  const actionFilter = typeof req.query?.action === 'string' ? req.query.action.trim().toLowerCase() : '';

  try {
    const logs = getJSONValue('audit_logs_v1', []);
    const filtered = logs.filter((entry) => {
      if (!entry || typeof entry !== 'object') {
        return false;
      }
      const ts = entry.ts ? Date.parse(entry.ts) : Number.NaN;
      if (fromDate && Number.isFinite(ts) && ts < fromDate.getTime()) {
        return false;
      }
      if (toDate && Number.isFinite(ts) && ts > toDate.getTime()) {
        return false;
      }
      const category = (entry.category || inferAuditCategory(entry.action || '')).toString().toLowerCase();
      if (type && category !== type) {
        return false;
      }
      if (actionFilter) {
        const action = (entry.action || '').toString().toLowerCase();
        if (!action.includes(actionFilter)) {
          return false;
        }
      }
      return true;
    });

    const formatCsvValue = (value) => {
      if (value === null || value === undefined) {
        return '""';
      }
      const text = `${value}`.replace(/"/g, '""');
      return `"${text}"`;
    };

    const rows = [
      ['Thời gian', 'Loại', 'Hành động', 'Người thực hiện', 'Kết quả', 'Chi tiết', 'Ghi chú', 'Metadata'],
      ...filtered.map((entry) => [
        entry.ts || '',
        entry.category || inferAuditCategory(entry.action || ''),
        entry.action || '',
        entry.actor || 'system',
        entry.result || '',
        entry.detail || '',
        entry.note || '',
        entry.meta ? JSON.stringify(entry.meta) : '',
      ]),
    ];

    const csvContent = rows.map((row) => row.map((cell) => formatCsvValue(cell)).join(',')).join('\r\n');
    const payload = `\ufeff${csvContent}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${Date.now()}.csv"`);
    res.send(payload);
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Không thể xuất nhật ký' });
  }
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
    const ipHeader = req.headers['x-forwarded-for'];
    const ipAddress = Array.isArray(ipHeader) ? ipHeader[0] : ipHeader || req.ip || '';
    const requestId = crypto.randomUUID();
    const { buffer, filename, signature, watermark } = await generateReport(kind, payload, {
      watermark: {
        actor: context.account?.username,
        actorName: context.account?.name,
        kind,
        filters: payload,
        ipAddress,
        requestId,
      },
    });

    if (signature) {
      res.setHeader('X-KPI-Export-Signature', signature);
    }
    if (watermark?.shortSignature) {
      res.setHeader('X-KPI-Export-Code', watermark.shortSignature);
    }
    if (watermark?.formattedIssuedAt) {
      res.setHeader('X-KPI-Export-Issued-At', watermark.formattedIssuedAt);
    }
    if (watermark?.requestId) {
      res.setHeader('X-KPI-Export-Request', watermark.requestId);
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setAttachmentHeaders(res, filename);
    res.send(buffer);

    const actor = context.account?.username || 'unknown';
    const requestUserAgent = Array.isArray(req.headers['user-agent'])
      ? req.headers['user-agent'][0]
      : req.headers['user-agent'] || '';
    const issuedAtIso =
      watermark?.issuedAt instanceof Date && !Number.isNaN(watermark.issuedAt.getTime())
        ? watermark.issuedAt.toISOString()
        : watermark?.issuedAt
        ? `${watermark.issuedAt}`
        : new Date().toISOString();

    pushAuditLog({
      actor,
      action: 'reports.export',
      detail: `Xuất báo cáo ${kind}`,
      meta: {
        kind,
        filename,
        signature: signature || null,
        shortSignature: watermark?.shortSignature || null,
        issuedAt: issuedAtIso,
        filterSummary: watermark?.filterSummary || null,
        filters: watermark?.filters || null,
        ip: ipAddress || null,
        requestId: watermark?.requestId || requestId,
      },
    });

    recordReportExportAudit({
      username: actor,
      displayName: context.account?.name,
      role: context.account?.role,
      kind,
      filename,
      signature,
      shortSignature: watermark?.shortSignature,
      filterSummary: watermark?.filterSummary,
      filters: watermark?.filters ?? payload,
      ipAddress: ipAddress || null,
      requestId: watermark?.requestId || requestId,
      userAgent: requestUserAgent,
      issuedAt: issuedAtIso,
    });
  } catch (err) {
    console.error('Không thể xuất báo cáo', err);
    const status = err?.message && /không hợp lệ/i.test(err.message) ? 400 : 500;
    res.status(status).json({ ok: false, error: err?.message || 'Không thể xuất báo cáo' });
  }
});

app.get('/api/reports/export/audit', (req, res) => {
  const { context, denied } = requireExportAuditView(req, res);
  if (denied) {
    return;
  }

  const rawFrom = Array.isArray(req.query.from) ? req.query.from[0] : req.query.from;
  const rawTo = Array.isArray(req.query.to) ? req.query.to[0] : req.query.to;
  const fromIso = parseDateFilterParam(rawFrom);
  const toIso = parseDateFilterParam(rawTo, { endOfDay: true });

  if (fromIso && toIso) {
    const fromDate = new Date(fromIso);
    const toDate = new Date(toIso);
    if (toDate.getTime() < fromDate.getTime()) {
      res.status(400).json({ ok: false, error: 'Khoảng thời gian không hợp lệ: Ngày bắt đầu lớn hơn ngày kết thúc.' });
      return;
    }
    const diffMs = toDate.getTime() - fromDate.getTime();
    const maxRangeMs = EXPORT_AUDIT_MAX_RANGE_DAYS * 24 * 60 * 60 * 1000;
    if (diffMs > maxRangeMs) {
      res.status(400).json({
        ok: false,
        error: `Vui lòng giới hạn khoảng thời gian tra cứu trong ${EXPORT_AUDIT_MAX_RANGE_DAYS} ngày.`,
      });
      return;
    }
  }

  const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const rawPage = Array.isArray(req.query.page) ? req.query.page[0] : req.query.page;
  const limit = clampPositiveInt(rawLimit, {
    min: 10,
    max: EXPORT_AUDIT_MAX_LIMIT,
    fallback: EXPORT_AUDIT_DEFAULT_LIMIT,
  });
  const page = clampPositiveInt(rawPage, { min: 1, max: 1000, fallback: 1 });
  const offset = (page - 1) * limit;

  const rawKind = normalizeStr(Array.isArray(req.query.kind) ? req.query.kind[0] : req.query.kind).toLowerCase();
  const kind = rawKind && rawKind !== 'all' ? rawKind : '';
  const rawSearch = normalizeStr(Array.isArray(req.query.search) ? req.query.search[0] : req.query.search);
  const search = rawSearch ? rawSearch.toLowerCase() : '';

  const baseParams = {};
  const conditions = [];

  if (fromIso) {
    baseParams.from = fromIso;
    conditions.push('datetime(created_at) >= datetime(@from)');
  }
  if (toIso) {
    baseParams.to = toIso;
    conditions.push('datetime(created_at) <= datetime(@to)');
  }
  if (kind) {
    baseParams.kind = kind;
    conditions.push('LOWER(report_kind) = @kind');
  }
  if (search) {
    baseParams.search = `%${search}%`;
    const searchClauses = [
      'LOWER(username) LIKE @search',
      'LOWER(display_name) LIKE @search',
      'LOWER(report_kind) LIKE @search',
      'LOWER(signature) LIKE @search',
      'LOWER(short_signature) LIKE @search',
      'LOWER(ip_address) LIKE @search',
      'LOWER(request_id) LIKE @search',
    ];
    conditions.push(`(${searchClauses.join(' OR ')})`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const listParams = { ...baseParams, limit, offset };

  try {
    const rows = db
      .prepare(
        `SELECT * FROM export_audit ${whereClause} ORDER BY datetime(created_at) DESC LIMIT @limit OFFSET @offset`
      )
      .all(listParams);

    const totalRow = db
      .prepare(`SELECT COUNT(*) AS total FROM export_audit ${whereClause}`)
      .get(baseParams);
    const total = Number(totalRow?.total || 0);

    const summaryByKind = db
      .prepare(
        `SELECT report_kind AS kind, COUNT(*) AS total FROM export_audit ${whereClause} GROUP BY report_kind ORDER BY total DESC`
      )
      .all(baseParams)
      .map((item) => ({ kind: item.kind, total: Number(item.total) || 0 }));

    const summaryTopUsers = db
      .prepare(
        `SELECT username, display_name, role, COUNT(*) AS total FROM export_audit ${whereClause} GROUP BY username, display_name, role ORDER BY total DESC LIMIT 5`
      )
      .all(baseParams)
      .map((item) => ({
        username: item.username,
        displayName: item.display_name,
        role: item.role,
        total: Number(item.total) || 0,
      }));

    const availableKinds = db
      .prepare('SELECT DISTINCT report_kind FROM export_audit ORDER BY report_kind COLLATE NOCASE')
      .all()
      .map((row) => row.report_kind)
      .filter(Boolean);

    const entries = rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      issuedAt: row.issued_at,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
      reportKind: row.report_kind,
      filename: row.filename,
      signature: row.signature,
      shortSignature: row.short_signature,
      filterSummary: row.filter_summary,
      filters: safeParse(row.filters, null),
      ipAddress: row.ip_address,
      requestId: row.request_id,
      userAgent: row.user_agent,
    }));

    const pageCount = Math.max(1, Math.ceil(total / limit));
    const latestCreatedAt = entries.length ? entries[0].createdAt : null;

    res.json({
      ok: true,
      entries,
      total,
      page,
      pageSize: limit,
      pageCount,
      summary: {
        total,
        latestCreatedAt,
        byKind: summaryByKind,
        topUsers: summaryTopUsers,
      },
      filters: {
        from: fromIso ? fromIso.slice(0, 10) : '',
        to: toIso ? toIso.slice(0, 10) : '',
        kind: kind || 'all',
        search: rawSearch || '',
      },
      availableKinds,
    });
  } catch (err) {
    console.error('Không thể tải lịch sử export', err);
    res.status(500).json({ ok: false, error: err?.message || 'Không thể tải lịch sử export' });
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
    await maybeSyncAccountsFromSql();
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
    res.json({ ok: true, user, token, expiresAt });
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

app.get('/api/auth/accounts', async (req, res) => {
  try {
    await maybeSyncAccountsFromSql();
    res.json({ ok: true, accounts: listAccountsForClient() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Không thể tải danh sách tài khoản' });
  }
});

app.post('/api/auth/accounts', async (req, res) => {
  try {
    await maybeSyncAccountsFromSql();
    const actor = resolveActor(req);
    const account = createAccountRecord(req.body, { actor });
    res.status(201).json({ ok: true, account, accounts: listAccountsForClient() });
  } catch (err) {
    res.status(400).json({ ok: false, error: err?.message || 'Không thể tạo tài khoản' });
  }
});

app.patch('/api/auth/accounts/:username', async (req, res) => {
  try {
    await maybeSyncAccountsFromSql();
    const actor = resolveActor(req);
    const account = updateAccountRecord(req.params.username, req.body, { actor });
    res.json({ ok: true, account, accounts: listAccountsForClient() });
  } catch (err) {
    const status = err?.message && err.message.includes('Không tìm thấy') ? 404 : 400;
    res.status(status).json({ ok: false, error: err?.message || 'Không thể cập nhật tài khoản' });
  }
});

app.post('/api/auth/accounts/:username/password', async (req, res) => {
  try {
    await maybeSyncAccountsFromSql();
    const actor = resolveActor(req);
    setAccountPasswordRecord(req.params.username, req.body?.password, { actor });
    res.json({ ok: true, accounts: listAccountsForClient() });
  } catch (err) {
    const status = err?.message && err.message.includes('Không tìm thấy') ? 404 : 400;
    res.status(status).json({ ok: false, error: err?.message || 'Không thể đặt lại mật khẩu' });
  }
});

app.delete('/api/auth/accounts/:username', async (req, res) => {
  try {
    await maybeSyncAccountsFromSql();
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
    await maybeSyncAccountsFromSql();
    const account = await changeOwnPasswordRecord(username, currentPassword, newPassword);
    deleteSessionsForUser(account?.username || username);
    const { token, expiresAt } = createSessionForUser(account?.username || username);
    setSessionCookie(req, res, token, expiresAt);
    res.json({ ok: true, account, token, expiresAt });
  } catch (err) {
    const status = err?.message && err.message.includes('Không tìm thấy') ? 404 : 400;
    res.status(status).json({ ok: false, error: err?.message || 'Không thể đổi mật khẩu' });
  }
});

app.get('/api/storage/:key', (req, res) => {
  const key = req.params.key;
  if (!key) {
    res.status(400).json({ ok: false, error: 'Thi?u key' });
    return;
  }
  const { denied } = verifyStoragePermission(req, res, key);
  if (denied) {
    return;
  }
  try {
    const raw = getValue(key);
    if (raw === undefined || raw === null) {
      res.json({ ok: true, key, value: null, raw: null });
      return;
    }
    const value = safeParse(raw, raw);
    res.json({ ok: true, key, value, raw });
  } catch (err) {
    console.error('Kh�ng th? d?c d? li?u', err);
    res.status(500).json({ ok: false, error: 'Kh�ng th? d?c d? li?u' });
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
      deleteValue(key, { actor, source: 'api' });
    } else {
      upsertValue(key, value, { actor, source: 'api' });
    }
    if (key === 'decl_rows_v1') {
      evaluateDeclarationAlerts({ actor, reason: 'storage-put' });
    }
    if (key === 'ecus_sync_config_v1') {
      refreshEcusSchedule();
    }
    if (key === 'co_tax_code_config_v1') {
      applyCoCodeConfig(getCoCodeConfig());
    }
    if (key === 'co_discrepancy_config_v1') {
      refreshCoDiscrepancySchedule();
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
  const { context, denied } = verifyStoragePermission(req, res, key);
  if (denied) {
    return;
  }
  const actor = context?.account?.username || resolveActor(req);
  try {
    deleteValue(key, { actor, source: 'api-delete' });
    if (key === 'co_tax_code_config_v1') {
      applyCoCodeConfig(DEFAULT_CO_CODE_CONFIG);
    }
    if (key === 'co_discrepancy_config_v1') {
      refreshCoDiscrepancySchedule();
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Lỗi xóa dữ liệu', err);
    res.status(500).json({ ok: false, error: 'Không thể xóa dữ liệu' });
  }
});

app.get('/api/ai/data/snapshot', async (req, res) => {
  const { context, denied } = requireAiAssistUsage(req, res);
  if (denied) {
    return;
  }
  const actor = context?.account?.username || resolveActor(req);
  const from = Array.isArray(req.query?.from) ? req.query.from[0] : req.query?.from;
  const to = Array.isArray(req.query?.to) ? req.query.to[0] : req.query?.to;
  try {
    const { snapshot, cached, cacheKey } = await buildAiKpiSnapshot(
      { from, to },
      { actor }
    );
    res.json({ ok: true, snapshot, cached, cacheKey });
  } catch (err) {
    const status = Number.isInteger(err?.statusCode) ? err.statusCode : 500;
    res.status(status).json({ ok: false, error: err?.message || 'Không thể lấy snapshot KPI.' });
  }
});

app.get('/api/ai/insights', (req, res) => {
  const { context, denied } = requireAiAssistUsage(req, res);
  if (denied) {
    return;
  }
  const username = context?.account?.username || resolveActor(req);
  const limitRaw = Array.isArray(req.query?.limit) ? req.query.limit[0] : req.query?.limit;
  const limit = toPositiveInt(limitRaw, AI_INSIGHT_MAX_ENTRIES) || AI_INSIGHT_MAX_ENTRIES;
  const store = getAiInsightsStore();
  const entries = Array.isArray(store.entries) ? store.entries : [];
  const limited = limit > 0 ? entries.slice(0, limit) : entries;
  const insights = limited.map((entry) => sanitizeAiInsightForClient(entry, { username })).filter(Boolean);
  res.json({
    ok: true,
    insights,
    meta: {
      state: store.state,
      schedule: store.schedule,
    },
  });
});

app.post('/api/ai/insights/run', async (req, res) => {
  const { context, denied } = requireAiAssistManage(req, res);
  if (denied) {
    return;
  }
  const actor = context?.account?.username || resolveActor(req);
  const rangeInput = req.body?.range && typeof req.body.range === 'object'
    ? { from: req.body.range.from, to: req.body.range.to }
    : {};
  try {
    const result = await runAiInsightGeneration(rangeInput, { actor });
    res.json({ ok: true, result });
  } catch (err) {
    const status = Number.isInteger(err?.statusCode) ? err.statusCode : 500;
    res.status(status).json({ ok: false, error: err?.message || 'Không thể chạy insight AI.' });
  }
});

app.post('/api/ai/insights/feedback', (req, res) => {
  const { context, denied } = requireAiAssistUsage(req, res);
  if (denied) {
    return;
  }
  const username = context?.account?.username || resolveActor(req);
  if (!username) {
    res.status(400).json({ ok: false, error: 'Không xác định được tài khoản hiện tại.' });
    return;
  }
  const insightId = typeof req.body?.insightId === 'string' ? req.body.insightId.trim() : '';
  if (!insightId) {
    res.status(400).json({ ok: false, error: 'Thiếu mã insight để phản hồi.' });
    return;
  }
  const helpfulRaw = req.body?.helpful;
  if (helpfulRaw !== true && helpfulRaw !== false) {
    res.status(400).json({ ok: false, error: 'Vui lòng chọn đánh giá hữu ích hoặc chưa hữu ích.' });
    return;
  }
  try {
    const result = submitAiInsightFeedback(
      insightId,
      username,
      { helpful: helpfulRaw, comment: req.body?.comment },
      { actor: username }
    );
    res.json({ ok: true, totals: result.totals, feedback: result.feedback });
  } catch (err) {
    res.status(400).json({ ok: false, error: err?.message || 'Không thể gửi phản hồi insight.' });
  }
});

app.get('/api/ai/history', (req, res) => {
  const { context, denied } = requireAiAssistUsage(req, res);
  if (denied) {
    return;
  }
  const username = context?.account?.username;
  if (!username) {
    res.status(400).json({ ok: false, error: 'Không xác định được tài khoản hiện tại' });
    return;
  }
  try {
    const history = loadAiChatHistory(username);
    res.json({ ok: true, messages: history.messages, updatedAt: history.updatedAt });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Không thể tải lịch sử trò chuyện AI' });
  }
});

app.put('/api/ai/history', (req, res) => {
  const { context, denied } = requireAiAssistUsage(req, res);
  if (denied) {
    return;
  }
  const username = context?.account?.username;
  if (!username) {
    res.status(400).json({ ok: false, error: 'Không xác định được tài khoản hiện tại' });
    return;
  }
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const actor = context.account?.username || resolveActor(req);
    const saved = saveAiChatHistory(username, messages, { actor });
    res.json({ ok: true, messages: saved.messages, updatedAt: saved.updatedAt });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Không thể lưu lịch sử trò chuyện AI' });
  }
});

app.delete('/api/ai/history', (req, res) => {
  const { context, denied } = requireAiAssistUsage(req, res);
  if (denied) {
    return;
  }
  const username = context?.account?.username;
  if (!username) {
    res.status(400).json({ ok: false, error: 'Không xác định được tài khoản hiện tại' });
    return;
  }
  try {
    const actor = context.account?.username || resolveActor(req);
    deleteAiChatHistory(username, { actor });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Không thể xóa lịch sử trò chuyện AI' });
  }
});

app.get('/api/ai/profile', (req, res) => {
  const { denied } = requireAiAssistUsage(req, res);
  if (denied) {
    return;
  }
  try {
    const config = getAiConfig();
    res.json({ ok: true, profile: buildAiProfile(config) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Không thể tải trạng thái trợ lý AI' });
  }
});

app.get('/api/ai/config', (req, res) => {
  const { denied } = requireAiAssistManage(req, res);
  if (denied) {
    return;
  }
  try {
    const config = getAiConfig();
    const safeConfig = buildAiConfigForClient(config);
    const cachingEnabled = config?.caching?.enabled !== false;
    const ttlMinutes = cachingEnabled
      ? toPositiveInt(config?.caching?.ttlMinutes, DEFAULT_AI_CONFIG.caching.ttlMinutes)
      : 0;
    const maxEntries = toPositiveInt(config?.caching?.maxEntries, AI_CACHE_LIMIT);
    const ttlMs = cachingEnabled && ttlMinutes ? ttlMinutes * 60 * 1000 : 0;
    const { cache } = cachingEnabled ? pruneAiCache(ttlMs, maxEntries) : { cache: cloneJson(DEFAULT_AI_USAGE_CACHE) };
    res.json({ ok: true, config: safeConfig, cacheSummary: summarizeAiCacheEntries(cache.entries) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Không thể tải cấu hình AI' });
  }
});

app.get('/api/rules/history', (req, res) => {
  const { denied } = requireRulesManage(req, res);
  if (denied) {
    return;
  }
  try {
    const history = listRulesHistory(25);
    res.json({ ok: true, history });
  } catch (err) {
    console.error('Không thể tải lịch sử quy tắc KPI', err);
    res.status(500).json({ ok: false, error: 'Không thể tải lịch sử quy tắc KPI' });
  }
});

app.put('/api/ai/config', (req, res) => {
  const { denied, context } = requireAiAssistManage(req, res);
  if (denied) {
    return;
  }
  try {
    const actor = context?.account?.username || resolveActor(req);
    const payload = req.body?.config ?? req.body ?? {};
    const next = setAiConfig(payload, { actor });
    const safeConfig = buildAiConfigForClient(next);
    const cachingEnabled = next?.caching?.enabled !== false;
    const ttlMinutes = cachingEnabled
      ? toPositiveInt(next?.caching?.ttlMinutes, DEFAULT_AI_CONFIG.caching.ttlMinutes)
      : 0;
    const maxEntries = toPositiveInt(next?.caching?.maxEntries, AI_CACHE_LIMIT);
    const ttlMs = cachingEnabled && ttlMinutes ? ttlMinutes * 60 * 1000 : 0;
    if (cachingEnabled) {
      pruneAiCache(ttlMs, maxEntries);
    }
    res.json({ ok: true, config: safeConfig });
  } catch (err) {
    res.status(400).json({ ok: false, error: err?.message || 'Không thể cập nhật cấu hình AI' });
  }
});

app.post('/api/ai/providers/test', async (req, res) => {
  const { denied } = requireAiAssistManage(req, res);
  if (denied) {
    return;
  }
  const rawProvider = req.body?.provider;
  let normalized = null;
  try {
    if (!rawProvider || typeof rawProvider !== 'object') {
      res.status(400).json({ ok: false, error: 'Thiếu thông tin nhà cung cấp.' });
      return;
    }
    const config = getAiConfig();
    const baseProvider = config?.providers?.find((entry) => entry?.id === rawProvider.id) || {};
    const fallbackId = `${rawProvider.id || rawProvider.idBase || baseProvider.id || rawProvider.type || 'provider'}-test`;
    normalized = normalizeAiProviderEntry({ ...baseProvider, ...rawProvider, id: fallbackId }, baseProvider) || null;
    if (!normalized) {
      res.status(400).json({ ok: false, error: 'Không thể chuẩn hóa dữ liệu nhà cung cấp.' });
      return;
    }
    if (!normalized.type) {
      res.status(400).json({ ok: false, error: 'Thiếu loại nhà cung cấp (type).' });
      return;
    }
    const providerType = `${normalized.type}`.trim().toLowerCase();
    const isOllamaProvider = providerType === 'ollama' || providerType === 'ollama-local';
    if (!normalized.apiKey) {
      const envKey = normalized.apiKeyEnv ? process.env[normalized.apiKeyEnv] : null;
      if (envKey) {
        normalized.apiKey = envKey;
      }
    }
    if (!normalized.apiKey && !isOllamaProvider) {
      res.status(400).json({ ok: false, error: 'Vui lòng nhập khóa API trước khi kiểm thử.' });
      return;
    }
    const promptInput = `${req.body?.prompt || 'Ping'}`.trim().slice(0, 280);
    const messages = [
      {
        role: 'system',
        content:
          'Bạn đang trong chế độ kiểm thử kết nối API. Hãy trả lời thật ngắn gọn (tối đa 30 ký tự) để xác nhận đã nhận được tín hiệu.',
      },
      { role: 'user', content: promptInput || 'Ping' },
    ];
    const timeoutMs = toPositiveInt(req.body?.timeoutMs, DEFAULT_AI_CONFIG.timeoutMs) || 15000;
    const result = await dispatchAiChat(
      { ...normalized, enabled: true },
      {
        messages,
        temperature: Math.min(Math.max(toFiniteNumber(normalized.temperature, 0.2), 0), 0.6),
        maxTokens: Math.min(toPositiveInt(normalized.maxTokens, DEFAULT_AI_CONFIG.maxTokens) || 128, 256),
      },
      { signal: buildAbortSignal(timeoutMs) },
    );
    res.json({
      ok: true,
      provider: { id: normalized.id, label: normalized.label, type: normalized.type },
      message: truncateText(result?.message || '', 320),
      usage: result?.usage || null,
    });
  } catch (err) {
    console.error('Kiểm thử nhà cung cấp AI thất bại', {
      providerId: normalized?.id || rawProvider?.id || 'unknown',
      type: normalized?.type || rawProvider?.type || 'unknown',
      error: err?.message || err,
    });
    res.status(400).json({ ok: false, error: err?.message || 'Không thể kiểm thử nhà cung cấp AI.' });
  }
});

app.delete('/api/ai/cache', (req, res) => {
  const { denied, context } = requireAiAssistManage(req, res);
  if (denied) {
    return;
  }
  try {
    const actor = context?.account?.username || resolveActor(req);
    clearAiCache({ actor });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Không thể xóa cache AI' });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  const { denied, context } = requireAiAssistUsage(req, res);
  if (denied) {
    return;
  }
  const actor = context?.account?.username || resolveActor(req);
  try {
    const config = getAiConfig();
    if (config?.enabled === false) {
      res.status(503).json({ ok: false, error: 'Tính năng trợ lý AI đang tạm tắt.' });
      return;
    }
    const rawPrompt = req.body?.prompt ?? '';
    const prompt = `${rawPrompt}`.trim();
    if (!prompt) {
      res.status(400).json({ ok: false, error: 'Nội dung câu hỏi trống.' });
      return;
    }
    const scope = `${req.body?.scope || 'general'}`.trim() || 'general';
    const provider = selectAiProvider(config, req.body?.providerId);
    if (!provider) {
      res.status(503).json({ ok: false, error: 'Chưa tìm thấy nhà cung cấp AI khả dụng.' });
      return;
    }
    const contextTextRaw = req.body?.context ?? '';
    const truncatedPrompt = truncateText(prompt, config.maxInputLength);
    const contextText = truncateText(`${contextTextRaw || ''}`, config.maxInputLength);
    const cachingEnabled = config?.caching?.enabled !== false;
    const ttlMinutes = cachingEnabled
      ? toPositiveInt(config?.caching?.ttlMinutes, DEFAULT_AI_CONFIG.caching.ttlMinutes)
      : 0;
    const maxEntries = toPositiveInt(config?.caching?.maxEntries, AI_CACHE_LIMIT);
    const ttlMs = cachingEnabled && ttlMinutes ? ttlMinutes * 60 * 1000 : 0;
    const cacheKey = computeAiCacheKey({ providerId: provider.id, prompt: truncatedPrompt, scope, context: contextText });
    let cacheSnapshot = { version: 1, entries: [] };
    if (cachingEnabled) {
      cacheSnapshot = pruneAiCache(ttlMs, maxEntries).cache;
      const cached = cacheSnapshot.entries.find((entry) => entry.key === cacheKey);
      if (cached) {
        pushAuditLog({
          actor,
          action: 'ai.chat',
          detail: `Sử dụng cache trợ lý AI (${provider.id}) cho scope ${scope}`,
        });
        res.json({
          ok: true,
          cached: true,
          message: cached.response,
          usage: cached.usage || null,
          providerId: cached.providerId,
          scope,
          cacheKey,
        });
        return;
      }
    }

    const messages = [];
    const systemPrompt = buildSystemPrompt(config.systemPrompt, req.body?.systemPrompt);
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    if (contextText) {
      messages.push({ role: 'system', content: `Ngữ cảnh bổ sung:\n${contextText}` });
    }
    messages.push({ role: 'user', content: truncatedPrompt });

    const signal = buildAbortSignal(config.timeoutMs);
    const temperature = toFiniteNumber(provider.temperature, config.temperature);
    const maxTokens = toPositiveInt(provider.maxTokens, config.maxTokens);
    const result = await dispatchAiChat(
      provider,
      {
        messages,
        temperature,
        maxTokens,
      },
      { signal }
    );
    const usage = normalizeAiUsage(result.usage, truncatedPrompt, result.message);

    if (cachingEnabled) {
      storeAiCacheEntry(
        {
          key: cacheKey,
          providerId: provider.id,
          scope,
          prompt: truncatedPrompt,
          response: result.message,
          context: contextText,
          usage,
          actor,
          tokensEstimated: usage?.totalTokens ?? null,
        },
        { actor, ttlMs, maxEntries }
      );
    }

    pushAuditLog({ actor, action: 'ai.chat', detail: `Gọi trợ lý AI (${provider.id}) cho scope ${scope}` });
    res.json({
      ok: true,
      cached: false,
      message: result.message,
      usage,
      providerId: provider.id,
      scope,
      cacheKey,
    });
  } catch (err) {
    console.error('Lỗi AI chat', err);
    const status = err?.name === 'AbortError' ? 504 : 502;
    res.status(status).json({ ok: false, error: err?.message || 'Không thể gọi trợ lý AI' });
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
    const { from, to, limit, includeTaxCodes, excludeTaxCodes } = req.body || {};
    const preview = await previewEcusSync(
      { from, to },
      { limit, includeTaxCodes, excludeTaxCodes }
    );
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
    const { from, to, includeTaxCodes, excludeTaxCodes } = req.body || {};
    const result = await runEcusSyncWithErrorHandling({
      from,
      to,
      includeTaxCodes,
      excludeTaxCodes,
      actor,
      reason: 'manual',
    });
    res.json({ ok: true, result: { ...result, config: formatEcusConfigForClient(result.config) } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Không thể đồng bộ ECUS' });
  }
});

app.get('/api/import/alerts', (req, res) => {
  const payload = buildAlertPayload();
  res.json({ ok: true, ...payload });
});

app.get('/api/import/search', (req, res) => {
  try {
    const filters = normalizeDeclSearchFilters(req.query || {});
    const pageRaw = Array.isArray(req.query?.page) ? req.query.page[0] : req.query?.page;
    const pageSizeRaw = Array.isArray(req.query?.pageSize) ? req.query.pageSize[0] : req.query?.pageSize;
    const pageValue = Number(pageRaw);
    const requestedPageSize = Number(pageSizeRaw);
    const page = Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) : 1;
    const pageSizeCandidate =
      Number.isFinite(requestedPageSize) && requestedPageSize > 0
        ? Math.floor(requestedPageSize)
        : DECL_SEARCH_DEFAULT_PAGE_SIZE;
    const pageSize = Math.max(1, Math.min(pageSizeCandidate, DECL_SEARCH_MAX_PAGE_SIZE));

    const rows = getDeclRows();
    const filtered = filterDeclRows(rows, filters);
    const total = filtered.length;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, maxPage);
    const offset = (safePage - 1) * pageSize;
    const pageRows = filtered.slice(offset, offset + pageSize);

    res.json({
      ok: true,
      total,
      page: safePage,
      pageSize,
      rows: pageRows,
    });
  } catch (err) {
    console.error('Không thể tìm kiếm tờ khai', err);
    res.status(500).json({ ok: false, error: err?.message || 'Không thể tìm kiếm tờ khai' });
  }
});

app.get('/api/import/co-codes', (req, res) => {
  try {
    const config = getCoCodeConfig();
    res.json({ ok: true, config });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Khong the tai cau hinh ma uu dai' });
  }
});

app.put('/api/import/co-codes', (req, res) => {
  const { denied, context } = requireAdminSyncManage(req, res);
  if (denied) {
    return;
  }
  try {
    const actor = context?.account?.username || resolveActor(req);
    const next = saveCoCodeConfig(req.body?.config || req.body || {}, { actor });
    res.json({ ok: true, config: next });
  } catch (err) {
    res.status(400).json({ ok: false, error: err?.message || 'Khong the luu cau hinh ma uu dai' });
  }
});

app.get('/api/import/co-discrepancy', (req, res) => {
  try {
    const config = getCoDiscrepancyConfig();
    const state = getCoDiscrepancyState();
    res.json({ ok: true, config, state });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || 'Khong the tai trang thai kiem tra CO' });
  }
});

app.put('/api/import/co-discrepancy/config', (req, res) => {
  const { denied, context } = requireAdminSyncManage(req, res);
  if (denied) {
    return;
  }
  try {
    const actor = context?.account?.username || resolveActor(req);
    const next = saveCoDiscrepancyConfig(req.body?.config || req.body || {}, { actor });
    refreshCoDiscrepancySchedule();
    res.json({ ok: true, config: next });
  } catch (err) {
    res.status(400).json({ ok: false, error: err?.message || 'Khong the luu cau hinh kiem tra CO' });
  }
});

app.post('/api/import/co-discrepancy/run', async (req, res) => {
  const { denied, context } = requireAdminSyncManage(req, res);
  if (denied) {
    return;
  }
  try {
    const actor = context?.account?.username || resolveActor(req);
    const range = req.body?.range && typeof req.body.range === 'object' ? req.body.range : null;
    const result = await runCoDiscrepancyCheck({ actor, reason: 'manual', range });
    res.json({ ok: true, result });
  } catch (err) {
    const status = Number.isInteger(err?.statusCode) ? err.statusCode : 500;
    res.status(status).json({ ok: false, error: err?.message || 'Khong the chay kiem tra CO' });
  }
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

app.post('/api/import/alerts/unreview', (req, res) => {
  const keys = Array.isArray(req.body?.keys) ? req.body.keys : [];
  const actor = resolveActor(req);
  const updated = unmarkDeclarationsReviewed(keys, { actor });
  const summary = evaluateDeclarationAlerts({ actor, reason: 'manual-unreview' });
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
let aiHttpsServer = null;

function startAiHttpsServerIfConfigured() {
  if (aiHttpsServer) {
    return aiHttpsServer;
  }
  const config = loadAiHttpsConfig({ env: process.env });
  if (!config.enabled) {
    const requested = `${process.env.KPI_AI_HTTPS_ENABLED || ''}`.trim();
    if (requested) {
      console.warn(
        'Bỏ qua HTTPS nội bộ cho AI vì thiếu cấu hình chứng chỉ: %s',
        config.reason || 'Không rõ nguyên nhân'
      );
    }
    return null;
  }

  try {
    aiHttpsServer = https.createServer(config.tlsOptions, (req, res) => {
      if (!req.url || !req.url.startsWith('/api/ai')) {
        res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'Đường dẫn không được phục vụ qua kênh HTTPS nội bộ.' }));
        return;
      }
      app(req, res);
    });
    aiHttpsServer.listen(config.port, config.host, () => {
      logAiHttpsAddresses({ port: config.port, host: config.host, certPath: config.certPath });
    });
    aiHttpsServer.on('error', (err) => {
      console.error('Không thể khởi chạy HTTPS nội bộ cho AI', err);
    });
  } catch (err) {
    aiHttpsServer = null;
    console.error('Lỗi thiết lập HTTPS nội bộ cho AI', err);
  }

  return aiHttpsServer;
}

function stopAiHttpsServer() {
  if (aiHttpsServer) {
    aiHttpsServer.close();
    aiHttpsServer = null;
  }
}

export function startServer(port = PORT) {
  if (httpServer) {
    return httpServer;
  }
  httpServer = app.listen(port, HOST, () => {
    logServerAddresses(port, HOST);
  });
  startAiHttpsServerIfConfigured();
  return httpServer;
}

export function stopServer() {
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
  stopAiHttpsServer();
}

export function getDatabaseHandle() {
  return db;
}

export function getDatabaseInitState() {
  return { ...databaseInitState };
}

export async function waitForAccountSqlSyncIdle() {
  if (!accountSyncPromise) {
    return;
  }
  try {
    await accountSyncPromise;
  } catch {
    // Bỏ qua lỗi để không làm gián đoạn luồng kiểm thử
  }
}

if (process.env.KPI_SKIP_LISTEN !== '1') {
  startServer(PORT);
}
