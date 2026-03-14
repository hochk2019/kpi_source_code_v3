import {
  IMPORT_COLUMN_IDS,
  IMPORT_SENSITIVE_COLUMNS,
  normalizeMST,
} from "@/lib/store.js";

export const DECL_HISTORY_FIELD_LABELS = Object.freeze({
  nhan_vien: "Nhân viên",
  team: "Tổ đội",
  agency: "Đại lý",
  dai_ly: "Đại lý",
  licenses: "Số lượng giấy phép",
  so_luong_gp: "Số lượng giấy phép",
  licenseManualCount: "Số lượng giấy phép (thủ công)",
});

export const DECL_HISTORY_ENTRY_LIMIT = 15;

export const IMPORT_TABLE_COLUMN_LABELS = Object.freeze({
  date: "Ngày",
  declaration: "Số tờ khai",
  mst: "MST",
  company: "Công ty",
  type: "Loại hình",
  co: "C/O",
  items: "Mục hàng",
  staff: "Nhân viên",
  team: "Tổ đội",
  agency: "Đại lý",
  status: "Trạng thái",
  licenses: "Số lượng GP",
  kpi: "KPI",
});

export const IMPORT_TABLE_COLUMNS = Object.freeze(
  IMPORT_COLUMN_IDS.map((id) => ({
    id,
    label: IMPORT_TABLE_COLUMN_LABELS[id] || id,
  })),
);

export const AUX_COLUMN_LABELS = Object.freeze({
  history: "Nhật ký",
  update: "Cập nhật",
});

export const AUX_COLUMN_OPTIONS = Object.freeze(
  Object.entries(AUX_COLUMN_LABELS).map(([id, label]) => ({ id, label })),
);

export const COLUMN_CONFIG_OPTIONS = Object.freeze([
  ...IMPORT_TABLE_COLUMNS,
  ...AUX_COLUMN_OPTIONS,
]);

export const SENSITIVE_COLUMN_SET = new Set(IMPORT_SENSITIVE_COLUMNS);

export function isConfigColumnKey(key) {
  if (typeof key !== "string") return false;
  if (IMPORT_TABLE_COLUMN_LABELS[key]) return true;
  if (AUX_COLUMN_LABELS[key]) return true;
  return false;
}

export const IMPORT_ERROR_REASON_LABELS = Object.freeze({
  "missing-key": "Thiếu Số tờ khai hoặc nhánh tờ khai",
  unknown: "Không xác định",
});

export const FROZEN_COLUMN_KEYS = Object.freeze(["date", "declaration", "mst"]);

export const FROZEN_COLUMN_WIDTHS = Object.freeze({
  selection: 44,
  date: 120,
  declaration: 180,
  mst: 120,
});

export const MIN_COLUMN_WIDTH = 80;

export const VALID_COLUMN_WIDTH_KEYS = new Set([
  ...Object.keys(IMPORT_TABLE_COLUMN_LABELS),
  ...Object.keys(AUX_COLUMN_LABELS),
]);

export function clampColumnWidth(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return MIN_COLUMN_WIDTH;
  }
  return Math.max(MIN_COLUMN_WIDTH, Math.round(numeric));
}

export function sanitizeColumnWidths(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const result = {};
  for (const [key, value] of Object.entries(input)) {
    if (!VALID_COLUMN_WIDTH_KEYS.has(key)) {
      continue;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      continue;
    }
    result[key] = clampColumnWidth(numeric);
  }
  return result;
}

export function areWidthMapsEqual(a = {}, b = {}) {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) {
    return false;
  }
  for (const key of keysA) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}

export const VIEW_MODE_STORAGE_KEY = "dataImporter:viewMode";

export const VIEW_MODES = Object.freeze({
  TABLE: "table",
  CARD: "card",
});

export const FREEZE_COLUMNS_STORAGE_KEY = "dataImporter:freezeColumns";
export const GRID_COLUMNS_STORAGE_KEY = "dataImporter:gridColumns";
export const CARD_GRID_COLUMN_OPTIONS = Object.freeze([1, 2, 3]);
export const DEFAULT_CARD_GRID_COLUMNS = 2;
export const CARD_GRID_MIN_WIDTH = 320;
export const SERVER_SEARCH_THRESHOLD = 5000;
export const SERVER_SEARCH_MAX_PAGE_SIZE = 200;
export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];
export const PAGE_SIZE_STORAGE_KEY = "kpi:data-importer:page-size-v1";

export const CO_FILTER_OPTIONS = Object.freeze([
  { value: "all", label: "Tất cả C/O" },
  { value: "has", label: "Có C/O (≥ 1 dòng)" },
  { value: "min", label: "Tùy chọn số dòng C/O" },
]);

export function parseMstListInput(value) {
  if (!value && value !== 0) return [];

  const tokens = Array.isArray(value) ? value : `${value}`.split(/[;\n\r]+/u);
  const set = new Set();
  for (const token of tokens) {
    const normalized = normalizeMST(token);
    if (normalized) {
      set.add(normalized);
    }
  }
  return Array.from(set);
}

export function formatMstListForInput(list) {
  if (!Array.isArray(list)) return "";
  return list.filter(Boolean).join("\n");
}

export const DEFAULT_SYNC_CONFIG = Object.freeze({
  enabled: false,
  schedule: "0 * * * *",
  rangeDays: 1,
  preferMonthFirst: false,
  includeTaxCodes: [],
  excludeTaxCodes: [],
  connection: {
    server: "",
    database: "",
    user: "",
    hasPassword: false,
  },
  lastRun: null,
  lastStatus: null,
});

export const RANGE_PRESETS = Object.freeze([
  { label: "1 ngày gần nhất", days: 1 },
  { label: "3 ngày", days: 3 },
  { label: "7 ngày", days: 7 },
  { label: "30 ngày", days: 30 },
]);

export const FILTER_PRESET_SCOPE = "data-importer";
export const LAST_FILTER_PRESET_KEY = "kpi:data-importer:last-preset-v1";
export const LEGACY_FILTER_STORAGE_KEY = "kpi:data-importer:filter:v1";

export const DUPLICATE_MERGE_FIELDS = Object.freeze([
  { key: "nhan_vien", label: "Nhân viên phụ trách" },
  { key: "team", label: "Tổ đội" },
  { key: "agency", label: "Đại lý HQ" },
  { key: "dai_ly", label: "Đại lý ghi chú" },
  { key: "kpi", label: "Điểm KPI" },
  { key: "licenses", label: "Số GP hệ thống" },
  { key: "so_luong_gp", label: "Số GP hiển thị" },
  { key: "licenseManualCount", label: "Số GP nhập tay" },
  { key: "reviewed", label: "Trạng thái rà soát" },
]);

export const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;
export const ACCEPTED_IMPORT_EXTENSIONS = Object.freeze([".xlsx", ".xlsm"]);

export function toDateInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export const DATE_RANGE_PRESETS = Object.freeze([
  {
    key: "none",
    label: "Tất cả thời gian",
    getRange: () => ({ from: "", to: "" }),
  },
  {
    key: "today",
    label: "Hôm nay",
    getRange: () => {
      const today = new Date();
      const value = toDateInputValue(today);
      return { from: value, to: value };
    },
  },
  {
    key: "3days",
    label: "3 ngày gần nhất",
    getRange: () => {
      const today = new Date();
      const end = toDateInputValue(today);
      const from = new Date(today);
      from.setDate(from.getDate() - 2);
      return { from: toDateInputValue(from), to: end };
    },
  },
  {
    key: "7days",
    label: "7 ngày gần nhất",
    getRange: () => {
      const today = new Date();
      const end = toDateInputValue(today);
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { from: toDateInputValue(from), to: end };
    },
  },
  {
    key: "30days",
    label: "30 ngày gần nhất",
    getRange: () => {
      const today = new Date();
      const end = toDateInputValue(today);
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return { from: toDateInputValue(from), to: end };
    },
  },
  {
    key: "thisMonth",
    label: "Tháng này",
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: toDateInputValue(start), to: toDateInputValue(end) };
    },
  },
  {
    key: "lastMonth",
    label: "Tháng trước",
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toDateInputValue(start), to: toDateInputValue(end) };
    },
  },
  {
    key: "quarter",
    label: "Quý hiện tại",
    getRange: () => {
      const now = new Date();
      const quarter = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), quarter * 3, 1);
      const end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
      return { from: toDateInputValue(start), to: toDateInputValue(end) };
    },
  },
]);
