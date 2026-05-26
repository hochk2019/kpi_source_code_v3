import { existsSync } from 'node:fs';

import Database from 'better-sqlite3';
import cron from 'node-cron';
import cronstrue from 'cronstrue';
import 'cronstrue/locales/vi.js';

import { normalizeMst, normalizeStr } from '../../legacy/legacy-normalizers.js';

export type EcusScheduleMode = 'minutes' | 'hours' | 'daily' | 'custom';

export type EcusSchedulePreset = {
  mode: EcusScheduleMode;
  value: number;
  time: string;
  cron: string;
};

export type EcusSyncConnectionConfig = {
  server?: string;
  database?: string;
  user?: string;
  password?: string;
  port?: number;
  connectionTimeout?: number;
  requestTimeout?: number;
  hasPassword?: boolean;
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
    enableArithAbort: boolean;
    [key: string]: unknown;
  };
  pool?: Record<string, unknown>;
  [key: string]: unknown;
};

export type EcusSyncConfigDocument = {
  enabled: boolean;
  schedule: string;
  schedulePreset: EcusSchedulePreset;
  rangeDays: number;
  preferMonthFirst: boolean;
  batchSize: number;
  includeTaxCodes: string[];
  excludeTaxCodes: string[];
  connection: EcusSyncConnectionConfig;
  query: string;
  updatedAt?: string | null;
  updatedBy?: string | null;
  [key: string]: unknown;
};

export const ECUS_SYNC_CONFIG_STORAGE_KEY = 'ecus_sync_config_v1';

export const DEFAULT_ECUS_SCHEDULE_PRESET: EcusSchedulePreset = Object.freeze({
  mode: 'daily',
  value: 1,
  time: '03:00',
  cron: '0 3 * * *',
});

export const DEFAULT_ECUS_CONNECTION = Object.freeze({
  server: 'Server',
  database: 'ECUS5VNACCS',
  user: 'sa',
  password: '',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
}) satisfies EcusSyncConnectionConfig;

const SCHEDULE_VALUE_LIMITS = Object.freeze({
  minutes: { min: 1, max: 60 },
  hours: { min: 1, max: 24 },
  daily: { min: 1, max: 31 },
});

export const DEFAULT_ECUS_QUERY = [
  'WITH base AS (',
  '  SELECT',
  '    lp._DTokhaiMDID AS md_id,',
  '    CAST(lp.So_TK AS nvarchar(50)) AS so_tk,',
  '    CAST(lp.Ngay_DK AS date) AS ngay_dang_ky,',
  '    LTRIM(RTRIM(lp.Ma_LH)) AS loai_hinh,',
  '    LTRIM(RTRIM(lp.Ma_DN)) AS mst,',
  '    LTRIM(RTRIM(lp.TEN_DV)) AS cong_ty',
  '  FROM dbo.DTBLP AS lp',
  '  WHERE lp.Ngay_DK >= @from AND lp.Ngay_DK <= @to',
  '  UNION ALL',
  '  SELECT',
  '    md._DToKhaiMDID AS md_id,',
  '    CAST(md.SOTK AS nvarchar(50)) AS so_tk,',
  '    CAST(md.NGAY_DK AS date) AS ngay_dang_ky,',
  '    LTRIM(RTRIM(md.MA_LH)) AS loai_hinh,',
  '    LTRIM(RTRIM(md.MA_DV)) AS mst,',
  "    LTRIM(RTRIM(COALESCE(NULLIF(md.[_Ten_DV_L1], ''), NULLIF(md.[_Ten_DV_L2], ''), NULLIF(md.[_Ten_DV_L3], ''), NULLIF(md.TEN_HQ, ''), md.MA_DV))) AS cong_ty",
  '  FROM dbo.DTOKHAIMD AS md',
  '  WHERE md.NGAY_DK >= @from AND md.NGAY_DK <= @to',
  '    AND NOT EXISTS (SELECT 1 FROM dbo.DTBLP AS lp WHERE lp._DTokhaiMDID = md._DToKhaiMDID)',
  ')',
  'SELECT',
  '  src.so_tk,',
  '  src.ngay_dang_ky,',
  '  src.loai_hinh,',
  '  src.mst,',
  "  LTRIM(RTRIM(COALESCE(src.cong_ty, NULLIF(md.[_Ten_DV_L1], ''), NULLIF(md.[_Ten_DV_L2], ''), NULLIF(md.[_Ten_DV_L3], ''), NULLIF(md.TEN_HQ, ''), md.MA_DV))) AS cong_ty,",
  '  ISNULL(items.muc_hang, 0) AS muc_hang,',
  '  ISNULL(licenses.license_count, 0) AS license_count,',
  "  ISNULL(licenses.license_codes, N'') AS license_codes,",
  '  ISNULL(co_counts.co_count_num, 0) AS co_count_num',
  'FROM base AS src',
  'LEFT JOIN dbo.DTOKHAIMD AS md ON md._DToKhaiMDID = src.md_id',
  'LEFT JOIN dbo.DTOKHAIMD_VNACCS2 AS md2 ON md2._DToKhaiMDID = src.md_id',
  'OUTER APPLY (',
  '  SELECT COUNT(*) AS muc_hang',
  '  FROM dbo.DHANGMDDK AS h',
  '  WHERE h._DToKhaiMDID = src.md_id',
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
  '  WHERE h2._DToKhaiMDID = src.md_id',
  "    AND LEFT(UPPER(LTRIM(RTRIM(CAST(h2.TS_XNK_MA_BT AS nvarchar(10))))), 3) LIKE 'B%'",
  "    AND LEFT(UPPER(LTRIM(RTRIM(CAST(h2.TS_XNK_MA_BT AS nvarchar(10))))), 3) NOT IN ('B01', 'B02', 'B03', 'B30')",
  ') AS co_counts',
  'ORDER BY src.ngay_dang_ky, src.so_tk',
].join('\n');

export function createDefaultEcusSyncConfig(
  options: {
    connectionDefaults?: Partial<EcusSyncConnectionConfig>;
  } = {},
): EcusSyncConfigDocument {
  const connection = buildConnectionDefaults(options.connectionDefaults);
  return {
    enabled: false,
    schedule: DEFAULT_ECUS_SCHEDULE_PRESET.cron,
    schedulePreset: { ...DEFAULT_ECUS_SCHEDULE_PRESET },
    rangeDays: 1,
    preferMonthFirst: false,
    batchSize: 500,
    includeTaxCodes: [],
    excludeTaxCodes: [],
    connection,
    query: DEFAULT_ECUS_QUERY,
    updatedAt: null,
    updatedBy: null,
  };
}

export function normalizeEcusSyncConfig(
  value: unknown,
  options: {
    connectionDefaults?: Partial<EcusSyncConnectionConfig>;
  } = {},
): EcusSyncConfigDocument {
  const source = isRecord(value) ? value : {};
  const defaults = createDefaultEcusSyncConfig(options);
  const connectionSource = isRecord(source.connection) ? source.connection : {};
  const connectionOptionsSource = isRecord(connectionSource.options) ? connectionSource.options : {};
  const schedulePresetBase = resolveSchedulePresetFromConfig(source, defaults.schedulePreset);
  const schedule =
    schedulePresetBase.mode === 'custom'
      ? normalizeCronExpression(source.schedule ?? schedulePresetBase.cron ?? defaults.schedule)
      : buildCronFromPreset(schedulePresetBase, defaults.schedule) ||
        normalizeCronExpression(source.schedule) ||
        defaults.schedule;
  const normalizedSchedule = normalizeCronExpression(schedule) || defaults.schedule;

  return {
    ...defaults,
    ...source,
    enabled: source.enabled === true,
    schedule: normalizedSchedule,
    schedulePreset: {
      ...normalizeSchedulePreset({ ...schedulePresetBase, cron: normalizedSchedule }, defaults.schedulePreset),
      cron: normalizedSchedule,
    },
    rangeDays: normalizePositiveInteger(source.rangeDays, defaults.rangeDays, { min: 1 }),
    preferMonthFirst: source.preferMonthFirst === true,
    batchSize: normalizePositiveInteger(source.batchSize, defaults.batchSize, { min: 1 }),
    includeTaxCodes: normalizeEcusTaxCodeList(source.includeTaxCodes),
    excludeTaxCodes: normalizeEcusTaxCodeList(source.excludeTaxCodes),
    connection: {
      ...defaults.connection,
      ...connectionSource,
      password: normalizeSecret(connectionSource.password ?? defaults.connection.password),
      hasPassword:
        Boolean(normalizeSecret(connectionSource.password ?? defaults.connection.password)) ||
        connectionSource.hasPassword === true ||
        defaults.connection.hasPassword === true,
      options: {
        ...defaults.connection.options,
        ...connectionOptionsSource,
      },
    },
    query: normalizeEcusQueryInput(source.query) || defaults.query,
    updatedAt: normalizeOptionalText(source.updatedAt),
    updatedBy: normalizeOptionalText(source.updatedBy),
  };
}

export function mergeEcusSyncConfig(
  currentValue: unknown,
  patchValue: unknown,
  options: {
    preservePassword?: boolean;
    connectionDefaults?: Partial<EcusSyncConnectionConfig>;
  } = {},
): EcusSyncConfigDocument {
  const current = normalizeEcusSyncConfig(currentValue, options);
  const patch = isRecord(patchValue) ? patchValue : {};
  const connectionPatch = isRecord(patch.connection) ? patch.connection : {};
  const connectionOptionsPatch = isRecord(connectionPatch.options) ? connectionPatch.options : {};
  const nextConnection = {
    ...current.connection,
    ...connectionPatch,
    options: {
      ...current.connection.options,
      ...connectionOptionsPatch,
    },
  };

  if (options.preservePassword === true && !hasOwn(connectionPatch, 'password')) {
    nextConnection.password = current.connection.password || '';
  } else {
    nextConnection.password = normalizeSecret(connectionPatch.password);
  }

  nextConnection.hasPassword =
    Boolean(nextConnection.password) ||
    connectionPatch.hasPassword === true ||
    current.connection.hasPassword === true;

  const schedulePresetInput = hasOwn(patch, 'schedulePreset')
    ? patch.schedulePreset
    : {
        mode: patch.scheduleMode,
        value: patch.scheduleValue,
        time: patch.scheduleTime,
        cron: patch.schedule,
      };
  let schedulePreset = normalizeSchedulePreset(schedulePresetInput, current.schedulePreset);
  let schedule =
    schedulePreset.mode === 'custom'
      ? normalizeCronExpression(patch.schedule ?? schedulePreset.cron ?? current.schedule)
      : buildCronFromPreset(schedulePreset, current.schedule) || current.schedule;
  schedule = normalizeCronExpression(schedule) || current.schedule;
  schedulePreset = { ...schedulePreset, cron: schedule };

  const next = normalizeEcusSyncConfig(
    {
      ...current,
      ...patch,
      enabled: patch.enabled !== undefined ? patch.enabled === true : current.enabled,
      schedule,
      schedulePreset,
      rangeDays: hasOwn(patch, 'rangeDays') ? patch.rangeDays : current.rangeDays,
      preferMonthFirst:
        patch.preferMonthFirst !== undefined ? patch.preferMonthFirst === true : current.preferMonthFirst,
      batchSize: hasOwn(patch, 'batchSize') ? patch.batchSize : current.batchSize,
      includeTaxCodes: hasOwn(patch, 'includeTaxCodes') ? patch.includeTaxCodes : current.includeTaxCodes,
      excludeTaxCodes: hasOwn(patch, 'excludeTaxCodes') ? patch.excludeTaxCodes : current.excludeTaxCodes,
      query: hasOwn(patch, 'query') ? patch.query : current.query,
      connection: nextConnection,
    },
    options,
  );

  delete next.scheduleMode;
  delete next.scheduleValue;
  delete next.scheduleTime;
  delete next.scheduleDescription;

  return next;
}

export function formatEcusSyncConfigForClient(
  value: unknown,
  options: {
    connectionDefaults?: Partial<EcusSyncConnectionConfig>;
  } = {},
): EcusSyncConfigDocument & {
  scheduleMode: EcusScheduleMode;
  scheduleValue: number;
  scheduleTime: string;
  scheduleDescription: string;
} {
  const source = normalizeEcusSyncConfig(value, options);
  const derivedPreset = deriveSchedulePreset(source.schedule, source.schedulePreset);
  const schedulePreset = {
    ...normalizeSchedulePreset(source.schedulePreset || derivedPreset, derivedPreset),
    cron: normalizeCronExpression(source.schedulePreset?.cron || source.schedule) || source.schedule,
  };
  const connection = {
    ...source.connection,
    options: {
      ...source.connection.options,
    },
  };

  connection.hasPassword =
    Boolean(connection.password) || connection.hasPassword === true || source.connection?.hasPassword === true;
  connection.password = '';

  return {
    ...source,
    connection,
    schedulePreset,
    scheduleMode: schedulePreset.mode,
    scheduleValue: schedulePreset.value,
    scheduleTime: schedulePreset.time,
    scheduleDescription: describeCronExpression(source.schedule),
    includeTaxCodes: [...source.includeTaxCodes],
    excludeTaxCodes: [...source.excludeTaxCodes],
  };
}

export function normalizeEcusTaxCodeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const entry of value) {
    const next = normalizeMst(entry);
    if (!next || seen.has(next)) {
      continue;
    }

    seen.add(next);
    normalized.push(next);
  }

  return normalized;
}

export function readLegacyEcusSyncConfig(dbFile: string | null): Record<string, unknown> | null {
  if (!dbFile || dbFile === ':memory:' || !existsSync(dbFile)) {
    return null;
  }

  let database: Database | null = null;
  try {
    database = new Database(dbFile, {
      readonly: true,
      fileMustExist: true,
    });
    const row = database
      .prepare('SELECT value FROM kv_store WHERE key = ? LIMIT 1')
      .get(ECUS_SYNC_CONFIG_STORAGE_KEY) as { value?: unknown } | undefined;

    if (typeof row?.value !== 'string' || !row.value.trim()) {
      return null;
    }

    const parsed = safeParse<Record<string, unknown> | null>(row.value, null);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  } finally {
    database?.close();
  }
}

function buildConnectionDefaults(
  overrides: Partial<EcusSyncConnectionConfig> | undefined,
): EcusSyncConnectionConfig {
  const source = isRecord(overrides) ? overrides : {};
  const optionsSource = isRecord(source.options) ? source.options : {};
  return {
    ...DEFAULT_ECUS_CONNECTION,
    ...source,
    password: normalizeSecret(source.password ?? DEFAULT_ECUS_CONNECTION.password),
    hasPassword:
      Boolean(normalizeSecret(source.password ?? DEFAULT_ECUS_CONNECTION.password)) ||
      source.hasPassword === true,
    options: {
      ...DEFAULT_ECUS_CONNECTION.options,
      ...optionsSource,
    },
  };
}

function clampScheduleValueForMode(
  mode: EcusScheduleMode,
  rawValue: unknown,
  fallback: number = DEFAULT_ECUS_SCHEDULE_PRESET.value,
): number {
  const limits = SCHEDULE_VALUE_LIMITS[mode as 'minutes' | 'hours' | 'daily'];
  if (!limits) {
    return fallback;
  }

  const parsed = Number.parseInt(`${rawValue ?? ''}`, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, limits.min), limits.max);
}

function normalizeScheduleTimeInput(
  value: unknown,
  fallback: string = DEFAULT_ECUS_SCHEDULE_PRESET.time,
): string {
  const base = typeof fallback === 'string' && fallback ? fallback : DEFAULT_ECUS_SCHEDULE_PRESET.time;
  const trimmed = normalizeStr(value);
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

  return `${String(Math.min(hours, 23)).padStart(2, '0')}:${String(Math.min(minutes, 59)).padStart(2, '0')}`;
}

function normalizeSchedulePreset(
  input: unknown,
  fallback: EcusSchedulePreset = DEFAULT_ECUS_SCHEDULE_PRESET,
): EcusSchedulePreset {
  const source = isRecord(input) ? input : {};
  const rawMode = typeof source.mode === 'string' ? source.mode.trim().toLowerCase() : fallback.mode;
  const validModes = new Set<EcusScheduleMode>(['minutes', 'hours', 'daily', 'custom']);
  const mode = validModes.has(rawMode as EcusScheduleMode)
    ? (rawMode as EcusScheduleMode)
    : fallback.mode;
  const value = clampScheduleValueForMode(mode, source.value, fallback.value);
  const time = mode === 'minutes' ? '00:00' : normalizeScheduleTimeInput(source.time ?? fallback.time, fallback.time);
  const cronValue = normalizeCronExpression(source.cron ?? source.schedule ?? fallback.cron);

  return {
    mode,
    value,
    time,
    cron: cronValue,
  };
}

function buildCronFromPreset(
  preset: EcusSchedulePreset | null | undefined,
  fallbackCron: string = DEFAULT_ECUS_SCHEDULE_PRESET.cron,
): string {
  if (!preset) {
    return normalizeCronExpression(fallbackCron);
  }

  const normalized = normalizeSchedulePreset(preset);
  const [hour = 0, minute = 0] = normalized.time
    .split(':')
    .map((part) => Number.parseInt(part, 10) || 0);

  if (normalized.mode === 'minutes') {
    return normalized.value <= 1 ? '* * * * *' : `*/${normalized.value} * * * *`;
  }

  if (normalized.mode === 'hours') {
    return normalized.value <= 1 ? `${minute} * * * *` : `${minute} */${normalized.value} * * *`;
  }

  if (normalized.mode === 'daily') {
    return `${minute} ${hour} ${normalized.value <= 1 ? '*' : `*/${normalized.value}`} * *`;
  }

  return normalizeCronExpression(normalized.cron || fallbackCron);
}

function deriveSchedulePreset(
  cronExpr: unknown,
  fallback: EcusSchedulePreset = DEFAULT_ECUS_SCHEDULE_PRESET,
): EcusSchedulePreset {
  const fallbackPreset = normalizeSchedulePreset(fallback);
  const cronValue = normalizeCronExpression(cronExpr);
  if (!cronValue) {
    return {
      ...fallbackPreset,
      mode: 'custom',
      cron: '',
    };
  }

  const parts = cronValue.split(/\s+/u).filter(Boolean);
  if (parts.length === 6) {
    parts.shift();
  }

  if (parts.length < 5) {
    return {
      ...fallbackPreset,
      mode: 'custom',
      cron: cronValue,
    };
  }

  const [minuteRaw, hourRaw, domRaw, monthRaw, dowRaw] = parts;
  const minuteNum = Number.parseInt(minuteRaw, 10);
  const hourNum = Number.parseInt(hourRaw, 10);

  if (
    (minuteRaw === '*' || minuteRaw.startsWith('*/')) &&
    hourRaw === '*' &&
    domRaw === '*' &&
    monthRaw === '*' &&
    dowRaw === '*'
  ) {
    const interval = minuteRaw.startsWith('*/') ? Number.parseInt(minuteRaw.slice(2), 10) : 1;
    return {
      mode: 'minutes',
      value: clampScheduleValueForMode('minutes', interval, fallbackPreset.value),
      time: '00:00',
      cron: cronValue,
    };
  }

  if (
    !Number.isNaN(minuteNum) &&
    (hourRaw === '*' || hourRaw.startsWith('*/')) &&
    domRaw === '*' &&
    monthRaw === '*' &&
    dowRaw === '*'
  ) {
    const interval = hourRaw.startsWith('*/') ? Number.parseInt(hourRaw.slice(2), 10) : 1;
    return {
      mode: 'hours',
      value: clampScheduleValueForMode('hours', interval, fallbackPreset.value),
      time: normalizeScheduleTimeInput(`00:${String(Math.min(Math.max(minuteNum, 0), 59)).padStart(2, '0')}`),
      cron: cronValue,
    };
  }

  if (!Number.isNaN(minuteNum) && !Number.isNaN(hourNum) && monthRaw === '*' && dowRaw === '*') {
    const timeLabel = normalizeScheduleTimeInput(`${hourNum}:${minuteNum}`, fallbackPreset.time);
    if (domRaw === '*' || domRaw === '*/1') {
      return {
        mode: 'daily',
        value: clampScheduleValueForMode('daily', 1, fallbackPreset.value),
        time: timeLabel,
        cron: cronValue,
      };
    }

    if (domRaw.startsWith('*/')) {
      const interval = Number.parseInt(domRaw.slice(2), 10);
      if (Number.isFinite(interval) && interval > 0) {
        return {
          mode: 'daily',
          value: clampScheduleValueForMode('daily', interval, fallbackPreset.value),
          time: timeLabel,
          cron: cronValue,
        };
      }
    }
  }

  return {
    ...fallbackPreset,
    mode: 'custom',
    cron: cronValue,
  };
}

function resolveSchedulePresetFromConfig(
  config: Record<string, unknown>,
  fallback: EcusSchedulePreset,
): EcusSchedulePreset {
  if (isRecord(config.schedulePreset)) {
    return normalizeSchedulePreset(config.schedulePreset, fallback);
  }

  if (
    config.scheduleMode !== undefined ||
    config.scheduleValue !== undefined ||
    config.scheduleTime !== undefined
  ) {
    return normalizeSchedulePreset(
      {
        mode: config.scheduleMode,
        value: config.scheduleValue,
        time: config.scheduleTime,
        cron: config.schedule,
      },
      fallback,
    );
  }

  if (config.schedule !== undefined) {
    return deriveSchedulePreset(config.schedule, fallback);
  }

  return normalizeSchedulePreset(fallback, fallback);
}

function normalizeCronExpression(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return `${value}`.trim();
}

function describeCronExpression(expression: unknown): string {
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

    const parts = cronExpr.split(/\s+/u);
    if (parts.length >= 5) {
      const dayOfMonth = parts[2];
      const dayOfWeek = parts[4];
      const isDaily = ['*', '?'].includes(dayOfMonth) && ['*', '?'].includes(dayOfWeek);
      if (isDaily && /^Vào\s+\d{1,2}:\d{2}$/u.test(output)) {
        return `${output} hằng ngày`;
      }
    }

    return output;
  } catch {
    return 'Không thể diễn giải biểu thức cron';
  }
}

function normalizeEcusQueryInput(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value.map((line) => `${line ?? ''}`).join('\n').trim();
  }

  return '';
}

function normalizePositiveInteger(
  value: unknown,
  fallback: number,
  options: { min?: number } = {},
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const min = Number.isFinite(options.min) ? Number(options.min) : 0;
  return Math.max(min, Math.floor(parsed));
}

function normalizeOptionalText(value: unknown): string | null {
  const normalized = normalizeStr(value);
  return normalized || null;
}

function normalizeSecret(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return typeof value === 'string' ? value : String(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
