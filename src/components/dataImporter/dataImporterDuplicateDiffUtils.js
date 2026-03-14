import { formatDisplayDate } from "../../../packages/domain/src/format.js";

const DUPLICATE_DIFF_FIELD_GROUPS = Object.freeze([
  {
    title: "Thông tin tờ khai",
    fields: [
      "so_tk_full",
      "so_tk",
      "so_tk_suffix",
      "mst",
      "cong_ty",
      "dia_chi",
      "loai_hinh",
      "ma_loai_hinh",
      "ma_hq",
      "hq_agency",
      "branch",
      "nhanh",
      "ngay_dk",
      "date",
      "raw_date",
    ],
  },
  {
    title: "Phân công & trạng thái",
    fields: [
      "nhan_vien",
      "team",
      "agency",
      "dai_ly",
      "agents",
      "__agents_display",
      "status",
      "reviewed",
      "reviewed_at",
      "duplicate_review_pending",
      "duplicate_review_note",
      "duplicate_review_actor",
      "duplicate_review_updated_at",
    ],
  },
  {
    title: "Giấy phép & KPI",
    fields: [
      "kpi",
      "licenses",
      "so_luong_gp",
      "licenseManualCount",
      "licenseSource",
      "licenseSourceCodes",
      "licenseCodes",
      "licenseExcludedCodes",
      "__license_source_count",
      "__license_included_count",
      "__license_excluded_count",
      "__license_source_codes",
      "__license_included_codes",
      "__license_excluded_codes",
    ],
  },
  {
    title: "C/O & chỉ báo",
    fields: ["co", "co_status", "co_notes", "co_issue", "__co_status", "__co_lines"],
  },
  {
    title: "Mốc thời gian",
    fields: [
      "created_at",
      "imported_at",
      "updated_at",
      "synced_at",
      "last_sync_at",
      "reviewed_at",
      "__timestamp_field",
    ],
  },
]);

const DUPLICATE_DIFF_FIELD_LABELS = Object.freeze({
  so_tk_full: "Số tờ khai (đầy đủ)",
  so_tk: "Số tờ khai (11 số)",
  so_tk_suffix: "Mã phân nhánh",
  mst: "Mã số thuế",
  cong_ty: "Tên doanh nghiệp",
  dia_chi: "Địa chỉ doanh nghiệp",
  loai_hinh: "Loại hình",
  ma_loai_hinh: "Mã loại hình",
  ma_hq: "Mã HQ quản lý",
  hq_agency: "Mã HQ đại lý",
  branch: "Chi nhánh HQ",
  nhanh: "Nhánh nghiệp vụ",
  ngay_dk: "Ngày đăng ký",
  date: "Ngày tờ khai",
  raw_date: "Ngày gốc (chuỗi)",
  nhan_vien: "Nhân viên phụ trách",
  team: "Tổ đội",
  agency: "Đại lý chính",
  dai_ly: "Đại lý ghi chú",
  agents: "Danh sách đại lý (thô)",
  __agents_display: "Danh sách đại lý (gộp)",
  status: "Trạng thái xử lý",
  reviewed: "Đã rà soát",
  reviewed_at: "Thời gian rà soát",
  duplicate_review_pending: "Đánh dấu cần rà soát",
  duplicate_review_note: "Ghi chú xử lý trùng",
  duplicate_review_actor: "Người cập nhật rà soát",
  duplicate_review_updated_at: "Cập nhật rà soát gần nhất",
  kpi: "Điểm KPI",
  licenses: "Số GP hệ thống",
  so_luong_gp: "Số GP hiển thị",
  licenseManualCount: "Số GP nhập tay",
  licenseSource: "Nguồn giấy phép",
  licenseSourceCodes: "Mã GP nguồn (raw)",
  licenseCodes: "Mã GP hiện tại",
  licenseExcludedCodes: "Mã GP loại trừ (raw)",
  __license_source_count: "Tổng mã GP nguồn",
  __license_included_count: "Mã GP giữ lại",
  __license_excluded_count: "Mã GP loại trừ",
  __license_source_codes: "Danh sách mã GP nguồn",
  __license_included_codes: "Danh sách mã GP giữ lại",
  __license_excluded_codes: "Danh sách mã GP loại trừ",
  co: "Giá trị C/O",
  co_status: "Trạng thái C/O",
  co_notes: "Ghi chú C/O",
  co_issue: "Cảnh báo C/O",
  __co_status: "Trạng thái C/O (tính)",
  __co_lines: "Số dòng C/O",
  created_at: "Khởi tạo",
  imported_at: "Import Excel",
  updated_at: "Cập nhật gần nhất",
  synced_at: "Đồng bộ ECUS",
  last_sync_at: "Đồng bộ ECUS trước",
  __timestamp_field: "Mốc thời gian ưu tiên",
});

const DUPLICATE_DIFF_IGNORED_KEYS = new Set([
  "__proto__",
  "__rowIndex",
  "__rowindex",
  "_rowIndex",
  "rowIndex",
  "raw",
  "raw_data",
  "rawDate",
  "rawTimestamp",
  "timestamp",
  "timestampDetail",
  "score",
  "key",
]);

const DUPLICATE_DIFF_MULTILINE_KEYS = new Set([
  "agents",
  "licenseSourceCodes",
  "licenseCodes",
  "licenseExcludedCodes",
  "__license_source_codes",
  "__license_included_codes",
  "__license_excluded_codes",
  "__agents_display",
]);

const DUPLICATE_DIFF_DATE_KEYS = new Set(["date", "ngay_dk"]);

const DUPLICATE_DIFF_DATETIME_KEYS = new Set([
  "created_at",
  "imported_at",
  "updated_at",
  "synced_at",
  "last_sync_at",
  "reviewed_at",
  "duplicate_review_updated_at",
]);

export function humanizeDiffKey(key) {
  if (!key) return "(không xác định)";

  return key
    .toString()
    .replace(/^_+/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function normalizeDiffValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toString() : "";
  }
  if (typeof value === "boolean") return value ? "__true" : "__false";
  if (Array.isArray(value)) {
    return value.map((item) => normalizeDiffValue(item)).join("|#|");
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return Object.keys(value)
        .sort()
        .map((key) => `${key}:${normalizeDiffValue(value[key])}`)
        .join("|#|");
    }
  }
  return String(value);
}

function isEmptyDiffValue(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    if (value instanceof Date) return false;
    return Object.keys(value).length === 0;
  }
  return false;
}

function formatDiffValue(value, key) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toLocaleString("vi-VN") : "";
  }
  if (typeof value === "boolean") {
    return value ? "Có" : "Không";
  }
  if (value instanceof Date) {
    return value.toLocaleString("vi-VN");
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    return value
      .map((item) => formatDiffValue(item, key))
      .filter((part) => part !== "")
      .join(DUPLICATE_DIFF_MULTILINE_KEYS.has(key) ? "\n" : ", ");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function formatDiffTemporalValue(value, key) {
  if (!value) return "";

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return typeof value === "string" ? value : String(value);
  }

  if (DUPLICATE_DIFF_DATE_KEYS.has(key)) {
    return formatDisplayDate(new Date(parsed).toISOString().slice(0, 10));
  }

  return new Date(parsed).toLocaleString("vi-VN");
}

export function createDuplicateDiffGroups(baseValues, compareValues) {
  if (!baseValues || !compareValues) return [];

  const remainingKeys = new Set([...Object.keys(baseValues || {}), ...Object.keys(compareValues || {})]);
  const groups = [];

  for (const group of DUPLICATE_DIFF_FIELD_GROUPS) {
    const rows = [];

    for (const key of group.fields) {
      if (!remainingKeys.has(key)) continue;

      remainingKeys.delete(key);
      const baseValue = baseValues[key];
      const compareValue = compareValues[key];
      const bothEmpty = isEmptyDiffValue(baseValue) && isEmptyDiffValue(compareValue);

      if (bothEmpty) continue;

      let baseDisplay = baseValue;
      let compareDisplay = compareValue;

      if (DUPLICATE_DIFF_DATE_KEYS.has(key) || DUPLICATE_DIFF_DATETIME_KEYS.has(key)) {
        baseDisplay = formatDiffTemporalValue(baseValue, key);
        compareDisplay = formatDiffTemporalValue(compareValue, key);
      } else {
        baseDisplay = formatDiffValue(baseValue, key);
        compareDisplay = formatDiffValue(compareValue, key);
      }

      rows.push({
        key,
        label: DUPLICATE_DIFF_FIELD_LABELS[key] || humanizeDiffKey(key),
        baseValue: baseDisplay,
        compareValue: compareDisplay,
        changed: normalizeDiffValue(baseValue) !== normalizeDiffValue(compareValue),
      });
    }

    if (rows.length > 0) {
      groups.push({ title: group.title, rows });
    }
  }

  const leftoverRows = [];

  for (const key of Array.from(remainingKeys).sort()) {
    if (DUPLICATE_DIFF_IGNORED_KEYS.has(key)) continue;

    const baseValue = baseValues[key];
    const compareValue = compareValues[key];
    const bothEmpty = isEmptyDiffValue(baseValue) && isEmptyDiffValue(compareValue);

    if (bothEmpty) continue;

    let baseDisplay = baseValue;
    let compareDisplay = compareValue;

    if (DUPLICATE_DIFF_DATE_KEYS.has(key) || DUPLICATE_DIFF_DATETIME_KEYS.has(key)) {
      baseDisplay = formatDiffTemporalValue(baseValue, key);
      compareDisplay = formatDiffTemporalValue(compareValue, key);
    } else {
      baseDisplay = formatDiffValue(baseValue, key);
      compareDisplay = formatDiffValue(compareValue, key);
    }

    leftoverRows.push({
      key,
      label: DUPLICATE_DIFF_FIELD_LABELS[key] || humanizeDiffKey(key),
      baseValue: baseDisplay,
      compareValue: compareDisplay,
      changed: normalizeDiffValue(baseValue) !== normalizeDiffValue(compareValue),
    });
  }

  if (leftoverRows.length > 0) {
    groups.push({ title: "Thông tin khác", rows: leftoverRows });
  }

  return groups;
}
