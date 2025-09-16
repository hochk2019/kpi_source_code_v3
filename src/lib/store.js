// src/lib/store.js

// ===== Keys in localStorage =====
export const DECL_KEY  = "decl_rows_v1";   // dữ liệu tờ khai
export const MST_KEY   = "mst_rows_v2";    // gán MST -> nhân viên/team/effective_from
export const RULES_KEY = "kpi_rules_v2";   // quy tắc KPI

// ===== Helpers =====
function safeParse(json, fallback) {
  try { const v = JSON.parse(json); return v ?? fallback; } catch { return fallback; }
}

// Chuẩn hoá chuỗi (trim + bỏ khoảng trắng thừa)
export function normalizeStr(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}

// MST: giữ dạng chuỗi số, bỏ mọi ký tự không phải số
export function normalizeMST(mst) {
  return (mst ?? "").toString().replace(/\D/g, "");
}

// dd/mm/yyyy -> yyyy-mm-dd ; nếu đã yyyy-mm-dd thì giữ nguyên
export function toISODate(d) {
  const s = normalizeStr(d);
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!m) return "";
  let [_, dd, mm, yyyy] = m;
  if (yyyy.length === 2) yyyy = "20" + yyyy;
  return `${yyyy.padStart(4,"0")}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
}

// ===== Quy tắc xác định Nhập/Xuất =====
// 30xxxxxxxxxxx -> xuất; 10xxxxxxxxxxx -> nhập
export function isExportByNumber(soTk) {
  const s = (soTk ?? "").toString().replace(/\D/g,"");
  return /^30\d{10}$/.test(s);
}
export function isImportByNumber(soTk) {
  const s = (soTk ?? "").toString().replace(/\D/g,"");
  return /^10\d{10}$/.test(s);
}
// fallback theo loại hình
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
  return false; // không rõ thì coi là nhập
}

// ===== MST map (gán nhân viên theo ngày hiệu lực) =====
export function getMSTRowsRaw() {
  return safeParse(localStorage.getItem(MST_KEY), []);
}

function sanitizeMSTRow(row) {
  const mst = normalizeMST(row?.mst);
  if (!mst) return null;

  return {
    mst,
    company: normalizeStr(row?.company ?? ""),
    person_import: normalizeStr(row?.person_import ?? ""),
    person_export: normalizeStr(row?.person_export ?? ""),
    team: normalizeStr(row?.team ?? ""),
    effective_from: toISODate(row?.effective_from) || "",
  };
}

/** Lấy toàn bộ bảng gán MST, đã chuẩn hoá + sắp xếp */
export function getMSTMap() {
  const raw = getMSTRowsRaw();
  const rows = Array.isArray(raw) ? raw : [];
  return rows
    .map(sanitizeMSTRow)
    .filter(Boolean)
    .sort((a, b) => {
      const byMST = a.mst.localeCompare(b.mst);
      if (byMST !== 0) return byMST;
      return (a.effective_from || "").localeCompare(b.effective_from || "");
    });
}

/** Ghi đè/bổ sung bảng gán MST (đã chuẩn hoá dữ liệu đầu vào) */
export function upsertMSTRows(rows) {
  const sanitized = Array.isArray(rows)
    ? rows.map(sanitizeMSTRow).filter(Boolean)
    : [];
  sanitized.sort((a, b) => {
    const byMST = a.mst.localeCompare(b.mst);
    if (byMST !== 0) return byMST;
    return (a.effective_from || "").localeCompare(b.effective_from || "");
  });
  localStorage.setItem(MST_KEY, JSON.stringify(sanitized));
  return sanitized.length;
}

/** Lấy người phụ trách theo MST & ngày hiệu lực gần nhất (<= ngày tờ khai) */
export function getMSTFor(mst, isoDate) {
  const rows = getMSTMap().filter(r => normalizeMST(r.mst) === normalizeMST(mst));
  if (rows.length === 0) return null;

  const dateVal = isoDate ? new Date(isoDate).getTime() : Number.POSITIVE_INFINITY;

  // Xếp theo hiệu lực gần nhất với ngày TK
  const picked = rows
    .map(r => {
      const ef = r.effective_from || "0001-01-01";
      const ts = new Date(ef).getTime();
      const rank = ts <= dateVal ? (dateVal - ts) : Number.POSITIVE_INFINITY - ts;
      return { r, rank };
    })
    .sort((a,b) => a.rank - b.rank)[0];

  return picked?.r ?? rows[0];
}

// ===== DECL rows (tờ khai) =====
export function getDeclRows() {
  return safeParse(localStorage.getItem(DECL_KEY), []);
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
      if (a.ts !== b.ts) return b.ts - a.ts; // mới nhất trước

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

      return b.idx - a.idx; // giữ thứ tự chèn gần nhất
    })
    .map(item => item.row);
}

export function getRecentDeclRows(limit = 20) {
  const sorted = sortDeclRows(getDeclRows());
  if (!Number.isFinite(limit) || limit <= 0) return sorted;
  return sorted.slice(0, limit);
}

/** Lưu tờ khai:
 * - overwrite=true: ghi đè toàn bộ
 * - overwrite=false: merge theo key "so_tk + '_' + (nhanh||'')"
 */
export function saveDeclRows(newRows, { overwrite = false } = {}) {
  const cleaned = Array.isArray(newRows) ? newRows : [];
  if (overwrite) {
    localStorage.setItem(DECL_KEY, JSON.stringify(cleaned));
    return cleaned.length;
  }
  const cur = getDeclRows();
  const map = new Map();
  const keyOf = (r) => `${(r.so_tk ?? "").toString()}_${normalizeStr(r.nhanh)}`;

  for (const r of cur) map.set(keyOf(r), r);
  for (const r of cleaned) map.set(keyOf(r), r);

  const merged = Array.from(map.values());
  localStorage.setItem(DECL_KEY, JSON.stringify(merged));
  return merged.length;
}

// ===== Compat layer cho các file khác =====
export function getData() {           // RulesEditor.jsx đang import
  return getDeclRows();
}
export function setData(rows, opts) { // rules.js/RulesEditor.jsx có thể gọi
  return saveDeclRows(rows, { overwrite: true, ...(opts || {}) });
}

// Nhật ký import
export function pushImportLog(msg) {
  const LOG_KEY = "import_logs_v1";
  const a = safeParse(localStorage.getItem(LOG_KEY), []);
  a.unshift({ ts: new Date().toISOString(), msg });
  localStorage.setItem(LOG_KEY, JSON.stringify(a.slice(0,50)));
}

// ===== K_RULES (để RulesEditor không lỗi khi chưa có dữ liệu) =====
export const K_RULES = safeParse(localStorage.getItem(RULES_KEY), {
  version: 1,
  points: { base: 1 },
});
export function getRules() {
  return safeParse(localStorage.getItem(RULES_KEY), K_RULES);
}
export function setRules(v) {
  localStorage.setItem(RULES_KEY, JSON.stringify(v));
}

// ===== Default export (tuỳ nơi dùng)
export default {
  DECL_KEY, MST_KEY, RULES_KEY,
  normalizeStr, normalizeMST, toISODate,
  isExportDecl, isExportByNumber, isImportByNumber, isExportByType, isImportByType,
  getMSTRowsRaw, getMSTMap, getMSTFor, upsertMSTRows,

  getDeclRows, saveDeclRows, sortDeclRows, getRecentDeclRows,
  getData, setData,

  getDeclRows, saveDeclRows,
  getData, setData,

  getRules, setRules, K_RULES,
  pushImportLog,
};
