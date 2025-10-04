const DEFAULT_NON_CO_CODES = Object.freeze(["B01", "B03", "B30", "B02"]);
let preferentialCodeConfig = {
  whitelist: null,
  blacklist: new Set(DEFAULT_NON_CO_CODES),
};
const DIRECT_TRUE_VALUES = new Set(["CO", "CÓ", "YES", "TRUE", "1", "X", "AVAILABLE", "HAS"]);
const DIRECT_FALSE_VALUES = new Set(["KHÔNG", "NO", "FALSE", "0", "", "NONE"]);

const CO_LINE_KEY_PATTERNS = new Set([
  "colinecount",
  "colines",
  "coline",
  "co_lines",
  "coitems",
  "coitem",
  "co_count",
  "cocount",
  "co_dong",
  "codong",
  "donghangapco",
  "donghangco",
  "so_dong_co",
  "sodongco",
  "so_dong_ap_co",
  "sodongapco",
]);

function normalizeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeCode(code) {
  const normalized = normalizeString(code).toUpperCase();
  return normalized.replace(/[^A-Z0-9]/g, "");
}

function normalizeCodeList(input) {
  if (!Array.isArray(input)) return new Set();
  const set = new Set();
  for (const item of input) {
    const normalized = normalizeCode(item);
    if (!normalized) continue;
    set.add(normalized);
  }
  return set;
}

export function setPreferentialCodeConfig({ whitelist = [], blacklist = [] } = {}) {
  const whitelistSet = normalizeCodeList(whitelist);
  const blacklistSet = normalizeCodeList(blacklist);
  preferentialCodeConfig = {
    whitelist: whitelistSet.size > 0 ? whitelistSet : null,
    blacklist: blacklistSet.size > 0 ? blacklistSet : new Set(DEFAULT_NON_CO_CODES),
  };
}

export function getPreferentialCodeConfig() {
  const { whitelist, blacklist } = preferentialCodeConfig;
  return {
    whitelist: Array.from(whitelist ?? []),
    blacklist: Array.from(blacklist ?? []),
  };
}

function isPreferentialCode(code) {
  const normalized = normalizeCode(code);
  if (!normalized) return false;
  const { whitelist, blacklist } = preferentialCodeConfig;
  if (whitelist && whitelist.size > 0) {
    return whitelist.has(normalized);
  }
  return !blacklist.has(normalized);
}

function normalizeKey(value) {
  return normalizeString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toLowerCase();
}

export function parseCoLineCount(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return 0;
    const match = text.replace(/,/g, ".").match(/-?\d+(?:\.\d+)?/);
    if (!match) return 0;
    const num = Number(match[0]);
    return Number.isFinite(num) && num > 0 ? Math.round(num) : 0;
  }
  if (Array.isArray(value)) {
    let total = 0;
    for (const item of value) {
      total += parseCoLineCount(item);
    }
    return total;
  }
  if (typeof value === "object") {
    const candidate = value.count ?? value.total ?? value.value ?? value.lines ?? value.co ?? null;
    if (candidate !== null && candidate !== undefined) {
      return parseCoLineCount(candidate);
    }
  }
  return 0;
}

function readCoLineCount(record) {
  if (!record || typeof record !== "object") return 0;
  for (const [key, value] of Object.entries(record)) {
    const normalized = normalizeKey(key);
    if (!normalized) continue;
    if (CO_LINE_KEY_PATTERNS.has(normalized)) {
      const parsed = parseCoLineCount(value);
      if (parsed > 0) return parsed;
    }
  }
  return 0;
}

function extractCodesFromString(raw, collector) {
  if (!raw) return;
  const text = raw.toString();
  // XML tags <TS_XNK_MA_BT>CODE</TS_XNK_MA_BT>
  for (const match of text.matchAll(/<TS_XNK_MA_BT[^>]*>([^<]+)<\/TS_XNK_MA_BT>/gi)) {
    collector(normalizeCode(match[1]));
  }
  // Generic uppercase codes separated by punctuation/newlines
  for (const part of text.split(/[\s,;|]+/g)) {
    if (/TS_XNK_MA_BT/i.test(part)) continue;
    collector(normalizeCode(part));
  }
}

function extractCodes(value, collector, seen = new Set()) {
  if (value === null || value === undefined) return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) extractCodes(item, collector, seen);
    return;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      const lower = key.toLowerCase();
      if (lower.includes("ma_bt") || lower.includes("bieu_thue") || lower.includes("co")) {
        extractCodes(value[key], collector, seen);
      }
    }
    return;
  }
  extractCodesFromString(String(value), collector);
}

function detectDirectFlag(raw) {
  const text = normalizeString(raw);
  if (!text) return null;
  const upper = text.toUpperCase();
  if (DIRECT_TRUE_VALUES.has(upper)) return true;
  if (DIRECT_FALSE_VALUES.has(upper)) return false;
  if (/^C[O0]$/i.test(text)) return true;
  if (/^(CO\s*C\/?O|CO AVAILABLE)$/i.test(text)) return true;
  return null;
}

const CODE_FIELD_CANDIDATES = [
  "ma_bieu_thue_xnk",
  "ma_bieu_thue",
  "ma_bt",
  "ts_xnk_ma_bt",
  "ma_bieu_thue hang",
  "mã biểu thuế xnk",
  "ma bieu thue xnk",
  "ma_bieu_thue_ct",
  "ma_bieu_thue_chi_tiet",
  "co_codes",
  "co_list",
  "co_details",
  "ma bt xnk",
];

const DIRECT_STATUS_KEYS = [
  "co",
  "co_status",
  "co_flag",
  "co_available",
  "has_co",
  "co?",
  "co_status_text",
  "co_status_vi",
];

function scanRecordForCodes(record, collector) {
  if (!record || typeof record !== "object") return;
  for (const [key, value] of Object.entries(record)) {
    const lower = key.toLowerCase();
    if (DIRECT_STATUS_KEYS.includes(lower)) {
      const flag = detectDirectFlag(value);
      if (flag === true) collector("CO");
      if (flag === false) collector("B01");
    }
    if (CODE_FIELD_CANDIDATES.includes(lower) || lower.includes("ma_bt") || lower.includes("bieu_thue")) {
      extractCodes(value, collector);
    }
    if (typeof value === "string" && /<TS_XNK_MA_BT/i.test(value)) {
      extractCodes(value, collector);
    }
    if (Array.isArray(value) || (value && typeof value === "object")) {
      scanRecordForCodes(value, collector);
    }
  }
}

export function evaluateCOFromRecord(record) {
  const codes = new Set();
  const collector = (code) => {
    if (!code) return;
    codes.add(code);
  };
  scanRecordForCodes(record, collector);
  const preferential = Array.from(codes).filter((code) => isPreferentialCode(code));
  const hasCO = preferential.length > 0;
  return {
    hasCO,
    codes: Array.from(codes).filter(Boolean),
    matched: preferential,
    lineCount: preferential.length,
  };
}

export function deriveCOStatus(record, existing = {}) {
  const evaluation = evaluateCOFromRecord(record);
  const existingCount = readCoLineCount(existing);
  const recordCount = readCoLineCount(record);
  const evaluationCount = evaluation.lineCount || 0;
  const coLineCount = Math.max(existingCount, recordCount, evaluationCount);
  const hasCO = evaluation.hasCO || existing.has_co || existing.co === "Có" || coLineCount > 0;
  const label = hasCO ? "Có" : "";
  return {
    ...existing,
    co: label,
    has_co: !!hasCO,
    co_codes: evaluation.codes,
    co_line_count: coLineCount,
  };
}

export function coLabel(row) {
  if (!row) return "";
  const lines = coLineCount(row);
  if (lines > 0) return String(lines);
  if (typeof row.co === "string" && row.co.trim()) return row.co.trim();
  if (row.has_co) return "Có";
  return "";
}

export function coLineCount(row) {
  if (!row || typeof row !== "object") return 0;
  const direct = readCoLineCount(row);
  if (direct > 0) return direct;
  const codes = Array.isArray(row.co_codes) ? row.co_codes : [];
  if (codes.length) {
    const matched = new Set();
    for (const code of codes) {
      const normalized = normalizeCode(code);
      if (!normalized || !isPreferentialCode(normalized)) continue;
      matched.add(normalized);
    }
    if (matched.size > 0) return matched.size;
  }
  return 0;
}
