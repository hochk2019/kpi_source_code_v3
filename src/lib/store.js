// src/lib/store.js



import { createDefaultRuleCollection } from '../shared/defaultRules.js';
import { normalizeDateInput } from '../shared/declSearch.js';

import {

  KPI_ADJUSTMENT_CATEGORY_CONFIG,

  normalizeAdjustmentCategoryKey,

} from '../../shared/kpiAdjustments.js';
import {

  IMPORT_COLUMN_IDS,

  IMPORT_AUX_COLUMN_IDS,

  IMPORT_SENSITIVE_COLUMNS,

  IMPORT_CONFIG_COLUMN_IDS,

  BASE_IMPORT_COLUMN_ID_SET,

  IMPORT_COLUMN_ID_SET,

  DEFAULT_IMPORT_COLUMN_CONFIG,

  DEFAULT_IMPORT_COLUMN_VERSION,

  MIN_IMPORT_COLUMN_WIDTH,

  normalizeImportColumnConfig,

  isSameColumnConfig,

} from '../../shared/importColumns.js';

import {
  getItem,
  setItem,
  refreshSharedKeys,
  subscribe,
  removeItem,
  patchDeclRows,
  updateCachedItem,
} from './storageClient.js';
import { fetchWithAuth } from '../auth/localAuth.js';



export { KPI_ADJUSTMENT_CATEGORY_CONFIG } from '../../shared/kpiAdjustments.js';
export {
  IMPORT_COLUMN_IDS,
  IMPORT_AUX_COLUMN_IDS,
  IMPORT_SENSITIVE_COLUMNS,
  DEFAULT_IMPORT_COLUMN_CONFIG,
  DEFAULT_IMPORT_COLUMN_VERSION,
} from '../../shared/importColumns.js';



// ===== Keys trong kho chia sáº» =====

export const DECL_KEY = "decl_rows_v1"; // dữ liệu tờ khai

export const MST_KEY = "mst_rows_v2"; // gán MST -> nhân viên/team/effective_from

const LEGACY_MST_KEY = "mst_rows_v1";

export const MST_HISTORY_KEY = "mst_history_v1"; // lịch sử chỉnh sửa trường quan trọng của MST

export const HQ_HISTORY_KEY = "hq_history_v1"; // lịch sử chỉnh sửa đại lý HQ theo MST

export const RULES_KEY = "kpi_rules_v2"; // quy tắc KPI

export const TEAM_KEY = "team_roster_v1"; // danh sách tổ đội & thành viên

export const AUDIT_KEY = "audit_logs_v1"; // nhật ký hành động quản trị

export const HQ_KEY = "hq_agencies_v1"; // cấu hình Đại lý hải quan theo MST

export const KPI_ADJUSTMENTS_KEY = "kpi_adjustments_v1"; // điểm KPI +/- bổ sung

export const KPI_ADJUSTMENT_SETTINGS_KEY = "kpi_adjustment_settings_v1"; // cấu hình mặc định điểm KPI bổ sung

export const DECL_HISTORY_KEY = "decl_history_v1"; // lịch sử chỉnh sửa tờ khai

export const DECL_DELETED_LOG_KEY = "decl_deleted_log_v1"; // nhật ký xóa tờ khai

export const DECL_DELETED_LOG_LIMIT = 500;
export const DECL_SYNC_HISTORY_KEY = "decl_sync_history_v1"; // lịch sử đồng bộ ECUS
export const DECL_SYNC_QUEUE_KEY = "decl_sync_queue_v1"; // hàng đợi đồng bộ ECUS cục bộ

export const UI_LAYOUT_KEY = "ui_layout_config_v1"; // cấu hình bố cục giao diện dùng chung

export const REPORT_SCHEDULE_KEY = "kpi_report_schedule_v1"; // lịch gửi báo cáo KPI

const KPI_ADJUSTMENT_FILTER_STATUSES = new Set(["all", "approved", "pending", "rejected"]);
const KPI_ADJUSTMENT_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const KPI_ADJUSTMENT_ANONYMOUS_USER = "__anonymous__";
const KPI_ADJUSTMENT_ALLOWED_PAGE_SIZES = Object.freeze([25, 50, 100, 150]);
const KPI_ADJUSTMENT_DEFAULT_PAGE_SIZE = 25;



const VALID_SCHEDULE_FREQUENCIES = new Set(["weekly", "monthly"]);

const VALID_SCHEDULE_FORMATS = new Set(["excel", "pdf"]);

const ADJUSTMENT_POINT_PRECISION = 2;

const ADJUSTMENT_POINT_FACTOR = 10 ** ADJUSTMENT_POINT_PRECISION;

export function roundAdjustmentPoint(value, precision = ADJUSTMENT_POINT_PRECISION) {

  if (!Number.isFinite(value)) return value;

  const factor =

    precision === ADJUSTMENT_POINT_PRECISION ? ADJUSTMENT_POINT_FACTOR : 10 ** precision;

  return Math.round(value * factor) / factor;

}



// ===== Helpers =====

function safeParse(json, fallback) {

  try { const v = JSON.parse(json); return v ?? fallback; } catch { return fallback; }

}



function shallowClone(obj) {

  return JSON.parse(JSON.stringify(obj ?? null));

}



function readUILayoutConfig() {

  const stored = safeParse(getItem(UI_LAYOUT_KEY), {});

  return stored && typeof stored === "object" && !Array.isArray(stored) ? { ...stored } : {};

}



function writeUILayoutConfig(config) {

  const target = config && typeof config === "object" && !Array.isArray(config) ? config : {};

  setItem(UI_LAYOUT_KEY, JSON.stringify(target));

  return target;

}



function normalizeCommandCenterPinList(value) {

  if (!Array.isArray(value)) {

    return [];

  }

  const seen = new Set();

  const result = [];

  for (const raw of value) {

    if (typeof raw !== "string") {

      continue;

    }

    const normalized = raw.trim();

    if (!normalized || seen.has(normalized)) {

      continue;

    }

    result.push(normalized);

    seen.add(normalized);

  }

  return result;

}



function readCommandCenterLayoutSection() {

  const layout = readUILayoutConfig();

  const section =

    layout && typeof layout.commandCenter === "object" && !Array.isArray(layout.commandCenter)

      ? { ...layout.commandCenter }

      : {};

  const pinned = normalizeCommandCenterPinList(section.pinned);

  return { layout, section, pinned };

}



function areStringArraysEqual(a, b) {

  if (a === b) {

    return true;

  }

  if (!Array.isArray(a) || !Array.isArray(b)) {

    return false;

  }

  if (a.length !== b.length) {

    return false;

  }

  for (let index = 0; index < a.length; index += 1) {

    if (a[index] !== b[index]) {

      return false;

    }

  }

  return true;

}



export function getCommandCenterPinnedCommands() {

  const { pinned } = readCommandCenterLayoutSection();

  return pinned;

}



export function saveCommandCenterPinnedCommands(nextPins, { actor = "system" } = {}) {

  const { layout, section, pinned: current } = readCommandCenterLayoutSection();

  const normalized = normalizeCommandCenterPinList(nextPins);

  if (areStringArraysEqual(current, normalized)) {

    return current;

  }

  const nextSection = { ...section, pinned: normalized };

  const nextLayout = { ...layout, commandCenter: nextSection };

  writeUILayoutConfig(nextLayout);

  pushAuditLog({

    actor,

    action: "ui.command-center.pins.update",

    detail: `Cập nhật ${normalized.length} thao tác ghim trong Command Center`,

    meta: { pinned: normalized.slice() },

  });

  return normalized;

}



export function subscribeCommandCenterPinnedCommands(listener) {

  const fn = typeof listener === "function" ? listener : null;

  if (!fn) {

    return () => {};

  }

  const emit = () => {

    try {

      fn(getCommandCenterPinnedCommands());

    } catch (error) {

      console.error("Không thể đọc danh sách ghim Command Center", error);

    }

  };

  const unsubscribe = subscribe(UI_LAYOUT_KEY, emit);

  emit();

  return () => {

    if (typeof unsubscribe === "function") {

      unsubscribe();

    }

  };

}



function normalizeKpiAdjustmentUserKey(identity) {

  const normalized = normalizeStr(identity || "");

  return normalized || KPI_ADJUSTMENT_ANONYMOUS_USER;

}



function readKpiAdjustmentFilterSection() {

  const layout = readUILayoutConfig();

  const kpiSection =

    layout && typeof layout.kpiAdjustments === "object" && !Array.isArray(layout.kpiAdjustments)

      ? { ...layout.kpiAdjustments }

      : {};

  const filters =

    kpiSection && typeof kpiSection.filters === "object" && !Array.isArray(kpiSection.filters)

      ? { ...kpiSection.filters }

      : {};

  return { layout, kpiSection, filters };

}



function normalizeKpiAdjustmentFilters(input, options = {}) {

  const {

    fallbackMonth = "all",

    fallbackMineOnly = false,

    allowStaffFilter = false,

    staffKeyAvailable = false,

    fallbackPageSize = KPI_ADJUSTMENT_DEFAULT_PAGE_SIZE,

  } = options;

  const source = input && typeof input === "object" ? input : {};

  const fallbackMonthValue =

    typeof fallbackMonth === "string" && KPI_ADJUSTMENT_MONTH_PATTERN.test(fallbackMonth)

      ? fallbackMonth

      : "all";

  const monthCandidate = (() => {

    const raw =

      typeof source.month === "string"

        ? source.month

        : typeof source.filterMonth === "string"

        ? source.filterMonth

        : null;

    if (raw === "all") return "all";

    if (typeof raw === "string" && KPI_ADJUSTMENT_MONTH_PATTERN.test(raw)) {

      return raw;

    }

    return fallbackMonthValue;

  })();

  const rawStatus =

    typeof source.status === "string"

      ? source.status.toLowerCase()

      : typeof source.filterStatus === "string"

      ? source.filterStatus.toLowerCase()

      : "";

  const status = KPI_ADJUSTMENT_FILTER_STATUSES.has(rawStatus) ? rawStatus : "all";

  const mineOnlySource =

    typeof source.mineOnly === "boolean"

      ? source.mineOnly

      : typeof source.filterMine === "boolean"

      ? source.filterMine

      : fallbackMineOnly;

  const mineOnly = Boolean(staffKeyAvailable && mineOnlySource);

  let staff = "all";

  if (allowStaffFilter) {

    const rawStaff =

      typeof source.staff === "string"

        ? source.staff

        : typeof source.filterStaff === "string"

        ? source.filterStaff

        : "";

    const normalizedStaff = normalizeStr(rawStaff);

    staff = normalizedStaff || "all";

  }

  if (mineOnly) {

    staff = "all";

  }

  const fallbackPageSizeCandidate = Number.parseInt(fallbackPageSize, 10);
  const pageSizeCandidate = Number.parseInt(
    source.pageSize ?? source.page_size ?? source.page,
    10
  );

  let pageSize = KPI_ADJUSTMENT_DEFAULT_PAGE_SIZE;

  if (KPI_ADJUSTMENT_ALLOWED_PAGE_SIZES.includes(pageSizeCandidate)) {

    pageSize = pageSizeCandidate;

  } else if (KPI_ADJUSTMENT_ALLOWED_PAGE_SIZES.includes(fallbackPageSizeCandidate)) {

    pageSize = fallbackPageSizeCandidate;

  }

  return {

    month: monthCandidate,

    status,

    mineOnly,

    staff,

    pageSize,

  };

}



export function getKpiAdjustmentFilterState(identity, options = {}) {

  const key = normalizeKpiAdjustmentUserKey(identity);

  const { filters } = readKpiAdjustmentFilterSection();

  const stored = filters[key];

  return normalizeKpiAdjustmentFilters(stored, options);

}



export function saveKpiAdjustmentFilterState(identity, updates = {}, options = {}) {

  const key = normalizeKpiAdjustmentUserKey(identity);

  const { layout, kpiSection, filters } = readKpiAdjustmentFilterSection();

  const current = normalizeKpiAdjustmentFilters(filters[key], options);

  const next = normalizeKpiAdjustmentFilters({ ...current, ...updates }, options);

  if (

    current.month === next.month &&

    current.status === next.status &&

    current.mineOnly === next.mineOnly &&

    current.staff === next.staff &&

    current.pageSize === next.pageSize

  ) {

    return next;

  }

  const nextFilters = { ...filters, [key]: next };

  const nextLayout = {

    ...layout,

    kpiAdjustments: {

      ...kpiSection,

      filters: nextFilters,

    },

  };

  writeUILayoutConfig(nextLayout);

  return next;

}



export function getImportColumnConfig() {

  const layout = readUILayoutConfig();

  const importData = layout && typeof layout.importData === "object" ? layout.importData : {};

  const current = normalizeImportColumnConfig(importData.columns);

  const hiddenBaseCount = current.hidden.filter((key) => BASE_IMPORT_COLUMN_ID_SET.has(key)).length;

  if (hiddenBaseCount >= IMPORT_COLUMN_IDS.length) {

    return {

      hidden: DEFAULT_IMPORT_COLUMN_CONFIG.hidden.slice(),

      version: DEFAULT_IMPORT_COLUMN_CONFIG.version,

      widths: {},

    };

  }

  return current;

}



export function saveImportColumnConfig({ hidden, widths } = {}, { actor = "system" } = {}) {

  const layout = readUILayoutConfig();

  const importSection = layout && typeof layout.importData === "object" ? layout.importData : {};

  const current = normalizeImportColumnConfig(importSection.columns);

  const targetHidden = Array.isArray(hidden) ? hidden : current.hidden;

  const targetWidths =

    widths && typeof widths === "object" && !Array.isArray(widths) ? widths : current.widths;

  const next = normalizeImportColumnConfig({

    hidden: targetHidden,

    version: DEFAULT_IMPORT_COLUMN_VERSION,

    widths: targetWidths,

  });

  const hiddenBaseCount = next.hidden.filter((key) => BASE_IMPORT_COLUMN_ID_SET.has(key)).length;

  if (hiddenBaseCount >= IMPORT_COLUMN_IDS.length) {

    return current;

  }

  if (isSameColumnConfig(current, next)) {

    return current;

  }

  const nextLayout = {

    ...layout,

    importData: {

      ...importSection,

      columns: next,

    },

  };

  writeUILayoutConfig(nextLayout);

  const visibleBaseColumns = IMPORT_COLUMN_IDS.length - hiddenBaseCount;

  pushAuditLog({

    actor,

    action: "import.columns.update",

    detail: `Cập nhật cột Import Data (${visibleBaseColumns}/${IMPORT_COLUMN_IDS.length} cột dữ liệu hiển thị)`,

    meta: {

      hidden: next.hidden.slice(),

      version: next.version,

      widths: { ...next.widths },

    },

  });

  return next;

}



export function subscribeImportColumnConfig(listener) {

  const fn = typeof listener === "function" ? listener : null;

  if (!fn) {

    return () => {};

  }

  const emit = () => {

    try {

      fn(getImportColumnConfig());

    } catch (err) {

      console.error("Không thể đọc cấu hình cột Import Data", err);

    }

  };

  const unsubscribe = subscribe(UI_LAYOUT_KEY, emit);

  emit();

  return () => {

    if (typeof unsubscribe === "function") {

      unsubscribe();

    }

  };

}



// Chuáº©n hoÃ¡ chuá»—i (trim + bá» khoáº£ng tráº¯ng thá»«a)

export function normalizeStr(s) {

  return (s ?? "").toString().replace(/\s+/g, " ").trim();

}



function normalizeDeletedLogString(value) {

  const text = normalizeStr(value);

  if (!text) {

    return "";

  }

  try {

    return text.normalize("NFC");

  } catch {

    return text;

  }

}



function normalizeDeletedDeclLogEntry(entry, defaults = {}) {

  if (!entry || typeof entry !== "object") {

    return null;

  }

  const soTk = normalizeDeclarationNumber(

    entry.so_tk ?? entry.number ?? defaults.so_tk ?? "",

  );

  if (!soTk) {

    return null;

  }

  const nhanh = normalizeDeletedLogString(

    entry.nhanh ?? entry.branch ?? defaults.nhanh ?? "",

  );

  const mst = normalizeDeletedLogString(

    entry.mst ??

      entry.ma_so_thue ??

      entry.tax_code ??

      entry.ma_so_thue_dn ??

      entry.mst_dn ??

      defaults.mst ??

      "",

  );

  const company = normalizeDeletedLogString(

    entry.company ??

      entry.cong_ty ??

      entry.ten_cong_ty ??

      entry.ten_dn ??

      entry.doanh_nghiep ??

      entry.ten_doanh_nghiep ??

      defaults.company ??

      "",

  );

  const deletedBy = normalizeDeletedLogString(

    entry.deleted_by ?? entry.actor ?? defaults.deleted_by ?? "",

  );

  const typeInput = entry.type ?? defaults.type;

  const type = typeInput === "hard" ? "hard" : "soft";

  const deletedAtSource =

    entry.deleted_at ??

    entry.ts ??

    defaults.deleted_at ??

    defaults.timestamp ??

    "";

  const deletedAt = normalizeStr(deletedAtSource) || new Date().toISOString();

  return {

    so_tk: soTk,

    nhanh: nhanh || null,

    mst: mst || null,

    company: company || null,

    type,

    deleted_at: deletedAt,

    deleted_by: deletedBy || null,

  };

}



function buildDeletedDeclLogEntryFromRow(row, { actor = "system", type = "soft", timestamp = new Date().toISOString() } = {}) {

  if (!row || typeof row !== "object") {

    return null;

  }

  return normalizeDeletedDeclLogEntry(

    {

      so_tk: row.so_tk ?? row.so_tk_full ?? row.number ?? "",

      nhanh: row.nhanh ?? row.branch ?? row.nhanh_kd ?? row.nhanh_hq ?? "",

      mst:

        row.mst ??

        row.ma_so_thue ??

        row.ma_so_thue_dn ??

        row.mst_dn ??

        row.tax_code ??

        "",

      company:

        row.ten_dn ??

        row.company ??

        row.cong_ty ??

        row.ten_cong_ty ??

        row.doanh_nghiep ??

        row.ten_doanh_nghiep ??

        "",

      deleted_at: timestamp,

      deleted_by: actor,

      type,

    },

    { deleted_at: timestamp, type },

  );

}



function readDeletedDeclLogRaw() {

  const serialized = getItem(DECL_DELETED_LOG_KEY);

  const parsed = safeParse(serialized, []);

  return {

    entries: Array.isArray(parsed) ? parsed : [],

    serialized: typeof serialized === "string" ? serialized : null,

  };

}



function writeDeletedDeclLog(entries, previousSerialized = null) {

  const list = Array.isArray(entries) ? entries : [];

  const normalized = [];

  for (const entry of list) {

    if (normalized.length >= DECL_DELETED_LOG_LIMIT) {

      break;

    }

    const sanitized = normalizeDeletedDeclLogEntry(entry);

    if (!sanitized) {

      continue;

    }

    normalized.push(sanitized);

  }

  const serialized = JSON.stringify(normalized);

  if (serialized !== previousSerialized) {

    setItem(DECL_DELETED_LOG_KEY, serialized);

  }

  return normalized;

}



function appendDeletedDeclLogEntries(entries) {

  const list = Array.isArray(entries) ? entries : [];

  if (list.length === 0) {

    return readDeletedDeclLog();

  }

  const { entries: existing, serialized } = readDeletedDeclLogRaw();

  const combined = [...list, ...existing];

  return writeDeletedDeclLog(combined, serialized);

}



function readDeletedDeclLog() {

  const { entries, serialized } = readDeletedDeclLogRaw();

  return writeDeletedDeclLog(entries, serialized);

}



export function getDeletedDeclLog({ from, to, type } = {}) {

  const list = readDeletedDeclLog();

  const normalizedType = type === "hard" ? "hard" : type === "soft" ? "soft" : null;

  const rangeFrom = normalizeDateInput(from);

  const rangeTo = normalizeDateInput(to);

  if (!normalizedType && !rangeFrom && !rangeTo) {

    return list.map((entry) => ({ ...entry }));

  }

  const filtered = [];

  for (const entry of list) {

    if (!entry || typeof entry !== "object") {

      continue;

    }

    if (normalizedType && entry.type !== normalizedType) {

      continue;

    }

    if (rangeFrom || rangeTo) {

      const entryDate = normalizeDateInput(entry.deleted_at ?? entry.ts ?? "");

      if (rangeFrom && (!entryDate || entryDate < rangeFrom)) {

        continue;

      }

      if (rangeTo && (!entryDate || entryDate > rangeTo)) {

        continue;

      }

    }

    filtered.push({ ...entry });

  }

  return filtered;

}



function stripDiacritics(input) {

  return normalizeStr(input)

    .normalize("NFD")

    .replace(/[\u0300-\u036f]/g, "")

    .trim();

}



export function normalizeName(name) {

  return stripDiacritics(name).toLowerCase();

}



export const MST_ASSIGNMENT_STATUS = Object.freeze({

  PENDING: 'Chưa gán nhân viên',

  ASSIGNED: 'Đã gán nhân viên',

});



const MST_STATUS_LOOKUP = new Map(

  Object.values(MST_ASSIGNMENT_STATUS).map((label) => [normalizeName(label), label])

);



function sanitizeMSTStatus(value) {

  const raw = normalizeStr(value);

  if (!raw) return '';

  const normalizedKey = normalizeName(raw);

  if (MST_STATUS_LOOKUP.has(normalizedKey)) {

    return MST_STATUS_LOOKUP.get(normalizedKey);

  }

  return raw;

}



function inferDefaultMSTStatus(row) {

  const hasImport = Boolean(normalizeStr(row?.person_import || ''));

  const hasExport = Boolean(normalizeStr(row?.person_export || ''));

  if (hasImport && hasExport) {

    return MST_ASSIGNMENT_STATUS.ASSIGNED;

  }

  return MST_ASSIGNMENT_STATUS.PENDING;

}



function pickFirstValue(source, keys, fallback) {

  if (!source || typeof source !== 'object') {

    return fallback;

  }

  for (const key of keys) {

    if (Object.prototype.hasOwnProperty.call(source, key)) {

      const value = source[key];

      if (value !== null && value !== undefined) {

        return value;

      }

    }

  }

  return fallback;

}



function compareMSTRows(a, b) {

  const byMST = a.mst.localeCompare(b.mst);

  if (byMST !== 0) return byMST;

  const fromA = a.effective_from || '';

  const fromB = b.effective_from || '';

  if (fromA !== fromB) {

    return fromA.localeCompare(fromB);

  }

  const toA = a.effective_to || '9999-12-31';

  const toB = b.effective_to || '9999-12-31';

  return toA.localeCompare(toB);

}



// MST: giá»¯ dáº¡ng chuá»—i sá»‘, bá» má»i kÃ½ tá»± khÃ´ng pháº£i sá»‘

export function normalizeMST(mst) {

  return (mst ?? "").toString().replace(/\D/g, "");

}



export function normalizeDeclarationNumber(input, length = 11) {

  const raw = (input ?? "").toString();

  if (!raw.trim()) return "";

  const digits = raw.replace(/[^0-9]/g, "");

  if (!digits) return "";

  const targetLength = Number.isFinite(length) && length > 0 ? Math.floor(length) : 11;

  if (digits.length < targetLength) {

    return digits.padStart(targetLength, "0");

  }

  if (digits.length > targetLength) {

    return digits.slice(0, targetLength);

  }

  return digits;

}



function normalizeDeclarationRow(row) {

  if (!row || typeof row !== "object") return null;

  const clone = { ...row };
  if (Object.prototype.hasOwnProperty.call(clone, "__forceReviewedOverride")) {
    delete clone.__forceReviewedOverride;
  }

  const sourceNumber = (row.so_tk_full ?? row.so_tk ?? "").toString();

  const normalized = normalizeDeclarationNumber(sourceNumber || row.so_tk);

  clone.so_tk = normalized;

  if (sourceNumber) {

    clone.so_tk_full = sourceNumber;

    const suffix = normalized ? sourceNumber.slice(normalized.length) : sourceNumber;

    clone.so_tk_suffix = suffix || "";

  }

  if (!clone.nhanh && clone.branch) {

    clone.nhanh = clone.branch;

  }



  const normalizeLicenseList = (value) => {

    if (!Array.isArray(value)) return [];

    const seen = new Set();

    for (const entry of value) {

      const normalizedCode = normalizeStr(entry).toUpperCase();

      if (normalizedCode) {

        seen.add(normalizedCode);

      }

    }

    return Array.from(seen);

  };



  if (Array.isArray(clone.licenseCodes)) {

    clone.licenseCodes = normalizeLicenseList(clone.licenseCodes);

  }

  if (Array.isArray(clone.licenseSourceCodes)) {

    clone.licenseSourceCodes = normalizeLicenseList(clone.licenseSourceCodes);

  } else if (clone.licenseSourceCodes) {

    clone.licenseSourceCodes = normalizeLicenseList([clone.licenseSourceCodes]);

  }

  if (Array.isArray(clone.licenseExcludedCodes)) {

    clone.licenseExcludedCodes = normalizeLicenseList(clone.licenseExcludedCodes);

  } else if (clone.licenseExcludedCodes) {

    clone.licenseExcludedCodes = normalizeLicenseList([clone.licenseExcludedCodes]);

  }



  if (Object.prototype.hasOwnProperty.call(clone, "licenseManualCount")) {

    const manualRaw = clone.licenseManualCount;

    if (manualRaw === null || manualRaw === undefined || manualRaw === "") {

      delete clone.licenseManualCount;

    } else {

      const parsedManual = Number(manualRaw);

      if (Number.isFinite(parsedManual)) {

        clone.licenseManualCount = Math.max(0, Math.round(parsedManual));

      } else {

        delete clone.licenseManualCount;

      }

    }

  }

  return clone;

}



function getDeclarationKey(row) {

  if (!row || typeof row !== "object") return "";

  const soTk = normalizeDeclarationNumber(row.so_tk ?? row.so_tk_full ?? "");

  if (!soTk) return "";

  const rawFull = normalizeStr(row.so_tk_full ?? "");

  const derivedSuffix = rawFull && rawFull.startsWith(soTk) ? rawFull.slice(soTk.length) : "";

  const suffixSource = row.so_tk_suffix ?? derivedSuffix;

  const suffix = normalizeStr(suffixSource || "");

  const branch = normalizeStr(row.nhanh || row.branch || "");

  return `${soTk}_${suffix}_${branch}`;

}

function getDeclRowSimpleKey(row) {

  if (!row || typeof row !== "object") return "";

  const soTk = (row.so_tk ?? "").toString();

  const nhanh = (row.nhanh ?? "").toString();

  return `${soTk}_${nhanh}`.trim();

}



function mergeDeclarationRowClient(existing, incoming) {

  if (!existing) return incoming;

  if (existing?.reviewed && incoming?.__forceReviewedOverride !== true) {

    return existing;

  }

  const merged = { ...existing };

  const sanitizeManualCount = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }
    return Math.max(0, Math.round(parsed));
  };
  const normalizeLicenseList = (value) => {
    if (!Array.isArray(value)) {
      return [];
    }
    const seen = new Set();
    const normalized = [];
    for (const item of value) {
      const text = normalizeStr(item || "");
      if (!text) continue;
      const upper = text.toUpperCase();
      if (!upper || seen.has(upper)) continue;
      seen.add(upper);
      normalized.push(upper);
    }
    return normalized;
  };
  const areLicenseSetsEqual = (a, b) => {
    if (a.length !== b.length) {
      return false;
    }
    const lookup = new Set(a);
    if (lookup.size !== b.length) {
      return false;
    }
    for (const value of b) {
      if (!lookup.has(value)) {
        return false;
      }
    }
    return true;
  };
  const computeLicenseCountFromLists = (codes, excluded, manualOverride) => {
    if (manualOverride !== null && manualOverride !== undefined) {
      return manualOverride;
    }
    if (!codes.length) {
      return 0;
    }
    const excludeSet = new Set(excluded);
    let count = 0;
    for (const code of codes) {
      if (!excludeSet.has(code)) {
        count += 1;
      }
    }
    return count;
  };
  const previousLicenseCodes = normalizeLicenseList(existing?.licenseCodes);
  const previousExcludedCodes = normalizeLicenseList(existing?.licenseExcludedCodes);
  const previousAutoLicenseCount = computeLicenseCountFromLists(
    previousLicenseCodes,
    previousExcludedCodes,
    null
  );
  const existingManualSanitized = sanitizeManualCount(existing?.licenseManualCount);
  const existingHasManualOverride =
    existingManualSanitized !== null && existingManualSanitized !== previousAutoLicenseCount;

  const skipFields = new Set([

    'nhan_vien',

    'team',

    'agency',

    'dai_ly',

    'licenses',

    'so_luong_gp',

    'licenseManualCount',

    'reviewed',

    'reviewed_at',

  ]);



  const toArray = (value) => {

    if (Array.isArray(value)) return value;

    if (value === null || value === undefined || value === '') return [];

    if (typeof value === 'string') {

      return value

        .split(/[\s,;|]+/g)

        .map((part) => part.trim())

        .filter(Boolean);

    }

    return [];

  };



  const mergeNormalizedArrayField = (field, value, { uppercase = false, replace = false } = {}) => {

    const incomingList = toArray(value)

      .map((item) => {

        const normalized = normalizeStr(item || '');

        return uppercase ? normalized.toUpperCase() : normalized;

      })

      .filter(Boolean);

    if (replace) {

      merged[field] = Array.from(new Set(incomingList));

      return;

    }

    if (!incomingList.length) {

      return;

    }

    const currentList = Array.isArray(merged[field]) ? merged[field] : [];

    const currentNormalized = currentList

      .map((item) => {

        const normalized = normalizeStr(item || '');

        return uppercase ? normalized.toUpperCase() : normalized;

      })

      .filter(Boolean);

    const combined = new Set(currentNormalized);

    let appended = false;

    for (const item of incomingList) {

      if (!combined.has(item)) {

        combined.add(item);

        appended = true;

      }

    }

    if (!Array.isArray(merged[field]) || appended) {

      merged[field] = Array.from(combined);

    }

  };



  for (const [key, value] of Object.entries(incoming)) {

    if (skipFields.has(key)) continue;

    if (key === 'co_line_count') {

      const parsed = Number(value);

      merged[key] = Number.isFinite(parsed) ? parsed : merged[key];

      continue;

    }

    if (key === 'co') {

      merged[key] = normalizeStr(value || '');

      continue;

    }

    if (key === 'has_co') {

      merged[key] = !!value;

      continue;

    }

    if (key === 'co_codes') {

      mergeNormalizedArrayField(key, value);

      continue;

    }

    if (key === 'licenseCodes' || key === 'licenseExcludedCodes') {

      mergeNormalizedArrayField(key, value, { uppercase: true, replace: true });

      continue;

    }

    if (key === 'licenseSourceCodes') {

      mergeNormalizedArrayField(key, value, { uppercase: true });

      continue;

    }

    merged[key] = value;

  }



  const fillIfBlank = (field) => {

    const current = normalizeStr(merged[field] || '');

    const incomingValue = normalizeStr(incoming[field] || '');

    if (!current && incomingValue) {

      merged[field] = incoming[field];

    }

  };

  fillIfBlank('nhan_vien');

  fillIfBlank('team');

  fillIfBlank('agency');

  fillIfBlank('dai_ly');



  const nextLicenseCodes = normalizeLicenseList(merged.licenseCodes);

  const nextExcludedCodes = normalizeLicenseList(merged.licenseExcludedCodes);

  const listsChanged =

    !areLicenseSetsEqual(previousLicenseCodes, nextLicenseCodes) ||

    !areLicenseSetsEqual(previousExcludedCodes, nextExcludedCodes);

  const incomingManualSanitized = sanitizeManualCount(incoming?.licenseManualCount);

  let manualOverrideValue = null;

  let manualOverrideChanged = false;

  if (existingHasManualOverride) {

    manualOverrideValue = existingManualSanitized;

  } else if (incomingManualSanitized !== null) {

    manualOverrideValue = incomingManualSanitized;

    manualOverrideChanged = true;

  } else {

    manualOverrideValue = null;

    if (existingManualSanitized !== null) {

      manualOverrideChanged = true;

    }

  }

  if (manualOverrideValue !== null) {

    merged.licenseManualCount = manualOverrideValue;

  } else {

    delete merged.licenseManualCount;

  }

  const shouldRefreshLicenses = listsChanged || manualOverrideChanged;

  if (shouldRefreshLicenses) {

    merged.licenseCodes = nextLicenseCodes;

    merged.licenseExcludedCodes = nextExcludedCodes;

    const refreshedCount = computeLicenseCountFromLists(

      nextLicenseCodes,

      nextExcludedCodes,

      manualOverrideValue

    );

    merged.licenses = refreshedCount;

    merged.so_luong_gp = refreshedCount;

  }

  if (Object.prototype.hasOwnProperty.call(merged, '__forceReviewedOverride')) {

    delete merged.__forceReviewedOverride;

  }

  if (incoming && Object.prototype.hasOwnProperty.call(incoming, 'deleted_at')) {

    const value = incoming.deleted_at;

    if (value === null || value === undefined || value === '') {

      delete merged.deleted_at;

    } else {

      merged.deleted_at = value;

    }

  } else if (!incoming?.deleted_at) {

    delete merged.deleted_at;

  }

  if (incoming && Object.prototype.hasOwnProperty.call(incoming, 'deleted_by')) {

    const value = incoming.deleted_by;

    if (value === null || value === undefined || value === '') {

      delete merged.deleted_by;

    } else {

      merged.deleted_by = value;

    }

  } else if (!merged.deleted_at) {

    delete merged.deleted_by;

  }

  return merged;

}



// dd/mm/yyyy -> yyyy-mm-dd ; náº¿u Ä‘Ã£ yyyy-mm-dd thÃ¬ giá»¯ nguyÃªn

export function toISODate(d, options = {}) {

  const { preferMonthFirst = false } = options;

  const s = normalizeStr(d);

  if (!s) return "";



  const pad = (value) => String(value).padStart(2, "0");

  const normalizeYear = (value) => {

    const num = Number.parseInt(value, 10);

    if (!Number.isFinite(num)) return "";

    if (value.length === 2) {

      return String(num >= 70 ? 1900 + num : 2000 + num);

    }

    return String(num).padStart(4, "0");

  };



  const tryFromParts = ({ year, month, day }) => {

    if (!year || !month || !day) return "";

    const y = normalizeYear(year);

    const m = Number.parseInt(month, 10);

    const dNum = Number.parseInt(day, 10);

    if (!y || !Number.isFinite(m) || !Number.isFinite(dNum)) return "";

    if (m < 1 || m > 12) return "";

    if (dNum < 1 || dNum > 31) return "";

    return `${y}-${pad(m)}-${pad(dNum)}`;

  };



  const isoLike = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);

  if (isoLike) {

    let [, y, m, dNum] = isoLike;

    const monthVal = Number.parseInt(m, 10);

    const dayVal = Number.parseInt(dNum, 10);

    if (monthVal > 12 && dayVal >= 1 && dayVal <= 12) {

      return tryFromParts({ year: y, month: dNum, day: m });

    }

    return tryFromParts({ year: y, month: m, day: dNum });

  }



  const slashLike = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:[ T].*)?$/);

  if (!slashLike) return "";



  const [, first, second, year] = slashLike;

  const a = Number.parseInt(first, 10);

  const b = Number.parseInt(second, 10);

  const pickMonthDay = () => {

    if (a > 12 && b <= 12) {

      return { month: second, day: first };

    }

    if (b > 12 && a <= 12) {

      return { month: first, day: second };

    }

    if (preferMonthFirst) {

      return { month: first, day: second };

    }

    return { month: second, day: first };

  };



  const { month, day } = pickMonthDay();

  return tryFromParts({ year, month, day });

}



// ===== Quy táº¯c xÃ¡c Ä‘á»‹nh Nháº­p/Xuáº¥t =====

// 30xxxxxxxxxxx -> xuáº¥t; 10xxxxxxxxxxx -> nháº­p

export function isExportByNumber(soTk) {

  const s = (soTk ?? "").toString().replace(/\D/g,"");

  return /^30\\d{9,10}$/.test(s);

}

export function isImportByNumber(soTk) {

  const s = (soTk ?? "").toString().replace(/\D/g,"");

  return /^10\\d{9,10}$/.test(s);

}

// fallback theo loáº¡i hÃ¬nh

const EXPORT_TYPES = new Set(["B11","B12","B13","E42","E52","E62","E82","G22","G23","G24","G61","H21"]);

const IMPORT_TYPES = new Set(["E11","E13","E15","E21","E31","E41","A11","A12","A41","A42","G13","G12","G51","H11"]);

export function isExportByType(loaiHinh) {

  const t = normalizeStr(loaiHinh).toUpperCase();

  return EXPORT_TYPES.has(t);

}

export function isImportByType(loaiHinh) {

  const t = normalizeStr(loaiHinh).toUpperCase();

  return IMPORT_TYPES.has(t);

}

export function isExportDecl(soTk, loaiHinh) {

  if (isExportByNumber(soTk)) return true;

  if (isImportByNumber(soTk)) return false;

  if (isExportByType(loaiHinh)) return true;

  if (isImportByType(loaiHinh)) return false;

  return false; // Neu khong ro thi coi la nhap

}



// ===== MST map (gan nhan vien theo ngay hieu luc) =====

let legacyMSTMigrated = false;



function ensureLegacyMSTMigrated() {

  if (legacyMSTMigrated) {

    return;

  }

  legacyMSTMigrated = true;

  migrateLegacyMSTRows();

}



export function getMSTRowsRaw() {

  ensureLegacyMSTMigrated();

  return safeParse(getItem(MST_KEY), []);

}



function sanitizeMSTRow(rowInput) {

  const row = rowInput && typeof rowInput === 'object' ? rowInput : {};

  const mst = normalizeMST(

    pickFirstValue(row, ['mst', 'MST', 'ma_so_thue', 'maSoThue', 'tax_code', 'taxCode'], row?.mst)

  );

  if (!mst) return null;



  const companyRaw = pickFirstValue(row, ['company', 'company_name', 'companyName', 'tenCongTy'], row?.company);

  const personImportRaw = pickFirstValue(

    row,

    [

      'person_import',

      'personImport',

      'nguoi_phu_trach_nhap',

      'nguoiPhuTrachNhap',

      'import_person',

      'importPerson',

    ],

    row?.person_import

  );

  const personExportRaw = pickFirstValue(

    row,

    [

      'person_export',

      'personExport',

      'nguoi_phu_trach_xuat',

      'nguoiPhuTrachXuat',

      'export_person',

      'exportPerson',

    ],

    row?.person_export

  );

  const teamRaw = pickFirstValue(row, ['team', 'team_name', 'teamName'], row?.team);

  const effectiveFromRaw = pickFirstValue(

    row,

    ['effective_from', 'effectiveFrom', 'from', 'start', 'valid_from'],

    row?.effective_from

  );

  const effectiveToRaw = pickFirstValue(

    row,

    ['effective_to', 'effectiveTo', 'to', 'end', 'valid_to'],

    row?.effective_to

  );

  const statusRaw = pickFirstValue(row, ['status', 'trang_thai'], row?.status);



  const sanitized = {

    mst,

    company: normalizeStr(companyRaw ?? ''),

    person_import: normalizeStr(personImportRaw ?? ''),

    person_export: normalizeStr(personExportRaw ?? ''),

    team: normalizeStr(teamRaw ?? ''),

    effective_from: toISODate(effectiveFromRaw) || '',

    effective_to: toISODate(effectiveToRaw) || '',

  };



  const resolvedStatus = sanitizeMSTStatus(statusRaw ?? '');

  sanitized.status = resolvedStatus || inferDefaultMSTStatus(sanitized);



  return sanitized;

}



function migrateLegacyMSTRows() {

  const rawValue = getItem(LEGACY_MST_KEY);

  if (rawValue === null || rawValue === undefined) {

    return null;

  }



  try {

    const parsed = safeParse(rawValue, null);

    const legacyRows = Array.isArray(parsed)

      ? parsed

      : parsed && typeof parsed === 'object' && Array.isArray(parsed.rows)

        ? parsed.rows

        : [];

    const legacyTotal = Array.isArray(legacyRows) ? legacyRows.length : 0;



    if (!legacyTotal) {

      removeItem(LEGACY_MST_KEY);

      pushAuditLog({

        actor: 'system',

        action: 'mst.migrate.v1-v2',

        detail: 'Phát hiện khoá mst_rows_v1 nhưng không có bản ghi hợp lệ để chuyển đổi',

        meta: { legacyTotal: 0, converted: 0, added: 0 },

      });

      return { migrated: 0, total: 0 };

    }



    const sanitizedLegacy = legacyRows.map((row) => sanitizeMSTRow(row)).filter(Boolean);

    const convertedCount = sanitizedLegacy.length;

    const skippedInvalid = legacyTotal - convertedCount;



    if (!convertedCount) {

      removeItem(LEGACY_MST_KEY);

      pushAuditLog({

        actor: 'system',

        action: 'mst.migrate.v1-v2',

        detail: `Không thể migrate ${legacyTotal} bản ghi gán MST do dữ liệu không hợp lệ`,

        meta: { legacyTotal, converted: 0, added: 0, skippedInvalid: legacyTotal },

        result: 'error',

      });

      return { migrated: 0, total: legacyTotal };

    }



    const currentRaw = safeParse(getItem(MST_KEY), []);

    const currentSanitized = Array.isArray(currentRaw)

      ? currentRaw.map((row) => sanitizeMSTRow(row)).filter(Boolean)

      : [];

    const currentMap = new Map(currentSanitized.map((row) => [makeMSTRowKey(row), row]));



    let added = 0;

    for (const row of sanitizedLegacy) {

      const key = makeMSTRowKey(row);

      if (currentMap.has(key)) {

        continue;

      }

      currentMap.set(key, row);

      added += 1;

    }



    if (added > 0) {

      const nextRows = Array.from(currentMap.values()).sort(compareMSTRows);

      setItem(MST_KEY, JSON.stringify(nextRows));

    }



    removeItem(LEGACY_MST_KEY);

    pushAuditLog({

      actor: 'system',

      action: 'mst.migrate.v1-v2',

      detail: `Di chuyển ${added}/${legacyTotal} bản ghi gán MST từ khoá cũ sang định dạng giai đoạn mới`,

      meta: {

        legacyTotal,

        converted: convertedCount,

        added,

        skippedInvalid,

        skippedDuplicate: convertedCount - added,

        totalAfter: currentMap.size,

      },

    });



    return { migrated: added, total: legacyTotal };

  } catch (err) {

    console.error('Không thể migrate dữ liệu mst_rows_v1 sang mst_rows_v2', err);

    pushAuditLog({

      actor: 'system',

      action: 'mst.migrate.v1-v2',

      detail: 'Lỗi khi migrate gán MST sang định dạng giai đoạn mới',

      result: 'error',

      note: err?.message || 'unknown',

    });

    return null;

  }

}



/** Lay toan bo bang gan MST, da chuan hoa + sap xep */

export function getMSTMap() {

  const raw = getMSTRowsRaw();

  const rows = Array.isArray(raw) ? raw : [];

  return rows.map(sanitizeMSTRow).filter(Boolean).sort(compareMSTRows);

}



/** Ghi de/bo sung bang gan MST (da chuan hoa du lieu dau vao) */

export function upsertMSTRows(rows, { actor = "system", detail = "" } = {}) {

  const previous = getMSTMap();



  const sanitized = Array.isArray(rows)

    ? rows.map(sanitizeMSTRow).filter(Boolean)

    : [];

  sanitized.sort(compareMSTRows);

  const changes = diffMSTRows(previous, sanitized, actor);

  setItem(MST_KEY, JSON.stringify(sanitized));

  if (changes.length) {

    appendMSTHistoryEntries(changes);

  }

  pushAuditLog({

    actor,

    action: "mst.save",

    detail: detail || `Cáº­p nháº­t ${sanitized.length} dÃ²ng gÃ¡n MST`,

  });

  return sanitized.length;

}



export function saveMSTRow(rowInput, { originalKey = null, actor = "system", detail = "" } = {}) {

  const sanitized = sanitizeMSTRow(rowInput);

  if (!sanitized) {

    return { ok: false, reason: "invalid" };

  }



  const previousRows = getMSTMap();

  const prevMap = new Map(previousRows.map((row) => [makeMSTRowKey(row), row]));

  const targetKey = originalKey ? String(originalKey) : makeMSTRowKey(rowInput);

  const previous = targetKey ? prevMap.get(targetKey) : null;



  if (originalKey && !previous) {

    return { ok: false, reason: "not-found" };

  }



  const nextKey = makeMSTRowKey(sanitized);

  if (targetKey && nextKey !== targetKey && prevMap.has(nextKey)) {

    return { ok: false, reason: "conflict" };

  }



  if (previous && nextKey === targetKey) {

    const same =

      previous.mst === sanitized.mst &&

      previous.company === sanitized.company &&

      previous.person_import === sanitized.person_import &&

      previous.person_export === sanitized.person_export &&

      previous.team === sanitized.team &&

      previous.effective_from === sanitized.effective_from &&

      previous.effective_to === sanitized.effective_to &&

      previous.status === sanitized.status;

    if (same) {

      return { ok: false, reason: "no-change", row: previous, key: targetKey };

    }

  }



  if (previous && targetKey && prevMap.has(targetKey)) {

    prevMap.delete(targetKey);

  }

  prevMap.set(nextKey, sanitized);



  const nextRows = Array.from(prevMap.values()).sort(compareMSTRows);



  const changes = diffMSTRows(previousRows, nextRows, actor);

  if (!changes.length) {

    return { ok: false, reason: "no-change", row: sanitized, key: nextKey };

  }



  setItem(MST_KEY, JSON.stringify(nextRows));

  appendMSTHistoryEntries(changes);

  pushAuditLog({

    actor,

    action: "mst.save-row",

    detail:

      detail ||

      (previous

        ? `Cập nhật gán MST cho ${sanitized.mst}`

        : `Thêm mới gán MST ${sanitized.mst}`),

  });



  return {

    ok: true,

    row: sanitized,

    key: nextKey,

    previousKey: previous ? targetKey : null,

  };

}



function diffMSTRows(prevRows, nextRows, actor) {

  const prevMap = new Map();

  for (const row of Array.isArray(prevRows) ? prevRows : []) {

    prevMap.set(makeMSTRowKey(row), row);

  }



  const nextMap = new Map();

  for (const row of Array.isArray(nextRows) ? nextRows : []) {

    nextMap.set(makeMSTRowKey(row), row);

  }



  const timestamp = new Date().toISOString();

  const actorName = normalizeStr(actor) || "system";

  const trackedFields = ["person_import", "person_export", "effective_from", "effective_to"];

  const entries = [];



  for (const [key, row] of nextMap) {

    const prev = prevMap.get(key);

    if (!prev) {

      for (const field of trackedFields) {

        const value = normalizeStr(row?.[field]);

        if (value) {

          entries.push(

            createMSTHistoryEntry({

              mst: row.mst,

              field,

              from: "",

              to: value,

              actor: actorName,

              timestamp,

              rowKey: key,

              type: "create",

            })

          );

        }

      }

      continue;

    }



    for (const field of trackedFields) {

      const prevValue = normalizeStr(prev?.[field]);

      const nextValue = normalizeStr(row?.[field]);

      if (prevValue === nextValue) continue;

      entries.push(

        createMSTHistoryEntry({

          mst: row.mst,

          field,

          from: prevValue,

          to: nextValue,

          actor: actorName,

          timestamp,

          rowKey: key,

          type: "update",

        })

      );

    }

  }



  for (const [key, row] of prevMap) {

    if (nextMap.has(key)) continue;

    for (const field of trackedFields) {

      const prevValue = normalizeStr(row?.[field]);

      if (!prevValue) continue;

      entries.push(

        createMSTHistoryEntry({

          mst: row.mst,

          field,

          from: prevValue,

          to: "",

          actor: actorName,

          timestamp,

          rowKey: key,

          type: "delete",

        })

      );

    }

  }



  return entries;

}



function makeMSTRowKey(row) {

  if (!row) return "";

  const mst = normalizeMST(row.mst);

  const effective = toISODate(row?.effective_from) || "";

  const effectiveTo = toISODate(row?.effective_to) || "";

  return `${mst || ""}__${effective}__${effectiveTo}`;

}



function createMSTHistoryEntry({ mst, field, from, to, actor, timestamp, rowKey, type }) {

  return {

    id: `mst-${rowKey || mst}-${field}-${Date.now()}-${Math.random()

      .toString(36)

      .slice(2, 8)}`,

    mst: normalizeMST(mst),

    field,

    from: normalizeStr(from),

    to: normalizeStr(to),

    actor: actor || "system",

    timestamp,

    rowKey: rowKey || makeMSTRowKey({ mst, effective_from: "", effective_to: "" }),

    type: type || "update",

  };

}



const MST_HISTORY_LIMIT = 500;



function appendMSTHistoryEntries(entries) {

  if (!entries?.length) return;

  const existing = getMSTHistoryEntries();

  const merged = [...entries, ...existing]

    .filter(Boolean)

    .sort((a, b) => {

      const timeA = new Date(a?.timestamp || 0).getTime();

      const timeB = new Date(b?.timestamp || 0).getTime();

      return timeB - timeA;

    })

    .slice(0, MST_HISTORY_LIMIT);

  setItem(MST_HISTORY_KEY, JSON.stringify(merged));

}



export function getMSTHistoryEntries(limit = MST_HISTORY_LIMIT) {

  const raw = safeParse(getItem(MST_HISTORY_KEY), []);

  const entries = Array.isArray(raw) ? raw : [];

  const normalized = entries

    .map((entry) => {

      if (!entry || !entry.mst) return null;

      const timestamp = entry.timestamp || new Date().toISOString();

      return {

        id: entry.id || `mst-${entry.mst}-${entry.field || "field"}-${timestamp}`,

        mst: normalizeMST(entry.mst),

        field: entry.field || "",

        from: normalizeStr(entry.from),

        to: normalizeStr(entry.to),

        actor: normalizeStr(entry.actor) || "system",

        timestamp,

        rowKey:

          entry.rowKey ||

          makeMSTRowKey({

            mst: entry.mst,

            effective_from: entry.effective_from || "",

            effective_to: entry.effective_to || "",

          }),

        type: entry.type || "update",

      };

    })

    .filter(Boolean)

    .sort((a, b) => {

      const timeA = new Date(a.timestamp || 0).getTime();

      const timeB = new Date(b.timestamp || 0).getTime();

      return timeB - timeA;

    });



  if (!Number.isFinite(limit) || limit <= 0) {

    return normalized;

  }

  return normalized.slice(0, limit);

}



export function getMSTHistoryFor(mst, limit = 20) {

  const normalizedMST = normalizeMST(mst);

  if (!normalizedMST) return [];

  const entries = getMSTHistoryEntries();

  const filtered = entries.filter((entry) => entry.mst === normalizedMST);

  if (!Number.isFinite(limit) || limit <= 0) {

    return filtered;

  }

  return filtered.slice(0, limit);

}



const DECL_HISTORY_PER_ROW_LIMIT = 20;

const DECL_HISTORY_MAX_ROWS = 300;



const DECL_HISTORY_FIELD_GROUP = Object.freeze({

  agency: "agency",

  dai_ly: "agency",

  licenses: "licenses",

  so_luong_gp: "licenses",

  licenseManualCount: "licenses",

});



function normalizeDeclHistoryValue(value) {

  if (value === null || value === undefined) return "";

  if (Array.isArray(value)) {

    return value

      .map((item) => normalizeDeclHistoryValue(item))

      .filter((part) => typeof part === "string" && part.length > 0)

      .join(", ");

  }

  if (typeof value === "number") {

    return Number.isFinite(value) ? String(value) : "";

  }

  if (typeof value === "boolean") {

    return value ? "Có" : "Không";

  }

  if (typeof value === "object") {

    try {

      return JSON.stringify(value);

    } catch {

      return "";

    }

  }

  return normalizeStr(value);

}



function pickDeclLicenseValue(row) {

  if (!row || typeof row !== "object") return "";

  const candidates = [row.licenseManualCount, row.licenses, row.so_luong_gp];

  for (const candidate of candidates) {

    if (candidate === null || candidate === undefined || candidate === "") {

      continue;

    }

    if (typeof candidate === "number") {

      if (Number.isFinite(candidate)) {

        return candidate;

      }

      continue;

    }

    if (typeof candidate === "string") {

      const trimmed = candidate.trim();

      if (!trimmed) {

        continue;

      }

      const parsed = Number(trimmed);

      if (Number.isFinite(parsed)) {

        return parsed;

      }

      return trimmed;

    }

    const parsed = Number(candidate);

    if (Number.isFinite(parsed)) {

      return parsed;

    }

    return candidate;

  }

  return "";

}



function extractDeclHistoryValue(row, field) {

  if (!row || typeof row !== "object") return "";

  switch (field) {

    case "agency":

      return row.agency ?? row.dai_ly ?? "";

    case "licenses":

      return pickDeclLicenseValue(row);

    default:

      return row[field];

  }

}



function buildDeclHistoryChanges(current, nextRow, changedFields) {

  if (!Array.isArray(changedFields) || changedFields.length === 0) {

    return [];

  }

  const groups = new Map();

  for (const field of changedFields) {

    const resolved = DECL_HISTORY_FIELD_GROUP[field] || field;

    if (!resolved || groups.has(resolved)) {

      continue;

    }

    const before = normalizeDeclHistoryValue(extractDeclHistoryValue(current, resolved));

    const after = normalizeDeclHistoryValue(extractDeclHistoryValue(nextRow, resolved));

    if (before === after) {

      continue;

    }

    groups.set(resolved, {

      field: resolved,

      before,

      after,

    });

  }

  return Array.from(groups.values());

}



function normalizeDeclHistoryEntry(rowKey, entry) {

  if (!entry || typeof entry !== "object") return null;

  const timestamp = entry.ts || entry.timestamp || new Date().toISOString();

  const actor = normalizeStr(entry.actor) || "system";

  const rawChanges = Array.isArray(entry.changes) ? entry.changes : [];

  const changes = rawChanges

    .map((change) => {

      if (!change || typeof change !== "object") return null;

      const fieldKey = (change.field || change.key || change.name || "").toString().trim();

      if (!fieldKey) return null;

      const resolved = DECL_HISTORY_FIELD_GROUP[fieldKey] || fieldKey;

      const before = normalizeDeclHistoryValue(change.before ?? change.old ?? change.previous ?? "");

      const after = normalizeDeclHistoryValue(change.after ?? change.new ?? change.next ?? "");

      if (before === after) return null;

      return {

        field: resolved,

        before,

        after,

      };

    })

    .filter(Boolean);

  if (!changes.length) return null;

  return {

    id: entry.id || `decl-${rowKey}-${Math.random().toString(36).slice(2, 8)}-${Date.now()}`,

    ts: new Date(timestamp).toISOString(),

    actor,

    changes,

  };

}



function sanitizeDeclHistoryStore(rawStore) {

  const safeRows = {};

  if (!rawStore || typeof rawStore !== "object") {

    return { rows: safeRows };

  }

  const sourceRows = rawStore.rows && typeof rawStore.rows === "object" && !Array.isArray(rawStore.rows)

    ? rawStore.rows

    : {};

  for (const [key, list] of Object.entries(sourceRows)) {

    const normalizedKey = normalizeStr(key);

    if (!normalizedKey) continue;

    const entries = Array.isArray(list)

      ? list

          .map((entry) => normalizeDeclHistoryEntry(normalizedKey, entry))

          .filter(Boolean)

      : [];

    if (entries.length) {

      safeRows[normalizedKey] = entries.slice(0, DECL_HISTORY_PER_ROW_LIMIT);

    }

  }

  return { rows: safeRows };

}



function getDeclHistoryStore() {

  const parsed = safeParse(getItem(DECL_HISTORY_KEY), { rows: {} });

  return sanitizeDeclHistoryStore(parsed);

}



function persistDeclHistoryStore(store) {

  const payload = sanitizeDeclHistoryStore(store);

  const rows = payload.rows || {};

  const rowEntries = Object.entries(rows).map(([key, list]) => {

    const items = Array.isArray(list) ? list.filter(Boolean) : [];

    if (!items.length) {

      delete rows[key];

      return null;

    }

    rows[key] = items.slice(0, DECL_HISTORY_PER_ROW_LIMIT);

    const latestTs = rows[key][0]?.ts || "1970-01-01T00:00:00.000Z";

    return { key, ts: latestTs };

  }).filter(Boolean);



  if (rowEntries.length > DECL_HISTORY_MAX_ROWS) {

    rowEntries.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

    const keep = new Set(rowEntries.slice(0, DECL_HISTORY_MAX_ROWS).map((entry) => entry.key));

    for (const key of Object.keys(rows)) {

      if (!keep.has(key)) {

        delete rows[key];

      }

    }

  }



  setItem(DECL_HISTORY_KEY, JSON.stringify({ rows }));

  return { rows };

}



function appendDeclHistoryEntry(rowKey, entry) {

  const key = typeof rowKey === "string" ? rowKey.trim() : String(rowKey || "").trim();

  if (!key) return null;

  if (!entry || typeof entry !== "object" || !Array.isArray(entry.changes) || !entry.changes.length) {

    return null;

  }

  const store = getDeclHistoryStore();

  const actor = normalizeStr(entry.actor) || "system";

  const timestamp = entry.ts || entry.timestamp || new Date().toISOString();

  const changes = entry.changes

    .map((change) => {

      if (!change || typeof change !== "object") return null;

      const fieldKey = (change.field || change.key || "").toString().trim();

      if (!fieldKey) return null;

      const resolved = DECL_HISTORY_FIELD_GROUP[fieldKey] || fieldKey;

      const before = normalizeDeclHistoryValue(change.before);

      const after = normalizeDeclHistoryValue(change.after);

      if (before === after) return null;

      return {

        field: resolved,

        before,

        after,

      };

    })

    .filter(Boolean);

  if (!changes.length) {

    return null;

  }

  const normalizedEntry = {

    id: entry.id || `decl-${key}-${Math.random().toString(36).slice(2, 8)}-${Date.now()}`,

    ts: new Date(timestamp).toISOString(),

    actor,

    changes,

  };

  const existing = Array.isArray(store.rows[key]) ? store.rows[key] : [];

  const nextList = [normalizedEntry, ...existing].slice(0, DECL_HISTORY_PER_ROW_LIMIT);

  const nextStore = {

    rows: {

      ...store.rows,

      [key]: nextList,

    },

  };

  persistDeclHistoryStore(nextStore);

  return normalizedEntry;

}



export function getDeclHistoryForRow(rowKey, limit = DECL_HISTORY_PER_ROW_LIMIT) {

  const key = typeof rowKey === "string" ? rowKey.trim() : String(rowKey || "").trim();

  if (!key) return [];

  const store = getDeclHistoryStore();

  const list = Array.isArray(store.rows[key]) ? store.rows[key] : [];

  if (!Number.isFinite(limit) || limit <= 0) {

    return list.slice();

  }

  return list.slice(0, limit);

}



/** Lay nguoi phu trach theo MST & ngay hieu luc gan nhat (<= ngay to khai) */

export function getMSTFor(mst, isoDate) {

  const rows = getMSTMap().filter((r) => normalizeMST(r.mst) === normalizeMST(mst));

  if (rows.length === 0) return null;



  if (!isoDate) {

    return rows[rows.length - 1];

  }



  const target = new Date(isoDate);

  const targetTime = Number.isNaN(target.getTime()) ? null : target.getTime();

  if (targetTime == null) {

    return rows[rows.length - 1];

  }



  const resolveTime = (value, fallbackInfinity = false) => {

    if (!value) {

      return fallbackInfinity ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

    }

    const date = new Date(value);

    const time = date.getTime();

    if (Number.isNaN(time)) {

      return fallbackInfinity ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

    }

    return time;

  };



  const candidates = rows

    .map((row) => {

      const from = resolveTime(row.effective_from);

      const to = resolveTime(row.effective_to, true);

      const isWithin = targetTime >= from && targetTime <= to;

      const distance = targetTime - from;

      return { row, from, to, isWithin, distance };

    })

    .sort((a, b) => {

      if (a.from !== b.from) {

        return a.from - b.from;

      }

      return a.to - b.to;

    });



  const active = candidates.filter((entry) => entry.isWithin);

  if (active.length) {

    return active.sort((a, b) => b.from - a.from)[0]?.row ?? rows[0];

  }



  const before = candidates.filter((entry) => entry.from <= targetTime);

  if (before.length) {

    return before.sort((a, b) => b.from - a.from)[0]?.row ?? rows[0];

  }



  return candidates[0]?.row ?? rows[0];

}



// ===== DECL rows (tá» khai) =====

function normalizeDeclRows(rows) {

  const input = Array.isArray(rows) ? rows : [];

  const map = new Map();

  const extras = [];

  for (const entry of input) {

    if (!entry || typeof entry !== 'object') {

      continue;

    }

    const normalized = normalizeDeclarationRow(entry) || entry;

    const key = getDeclarationKey(normalized);

    if (!key) {

      extras.push(normalized);

      continue;

    }

    const existing = map.get(key);

    if (!existing) {

      map.set(key, normalized);

    } else {

      map.set(key, mergeDeclarationRowClient(existing, normalized));

    }

  }

  return extras.concat(Array.from(map.values()));

}




const DECL_SYNC_PROGRESS_DEFAULT = Object.freeze({
  status: "idle",
  step: "idle",
  message: "",
  startedAt: null,
  finishedAt: null,
  rowsBefore: 0,
  rowsAfter: 0,
  jobId: null,
  diff: null,
  error: null,
  conflicts: Object.freeze([]),
  conflictCount: 0,
  hasConflicts: false,
});

let declSyncProgressState = { ...DECL_SYNC_PROGRESS_DEFAULT };

const declSyncProgressListeners = new Set();

function cloneDeclSyncProgress(progress) {
  const base = progress ? { ...progress } : { ...DECL_SYNC_PROGRESS_DEFAULT };
  base.diff = base.diff && typeof base.diff === "object" ? { ...base.diff } : null;
  base.conflicts = Array.isArray(base.conflicts) ? base.conflicts.map((entry) => ({ ...entry })) : [];
  return base;
}

function notifyDeclSyncProgress() {
  const snapshot = cloneDeclSyncProgress(declSyncProgressState);
  for (const listener of declSyncProgressListeners) {
    try {
      listener(snapshot);
    } catch (error) {
      console.error("Decl sync progress listener error", error);
    }
  }
  return snapshot;
}

function applyDeclSyncProgressPatch(patch, replace = false) {
  const base = replace ? { ...DECL_SYNC_PROGRESS_DEFAULT } : { ...declSyncProgressState };
  const next = {
    ...base,
    ...(patch || {}),
  };
  if (patch && Object.prototype.hasOwnProperty.call(patch, "diff")) {
    next.diff = patch.diff && typeof patch.diff === "object" ? { ...patch.diff } : null;
  } else if (base.diff && typeof base.diff === "object") {
    next.diff = { ...base.diff };
  } else {
    next.diff = null;
  }
  if (patch && Object.prototype.hasOwnProperty.call(patch, "conflicts")) {
    next.conflicts = Array.isArray(patch.conflicts)
      ? patch.conflicts.map((entry) => ({ ...entry }))
      : [];
  } else if (base.conflicts && Array.isArray(base.conflicts)) {
    next.conflicts = base.conflicts.map((entry) => ({ ...entry }));
  } else {
    next.conflicts = [];
  }
  if (patch && Object.prototype.hasOwnProperty.call(patch, "conflictCount")) {
    const count = Number(patch.conflictCount);
    next.conflictCount = Number.isFinite(count) ? count : 0;
  } else {
    const count = Number(base.conflictCount);
    next.conflictCount = Number.isFinite(count) ? count : 0;
  }
  if (patch && Object.prototype.hasOwnProperty.call(patch, "hasConflicts")) {
    next.hasConflicts = !!patch.hasConflicts;
  } else {
    next.hasConflicts = !!base.hasConflicts;
  }
  declSyncProgressState = next;
  return notifyDeclSyncProgress();
}

export function getDeclSyncProgress() {
  return cloneDeclSyncProgress(declSyncProgressState);
}

export function subscribeDeclSyncProgress(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }
  declSyncProgressListeners.add(listener);
  return () => {
    declSyncProgressListeners.delete(listener);
  };
}

function canonicalizeDeclRowForDiff(row) {
  if (!row || typeof row !== "object") {
    return "";
  }
  const normalized = {};
  const entries = Object.entries(row)
    .filter(([key, value]) => {
      if (key === "__forceReviewedOverride") {
        return false;
      }
      return typeof value !== "function";
    })
    .sort(([a], [b]) => a.localeCompare(b, "vi"));
  for (const [key, value] of entries) {
    normalized[key] = value;
  }
  return JSON.stringify(normalized);
}

function computeDeclRowDiff(previousRows, nextRows) {
  const diff = {
    added: 0,
    updated: 0,
    removed: 0,
    totalBefore: Array.isArray(previousRows) ? previousRows.length : 0,
    totalAfter: Array.isArray(nextRows) ? nextRows.length : 0,
  };

  const beforeMap = new Map();
  const beforeExtras = new Map();

  const registerExtra = (target, row) => {
    const fingerprint = canonicalizeDeclRowForDiff(row);
    target.set(fingerprint, (target.get(fingerprint) || 0) + 1);
  };

  for (const row of Array.isArray(previousRows) ? previousRows : []) {
    if (!row || typeof row !== "object") continue;
    const key = getDeclarationKey(row);
    if (key) {
      beforeMap.set(key, canonicalizeDeclRowForDiff(row));
    } else {
      registerExtra(beforeExtras, row);
    }
  }

  for (const row of Array.isArray(nextRows) ? nextRows : []) {
    if (!row || typeof row !== "object") continue;
    const key = getDeclarationKey(row);
    if (key) {
      const snapshot = canonicalizeDeclRowForDiff(row);
      if (!beforeMap.has(key)) {
        diff.added += 1;
      } else {
        if (beforeMap.get(key) !== snapshot) {
          diff.updated += 1;
        }
        beforeMap.delete(key);
      }
    } else {
      const fingerprint = canonicalizeDeclRowForDiff(row);
      const count = beforeExtras.get(fingerprint) || 0;
      if (count > 0) {
        beforeExtras.set(fingerprint, count - 1);
      } else {
        diff.added += 1;
      }
    }
  }

  let removedExtras = 0;
  for (const value of beforeExtras.values()) {
    removedExtras += value;
  }
  diff.removed = beforeMap.size + removedExtras;
  return diff;
}

function parseTimestampToMs(value) {
  if (!value) return null;
  try {
    const ts = Date.parse(value);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}

const DECL_SYNC_CONFLICT_IGNORED_FIELDS = new Set([
  "__forceReviewedOverride",
  "updatedAt",
]);

const DECL_SYNC_FIELD_LABELS = Object.freeze({
  agency: "Đại lý",
  dai_ly: "Đại lý",
  nhan_vien: "Nhân viên",
  team: "Tổ đội",
  licenses: "Số lượng giấy phép",
  so_luong_gp: "Số lượng giấy phép",
  licenseManualCount: "Số lượng giấy phép (thủ công)",
});

function normalizeConflictFieldKey(field) {
  if (!field) return "";
  const resolved = DECL_HISTORY_FIELD_GROUP[field] || field;
  return resolved;
}

function buildConflictFieldDetail(previous, nextRow, field) {
  const resolved = normalizeConflictFieldKey(field);
  const label =
    DECL_SYNC_FIELD_LABELS[resolved] ||
    DECL_SYNC_FIELD_LABELS[field] ||
    resolved;
  return {
    field: resolved,
    label,
    before: normalizeDeclHistoryValue(extractDeclHistoryValue(previous, resolved)),
    after: normalizeDeclHistoryValue(extractDeclHistoryValue(nextRow, resolved)),
  };
}

export function computeDeclSyncConflicts(previousRows, nextRows, options = {}) {
  const previousMap = new Map();
  for (const row of Array.isArray(previousRows) ? previousRows : []) {
    const key = getDeclarationKey(row);
    if (!key) continue;
    previousMap.set(key, row);
  }

  if (!previousMap.size) {
    return [];
  }

  const limit = Number.isFinite(options.limit) && options.limit > 0 ? Math.floor(options.limit) : 50;
  const historyLimit = Number.isFinite(options.historyLimit) && options.historyLimit > 0 ? Math.floor(options.historyLimit) : 5;
  const baselineTs = parseTimestampToMs(options.baselineTimestamp);
  const historyProvider =
    typeof options.historyProvider === "function" ? options.historyProvider : getDeclHistoryForRow;

  const conflicts = [];

  for (const nextRow of Array.isArray(nextRows) ? nextRows : []) {
    if (!nextRow || typeof nextRow !== "object") continue;
    const key = getDeclarationKey(nextRow);
    if (!key || !previousMap.has(key)) {
      continue;
    }
    const previous = previousMap.get(key) || {};
    const fieldKeys = new Set([
      ...Object.keys(previous || {}),
      ...Object.keys(nextRow || {}),
    ]);
    const changedFields = [];
    for (const field of fieldKeys) {
      if (DECL_SYNC_CONFLICT_IGNORED_FIELDS.has(field)) continue;
      if (!isEqualDeclValue(previous?.[field], nextRow?.[field])) {
        changedFields.push(field);
      }
    }
    if (!changedFields.length) {
      continue;
    }

    const resolvedChanged = new Set(changedFields.map((field) => normalizeConflictFieldKey(field)));
    const historyList = historyProvider ? historyProvider(key, historyLimit) : [];
    const relevantHistory = [];
    const manualFields = new Set();
    let latestManualTs = null;
    let latestManualActor = null;

    for (const entry of Array.isArray(historyList) ? historyList : []) {
      if (!entry || typeof entry !== "object" || !Array.isArray(entry.changes)) {
        continue;
      }
      const entryTs = parseTimestampToMs(entry.ts || entry.timestamp);
      if (baselineTs && Number.isFinite(entryTs) && entryTs < baselineTs) {
        continue;
      }
      const matchedChanges = entry.changes
        .map((change) => {
          if (!change || typeof change !== "object") {
            return null;
          }
          const resolvedField = normalizeConflictFieldKey(change.field);
          if (!resolvedField || !resolvedChanged.has(resolvedField)) {
            return null;
          }
          manualFields.add(resolvedField);
          return {
            field: resolvedField,
            before: change.before,
            after: change.after,
          };
        })
        .filter(Boolean);
      if (!matchedChanges.length) {
        continue;
      }
      const normalizedEntry = {
        actor: entry.actor || "system",
        ts: entryTs ? new Date(entryTs).toISOString() : entry.ts || null,
        changes: matchedChanges,
      };
      relevantHistory.push(normalizedEntry);
      if (Number.isFinite(entryTs) && (!latestManualTs || entryTs > latestManualTs)) {
        latestManualTs = entryTs;
        latestManualActor = entry.actor || null;
      }
    }

    if (!manualFields.size) {
      continue;
    }

    const conflictFields = Array.from(manualFields).filter((field) => resolvedChanged.has(field));
    if (!conflictFields.length) {
      continue;
    }

    const details = conflictFields.map((field) => buildConflictFieldDetail(previous, nextRow, field));
    const conflict = {
      key,
      soTk: normalizeDeclarationNumber(nextRow?.so_tk ?? previous?.so_tk ?? ""),
      nhanh: normalizeStr(nextRow?.nhanh ?? previous?.nhanh ?? ""),
      fields: details,
      history: relevantHistory.slice(0, historyLimit),
      lastManualAt: latestManualTs ? new Date(latestManualTs).toISOString() : null,
      lastManualActor: latestManualActor,
    };

    conflicts.push(conflict);
    if (conflicts.length >= limit) {
      break;
    }
  }

  return conflicts;
}

function formatDeclSyncDiffSummary(diff) {
  if (!diff || typeof diff !== "object") {
    return "Đã cập nhật dữ liệu tờ khai từ ECUS.";
  }
  const added = Number.isFinite(diff.added) ? diff.added : 0;
  const updated = Number.isFinite(diff.updated) ? diff.updated : 0;
  const removed = Number.isFinite(diff.removed) ? diff.removed : 0;
  const parts = [];
  if (added > 0) {
    parts.push(`${added.toLocaleString("vi-VN")} mới`);
  }
  if (updated > 0) {
    parts.push(`${updated.toLocaleString("vi-VN")} cập nhật`);
  }
  if (removed > 0) {
    parts.push(`${removed.toLocaleString("vi-VN")} gỡ bỏ`);
  }
  const base = parts.length
    ? `Đã cập nhật ${parts.join(", ")}.`
    : "Không có thay đổi mới từ ECUS.";
  if (Number.isFinite(diff.totalAfter)) {
    return `${base} Tổng cộng ${diff.totalAfter.toLocaleString("vi-VN")} tờ khai đang lưu.`;
  }
  return base;
}

function getDeclRowsRaw() {

  const rawString = getItem(DECL_KEY);

  const stored = safeParse(rawString, []);

  const normalized = normalizeDeclRows(stored);



  try {

    const serialized = JSON.stringify(normalized);

    if (rawString !== serialized) {

      setItem(DECL_KEY, serialized);

    }

  } catch {

    // Bỏ qua lỗi tuần tự hóa, hàm vẫn trả về dữ liệu đã chuẩn hóa

  }



  return normalized;

}



function writeDeclRows(rows) {

  const normalized = normalizeDeclRows(rows);

  setItem(DECL_KEY, JSON.stringify(normalized));

  return normalized;

}



export function getDeclRows() {

  const rows = getDeclRowsRaw();

  return applyAgenciesToDeclRows(rows);

}



export async function refreshDeclRowsFromServer(options = {}) {
  const previousRows = getDeclRowsRaw();
  const requestedJobId = typeof options.jobId === "string" ? options.jobId.trim() : "";
  const jobId = requestedJobId || (declSyncProgressState.jobId && declSyncProgressState.status === "running"
    ? declSyncProgressState.jobId
    : null);
  const startedAt = Number.isFinite(declSyncProgressState.startedAt) && declSyncProgressState.status === "running"
    ? declSyncProgressState.startedAt
    : Date.now();

  applyDeclSyncProgressPatch(
    {
      status: "running",
      step: "reading",
      message: "Đang đọc dữ liệu từ ECUS...",
      startedAt,
      finishedAt: null,
      rowsBefore: Array.isArray(previousRows) ? previousRows.length : 0,
      rowsAfter: Array.isArray(previousRows) ? previousRows.length : 0,
      jobId,
      error: null,
      diff: null,
    },
    true
  );

  try {
    await refreshSharedKeys([DECL_KEY, DECL_SYNC_HISTORY_KEY], options);
    applyDeclSyncProgressPatch({
      status: "running",
      step: "diff",
      message: "Đang tính toán thay đổi...",
      rowsBefore: Array.isArray(previousRows) ? previousRows.length : 0,
      jobId,
    });

    const rows = getDeclRowsRaw();
    const diff = computeDeclRowDiff(previousRows, rows);
    const conflicts = computeDeclSyncConflicts(previousRows, rows, {
      baselineTimestamp: options?.syncMeta?.runAt,
      historyLimit: 6,
    });
    const conflictCount = conflicts.length;
    const hasConflicts = conflictCount > 0;

    applyDeclSyncProgressPatch({
      status: "running",
      step: "writing",
      message: "Đang ghi vào kho tờ khai...",
      rowsAfter: Array.isArray(rows) ? rows.length : 0,
      diff,
      jobId,
      conflicts,
      conflictCount,
      hasConflicts,
    });

    const applied = applyAgenciesToDeclRows(rows);
    const baseSummary = formatDeclSyncDiffSummary(diff);
    const summary = hasConflicts
      ? `${baseSummary} Phát hiện ${conflictCount.toLocaleString("vi-VN")} tờ khai có xung đột cần rà soát.`
      : baseSummary;

    applyDeclSyncProgressPatch({
      status: "success",
      step: "completed",
      message: summary,
      finishedAt: Date.now(),
      rowsAfter: Array.isArray(applied) ? applied.length : 0,
      diff,
      jobId,
      conflicts,
      conflictCount,
      hasConflicts,
    });

    return applied;
  } catch (error) {
    const message = error?.message || "Không thể tải dữ liệu tờ khai";
    applyDeclSyncProgressPatch({
      status: "error",
      step: "error",
      message,
      error: message,
      finishedAt: Date.now(),
      jobId,
    });
    throw error;
  }
}






// ===== Lịch sử đồng bộ ECUS =====

const DECL_SYNC_HISTORY_DEFAULT_LIMIT = 120;

function normalizeDeclSyncHistoryTimestamp(value) {
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();
    const ts = Date.parse(trimmed);
    if (Number.isFinite(ts)) {
      return new Date(ts).toISOString();
    }
    return trimmed;
  }
  if (Number.isFinite(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return new Date().toISOString();
}

function normalizeDeclSyncHistoryEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const id =
    typeof entry.id === 'string' && entry.id.trim()
      ? entry.id.trim()
      : `decl-sync-history-${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;
  const runAt = normalizeDeclSyncHistoryTimestamp(
    entry.runAt ?? entry.ts ?? entry.completedAt ?? entry.startedAt
  );
  const actor = typeof entry.actor === 'string' && entry.actor.trim() ? entry.actor.trim() : 'system';
  const reason = typeof entry.reason === 'string' && entry.reason.trim() ? entry.reason.trim() : 'manual';
  const status = typeof entry.status === 'string' && entry.status.trim() ? entry.status.trim() : 'success';
  const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };
  const fetched = toNumber(entry.fetched ?? entry.rowsFetched);
  const inserted = toNumber(entry.inserted ?? entry.imported ?? entry.rowsInserted);
  const updated = toNumber(entry.updated ?? entry.rowsUpdated);
  const skipped = toNumber(entry.skipped ?? entry.rowsSkipped);
  const locked = toNumber(entry.locked ?? entry.reviewLocked ?? entry.rowsReviewLocked);
  const stored = toNumber(entry.stored ?? entry.storedTotal ?? entry.totalStored ?? entry.rowsAfter);
  const durationMsRaw = Number(entry.durationMs ?? entry.duration);
  const durationMs = Number.isFinite(durationMsRaw) ? durationMsRaw : null;
  const conflictCountRaw = Number(entry.conflictCount ?? entry.conflicts);
  const conflictCount = Number.isFinite(conflictCountRaw) ? conflictCountRaw : 0;
  const hasConflicts = entry.hasConflicts === true || conflictCount > 0;
  const jobId = typeof entry.jobId === 'string' && entry.jobId.trim() ? entry.jobId.trim() : null;
  const rangeSource = entry.range && typeof entry.range === 'object' ? entry.range : {};
  const from = typeof rangeSource.from === 'string' && rangeSource.from.trim() ? rangeSource.from.trim() : null;
  const to = typeof rangeSource.to === 'string' && rangeSource.to.trim() ? rangeSource.to.trim() : null;
  const range = from || to ? { from, to } : null;
  const meta = entry.meta && typeof entry.meta === 'object' ? { ...entry.meta } : null;
  return {
    id,
    runAt,
    actor,
    reason,
    status,
    fetched,
    inserted,
    updated,
    skipped,
    locked,
    stored,
    conflictCount,
    hasConflicts,
    durationMs,
    jobId,
    range,
    meta,
  };
}

function cloneDeclSyncHistoryEntry(entry) {
  if (!entry) {
    return null;
  }
  const clone = { ...entry };
  if (entry.range && typeof entry.range === 'object') {
    clone.range = { from: entry.range.from || null, to: entry.range.to || null };
  }
  if (entry.meta && typeof entry.meta === 'object') {
    clone.meta = { ...entry.meta };
  }
  return clone;
}

function normalizeDeclSyncHistoryList() {
  const raw = safeParse(getItem(DECL_SYNC_HISTORY_KEY), []);
  const source = Array.isArray(raw) ? raw : [];
  const normalized = [];
  const seen = new Set();
  for (const entry of source) {
    const normalizedEntry = normalizeDeclSyncHistoryEntry(entry);
    if (!normalizedEntry || seen.has(normalizedEntry.id)) {
      continue;
    }
    seen.add(normalizedEntry.id);
    normalized.push(normalizedEntry);
  }
  normalized.sort((a, b) => {
    const aTime = Date.parse(a.runAt || 0);
    const bTime = Date.parse(b.runAt || 0);
    if (Number.isFinite(bTime) && Number.isFinite(aTime) && bTime !== aTime) {
      return bTime - aTime;
    }
    if (Number.isFinite(bTime) && !Number.isFinite(aTime)) {
      return -1;
    }
    if (!Number.isFinite(bTime) && Number.isFinite(aTime)) {
      return 1;
    }
    return b.id.localeCompare(a.id);
  });
  if (normalized.length > DECL_SYNC_HISTORY_DEFAULT_LIMIT) {
    return normalized.slice(0, DECL_SYNC_HISTORY_DEFAULT_LIMIT);
  }
  return normalized;
}

export function getDeclSyncHistory(options = {}) {
  const limit = Number.isFinite(options?.limit) && options.limit > 0 ? Math.floor(options.limit) : null;
  const entries = normalizeDeclSyncHistoryList();
  const sliced = limit ? entries.slice(0, limit) : entries;
  return sliced.map((entry) => cloneDeclSyncHistoryEntry(entry));
}

export function subscribeDeclSyncHistory(listener, options = {}) {
  const fn = typeof listener === 'function' ? listener : null;
  if (!fn) {
    return () => {};
  }
  const limit = Number.isFinite(options?.limit) && options.limit > 0 ? Math.floor(options.limit) : null;
  const emit = () => {
    try {
      fn(getDeclSyncHistory({ limit }));
    } catch (error) {
      console.error('Không thể đọc lịch sử đồng bộ ECUS', error);
    }
  };
  const unsubscribe = subscribe(DECL_SYNC_HISTORY_KEY, emit);
  emit();
  return () => {
    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }
  };
}

export async function refreshDeclSyncHistory(options = {}) {
  await refreshSharedKeys([DECL_SYNC_HISTORY_KEY], options);
  return getDeclSyncHistory(options);
}


const DECL_SYNC_QUEUE_VERSION = 1;
const DECL_SYNC_INITIAL_RETRY_DELAY_MS = 15000;
const DECL_SYNC_MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

const declSyncQueueListeners = new Set();

function getBrowserStorageSafe() {
  if (typeof window === "undefined" || !window?.localStorage) {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readDeclSyncQueueStorage() {
  const storage = getBrowserStorageSafe();
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(DECL_SYNC_QUEUE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    console.warn("Không thể đọc hàng đợi đồng bộ ECUS từ localStorage", error);
    return null;
  }
}

function normalizeTaxCodeList(list) {
  const source = Array.isArray(list) ? list : [];
  const seen = new Set();
  const result = [];
  for (const item of source) {
    const text = typeof item === "string" ? item.trim() : "";
    if (!text) continue;
    const upper = text.toUpperCase();
    if (seen.has(upper)) continue;
    seen.add(upper);
    result.push(upper);
  }
  return result;
}

function normalizeDeclSyncPayload(payload) {
  const actor = typeof payload?.actor === "string" ? payload.actor.trim() : "";
  const from = typeof payload?.from === "string" ? payload.from.trim() : "";
  const to = typeof payload?.to === "string" ? payload.to.trim() : "";
  return {
    actor: actor || null,
    from: from || null,
    to: to || null,
    includeTaxCodes: normalizeTaxCodeList(payload?.includeTaxCodes),
    excludeTaxCodes: normalizeTaxCodeList(payload?.excludeTaxCodes),
  };
}

function normalizeDeclSyncQueueJob(job, { resetRunning = false, now = Date.now() } = {}) {
  const id =
    typeof job?.id === "string" && job.id.trim()
      ? job.id.trim()
      : `decl-sync-${now}-${Math.random().toString(36).slice(2, 8)}`;
  let status = typeof job?.status === "string" ? job.status.trim() : "pending";
  if (!["pending", "running", "completed"].includes(status)) {
    status = "pending";
  }
  let step = typeof job?.step === "string" && job.step.trim() ? job.step.trim() : "queued";
  const createdAt = Number.isFinite(job?.createdAt) ? job.createdAt : now;
  const updatedAt = Number.isFinite(job?.updatedAt) ? job.updatedAt : createdAt;
  let startedAt = Number.isFinite(job?.startedAt) ? job.startedAt : null;
  let completedAt = Number.isFinite(job?.completedAt) ? job.completedAt : null;
  const attempts = Number.isFinite(job?.attempts) ? Math.max(0, Math.floor(job.attempts)) : 0;
  let nextRetryAt = Number.isFinite(job?.nextRetryAt) ? job.nextRetryAt : null;
  let lastError = typeof job?.lastError === "string" ? job.lastError : null;
  const message = typeof job?.message === "string" ? job.message : "";
  const payload = normalizeDeclSyncPayload(job?.payload);
  const result = job?.result && typeof job.result === "object" ? { ...job.result } : null;

  if (resetRunning && status === "running") {
    status = "pending";
    step = "resume";
    nextRetryAt = now;
    startedAt = null;
  }
  if (status === "completed") {
    nextRetryAt = null;
    lastError = null;
    if (!completedAt) {
      completedAt = now;
    }
  } else {
    completedAt = null;
  }
  if (status !== "running") {
    startedAt = status === "completed" ? startedAt : null;
  } else if (!startedAt) {
    startedAt = now;
  }

  return {
    id,
    status,
    step,
    createdAt,
    updatedAt,
    startedAt,
    completedAt,
    attempts,
    nextRetryAt,
    lastError,
    message,
    payload,
    result,
  };
}

function normalizeDeclSyncQueueState(raw, { resetRunning = false } = {}) {
  const now = Date.now();
  const jobs = [];
  const source = raw && Array.isArray(raw.jobs) ? raw.jobs : [];
  for (const entry of source) {
    jobs.push(normalizeDeclSyncQueueJob(entry, { resetRunning, now }));
  }
  jobs.sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.id.localeCompare(b.id);
  });
  return {
    version: DECL_SYNC_QUEUE_VERSION,
    jobs,
  };
}

function cloneDeclSyncQueueJob(job) {
  if (!job) return null;
  return {
    ...job,
    payload: {
      actor: job.payload?.actor || null,
      from: job.payload?.from || null,
      to: job.payload?.to || null,
      includeTaxCodes: Array.isArray(job.payload?.includeTaxCodes) ? [...job.payload.includeTaxCodes] : [],
      excludeTaxCodes: Array.isArray(job.payload?.excludeTaxCodes) ? [...job.payload.excludeTaxCodes] : [],
    },
    result: job.result && typeof job.result === "object" ? { ...job.result } : null,
  };
}

function cloneDeclSyncQueueState(state) {
  return {
    version: state?.version ?? DECL_SYNC_QUEUE_VERSION,
    jobs: Array.isArray(state?.jobs) ? state.jobs.map((job) => cloneDeclSyncQueueJob(job)) : [],
  };
}

function notifyDeclSyncQueue() {
  const snapshot = cloneDeclSyncQueueState(declSyncQueueState);
  for (const listener of declSyncQueueListeners) {
    try {
      listener(snapshot);
    } catch (error) {
      console.error("Decl sync queue listener error", error);
    }
  }
  return snapshot;
}

function persistDeclSyncQueueState() {
  const storage = getBrowserStorageSafe();
  if (!storage) {
    return;
  }
  try {
    if (declSyncQueueState.jobs.length > 0) {
      storage.setItem(DECL_SYNC_QUEUE_KEY, JSON.stringify(declSyncQueueState));
    } else {
      storage.removeItem(DECL_SYNC_QUEUE_KEY);
    }
  } catch (error) {
    console.warn("Không thể lưu hàng đợi đồng bộ ECUS vào localStorage", error);
  }
}

let declSyncQueueState = normalizeDeclSyncQueueState(readDeclSyncQueueStorage(), { resetRunning: true });

persistDeclSyncQueueState();

function setQueueStateFromJobs(jobs, { resetRunning = false } = {}) {
  declSyncQueueState = normalizeDeclSyncQueueState({ jobs }, { resetRunning });
  persistDeclSyncQueueState();
  return notifyDeclSyncQueue();
}

function updateDeclSyncQueueJob(jobId, patch = {}) {
  if (!jobId) return null;
  const jobs = declSyncQueueState.jobs.map((job) => {
    if (job.id !== jobId) {
      return job;
    }
    const payloadPatch =
      patch && Object.prototype.hasOwnProperty.call(patch, "payload")
        ? (patch.payload && typeof patch.payload === "object" ? patch.payload : {})
        : null;
    const resultPatch =
      patch && Object.prototype.hasOwnProperty.call(patch, "result")
        ? (patch.result && typeof patch.result === "object" ? patch.result : patch.result)
        : undefined;
    const next = {
      ...job,
      ...patch,
      updatedAt: Date.now(),
    };
    if (payloadPatch !== null) {
      next.payload = { ...job.payload, ...payloadPatch };
    }
    if (resultPatch !== undefined) {
      next.result = resultPatch;
    }
    return next;
  });
  setQueueStateFromJobs(jobs, { resetRunning: false });
  const refreshed = declSyncQueueState.jobs.find((entry) => entry.id === jobId);
  return cloneDeclSyncQueueJob(refreshed);
}

function createDeclSyncQueueJob(payload) {
  const now = Date.now();
  return normalizeDeclSyncQueueJob(
    {
      id: `decl-sync-${now}-${Math.random().toString(36).slice(2, 8)}`,
      status: "pending",
      step: "queued",
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      attempts: 0,
      nextRetryAt: null,
      lastError: null,
      message: "Đang chờ xử lý",
      payload,
      result: null,
    },
    { resetRunning: false, now }
  );
}

function pickNextDeclSyncJob() {
  let candidate = null;
  for (const job of declSyncQueueState.jobs) {
    if (job.status !== "pending") continue;
    if (!candidate) {
      candidate = job;
      continue;
    }
    const candidateTime = Number.isFinite(candidate.nextRetryAt) ? candidate.nextRetryAt : candidate.createdAt;
    const jobTime = Number.isFinite(job.nextRetryAt) ? job.nextRetryAt : job.createdAt;
    if (jobTime < candidateTime) {
      candidate = job;
    }
  }
  return candidate;
}

function computeDeclSyncRetryDelay(attempts) {
  const safeAttempt = Math.max(1, attempts);
  const delay = DECL_SYNC_INITIAL_RETRY_DELAY_MS * 2 ** (safeAttempt - 1);
  return Math.min(DECL_SYNC_MAX_RETRY_DELAY_MS, delay);
}

function formatRetryTime(timestamp) {
  if (!Number.isFinite(timestamp)) {
    return "";
  }
  try {
    return new Date(timestamp).toLocaleString("vi-VN", { hour12: false });
  } catch {
    return "";
  }
}

function buildDeclSyncResultMessage(result) {
  if (!result || typeof result !== "object") {
    return "";
  }
  const imported = Number.isFinite(result.imported) ? result.imported : 0;
  const skipped = Number.isFinite(result.skipped) ? result.skipped : 0;
  const lockedRaw = result.reviewLocked ?? result.locked;
  const locked = Number.isFinite(lockedRaw) ? lockedRaw : 0;
  const parts = [];
  parts.push(`Đã đồng bộ ${imported.toLocaleString("vi-VN")} tờ khai mới từ ECUS`);
  if (skipped > 0) {
    parts.push(`bỏ qua ${skipped.toLocaleString("vi-VN")} tờ khai đã tồn tại`);
  }
  if (locked > 0) {
    parts.push(`khóa ${locked.toLocaleString("vi-VN")} tờ khai đã rà soát`);
  }
  return parts.join(", ");
}

function composeDeclSyncSuccessMessage(result, progress) {
  const parts = [];
  const resultMessage = buildDeclSyncResultMessage(result);
  if (resultMessage) {
    parts.push(`${resultMessage}.`);
  }
  if (progress && typeof progress.message === "string" && progress.message) {
    parts.push(progress.message);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

async function runDeclSyncJob(jobId) {
  const current = declSyncQueueState.jobs.find((job) => job.id === jobId);
  if (!current) {
    return;
  }
  const startedAt = current.startedAt || Date.now();
  const attemptNumber = (current.attempts || 0) + 1;
  updateDeclSyncQueueJob(jobId, {
    status: "running",
    step: "trigger",
    startedAt,
    attempts: attemptNumber,
    nextRetryAt: null,
    lastError: null,
    message: "Đang gửi yêu cầu đồng bộ tới backend...",
  });

  applyDeclSyncProgressPatch(
    {
      status: "running",
      step: "trigger",
      message: "Đang gửi yêu cầu đồng bộ ECUS...",
      startedAt,
      finishedAt: null,
      jobId,
      error: null,
    },
    declSyncProgressState.status === "idle"
  );

  try {
    const jobSnapshot = declSyncQueueState.jobs.find((job) => job.id === jobId);
    const payload = jobSnapshot?.payload || {};
    const body = {
      actor: payload.actor || undefined,
      from: payload.from || undefined,
      to: payload.to || undefined,
      includeTaxCodes:
        Array.isArray(payload.includeTaxCodes) && payload.includeTaxCodes.length
          ? payload.includeTaxCodes
          : undefined,
      excludeTaxCodes:
        Array.isArray(payload.excludeTaxCodes) && payload.excludeTaxCodes.length
          ? payload.excludeTaxCodes
          : undefined,
    };
    const response = await fetchWithAuth("/api/import/ecus/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (!response || typeof response.ok !== "boolean") {
      throw new Error("Không nhận được phản hồi hợp lệ từ backend");
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    let payloadResult = null;
    try {
      payloadResult = await response.json();
    } catch {
      payloadResult = null;
    }
    const rawResult = payloadResult?.result && typeof payloadResult.result === "object" ? payloadResult.result : {};
    const syncMeta = {
      runAt: typeof rawResult.runAt === "string" ? rawResult.runAt : null,
    };
    const normalizedResult = {
      imported: Number.isFinite(rawResult.imported) ? rawResult.imported : 0,
      skipped: Number.isFinite(rawResult.skipped) ? rawResult.skipped : 0,
      reviewLocked: Number.isFinite(rawResult.reviewLocked) ? rawResult.reviewLocked : 0,
    };

    updateDeclSyncQueueJob(jobId, {
      step: "refresh",
      message: "Đang cập nhật dữ liệu tờ khai vào bộ nhớ...",
      result: normalizedResult,
    });

    await refreshDeclRowsFromServer({ jobId, syncMeta });

    const progressSnapshot = getDeclSyncProgress();
    const successMessage = composeDeclSyncSuccessMessage(normalizedResult, progressSnapshot);

    updateDeclSyncQueueJob(jobId, {
      status: "completed",
      step: "completed",
      completedAt: Date.now(),
      lastError: null,
      nextRetryAt: null,
      message: successMessage || "Đồng bộ ECUS đã hoàn tất.",
    });
  } catch (error) {
    const message = error?.message || "Không thể đồng bộ ECUS";
    const attempts = declSyncQueueState.jobs.find((job) => job.id === jobId)?.attempts || 1;
    const delay = computeDeclSyncRetryDelay(attempts);
    const nextRetryAt = Date.now() + delay;
    const retryLabel = formatRetryTime(nextRetryAt);
    updateDeclSyncQueueJob(jobId, {
      status: "pending",
      step: "waiting-retry",
      nextRetryAt,
      lastError: message,
      message: retryLabel ? `${message}. Sẽ thử lại vào ${retryLabel}.` : message,
    });
    if (declSyncProgressState.jobId === jobId || declSyncProgressState.status === "running") {
      applyDeclSyncProgressPatch({
        status: "error",
        step: "error",
        message,
        error: message,
        finishedAt: Date.now(),
        jobId,
      });
    }
  }
}

let declSyncWorkerRunning = false;
let declSyncWorkerPromise = null;

function hasPendingDeclSyncJob() {
  return declSyncQueueState.jobs.some((job) => job.status === "pending");
}

function ensureDeclSyncWorkerRunning() {
  if (declSyncWorkerRunning) {
    return declSyncWorkerPromise;
  }
  if (!hasPendingDeclSyncJob()) {
    return null;
  }
  declSyncWorkerRunning = true;
  declSyncWorkerPromise = (async () => {
    while (true) {
      const job = pickNextDeclSyncJob();
      if (!job) {
        break;
      }
      const now = Date.now();
      if (Number.isFinite(job.nextRetryAt) && job.nextRetryAt > now) {
        const waitMs = Math.min(job.nextRetryAt - now, 15000);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      await runDeclSyncJob(job.id);
    }
  })()
    .catch((error) => {
      console.error("Decl sync worker error", error);
    })
    .finally(() => {
      declSyncWorkerRunning = false;
      declSyncWorkerPromise = null;
      if (hasPendingDeclSyncJob()) {
        ensureDeclSyncWorkerRunning();
      }
    });
  return declSyncWorkerPromise;
}

export function getDeclSyncQueue() {
  return cloneDeclSyncQueueState(declSyncQueueState);
}

export function subscribeDeclSyncQueue(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }
  declSyncQueueListeners.add(listener);
  return () => {
    declSyncQueueListeners.delete(listener);
  };
}

export function enqueueDeclSyncJob(payload = {}) {
  const job = createDeclSyncQueueJob(payload);
  const jobs = declSyncQueueState.jobs.concat(job);
  setQueueStateFromJobs(jobs, { resetRunning: false });
  const stored = declSyncQueueState.jobs.find((entry) => entry.id === job.id);
  ensureDeclSyncWorkerRunning();
  return cloneDeclSyncQueueJob(stored);
}

export function resumeDeclSyncQueue() {
  declSyncQueueState = normalizeDeclSyncQueueState(declSyncQueueState, { resetRunning: true });
  persistDeclSyncQueueState();
  notifyDeclSyncQueue();
  ensureDeclSyncWorkerRunning();
  return getDeclSyncQueue();
}

export function forceRunDeclSyncJob(jobId) {
  if (typeof jobId !== "string" || !jobId) {
    return null;
  }
  const existing = declSyncQueueState.jobs.find((entry) => entry.id === jobId);
  if (!existing) {
    return null;
  }
  updateDeclSyncQueueJob(jobId, {
    status: "pending",
    step: "queued",
    nextRetryAt: Date.now(),
    lastError: null,
    message: "Đang xếp lịch chạy lại...",
  });
  ensureDeclSyncWorkerRunning();
  const refreshed = declSyncQueueState.jobs.find((entry) => entry.id === jobId);
  return cloneDeclSyncQueueJob(refreshed);
}

if (declSyncQueueState.jobs.some((job) => job.status === "pending")) {
  ensureDeclSyncWorkerRunning();
}

export function sortDeclRows(rows) {

  const arr = Array.isArray(rows) ? rows : [];

  const parseTime = (value) => {

    if (!value) return 0;

    const ts = Date.parse(value);

    return Number.isFinite(ts) ? ts : 0;

  };



  return arr

    .map((row, idx) => ({ row, idx, ts: parseTime(row?.date) }))

    .sort((a, b) => {

      if (a.ts !== b.ts) return b.ts - a.ts; // má»›i nháº¥t trÆ°á»›c



      const soA = (a.row?.so_tk ?? "").toString();

      const soB = (b.row?.so_tk ?? "").toString();

      if (soA !== soB) {

        const cmp = soB.localeCompare(soA, undefined, { numeric: true, sensitivity: "base" });

        if (cmp !== 0) return cmp;

      }



      const nhanhA = (a.row?.nhanh ?? "").toString();

      const nhanhB = (b.row?.nhanh ?? "").toString();

      if (nhanhA !== nhanhB) {

        const cmpNhanh = nhanhB.localeCompare(nhanhA, undefined, { numeric: true, sensitivity: "base" });

        if (cmpNhanh !== 0) return cmpNhanh;

      }



      return b.idx - a.idx; // giá»¯ thá»© tá»± chÃ¨n gáº§n nháº¥t

    })

    .map(item => item.row);

}



export function getRecentDeclRows(limit = 20) {

  const sorted = sortDeclRows(getDeclRows());

  if (!Number.isFinite(limit) || limit <= 0) return sorted;

  return sorted.slice(0, limit);

}



// ===== Team roster (tá»• Ä‘á»™i) =====



const DEFAULT_ROSTER = Object.freeze({

  version: 1,

  teams: [

    {

      id: "team-1",

      name: "Team 1",

      members: [

        { id: "team-1-phuong", name: "PhÆ°Æ¡ng" },

        { id: "team-1-hanh", name: "Háº¡nh" },

        { id: "team-1-bao", name: "Báº£o" },

        { id: "team-1-ha-be", name: "HÃ  BÃ©" },

        { id: "team-1-huong", name: "HÆ°Æ¡ng" },

      ],

    },

    {

      id: "team-2",

      name: "Team 2",

      members: [

        { id: "team-2-tuan", name: "Tuáº¥n" },

        { id: "team-2-hoa", name: "HÃ²a" },

        { id: "team-2-thu", name: "Thu" },

        { id: "team-2-hang", name: "Háº±ng" },

        { id: "team-2-huyen", name: "Huyá»n" },

      ],

    },

    {

      id: "team-3",

      name: "Team 3",

      members: [

        { id: "team-3-hoc", name: "Há»c" },

        { id: "team-3-thanh", name: "Thanh" },

        { id: "team-3-huy", name: "Huy" },

        { id: "team-3-linh", name: "Linh" },

        { id: "team-3-thao", name: "Tháº£o" },

        { id: "team-3-hung", name: "HÆ°ng" },

      ],

    },

  ],

});



function deepCloneRoster(roster) {

  return {

    version: roster?.version ?? 1,

    teams: Array.isArray(roster?.teams)

      ? roster.teams.map((team) => ({

          id: team.id,

          name: team.name,

          members: Array.isArray(team.members)

            ? team.members.map((m) => ({ id: m.id, name: m.name, notes: m.notes ?? "" }))

            : [],

        }))

      : [],

  };

}



function slugify(value, fallback = "") {

  const base = stripDiacritics(value) || fallback;

  const slug = base

    .toLowerCase()

    .replace(/[^a-z0-9]+/g, "-")

    .replace(/^-+|-+$/g, "");

  return slug || fallback || "item";

}



function sanitizeMember(member, teamId, usedMemberIds, index) {

  const name = normalizeStr(member?.name);

  if (!name) return null;



  let candidateId = normalizeStr(member?.id);

  const memberFallback = `nv-${index + 1}`;

  if (!candidateId) {

    candidateId = `${teamId}-${slugify(name, memberFallback)}`;

  }

  candidateId = slugify(candidateId, `${teamId}-nv-${index + 1}`);



  let suffix = 1;

  let finalId = candidateId;

  while (usedMemberIds.has(finalId)) {

    finalId = `${candidateId}-${suffix++}`;

  }

  usedMemberIds.add(finalId);



  const notes = normalizeStr(member?.notes);



  return notes

    ? { id: finalId, name, notes }

    : { id: finalId, name };

}



function sanitizeTeam(team, fallbackName, usedTeamIds, index) {

  const name = normalizeStr(team?.name) || fallbackName || `Team ${index + 1}`;



  let candidateId = normalizeStr(team?.id);

  if (!candidateId) {

    candidateId = `team-${slugify(name, String(index + 1))}`;

  }

  candidateId = slugify(candidateId, `team-${index + 1}`);

  if (!candidateId.startsWith("team-")) {

    candidateId = `team-${candidateId}`;

  }



  let suffix = 1;

  let finalId = candidateId;

  while (usedTeamIds.has(finalId)) {

    finalId = `${candidateId}-${suffix++}`;

  }

  usedTeamIds.add(finalId);



  const rawMembers = Array.isArray(team?.members) ? team.members : [];

  const usedMemberIds = new Set();

  const members = rawMembers

    .map((m, idx) => sanitizeMember(m, finalId, usedMemberIds, idx))

    .filter(Boolean)

    .sort((a, b) => a.name.localeCompare(b.name, "vi", { sensitivity: "base" }));



  return { id: finalId, name, members };

}



function sanitizeRoster(data) {

  if (!data) {

    return deepCloneRoster(DEFAULT_ROSTER);

  }



  const teamsInput = Array.isArray(data.teams)

    ? data.teams

    : Array.isArray(data)

    ? data

    : [];



  if (!teamsInput.length) {

    return deepCloneRoster(DEFAULT_ROSTER);

  }



  const usedTeamIds = new Set();

  const teams = teamsInput

    .map((team, idx) => sanitizeTeam(team, team?.name, usedTeamIds, idx))

    .filter(Boolean);



  if (!teams.length) {

    return deepCloneRoster(DEFAULT_ROSTER);

  }



  return { version: 1, teams };

}



export function getTeamRoster() {

  const raw = safeParse(getItem(TEAM_KEY), null);

  const sanitized = sanitizeRoster(raw);

  if (!raw || !raw.teams) {

    setItem(TEAM_KEY, JSON.stringify(sanitized));

  }

  return sanitized;

}



export function subscribeTeamRoster(listener) {

  const fn = typeof listener === 'function' ? listener : null;

  if (!fn) {

    return () => {};

  }



  const emit = () => {

    try {

      fn(getTeamRoster());

    } catch (error) {

      console.error('Không thể cập nhật danh sách tổ đội', error);

    }

  };



  const unsubscribe = subscribe(TEAM_KEY, emit);

  emit();



  return () => {

    if (typeof unsubscribe === 'function') {

      unsubscribe();

    }

  };

}



export function setTeamRoster(next, { actor = "system", detail = "" } = {}) {

  const normalizedInput = Array.isArray(next?.teams) || Array.isArray(next)

    ? next

    : deepCloneRoster(DEFAULT_ROSTER);



  const sanitized = sanitizeRoster(

    Array.isArray(normalizedInput)

      ? { version: 1, teams: normalizedInput }

      : normalizedInput

  );

  setItem(TEAM_KEY, JSON.stringify(sanitized));

  pushAuditLog({

    actor,

    action: "team.save",

    detail: detail || `Cáº­p nháº­t ${sanitized.teams.length} tá»• Ä‘á»™i`,

  });

  return sanitized;

}



export function mapMemberNamesToTeams(source) {

  const roster = sanitizeRoster(

    Array.isArray(source?.teams) || Array.isArray(source)

      ? source

      : deepCloneRoster(DEFAULT_ROSTER)

  );



  const map = new Map();

  for (const team of roster.teams) {

    const teamName = normalizeStr(team?.name);

    if (!teamName) continue;

    for (const member of team.members || []) {

      const memberName = normalizeStr(member?.name);

      const key = normalizeName(memberName);

      if (!key) continue;

      if (!map.has(key)) {

        map.set(key, {

          team: teamName,

          name: memberName,

        });

      }

    }

  }

  return map;

}



export function applyTeamRosterToMST(rosterLike, rows, options = {}) {

  const sanitizedRoster = sanitizeRoster(

    Array.isArray(rosterLike?.teams) || Array.isArray(rosterLike)

      ? rosterLike

      : deepCloneRoster(DEFAULT_ROSTER)

  );

  const memberMap = mapMemberNamesToTeams(sanitizedRoster);



  const previousRoster = options?.previousRoster

    ? sanitizeRoster(options.previousRoster)

    : null;



  if (previousRoster) {

    const prevById = new Map();

    for (const team of previousRoster.teams) {

      const prevTeamName = normalizeStr(team?.name);

      for (const member of team.members || []) {

        prevById.set(member.id, {

          name: normalizeStr(member?.name),

          team: prevTeamName,

        });

      }

    }



    for (const team of sanitizedRoster.teams) {

      const teamName = normalizeStr(team?.name);

      for (const member of team.members || []) {

        const info = {

          team: teamName,

          name: normalizeStr(member?.name),

        };

        const prev = prevById.get(member.id);

        if (prev) {

          const prevKey = normalizeName(prev.name);

          if (prevKey) {

            memberMap.set(prevKey, info);

          }

        }

      }

    }

  }



  const sanitizedRows = Array.isArray(rows)

    ? rows.map(sanitizeMSTRow).filter(Boolean)

    : [];



  let changed = false;

  const updated = sanitizedRows.map((row) => {

    const importKey = normalizeName(row.person_import);

    const exportKey = normalizeName(row.person_export);

    const importInfo = importKey ? memberMap.get(importKey) : null;

    const exportInfo = exportKey ? memberMap.get(exportKey) : null;

    const preferredInfo = importInfo || exportInfo;



    let next = row;

    const applyChanges = (updates) => {

      if (next === row) {

        next = { ...row };

      }

      Object.assign(next, updates);

      changed = true;

    };



    if (importInfo?.name && importInfo.name !== row.person_import) {

      applyChanges({ person_import: importInfo.name });

    }

    if (exportInfo?.name && exportInfo.name !== row.person_export) {

      applyChanges({ person_export: exportInfo.name });

    }



    const targetTeam = preferredInfo?.team;

    if (targetTeam && normalizeName(row.team) !== normalizeName(targetTeam)) {

      applyChanges({ team: targetTeam });

    }



    return next;

  });



  return { rows: updated, changed };

}



// ===== Đại lý Hải quan (MST -> tên công ty & đại lý) =====



const AGENCY_SPLIT_REGEX = /[\s,;|\n]+/;



export function getHQAgenciesRaw() {

  return safeParse(getItem(HQ_KEY), []);

}



export function parseAgencyList(value) {

  if (Array.isArray(value)) {

    return Array.from(

      new Set(

        value

          .map((item) => normalizeStr(item))

          .filter(Boolean)

      )

    );

  }

  const str = normalizeStr(value);

  if (!str) return [];

  return Array.from(

    new Set(

      str

        .split(AGENCY_SPLIT_REGEX)

        .map((item) => normalizeStr(item))

        .filter(Boolean)

    )

  );

}



export function formatAgencyList(list) {

  if (!Array.isArray(list) || !list.length) return "";

  return list.join(", " );

}



function sanitizeAgencyRow(row) {

  const mst = normalizeMST(row?.mst);

  if (!mst) return null;

  const company = normalizeStr(row?.company ?? row?.cong_ty ?? row?.customer ?? "");

  const agents = parseAgencyList(row?.agents ?? row?.agent ?? row?.agency ?? row?.dai_ly ?? row?.dai_ly_hq ?? row?.['Đại lý HQ'] ?? row?.['Dai ly HQ']);

  const agent = formatAgencyList(agents);

  return { mst, company, agent, agents };

}



export function getHQAgencies() {

  const raw = getHQAgenciesRaw();

  const rows = Array.isArray(raw) ? raw : [];

  const sanitized = rows.map(sanitizeAgencyRow).filter(Boolean);

  sanitized.sort((a, b) => {

    const cmpCompany = a.company.localeCompare(b.company, 'vi', { sensitivity: 'base' });

    if (cmpCompany !== 0) return cmpCompany;

    return a.mst.localeCompare(b.mst);

  });

  return sanitized;

}



export function mapHQAgenciesByMST() {

  const map = new Map();

  for (const row of getHQAgencies()) {

    if (!row) continue;

    map.set(row.mst, row);

  }

  return map;

}



function mergeAgencyEntries(target = [], incoming = []) {

  const merged = new Set();

  for (const value of Array.isArray(target) ? target : []) {

    const normalized = normalizeStr(value);

    if (normalized) merged.add(normalized);

  }

  for (const value of Array.isArray(incoming) ? incoming : []) {

    const normalized = normalizeStr(value);

    if (normalized) merged.add(normalized);

  }

  return Array.from(merged);

}



function formatAgencyHistoryValue(list) {

  return formatAgencyList(Array.isArray(list) ? list : parseAgencyList(list));

}



export function upsertHQAgencies(rows, { actor = "system", detail = "" } = {}) {

  const previousRows = getHQAgencies();

  const sanitized = Array.isArray(rows) ? rows.map(sanitizeAgencyRow).filter(Boolean) : [];

  const dedup = new Map();

  for (const row of sanitized) {

    const prev = dedup.get(row.mst) || {};

    dedup.set(row.mst, {

      mst: row.mst,

      company: row.company || prev.company || "",

      agents: mergeAgencyEntries(prev.agents, row.agents),

    });

  }

  const finalRows = Array.from(dedup.values()).map((row) => ({

    mst: row.mst,

    company: row.company || "",

    agents: mergeAgencyEntries([], row.agents),

    agent: formatAgencyList(row.agents),

  }));

  finalRows.sort((a, b) => {

    const cmpCompany = a.company.localeCompare(b.company, 'vi', { sensitivity: 'base' });

    if (cmpCompany !== 0) return cmpCompany;

    return a.mst.localeCompare(b.mst);

  });

  setItem(HQ_KEY, JSON.stringify(finalRows));



  const historyEntries = diffHQAgencyRows(previousRows, finalRows, actor);

  if (historyEntries.length) {

    appendHQHistoryEntries(historyEntries);

  }



  pushAuditLog({

    actor,

    action: "hq.save",

    detail: detail || `Cập nhật ${finalRows.length} cấu hình đại lý HQ`,

  });



  const finalByMst = new Map(finalRows.map((row) => [row.mst, row]));

  const mstRows = getMSTMap();

  let mstChanged = false;

  const syncedMst = mstRows.map((row) => {

    const info = finalByMst.get(row.mst);

    if (!info || !info.company) return row;

    if (normalizeStr(row.company) === info.company) return row;

    mstChanged = true;

    return { ...row, company: info.company };

  });

  if (mstChanged) {

    upsertMSTRows(syncedMst, { actor, detail: 'Đồng bộ tên công ty theo Đại lý HQ' });

  }



  const existingDecls = getDeclRows();

  const reannotatedDecls = applyAgenciesToDeclRows(existingDecls, finalByMst);

  const declChanged = reannotatedDecls.some((row, idx) => row !== existingDecls[idx]);

  if (declChanged) {

    saveDeclRows(reannotatedDecls, {

      overwrite: true,

      actor,

      detail: 'Đồng bộ Đại lý HQ với dữ liệu tờ khai hiện có',

    });

  }



  return finalRows.length;

}



export function saveHQAgencyRow(row, { actor = "system", previousMst = "", detail = "" } = {}) {

  const sanitized = sanitizeAgencyRow(row);

  if (!sanitized) {

    throw new Error("Mã số thuế không hợp lệ khi lưu đại lý HQ");

  }



  const targetMst = sanitized.mst;

  const prevKey = normalizeMST(previousMst);

  const current = getHQAgencies();

  const preserved = [];



  for (const item of current) {

    if (!item?.mst) continue;

    if (item.mst === targetMst) continue;

    if (prevKey && item.mst === prevKey) continue;

    preserved.push(item);

  }



  preserved.push({

    mst: sanitized.mst,

    company: sanitized.company,

    agents: sanitized.agents,

    agent: sanitized.agent,

  });



  upsertHQAgencies(preserved, {

    actor,

    detail: detail || `Cập nhật đại lý HQ cho MST ${targetMst}`,

  });



  return sanitized;

}



export function deleteHQAgencyRow(mst, { actor = "system", detail = "" } = {}) {

  const target = normalizeMST(mst);

  if (!target) {

    return 0;

  }



  const current = getHQAgencies();

  const next = current.filter((row) => row?.mst !== target);

  if (next.length === current.length) {

    return 0;

  }



  upsertHQAgencies(next, {

    actor,

    detail: detail || `Xóa đại lý HQ cho MST ${target}`,

  });



  return 1;

}





export function applyAgenciesToDeclRows(rows, agencyMapParam = null) {

  const list = Array.isArray(rows) ? rows : [];

  const agencyMap = agencyMapParam instanceof Map ? agencyMapParam : mapHQAgenciesByMST();

  if (!agencyMap || agencyMap.size === 0) return list;



  return list.map((row) => {

    const mst = normalizeMST(row?.mst);

    if (!mst) return row;



    const info = agencyMap.get(mst);

    if (!info) return row;



    const desiredCompany = normalizeStr(info?.company ?? '');

    const desiredAgents = Array.isArray(info?.agents)

      ? info.agents.map((value) => normalizeStr(value)).filter(Boolean)

      : parseAgencyList(info?.agent);

    const desiredAgent = desiredAgents.length > 0 ? formatAgencyList(desiredAgents) : '';



    let next = row;

    const ensureClone = () => {

      if (next === row) {

        next = { ...row };

      }

    };



    if (desiredCompany) {

      const currentCompany = normalizeStr(row?.cong_ty ?? row?.customer ?? '');

      if (currentCompany !== desiredCompany) {

        ensureClone();

        next.cong_ty = desiredCompany;

        next.customer = desiredCompany;

      }

    }



    if (desiredAgent) {

      const currentAgent = normalizeStr(

        row?.agency ??

          row?.dai_ly ??

          row?.dai_ly_hq ??

          row?.['Đại lý HQ'] ??

          row?.['Dai ly HQ'] ??

          ''

      );

      if (currentAgent !== desiredAgent) {

        ensureClone();

        next.agency = desiredAgent;

        next.dai_ly = desiredAgent;

        next.dai_ly_hq = desiredAgent;

        next['Đại lý HQ'] = desiredAgent;

        next['Dai ly HQ'] = desiredAgent;

      }

    }



    if (desiredAgents.length > 0) {

      ensureClone();

      next.agents = desiredAgents;

    }



    return next;

  });

}



const COMPANY_FIELD_KEYS = new Set([

  'company',

  'cong ty',

  'ten cong ty',

  'ten doanh nghiep',

  'doanh nghiep',

  'customer',

]);



function extractCompanyNameFromDeclRow(row) {

  if (!row || typeof row !== 'object') return '';

  const direct = normalizeStr(row?.company ?? row?.cong_ty ?? row?.customer ?? '');

  if (direct) return direct;



  for (const [key, value] of Object.entries(row)) {

    if (value === null || value === undefined || value === '') continue;

    const normalizedKey = normalizeName(key);

    if (!COMPANY_FIELD_KEYS.has(normalizedKey)) continue;

    const strValue = normalizeStr(value);

    if (strValue) return strValue;

  }



  return '';

}



const MST_FIELD_KEYS = new Set(['mst', 'ma so thue', 'ma so thue (mst)', 'tax code']);



function extractMSTFromDeclRow(row) {

  if (!row || typeof row !== 'object') return '';

  const direct = normalizeMST(row?.mst);

  if (direct) return direct;



  for (const [key, value] of Object.entries(row)) {

    if (value === null || value === undefined || value === '') continue;

    const normalizedKey = normalizeName(key);

    if (!MST_FIELD_KEYS.has(normalizedKey)) continue;

    const candidate = normalizeMST(value);

    if (candidate) return candidate;

  }



  return '';

}



const DATE_FIELD_KEYS = new Set([

  'date',

  'ngay',

  'ngay dk',

  'ngay dang ky',

  'ngay dang ky tk',

  'registration date',

]);



function extractEffectiveDateFromDeclRow(row) {

  if (!row || typeof row !== 'object') return '';

  const candidates = [

    row?.date,

    row?.raw_date,

    row?.ngay,

    row?.ngay_dk,

    row?.['Ngày đăng ký'],

    row?.['Ngay dang ky'],

    row?.['Ngay DK'],

    row?.['Ngay dk'],

  ];



  for (const candidate of candidates) {

    const iso = toISODate(candidate);

    if (iso) return iso;

  }



  for (const [key, value] of Object.entries(row)) {

    if (value === null || value === undefined || value === '') continue;

    const normalizedKey = normalizeName(key);

    if (!DATE_FIELD_KEYS.has(normalizedKey)) continue;

    const iso = toISODate(value);

    if (iso) return iso;

  }



  return '';

}



function ensureMSTEntriesForDeclRows(declRows, { actor = 'system', dryRun = false } = {}) {

  const list = Array.isArray(declRows) ? declRows : [];

  if (!list.length) {

    return { additions: [], total: 0 };

  }



  const actorName = normalizeStr(actor) || 'system';

  const existingRows = getMSTMap();

  const knownMSTs = new Set(existingRows.map((row) => row.mst));

  const additions = [];

  const seen = new Set();



  for (const row of list) {

    if (!row || typeof row !== 'object') continue;

    const declKey = getDeclarationKey(row);

    if (!declKey) continue;

    const mst = extractMSTFromDeclRow(row);

    if (!mst || knownMSTs.has(mst) || seen.has(mst)) continue;



    const company = extractCompanyNameFromDeclRow(row);

    const effective_from = extractEffectiveDateFromDeclRow(row);



    additions.push({

      mst,

      company,

      person_import: '',

      person_export: '',

      team: '',

      effective_from,

      effective_to: '',

      status: MST_ASSIGNMENT_STATUS.PENDING,

    });

    seen.add(mst);

  }



  if (!additions.length) {

    return { additions: [], total: 0 };

  }



  const loggedAdditions = additions.map((item) => ({

    mst: item.mst,

    company: item.company,

    effective_from: item.effective_from,

  }));



  if (dryRun) {

    return { additions: loggedAdditions, total: additions.length };

  }



  const merged = existingRows.concat(additions);

  const sample = additions.slice(0, 3).map((item) => item.mst).join(', ');

  const suffix = additions.length > 3 ? '…' : '';

  const detailSample = sample ? ` (${sample}${suffix})` : '';



  upsertMSTRows(merged, {

    actor: actorName,

    detail: `Tự động thêm ${additions.length} MST mới từ dữ liệu tờ khai${detailSample}`,

  });



  return { additions: loggedAdditions, total: additions.length };

}



function persistAndAnnotateDeclRows(rows) {

  const normalized = writeDeclRows(rows);

  const annotated = applyAgenciesToDeclRows(normalized);

  const changed =

    annotated.length !== normalized.length ||

    annotated.some((row, idx) => row !== normalized[idx]);



  if (changed) {

    setItem(DECL_KEY, JSON.stringify(annotated));

    return annotated;

  }



  return normalized;

}



function sanitizePartialDeclUpdates(updates = {}) {

  if (!updates || typeof updates !== "object") {

    return {};

  }

  const safe = {};

  const assign = (key, value) => {

    safe[key] = value;

  };



  for (const [field, value] of Object.entries(updates)) {

    switch (field) {

      case "nhan_vien": {

        assign("nhan_vien", normalizeStr(value));

        break;

      }

      case "team": {

        assign("team", normalizeStr(value));

        break;

      }

      case "agency": {

        assign("agency", normalizeStr(value));

        break;

      }

      case "dai_ly": {

        assign("dai_ly", normalizeStr(value));

        break;

      }

      case "licenses":
      case "so_luong_gp":
      case "licenseManualCount": {
        if (value === "" || value === null || value === undefined) {
          assign("licenses", "");
          assign("so_luong_gp", "");
          assign("licenseManualCount", null);
          break;
        }

        const parsed = Number(value);

        if (Number.isFinite(parsed)) {
          const normalized = Math.max(0, Math.round(parsed));
          assign("licenses", normalized);
          assign("so_luong_gp", normalized);
          assign("licenseManualCount", normalized);
        }

        break;
      }

      default: {

        assign(field, value);

        break;

      }

    }

  }



  if (

    Object.prototype.hasOwnProperty.call(safe, "agency") &&

    !Object.prototype.hasOwnProperty.call(safe, "dai_ly")

  ) {

    assign("dai_ly", safe.agency);

  }

  if (

    Object.prototype.hasOwnProperty.call(safe, "dai_ly") &&

    !Object.prototype.hasOwnProperty.call(safe, "agency")

  ) {

    assign("agency", safe.dai_ly);

  }



  return safe;

}



function applyPartialUpdatesToRow(row, updates, { sanitized = false } = {}) {

  if (!row || typeof row !== "object") {

    return { changed: false, nextRow: row };

  }

  const safeUpdates = sanitized && updates && typeof updates === "object"

    ? updates

    : sanitizePartialDeclUpdates(updates);

  const entries = Object.entries(safeUpdates);

  if (!entries.length) {

    return { changed: false, nextRow: row };

  }

  let changed = false;

  const nextRow = { ...row };

  for (const [field, value] of entries) {

    const current = nextRow[field];

    if (value === null) {

      if (Object.prototype.hasOwnProperty.call(nextRow, field)) {

        delete nextRow[field];

        changed = true;

      }

      continue;

    }

    if (value === undefined) {

      continue;

    }

    if (field === "licenses" || field === "so_luong_gp") {

      const normalized = value === "" ? "" : Number(value);

      if (nextRow[field] !== normalized) {

        nextRow[field] = normalized;

        changed = true;

      }

      continue;

    }

    if (nextRow[field] !== value) {

      nextRow[field] = value;

      changed = true;

    }

  }

  if (changed) {

    nextRow.updatedAt = new Date().toISOString();

  }

  return { changed, nextRow };

}



/**

 * Lưu tờ khai vào kho dùng chung.

 * - overwrite=true: ghi đè toàn bộ danh sách hiện tại.

 * - overwrite=false: hợp nhất theo khoá "so_tk + '_' + (nhanh || '')".

 */

function isEqualDeclValue(a, b) {

  if (a === b) return true;

  if (Array.isArray(a) && Array.isArray(b)) {

    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i += 1) {

      if (!isEqualDeclValue(a[i], b[i])) {

        return false;

      }

    }

    return true;

  }

  if (a && b && typeof a === "object" && typeof b === "object") {

    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

    for (const key of keys) {

      if (!isEqualDeclValue(a[key], b[key])) {

        return false;

      }

    }

    return true;

  }

  if (a === null || a === undefined) {

    return b === null || b === undefined;

  }

  if (b === null || b === undefined) {

    return false;

  }

  return Object.is(a, b);

}



function mergeDeclRowWithSummary(existing, incoming) {

  if (!existing) {

    return {

      row: incoming,

      changed: true,

      changedFields: Object.keys(incoming || {}),

      locked: false,

    };

  }

  if (existing?.reviewed && incoming?.__forceReviewedOverride !== true) {

    return { row: existing, changed: false, changedFields: [], locked: true };

  }

  const merged = mergeDeclarationRowClient(existing, incoming);

  const keys = new Set([...Object.keys(existing || {}), ...Object.keys(merged || {})]);

  const changedFields = [];

  for (const field of keys) {

    if (!isEqualDeclValue(existing?.[field], merged?.[field])) {

      changedFields.push(field);

    }

  }

  return { row: merged, changed: changedFields.length > 0, changedFields, locked: false };

}



function buildImportLogEntry(row, changedFields = []) {

  if (!row || typeof row !== "object") return null;

  const so_tk = normalizeDeclarationNumber(row.so_tk ?? row.so_tk_full ?? "");

  if (!so_tk) return null;

  const full = (row.so_tk_full ?? row.so_tk ?? "").toString();

  const nhanh = normalizeStr(row.nhanh ?? row.branch ?? "");

  const entry = {

    so_tk,

    so_tk_full: full || undefined,

    nhanh: nhanh || undefined,

  };

  if (Array.isArray(changedFields) && changedFields.length) {

    const unique = Array.from(

      new Set(

        changedFields

          .map((field) => (field == null ? "" : String(field).trim()))

          .filter(Boolean)

      )

    );

    if (unique.length) {

      entry.fields = unique;

    }

  }

  return entry;

}



function normalizeImportErrorRow(row, reason = "unknown") {

  if (!row || typeof row !== "object") {

    return { reason };

  }

  const so_tk = normalizeDeclarationNumber(row.so_tk ?? row.so_tk_full ?? "");

  const nhanh = normalizeStr(row.nhanh ?? row.branch ?? "");

  const mst = extractMSTFromDeclRow(row) || "";

  const company = extractCompanyNameFromDeclRow(row) || "";

  return {

    reason,

    so_tk,

    nhanh,

    mst: mst || undefined,

    company: company || undefined,

  };

}



function computeDeclImportDiff(currentRows, normalizedIncoming, { sampleLimit = 20 } = {}) {

  const fallbackRows = [];

  const currentMap = new Map();

  for (const row of Array.isArray(currentRows) ? currentRows : []) {

    if (!row || typeof row !== "object") continue;

    const key = getDeclarationKey(row);

    if (!key) {

      fallbackRows.push(row);

      continue;

    }

    if (!currentMap.has(key)) {

      currentMap.set(key, row);

    }

  }



  let inserted = 0;

  let updated = 0;

  let skipped = 0;

  let locked = 0;

  const insertedDeclarations = [];

  const updatedDeclarations = [];

  const lockedDeclarations = [];

  const errorEntries = [];



  const insertedRows = [];

  const updatedRows = [];

  const lockedRows = [];



  for (const row of normalizedIncoming) {

    const key = getDeclarationKey(row);

    if (!key) {

      errorEntries.push(normalizeImportErrorRow(row, "missing-key"));

      continue;

    }

    const existing = currentMap.get(key);

    if (!existing) {

      currentMap.set(key, row);

      inserted += 1;

      insertedRows.push(row);

      const entry = buildImportLogEntry(row);

      if (entry) {

        insertedDeclarations.push(entry);

      }

      continue;

    }



    const { row: mergedRow, changed, changedFields, locked: isLocked } = mergeDeclRowWithSummary(existing, row);

    if (isLocked) {

      locked += 1;

      lockedRows.push(existing);

      const entry = buildImportLogEntry(existing);

      if (entry) {

        lockedDeclarations.push(entry);

      }

      continue;

    }



    currentMap.set(key, mergedRow);

    if (changed) {

      updated += 1;

      updatedRows.push({ before: existing, after: mergedRow, changedFields });

      const entry = buildImportLogEntry(mergedRow, changedFields);

      if (entry) {

        updatedDeclarations.push(entry);

      }

    } else {

      skipped += 1;

    }

  }



  const mergedRows = fallbackRows.concat(Array.from(currentMap.values()));



  return {

    mergedRows,

    summary: {

      inserted,

      updated,

      skipped,

      locked,

      invalid: errorEntries.length,

      insertedDeclarations,

      updatedDeclarations,

      lockedDeclarations,

      errors: errorEntries,

    },

    samples: {

      inserted: insertedRows.slice(0, sampleLimit),

      updated: updatedRows.slice(0, sampleLimit),

      locked: lockedRows.slice(0, sampleLimit),

      errors: errorEntries.slice(0, sampleLimit),

    },

  };

}



export function previewDeclRows(newRows, { overwrite = false, actor = "system" } = {}) {

  const incoming = Array.isArray(newRows) ? newRows : [];

  const normalizedIncoming = normalizeDeclRows(incoming);

  const actorName = normalizeStr(actor) || "system";

  const currentRows = getDeclRowsRaw();



  if (overwrite) {

    const validRows = normalizedIncoming.filter((row) => !!getDeclarationKey(row));

    const invalidRows = normalizedIncoming.filter((row) => !getDeclarationKey(row));

    const mstSummary = ensureMSTEntriesForDeclRows(normalizedIncoming, { actor: actorName, dryRun: true }) || {

      additions: [],

      total: 0,

    };



    return {

      mode: "overwrite",

      totalBefore: currentRows.length,

      totalAfter: validRows.length,

      totalStored: validRows.length,

      totalIncoming: normalizedIncoming.length,

      inserted: validRows.length,

      updated: 0,

      skipped: 0,

      locked: 0,

      invalid: invalidRows.length,

      errors: invalidRows.map((row) => normalizeImportErrorRow(row, "missing-key")),

      insertedDeclarations: validRows.map((row) => buildImportLogEntry(row)).filter(Boolean),

      updatedDeclarations: [],

      lockedDeclarations: [],

      samples: {

        inserted: validRows.slice(0, 20),

        updated: [],

        locked: [],

        errors: invalidRows.slice(0, 20).map((row) => normalizeImportErrorRow(row, "missing-key")),

      },

      newBusinessCount: mstSummary.total || 0,

      newBusinesses: mstSummary.additions || [],

    };

  }



  const { mergedRows, summary, samples } = computeDeclImportDiff(currentRows, normalizedIncoming, { sampleLimit: 20 });

  const mstSummary = ensureMSTEntriesForDeclRows(normalizedIncoming, { actor: actorName, dryRun: true }) || {

    additions: [],

    total: 0,

  };



  return {

    mode: "merge",

    totalBefore: currentRows.length,

    totalAfter: mergedRows.length,

    totalStored: mergedRows.length,

    totalIncoming: normalizedIncoming.length,

    ...summary,

    samples,

    newBusinessCount: mstSummary.total || 0,

    newBusinesses: mstSummary.additions || [],

  };

}



export function saveDeclRows(
  newRows,
  { overwrite = false, actor = "system", detail = "", allowReviewedOverride = false } = {}
) {

  const incoming = Array.isArray(newRows) ? newRows : [];

  const normalizedIncomingBase = normalizeDeclRows(incoming);
  const normalizedIncoming = allowReviewedOverride
    ? normalizedIncomingBase.map((row) => ({ ...row, __forceReviewedOverride: true }))
    : normalizedIncomingBase;

  const actorName = normalizeStr(actor) || "system";

  const currentRows = getDeclRowsRaw();



  if (overwrite) {

    const stored = persistAndAnnotateDeclRows(normalizedIncoming);

    pushAuditLog({

      actor: actorName,

      action: "decl.overwrite",

      detail: detail || `Ghi đè ${stored.length} tờ khai`,

    });

    const mstSummary = ensureMSTEntriesForDeclRows(normalizedIncoming, { actor: actorName }) || {

      additions: [],

      total: 0,

    };

    return {

      mode: "overwrite",

      totalBefore: currentRows.length,

      totalAfter: stored.length,

      totalStored: stored.length,

      totalIncoming: normalizedIncoming.length,

      inserted: stored.length,

      updated: 0,

      skipped: 0,

      locked: 0,

      invalid: 0,

      insertedDeclarations: normalizedIncoming.map((row) => buildImportLogEntry(row)).filter(Boolean),

      updatedDeclarations: [],

      lockedDeclarations: [],

      errors: [],

      newBusinessCount: mstSummary.total || 0,

      newBusinesses: mstSummary.additions || [],

    };

  }



  const { mergedRows, summary } = computeDeclImportDiff(currentRows, normalizedIncoming, { sampleLimit: 0 });

  const stored = persistAndAnnotateDeclRows(mergedRows);



  const mstSummary = ensureMSTEntriesForDeclRows(normalizedIncoming, { actor: actorName }) || {

    additions: [],

    total: 0,

  };



  const skipLabel = summary.locked > 0

    ? `${summary.skipped.toLocaleString("vi-VN")} bỏ qua (khóa ${summary.locked.toLocaleString("vi-VN")})`

    : `${summary.skipped.toLocaleString("vi-VN")} bỏ qua`;

  const auditDetail = detail && detail.trim()

    ? detail

    : `Hợp nhất ${normalizedIncoming.length.toLocaleString("vi-VN")} tờ khai (+${summary.inserted.toLocaleString("vi-VN")} / cập nhật ${summary.updated.toLocaleString("vi-VN")} / ${skipLabel} -> tổng ${stored.length.toLocaleString("vi-VN")})`;



  pushAuditLog({

    actor: actorName,

    action: "decl.merge",

    detail: auditDetail,

  });



  return {

    mode: "merge",

    totalBefore: currentRows.length,

    totalAfter: stored.length,

    totalStored: stored.length,

    totalIncoming: normalizedIncoming.length,

    inserted: summary.inserted,

    updated: summary.updated,

    skipped: summary.skipped,

    locked: summary.locked,

    invalid: summary.invalid,

    insertedDeclarations: summary.insertedDeclarations,

    updatedDeclarations: summary.updatedDeclarations,

    lockedDeclarations: summary.lockedDeclarations,

    errors: summary.errors,

    newBusinessCount: mstSummary.total || 0,

    newBusinesses: mstSummary.additions || [],

  };

}



export async function saveDeclRowDiffs(
  deltas,
  { actor = "system", detail = "", allowReviewedOverride = false } = {}
) {
  const list = Array.isArray(deltas) ? deltas : [];
  const total = list.length;

  const rows = getDeclRowsRaw();
  const totalStored = Array.isArray(rows) ? rows.length : 0;

  if (!total || !Array.isArray(rows) || rows.length === 0) {
    return {
      success: false,
      total,
      updated: 0,
      locked: 0,
      missing: total,
      noChange: 0,
      invalid: 0,
      totalStored,
      lockedKeys: [],
      missingKeys: list.map((item) => (item && typeof item.key === "string" ? item.key : "")),
      noChangeKeys: [],
      invalidKeys: [],
    };
  }

  const actorName = normalizeStr(actor) || "system";
  const indexByKey = new Map();
  rows.forEach((row, idx) => {
    const key = getDeclRowSimpleKey(row);
    if (key) {
      indexByKey.set(key, idx);
    }
  });

  const lockedKeys = [];
  const missingKeys = [];
  const noChangeKeys = [];
  const invalidKeys = [];
  const changeRecords = [];

  for (const entry of list) {
    const key = typeof entry?.key === "string" ? entry.key.trim() : String(entry?.key || "").trim();
    if (!key) {
      invalidKeys.push("");
      continue;
    }
    const updates = entry && typeof entry === "object" ? entry.updates : null;
    const sanitizedUpdates = sanitizePartialDeclUpdates(updates);
    const changedFields = Object.keys(sanitizedUpdates);
    if (changedFields.length === 0) {
      noChangeKeys.push(key);
      continue;
    }
    const index = indexByKey.has(key) ? indexByKey.get(key) : -1;
    if (typeof index !== "number" || index < 0) {
      missingKeys.push(key);
      continue;
    }
    const current = rows[index] || {};
    if (current?.reviewed && !allowReviewedOverride) {
      lockedKeys.push(key);
      const actionDetail = detail && detail.trim().length > 0
        ? detail
        : `Chặn cập nhật tờ khai ${current.so_tk || "?"} do đã rà soát`;
      pushAuditLog({
        actor: actorName,
        action: "decl.update.blocked",
        detail: actionDetail,
        meta: { key, fields: changedFields, reason: "review lock" },
      });
      continue;
    }
    const { changed, nextRow } = applyPartialUpdatesToRow(current, sanitizedUpdates, {
      sanitized: true,
    });
    if (!changed) {
      noChangeKeys.push(key);
      continue;
    }
    changeRecords.push({
      key,
      index,
      updates: sanitizedUpdates,
      changedFields,
      previous: current,
      nextRow,
    });
  }

  if (!changeRecords.length) {
    return {
      success: false,
      total,
      updated: 0,
      locked: lockedKeys.length,
      missing: missingKeys.length,
      noChange: noChangeKeys.length,
      invalid: invalidKeys.length,
      totalStored,
      lockedKeys,
      missingKeys,
      noChangeKeys,
      invalidKeys,
    };
  }

  const nextRows = rows.slice();
  for (const record of changeRecords) {
    nextRows[record.index] = record.nextRow;
  }

  const annotatedRows = applyAgenciesToDeclRows(nextRows);

  const patchPayload = [];
  const historyQueue = [];

  for (const record of changeRecords) {
    const finalRow = annotatedRows[record.index] || record.nextRow;
    patchPayload.push({ key: record.key, updates: record.updates, row: finalRow });
    const historyChanges = buildDeclHistoryChanges(record.previous, finalRow, record.changedFields);
    if (historyChanges.length) {
      historyQueue.push({ key: record.key, changes: historyChanges });
    }
  }

  const summaryDetail = detail && detail.trim().length > 0
    ? detail.trim()
    : `Cập nhật ${changeRecords.length.toLocaleString("vi-VN")} tờ khai (patch)`;

  await patchDeclRows(patchPayload, {
    actor: actorName,
    detail: summaryDetail,
  });

  for (const entry of historyQueue) {
    appendDeclHistoryEntry(entry.key, {
      actor: actorName,
      ts: new Date().toISOString(),
      changes: entry.changes,
    });
  }

  updateCachedItem(DECL_KEY, JSON.stringify(annotatedRows));

  pushAuditLog({
    actor: actorName,
    action: "decl.patch",
    detail: summaryDetail,
    meta: {
      total,
      updated: changeRecords.length,
      locked: lockedKeys.length,
      missing: missingKeys.length,
    },
  });

  return {
    success: true,
    total,
    updated: changeRecords.length,
    locked: lockedKeys.length,
    missing: missingKeys.length,
    noChange: noChangeKeys.length,
    invalid: invalidKeys.length,
    totalStored: annotatedRows.length,
    lockedKeys,
    missingKeys,
    noChangeKeys,
    invalidKeys,
  };
}



export function updateDeclRowFields(
  rowKey,
  updates,
  { actor = "system", detail = "", allowReviewedOverride = false } = {}
) {

  const key = typeof rowKey === "string" ? rowKey.trim() : String(rowKey || "").trim();

  if (!key) {

    return { success: false, reason: "invalid-key" };

  }

  const rows = getDeclRowsRaw();

  if (!Array.isArray(rows) || rows.length === 0) {

    return { success: false, reason: "empty" };

  }

  const index = rows.findIndex((row) => {

    if (!row || typeof row !== "object") return false;

    const soTk = (row.so_tk ?? "").toString();

    const nhanh = (row.nhanh ?? "").toString();

    return `${soTk}_${nhanh}` === key;

  });

  if (index === -1) {

    return { success: false, reason: "not-found" };

  }



  const current = rows[index] || {};

  const sanitizedUpdates = sanitizePartialDeclUpdates(updates);

  const changedFields = Object.keys(sanitizedUpdates);

  if (changedFields.length === 0) {

    return { success: false, reason: "no-change" };

  }

  if (current?.reviewed && !allowReviewedOverride) {

    const actorName = normalizeStr(actor) || "system";

    const actionDetail = detail && detail.trim().length > 0

      ? detail

      : `Chặn cập nhật tờ khai ${current.so_tk || "?"} do đã rà soát`;

    pushAuditLog({

      actor: actorName,

      action: "decl.update.blocked",

      detail: actionDetail,

      meta: { key, fields: changedFields, reason: "review lock" },

    });

    return { success: false, reason: "review-locked" };

  }

  const { changed, nextRow } = applyPartialUpdatesToRow(current, sanitizedUpdates, { sanitized: true });

  if (!changed) {

    return { success: false, reason: "no-change" };

  }



  const nextRows = rows.slice();

  nextRows[index] = nextRow;

  const stored = persistAndAnnotateDeclRows(nextRows);

  const updated = stored[index] || nextRow;



  const actorName = normalizeStr(actor) || "system";

  const actionDetail =

    detail && detail.trim().length > 0

      ? detail

      : `Cập nhật ${changedFields.join(", ")} của tờ khai ${current.so_tk || "?"}`;



  const historyChanges = buildDeclHistoryChanges(current, updated, changedFields);

  const historyEntry = historyChanges.length

    ? appendDeclHistoryEntry(key, {

        actor: actorName,

        ts: new Date().toISOString(),

        changes: historyChanges,

      })

    : null;



  pushAuditLog({

    actor: actorName,

    action: "decl.update.partial",

    detail: actionDetail,

    meta: historyEntry

      ? { key, fields: changedFields, historyEntryId: historyEntry.id }

      : { key, fields: changedFields },

  });



  return { success: true, row: updated };

}

export function softDeleteDeclRows(keys, { actor = "system", detail = "" } = {}) {
  const list = Array.isArray(keys) ? keys.map((key) => String(key || "").trim()).filter(Boolean) : [];
  if (list.length === 0) {
    return { deleted: 0, alreadyDeleted: 0, missing: 0, keys: [], alreadyDeletedKeys: [], missingKeys: list };
  }

  const actorName = normalizeStr(actor) || "system";
  const timestamp = new Date().toISOString();
  const rows = getDeclRowsRaw();
  const keySet = new Set(list);
  const seenKeys = new Set();
  const deletedKeys = [];
  const alreadyDeletedKeys = [];
  let deleted = 0;
  let alreadyDeleted = 0;
  const logEntries = [];

  const nextRows = rows.map((row) => {
    if (!row || typeof row !== "object") {
      return row;
    }
    const key = getDeclRowSimpleKey(row);
    if (!keySet.has(key)) {
      return row;
    }
    seenKeys.add(key);
    if (row.deleted_at) {
      alreadyDeleted += 1;
      alreadyDeletedKeys.push(key);
      return row;
    }
    deleted += 1;
    deletedKeys.push(key);
    const logEntry = buildDeletedDeclLogEntryFromRow(row, {
      actor: actorName,
      type: "soft",
      timestamp,
    });
    if (logEntry) {
      logEntries.push(logEntry);
    }
    return {
      ...row,
      deleted_at: timestamp,
      deleted_by: actorName,
    };
  });

  const missingKeys = list.filter((key) => !seenKeys.has(key));

  if (deleted > 0) {
    if (logEntries.length > 0) {
      appendDeletedDeclLogEntries(logEntries);
    }
    persistAndAnnotateDeclRows(nextRows);
    const actionDetail = detail && detail.trim().length > 0
      ? detail
      : `Đánh dấu xóa ${deleted.toLocaleString("vi-VN")} tờ khai từ giao diện Import Data`;
    pushAuditLog({
      actor: actorName,
      action: "decl.delete.soft",
      detail: actionDetail,
      meta: { count: deleted, keys: deletedKeys.slice() },
    });
    pushImportLog({
      actor: actorName,
      kind: "warn",
      message: actionDetail,
      meta: { count: deleted, keys: deletedKeys.slice() },
    });
  }

  return {
    deleted,
    alreadyDeleted,
    missing: missingKeys.length,
    keys: deletedKeys,
    alreadyDeletedKeys,
    missingKeys,
  };
}

export function hardDeleteDeclRows(keys, { actor = "system", detail = "" } = {}) {
  const list = Array.isArray(keys) ? keys.map((key) => String(key || "").trim()).filter(Boolean) : [];
  if (list.length === 0) {
    return { removed: 0, missing: 0, keys: [], missingKeys: list };
  }

  const actorName = normalizeStr(actor) || "system";
  const timestamp = new Date().toISOString();
  const rows = getDeclRowsRaw();
  const keySet = new Set(list);
  const seenKeys = new Set();
  const removedKeys = [];
  const logEntries = [];

  const nextRows = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      nextRows.push(row);
      continue;
    }
    const key = getDeclRowSimpleKey(row);
    if (!keySet.has(key)) {
      nextRows.push(row);
      continue;
    }
    seenKeys.add(key);
    removedKeys.push(key);
    const logEntry = buildDeletedDeclLogEntryFromRow(row, {
      actor: actorName,
      type: "hard",
      timestamp: normalizeStr(row.deleted_at) || timestamp,
    });
    if (logEntry) {
      logEntries.push(logEntry);
    }
  }

  const removed = removedKeys.length;
  const missingKeys = list.filter((key) => !seenKeys.has(key));

  if (removed > 0) {
    if (logEntries.length > 0) {
      appendDeletedDeclLogEntries(logEntries);
    }
    persistAndAnnotateDeclRows(nextRows);
    const actionDetail = detail && detail.trim().length > 0
      ? detail
      : `Xóa vĩnh viễn ${removed.toLocaleString("vi-VN")} tờ khai từ giao diện Import Data`;
    pushAuditLog({
      actor: actorName,
      action: "decl.delete.hard",
      detail: actionDetail,
      meta: { count: removed, keys: removedKeys.slice() },
    });
    pushImportLog({
      actor: actorName,
      kind: "error",
      message: actionDetail,
      meta: { count: removed, keys: removedKeys.slice() },
    });
  }

  return {
    removed,
    missing: missingKeys.length,
    keys: removedKeys,
    missingKeys,
  };
}

export function restoreDeclRows(keys, { actor = "system", detail = "" } = {}) {
  const list = Array.isArray(keys) ? keys.map((key) => String(key || "").trim()).filter(Boolean) : [];
  if (list.length === 0) {
    return { restored: 0, skipped: 0, failed: 0, restoredKeys: [], skippedKeys: [], failedKeys: [] };
  }

  const actorName = normalizeStr(actor) || "system";
  const baseDetail = detail && detail.trim().length > 0
    ? detail.trim()
    : "Khôi phục trạng thái xóa mềm từ giao diện Import Data";
  const restoredKeys = [];
  const skippedKeys = [];
  const failed = [];

  for (const key of list) {
    const result = updateDeclRowFields(
      key,
      { deleted_at: null, deleted_by: null },
      { actor: actorName, detail: baseDetail, allowReviewedOverride: true }
    );

    if (result.success) {
      restoredKeys.push(key);
    } else if (result.reason === "no-change") {
      skippedKeys.push(key);
    } else {
      failed.push({ key, reason: result.reason });
    }
  }

  const restored = restoredKeys.length;

  if (restored > 0) {
    const message = baseDetail.includes("Khôi phục")
      ? `${baseDetail} (${restored.toLocaleString("vi-VN")} tờ khai)`
      : `${baseDetail} - khôi phục ${restored.toLocaleString("vi-VN")} tờ khai`;
    pushImportLog({
      actor: actorName,
      kind: "info",
      message,
      meta: { count: restored, keys: restoredKeys.slice() },
    });
  }

  return {
    restored,
    skipped: skippedKeys.length,
    failed: failed.length,
    restoredKeys,
    skippedKeys,
    failedKeys: failed,
  };
}

export function markDeclRowsReviewed(keys, { actor = "system", note = "Đánh dấu rà soát" } = {}) {

  const list = Array.isArray(keys) ? keys.map((key) => String(key || "").trim()).filter(Boolean) : [];

  if (list.length === 0) {

    return 0;

  }

  const keySet = new Set(list);

  const actorName = normalizeStr(actor) || "system";

  const timestamp = new Date().toISOString();

  const rows = getDeclRowsRaw();

  let changed = 0;

  const nextRows = rows.map((row) => {

    if (!row || typeof row !== "object") return row;

    const soTk = (row.so_tk ?? "").toString();

    const nhanh = (row.nhanh ?? "").toString();

    const key = `${soTk}_${nhanh}`;

    if (!keySet.has(key)) {

      return row;

    }

    if (row.reviewed && row.reviewed_by && row.reviewed_at) {

      return row;

    }

    changed += 1;

    return {

      ...row,

      reviewed: true,

      reviewed_by: actorName,

      reviewed_at: timestamp,

    };

  });

  if (changed === 0) {

    return 0;

  }

  writeDeclRows(nextRows);

  pushAuditLog({

    actor: actorName,

    action: "decl.review",

    detail: `${note} ${changed} tờ khai`,

    meta: { count: changed },

  });

  return changed;

}



export function unmarkDeclRowsReviewed(keys, { actor = "system", note = "Bỏ đánh dấu rà soát" } = {}) {

  const list = Array.isArray(keys) ? keys.map((key) => String(key || "").trim()).filter(Boolean) : [];

  if (list.length === 0) {

    return 0;

  }

  const keySet = new Set(list);

  const actorName = normalizeStr(actor) || "system";

  const rows = getDeclRowsRaw();

  let changed = 0;

  const nextRows = rows.map((row) => {

    if (!row || typeof row !== "object") return row;

    const soTk = (row.so_tk ?? "").toString();

    const nhanh = (row.nhanh ?? "").toString();

    const key = `${soTk}_${nhanh}`;

    if (!keySet.has(key)) {

      return row;

    }

    if (!row.reviewed) {

      return row;

    }

    changed += 1;

    const next = { ...row };

    delete next.reviewed;

    delete next.reviewed_at;

    delete next.reviewed_by;

    return next;

  });

  if (changed === 0) {

    return 0;

  }

  writeDeclRows(nextRows);

  pushAuditLog({

    actor: actorName,

    action: "decl.unreview",

    detail: `${note} ${changed} tờ khai`,

    meta: { count: changed },

  });

  return changed;

}



function diffHQAgencyRows(prevRows, nextRows, actor) {

  const prevMap = new Map();

  for (const row of Array.isArray(prevRows) ? prevRows : []) {

    if (!row?.mst) continue;

    prevMap.set(row.mst, row);

  }



  const nextMap = new Map();

  for (const row of Array.isArray(nextRows) ? nextRows : []) {

    if (!row?.mst) continue;

    nextMap.set(row.mst, row);

  }



  const timestamp = new Date().toISOString();

  const actorName = normalizeStr(actor) || 'system';

  const entries = [];



  const recordChange = (mst, field, fromValue, toValue, type) => {

    entries.push(

      createHQHistoryEntry({

        mst,

        field,

        from: fromValue,

        to: toValue,

        actor: actorName,

        timestamp,

        type,

      })

    );

  };



  for (const [mst, row] of nextMap.entries()) {

    const prev = prevMap.get(mst);

    if (!prev) {

      const company = normalizeStr(row?.company);

      if (company) {

        recordChange(mst, 'company', '', company, 'create');

      }

      const agents = formatAgencyHistoryValue(row?.agents ?? row?.agent);

      if (agents) {

        recordChange(mst, 'agents', '', agents, 'create');

      }

      continue;

    }



    const prevCompany = normalizeStr(prev?.company);

    const nextCompany = normalizeStr(row?.company);

    if (prevCompany !== nextCompany) {

      recordChange(mst, 'company', prevCompany, nextCompany, 'update');

    }



    const prevAgents = formatAgencyHistoryValue(prev?.agents ?? prev?.agent);

    const nextAgents = formatAgencyHistoryValue(row?.agents ?? row?.agent);

    if (prevAgents !== nextAgents) {

      recordChange(mst, 'agents', prevAgents, nextAgents, 'update');

    }

  }



  for (const [mst, row] of prevMap.entries()) {

    if (nextMap.has(mst)) continue;

    const prevCompany = normalizeStr(row?.company);

    if (prevCompany) {

      recordChange(mst, 'company', prevCompany, '', 'delete');

    }

    const prevAgents = formatAgencyHistoryValue(row?.agents ?? row?.agent);

    if (prevAgents) {

      recordChange(mst, 'agents', prevAgents, '', 'delete');

    }

  }



  return entries;

}



function createHQHistoryEntry({ mst, field, from = '', to = '', actor = 'system', timestamp, type = 'update' }) {

  return {

    id: `hq-${mst}-${field}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,

    mst: normalizeMST(mst),

    field,

    from: field === 'agents' ? formatAgencyHistoryValue(from) : normalizeStr(from),

    to: field === 'agents' ? formatAgencyHistoryValue(to) : normalizeStr(to),

    actor: actor || 'system',

    timestamp,

    type,

  };

}



export const HQ_HISTORY_LIMIT = 500;



function appendHQHistoryEntries(entries) {

  if (!Array.isArray(entries) || entries.length === 0) return;

  const existing = getHQHistoryEntries();

  const merged = [...entries, ...existing]

    .filter((item) => item && item.mst)

    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    .slice(0, HQ_HISTORY_LIMIT);

  setItem(HQ_HISTORY_KEY, JSON.stringify(merged));

}



export function getHQHistoryEntries(limit = HQ_HISTORY_LIMIT) {

  const raw = safeParse(getItem(HQ_HISTORY_KEY), []);

  const list = Array.isArray(raw) ? raw.filter((entry) => entry && entry.mst) : [];

  if (!Number.isFinite(limit) || limit <= 0) return list;

  return list.slice(0, limit);

}



export function getHQHistoryForMST(mst, limit = 50) {

  const target = normalizeMST(mst);

  if (!target) return [];

  const entries = getHQHistoryEntries(HQ_HISTORY_LIMIT).filter((entry) => entry.mst === target);

  if (!Number.isFinite(limit) || limit <= 0) return entries;

  return entries.slice(0, limit);

}





// ===== Điểm KPI +/- bổ sung =====

export const KPI_ADJUSTMENT_STATUS_SET = new Set(['pending', 'approved', 'rejected']);



const KPI_ADJUSTMENT_HISTORY_LIMIT = 50;

const KPI_ADJUSTMENT_AUTO_APPROVE_DEFAULT = Object.freeze({
  enabled: false,
  note: null,
  updatedAt: null,
  updatedBy: null,
});

const KPI_ADJUSTMENT_BUILTIN_DEFAULTS = Object.freeze({

  tax_refund_customer: Object.freeze({

    extraUnitPoints: 0.5,

  }),

});

function normalizeAutoApproveSettings(value) {

  const source = value && typeof value === 'object' ? value : {};

  const enabled = source.enabled === true;

  const updatedAt = typeof source.updatedAt === 'string' ? source.updatedAt : null;

  const updatedByRaw = typeof source.updatedBy === 'string' ? source.updatedBy : null;

  const updatedBy = updatedByRaw ? normalizeStr(updatedByRaw) || updatedByRaw.trim() || null : null;

  let note = null;

  if (Object.prototype.hasOwnProperty.call(source, 'note')) {

    if (source.note === null) {

      note = null;

    } else if (typeof source.note === 'string') {

      const normalized = normalizeStr(source.note);

      note = normalized || null;

    }

  }

  return {

    enabled,

    note,

    updatedAt,

    updatedBy,

  };

}



function cloneAutoApproveSettings(value) {

  const normalized = normalizeAutoApproveSettings(value);

  return {

    enabled: normalized.enabled,

    note: normalized.note,

    updatedAt: normalized.updatedAt,

    updatedBy: normalized.updatedBy,

  };

}



function readAdjustmentSettings() {

  const raw = safeParse(getItem(KPI_ADJUSTMENT_SETTINGS_KEY), {});

  if (!raw || typeof raw !== 'object') {

    return {

      categories: {},

      updatedAt: null,

      updatedBy: null,

      autoApprove: { ...KPI_ADJUSTMENT_AUTO_APPROVE_DEFAULT },

    };

  }

  const source = raw.categories && typeof raw.categories === 'object' ? raw.categories : {};

  const categories = {};

  for (const [key, value] of Object.entries(source)) {

    const categoryKey = normalizeAdjustmentCategoryKey(key);

    if (!categoryKey || !KPI_ADJUSTMENT_CATEGORY_CONFIG[categoryKey]) {

      continue;

    }

    if (!value || typeof value !== 'object') {

      continue;

    }

    categories[categoryKey] = { ...value };

  }

  for (const [key, defaults] of Object.entries(KPI_ADJUSTMENT_BUILTIN_DEFAULTS)) {

    if (!KPI_ADJUSTMENT_CATEGORY_CONFIG[key]) {

      continue;

    }

    const baseCategory = categories[key] ? { ...categories[key] } : {};

    let changed = false;

    for (const [field, defaultValue] of Object.entries(defaults)) {

      if (Object.prototype.hasOwnProperty.call(baseCategory, field)) {

        continue;

      }

      if (typeof defaultValue === 'number') {

        baseCategory[field] = roundAdjustmentPoint(defaultValue);

      } else {

        baseCategory[field] = defaultValue;

      }

      changed = true;

    }

    if (changed || categories[key]) {

      categories[key] = baseCategory;

    }

  }

  return {

    categories,

    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,

    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : null,

    autoApprove: cloneAutoApproveSettings(raw.autoApprove),

  };

}



function cloneAdjustmentSettings(settings) {

  const categories = {};

  if (settings?.categories && typeof settings.categories === 'object') {

    for (const [key, value] of Object.entries(settings.categories)) {

      categories[key] = value && typeof value === 'object' ? { ...value } : {};

    }

  }

  return {

    categories,

    updatedAt: settings?.updatedAt || null,

    updatedBy: settings?.updatedBy || null,

    autoApprove: cloneAutoApproveSettings(settings?.autoApprove),

  };

}



function writeAdjustmentSettings(settings) {

  const payload = cloneAdjustmentSettings(settings || {});

  setItem(KPI_ADJUSTMENT_SETTINGS_KEY, JSON.stringify(payload));

  refreshSharedKeys([KPI_ADJUSTMENT_SETTINGS_KEY]);

  return payload;

}



export function getKpiAdjustmentSettings() {

  return cloneAdjustmentSettings(readAdjustmentSettings());

}



export function saveKpiAdjustmentSettings(patch, { actor = 'system', permissions = {} } = {}) {

  if (!permissions.adjustApprove) {

    throw new Error('Bạn không có quyền cấu hình điểm KPI bổ sung');

  }

  const base = readAdjustmentSettings();

  const categories = { ...base.categories };

  const patchCategories = patch && typeof patch === 'object' && typeof patch.categories === 'object'

    ? patch.categories

    : null;

  if (patchCategories) {

    for (const [rawKey, rawValue] of Object.entries(patchCategories)) {

      const key = normalizeAdjustmentCategoryKey(rawKey);

      if (!key || !KPI_ADJUSTMENT_CATEGORY_CONFIG[key]) {

        continue;

      }

      const value = rawValue && typeof rawValue === 'object' ? rawValue : {};

      const current = categories[key] ? { ...categories[key] } : {};

      if (Object.prototype.hasOwnProperty.call(value, 'defaultUnit')) {

        const num = Number.parseFloat(value.defaultUnit);

        if (Number.isFinite(num)) {

          current.defaultUnit = roundAdjustmentPoint(num);

        } else if (value.defaultUnit === null) {

          delete current.defaultUnit;

        }

      }

      if (Object.prototype.hasOwnProperty.call(value, 'defaultMode')) {

        const modeCandidate = normalizeStr(value.defaultMode).toLowerCase();

        const allowedModes = new Set((KPI_ADJUSTMENT_CATEGORY_CONFIG[key].modes || []).map((item) => item.value));

        if (modeCandidate && allowedModes.has(modeCandidate)) {

          current.defaultMode = modeCandidate;

        } else if (!modeCandidate) {

          delete current.defaultMode;

        }

      }

      if (value.modeUnits && typeof value.modeUnits === 'object') {

        const modeUnits = { ...(current.modeUnits || {}) };

        for (const [modeKey, rawUnit] of Object.entries(value.modeUnits)) {

          const normalizedMode = normalizeStr(modeKey).toLowerCase();

          if (!normalizedMode) continue;

          const allowedMode = (KPI_ADJUSTMENT_CATEGORY_CONFIG[key].modes || []).find((item) => item.value === normalizedMode);

          if (!allowedMode) continue;

          const num = Number.parseFloat(rawUnit);

          if (Number.isFinite(num)) {

            modeUnits[normalizedMode] = roundAdjustmentPoint(num);

          } else if (rawUnit === null) {

            delete modeUnits[normalizedMode];

          }

        }

        if (Object.keys(modeUnits).length) {

          current.modeUnits = modeUnits;

        } else {

          delete current.modeUnits;

        }

      }

      if (value.licensePoints && typeof value.licensePoints === 'object') {

        const licensePoints = { ...(current.licensePoints || {}) };

        for (const [licenseKey, rawUnit] of Object.entries(value.licensePoints)) {

          const normalizedLicense = normalizeStr(licenseKey).toUpperCase();

          if (!normalizedLicense) continue;

          const num = Number.parseFloat(rawUnit);

          if (Number.isFinite(num)) {

            licensePoints[normalizedLicense] = roundAdjustmentPoint(num);

          } else if (rawUnit === null) {

            delete licensePoints[normalizedLicense];

          }

        }

        if (Object.keys(licensePoints).length) {

          current.licensePoints = licensePoints;

        } else {

          delete current.licensePoints;

        }

      }

      if (

        Object.prototype.hasOwnProperty.call(value, 'extraUnitPoints') &&

        KPI_ADJUSTMENT_CATEGORY_CONFIG[key] &&

        KPI_ADJUSTMENT_CATEGORY_CONFIG[key].extraPointConfig

      ) {

        if (value.extraUnitPoints === null) {

          delete current.extraUnitPoints;

        } else {

          const num = Number.parseFloat(value.extraUnitPoints);

          if (Number.isFinite(num)) {

            current.extraUnitPoints = roundAdjustmentPoint(num);

          }

        }

      }

      if (Object.keys(current).length) {

        categories[key] = current;

      } else {

        delete categories[key];

      }

    }

  }

  let autoApprove = cloneAutoApproveSettings(base.autoApprove);

  const autoPatch =
    patch && typeof patch === 'object' && patch.autoApprove && typeof patch.autoApprove === 'object'
      ? patch.autoApprove
      : null;

  if (autoPatch) {
    const nextAuto = { ...autoApprove };
    let changed = false;

    if (Object.prototype.hasOwnProperty.call(autoPatch, 'enabled')) {
      const requestedEnabled = autoPatch.enabled === true;
      if (requestedEnabled !== nextAuto.enabled) {
        nextAuto.enabled = requestedEnabled;
        changed = true;
      }
    }

    if (Object.prototype.hasOwnProperty.call(autoPatch, 'note')) {
      let noteValue = nextAuto.note ?? null;
      if (autoPatch.note === null) {
        noteValue = null;
      } else if (typeof autoPatch.note === 'string') {
        const normalizedNote = normalizeStr(autoPatch.note);
        noteValue = normalizedNote || null;
      }
      if (noteValue !== (nextAuto.note ?? null)) {
        nextAuto.note = noteValue;
        changed = true;
      }
    }

    if (changed) {
      const stamp = new Date().toISOString();
      nextAuto.updatedAt = stamp;
      nextAuto.updatedBy = actor;
      autoApprove = nextAuto;
    }
  }

  const timestamp = new Date().toISOString();

  const next = {

    categories,

    autoApprove,

    updatedAt: timestamp,

    updatedBy: actor,

  };

  writeAdjustmentSettings(next);

  pushAuditLog({

    actor,

    action: 'kpi.adjustment.defaults',

    detail: 'Cập nhật cấu hình điểm KPI bổ sung',

    meta: {

      categories: Object.keys(categories),

      autoApprove: autoApprove.enabled,

    },

  });

  return cloneAdjustmentSettings(next);

}



function normalizeAdjustmentCategory(value) {

  const key = normalizeAdjustmentCategoryKey(value);

  if (key && KPI_ADJUSTMENT_CATEGORY_CONFIG[key]) {

    return key;

  }

  return '';

}



function normalizeAdjustmentMonth(value) {

  if (!value) return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {

    const year = value.getFullYear();

    const month = String(value.getMonth() + 1).padStart(2, '0');

    return `${year}-${month}`;

  }

  const str = normalizeStr(value);

  if (!str) return '';

  const isoMonth = str.match(/^(\d{4})-(\d{2})$/);

  if (isoMonth) {

    const monthNum = Number.parseInt(isoMonth[2], 10);

    if (monthNum >= 1 && monthNum <= 12) {

      return `${isoMonth[1]}-${isoMonth[2]}`;

    }

  }

  const isoDate = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoDate) {

    const monthNum = Number.parseInt(isoDate[2], 10);

    if (monthNum >= 1 && monthNum <= 12) {

      return `${isoDate[1]}-${isoDate[2]}`;

    }

  }

  const compact = str.match(/^(\d{4})(\d{2})$/);

  if (compact) {

    const monthNum = Number.parseInt(compact[2], 10);

    if (monthNum >= 1 && monthNum <= 12) {

      return `${compact[1]}-${compact[2]}`;

    }

  }

  const slash = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);

  if (slash) {

    let [, first, second, yearRaw] = slash;

    let year = Number.parseInt(yearRaw, 10);

    if (year < 100) {

      year += year < 50 ? 2000 : 1900;

    }

    const a = Number.parseInt(first, 10);

    const b = Number.parseInt(second, 10);

    const month = a > 12 && b <= 12 ? b : a;

    if (month >= 1 && month <= 12) {

      return `${year}-${String(month).padStart(2, '0')}`;

    }

  }

  return '';

}



function normalizeAdjustmentReferences(value) {

  if (!value) return [];

  const list = Array.isArray(value) ? value : [value];

  const normalized = [];

  const seen = new Set();

  for (const item of list) {

    const text = normalizeStr(item);

    if (!text || seen.has(text)) continue;

    seen.add(text);

    normalized.push(text);

  }

  return normalized;

}



function normalizeAdjustmentHistoryEntry(entry) {

  if (!entry || typeof entry !== 'object') return null;

  const ts = entry.ts && !Number.isNaN(new Date(entry.ts).getTime()) ? new Date(entry.ts).toISOString() : new Date().toISOString();

  const actor = normalizeStr(entry.actor) || 'system';

  const action = normalizeStr(entry.action) || 'update';

  const detail = normalizeStr(entry.detail);

  const changes = entry.changes && typeof entry.changes === 'object' ? entry.changes : null;

  return {

    id: entry.id || `adj-hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,

    ts,

    actor,

    action,

    detail,

    changes,

  };

}



function clampHistory(list) {

  const entries = Array.isArray(list) ? list.map(normalizeAdjustmentHistoryEntry).filter(Boolean) : [];

  return entries.slice(-KPI_ADJUSTMENT_HISTORY_LIMIT);

}



function computeAdjustmentTotal({ category, unitPoints, quantity, mode, extraQuantity, extraUnitPoints }) {

  const config = KPI_ADJUSTMENT_CATEGORY_CONFIG[category] || { type: 'quantity' };

  const unit = Number.isFinite(unitPoints) ? unitPoints : 0;

  let baseTotal = 0;

  if (config.type === 'fixed' || config.type === 'grade') {

    baseTotal = roundAdjustmentPoint(unit);

  } else if (config.type === 'hybrid') {

    const normalizedMode = normalizeStr(mode).toLowerCase();

    const targetMode = (config.modes || []).find((item) => item.value === normalizedMode) || config.modes?.[0];

    if (targetMode?.compute === 'fixed') {

      baseTotal = roundAdjustmentPoint(unit);

    } else {

      const qtyHybrid = Number.isFinite(quantity) ? quantity : 0;

      baseTotal = roundAdjustmentPoint(unit * qtyHybrid);

    }

  } else {

    const qty = Number.isFinite(quantity) ? quantity : 0;

    baseTotal = roundAdjustmentPoint(unit * qty);

  }

  let bonusTotal = 0;

  const extraConfig = config.extraPointConfig;

  if (extraConfig) {

    const fallbackExtraUnit = Number.isFinite(extraConfig.defaultUnit)

      ? roundAdjustmentPoint(Number(extraConfig.defaultUnit))

      : 0;

    const resolvedExtraUnit = Number.isFinite(extraUnitPoints) ? extraUnitPoints : fallbackExtraUnit;

    const resolvedExtraQty = Number.isFinite(extraQuantity) ? extraQuantity : 0;

    bonusTotal = roundAdjustmentPoint(resolvedExtraUnit * resolvedExtraQty);

  }

  return roundAdjustmentPoint(baseTotal + bonusTotal);

}



function normalizeAdjustmentInput(input, { now, actor, current, permissions = {} } = {}) {

  if (!input || typeof input !== 'object') {

    return null;

  }

  const category = normalizeAdjustmentCategory(input.category || current?.category);

  if (!category) {

    return null;

  }

  const config = KPI_ADJUSTMENT_CATEGORY_CONFIG[category];

  const settings = readAdjustmentSettings();

  const override = settings.categories?.[category] || {};

  const allowManualOverride = permissions?.adjustOverridePoints === true || category === 'support_misc';

  const staffName = normalizeStr(input.staffName ?? input.staff ?? current?.staffName ?? '');

  const teamName = normalizeStr(input.teamName ?? input.team ?? current?.teamName ?? '');

  const month = normalizeAdjustmentMonth(input.month ?? input.period ?? current?.month ?? '');

  if (!month) {

    return null;

  }

  const companyName = normalizeStr(input.companyName ?? input.company ?? current?.companyName ?? '');

  const taxCode = normalizeMST(input.taxCode ?? input.mst ?? current?.taxCode ?? '');

  const gradeSource = input.grade ?? input.value ?? input.unitPoints ?? input.points;

  const gradeValue =

    gradeSource !== undefined && gradeSource !== null && gradeSource !== ''

      ? Number.parseFloat(gradeSource)

      : Number.NaN;

  const allowedModes = Array.isArray(config?.modes) ? config.modes.map((item) => item.value).filter(Boolean) : [];

  let mode = normalizeStr(input.mode ?? input.adjustMode ?? current?.mode ?? override.defaultMode ?? config?.defaultMode ?? '')

    .toLowerCase();

  if (allowedModes.length) {

    if (!allowedModes.includes(mode)) {

      const fallbackMode = [override.defaultMode, config?.defaultMode, allowedModes[0]].map((candidate) => {

        const normalized = normalizeStr(candidate).toLowerCase();

        return allowedModes.includes(normalized) ? normalized : null;

      }).find(Boolean);

      mode = fallbackMode || allowedModes[0];

    }

  } else {

    mode = '';

  }



  let licenseCode = '';

  if (config?.requiresLicenseCode) {

    licenseCode = normalizeStr(input.licenseCode ?? input.license ?? current?.licenseCode ?? '');

    if (licenseCode) {

      licenseCode = licenseCode.toUpperCase();

    }

  }



  const mergedLicensePoints = {};

  if (config?.licensePoints && typeof config.licensePoints === 'object') {

    for (const [code, value] of Object.entries(config.licensePoints)) {

      if (!code) continue;

      const normalizedCode = code.toString().trim().toUpperCase();

      if (!normalizedCode) continue;

      const num = Number.parseFloat(value);

      if (Number.isFinite(num)) {

        mergedLicensePoints[normalizedCode] = roundAdjustmentPoint(num);

      }

    }

  }

  if (override?.licensePoints && typeof override.licensePoints === 'object') {

    for (const [code, value] of Object.entries(override.licensePoints)) {

      if (!code) continue;

      const normalizedCode = code.toString().trim().toUpperCase();

      if (!normalizedCode) continue;

      const num = Number.parseFloat(value);

      if (Number.isFinite(num)) {

        mergedLicensePoints[normalizedCode] = roundAdjustmentPoint(num);

      } else if (value === null) {

        delete mergedLicensePoints[normalizedCode];

      }

    }

  }



  const overrideDefaultUnit = Number.isFinite(Number.parseFloat(override?.defaultUnit))

    ? roundAdjustmentPoint(Number.parseFloat(override.defaultUnit))

    : undefined;

  const preservedUnit = Number.isFinite(Number.parseFloat(current?.unitPoints))

    ? roundAdjustmentPoint(Number.parseFloat(current.unitPoints))

    : undefined;

  const unitSource = allowManualOverride ? input.unitPoints ?? input.basePoint ?? input.pointsPerUnit : undefined;

  let unitPoints =

    unitSource !== undefined && unitSource !== null && unitSource !== ''

      ? Number.parseFloat(unitSource)

      : Number.NaN;

  const canAdoptGradeValue = config?.type === 'grade' || allowManualOverride;

  if (!Number.isFinite(unitPoints) && canAdoptGradeValue && Number.isFinite(gradeValue)) {

    unitPoints = gradeValue;

  }

  if (!Number.isFinite(unitPoints)) {

    if (!allowManualOverride && Number.isFinite(preservedUnit)) {

      unitPoints = preservedUnit;

    } else if (config?.type === 'hybrid') {

      const modeConfig = (config.modes || []).find((item) => item.value === mode);

      const overrideModeUnits = override?.modeUnits && typeof override.modeUnits === 'object' ? override.modeUnits : {};

      if (overrideModeUnits && Number.isFinite(Number.parseFloat(overrideModeUnits[mode]))) {

        unitPoints = roundAdjustmentPoint(Number.parseFloat(overrideModeUnits[mode]));

      } else if (modeConfig && Number.isFinite(Number.parseFloat(modeConfig.defaultUnit))) {

        unitPoints = roundAdjustmentPoint(Number.parseFloat(modeConfig.defaultUnit));

      } else if (Number.isFinite(overrideDefaultUnit)) {

        unitPoints = overrideDefaultUnit;

      } else {

        unitPoints = Number.isFinite(config?.defaultUnit) ? config.defaultUnit : 0;

      }

    } else if (config?.requiresLicenseCode && licenseCode && mergedLicensePoints[licenseCode] != null) {

      unitPoints = mergedLicensePoints[licenseCode];

    } else if (Number.isFinite(overrideDefaultUnit)) {

      unitPoints = overrideDefaultUnit;

    } else {

      unitPoints = Number.isFinite(config?.defaultUnit) ? config.defaultUnit : 0;

    }

  }

  if (config?.type === 'grade' && config.grades?.length) {

    const allowed = config.grades.map((item) => item.value);

    if (!allowed.includes(unitPoints)) {

      unitPoints = allowed.find((value) => value === Math.round(unitPoints)) ?? allowed[2] ?? 0;

    }

  }

  let quantity = Number.parseFloat(input.quantity ?? input.count ?? input.total ?? current?.quantity ?? 0);

  if (!Number.isFinite(quantity) || quantity < 0) {

    quantity = 0;

  }

  if (config?.type === 'fixed' || config?.type === 'grade') {

    quantity = 1;

  }

  if (config?.type === 'hybrid') {

    const modeConfig = (config.modes || []).find((item) => item.value === mode);

    if (modeConfig?.compute === 'fixed') {

      quantity = 1;

    } else if (quantity === 0) {

      quantity = 1;

    }

  } else if (config?.type === 'quantity' && quantity === 0) {

    quantity = 1;

  }

  let extraQuantity = 0;

  let extraUnitPointsValue = 0;

  const extraConfig = config?.extraPointConfig;

  if (extraConfig) {

    const overrideExtraUnit = Number.isFinite(Number.parseFloat(override?.extraUnitPoints))

      ? roundAdjustmentPoint(Number.parseFloat(override.extraUnitPoints))

      : undefined;

    const defaultExtraUnit = Number.isFinite(Number.parseFloat(extraConfig.defaultUnit))

      ? roundAdjustmentPoint(Number.parseFloat(extraConfig.defaultUnit))

      : 0;

    const preservedExtraUnit = Number.isFinite(Number.parseFloat(current?.extraUnitPoints))

      ? roundAdjustmentPoint(Number.parseFloat(current.extraUnitPoints))

      : undefined;

    const extraUnitSource =

      allowManualOverride

        ? input.extraUnitPoints ?? input.bonusUnitPoints ?? current?.extraUnitPoints ?? current?.bonusUnitPoints

        : undefined;

    const parsedExtraUnit =

      extraUnitSource !== undefined && extraUnitSource !== null && extraUnitSource !== ''

        ? Number.parseFloat(extraUnitSource)

        : Number.NaN;

    if (Number.isFinite(parsedExtraUnit)) {

      extraUnitPointsValue = roundAdjustmentPoint(parsedExtraUnit);

    } else if (!allowManualOverride && Number.isFinite(preservedExtraUnit)) {

      extraUnitPointsValue = preservedExtraUnit;

    } else if (Number.isFinite(overrideExtraUnit)) {

      extraUnitPointsValue = overrideExtraUnit;

    } else {

      extraUnitPointsValue = defaultExtraUnit;

    }

    const extraQuantitySource =

      input.extraQuantity ?? input.bonusQuantity ?? current?.extraQuantity ?? current?.bonusQuantity ?? 0;

    const parsedExtraQuantity = Number.parseFloat(extraQuantitySource);

    if (Number.isFinite(parsedExtraQuantity) && parsedExtraQuantity >= 0) {

      extraQuantity = roundAdjustmentPoint(parsedExtraQuantity);

    } else {

      extraQuantity = 0;

    }

  }

  const references = normalizeAdjustmentReferences(input.references ?? input.reference ?? current?.references ?? []);

  const note = normalizeStr(input.note ?? input.description ?? current?.note ?? '');

  const statusCandidate = normalizeStr(input.status ?? current?.status ?? 'pending').toLowerCase();

  const status = KPI_ADJUSTMENT_STATUS_SET.has(statusCandidate) ? statusCandidate : 'pending';

  const totalOverride = Number.parseFloat(input.totalPoints ?? input.pointsTotal ?? input.total ?? NaN);

  let totalPoints;

  if (Number.isFinite(totalOverride)) {

    totalPoints = roundAdjustmentPoint(totalOverride);

  } else {

    totalPoints = computeAdjustmentTotal({

      category,

      unitPoints,

      quantity,

      mode,

      extraQuantity,

      extraUnitPoints: extraUnitPointsValue,

    });

  }

  const createdAt = current?.createdAt && !Number.isNaN(new Date(current.createdAt).getTime())

    ? new Date(current.createdAt).toISOString()

    : now.toISOString();

  const createdBy = current?.createdBy || actor;

  const history = clampHistory(input.history ?? current?.history ?? []);

  const payload = {

    id: current?.id || input.id || `adj-${month.replace(/-/g, '')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,

    category,

    staffName,

    teamName,

    month,

    quantity,

    unitPoints: roundAdjustmentPoint(unitPoints),

    extraQuantity: extraConfig ? extraQuantity : undefined,

    extraUnitPoints: extraConfig ? extraUnitPointsValue : undefined,

    totalPoints,

    references,

    note,

    status,

    mode: mode || undefined,

    licenseCode: licenseCode || undefined,

    createdAt,

    createdBy,

    history,

  };

  if (taxCode) {

    payload.taxCode = taxCode;

  }

  if (companyName) {

    payload.companyName = companyName;

  }

  const approvedAtSource = input.approvedAt ?? current?.approvedAt ?? null;

  if (approvedAtSource) {

    const approvedAtDate = new Date(approvedAtSource);

    if (!Number.isNaN(approvedAtDate.getTime())) {

      payload.approvedAt = approvedAtDate.toISOString();

    }

  }

  const approvedBySource = input.approvedBy ?? current?.approvedBy ?? null;

  if (typeof approvedBySource === 'string') {

    const trimmed = approvedBySource.trim();

    if (trimmed) {

      payload.approvedBy = trimmed;

    }

  }

  const rejectedAtSource = input.rejectedAt ?? current?.rejectedAt ?? null;

  if (rejectedAtSource) {

    const rejectedAtDate = new Date(rejectedAtSource);

    if (!Number.isNaN(rejectedAtDate.getTime())) {

      payload.rejectedAt = rejectedAtDate.toISOString();

    }

  }

  const rejectedBySource = input.rejectedBy ?? current?.rejectedBy ?? null;

  if (typeof rejectedBySource === 'string') {

    const trimmed = rejectedBySource.trim();

    if (trimmed) {

      payload.rejectedBy = trimmed;

    }

  }

  return payload;

}



function diffAdjustments(prev, next) {

  if (!prev) return null;

  const changes = {};

  const fields = [

    'staffName',

    'teamName',

    'month',

    'category',

    'quantity',

    'unitPoints',

    'extraQuantity',

    'extraUnitPoints',

    'totalPoints',

    'note',

    'status',

    'mode',

    'licenseCode',

    'companyName',

    'taxCode',

  ];

  for (const field of fields) {

    if (JSON.stringify(prev[field]) !== JSON.stringify(next[field])) {

      changes[field] = { from: prev[field], to: next[field] };

    }

  }

  if (JSON.stringify(prev.references) !== JSON.stringify(next.references)) {

    changes.references = { from: prev.references, to: next.references };

  }

  return Object.keys(changes).length ? changes : null;

}



function getAllAdjustments() {

  const raw = safeParse(getItem(KPI_ADJUSTMENTS_KEY), []);

  const entries = Array.isArray(raw) ? raw : [];

  return entries

    .map((item) =>
      normalizeAdjustmentInput(item, {
        now: new Date(),
        actor: 'system',
        current: item,
        permissions: { adjustOverridePoints: true },
      })
    )

    .filter(Boolean)

    .sort((a, b) => {

      if (a.month !== b.month) {

        return b.month.localeCompare(a.month);

      }

      if (a.staffName !== b.staffName) {

        return a.staffName.localeCompare(b.staffName, 'vi', { sensitivity: 'base' });

      }

      return a.id.localeCompare(b.id);

    });

}



function persistAdjustments(list) {

  setItem(KPI_ADJUSTMENTS_KEY, JSON.stringify(list));

}



export function getKpiAdjustments() {

  return getAllAdjustments();

}



export function saveKpiAdjustment(entry, { actor = 'system', permissions = {} } = {}) {

  const permissionSet = permissions || {};

  const canSubmit = permissionSet.adjustSubmit === true;
  const canApprove = permissionSet.adjustApprove === true;

  if (!canSubmit && !canApprove) {
    throw new Error('Ban khong co quyen tao diem KPI bo sung');
  }

  const now = new Date();

  const settingsSnapshot = readAdjustmentSettings();

  const autoApproveConfig = cloneAutoApproveSettings(settingsSnapshot.autoApprove);

  const autoApproveEnabled = autoApproveConfig.enabled === true;

  const adjustments = getAllAdjustments();

  const existingIndex = entry?.id ? adjustments.findIndex((item) => item.id === entry.id) : -1;

  const current = existingIndex >= 0 ? adjustments[existingIndex] : null;

  const normalized = normalizeAdjustmentInput(entry, {

    now,

    actor,

    current,

    permissions,

  });

  if (!normalized) {

    throw new Error('Dữ liệu điểm KPI bổ sung không hợp lệ');

  }

  let status = current?.status || 'pending';

  const requestedStatus = normalized.status || 'pending';

  if (requestedStatus !== status) {

    if ((requestedStatus === 'approved' || requestedStatus === 'rejected') && !permissions.adjustApprove) {

      throw new Error('Bạn không có quyền duyệt điểm KPI bổ sung');

    }

    status = requestedStatus;

  }

  let autoApproved = false;

  if (!current && status === 'pending' && autoApproveEnabled && !canApprove) {

    status = 'approved';

    autoApproved = true;

  }

  normalized.status = status;

  normalized.updatedAt = now.toISOString();

  normalized.updatedBy = actor;

  if (autoApproved) {

    const autoApproveActor = autoApproveConfig.updatedBy || 'auto-approve';

    normalized.approvedAt = now.toISOString();

    normalized.approvedBy = autoApproveActor;

    if ('rejectedAt' in normalized) {

      delete normalized.rejectedAt;

    }

    if ('rejectedBy' in normalized) {

      delete normalized.rejectedBy;

    }

  }

  if (!current) {

    normalized.createdAt = now.toISOString();

    normalized.createdBy = actor;

  }

  const history = current?.history ? current.history.slice() : [];

  const changes = diffAdjustments(current, normalized);

  history.push(

    normalizeAdjustmentHistoryEntry({

      action: current ? 'update' : 'create',

      actor,

      detail: normalized.note,

      changes,

    })

  );

  if (autoApproved) {

    const autoApproveActor = autoApproveConfig.updatedBy || 'auto-approve';

    const autoApproveDetail = autoApproveConfig.note

      ? `Duyet tu dong: ${autoApproveConfig.note}`

      : autoApproveConfig.updatedBy

        ? `Duyet tu dong (bat boi ${autoApproveConfig.updatedBy})`

        : 'Duyet tu dong';

    history.push(

      normalizeAdjustmentHistoryEntry({

        action: 'status.approved',

        actor: autoApproveActor,

        detail: autoApproveDetail,

      })

    );

  }

  normalized.history = clampHistory(history);

  if (existingIndex >= 0) {

    adjustments[existingIndex] = { ...current, ...normalized };

  } else {

    adjustments.unshift(normalized);

  }

  persistAdjustments(adjustments);

  pushAuditLog({

    actor,

    action: current ? 'kpi.adjustment.update' : 'kpi.adjustment.create',

    detail: `${normalized.staffName || 'Chưa rõ'} - ${normalized.month} (${KPI_ADJUSTMENT_CATEGORY_CONFIG[normalized.category]?.label || normalized.category})`,

    meta: {

      id: normalized.id,

      status: normalized.status,

      totalPoints: normalized.totalPoints,

      autoApproved,

    },

  });

  return normalized;

}



export function updateKpiAdjustmentStatus(id, status, { actor = 'system', note = '', permissions = {} } = {}) {

  const normalizedStatus = normalizeStr(status).toLowerCase();

  if (!KPI_ADJUSTMENT_STATUS_SET.has(normalizedStatus)) {

    throw new Error('Trạng thái điểm KPI bổ sung không hợp lệ');

  }

  if (!permissions.adjustApprove) {

    throw new Error('Bạn không có quyền duyệt điểm KPI bổ sung');

  }

  const adjustments = getAllAdjustments();

  const index = adjustments.findIndex((item) => item.id === id);

  if (index === -1) {

    throw new Error('Không tìm thấy điểm KPI bổ sung');

  }

  const entry = { ...adjustments[index] };

  entry.status = normalizedStatus;

  const now = new Date();

  entry.updatedAt = now.toISOString();

  entry.updatedBy = actor;

  if (normalizedStatus === 'approved') {

    entry.approvedAt = now.toISOString();

    entry.approvedBy = actor;

  } else if (normalizedStatus === 'rejected') {

    entry.rejectedAt = now.toISOString();

    entry.rejectedBy = actor;

  }

  const history = entry.history ? entry.history.slice() : [];

  history.push(

    normalizeAdjustmentHistoryEntry({

      action: `status.${normalizedStatus}`,

      actor,

      detail: note,

    })

  );

  entry.history = clampHistory(history);

  adjustments[index] = entry;

  persistAdjustments(adjustments);

  pushAuditLog({

    actor,

    action: 'kpi.adjustment.status',

    detail: `${entry.staffName || 'Chưa rõ'} - ${entry.month} (${entry.status})`,

    meta: { id: entry.id, status: entry.status },

  });

  return entry;

}



export function bulkUpdateKpiAdjustmentStatus(
  ids,
  status,
  { actor = 'system', note = '', permissions = {} } = {}
) {

  if (!Array.isArray(ids) || ids.length === 0) {

    return [];

  }

  const normalizedStatus = normalizeStr(status).toLowerCase();

  if (!KPI_ADJUSTMENT_STATUS_SET.has(normalizedStatus)) {

    throw new Error('Trạng thái điểm KPI bổ sung không hợp lệ');

  }

  if (!permissions.adjustApprove) {

    throw new Error('Bạn không có quyền duyệt điểm KPI bổ sung');

  }

  const uniqueIds = Array.from(new Set(ids.filter((value) => typeof value === 'string' && value)));

  if (!uniqueIds.length) {

    return [];

  }

  const idSet = new Set(uniqueIds);
  const adjustments = getAllAdjustments();
  const updatedEntries = [];
  let changed = false;

  for (let index = 0; index < adjustments.length; index += 1) {

    const entry = adjustments[index];

    if (!entry || !idSet.has(entry.id)) {

      continue;

    }

    if (entry.status === normalizedStatus) {

      continue;

    }

    const next = { ...entry };
    const stamp = new Date();
    const iso = stamp.toISOString();

    next.status = normalizedStatus;
    next.updatedAt = iso;
    next.updatedBy = actor;

    if (normalizedStatus === 'approved') {

      next.approvedAt = iso;
      next.approvedBy = actor;

    } else if (normalizedStatus === 'rejected') {

      next.rejectedAt = iso;
      next.rejectedBy = actor;

    }

    const history = Array.isArray(next.history) ? next.history.slice() : [];

    history.push(

      normalizeAdjustmentHistoryEntry({

        action: `status.${normalizedStatus}`,

        actor,

        detail: note,

      })

    );

    next.history = clampHistory(history);
    adjustments[index] = next;
    updatedEntries.push(next);
    changed = true;

  }

  if (!changed) {

    return [];

  }

  persistAdjustments(adjustments);

  pushAuditLog({

    actor,

    action: 'kpi.adjustment.bulk-status',

    detail: `Cập nhật ${updatedEntries.length} điểm KPI (${normalizedStatus})`,

    meta: { ids: updatedEntries.map((item) => item.id), status: normalizedStatus },

  });

  return updatedEntries;

}



export function removeKpiAdjustment(id, { actor = 'system', permissions = {} } = {}) {

  if (!permissions.adjustApprove && !permissions.adjustSubmit) {

    throw new Error('Bạn không có quyền xoá điểm KPI bổ sung');

  }

  const adjustments = getAllAdjustments();

  const index = adjustments.findIndex((item) => item.id === id);

  if (index === -1) {

    return false;

  }

  const [removed] = adjustments.splice(index, 1);

  persistAdjustments(adjustments);

  pushAuditLog({

    actor,

    action: 'kpi.adjustment.delete',

    detail: `${removed.staffName || 'Chưa rõ'} - ${removed.month}`,

    meta: { id },

  });

  return true;

}



export function mapAdjustmentsByMonth(adjustments = []) {

  const list = Array.isArray(adjustments) ? adjustments : [];

  const map = new Map();

  for (const entry of list) {

    if (!entry || entry.status !== 'approved') continue;

    const month = entry.month || '';

    if (!month) continue;

    if (!map.has(month)) {

      map.set(month, []);

    }

    map.get(month).push(entry);

  }

  return map;

}



// ===== Compat layer cho cÃ¡c file khÃ¡c =====

export function getData() {           // RulesEditor.jsx Ä‘ang import

  return getDeclRows();

}

export function setData(rows, opts) { // rules.js/RulesEditor.jsx cÃ³ thá»ƒ gá»i

  return saveDeclRows(rows, { overwrite: true, ...(opts || {}) });

}



// Nháº­t kÃ½ import

function normalizeLogDeclarationList(list, limit = 200) {

  if (!Array.isArray(list) || list.length === 0) return [];

  const normalized = [];

  for (const entry of list) {

    if (!entry || typeof entry !== 'object') continue;

    const full = (entry.so_tk_full ?? entry.so_tk ?? entry.number ?? '').toString();

    const soTk = normalizeDeclarationNumber(full || entry.so_tk);

    if (!soTk) continue;

    const branch = normalizeStr(entry.nhanh || entry.branch || '');

    const fields = Array.isArray(entry.fields) ? Array.from(new Set(entry.fields.map((f) => String(f || '').trim()).filter(Boolean))) : undefined;

    normalized.push({

      so_tk: soTk,

      so_tk_full: full || undefined,

      nhanh: branch,

      branch,

      fields: fields && fields.length ? fields : undefined,

    });

    if (normalized.length >= limit) break;

  }

  return normalized;

}



export function pushImportLog(entry, extraMeta = null) {

  const LOG_KEY = 'import_logs_v1';

  const logs = safeParse(getItem(LOG_KEY), []);

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

    record = {

      ts: timestamp,

      kind,

      actor,

      msg: String(message ?? msg ?? ''),

      summary: summary && typeof summary === 'object' ? { ...summary } : summary ?? null,

      meta: meta && typeof meta === 'object' ? { ...meta } : meta ?? null,

      updatedDeclarations: normalizeLogDeclarationList(updatedDeclarations),

      insertedDeclarations: normalizeLogDeclarationList(insertedDeclarations),

      lockedDeclarations: normalizeLogDeclarationList(lockedDeclarations),

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

  const cleaned = Object.fromEntries(Object.entries(record).filter(([, value]) => Array.isArray(value) ? value.length > 0 : value !== undefined));

  logs.unshift(cleaned);

  setItem(LOG_KEY, JSON.stringify(logs.slice(0, 50)));

}



function normalizeScheduleTime(value) {

  if (typeof value === 'string') {

    const trimmed = value.trim();

    const match = trimmed.match(/^(\d{1,2}):(\d{1,2})$/);

    if (match) {

      const hours = Math.min(Math.max(parseInt(match[1], 10), 0), 23);

      const minutes = Math.min(Math.max(parseInt(match[2], 10), 0), 59);

      return {

        label: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,

        hour: hours,

        minute: minutes,

      };

    }

  }

  return { label: '08:00', hour: 8, minute: 0 };

}



function clampWeekday(value) {

  const day = Number.isFinite(Number(value)) ? Number(value) : 1;

  if (day < 1) return 1;

  if (day > 7) return 7;

  return Math.round(day);

}



function clampMonthDay(value) {

  const day = Number.isFinite(Number(value)) ? Number(value) : 1;

  if (day < 1) return 1;

  if (day > 31) return 31;

  return Math.round(day);

}



function normalizeScheduleRecipients(input) {

  const list = Array.isArray(input)

    ? input

    : typeof input === 'string'

    ? input.split(/[;,]/)

    : [];

  const seen = new Set();

  const result = [];

  for (const entry of list) {

    const value = String(entry ?? '')

      .trim()

      .replace(/[\r\n]+/g, ' ');

    if (!value) continue;

    const key = value.toLowerCase();

    if (seen.has(key)) continue;

    seen.add(key);

    result.push(value);

  }

  return result;

}



function normalizeScheduleFormats(input) {

  const list = Array.isArray(input)

    ? input

    : typeof input === 'string'

    ? input.split(/[;,]/)

    : [];

  const seen = new Set();

  const result = [];

  for (const entry of list) {

    const value = String(entry ?? '').trim().toLowerCase();

    if (!VALID_SCHEDULE_FORMATS.has(value)) continue;

    if (seen.has(value)) continue;

    seen.add(value);

    result.push(value);

  }

  if (!result.length) {

    result.push('excel');

  }

  return result;

}



export function calculateNextReportScheduleRun(schedule, { fromDate = new Date() } = {}) {

  if (!schedule || typeof schedule !== 'object') {

    return null;

  }

  if (schedule.active === false) {

    return null;

  }

  const frequency = typeof schedule.frequency === 'string' ? schedule.frequency.trim() : '';

  if (!VALID_SCHEDULE_FREQUENCIES.has(frequency)) {

    return null;

  }

  const base = fromDate instanceof Date ? new Date(fromDate) : new Date();

  if (Number.isNaN(base.getTime())) {

    return null;

  }

  const timeInfo = normalizeScheduleTime(schedule.time);

  const candidate = new Date(base.getTime());

  candidate.setSeconds(0, 0);

  candidate.setMilliseconds(0);

  if (frequency === 'weekly') {

    const targetDay = clampWeekday(schedule.dayOfWeek);

    const current = candidate.getDay() === 0 ? 7 : candidate.getDay();

    candidate.setHours(timeInfo.hour, timeInfo.minute, 0, 0);

    let diff = targetDay - current;

    if (diff < 0 || (diff === 0 && candidate <= base)) {

      diff += 7;

    }

    candidate.setDate(candidate.getDate() + diff);

    candidate.setHours(timeInfo.hour, timeInfo.minute, 0, 0);

    return candidate.toISOString();

  }

  if (frequency === 'monthly') {

    const targetDay = clampMonthDay(schedule.dayOfMonth);

    const initial = new Date(candidate.getFullYear(), candidate.getMonth(), 1, timeInfo.hour, timeInfo.minute, 0, 0);

    const daysInMonth = new Date(initial.getFullYear(), initial.getMonth() + 1, 0).getDate();

    const day = Math.min(targetDay, daysInMonth);

    initial.setDate(day);

    if (initial <= base) {

      initial.setDate(1);

      initial.setMonth(initial.getMonth() + 1);

      const nextDays = new Date(initial.getFullYear(), initial.getMonth() + 1, 0).getDate();

      initial.setDate(Math.min(targetDay, nextDays));

    }

    initial.setHours(timeInfo.hour, timeInfo.minute, 0, 0);

    return initial.toISOString();

  }

  return null;

}



function normalizeReportScheduleEntry(entry, fallback = null) {

  const base = fallback && typeof fallback === 'object' ? fallback : {};

  const raw = entry && typeof entry === 'object' ? entry : {};

  const id = String(raw.id || base.id || `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const name = String(raw.name ?? base.name ?? 'Báo cáo KPI')

    .trim()

    .slice(0, 120) || 'Báo cáo KPI';

  const rawFrequency = typeof raw.frequency === 'string' ? raw.frequency.trim() : '';

  const baseFrequency = typeof base.frequency === 'string' ? base.frequency.trim() : '';

  const frequency = VALID_SCHEDULE_FREQUENCIES.has(rawFrequency)

    ? rawFrequency

    : VALID_SCHEDULE_FREQUENCIES.has(baseFrequency)

    ? baseFrequency

    : 'weekly';

  const timeInfo = normalizeScheduleTime(raw.time ?? base.time ?? '08:00');

  const recipients = normalizeScheduleRecipients(raw.recipients ?? base.recipients ?? []);

  const formats = normalizeScheduleFormats(raw.formats ?? base.formats ?? []);

  const active = raw.active ?? base.active ?? true;

  const lastRun = typeof raw.lastRun === 'string' && raw.lastRun ? raw.lastRun : typeof base.lastRun === 'string' ? base.lastRun : '';

  let nextRun = typeof raw.nextRun === 'string' && raw.nextRun ? raw.nextRun : typeof base.nextRun === 'string' ? base.nextRun : '';



  const normalized = {

    id,

    name,

    frequency,

    time: timeInfo.label,

    dayOfWeek: frequency === 'weekly' ? clampWeekday(raw.dayOfWeek ?? base.dayOfWeek ?? 1) : null,

    dayOfMonth: frequency === 'monthly' ? clampMonthDay(raw.dayOfMonth ?? base.dayOfMonth ?? 1) : null,

    recipients,

    formats,

    active: Boolean(active),

    lastRun,

    nextRun,

  };



  if (normalized.active) {

    const upcoming = calculateNextReportScheduleRun(normalized);

    if (upcoming) {

      normalized.nextRun = upcoming;

    }

  } else {

    normalized.nextRun = '';

  }



  return normalized;

}



function readReportSchedules() {

  const stored = safeParse(getItem(REPORT_SCHEDULE_KEY), []);

  return Array.isArray(stored) ? stored.filter(Boolean) : [];

}



function writeReportSchedules(list) {

  const payload = Array.isArray(list) ? list : [];

  setItem(REPORT_SCHEDULE_KEY, JSON.stringify(payload));

  refreshSharedKeys([REPORT_SCHEDULE_KEY]);

  return payload;

}



export function getReportSchedules() {

  const stored = readReportSchedules();

  return stored.map((entry) => normalizeReportScheduleEntry(entry));

}



export function saveReportSchedule(entry, { actor = 'system' } = {}) {

  const stored = readReportSchedules();

  const normalizedId = entry && entry.id ? String(entry.id) : '';

  const index = normalizedId ? stored.findIndex((item) => item?.id === normalizedId) : -1;

  const base = index >= 0 ? stored[index] : null;

  const normalized = normalizeReportScheduleEntry(entry, base);

  if (index >= 0) {

    stored[index] = normalized;

  } else {

    stored.push(normalized);

  }

  writeReportSchedules(stored);

  pushAuditLog({

    actor,

    action: 'report.schedule.save',

    detail: `Cập nhật lịch gửi báo cáo ${normalized.name}`,

    meta: {

      scheduleId: normalized.id,

      frequency: normalized.frequency,

      formats: normalized.formats,

      active: normalized.active,

    },

  });

  return normalized;

}



export function deleteReportSchedule(id, { actor = 'system' } = {}) {

  const stored = readReportSchedules();

  const normalizedId = String(id || '').trim();

  if (!normalizedId) {

    return false;

  }

  const next = stored.filter((item) => item && item.id !== normalizedId);

  if (next.length === stored.length) {

    return false;

  }

  writeReportSchedules(next);

  pushAuditLog({

    actor,

    action: 'report.schedule.delete',

    detail: `Xoá lịch gửi báo cáo ${normalizedId}`,

    meta: { scheduleId: normalizedId },

  });

  return true;

}



// ===== K_RULES (Ä‘á»ƒ RulesEditor khÃ´ng lá»—i khi chÆ°a cÃ³ dá»¯ liá»‡u) =====

export const K_RULES = (() => {

  return safeParse(getItem(RULES_KEY), createDefaultRuleCollection());

})();

export function getRules() {

  return safeParse(getItem(RULES_KEY), createDefaultRuleCollection());

}

export function setRules(v) {

  setItem(RULES_KEY, JSON.stringify(v));

}



// ===== Nhật ký hệ thống =====



function inferAuditCategory(action) {

  if (typeof action !== "string" || !action) {

    return "khac";

  }

  const normalized = action.trim();

  const separatorIndex = normalized.indexOf(".");

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

  return text.normalize("NFC");

}



export function pushAuditLog({

  actor = "system",

  action = "unknown",

  detail = "",

  meta = null,

  category,

  result = null,

  note = null,

} = {}) {

  const entry = {

    ts: new Date().toISOString(),

    actor,

    action,

    category: category || inferAuditCategory(action),

    detail,

    result: result === null || result === undefined ? null : `${result}`.trim() || null,

    note: normalizeAuditNote(note),

    meta: meta == null ? null : shallowClone(meta),

  };

  const logs = safeParse(getItem(AUDIT_KEY), []);

  logs.unshift(entry);

  const limited = logs.slice(0, 200);

  setItem(AUDIT_KEY, JSON.stringify(limited));

  return entry;

}



export function getAuditLogs(limit = 100) {

  const logs = safeParse(getItem(AUDIT_KEY), []);

  if (!Number.isFinite(limit) || limit <= 0) return logs;

  return logs.slice(0, limit);

}



export function clearAuditLogs({ actor = "system", note = "Xóa toàn bộ nhật ký" } = {}) {

  const entry = {

    ts: new Date().toISOString(),

    actor,

    action: "audit.clear",

    category: "audit",

    detail: note,

    result: "success",

    note: normalizeAuditNote(note),

    meta: null,

  };

  setItem(AUDIT_KEY, JSON.stringify([entry]));

  return entry;

}



// ===== Default export (tuá»³ nÆ¡i dÃ¹ng)

export default {

  DECL_KEY, MST_KEY, RULES_KEY, TEAM_KEY, AUDIT_KEY, HQ_KEY, KPI_ADJUSTMENTS_KEY, DECL_HISTORY_KEY,
  DECL_DELETED_LOG_KEY, DECL_DELETED_LOG_LIMIT, DECL_SYNC_HISTORY_KEY, DECL_SYNC_QUEUE_KEY,

  normalizeStr, normalizeMST, normalizeDeclarationNumber, toISODate, normalizeName,

  isExportDecl, isExportByNumber, isImportByNumber, isExportByType, isImportByType,

  getMSTRowsRaw, getMSTMap, getMSTFor, upsertMSTRows,

  getDeclRows, saveDeclRows, saveDeclRowDiffs, softDeleteDeclRows, hardDeleteDeclRows, restoreDeclRows, markDeclRowsReviewed, unmarkDeclRowsReviewed, sortDeclRows, getRecentDeclRows,

  getDeclHistoryForRow,
  getDeclSyncHistory, subscribeDeclSyncHistory, refreshDeclSyncHistory,

  getHQAgencies, mapHQAgenciesByMST, upsertHQAgencies, saveHQAgencyRow, deleteHQAgencyRow, applyAgenciesToDeclRows,

  parseAgencyList, formatAgencyList, getHQHistoryEntries, getHQHistoryForMST,

  getTeamRoster, setTeamRoster, subscribeTeamRoster, mapMemberNamesToTeams, applyTeamRosterToMST,

  getData, setData,

  getRules, setRules, K_RULES,

  pushImportLog,

  pushAuditLog, getAuditLogs, clearAuditLogs,

  getDeletedDeclLog,

  saveMSTRow,

  IMPORT_COLUMN_IDS, IMPORT_AUX_COLUMN_IDS, IMPORT_SENSITIVE_COLUMNS,

  getImportColumnConfig, saveImportColumnConfig, subscribeImportColumnConfig,

  getCommandCenterPinnedCommands, saveCommandCenterPinnedCommands, subscribeCommandCenterPinnedCommands,

  UI_LAYOUT_KEY,

  getKpiAdjustments, saveKpiAdjustment, updateKpiAdjustmentStatus, bulkUpdateKpiAdjustmentStatus, removeKpiAdjustment, mapAdjustmentsByMonth,

  getKpiAdjustmentSettings, saveKpiAdjustmentSettings,
  getKpiAdjustmentFilterState, saveKpiAdjustmentFilterState,

  REPORT_SCHEDULE_KEY, getReportSchedules, saveReportSchedule, deleteReportSchedule, calculateNextReportScheduleRun,

};


