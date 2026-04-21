// src/lib/storeRuntime.js



import { createDefaultRuleCollection } from '../../packages/domain/src/defaultRules.js';
import { normalizeDateInput } from '../../packages/domain/src/declSearch.js';
import {
  getItem,
  setItem,
  refreshSharedKeys,
  subscribe,
  removeItem,
  patchDeclRows,
  updateCachedItem,
} from './storageClient.js';
import {
  REPORT_SCHEDULE_KEY,
  calculateNextReportScheduleRun,
  createReportScheduleStore,
} from './reportSchedules.js';
import {
  IMPORT_AUX_COLUMN_IDS,
  IMPORT_COLUMN_IDS,
  IMPORT_SENSITIVE_COLUMNS,
  configureImportColumnConfigRuntime,
} from './importColumnConfig.js';
import {
  KPI_ADJUSTMENTS_KEY,
  KPI_ADJUSTMENT_SETTINGS_KEY,
  KPI_ADJUSTMENT_STATUS_SET,
  createKpiAdjustmentStore,
} from './kpiAdjustments.js';
import {
  MST_ASSIGNMENT_STATUS,
  createMSTAssignmentStore,
} from './mstAssignments.js';
import {
  HQ_HISTORY_LIMIT,
  createHQAgencyStore,
} from './hqAgencies.js';
import {
  DECL_DELETED_LOG_KEY,
  DECL_DELETED_LOG_LIMIT,
  createDeclDeletedLogStore,
} from './declDeletedLog.js';
import {
  DECL_HISTORY_KEY,
  createDeclHistoryStore,
} from './declHistory.js';
import {
  createAuditLogStore,
} from './auditLog.js';
import {
  createRulesPersistenceStore,
} from './rulesPersistence.js';
import {
  createTeamRosterStore,
} from './teamRoster.js';
import {
  createDeclReadStore,
} from './declReadStore.js';
import {
  createDeclWriteStore,
} from './declWriteStore.js';
import {
  createDeclMutationStore,
} from './declMutationStore.js';
import {
  normalizeDeclarationNumber,
  normalizeMST,
  normalizeName,
  normalizeStr,
  safeParse,
  stripDiacritics,
} from './storeCoreHelpers.js';



export { KPI_ADJUSTMENT_CATEGORY_CONFIG } from '../../shared/kpiAdjustments.js';
export { REPORT_SCHEDULE_KEY, calculateNextReportScheduleRun };
export { IMPORT_COLUMN_IDS, IMPORT_AUX_COLUMN_IDS, IMPORT_SENSITIVE_COLUMNS };
export { MST_ASSIGNMENT_STATUS };
export { HQ_HISTORY_LIMIT };
export { DECL_DELETED_LOG_KEY, DECL_DELETED_LOG_LIMIT };
export { DECL_HISTORY_KEY };
export { KPI_ADJUSTMENT_STATUS_SET, KPI_ADJUSTMENTS_KEY, KPI_ADJUSTMENT_SETTINGS_KEY };
export { normalizeStr, normalizeName, normalizeMST, normalizeDeclarationNumber } from './storeCoreHelpers.js';



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

export const UI_LAYOUT_KEY = "ui_layout_config_v1"; // cấu hình bố cục giao diện dùng chung



const ADJUSTMENT_POINT_PRECISION = 2;

const ADJUSTMENT_POINT_FACTOR = 10 ** ADJUSTMENT_POINT_PRECISION;

export function roundAdjustmentPoint(value, precision = ADJUSTMENT_POINT_PRECISION) {

  if (!Number.isFinite(value)) return value;

  const factor =

    precision === ADJUSTMENT_POINT_PRECISION ? ADJUSTMENT_POINT_FACTOR : 10 ** precision;

  return Math.round(value * factor) / factor;

}



// ===== Helpers =====

function shallowClone(obj) {

  return JSON.parse(JSON.stringify(obj ?? null));

}



function readUILayoutConfig() {

  const stored = safeParse(getItem(UI_LAYOUT_KEY), {});

  return stored && typeof stored === "object" && !Array.isArray(stored) ? { ...stored } : {};

}



async function writeUILayoutConfig(config) {

  const target = config && typeof config === "object" && !Array.isArray(config) ? config : {};

  await setItem(UI_LAYOUT_KEY, JSON.stringify(target));

  return target;

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

  const s = (soTk ?? "").toString().replace(/\D/g, "");

  return /^30\\d{9,10}$/.test(s);

}

export function isImportByNumber(soTk) {

  const s = (soTk ?? "").toString().replace(/\D/g, "");

  return /^10\\d{9,10}$/.test(s);

}

// fallback theo loáº¡i hÃ¬nh

const EXPORT_TYPES = new Set(["B11", "B12", "B13", "E42", "E52", "E62", "E82", "G22", "G23", "G24", "G61", "H21"]);

const IMPORT_TYPES = new Set(["E11", "E13", "E15", "E21", "E31", "E41", "A11", "A12", "A41", "A42", "G13", "G12", "G51", "H11"]);

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



export function getMSTRowsRaw() {

  return mstAssignmentStore.getMSTRowsRaw();

}



export function getMSTMap() {

  return mstAssignmentStore.getMSTMap();

}



export function upsertMSTRows(rows, options) {

  return mstAssignmentStore.upsertMSTRows(rows, options);

}



export function saveMSTRow(rowInput, options) {

  return mstAssignmentStore.saveMSTRow(rowInput, options);

}



export function getMSTHistoryEntries(limit) {

  return mstAssignmentStore.getMSTHistoryEntries(limit);

}



export function getMSTHistoryFor(mst, limit = 20) {

  return mstAssignmentStore.getMSTHistoryFor(mst, limit);

}



/** Lay nguoi phu trach theo MST & ngay hieu luc gan nhat (<= ngay to khai) */

export function getMSTFor(mst, isoDate) {

  return mstAssignmentStore.getMSTFor(mst, isoDate);

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



function getDeclRowsRaw() {
  return declReadStore.getDeclRowsRaw();
}



function writeDeclRows(rows) {

  const normalized = normalizeDeclRows(rows);

  setItem(DECL_KEY, JSON.stringify(normalized));

  return normalized;

}



export function getDeclRows() {
  return declReadStore.getDeclRows();
}



export async function refreshDeclRowsFromServer(options = {}) {
  return declReadStore.refreshDeclRowsFromServer(options);
}



export function sortDeclRows(rows) {
  return declReadStore.sortDeclRows(rows);
}



export function getRecentDeclRows(limit = 20) {
  return declReadStore.getRecentDeclRows(limit);
}



// ===== Team roster (to doi) =====

export function getTeamRoster() {
  return teamRosterStore.getTeamRoster();
}

export function subscribeTeamRoster(listener) {
  return teamRosterStore.subscribeTeamRoster(listener);
}

export function setTeamRoster(next, options = {}) {
  return teamRosterStore.setTeamRoster(next, options);
}

export function mapMemberNamesToTeams(source) {
  return teamRosterStore.mapMemberNamesToTeams(source);
}

export function applyTeamRosterToMST(rosterLike, rows, options = {}) {
  return teamRosterStore.applyTeamRosterToMST(rosterLike, rows, options);
}



// ===== Đại lý Hải quan (MST -> tên công ty & đại lý) =====

export function getHQAgenciesRaw() {
  return hqAgencyStore.getHQAgenciesRaw();
}



export function parseAgencyList(value) {
  return hqAgencyStore.parseAgencyList(value);
}



export function formatAgencyList(list) {
  return hqAgencyStore.formatAgencyList(list);
}



export function getHQAgencies() {
  return hqAgencyStore.getHQAgencies();
}



export function mapHQAgenciesByMST() {
  return hqAgencyStore.mapHQAgenciesByMST();
}



export function upsertHQAgencies(rows, { actor = "system", detail = "" } = {}) {
  return hqAgencyStore.upsertHQAgencies(rows, { actor, detail });
}



export function saveHQAgencyRow(row, { actor = "system", previousMst = "", detail = "" } = {}) {
  return hqAgencyStore.saveHQAgencyRow(row, { actor, previousMst, detail });
}



export function deleteHQAgencyRow(mst, { actor = "system", detail = "" } = {}) {
  return hqAgencyStore.deleteHQAgencyRow(mst, { actor, detail });
}





export function applyAgenciesToDeclRows(rows, agencyMapParam = null) {
  return hqAgencyStore.applyAgenciesToDeclRows(rows, agencyMapParam);
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



async function persistAndAnnotateDeclRows(rows) {

  const normalized = writeDeclRows(rows);

  const annotated = applyAgenciesToDeclRows(normalized);

  const changed =

    annotated.length !== normalized.length ||

    annotated.some((row, idx) => row !== normalized[idx]);



  if (changed) {

    await setItem(DECL_KEY, JSON.stringify(annotated));

    return annotated;

  }



  return normalized;

}



export function previewDeclRows(newRows, { overwrite = false, actor = "system" } = {}) {
  return declWriteStore.previewDeclRows(newRows, { overwrite, actor });

}



export async function saveDeclRows(
  newRows,
  { overwrite = false, actor = "system", detail = "", allowReviewedOverride = false } = {}
) {
  return declWriteStore.saveDeclRows(newRows, {
    overwrite,
    actor,
    detail,
    allowReviewedOverride,
  });

}



export async function saveDeclRowDiffs(
  deltas,
  { actor = "system", detail = "", allowReviewedOverride = false } = {}
) {
  return declMutationStore.saveDeclRowDiffs(deltas, {
    actor,
    detail,
    allowReviewedOverride,
  });
}



export async function updateDeclRowFields(
  rowKey,
  updates,
  { actor = "system", detail = "", allowReviewedOverride = false } = {}
) {
  return declMutationStore.updateDeclRowFields(rowKey, updates, {
    actor,
    detail,
    allowReviewedOverride,
  });
}

export async function softDeleteDeclRows(keys, { actor = "system", detail = "" } = {}) {
  return declMutationStore.softDeleteDeclRows(keys, { actor, detail });
}

export async function hardDeleteDeclRows(keys, { actor = "system", detail = "" } = {}) {
  return declMutationStore.hardDeleteDeclRows(keys, { actor, detail });
}

export async function restoreDeclRows(keys, { actor = "system", detail = "" } = {}) {
  return declMutationStore.restoreDeclRows(keys, { actor, detail });
}

export async function markDeclRowsReviewed(keys, { actor = "system", note = "Đánh dấu rà soát" } = {}) {
  return declMutationStore.markDeclRowsReviewed(keys, { actor, note });
}



export async function unmarkDeclRowsReviewed(keys, { actor = "system", note = "Bỏ đánh dấu rà soát" } = {}) {
  return declMutationStore.unmarkDeclRowsReviewed(keys, { actor, note });
}



export function getHQHistoryEntries(limit = HQ_HISTORY_LIMIT) {
  return hqAgencyStore.getHQHistoryEntries(limit);
}



export function getHQHistoryForMST(mst, limit = 50) {
  return hqAgencyStore.getHQHistoryForMST(mst, limit);
}





// ===== Compat layer cho cÃ¡c file khÃ¡c =====

export function getData() {           // RulesEditor.jsx Ä‘ang import
  return declReadStore.getData();
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



// ===== K_RULES (Ä‘á»ƒ RulesEditor khÃ´ng lá»—i khi chÆ°a cÃ³ dá»¯ liá»‡u) =====

const rulesPersistenceStore = createRulesPersistenceStore({
  getItem,
  setItem,
  safeParse,
  createDefaultRuleCollection,
  rulesKey: RULES_KEY,
});

export const K_RULES = (() => {

  return rulesPersistenceStore.getRules();

})();

export function getRules() {

  return rulesPersistenceStore.getRules();

}

export function setRules(v) {

  rulesPersistenceStore.setRules(v);

}



// ===== Nhật ký hệ thống =====

const auditLogStore = createAuditLogStore({
  getItem,
  setItem,
  safeParse,
  shallowClone,
  auditKey: AUDIT_KEY,
});

export function pushAuditLog(entry) {

  return auditLogStore.pushAuditLog(entry);

}



const reportScheduleStore = createReportScheduleStore({
  getItem,
  setItem,
  refreshSharedKeys,
  pushAuditLog,
});

const importColumnConfigStore = configureImportColumnConfigRuntime({
  readUILayoutConfig,
  writeUILayoutConfig,
  subscribeKey: subscribe,
  pushAuditLog,
  uiLayoutKey: UI_LAYOUT_KEY,
});
const kpiAdjustmentStore = createKpiAdjustmentStore({
  getItem,
  setItem,
  refreshSharedKeys,
  pushAuditLog,
  normalizeStr,
  normalizeMST,
  roundAdjustmentPoint,
});
const mstAssignmentStore = createMSTAssignmentStore({
  getItem,
  setItem,
  removeItem,
  pushAuditLog,
  normalizeStr,
  normalizeMST,
  normalizeName,
  toISODate,
  pickFirstValue,
  safeParse,
  mstKey: MST_KEY,
  legacyMstKey: LEGACY_MST_KEY,
  mstHistoryKey: MST_HISTORY_KEY,
});
const teamRosterStore = createTeamRosterStore({
  getItem,
  setItem,
  subscribe,
  pushAuditLog,
  safeParse,
  normalizeStr,
  stripDiacritics,
  normalizeName,
  sanitizeMSTRow: mstAssignmentStore.sanitizeMSTRow,
  teamKey: TEAM_KEY,
});
const hqAgencyStore = createHQAgencyStore({
  getItem,
  setItem,
  pushAuditLog,
  normalizeStr,
  normalizeMST,
  safeParse,
  getMSTMap,
  upsertMSTRows,
  getDeclRows,
  saveDeclRows,
  hqKey: HQ_KEY,
  hqHistoryKey: HQ_HISTORY_KEY,
});
const declReadStore = createDeclReadStore({
  getItem,
  setItem,
  refreshSharedKeys,
  normalizeDeclRows,
  applyAgenciesToDeclRows: (...args) => hqAgencyStore.applyAgenciesToDeclRows(...args),
  declKey: DECL_KEY,
});
const declWriteStore = createDeclWriteStore({
  normalizeDeclRows,
  getDeclRowsRaw,
  getDeclarationKey,
  extractMSTFromDeclRow,
  extractCompanyNameFromDeclRow,
  extractEffectiveDateFromDeclRow,
  getMSTMap,
  upsertMSTRows,
  mstAssignmentStatusPending: MST_ASSIGNMENT_STATUS.PENDING,
  persistAndAnnotateDeclRows,
  pushAuditLog,
  mergeDeclarationRowClient,
});
const declDeletedLogStore = createDeclDeletedLogStore({
  getItem,
  setItem,
  normalizeStr,
  normalizeDeclarationNumber,
  normalizeDateInput,
  safeParse,
  deletedLogKey: DECL_DELETED_LOG_KEY,
  deletedLogLimit: DECL_DELETED_LOG_LIMIT,
});
const declHistoryStore = createDeclHistoryStore({
  getItem,
  setItem,
  normalizeStr,
  safeParse,
  historyKey: DECL_HISTORY_KEY,
});
const declMutationStore = createDeclMutationStore({
  getDeclRowsRaw,
  patchDeclRows,
  applyAgenciesToDeclRows,
  updateCachedItem,
  declKey: DECL_KEY,
  pushAuditLog,
  pushImportLog,
  persistAndAnnotateDeclRows,
  writeDeclRows,
  buildDeclHistoryChanges: (...args) => declHistoryStore.buildDeclHistoryChanges(...args),
  appendDeclHistoryEntry: (...args) => declHistoryStore.appendDeclHistoryEntry(...args),
  buildDeletedDeclLogEntryFromRow: (...args) => declDeletedLogStore.buildDeletedDeclLogEntryFromRow(...args),
  appendDeletedDeclLogEntries: (...args) => declDeletedLogStore.appendDeletedDeclLogEntries(...args),
});

export function getDeletedDeclLog(options = {}) {
  return declDeletedLogStore.getDeletedDeclLog(options);
}

export function getDeclHistoryForRow(rowKey, limit) {
  return declHistoryStore.getDeclHistoryForRow(rowKey, limit);
}

export function getKpiAdjustmentSettings() {

  return kpiAdjustmentStore.getKpiAdjustmentSettings();

}



export function saveKpiAdjustmentSettings(patch, options) {

  return kpiAdjustmentStore.saveKpiAdjustmentSettings(patch, options);

}



export function getKpiAdjustments() {

  return kpiAdjustmentStore.getKpiAdjustments();

}



export function saveKpiAdjustment(entry, options) {

  return kpiAdjustmentStore.saveKpiAdjustment(entry, options);

}



export function updateKpiAdjustmentStatus(id, status, options) {

  return kpiAdjustmentStore.updateKpiAdjustmentStatus(id, status, options);

}



export function removeKpiAdjustment(id, options) {

  return kpiAdjustmentStore.removeKpiAdjustment(id, options);

}



export function mapAdjustmentsByMonth(adjustments = []) {

  return kpiAdjustmentStore.mapAdjustmentsByMonth(adjustments);

}

export function getImportColumnConfig() {

  return importColumnConfigStore.getImportColumnConfig();

}



export function saveImportColumnConfig(config, options) {

  return importColumnConfigStore.saveImportColumnConfig(config, options);

}



export function subscribeImportColumnConfig(listener) {

  return importColumnConfigStore.subscribeImportColumnConfig(listener);

}

export function getReportSchedules() {

  return reportScheduleStore.getReportSchedules();

}



export function saveReportSchedule(entry, options) {

  return reportScheduleStore.saveReportSchedule(entry, options);

}



export function deleteReportSchedule(id, options) {

  return reportScheduleStore.deleteReportSchedule(id, options);

}



export function getAuditLogs(limit = 100) {

  return auditLogStore.getAuditLogs(limit);

}



export function clearAuditLogs(options = {}) {

  return auditLogStore.clearAuditLogs(options);

}



// ===== Default export (tuá»³ nÆ¡i dÃ¹ng)

export default {

  DECL_KEY, MST_KEY, RULES_KEY, TEAM_KEY, AUDIT_KEY, HQ_KEY, KPI_ADJUSTMENTS_KEY, DECL_HISTORY_KEY,
  DECL_DELETED_LOG_KEY, DECL_DELETED_LOG_LIMIT,

  normalizeStr, normalizeMST, normalizeDeclarationNumber, toISODate, normalizeName,

  isExportDecl, isExportByNumber, isImportByNumber, isExportByType, isImportByType,

  getMSTRowsRaw, getMSTMap, getMSTFor, upsertMSTRows,

  getDeclRows, saveDeclRows, saveDeclRowDiffs, softDeleteDeclRows, hardDeleteDeclRows, restoreDeclRows, markDeclRowsReviewed, unmarkDeclRowsReviewed, sortDeclRows, getRecentDeclRows,

  getDeclHistoryForRow,

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

  UI_LAYOUT_KEY,

  getKpiAdjustments, saveKpiAdjustment, updateKpiAdjustmentStatus, removeKpiAdjustment, mapAdjustmentsByMonth,

  getKpiAdjustmentSettings, saveKpiAdjustmentSettings,

  REPORT_SCHEDULE_KEY, getReportSchedules, saveReportSchedule, deleteReportSchedule, calculateNextReportScheduleRun,

};


