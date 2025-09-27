const NON_CO_CODES = new Set(["B01", "B03", "B30"]);
const DIRECT_TRUE_VALUES = new Set(["CO", "CÓ", "YES", "TRUE", "1", "X", "AVAILABLE", "HAS"]);
const DIRECT_FALSE_VALUES = new Set(["KHÔNG", "NO", "FALSE", "0", "", "NONE"]);

function normalizeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeCode(code) {
  const normalized = normalizeString(code).toUpperCase();
  return normalized.replace(/[^A-Z0-9]/g, "");
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
  const filtered = Array.from(codes).filter((code) => code && !NON_CO_CODES.has(code));
  const hasCO = filtered.length > 0;
  return {
    hasCO,
    codes: Array.from(codes).filter(Boolean),
    matched: filtered,
  };
}

export function deriveCOStatus(record, existing = {}) {
  const evaluation = evaluateCOFromRecord(record);
  const hasCO = evaluation.hasCO || existing.has_co || existing.co === "Có";
  const label = hasCO ? "Có" : "";
  return {
    ...existing,
    co: label,
    has_co: !!hasCO,
    co_codes: evaluation.codes,
  };
}

export function coLabel(row) {
  if (!row) return "";
  if (typeof row.co === "string" && row.co.trim()) return row.co.trim();
  if (row.has_co) return "Có";
  return "";
}
