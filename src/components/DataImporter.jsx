// src/components/DataImporter.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  getDeclRows,
  saveDeclRows,
  sortDeclRows,
  pushImportLog,
  pushAuditLog,
  getTeamRoster,
  mapMemberNamesToTeams,
  markDeclRowsReviewed,
  mapHQAgenciesByMST,
  normalizeStr,
  normalizeDeclarationNumber,
  normalizeName,
} from "@/lib/store.js";
import { mapRow, detectDateOrder } from "@/lib/importer.js";
import { loadRules, computeKPI, extractLicenseCodesFromRowObj } from "@/lib/rules.js";
import CollapsibleCard from "./CollapsibleCard.jsx";
import { deriveCOStatus, coLabel, coLineCount } from "@/shared/co.js";
import { formatDisplayDate, formatDateRangeLabel } from "@/shared/format.js";
import { fetchWithAuth } from "@/auth/localAuth.js";
import useTooltipTitles from "@/hooks/useTooltipTitles.js";
import {
  normalizeRoleKey,
  TEAM_LEAD_ROLE,
  MANAGER_ROLE,
  ADMIN_ROLE,
  DEFAULT_ROLE,
} from "@/shared/accountRoles.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.jsx";
import { ScrollArea } from "@/components/ui/scroll-area.jsx";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];
const CO_FILTER_OPTIONS = Object.freeze([
  { value: "all", label: "Tất cả C/O" },
  { value: "has", label: "Có C/O (≥ 1 dòng)" },
  { value: "min", label: "Tùy chọn số dòng C/O" },
]);

const DEFAULT_SYNC_CONFIG = Object.freeze({
  enabled: false,
  schedule: "0 * * * *",
  rangeDays: 1,
  preferMonthFirst: false,
  connection: {
    server: "",
    database: "",
    user: "",
    hasPassword: false,
  },
  lastRun: null,
  lastStatus: null,
});

const RANGE_PRESETS = Object.freeze([
  { label: "1 ngày gần nhất", days: 1 },
  { label: "3 ngày", days: 3 },
  { label: "7 ngày", days: 7 },
  { label: "30 ngày", days: 30 },
]);

const FILTER_STORAGE_KEY = "kpi:data-importer:filter:v1";

const DUPLICATE_MERGE_FIELDS = Object.freeze([
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

const DATE_RANGE_PRESETS = Object.freeze([
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

const CARD_SURFACE_CLASS = "rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] shadow-sm";
const ZEBRA_TABLE_BODY_CLASS =
  "[&_tbody_tr:nth-child(odd)]:bg-[color:var(--ds-surface-card)] [&_tbody_tr:nth-child(even)]:bg-[color:var(--ds-surface-muted)]";

async function extractErrorMessage(response, fallbackMessage) {
  if (!response || typeof response !== "object") {
    return fallbackMessage;
  }
  try {
    const data = await response.clone().json();
    if (data?.error && typeof data.error === "string") {
      return data.error;
    }
    if (data?.message && typeof data.message === "string") {
      return data.message;
    }
  } catch (jsonErr) {
    try {
      const text = await response.clone().text();
      if (text && text.trim().length > 0) {
        return text.trim();
      }
    } catch (textErr) {
      console.error("Không thể đọc thông báo lỗi từ response", textErr, jsonErr);
    }
  }
  if (Number.isInteger(response?.status) && response.status >= 400) {
    return `HTTP ${response.status}`;
  }
  return fallbackMessage;
}

function toDateInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function coerceLicenseValue(value) {
  if (value === "" || value === null || value === undefined) return "";
  const str = String(value).trim();
  if (str === "") return "";
  const num = Number(str);
  if (!Number.isFinite(num)) return "";
  return Math.max(0, Math.round(num));
}

function ensureLicenseFields(row) {
  if (!row || typeof row !== "object") return row;
  let next = row;
  const ensureClone = () => {
    if (next === row) {
      next = { ...row };
    }
  };

  const source = row.licenses ?? row.so_luong_gp;
  if (source !== undefined) {
    const normalized = coerceLicenseValue(source);
    if (normalized === "") {
      if (row.licenses !== "" || row.so_luong_gp !== "") {
        ensureClone();
        next.licenses = "";
        next.so_luong_gp = "";
      }
    } else if (row.licenses !== normalized || row.so_luong_gp !== normalized) {
      ensureClone();
      next.licenses = normalized;
      next.so_luong_gp = normalized;
    }
  }

  if (Object.prototype.hasOwnProperty.call(row, "licenseManualCount")) {
    const manualNormalized = coerceLicenseValue(row.licenseManualCount);
    if (manualNormalized === "") {
      if (row.licenseManualCount !== null && row.licenseManualCount !== undefined) {
        ensureClone();
        next.licenseManualCount = null;
      }
    } else if (row.licenseManualCount !== manualNormalized) {
      ensureClone();
      next.licenseManualCount = manualNormalized;
    }
    if (manualNormalized !== "") {
      if (next.licenses !== manualNormalized || next.so_luong_gp !== manualNormalized) {
        ensureClone();
        next.licenses = manualNormalized;
        next.so_luong_gp = manualNormalized;
      }
    }
  }

  return next;
}

const CODE_INPUT_SPLIT = /[\s,;]+/;

function normalizeLicenseCode(value) {
  const normalized = normalizeStr(value);
  if (!normalized) return "";
  return normalized.toUpperCase();
}

function parseCodeListInput(text) {
  if (!text) return [];
  return Array.from(
    new Set(
      text
        .split(CODE_INPUT_SPLIT)
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

function joinCodeList(list) {
  if (!Array.isArray(list) || list.length === 0) return "";
  return list.join("\n");
}

function extractAgencyKeys(row) {
  const keys = new Set();
  const addKey = (value) => {
    const normalized = normalizeLicenseCode(value);
    if (normalized) {
      keys.add(normalized);
    }
  };
  if (Array.isArray(row?.agents)) {
    for (const agent of row.agents) {
      addKey(agent);
    }
  }
  const raw = row?.agency ?? row?.dai_ly ?? row?.hq_agency ?? '';
  if (Array.isArray(raw)) {
    for (const value of raw) {
      addKey(value);
    }
  } else if (typeof raw === 'string') {
    raw
      .split(/[\n,;|]/g)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach(addKey);
  } else if (raw) {
    addKey(raw);
  }
  return Array.from(keys);
}

function arraysEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

const TIMESTAMP_FIELD_LABELS = Object.freeze({
  updatedAt: "Cập nhật gần nhất",
  updated_at: "Cập nhật gần nhất",
  reviewed_at: "Rà soát",
  syncedAt: "Đồng bộ ECUS",
  synced_at: "Đồng bộ ECUS",
  importedAt: "Import Excel",
  imported_at: "Import Excel",
  createdAt: "Khởi tạo",
  created_at: "Khởi tạo",
  date: "Ngày tờ khai",
});

const TIMESTAMP_FIELD_ORDER = Object.freeze([
  "updatedAt",
  "updated_at",
  "reviewed_at",
  "syncedAt",
  "synced_at",
  "importedAt",
  "imported_at",
  "createdAt",
  "created_at",
  "date",
]);

function extractRowTimestampDetail(row) {
  if (!row || typeof row !== "object") {
    return { timestamp: 0, field: null, label: "Không xác định", display: "Không xác định", iso: null };
  }
  let bestTs = 0;
  let bestField = null;
  for (const field of TIMESTAMP_FIELD_ORDER) {
    const value = row[field];
    if (!value) continue;
    const ts = Date.parse(value);
    if (!Number.isFinite(ts)) continue;
    if (ts > bestTs) {
      bestTs = ts;
      bestField = field;
    }
  }
  if (!bestTs) {
    return { timestamp: 0, field: bestField, label: "Không xác định", display: "Không xác định", iso: null };
  }
  const formatter = new Intl.DateTimeFormat("vi-VN", { hour12: false });
  return {
    timestamp: bestTs,
    field: bestField,
    label: TIMESTAMP_FIELD_LABELS[bestField] || "Thời gian cập nhật",
    display: formatter.format(new Date(bestTs)),
    iso: new Date(bestTs).toISOString(),
  };
}

function computeDuplicateWeight(row) {
  if (!row || typeof row !== "object") {
    return { score: 0, timestamp: 0, timestampDetail: extractRowTimestampDetail(row) };
  }
  let score = 0;
  if (row.reviewed) score += 5;
  if (row.nhan_vien) score += 2;
  if (row.team) score += 2;
  if (row.agency || row.dai_ly) score += 1;
  if (Array.isArray(row.licenseCodes) && row.licenseCodes.length) score += 1;
  const manual = Number(row.licenseManualCount);
  if (Number.isFinite(manual) && manual >= 0) score += 3;
  const licenseCount = Number(row.licenses ?? row.so_luong_gp);
  if (Number.isFinite(licenseCount) && licenseCount > 0) score += 1;
  const timestampDetail = extractRowTimestampDetail(row);
  return { score, timestamp: timestampDetail.timestamp, timestampDetail };
}

function compareDuplicateCandidates(a, b) {
  const weightA = computeDuplicateWeight(a);
  const weightB = computeDuplicateWeight(b);
  if (weightA.timestamp !== weightB.timestamp) {
    return weightB.timestamp - weightA.timestamp;
  }
  if (weightA.score !== weightB.score) {
    return weightB.score - weightA.score;
  }
  const kpiA = Number(a?.kpi);
  const kpiB = Number(b?.kpi);
  if (Number.isFinite(kpiA) && Number.isFinite(kpiB) && kpiA !== kpiB) {
    return kpiB - kpiA;
  }
  return 0;
}

function applyMergeField(target, source, field) {
  if (!target || typeof target !== "object" || !source || typeof source !== "object") {
    return target;
  }
  switch (field) {
    case "nhan_vien": {
      target.nhan_vien = source.nhan_vien || "";
      return target;
    }
    case "team": {
      target.team = source.team || "";
      return target;
    }
    case "agency": {
      target.agency = source.agency || "";
      return target;
    }
    case "dai_ly": {
      target.dai_ly = source.dai_ly || "";
      return target;
    }
    case "kpi": {
      const parsed = Number(source.kpi);
      if (Number.isFinite(parsed)) {
        target.kpi = parsed;
      }
      return target;
    }
    case "licenses":
    case "so_luong_gp": {
      const parsed = Number(source.licenses ?? source.so_luong_gp);
      if (Number.isFinite(parsed)) {
        target.licenses = parsed;
        target.so_luong_gp = parsed;
      }
      return target;
    }
    case "licenseManualCount": {
      const parsed = Number(source.licenseManualCount);
      if (Number.isFinite(parsed)) {
        target.licenseManualCount = Math.max(0, Math.round(parsed));
      } else {
        delete target.licenseManualCount;
      }
      return target;
    }
    case "reviewed": {
      if (source.reviewed) {
        target.reviewed = true;
        if (source.reviewed_at) target.reviewed_at = source.reviewed_at;
        if (source.reviewed_by) target.reviewed_by = source.reviewed_by;
      } else {
        delete target.reviewed;
        delete target.reviewed_at;
        delete target.reviewed_by;
      }
      return target;
    }
    default: {
      if (Object.prototype.hasOwnProperty.call(source, field)) {
        target[field] = source[field];
      }
      return target;
    }
  }
}

function clearDuplicateReviewFlags(target) {
  if (!target || typeof target !== "object") return target;
  delete target.duplicate_review_pending;
  delete target.duplicate_review_note;
  delete target.duplicate_review_actor;
  delete target.duplicate_review_updated_at;
  return target;
}

function extractDuplicatePrefix(row) {
  return normalizeDeclarationNumber(row?.so_tk_full ?? row?.so_tk ?? "", 11);
}

function inferRowSource(row) {
  if (!row || typeof row !== "object") {
    return { label: "Không xác định", code: "unknown" };
  }
  const direct = [row.origin, row.source, row.sourceLabel, row.dataSource, row.data_source, row.originSource]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .find((value) => value.length > 0);
  if (direct) {
    return { label: direct, code: normalizeStr(direct) };
  }
  if (row.syncedAt || row.synced_at || row.ecusId || row.ecus_reference) {
    return { label: "Đồng bộ ECUS", code: "ecus" };
  }
  if (row.importedAt || row.imported_at || row.importBatchId || row.import_batch_id) {
    return { label: "Import Excel", code: "import" };
  }
  if (row.createdAt || row.created_at) {
    return { label: "Nhập thủ công", code: "manual" };
  }
  return { label: "Không xác định", code: "unknown" };
}

function describeRowStatus(row) {
  if (row?.duplicate_review_pending) {
    return "Chờ rà soát trùng";
  }
  const hasStaff = !!(row?.nhan_vien && row.nhan_vien.toString().trim());
  const hasTeam = !!(row?.team && row.team.toString().trim());
  if (row?.reviewed) {
    return "Đã rà soát";
  }
  if (!hasStaff || !hasTeam) {
    const missing = [];
    if (!hasStaff) missing.push("nhân viên");
    if (!hasTeam) missing.push("tổ đội");
    return `Thiếu ${missing.join(" & ")}`;
  }
  return "Đủ thông tin";
}

function formatDeclarationLabel(entry) {
  if (!entry || typeof entry !== "object") return "";
  const number = entry.so_tk_full ? String(entry.so_tk_full) : entry.so_tk ? String(entry.so_tk) : "";
  const branch = entry.nhanh || entry.branch || "";
  return branch ? `${number} (${branch})` : number;
}

function formatDuplicateGroupLabel(entry) {
  if (!entry || typeof entry !== "object") {
    return "Nhóm trùng";
  }
  const prefix = extractDuplicatePrefix(entry) || String(entry?.so_tk || "").slice(0, 11) || "Nhóm trùng";
  const branch = entry.nhanh || entry.branch || "";
  return branch ? `${prefix} – ${branch}` : prefix;
}
function ensureCOFields(row) {
  if (!row || typeof row !== "object") return row;
  const status = deriveCOStatus(row, row);
  if (
    status.co === row.co &&
    status.has_co === row.has_co &&
    status.co_line_count === row.co_line_count
  ) {
    return row;
  }
  return status;
}

export default function DataImporter({
  canEdit = true,
  currentUser = null,
  canManageSync = false,
  canManageAlerts = false,
}) {
  const rootRef = useRef(null);
  const fileRef = useRef(null);
  const [rawRows, setRawRows] = useState([]);        // dữ liệu xem trước (đã map)
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState("saved");         // saved | preview
  const [selectedFile, setSelectedFile] = useState("");
  const savedFilterRef = useRef(null);
  const [hasSavedFilter, setHasSavedFilter] = useState(false);
  const [filterSavedAt, setFilterSavedAt] = useState(null);
  const [datePreset, setDatePreset] = useState("none");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [filterNoStaff, setFilterNoStaff] = useState(false);
  const [filterNoTeam, setFilterNoTeam] = useState(false);
  const [filterDuplicate11, setFilterDuplicate11] = useState(false);
  const [coFilterMode, setCoFilterMode] = useState("all");
  const [coFilterMin, setCoFilterMin] = useState(5);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [searchRange, setSearchRange] = useState({ from: "", to: "" });
  const [rules, setRules] = useState(() => loadRules());
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [duplicateReviewOpen, setDuplicateReviewOpen] = useState(false);
  const [duplicateReviewConfirmed, setDuplicateReviewConfirmed] = useState(false);
  const [duplicate11Plan, setDuplicate11Plan] = useState({});

  // Tuỳ chọn
  const [overwrite, setOverwrite] = useState(false);         // Ghi đè toàn bộ
  const [upsert11, setUpsert11] = useState(true);            // Upsert theo 11 số đầu (nếu có dùng merge cục bộ)
  const [autoAssignStaff, setAutoAssignStaff] = useState(true); // Tự gán nhân viên theo MST nếu trống

  useEffect(() => {
    if (!canOverwriteData && overwrite) {
      setOverwrite(false);
    }
  }, [canOverwriteData, overwrite]);

  const actor = currentUser?.username || "guest";
  const isReadOnlyForEdits = !canEdit;
  const canReviewAlerts = canEdit || canManageAlerts;
  const normalizedRole = normalizeRoleKey(currentUser?.role);
  const isTeamLead = normalizedRole === TEAM_LEAD_ROLE;
  const isStaffRole = normalizedRole === DEFAULT_ROLE;
  const isManagerRole = normalizedRole === MANAGER_ROLE || normalizedRole === ADMIN_ROLE;
  const rosterSnapshot = useMemo(() => getTeamRoster(), [currentUser]);
  const memberTeamMap = useMemo(() => mapMemberNamesToTeams(rosterSnapshot), [rosterSnapshot]);
  const staffDisplayName = normalizeStr(currentUser?.name || currentUser?.username || "");
  const staffNameKey = normalizeName(staffDisplayName);
  const assignedTeam = staffNameKey ? memberTeamMap.get(staffNameKey)?.team || "" : "";
  const assignedTeamKey = normalizeName(assignedTeam);
  const canUploadFiles = canEdit && !(isTeamLead || isStaffRole);
  const canOverwriteData = canUploadFiles;
  const editingRestrictionMessage = useMemo(() => {
    if (!canEdit) return "";
    if (isManagerRole) return "";
    if (isTeamLead) {
      return assignedTeam
        ? `Bạn chỉ có thể chỉnh sửa tờ khai thuộc tổ ${assignedTeam}.`
        : "Bạn chỉ có thể chỉnh sửa tờ khai thuộc tổ đội do mình phụ trách.";
    }
    if (isStaffRole) {
      return "Bạn chỉ có thể chỉnh sửa tờ khai đã gán cho tên của bạn.";
    }
    return "";
  }, [assignedTeam, canEdit, isManagerRole, isStaffRole, isTeamLead]);
  const blockedEditNoticeRef = useRef(new Set());
  useEffect(() => {
    blockedEditNoticeRef.current.clear();
  }, [normalizedRole, assignedTeamKey, staffNameKey]);
  const isRowEditable = useCallback(
    (row) => {
      if (!canEdit) return false;
      if (!row || typeof row !== "object") return false;
      if (isManagerRole) return true;
      const rowStaffKey = normalizeName(row?.nhan_vien);
      if (isTeamLead) {
        if (!assignedTeamKey) return false;
        const rowTeamKey = normalizeName(row?.team);
        if (rowTeamKey && rowTeamKey === assignedTeamKey) {
          return true;
        }
        if (rowStaffKey) {
          const rosterEntry = memberTeamMap.get(rowStaffKey);
          if (rosterEntry && normalizeName(rosterEntry.team) === assignedTeamKey) {
            return true;
          }
        }
        return false;
      }
      if (isStaffRole) {
        return rowStaffKey && rowStaffKey === staffNameKey;
      }
      return true;
    },
    [assignedTeamKey, canEdit, isManagerRole, isStaffRole, isTeamLead, memberTeamMap, staffNameKey]
  );
  const [syncConfig, setSyncConfig] = useState(() => ({ ...DEFAULT_SYNC_CONFIG }));
  const [syncForm, setSyncForm] = useState(() => ({
    enabled: DEFAULT_SYNC_CONFIG.enabled,
    schedule: DEFAULT_SYNC_CONFIG.schedule,
    rangeDays: DEFAULT_SYNC_CONFIG.rangeDays,
    preferMonthFirst: DEFAULT_SYNC_CONFIG.preferMonthFirst,
    server: DEFAULT_SYNC_CONFIG.connection.server,
    database: DEFAULT_SYNC_CONFIG.connection.database,
    user: DEFAULT_SYNC_CONFIG.connection.user,
    password: "",
    hasPassword: !!DEFAULT_SYNC_CONFIG.connection.hasPassword,
  }));
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncError, setSyncError] = useState("");
  const [manualRange, setManualRange] = useState({ from: "", to: "" });
  const [alertSummary, setAlertSummary] = useState({ outstanding: 0, totalTracked: 0, lastEvaluatedAt: null });
  const [alertEntries, setAlertEntries] = useState([]);
  const [alertLoading, setAlertLoading] = useState(false);
  const [statusInfo, setStatusInfo] = useState({ backend: null, database: null, checkedAt: null });
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [previewRows, setPreviewRows] = useState([]);
  const [previewLimited, setPreviewLimited] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewRangeInfo, setPreviewRangeInfo] = useState(null);
  const previewRangeLabel = useMemo(() => formatDateRangeLabel(previewRangeInfo), [previewRangeInfo]);

  const applyStoredFilter = useCallback((stored, { notify = false } = {}) => {
    if (!stored || typeof stored !== "object") {
      return;
    }
    savedFilterRef.current = stored;
    setHasSavedFilter(true);
    if (stored.savedAt) {
      setFilterSavedAt(stored.savedAt);
    }
    if (typeof stored.query === "string") {
      setQuery(stored.query);
    }
    if (stored.range && typeof stored.range === "object") {
      setSearchRange({
        from: stored.range.from || "",
        to: stored.range.to || "",
      });
    }
    if (stored.datePreset) {
      setDatePreset(stored.datePreset);
    }
    if (typeof stored.filterNoStaff === "boolean") {
      setFilterNoStaff(stored.filterNoStaff);
    }
    if (typeof stored.filterNoTeam === "boolean") {
      setFilterNoTeam(stored.filterNoTeam);
    }
    if (typeof stored.filterDuplicate11 === "boolean") {
      setFilterDuplicate11(stored.filterDuplicate11);
    }
    if (typeof stored.coFilterMode === "string") {
      setCoFilterMode(stored.coFilterMode);
    }
    if (Number.isFinite(stored.coFilterMin)) {
      setCoFilterMin(Math.max(0, Math.round(stored.coFilterMin)));
    }
    setPage(1);
    if (notify) {
      alert("Đã áp dụng bộ lọc đã lưu.");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const stored = JSON.parse(raw);
      if (!stored || typeof stored !== "object") {
        return;
      }
      applyStoredFilter(stored);
    } catch (error) {
      console.error("Không thể đọc bộ lọc đã lưu", error);
    }
  }, [applyStoredFilter]);

  const filterSavedLabel = useMemo(() => {
    if (!filterSavedAt) return "";
    try {
      return new Date(filterSavedAt).toLocaleString("vi-VN");
    } catch (error) {
      console.error("Không thể định dạng thời gian lưu bộ lọc", error);
      return "";
    }
  }, [filterSavedAt]);

  const applyDatePreset = useCallback((presetKey) => {
    const preset = DATE_RANGE_PRESETS.find((item) => item.key === presetKey);
    if (!preset) {
      setDatePreset("custom");
      return;
    }
    const range = preset.getRange();
    setDatePreset(presetKey);
    setSearchRange({
      from: range?.from || "",
      to: range?.to || "",
    });
  }, []);

  const handleSaveCurrentFilter = useCallback(() => {
    if (typeof window === "undefined") {
      alert("Môi trường hiện tại không hỗ trợ lưu bộ lọc.");
      return;
    }
    const payload = {
      query,
      range: { ...searchRange },
      filterNoStaff,
      filterNoTeam,
      filterDuplicate11,
      coFilterMode,
      coFilterMin,
      datePreset,
      savedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(payload));
      savedFilterRef.current = payload;
      setHasSavedFilter(true);
      setFilterSavedAt(payload.savedAt);
      alert("Đã lưu bộ lọc hiện tại cho lần sử dụng tiếp theo.");
    } catch (error) {
      console.error("Không thể lưu bộ lọc", error);
      alert("Không thể lưu bộ lọc. Vui lòng kiểm tra bộ nhớ trình duyệt.");
    }
  }, [query, searchRange, filterNoStaff, filterNoTeam, filterDuplicate11, coFilterMode, coFilterMin, datePreset]);

  const handleRestoreSavedFilter = useCallback(() => {
    if (!savedFilterRef.current) {
      alert("Chưa có bộ lọc nào được lưu.");
      return;
    }
    applyStoredFilter(savedFilterRef.current, { notify: true });
  }, [applyStoredFilter]);

  const handleClearSavedFilter = useCallback(() => {
    if (typeof window === "undefined") {
      alert("Không thể xóa bộ lọc đã lưu trong môi trường hiện tại.");
      return;
    }
    try {
      window.localStorage.removeItem(FILTER_STORAGE_KEY);
      savedFilterRef.current = null;
      setHasSavedFilter(false);
      setFilterSavedAt(null);
      alert("Đã xóa bộ lọc đã lưu.");
    } catch (error) {
      console.error("Không thể xóa bộ lọc", error);
      alert("Không thể xóa bộ lọc đã lưu. Vui lòng thử lại sau.");
    }
  }, []);

  const handleClearSearchRange = useCallback(() => {
    setSearchRange({ from: "", to: "" });
    setDatePreset("none");
  }, []);

  const licenseExcludeSet = useMemo(() => {
    const codes = Array.isArray(rules?.license?.exclude?.codes) ? rules.license.exclude.codes : [];
    return new Set(codes.map(normalizeLicenseCode).filter(Boolean));
  }, [rules]);

  const licenseAgencyExcludeMap = useMemo(() => {
    const entries = Array.isArray(rules?.license?.exclude?.agencies) ? rules.license.exclude.agencies : [];
    const map = new Map();
    for (const entry of entries) {
      const agencyKey = normalizeLicenseCode(entry?.agency);
      if (!agencyKey) continue;
      const codes = Array.isArray(entry?.codes) ? entry.codes.map(normalizeLicenseCode).filter(Boolean) : [];
      if (!codes.length) continue;
      map.set(agencyKey, new Set(codes));
    }
    return map;
  }, [rules]);

  const getLicenseExcludeSetForRow = useCallback(
    (row) => {
      const combined = new Set(licenseExcludeSet);
      const agencyKeys = extractAgencyKeys(row);
      for (const key of agencyKeys) {
        if (!licenseAgencyExcludeMap.has(key)) continue;
        for (const code of licenseAgencyExcludeMap.get(key)) {
          combined.add(code);
        }
      }
      return combined;
    },
    [licenseExcludeSet, licenseAgencyExcludeMap]
  );

  const summarizeLicenseSnapshot = useCallback(
    (row) => {
      if (!row || typeof row !== "object") {
        return {
          sourceCodes: [],
          includedCodes: [],
          excludedCodes: [],
          sourceCount: 0,
          includedCount: 0,
          excludedCount: 0,
        };
      }
      const excludeSet = getLicenseExcludeSetForRow(row);
      const baseSource = Array.isArray(row.licenseSourceCodes) ? row.licenseSourceCodes : [];
      const currentCodes = Array.isArray(row.licenseCodes) ? row.licenseCodes : [];
      const storedExcluded = Array.isArray(row.licenseExcludedCodes) ? row.licenseExcludedCodes : [];
      const extracted = extractLicenseCodesFromRowObj(row) || [];
      const normalizedSource = Array.from(
        new Set(
          [...baseSource, ...currentCodes, ...storedExcluded, ...extracted]
            .map(normalizeLicenseCode)
            .filter(Boolean)
        )
      );
      const explicitExcluded = Array.from(
        new Set(storedExcluded.map(normalizeLicenseCode).filter(Boolean))
      );
      const computedExcluded = normalizedSource.filter((code) => excludeSet.has(code));
      const excludedSet = new Set([...explicitExcluded, ...computedExcluded]);
      const includedCodes = normalizedSource.filter((code) => !excludedSet.has(code));
      const manualOverride = coerceLicenseValue(row.licenseManualCount);
      const directCountSource =
        manualOverride !== "" ? manualOverride : coerceLicenseValue(row.licenses ?? row.so_luong_gp);
      const manualCount = directCountSource === "" ? null : Number(directCountSource);
      const includedCount = Number.isFinite(manualCount) && manualCount >= 0 ? manualCount : includedCodes.length;
      const sourceCount = normalizedSource.length || includedCodes.length + excludedSet.size;
      return {
        sourceCodes: normalizedSource,
        includedCodes,
        excludedCodes: Array.from(excludedSet),
        sourceCount,
        includedCount,
        excludedCount: excludedSet.size,
      };
    },
    [getLicenseExcludeSetForRow]
  );

  const [coCodeConfig, setCoCodeConfig] = useState(null);
  const [coCodeForm, setCoCodeForm] = useState({ whitelist: "", blacklist: "" });
  const [coCodeLoading, setCoCodeLoading] = useState(false);
  const [coCodeSaving, setCoCodeSaving] = useState(false);
  const [coCodeError, setCoCodeError] = useState("");
  const [coCodeMessage, setCoCodeMessage] = useState("");

  const [coDiscrepancyConfig, setCoDiscrepancyConfig] = useState(null);
  const [coDiscrepancyState, setCoDiscrepancyState] = useState(null);
  const [coDiscrepancyForm, setCoDiscrepancyForm] = useState({
    enabled: false,
    cron: "",
    rangeDays: 3,
    threshold: 10,
    sampleLimit: 500,
  });
  const [coDiscrepancyRange, setCoDiscrepancyRange] = useState({ from: "", to: "" });
  const [coDiscrepancyLoading, setCoDiscrepancyLoading] = useState(false);
  const [coDiscrepancySaving, setCoDiscrepancySaving] = useState(false);
  const [coDiscrepancyRunning, setCoDiscrepancyRunning] = useState(false);
  const [coDiscrepancyError, setCoDiscrepancyError] = useState("");
  const [coDiscrepancyMessage, setCoDiscrepancyMessage] = useState("");

  useEffect(() => {
    setPreviewRows([]);
    setPreviewLimited(false);
    setPreviewError("");
    setPreviewRangeInfo(null);
  }, [manualRange.from, manualRange.to]);

  const loadSavedRows = useCallback((opts = {}) => {
    const { bypassConfirm = false } = opts;
    if (!bypassConfirm && hasUnsaved && mode === "saved") {
      const shouldDiscard = window.confirm(
        "Bạn có các thay đổi chưa lưu. Tiếp tục sẽ bỏ qua các chỉnh sửa đó. Bạn có muốn tiếp tục?"
      );
      if (!shouldDiscard) {
        if (fileRef.current) fileRef.current.value = "";
        return false;
      }
    }
    const activeRules = loadRules();
    setRules(activeRules);
    const saved = sortDeclRows(getDeclRows()).map(ensureLicenseFields).map(ensureCOFields);
    setRawRows(saved);
    setMode("saved");
    setPage(1);
    setPageSize(DEFAULT_PAGE_SIZE);
    setQuery("");
    setSelectedFile("");
    setFilterNoStaff(false);
    setFilterNoTeam(false);
    setFilterDuplicate11(false);
    setCoFilterMode("all");
    setCoFilterMin(5);
    setSelectedKeys([]);
    setHasUnsaved(false);
    if (fileRef.current) fileRef.current.value = "";
    return true;
  }, [fileRef, hasUnsaved, mode]);

  useEffect(() => {
    if (mode !== "saved") return;
    if (hasUnsaved) return;
    if (rawRows.length > 0) return;
    loadSavedRows({ bypassConfirm: true });
  }, [loadSavedRows, mode, hasUnsaved, rawRows.length]);

  useEffect(() => {
    if (mode !== "saved") {
      setFilterDuplicate11(false);
    }
  }, [mode]);

  useEffect(() => {
    if (!hasUnsaved) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  const applyConfigToForm = useCallback((config) => {
    const normalizedConfig = {
      ...DEFAULT_SYNC_CONFIG,
      ...(config && typeof config === "object" ? config : {}),
      connection: {
        ...DEFAULT_SYNC_CONFIG.connection,
        ...((config && typeof config === "object" && config.connection && typeof config.connection === "object")
          ? config.connection
          : {}),
      },
    };
    setSyncConfig(normalizedConfig);
    setSyncForm({
      enabled: !!normalizedConfig.enabled,
      schedule: normalizedConfig.schedule || "0 * * * *",
      rangeDays: normalizedConfig.rangeDays ?? 1,
      preferMonthFirst: !!normalizedConfig.preferMonthFirst,
      server: normalizedConfig.connection?.server || "",
      database: normalizedConfig.connection?.database || "",
      user: normalizedConfig.connection?.user || "",
      password: "",
      hasPassword: !!normalizedConfig.connection?.hasPassword,
    });
  }, []);

  const syncCoCodeForm = useCallback((config) => {
    const whitelist = Array.isArray(config?.whitelist) ? config.whitelist : [];
    const blacklist = Array.isArray(config?.blacklist) ? config.blacklist : [];
    const nextConfig = {
      ...(config && typeof config === "object" ? config : {}),
      version: Number.isInteger(config?.version) ? config.version : 1,
      updatedAt: config?.updatedAt || null,
      updatedBy: config?.updatedBy || null,
      whitelist,
      blacklist,
    };
    setCoCodeConfig(nextConfig);
    setCoCodeForm({
      whitelist: joinCodeList(whitelist),
      blacklist: joinCodeList(blacklist),
    });
  }, []);

  const fetchCoCodeConfig = useCallback(async () => {
    setCoCodeLoading(true);
    setCoCodeError("");
    try {
      const response = await fetchWithAuth("/api/import/co-codes", { cache: "no-store", credentials: "include" });
      if (!response.ok) {
        const message = await extractErrorMessage(response, "Không thể tải cấu hình mã ưu đãi C/O.");
        throw new Error(message);
      }
      const payload = await response.json();
      syncCoCodeForm(payload?.config || {});
    } catch (err) {
      console.error("Không thể tải cấu hình mã ưu đãi C/O", err);
      setCoCodeError(err?.message || "Không thể tải cấu hình mã ưu đãi C/O.");
    } finally {
      setCoCodeLoading(false);
    }
  }, [syncCoCodeForm]);

  const handleSaveCoCodeConfig = useCallback(async () => {
    if (!canManageSync) {
      alert("Bạn không có quyền cập nhật cấu hình mã ưu đãi C/O.");
      return;
    }
    setCoCodeSaving(true);
    setCoCodeError("");
    setCoCodeMessage("");
    try {
      const payload = {
        config: {
          whitelist: parseCodeListInput(coCodeForm.whitelist),
          blacklist: parseCodeListInput(coCodeForm.blacklist),
        },
      };
      const response = await fetchWithAuth("/api/import/co-codes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const message = await extractErrorMessage(response, "Không thể lưu cấu hình mã ưu đãi C/O.");
        throw new Error(message);
      }
      const result = await response.json();
      syncCoCodeForm(result?.config || payload.config);
      setCoCodeMessage("Đã lưu cấu hình mã ưu đãi C/O.");
    } catch (err) {
      console.error("Không thể lưu cấu hình mã ưu đãi C/O", err);
      setCoCodeError(err?.message || "Không thể lưu cấu hình mã ưu đãi C/O.");
    } finally {
      setCoCodeSaving(false);
    }
  }, [canManageSync, coCodeForm, syncCoCodeForm]);

  const handleResetCoCodeForm = useCallback(() => {
    if (coCodeConfig) {
      setCoCodeForm({
        whitelist: joinCodeList(coCodeConfig.whitelist),
        blacklist: joinCodeList(coCodeConfig.blacklist),
      });
      setCoCodeError("");
      setCoCodeMessage("");
    } else {
      setCoCodeForm({ whitelist: "", blacklist: "" });
    }
  }, [coCodeConfig]);

  const syncCoDiscrepancyConfig = useCallback((config) => {
    const enabled = config?.enabled === true;
    const cron = (config?.cron || "").trim();
    const rangeDays = Math.max(1, Math.round(Number(config?.rangeDays) || 3));
    const threshold = Math.max(1, Math.round(Number(config?.threshold) || 10));
    const sampleLimitRaw = Number(config?.sampleLimit);
    const sampleLimit = Number.isFinite(sampleLimitRaw) ? Math.max(0, Math.round(sampleLimitRaw)) : 0;
    const nextConfig = {
      ...(config && typeof config === "object" ? config : {}),
      enabled,
      cron,
      rangeDays,
      threshold,
      sampleLimit,
      updatedAt: config?.updatedAt || null,
      updatedBy: config?.updatedBy || null,
    };
    setCoDiscrepancyConfig(nextConfig);
    setCoDiscrepancyForm({
      enabled,
      cron,
      rangeDays,
      threshold,
      sampleLimit,
    });
  }, []);

  const fetchCoDiscrepancy = useCallback(async () => {
    setCoDiscrepancyLoading(true);
    setCoDiscrepancyError("");
    try {
      const response = await fetchWithAuth("/api/import/co-discrepancy", { cache: "no-store", credentials: "include" });
      if (!response.ok) {
        const message = await extractErrorMessage(response, "Không thể tải trạng thái đối soát C/O.");
        throw new Error(message);
      }
      const payload = await response.json();
      syncCoDiscrepancyConfig(payload?.config || {});
      setCoDiscrepancyState(payload?.state || null);
    } catch (err) {
      console.error("Không thể tải trạng thái đối soát C/O", err);
      setCoDiscrepancyError(err?.message || "Không thể tải trạng thái đối soát C/O.");
    } finally {
      setCoDiscrepancyLoading(false);
    }
  }, [syncCoDiscrepancyConfig]);

  const handleSaveCoDiscrepancyConfig = useCallback(async () => {
    if (!canManageSync) {
      alert("Bạn không có quyền cập nhật cấu hình đối soát C/O.");
      return;
    }
    setCoDiscrepancySaving(true);
    setCoDiscrepancyError("");
    setCoDiscrepancyMessage("");
    try {
      const payload = {
        config: {
          enabled: !!coDiscrepancyForm.enabled,
          cron: (coDiscrepancyForm.cron || "").trim(),
          rangeDays: Math.max(1, Math.round(Number(coDiscrepancyForm.rangeDays) || 1)),
          threshold: Math.max(1, Math.round(Number(coDiscrepancyForm.threshold) || 1)),
          sampleLimit: Math.max(0, Math.round(Number(coDiscrepancyForm.sampleLimit) || 0)),
        },
      };
      const response = await fetchWithAuth("/api/import/co-discrepancy/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const message = await extractErrorMessage(response, "Không thể lưu cấu hình đối soát C/O.");
        throw new Error(message);
      }
      const result = await response.json();
      syncCoDiscrepancyConfig(result?.config || payload.config);
      setCoDiscrepancyMessage("Đã lưu cấu hình đối soát C/O.");
    } catch (err) {
      console.error("Không thể lưu cấu hình đối soát C/O", err);
      setCoDiscrepancyError(err?.message || "Không thể lưu cấu hình đối soát C/O.");
    } finally {
      setCoDiscrepancySaving(false);
    }
  }, [canManageSync, coDiscrepancyForm, syncCoDiscrepancyConfig]);

  const handleResetCoDiscrepancyForm = useCallback(() => {
    if (!coDiscrepancyConfig) return;
    setCoDiscrepancyForm({
      enabled: !!coDiscrepancyConfig.enabled,
      cron: coDiscrepancyConfig.cron || "",
      rangeDays: coDiscrepancyConfig.rangeDays || 3,
      threshold: coDiscrepancyConfig.threshold || 10,
      sampleLimit: coDiscrepancyConfig.sampleLimit || 0,
    });
    setCoDiscrepancyError("");
    setCoDiscrepancyMessage("");
  }, [coDiscrepancyConfig]);

  const handleRunCoDiscrepancy = useCallback(async () => {
    if (!canManageSync) {
      alert("Bạn không có quyền chạy đối soát C/O.");
      return;
    }
    setCoDiscrepancyRunning(true);
    setCoDiscrepancyError("");
    setCoDiscrepancyMessage("");
    try {
      const payload = {};
      if (coDiscrepancyRange.from || coDiscrepancyRange.to) {
        payload.range = {
          from: coDiscrepancyRange.from || undefined,
          to: coDiscrepancyRange.to || undefined,
        };
      }
      const response = await fetchWithAuth("/api/import/co-discrepancy/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const message = await extractErrorMessage(response, "Không thể chạy đối soát C/O.");
        throw new Error(message);
      }
      const result = await response.json();
      if (result?.result?.config) {
        syncCoDiscrepancyConfig(result.result.config);
      }
      if (result?.result?.state) {
        setCoDiscrepancyState(result.result.state);
      }
      setCoDiscrepancyMessage("Đã chạy đối soát C/O thành công.");
    } catch (err) {
      console.error("Không thể chạy đối soát C/O", err);
      setCoDiscrepancyError(err?.message || "Không thể chạy đối soát C/O.");
    } finally {
      setCoDiscrepancyRunning(false);
    }
  }, [canManageSync, coDiscrepancyRange, syncCoDiscrepancyConfig]);

  const handleRefreshCoCodeConfig = useCallback(() => {
    fetchCoCodeConfig();
  }, [fetchCoCodeConfig]);

  const handleRefreshCoDiscrepancy = useCallback(() => {
    fetchCoDiscrepancy();
  }, [fetchCoDiscrepancy]);

  const fetchSyncConfig = useCallback(async () => {
    setSyncLoading(true);
    setSyncError("");
    try {
      const response = await fetchWithAuth("/api/import/ecus/config", { cache: "no-store", credentials: "include" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      if (payload?.config) {
        applyConfigToForm(payload.config);
        setSyncMessage("Đã tải cấu hình đồng bộ mới nhất.");
      } else {
        setSyncMessage("Không tìm thấy cấu hình lưu trữ, sử dụng giá trị mặc định.");
        applyConfigToForm(DEFAULT_SYNC_CONFIG);
      }
    } catch (err) {
      console.error("Không thể tải cấu hình đồng bộ ECUS", err);
      setSyncError(
        "Không thể tải cấu hình đồng bộ ECUS. Hãy kiểm tra dịch vụ backend (pnpm server) hoặc kết nối mạng LAN."
      );
      setSyncMessage("");
      applyConfigToForm(DEFAULT_SYNC_CONFIG);
    } finally {
      setSyncLoading(false);
    }
  }, [applyConfigToForm]);

  const fetchSyncStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError("");
    try {
      const response = await fetchWithAuth("/api/import/ecus/status", { cache: "no-store", credentials: "include" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      setStatusInfo({
        backend: payload?.backend || null,
        database: payload?.database || null,
        checkedAt:
          payload?.database?.checkedAt || payload?.backend?.checkedAt || new Date().toISOString(),
      });
      if (payload?.config) {
        applyConfigToForm(payload.config);
      }
    } catch (err) {
      console.error("Không thể tải trạng thái đồng bộ", err);
      setStatusError("Không thể kiểm tra kết nối backend/SQL Server.");
    } finally {
      setStatusLoading(false);
    }
  }, [applyConfigToForm]);

  const fetchAlerts = useCallback(async () => {
    setAlertLoading(true);
    try {
      const response = await fetchWithAuth("/api/import/alerts", { cache: "no-store", credentials: "include" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      if (payload?.alerts) {
        setAlertEntries(Array.isArray(payload.alerts) ? payload.alerts : []);
      }
      if (payload?.summary) {
        setAlertSummary(payload.summary);
      }
    } catch (err) {
      console.error("Không thể tải cảnh báo tờ khai", err);
    } finally {
      setAlertLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSyncConfig();
    fetchAlerts();
    fetchSyncStatus();
    fetchCoCodeConfig();
    fetchCoDiscrepancy();
  }, [fetchSyncConfig, fetchAlerts, fetchSyncStatus, fetchCoCodeConfig, fetchCoDiscrepancy]);

  const handleSaveSyncConfig = useCallback(async () => {
    if (!canManageSync) {
      alert("Bạn không có quyền cập nhật cấu hình đồng bộ.");
      return;
    }
    if (!syncForm) return;
    setSyncLoading(true);
    setSyncMessage("");
    setSyncError("");
    try {
      const payload = {
        config: {
          enabled: !!syncForm.enabled,
          schedule: syncForm.schedule || "0 * * * *",
          rangeDays: Number(syncForm.rangeDays) || 1,
          preferMonthFirst: !!syncForm.preferMonthFirst,
          connection: {
            server: syncForm.server || "",
            database: syncForm.database || "",
            user: syncForm.user || "",
          },
        },
        preservePassword: !syncForm.password && syncForm.hasPassword,
      };
      if (syncForm.password) {
        payload.config.connection.password = syncForm.password;
      }
      if (syncConfig?.columnMap) {
        payload.config.columnMap = syncConfig.columnMap;
      }
      const response = await fetchWithAuth("/api/import/ecus/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const next = await response.json();
      if (next?.config) {
        applyConfigToForm(next.config);
        setSyncMessage("Đã lưu cấu hình đồng bộ ECUS.");
      }
    } catch (err) {
      console.error("Không thể lưu cấu hình ECUS", err);
      setSyncError(err?.message || "Không thể lưu cấu hình đồng bộ");
    } finally {
      setSyncLoading(false);
    }
  }, [applyConfigToForm, canManageSync, syncConfig, syncForm]);

  const handleRunSync = useCallback(async () => {
    if (!canManageSync) {
      alert("Bạn không có quyền chạy đồng bộ ECUS.");
      return;
    }
    if (!manualRange.from && !manualRange.to) {
      const confirmDefault = window.confirm(
        "Bạn chưa chọn khoảng thời gian cụ thể. Hệ thống sẽ dùng số ngày mặc định trong cấu hình (RangeDays). Bạn có muốn tiếp tục?"
      );
      if (!confirmDefault) {
        return;
      }
    }
    setSyncRunning(true);
    setSyncMessage("Đang đồng bộ...");
    setSyncError("");
    try {
      const response = await fetchWithAuth("/api/import/ecus/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor,
          from: manualRange.from || undefined,
          to: manualRange.to || undefined,
        }),
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      const imported = payload?.result?.imported ?? 0;
      const skipped = payload?.result?.skipped ?? 0;
      const skippedNote = skipped > 0 ? `, bỏ qua ${skipped} tờ khai đã có` : '';
      setSyncMessage(`Đã đồng bộ ${imported} tờ khai mới từ ECUS${skippedNote}.`);
      setPreviewRows([]);
      setPreviewRangeInfo(null);
      setPreviewLimited(false);
      setPreviewError("");
      await fetchSyncConfig();
      await fetchSyncStatus();
      await fetchAlerts();
      await fetchCoDiscrepancy();
      loadSavedRows({ bypassConfirm: true });
    } catch (err) {
      console.error("Đồng bộ ECUS thất bại", err);
      setSyncMessage("");
      setSyncError(err?.message || "Không thể đồng bộ ECUS");
    } finally {
      setSyncRunning(false);
    }
  }, [
    actor,
    canManageSync,
    fetchAlerts,
    fetchCoDiscrepancy,
    fetchSyncConfig,
    fetchSyncStatus,
    loadSavedRows,
    manualRange.from,
    manualRange.to,
  ]);

  const handlePreviewSync = useCallback(async () => {
    if (!canManageSync) {
      alert("Bạn không có quyền xem trước dữ liệu đồng bộ.");
      return;
    }
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const response = await fetchWithAuth("/api/import/ecus/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: manualRange.from || undefined,
          to: manualRange.to || undefined,
          limit: 100,
        }),
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      const rows = Array.isArray(payload?.preview?.rows) ? payload.preview.rows : [];
      setPreviewRows(rows);
      setPreviewLimited(!!payload?.preview?.limited);
      setPreviewRangeInfo(payload?.preview?.range || null);
      if (!rows.length) {
        setPreviewError("Không tìm thấy tờ khai mới trong khoảng thời gian đã chọn.");
      }
    } catch (err) {
      console.error("Không thể xem trước dữ liệu ECUS", err);
      setPreviewError(err?.message || "Không thể xem trước dữ liệu đồng bộ");
      setPreviewRows([]);
      setPreviewLimited(false);
      setPreviewRangeInfo(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [canManageSync, manualRange.from, manualRange.to]);

  const handleManualRangeChange = useCallback((field, value) => {
    setManualRange((prev) => ({ ...prev, [field]: value }));
  }, []);

  const applyRangePreset = useCallback((days) => {
    const totalDays = Math.max(0, Number(days) || 0);
    const end = new Date();
    const start = new Date(end.getTime() - totalDays * 24 * 60 * 60 * 1000);
    setManualRange({
      from: toDateInputValue(start),
      to: toDateInputValue(end),
    });
  }, []);

  const handleRefreshAlerts = useCallback(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleMarkReviewed = useCallback(async () => {
    if (!canReviewAlerts) {
      alert("Bạn không có quyền đánh dấu đã rà soát các tờ khai.");
      return;
    }
    if (mode !== "saved") {
      alert("Chỉ đánh dấu rà soát khi đang xem dữ liệu đã lưu.");
      return;
    }
    if (selectedKeys.length === 0) {
      alert("Chưa chọn tờ khai để đánh dấu.");
      return;
    }
    const allowedKeys = ensureEditableKeys(selectedKeys, "đánh dấu rà soát");
    if (!allowedKeys) {
      return;
    }
    const updated = markDeclRowsReviewed(allowedKeys, { actor });
    if (updated === 0) {
      alert("Các tờ khai đã được đánh dấu hoặc không tìm thấy.");
    }
    try {
      await fetchWithAuth("/api/import/alerts/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: allowedKeys, actor }),
        credentials: "include",
      });
    } catch (err) {
      console.warn("Không thể đồng bộ trạng thái rà soát với máy chủ", err);
    }
    setSelectedKeys([]);
    setHasUnsaved(false);
    loadSavedRows({ bypassConfirm: true });
    fetchAlerts();
  }, [
    actor,
    canReviewAlerts,
    ensureEditableKeys,
    fetchAlerts,
    loadSavedRows,
    mode,
    selectedKeys,
  ]);

  const summaryStats = useMemo(() => {
    if (!Array.isArray(rawRows) || rawRows.length === 0 || mode !== "saved") {
      return { total: rawRows.length, missingStaff: 0, missingTeam: 0, reviewed: 0 };
    }
    let missingStaff = 0;
    let missingTeam = 0;
    let reviewed = 0;
    for (const row of rawRows) {
      if (!row) continue;
      const hasStaff = !!(row.nhan_vien && row.nhan_vien.toString().trim());
      const hasTeam = !!(row.team && row.team.toString().trim());
      if (!hasStaff) missingStaff += 1;
      if (!hasTeam) missingTeam += 1;
      if (row.reviewed) reviewed += 1;
    }
    return { total: rawRows.length, missingStaff, missingTeam, reviewed };
  }, [mode, rawRows]);

  const outstandingAlerts = useMemo(() => {
    return alertEntries.filter((entry) => !entry.resolved).slice(0, 5);
  }, [alertEntries]);

  const summaryCards = useMemo(() => [
    { label: "Tổng tờ khai (đang xem)", value: summaryStats.total },
    { label: "Chưa gán nhân viên", value: summaryStats.missingStaff },
    { label: "Chưa gán tổ đội", value: summaryStats.missingTeam },
    { label: "Đã rà soát", value: summaryStats.reviewed },
    { label: "Cảnh báo chờ xử lý", value: alertSummary.outstanding || 0 },
  ], [alertSummary.outstanding, summaryStats]);

  const lastAlertEvaluated = useMemo(() => {
    if (!alertSummary.lastEvaluatedAt) return "Chưa tính";
    try {
      return new Date(alertSummary.lastEvaluatedAt).toLocaleString("vi-VN");
    } catch {
      return alertSummary.lastEvaluatedAt;
    }
  }, [alertSummary.lastEvaluatedAt]);

  const syncLastRunLabel = useMemo(() => {
    if (!syncConfig?.lastRun) return "Chưa chạy";
    try {
      return new Date(syncConfig.lastRun).toLocaleString("vi-VN");
    } catch {
      return syncConfig.lastRun;
    }
  }, [syncConfig?.lastRun]);

  const lastSyncSummary = syncConfig?.lastSummary || null;
  const lastSyncRangeLabel = useMemo(
    () => formatDateRangeLabel(lastSyncSummary?.range ?? null),
    [lastSyncSummary?.range],
  );
  const lastSyncRunAtLabel = useMemo(
    () => (lastSyncSummary?.runAt ? formatDisplayDate(lastSyncSummary.runAt) : ""),
    [lastSyncSummary?.runAt],
  );
  const lastSyncFetched = lastSyncSummary?.rowsFetched ?? 0;
  const lastSyncInserted = lastSyncSummary?.rowsInserted ?? lastSyncSummary?.rowsImported ?? 0;
  const lastSyncUpdated = lastSyncSummary?.rowsUpdated ?? 0;
  const lastSyncSkipped = lastSyncSummary?.rowsSkipped ?? 0;
  const lastSyncTotal = lastSyncSummary?.totalStored ?? 0;
  const updatedDeclarations = useMemo(
    () => (Array.isArray(lastSyncSummary?.updatedDeclarations) ? lastSyncSummary.updatedDeclarations : []),
    [lastSyncSummary?.updatedDeclarations],
  );
  const updatedKeys = useMemo(
    () => (Array.isArray(lastSyncSummary?.updatedKeys) ? lastSyncSummary.updatedKeys : []),
    [lastSyncSummary?.updatedKeys],
  );
  const updatedKeySet = useMemo(() => new Set(updatedKeys), [updatedKeys]);
  const updatedPreview = useMemo(() => updatedDeclarations.slice(0, 10), [updatedDeclarations]);
  const coMismatchList = useMemo(
    () => (Array.isArray(coDiscrepancyState?.mismatches) ? coDiscrepancyState.mismatches : []),
    [coDiscrepancyState?.mismatches],
  );
  const coMismatchKeys = useMemo(
    () => coMismatchList.map((item) => item?.key).filter(Boolean),
    [coMismatchList],
  );
  const coMismatchKeySet = useMemo(() => new Set(coMismatchKeys), [coMismatchKeys]);
  const coMismatchPreview = useMemo(() => coMismatchList.slice(0, 10), [coMismatchList]);
  const coDiscrepancyRangeLabel = useMemo(
    () => formatDateRangeLabel(coDiscrepancyState?.range ?? null),
    [coDiscrepancyState?.range],
  );
  const coDiscrepancyLastRunLabel = useMemo(() => {
    if (!coDiscrepancyState?.lastRunAt) return "Chưa chạy";
    try {
      return new Date(coDiscrepancyState.lastRunAt).toLocaleString("vi-VN");
    } catch (err) {
      console.warn("Khong the dinh dang thoi gian chay doi soat CO", coDiscrepancyState?.lastRunAt, err);
      return coDiscrepancyState.lastRunAt;
    }
  }, [coDiscrepancyState?.lastRunAt]);
  const coMismatchCount = coDiscrepancyState?.mismatchCount ?? coMismatchList.length;
  const coCheckedCount = coDiscrepancyState?.totalChecked ?? 0;
  const coMismatchLimited = coDiscrepancyState?.limited === true;
  const showUpdatedBanner = lastSyncUpdated > 0 || updatedDeclarations.length > 0;
  const coCodeUpdatedLabel = useMemo(() => {
    if (!coCodeConfig?.updatedAt) return "Chưa có cấu hình tùy chỉnh.";
    try {
      const time = new Date(coCodeConfig.updatedAt).toLocaleString("vi-VN");
      const actor = coCodeConfig.updatedBy || "hệ thống";
      return `Cập nhật lần cuối: ${time} (${actor})`;
    } catch (err) {
      console.warn("Khong the dinh dang thoi gian cap nhat cau hinh CO", coCodeConfig?.updatedAt, err);
      return `Cập nhật lần cuối: ${coCodeConfig.updatedAt}`;
    }
  }, [coCodeConfig?.updatedAt, coCodeConfig?.updatedBy]);
  const coDiscrepancyStatusLabel = coDiscrepancyState?.status || "idle";
  const lastSyncSummaryCard = useMemo(() => {
    if (!lastSyncSummary) return null;
    return (
      <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">
        <div className="font-medium text-emerald-800">Ket qua dong bo gan nhat</div>
        <div className="mt-1 flex flex-wrap gap-3">
          {lastSyncRangeLabel && <span>Khoang: {lastSyncRangeLabel}</span>}
          {lastSyncRunAtLabel && <span>Run: {lastSyncRunAtLabel}</span>}
          <span>Thu thap: {lastSyncFetched.toLocaleString("vi-VN")}</span>
          <span>Them moi: {lastSyncInserted.toLocaleString("vi-VN")}</span>
          <span>Cap nhat: {lastSyncUpdated.toLocaleString("vi-VN")}</span>
          <span>Bo qua: {lastSyncSkipped.toLocaleString("vi-VN")}</span>
          <span>Tong: {lastSyncTotal.toLocaleString("vi-VN")}</span>
        </div>
      </div>
    );
  }, [lastSyncSummary, lastSyncRangeLabel, lastSyncRunAtLabel, lastSyncFetched, lastSyncInserted, lastSyncUpdated, lastSyncSkipped, lastSyncTotal]);

  const handleSelectUpdated = useCallback(() => {
    if (mode !== "saved") {
      alert("Chi co the chon khi dang xem du lieu da luu.");
      return;
    }
    if (!updatedKeySet.size) {
      return;
    }
    setSelectedKeys(Array.from(updatedKeySet));
    setPage(1);
  }, [mode, updatedKeySet, setPage, setSelectedKeys]);

  const handleSelectCoMismatches = useCallback(() => {
    if (mode !== "saved") {
      alert("Chi co the chon khi dang xem du lieu da luu.");
      return;
    }
    if (!coMismatchKeySet.size) {
      return;
    }
    setSelectedKeys(Array.from(coMismatchKeySet));
    setPage(1);
  }, [mode, coMismatchKeySet, setPage, setSelectedKeys]);

  // Đọc file XLSX
  function handleFileChange(e) {
    if (isReadOnlyForEdits) {
      alert("Bạn đang ở chế độ chỉ xem — hãy đăng nhập để import dữ liệu.");
      return;
    }
    if (!canUploadFiles) {
      alert("Tài khoản của bạn không được phép import XLSX. Vui lòng liên hệ quản trị viên nếu cần cấp quyền.");
      return;
    }
    if (hasUnsaved && mode === "saved") {
      const proceed = window.confirm(
        "Bạn có các thay đổi chưa lưu. Chọn file mới sẽ làm mất các chỉnh sửa đó. Bạn có chắc chắn muốn tiếp tục?"
      );
      if (!proceed) {
        if (fileRef.current) fileRef.current.value = "";
        e.target.value = "";
        return;
      }
    }
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const wb = XLSX.read(reader.result, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: "" });
      const loadedRules = loadRules();
      setRules(loadedRules);
      const excludeCodes = Array.isArray(loadedRules?.license?.exclude?.codes)
        ? loadedRules.license.exclude.codes
        : [];
      const dateOrder = detectDateOrder(rows);
      const preferMonthFirst = dateOrder === "mdy";
      const roster = getTeamRoster();
      const memberMap = mapMemberNamesToTeams(roster);
      const agencyMap = mapHQAgenciesByMST();

      const mapped = rows
        .map(r =>
          mapRow(r, {
            autoAssignStaff,
            rules: loadedRules,
            licenseExcludes: excludeCodes,
            preferMonthFirst,
            memberMap,
            agencyMap,
          })
        )
        .map(ensureLicenseFields)
        .filter(r => r.so_tk && r.date);

      setRawRows(sortDeclRows(mapped));
      setPage(1);
      setPageSize(DEFAULT_PAGE_SIZE);
      setMode("preview");
      setSelectedFile(f.name || "");
      setQuery("");
      setFilterNoStaff(false);
      setFilterNoTeam(false);
      setCoFilterMode("all");
      setCoFilterMin(5);
      setSelectedKeys([]);
      setHasUnsaved(false);
    };
    reader.readAsArrayBuffer(f);
  }

  // Tìm nhanh
  const coThreshold = useMemo(() => Math.max(0, Number(coFilterMin) || 0), [coFilterMin]);
  const coFilterActive = useMemo(() => {
    if (coFilterMode === "has") return true;
    if (coFilterMode === "min") return coThreshold > 0;
    return false;
  }, [coFilterMode, coThreshold]);

  const coFilterMatches = useMemo(() => {
    if (!coFilterActive) return rawRows.length;
    return rawRows.reduce((count, row) => {
      const lines = coLineCount(row);
      if (coFilterMode === "has") {
        return count + (lines > 0 ? 1 : 0);
      }
      if (coFilterMode === "min") {
        return count + (lines >= coThreshold ? 1 : 0);
      }
      return count;
    }, 0);
  }, [rawRows, coFilterMode, coFilterActive, coThreshold]);

  const keyOfRow = useCallback((row) => {
    const soTk = (row?.so_tk || "").toString();
    const nhanh = (row?.nhanh || "").toString();
    return `${soTk}_${nhanh}`;
  }, []);

  const filterEditableKeys = useCallback(
    (keys) => {
      if (!Array.isArray(keys) || keys.length === 0) {
        return { allowed: [], blocked: 0 };
      }
      const target = new Set(keys);
      const allowed = [];
      let blocked = 0;
      for (const row of rawRows) {
        const key = keyOfRow(row);
        if (!target.has(key)) continue;
        if (isRowEditable(row)) {
          allowed.push(key);
        } else {
          blocked += 1;
        }
      }
      return { allowed, blocked };
    },
    [isRowEditable, keyOfRow, rawRows]
  );

  const ensureEditableKeys = useCallback(
    (keys, actionLabel = "thao tác") => {
      const { allowed, blocked } = filterEditableKeys(keys);
      if (!allowed.length) {
        if (blocked > 0 && editingRestrictionMessage) {
          alert(editingRestrictionMessage);
        } else if (keys?.length) {
          alert("Không tìm thấy tờ khai phù hợp để xử lý.");
        }
        return null;
      }
      if (blocked > 0 && editingRestrictionMessage) {
        alert(`Đã bỏ qua ${blocked} tờ khai không thuộc phạm vi của bạn khi ${actionLabel}.`);
      }
      return allowed;
    },
    [editingRestrictionMessage, filterEditableKeys]
  );

  const duplicate11Summary = useMemo(() => {
    const counts = new Map();
    const groupsMap = new Map();
    for (const row of rawRows) {
      const prefix = extractDuplicatePrefix(row);
      if (!prefix) continue;
      counts.set(prefix, (counts.get(prefix) || 0) + 1);
      if (!groupsMap.has(prefix)) {
        groupsMap.set(prefix, [row]);
      } else {
        groupsMap.get(prefix).push(row);
      }
    }

    let groups = 0;
    let totalRows = 0;
    const removalKeys = [];
    const duplicatesSet = new Set();
    const keptKeys = new Set();
    const details = [];

    for (const [, list] of groupsMap.entries()) {
      if (!Array.isArray(list) || list.length <= 1) continue;
      groups += 1;
      totalRows += list.length;
      const sorted = [...list].sort(compareDuplicateCandidates);
      const keeper = sorted[0];
      if (keeper) {
        keptKeys.add(keyOfRow(keeper));
      }
      const candidates = sorted.map((entry, index) => {
        const key = keyOfRow(entry);
        const weight = computeDuplicateWeight(entry);
        const tsDetail = weight.timestampDetail ?? extractRowTimestampDetail(entry);
        const source = inferRowSource(entry);
        return {
          key,
          index,
          row: entry,
          label: formatDeclarationLabel(entry),
          score: weight.score,
          status: describeRowStatus(entry),
          staff: entry.nhan_vien || "",
          team: entry.team || "",
          kpi: Number.isFinite(Number(entry?.kpi)) ? Number(entry.kpi) : null,
          sourceLabel: source.label,
          sourceCode: source.code,
          timestampDisplay: tsDetail.display,
          timestampLabel: tsDetail.label,
          timestampISO: tsDetail.iso,
        };
      });
      for (const item of sorted.slice(1)) {
        const key = keyOfRow(item);
        duplicatesSet.add(key);
        removalKeys.push(key);
      }
      const firstTimestamp = candidates[0]?.timestampDisplay || "Không xác định";
      const firstLabel = candidates[0]?.timestampLabel || "Thời gian cập nhật";
      details.push({
        prefix: formatDuplicateGroupLabel(list[0]),
        rawPrefix: extractDuplicatePrefix(list[0]),
        total: candidates.length,
        keeperKey: keeper ? keyOfRow(keeper) : null,
        keeperLabel: candidates[0]?.label || "",
        referenceTimestamp: firstTimestamp,
        referenceTimestampLabel: firstLabel,
        items: candidates,
      });
    }

    return {
      counts,
      groups,
      totalRows,
      removalKeys,
      duplicatesSet,
      keptKeys,
      details,
      hasDuplicates: groups > 0,
    };
  }, [rawRows, keyOfRow]);

  const duplicate11GroupCount = duplicate11Summary.groups;
  const duplicate11TotalRows = duplicate11Summary.totalRows;
  const duplicate11DuplicatesSet = duplicate11Summary.duplicatesSet;
  const duplicate11KeeperSet = duplicate11Summary.keptKeys;
  const duplicate11Details = duplicate11Summary.details;
  const hasDuplicate11Rows = duplicate11Summary.hasDuplicates;

  useEffect(() => {
    if (!Array.isArray(duplicate11Details) || duplicate11Details.length === 0) {
      setDuplicate11Plan({});
      return;
    }
    setDuplicate11Plan((prev) => {
      const next = {};
      for (const group of duplicate11Details) {
        const prevEntry = prev[group.rawPrefix] || {};
        const availableKeys = new Set(group.items.map((item) => item.key));
        const fallbackKeeper = group.keeperKey || group.items[0]?.key || null;
        const keeperKey = availableKeys.has(prevEntry.keeperKey) ? prevEntry.keeperKey : fallbackKeeper;
        const merges = {};
        for (const field of DUPLICATE_MERGE_FIELDS) {
          const previous = prevEntry.merges?.[field.key];
          merges[field.key] = availableKeys.has(previous) ? previous : keeperKey;
        }
        next[group.rawPrefix] = {
          keeperKey,
          merges,
          resolution: prevEntry.resolution === "review" ? "review" : "delete",
          note: prevEntry.note || "",
        };
      }
      return next;
    });
  }, [duplicate11Details]);

  const duplicate11PlanStats = useMemo(() => {
    if (!Array.isArray(duplicate11Details) || duplicate11Details.length === 0) {
      return { deleteGroups: 0, reviewGroups: 0, removalCount: 0 };
    }
    let deleteGroups = 0;
    let reviewGroups = 0;
    let removalCount = 0;
    for (const group of duplicate11Details) {
      const plan = duplicate11Plan[group.rawPrefix];
      const items = Array.isArray(group.items) ? group.items : [];
      if (!items.length) continue;
      if (plan?.resolution === "review") {
        reviewGroups += 1;
        continue;
      }
      deleteGroups += 1;
      const keeperKey = plan?.keeperKey && items.some((item) => item.key === plan.keeperKey)
        ? plan.keeperKey
        : group.keeperKey || items[0].key;
      removalCount += items.filter((item) => item.key !== keeperKey).length;
    }
    return { deleteGroups, reviewGroups, removalCount };
  }, [duplicate11Details, duplicate11Plan]);
  const {
    deleteGroups: duplicate11PlannedDeleteGroups,
    reviewGroups: duplicate11PlannedReviewGroups,
    removalCount: duplicate11PlannedRemovalCount,
  } = duplicate11PlanStats;
  const duplicate11PlanHasActions = duplicate11PlannedDeleteGroups > 0 || duplicate11PlannedReviewGroups > 0;

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const hasText = q.length > 0;
    const fromDate = searchRange.from ? normalizeStr(searchRange.from) : "";
    const toDate = searchRange.to ? normalizeStr(searchRange.to) : "";
    return rawRows.filter(r => {
      const soTk = (r.so_tk || "").toString().toLowerCase();
      const mst = (r.mst || "").toString().toLowerCase();
      const company = (r.cong_ty || "").toString().toLowerCase();
      const agencySearch = [
        r.agency || r.dai_ly || '',
        ...(Array.isArray(r.agents) ? r.agents : []),
      ]
        .join(' ')
        .toLowerCase();
      if (hasText && !(
        soTk.includes(q) ||
        mst.includes(q) ||
        company.includes(q) ||
        agencySearch.includes(q)
      )) {
        return false;
      }
      if (fromDate || toDate) {
        const rawDate = normalizeStr(r.date || r.raw_date || "").slice(0, 10);
        if (fromDate && (!rawDate || rawDate < fromDate)) {
          return false;
        }
        if (toDate && (!rawDate || rawDate > toDate)) {
          return false;
        }
      }
      if (filterNoStaff) {
        const hasStaff = Boolean((r.nhan_vien || "").toString().trim());
        if (hasStaff) return false;
      }
      if (filterNoTeam) {
        const hasTeam = Boolean((r.team || "").toString().trim());
        if (hasTeam) return false;
      }
      const lines = coLineCount(r);
      if (coFilterMode === "has" && lines <= 0) {
        return false;
      }
      if (coFilterMode === "min") {
        if (coThreshold > 0 && lines < coThreshold) {
          return false;
        }
      }
      if (filterDuplicate11) {
        const prefix = extractDuplicatePrefix(r);
        if (!prefix) return false;
        const count = duplicate11Summary.counts.get(prefix) || 0;
        if (count <= 1) {
          return false;
        }
      }
      return true;
    });
  }, [
    rawRows,
    query,
    filterNoStaff,
    filterNoTeam,
    filterDuplicate11,
    duplicate11Summary,
    coFilterMode,
    coThreshold,
    searchRange.from,
    searchRange.to,
  ]);

  // Phân trang
  const total = filtered.length;
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, maxPage);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [safePage, page]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, filterNoStaff, filterNoTeam, filterDuplicate11, coFilterMode, coThreshold, searchRange.from, searchRange.to]);

  const filteredKeys = useMemo(() => {
    return Array.from(new Set(filtered.map((row) => keyOfRow(row))));
  }, [filtered, keyOfRow]);

  const filteredSelected = useMemo(() => {
    if (!filteredKeys.length) return false;
    if (!selectedKeys.length) return false;
    const selectedSet = new Set(selectedKeys);
    return filteredKeys.every((key) => selectedSet.has(key));
  }, [filteredKeys, selectedKeys]);

  useTooltipTitles(rootRef, [
    rawRows,
    filteredKeys,
    selectedKeys,
    coDiscrepancyState,
    syncConfig,
    coCodeConfig,
    coDiscrepancyForm,
    mode,
  ]);

  const applyEdit = useCallback((rowKey, updater) => {
    if (isReadOnlyForEdits) return;
    let didChange = false;
    let pendingSelectionUpdater = null;
    setRawRows(prev => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      const pos = prev.findIndex(row => keyOfRow(row) === rowKey);
      if (pos === -1) return prev;
      const current = prev[pos];
      if (!isRowEditable(current)) {
        if (editingRestrictionMessage && !blockedEditNoticeRef.current.has(rowKey)) {
          blockedEditNoticeRef.current.add(rowKey);
          alert(editingRestrictionMessage);
        }
        return prev;
      }
      const updates = updater(current);
      if (!updates || typeof updates !== "object") return prev;

      let changed = false;
      const nextRow = { ...current };
      for (const [key, value] of Object.entries(updates)) {
        if (nextRow[key] !== value) {
          nextRow[key] = value;
          changed = true;
        }
      }

      if (!changed) return prev;

      nextRow.updatedAt = new Date().toISOString();
      const recalculated = computeKPI(nextRow, rules);
      if (Number.isFinite(recalculated)) {
        nextRow.kpi = Math.round(recalculated * 10) / 10;
      }
      const copy = prev.slice();
      copy[pos] = nextRow;

      const oldKey = keyOfRow(current);
      const newKey = keyOfRow(nextRow);
      if (oldKey !== newKey) {
        pendingSelectionUpdater = (keys) => {
          if (!Array.isArray(keys) || keys.length === 0) return keys;
          if (!keys.includes(oldKey)) return keys;
          return keys.filter((k) => k !== oldKey);
        };
      }

      didChange = true;
      return copy;
    });
    if (pendingSelectionUpdater) {
      setSelectedKeys(pendingSelectionUpdater);
    }
    if (didChange && mode === "saved") {
      setHasUnsaved(true);
    }
  }, [
    blockedEditNoticeRef,
    editingRestrictionMessage,
    isReadOnlyForEdits,
    isRowEditable,
    keyOfRow,
    mode,
    rules,
  ]);

  const onChangeCell = useCallback((rowKey, field, value, transform) => {
    applyEdit(rowKey, (row) => {
      const nextValue = typeof transform === "function" ? transform(value, row) : value;
      if (nextValue === row[field]) return null;
      return { [field]: nextValue };
    });
  }, [applyEdit]);

  const handleToggleSelect = useCallback(
    (row) => {
      if (isReadOnlyForEdits) {
        return;
      }
      if (!isRowEditable(row)) {
        if (editingRestrictionMessage) {
          alert(editingRestrictionMessage);
        }
        return;
      }
      const key = keyOfRow(row);
      setSelectedKeys((prev) => {
        if (prev.includes(key)) {
          return prev.filter((k) => k !== key);
        }
        return [...prev, key];
      });
    },
    [editingRestrictionMessage, isReadOnlyForEdits, isRowEditable, keyOfRow]
  );

  const handleClearSelection = useCallback(() => {
    setSelectedKeys([]);
  }, []);

  const deleteRowsByKeys = useCallback((keys, { alreadyFiltered = false } = {}) => {
    if (!Array.isArray(keys) || keys.length === 0) return;
    let allowedKeys = keys;
    if (!alreadyFiltered) {
      const { allowed, blocked } = filterEditableKeys(keys);
      if (!allowed.length) {
        if (blocked > 0 && editingRestrictionMessage) {
          alert(editingRestrictionMessage);
        }
        return;
      }
      if (blocked > 0 && editingRestrictionMessage) {
        alert(`Đã bỏ qua ${blocked} tờ khai không thuộc phạm vi của bạn khi xóa.`);
      }
      allowedKeys = allowed;
    }
    const keySet = new Set(allowedKeys);
    const remaining = rawRows.filter(row => !keySet.has(keyOfRow(row)));
    const removedCount = rawRows.length - remaining.length;
    if (removedCount <= 0) return;
    saveDeclRows(remaining, {
      overwrite: true,
      actor,
      detail: `Xóa ${removedCount} tờ khai từ giao diện Import Data`,
    });
    alert(`Đã xóa ${removedCount} tờ khai.`);
    setHasUnsaved(false);
    loadSavedRows();
    fetchAlerts();
  }, [
    actor,
    editingRestrictionMessage,
    fetchAlerts,
    filterEditableKeys,
    keyOfRow,
    loadSavedRows,
    rawRows,
  ]);

  const handleDeleteSelected = useCallback(() => {
    if (isReadOnlyForEdits) {
      alert("Bạn không có quyền xóa tờ khai.");
      return;
    }
    if (mode !== "saved") {
      alert("Chỉ có thể xóa khi đang xem dữ liệu đã lưu.");
      return;
    }
    if (selectedKeys.length === 0) {
      alert("Chưa chọn tờ khai để xóa.");
      return;
    }
    const allowedKeys = ensureEditableKeys(selectedKeys, "xóa");
    if (!allowedKeys) {
      return;
    }
    if (!window.confirm(`Bạn chắc chắn muốn xóa ${allowedKeys.length} tờ khai đã chọn?`)) {
      return;
    }
    deleteRowsByKeys(allowedKeys, { alreadyFiltered: true });
  }, [
    deleteRowsByKeys,
    ensureEditableKeys,
    isReadOnlyForEdits,
    mode,
    selectedKeys,
  ]);

  const handleDeleteSingle = useCallback((row) => {
    if (isReadOnlyForEdits) {
      alert("Bạn không có quyền xóa tờ khai.");
      return;
    }
    if (mode !== "saved") {
      alert("Chỉ có thể xóa khi đang xem dữ liệu đã lưu.");
      return;
    }
    if (!isRowEditable(row)) {
      if (editingRestrictionMessage) {
        alert(editingRestrictionMessage);
      }
      return;
    }
    if (!window.confirm("Xóa tờ khai này?")) return;
    deleteRowsByKeys([keyOfRow(row)], { alreadyFiltered: true });
  }, [
    deleteRowsByKeys,
    editingRestrictionMessage,
    isReadOnlyForEdits,
    isRowEditable,
    keyOfRow,
    mode,
  ]);

  function handleImport() {
    if (isReadOnlyForEdits) {
      alert("Bạn không có quyền import dữ liệu. Đăng nhập bằng tài khoản được cấp quyền để tiếp tục.");
      return;
    }
    if (!canUploadFiles) {
      alert("Tài khoản của bạn không được phép import XLSX. Vui lòng liên hệ quản trị viên nếu cần cấp quyền.");
      return;
    }
    if (mode !== "preview") {
      alert("Hãy chọn file XLSX để import.");
      return;
    }
    if (rawRows.length === 0) {
      alert("Không có dữ liệu để import");
      return;
    }
    // Nếu cần upsert theo 11 số đầu → chuẩn hoá so_tk về 11 số đầu
    const rows = upsert11
      ? rawRows.map(r => ({ ...r, so_tk: (r.so_tk || "").toString().slice(0, 11) }))
      : rawRows;

    const effectiveOverwrite = canOverwriteData ? overwrite : false;
    const count = saveDeclRows(rows, {
      overwrite: effectiveOverwrite,
      actor,
      detail: `Import từ ${selectedFile || "file XLSX"}`,
    });
    pushImportLog(`Import XLSX: ${rawRows.length} dòng → sau hợp nhất còn ${count}`);
    alert("Import xong!");
    if (fileRef.current) fileRef.current.value = "";
    loadSavedRows({ bypassConfirm: true });
    fetchAlerts();
  }

  function handleSaveAll() {
    if (isReadOnlyForEdits) {
      alert("Bạn không có quyền lưu chỉnh sửa.");
      return;
    }
    if (mode !== "saved") {
      alert("Chỉ có thể lưu chỉnh sửa khi đang xem dữ liệu đã lưu. Hãy import file hoặc quay lại chế độ dữ liệu đã lưu.");
      return;
    }
    if (rawRows.length === 0) {
      alert("Không có dữ liệu để lưu");
      return;
    }
    const count = saveDeclRows(rawRows, {
      overwrite: true,
      actor,
      detail: "Lưu chỉnh sửa tờ khai thủ công",
    });
    alert(`Đã lưu ${count} bản ghi (ghi đè).`);
    setHasUnsaved(false);
    loadSavedRows({ bypassConfirm: true });
    fetchAlerts();
  }

  const selectionEnabled = mode === "saved" && (canEdit || canManageAlerts);
  const deleteEnabled = canEdit && mode === "saved";
  const baseColumnCount = 14; // thêm cột C/O + Số TK AMA
  const totalColumns = baseColumnCount + (selectionEnabled ? 1 : 0) + (deleteEnabled ? 1 : 0);

  const canImport = !isReadOnlyForEdits && mode === "preview" && rawRows.length > 0;
  const canSave = !isReadOnlyForEdits && mode === "saved" && rawRows.length > 0;
  const canDelete = deleteEnabled && selectedKeys.length > 0;
  const canReview = selectionEnabled && selectedKeys.length > 0 && canReviewAlerts;
  const canResolveDuplicates11 = deleteEnabled && hasDuplicate11Rows;
  const modeLabel = mode === "preview" ? "Đang xem dữ liệu từ file (chưa lưu)" : "Đang xem dữ liệu đã lưu";

  const handleSelectFiltered = useCallback(() => {
    if (!selectionEnabled) {
      alert("Chỉ có thể chọn tờ khai khi đang xem dữ liệu đã lưu.");
      return;
    }
    if (!filteredKeys.length) {
      alert("Không có tờ khai phù hợp với điều kiện lọc hiện tại.");
      return;
    }
    setSelectedKeys(filteredKeys);
    setPage(1);
  }, [selectionEnabled, filteredKeys]);

  const handleToggleDuplicateFilter = useCallback(() => {
    if (!hasDuplicate11Rows) {
      alert("Không có tờ khai trùng 11 số đầu để lọc.");
      return;
    }
    setFilterDuplicate11((prev) => !prev);
    setPage(1);
  }, [hasDuplicate11Rows]);

  const handleChangeDuplicateKeeper = useCallback((prefix, keeperKey) => {
    setDuplicate11Plan((prev) => {
      const current = prev[prefix] || {};
      const merges = { ...(current.merges || {}) };
      const previousKeeper = current.keeperKey;
      for (const field of DUPLICATE_MERGE_FIELDS) {
        if (!merges[field.key] || merges[field.key] === previousKeeper) {
          merges[field.key] = keeperKey;
        }
      }
      return {
        ...prev,
        [prefix]: {
          ...current,
          keeperKey,
          merges,
        },
      };
    });
  }, []);

  const handleChangeDuplicateMerge = useCallback((prefix, field, value) => {
    setDuplicate11Plan((prev) => {
      const current = prev[prefix] || {};
      return {
        ...prev,
        [prefix]: {
          ...current,
          merges: { ...(current.merges || {}), [field]: value },
        },
      };
    });
  }, []);

  const handleChangeDuplicateResolution = useCallback((prefix, resolution) => {
    setDuplicate11Plan((prev) => {
      const current = prev[prefix] || {};
      return {
        ...prev,
        [prefix]: {
          ...current,
          resolution,
        },
      };
    });
  }, []);

  const handleChangeDuplicateNote = useCallback((prefix, note) => {
    setDuplicate11Plan((prev) => {
      const current = prev[prefix] || {};
      return {
        ...prev,
        [prefix]: {
          ...current,
          note,
        },
      };
    });
  }, []);

  const handleDeleteDuplicates11 = useCallback(() => {
    if (isReadOnlyForEdits) {
      alert("Bạn không có quyền xóa tờ khai trùng.");
      return;
    }
    if (mode !== "saved") {
      alert("Chỉ có thể xóa tờ khai trùng khi đang xem dữ liệu đã lưu.");
      return;
    }
    if (!Array.isArray(duplicate11Details) || duplicate11Details.length === 0) {
      alert("Không có nhóm tờ khai trùng để xử lý.");
      return;
    }
    setDuplicateReviewConfirmed(false);
    setDuplicateReviewOpen(true);
  }, [
    isReadOnlyForEdits,
    mode,
    duplicate11Details,
  ]);

  const handleCloseDuplicateReview = useCallback(() => {
    setDuplicateReviewOpen(false);
    setDuplicateReviewConfirmed(false);
  }, []);

  const handleConfirmDuplicateRemoval = useCallback(() => {
    if (!Array.isArray(duplicate11Details) || duplicate11Details.length === 0) {
      alert("Không có nhóm trùng để xử lý.");
      handleCloseDuplicateReview();
      return;
    }

    const nowISO = new Date().toISOString();
    const rowMap = new Map(rawRows.map((row) => [keyOfRow(row), { ...row }]));
    const updates = new Map();
    const removalSet = new Set();
    const auditGroups = [];
    let deleteGroups = 0;
    let reviewGroups = 0;
    let blockedGroups = 0;

    for (const group of duplicate11Details) {
      const plan = duplicate11Plan[group.rawPrefix];
      const items = Array.isArray(group.items) ? group.items : [];
      if (!items.length) continue;
      const allowedItems = items.filter((item) => {
        const original = rowMap.get(item.key);
        return original && isRowEditable(original);
      });
      if (!allowedItems.length) {
        blockedGroups += 1;
        continue;
      }
      const availableKeys = new Set(allowedItems.map((item) => item.key));
      const fallbackKeeper = group.keeperKey || allowedItems[0].key;
      const keeperKey = plan?.keeperKey && availableKeys.has(plan.keeperKey)
        ? plan.keeperKey
        : fallbackKeeper;

      if (plan?.resolution === "review") {
        reviewGroups += 1;
        const note = (plan?.note || "").trim();
        for (const item of allowedItems) {
          const original = rowMap.get(item.key) || {};
          updates.set(item.key, {
            ...original,
            duplicate_review_pending: true,
            duplicate_review_note: note,
            duplicate_review_actor: actor,
            duplicate_review_updated_at: nowISO,
          });
        }
        auditGroups.push({
          prefix: group.rawPrefix,
          label: group.prefix,
          resolution: "review",
          note,
          keys: allowedItems.map((item) => item.key),
        });
        continue;
      }

      deleteGroups += 1;
      const keeperRow = { ...(rowMap.get(keeperKey) || {}) };
      clearDuplicateReviewFlags(keeperRow);
      const merges = plan?.merges || {};
      const mergeMeta = {};
      for (const field of DUPLICATE_MERGE_FIELDS) {
        const chosen = merges[field.key];
        const sourceKey = chosen && availableKeys.has(chosen) ? chosen : keeperKey;
        const source = rowMap.get(sourceKey) || rowMap.get(keeperKey) || {};
        applyMergeField(keeperRow, source, field.key);
        mergeMeta[field.key] = sourceKey;
      }
      updates.set(keeperKey, keeperRow);

      const removedKeys = [];
      for (const item of allowedItems) {
        if (item.key === keeperKey) continue;
        removalSet.add(item.key);
        removedKeys.push(item.key);
      }

      auditGroups.push({
        prefix: group.rawPrefix,
        label: group.prefix,
        resolution: "delete",
        keeperKey,
        removedKeys,
        merges: mergeMeta,
      });
    }

    const removalCount = removalSet.size;
    if (removalCount === 0 && updates.size === 0) {
      alert("Không có thay đổi nào được áp dụng.");
      handleCloseDuplicateReview();
      return;
    }
    if (blockedGroups > 0 && editingRestrictionMessage) {
      alert(`Đã bỏ qua ${blockedGroups} nhóm trùng không thuộc phạm vi phụ trách của bạn.`);
    }

    const nextRows = sortDeclRows(
      rawRows
        .map((row) => {
          const key = keyOfRow(row);
          if (removalSet.has(key)) {
            return null;
          }
          if (updates.has(key)) {
            return { ...row, ...updates.get(key) };
          }
          return row;
        })
        .filter(Boolean)
    );

    const detail = `Xử lý trùng 11 số: ${deleteGroups} nhóm xóa, ${reviewGroups} nhóm đánh dấu rà soát, loại bỏ ${removalCount} bản ghi`;

    saveDeclRows(nextRows, {
      overwrite: true,
      actor,
      detail,
    });
    pushAuditLog({
      actor,
      action: "decl.duplicate.resolve",
      detail,
      meta: {
        groups: auditGroups,
      },
    });
    alert(`Đã ${deleteGroups ? `xóa ${removalCount} bản ghi trong ${deleteGroups} nhóm` : "cập nhật đánh dấu"}${reviewGroups ? `, ${reviewGroups} nhóm được đánh dấu cần rà soát` : ""}.`);
    handleCloseDuplicateReview();
    setDuplicateReviewConfirmed(false);
    loadSavedRows({ bypassConfirm: true });
    fetchAlerts();
  }, [
    actor,
    duplicate11Details,
    duplicate11Plan,
    fetchAlerts,
    handleCloseDuplicateReview,
    editingRestrictionMessage,
    isRowEditable,
    keyOfRow,
    loadSavedRows,
    rawRows,
  ]);

  const applyLicenseExclusionForKeys = useCallback(
    (targetKeys, { alreadyFiltered = false } = {}) => {
      if (mode !== "saved") {
        return { ok: false, reason: "mode", blocked: 0 };
      }
      if (!Array.isArray(targetKeys) || targetKeys.length === 0) {
        return { ok: false, reason: "empty", blocked: 0 };
      }
      let workingKeys = targetKeys;
      let blockedCount = 0;
      if (!alreadyFiltered) {
        const { allowed, blocked } = filterEditableKeys(targetKeys);
        if (!allowed.length) {
          return { ok: false, reason: blocked ? "restricted" : "empty", blocked };
        }
        blockedCount = blocked;
        if (blocked > 0 && editingRestrictionMessage) {
          alert(`Đã bỏ qua ${blocked} tờ khai không thuộc phạm vi của bạn khi đối chiếu giấy phép.`);
        }
        workingKeys = allowed;
      }
      const keySet = new Set(workingKeys);
      if (keySet.size === 0) {
        return { ok: false, reason: "empty", blocked: blockedCount };
      }
    let changed = 0;
    let matchedCount = 0;
    const nextRows = rawRows.map((row) => {
      const rowKey = keyOfRow(row);
      if (!keySet.has(rowKey)) {
        return row;
      }
      matchedCount += 1;
      const excludeSet = getLicenseExcludeSetForRow(row);
      const normalizedSource = new Set(
        [
          ...(Array.isArray(row.licenseSourceCodes) ? row.licenseSourceCodes : []),
          ...(Array.isArray(row.licenseCodes) ? row.licenseCodes : []),
          ...(Array.isArray(row.licenseExcludedCodes) ? row.licenseExcludedCodes : []),
          ...(extractLicenseCodesFromRowObj(row) || []),
        ].map(normalizeLicenseCode).filter(Boolean)
      );
      const effectiveCodes = Array.from(normalizedSource)
        .filter((code) => !excludeSet.has(code))
        .sort((a, b) => a.localeCompare(b));
      const excludedCodes = Array.from(normalizedSource)
        .filter((code) => excludeSet.has(code))
        .sort((a, b) => a.localeCompare(b));
      const currentCodes = Array.isArray(row.licenseCodes)
        ? row.licenseCodes
            .map(normalizeLicenseCode)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
        : Array.from(normalizedSource).sort((a, b) => a.localeCompare(b));
      const currentExcludedCodes = Array.isArray(row.licenseExcludedCodes)
        ? row.licenseExcludedCodes
            .map(normalizeLicenseCode)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
        : [];
      const nextLicenseCount = effectiveCodes.length;
      const currentLicenseCount = Number(row.licenses ?? row.so_luong_gp ?? currentCodes.length ?? 0);
      if (
        nextLicenseCount === currentLicenseCount &&
        arraysEqual(effectiveCodes, currentCodes) &&
        arraysEqual(excludedCodes, currentExcludedCodes)
      ) {
        return row;
      }
      changed += 1;
      const nextRow = {
        ...row,
        licenseSourceCodes: Array.from(normalizedSource).sort((a, b) => a.localeCompare(b)),
        licenseExcludedCodes: excludedCodes,
        licenseCodes: effectiveCodes,
        licenses: nextLicenseCount,
        so_luong_gp: nextLicenseCount,
        licenseManualCount: nextLicenseCount,
        updatedAt: new Date().toISOString(),
      };
      const recalculated = computeKPI(nextRow, rules);
      if (Number.isFinite(recalculated)) {
        nextRow.kpi = Math.round(recalculated * 10) / 10;
      }
      return nextRow;
    });
    if (matchedCount === 0) {
      return { ok: false, reason: "missing" };
    }
    if (changed === 0) {
      return { ok: false, reason: "unchanged", matchedCount, blocked: blockedCount };
    }
    setRawRows(nextRows);
    setHasUnsaved(true);
      return { ok: true, changed, matchedCount, blocked: blockedCount };
    },
    [
      editingRestrictionMessage,
      filterEditableKeys,
      getLicenseExcludeSetForRow,
      keyOfRow,
      mode,
      rawRows,
      rules,
    ]
  );

  const handleApplyLicenseExclusion = useCallback(() => {
    if (selectedKeys.length === 0) {
      alert("Hãy chọn ít nhất một tờ khai để đối chiếu giấy phép.");
      return;
    }
    const allowedKeys = ensureEditableKeys(selectedKeys, "đối chiếu giấy phép");
    if (!allowedKeys) {
      return;
    }
    const result = applyLicenseExclusionForKeys(allowedKeys, { alreadyFiltered: true });
    if (!result?.ok) {
      if (result?.reason === "mode") {
        alert("Chỉ có thể điều chỉnh giấy phép khi đang xem dữ liệu đã lưu.");
        return;
      }
      if (result?.reason === "unchanged") {
        alert("Các tờ khai được chọn đã không còn mã giấy phép nằm trong danh sách loại trừ.");
        return;
      }
      if (result?.reason === "missing" || result?.reason === "empty") {
        alert("Không tìm thấy tờ khai phù hợp để đối chiếu.");
        return;
      }
      alert("Không thể đối chiếu giấy phép cho lựa chọn hiện tại.");
      return;
    }
    alert(`Đã cập nhật loại trừ giấy phép cho ${result.changed}/${result.matchedCount} tờ khai đã chọn.`);
  }, [applyLicenseExclusionForKeys, ensureEditableKeys, selectedKeys]);

  const handleAutoApplyLicenseExclusion = useCallback(() => {
    if (!canEdit) {
      alert("Bạn không có quyền chỉnh sửa dữ liệu tờ khai.");
      return;
    }
    if (mode !== "saved") {
      alert("Hãy chuyển sang chế độ dữ liệu đã lưu để đối chiếu tự động.");
      return;
    }
    if (!filteredKeys.length) {
      alert("Không có tờ khai nào khớp với bộ lọc hiện tại để đối chiếu.");
      return;
    }
    const allowedKeys = ensureEditableKeys(filteredKeys, "đối chiếu giấy phép tự động");
    if (!allowedKeys) {
      return;
    }
    const result = applyLicenseExclusionForKeys(allowedKeys, { alreadyFiltered: true });
    if (!result?.ok) {
      if (result?.reason === "unchanged") {
        alert("Tất cả tờ khai trong bộ lọc hiện tại đã loại trừ giấy phép đầy đủ.");
        return;
      }
      if (result?.reason === "missing" || result?.reason === "empty") {
        alert("Không có tờ khai hợp lệ để tự động đối chiếu.");
        return;
      }
      alert("Không thể tự động đối chiếu loại trừ KPI. Vui lòng thử lại.");
      return;
    }
    alert(`Đã tự động cập nhật loại trừ giấy phép cho ${result.changed}/${result.matchedCount} tờ khai đang hiển thị.`);
  }, [applyLicenseExclusionForKeys, canEdit, ensureEditableKeys, filteredKeys, mode]);

  const handleExportSelected = useCallback(() => {
    if (selectedKeys.length === 0) {
      alert("Hãy chọn tờ khai trước khi xuất Excel.");
      return;
    }
    const keySet = new Set(selectedKeys);
    const rows = rawRows.filter((row) => keySet.has(keyOfRow(row)));
    if (rows.length === 0) {
      alert("Không tìm thấy tờ khai tương ứng để xuất.");
      return;
    }
    const data = rows.map((row) => {
      const licenseInfo = summarizeLicenseSnapshot(row);
      return {
        Ngày: formatDisplayDate(row.date || row.raw_date || ""),
        "Số tờ khai": row.so_tk_full || row.so_tk || "",
        "Số TK AMA": row.so_tk_ama || "",
        MST: row.mst || "",
        "Công ty": row.cong_ty || "",
        "Loại hình": row.loai_hinh || "",
        "Nhân viên": row.nhan_vien || "",
        "Tổ đội": row.team || "",
        "Đại lý": row.agency || row.dai_ly || "",
        "Số lượng GP gốc": licenseInfo.sourceCount,
        "Số lượng GP (sau loại trừ)": licenseInfo.includedCount,
        "Mã giấy phép hợp lệ": licenseInfo.includedCodes.join(", "),
        "Mã giấy phép bị loại trừ": licenseInfo.excludedCodes.join(", "),
        "C/O": coLabel(row),
        "Dòng C/O": coLineCount(row),
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ToKhai");
    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `tokhai_da_chon_${timestamp}.xlsx`);
  }, [selectedKeys, rawRows, keyOfRow, summarizeLicenseSnapshot]);

  const toneClassMap = {
    success: "border border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border border-amber-200 bg-amber-50 text-amber-700",
    danger: "border border-red-200 bg-red-50 text-red-700",
    muted:
      "border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-muted)]",
  };

  const resolveStatusMeta = (status, fallback, kind = "database") => {
    if (!status) {
      return { tone: "muted", label: fallback, detail: "" };
    }
    if (status.ok) {
      const label = kind === "backend" ? "Backend hoạt động" : "SQL Server sẵn sàng";
      return { tone: "success", label, detail: status.message || "" };
    }
    if (status.state === "not_configured") {
      return { tone: "warning", label: "Chưa cấu hình SQL Server", detail: "" };
    }
    if (status.state === "timeout") {
      return { tone: "danger", label: "Timeout kết nối SQL Server", detail: status.message || "" };
    }
    const detail = status.message || "";
    const label = kind === "backend" ? "Backend gặp sự cố" : "Lỗi kết nối SQL Server";
    return { tone: "danger", label, detail };
  };

  const backendMeta = resolveStatusMeta(statusInfo.backend, "Backend chưa kiểm tra", "backend");
  const databaseMeta = resolveStatusMeta(statusInfo.database, "SQL Server chưa kiểm tra", "database");
  const statusCheckedLabel = statusInfo.checkedAt
    ? new Date(statusInfo.checkedAt).toLocaleString("vi-VN")
    : "Chưa kiểm tra";

  return (
    <>
      <Dialog
        open={duplicateReviewOpen}
        onOpenChange={(next) => {
          if (next) {
            setDuplicateReviewOpen(true);
            return;
          }
          handleCloseDuplicateReview();
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Rà soát tờ khai trùng 11 số đầu</DialogTitle>
            <DialogDescription>
              Kiểm tra các nhóm trùng giữa nguồn Excel và ECUS5VNACCS. Hệ thống ưu tiên giữ bản có thời gian cập nhật mới nhất, sau đó mới xét điểm trọng số.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="rounded border border-sky-200 bg-sky-50 p-3 text-sky-800 dark:border-sky-700/60 dark:bg-sky-900/20 dark:text-sky-100">
              {duplicate11PlanHasActions ? (
                <p>
                  Dự kiến xóa <strong>{duplicate11PlannedRemovalCount.toLocaleString("vi-VN")}</strong> bản ghi trong <strong>{duplicate11PlannedDeleteGroups.toLocaleString("vi-VN")}</strong> nhóm.
                  {duplicate11PlannedReviewGroups > 0 && (
                    <> • <strong>{duplicate11PlannedReviewGroups.toLocaleString("vi-VN")}</strong> nhóm sẽ được đánh dấu cần rà soát thay vì xóa.</>
                  )}
                </p>
              ) : (
                <p>Hãy chọn bản giữ lại hoặc chuyển nhóm sang trạng thái “Cần rà soát” trước khi xác nhận.</p>
              )}
              <p className="mt-1 text-xs text-sky-700 dark:text-sky-200/80">
                Bạn có thể hợp nhất từng trường dữ liệu (nhân viên, KPI, giấy phép…) từ các bản khác nhau rồi mới xóa bản dư.
              </p>
            </div>
            {duplicate11Details?.length ? (
              <ScrollArea className="max-h-[60vh] pr-2">
                <div className="space-y-4">
                  {duplicate11Details.map((group) => {
                    const planEntry = duplicate11Plan[group.rawPrefix] || {};
                    const keeperKey = planEntry.keeperKey;
                    const merges = planEntry.merges || {};
                    const resolution = planEntry.resolution || "delete";
                    const note = planEntry.note || "";
                    const usageMap = new Map();
                    for (const field of DUPLICATE_MERGE_FIELDS) {
                      const selected = merges[field.key] || keeperKey;
                      if (!usageMap.has(selected)) {
                        usageMap.set(selected, []);
                      }
                      usageMap.get(selected)?.push(field.label);
                    }
                    return (
                      <div
                        key={`${group.rawPrefix || group.prefix}-${group.total}`}
                        className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-3 shadow-sm"
                      >
                        <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{group.prefix}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Tham chiếu: <span className="font-medium text-emerald-600 dark:text-emerald-300">{group.keeperLabel || "Không xác định"}</span>
                              {group.referenceTimestamp ? (
                                <> • {group.referenceTimestampLabel}: {group.referenceTimestamp}</>
                              ) : null}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>{group.total.toLocaleString("vi-VN")} bản ghi</span>
                            {resolution === "review" && (
                              <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">Đánh dấu cần rà soát</span>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead className="bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-secondary)]">
                              <tr>
                                <th className="px-2 py-1 text-left">Giữ</th>
                                <th className="px-2 py-1 text-left">Số tờ khai</th>
                                <th className="px-2 py-1 text-left">Nguồn</th>
                                <th className="px-2 py-1 text-left">Thời gian</th>
                                <th className="px-2 py-1 text-left">Nhân viên</th>
                                <th className="px-2 py-1 text-left">Tổ đội</th>
                                <th className="px-2 py-1 text-left">Trạng thái</th>
                                <th className="px-2 py-1 text-right">KPI</th>
                                <th className="px-2 py-1 text-left">Trường sẽ lấy dữ liệu</th>
                                <th className="px-2 py-1 text-right">Điểm</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.items.map((item, index) => {
                                const isKeeper = keeperKey === item.key;
                                const selectedFields = usageMap.get(item.key) || [];
                                const rowClass = isKeeper
                                  ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100"
                                  : index % 2 === 0
                                    ? "bg-[color:var(--ds-surface-card)]"
                                    : "bg-[color:var(--ds-surface-muted)]";
                                return (
                                  <tr
                                    key={item.key}
                                    className={`${rowClass} border-b border-[color:var(--ds-border-subtle)] last:border-b-0`}
                                  >
                                    <td className="px-2 py-1">
                                      <label className="flex items-center gap-1">
                                        <input
                                          type="radio"
                                          name={`duplicate-keeper-${group.rawPrefix}`}
                                          checked={isKeeper}
                                          onChange={() => handleChangeDuplicateKeeper(group.rawPrefix, item.key)}
                                        />
                                        <span className="font-medium">Giữ</span>
                                      </label>
                                    </td>
                                    <td className="px-2 py-1">
                                      <div className="font-medium text-[color:var(--ds-text-primary)]">{item.label}</div>
                                      <div className="text-[10px] uppercase text-[color:var(--ds-text-muted)]">{item.key}</div>
                                    </td>
                                    <td className="px-2 py-1">{item.sourceLabel}</td>
                                    <td className="px-2 py-1">
                                      <div>{item.timestampDisplay || "Không xác định"}</div>
                                      <div className="text-[10px] text-[color:var(--ds-text-muted)]">{item.timestampLabel}</div>
                                    </td>
                                    <td className="px-2 py-1">{item.staff || <span className="text-gray-400">(trống)</span>}</td>
                                    <td className="px-2 py-1">{item.team || <span className="text-gray-400">(trống)</span>}</td>
                                    <td className="px-2 py-1">{item.status}</td>
                                    <td className="px-2 py-1 text-right">{Number.isFinite(item.kpi) ? item.kpi.toLocaleString("vi-VN") : "-"}</td>
                                    <td className="px-2 py-1">
                                      {selectedFields.length > 0 ? (
                                        <div className="space-y-0.5">
                                          {selectedFields.map((fieldLabel) => (
                                            <span
                                              key={`${item.key}-${fieldLabel}`}
                                              className="block rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                                            >
                                              {fieldLabel}
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-[color:var(--ds-text-muted)]">(không)</span>
                                      )}
                                    </td>
                                    <td className="px-2 py-1 text-right">{item.score.toLocaleString("vi-VN")}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          <div className="space-y-2 text-xs">
                            <p className="font-semibold text-gray-600 dark:text-gray-300">Hợp nhất trường dữ liệu</p>
                            {DUPLICATE_MERGE_FIELDS.map((field) => (
                              <label key={`${group.rawPrefix}-${field.key}`} className="flex flex-col gap-1">
                                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{field.label}</span>
                                <select
                                  className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-2 py-1 text-sm"
                                  value={merges[field.key] || keeperKey}
                                  onChange={(e) => handleChangeDuplicateMerge(group.rawPrefix, field.key, e.target.value)}
                                  disabled={resolution === "review"}
                                >
                                  {group.items.map((item) => (
                                    <option key={`${field.key}-${item.key}`} value={item.key}>
                                      {item.label} — {item.sourceLabel}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ))}
                          </div>
                          <div className="space-y-2 text-xs">
                            <label className="flex flex-col gap-1">
                              <span className="font-semibold text-gray-600 dark:text-gray-300">Hành động cho nhóm</span>
                              <select
                                className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-2 py-1 text-sm"
                                value={resolution}
                                onChange={(e) => handleChangeDuplicateResolution(group.rawPrefix, e.target.value)}
                              >
                                <option value="delete">Xóa bản dư (giữ 1 bản)</option>
                                <option value="review">Đánh dấu cần rà soát</option>
                              </select>
                            </label>
                            {resolution === "review" ? (
                              <label className="flex flex-col gap-1">
                                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Ghi chú (tùy chọn)</span>
                                <textarea
                                  className="min-h-[60px] rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-2 py-1 text-sm"
                                  value={note}
                                  onChange={(e) => handleChangeDuplicateNote(group.rawPrefix, e.target.value)}
                                  placeholder="Ví dụ: Cần đối chiếu KPI với phòng chứng từ"
                                />
                              </label>
                            ) : (
                              <p className="text-gray-500 dark:text-gray-400">Các bản khác sẽ bị xóa sau khi bạn xác nhận.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4 text-center text-sm text-[color:var(--ds-text-muted)]">
                <p className="text-sm text-[color:var(--ds-text-muted)]">Không tìm thấy nhóm trùng để rà soát.</p>
              </div>
            )}
            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
              <input
                type="checkbox"
                className="mt-1"
                checked={duplicateReviewConfirmed}
                onChange={(e) => setDuplicateReviewConfirmed(e.target.checked)}
              />
              <span>Tôi đã rà soát chi tiết từng nhóm và xác nhận thao tác xử lý (xóa hoặc đánh dấu cần rà soát).</span>
            </label>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={handleCloseDuplicateReview}
              className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-1 text-sm text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)]"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirmDuplicateRemoval}
              disabled={!duplicateReviewConfirmed || !duplicate11PlanHasActions}
              className={`rounded px-3 py-1 text-sm font-semibold text-white ${duplicateReviewConfirmed && duplicate11PlanHasActions ? "bg-red-600 hover:bg-red-700" : "bg-red-400 opacity-50"}`}
            >
              Thực hiện xử lý
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div ref={rootRef} className="import-data-view space-y-3">
      {isReadOnlyForEdits && !canManageAlerts && (
        <div className="rounded border border-amber-300 bg-amber-50 text-amber-700 p-3 text-sm">
          Bạn đang ở chế độ chỉ xem. Đăng nhập bằng tài khoản được cấp quyền để import, chỉnh sửa và lưu dữ liệu tờ khai.
        </div>
      )}
      {isReadOnlyForEdits && canManageAlerts && (
        <div className="rounded border border-blue-300 bg-blue-50 p-3 text-sm text-blue-700">
          Bạn có thể rà soát và đánh dấu các tờ khai thiếu thông tin nhưng không thể chỉnh sửa dữ liệu tờ khai.
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <div key={card.label} className={`${CARD_SURFACE_CLASS} p-3`}>
            <div className="text-xs uppercase tracking-wide text-gray-500">{card.label}</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">{card.value?.toLocaleString?.("vi-VN") ?? card.value}</div>
          </div>
        ))}
      </div>

      {showUpdatedBanner && (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold">Cap nhat {lastSyncUpdated.toLocaleString("vi-VN")} to khai trong lan dong bo gan nhat</div>
              {lastSyncRunAtLabel && (
                <div className="text-xs text-emerald-800/80">Thoi diem: {lastSyncRunAtLabel}</div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSelectUpdated}
                className="rounded border border-emerald-500 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
              >
                Chon tren bang
              </button>
              <button
                type="button"
                onClick={() => setSelectedKeys([])}
                className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                Bo chon
              </button>
            </div>
          </div>
          {updatedPreview.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {updatedPreview.map((entry) => (
                <span
                  key={`${entry.so_tk}_${entry.nhanh || entry.branch || 'main'}`}
                  className="rounded bg-[color:var(--ds-surface-card)] px-2 py-0.5 text-emerald-700 shadow-sm"
                >
                  {formatDeclarationLabel(entry)}
                </span>
              ))}
              {updatedDeclarations.length > updatedPreview.length && (
                <span className="text-emerald-700">+{updatedDeclarations.length - updatedPreview.length} khac</span>
              )}
            </div>
          )}
        </div>
      )}

      {canManageSync ? (
        <CollapsibleCard
          id="auto-sync"
          title="Đồng bộ tự động từ ECUS5VNACCS"
          description={`Lần chạy gần nhất: ${syncLastRunLabel} • Trạng thái: ${syncConfig?.lastStatus || "Chưa có"}`}
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchSyncConfig}
                className="rounded border px-3 py-1 text-sm"
                disabled={syncLoading}
                data-tooltip="Tải lại cấu hình đồng bộ từ máy chủ"
              >
                Tải lại cấu hình
              </button>
              <button
                type="button"
                onClick={fetchSyncStatus}
                className="rounded border px-3 py-1 text-sm"
                disabled={statusLoading}
                data-tooltip="Kiểm tra kết nối SQL Server"
              >
                {statusLoading ? "Đang kiểm tra..." : "Kiểm tra kết nối"}
              </button>
              <button
                type="button"
                onClick={handleSaveSyncConfig}
                className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
                disabled={syncLoading || !syncForm}
                data-tooltip="Lưu cấu hình đồng bộ ECUS"
              >
                Lưu cấu hình
              </button>
            </div>
          }
          bodyClassName="space-y-3"
        >
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
              <span className={`rounded px-2 py-1 ${toneClassMap[backendMeta.tone] || toneClassMap.muted}`}>
                Backend: {backendMeta.label}
              </span>
              <span className={`rounded px-2 py-1 ${toneClassMap[databaseMeta.tone] || toneClassMap.muted}`}>
                SQL Server: {databaseMeta.label}
              </span>
            </div>
            <div className="text-xs text-gray-500">Lần kiểm tra: {statusCheckedLabel}</div>
            {(backendMeta.detail || databaseMeta.detail) && (
              <div className="text-xs text-gray-500">
                {[backendMeta.detail, databaseMeta.detail].filter(Boolean).join(" • ")}
              </div>
            )}
            {statusError && <div className="text-xs text-red-600">{statusError}</div>}
            {lastSyncSummaryCard}
          </div>
          {syncForm ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={syncForm.enabled}
                    onChange={(e) => setSyncForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                  />
                  <span>Bật đồng bộ định kỳ</span>
                </label>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Biểu thức cron</label>
                  <input
                    className="w-full rounded border px-2 py-1 text-sm"
                    value={syncForm.schedule}
                    onChange={(e) => setSyncForm((prev) => ({ ...prev, schedule: e.target.value }))}
                    placeholder="0 * * * *"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Khoảng mặc định (số ngày)</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full rounded border px-2 py-1 text-sm"
                    value={syncForm.rangeDays}
                    onChange={(e) => setSyncForm((prev) => ({ ...prev, rangeDays: Number(e.target.value) || 1 }))}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={syncForm.preferMonthFirst}
                    onChange={(e) => setSyncForm((prev) => ({ ...prev, preferMonthFirst: e.target.checked }))}
                  />
                  <span>Ngày dạng MM/DD/YYYY</span>
                </label>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Máy chủ SQL Server</label>
                  <input
                    className="w-full rounded border px-2 py-1 text-sm"
                    value={syncForm.server}
                    onChange={(e) => setSyncForm((prev) => ({ ...prev, server: e.target.value }))}
                    placeholder="192.168.x.x\\SQL2019"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Cơ sở dữ liệu</label>
                  <input
                    className="w-full rounded border px-2 py-1 text-sm"
                    value={syncForm.database}
                    onChange={(e) => setSyncForm((prev) => ({ ...prev, database: e.target.value }))}
                    placeholder="ECUS5VNACCS"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Tài khoản</label>
                  <input
                    className="w-full rounded border px-2 py-1 text-sm"
                    value={syncForm.user}
                    onChange={(e) => setSyncForm((prev) => ({ ...prev, user: e.target.value }))}
                    placeholder="sa"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Mật khẩu</label>
                  <input
                    type="password"
                    className="w-full rounded border px-2 py-1 text-sm"
                    value={syncForm.password}
                    onChange={(e) => setSyncForm((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder={syncForm.hasPassword ? "(giữ nguyên nếu để trống)" : "Nhập mật khẩu"}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-gray-500">Khoảng thời gian chạy tay</span>
                <div className="flex flex-wrap items-center gap-1">
                  {RANGE_PRESETS.map((preset) => (
                    <button
                      key={preset.days}
                      type="button"
                      className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                      onClick={() => applyRangePreset(preset.days)}
                      disabled={syncRunning}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-gray-500">hoặc chọn ngày cụ thể</span>
                <input
                  type="date"
                  className="rounded border px-2 py-1 text-sm"
                  value={manualRange.from}
                  onChange={(e) => handleManualRangeChange("from", e.target.value)}
                  disabled={syncRunning}
                />
                <span className="text-xs text-gray-500">đến</span>
                <input
                  type="date"
                  className="rounded border px-2 py-1 text-sm"
                  value={manualRange.to}
                  onChange={(e) => handleManualRangeChange("to", e.target.value)}
                  disabled={syncRunning}
                />
                <button
                  type="button"
                  onClick={handlePreviewSync}
                  disabled={previewLoading || syncRunning}
                  className="rounded border border-emerald-600 px-3 py-1 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                >
                  {previewLoading ? "Đang xem trước..." : "Xem trước dữ liệu"}
                </button>
                <button
                  type="button"
                  onClick={handleRunSync}
                  disabled={syncRunning}
                  className="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                >
                  {syncRunning ? "Đang đồng bộ..." : "Đồng bộ ngay"}
                </button>
              </div>
              {previewRangeInfo && (
                <div className="text-xs text-gray-500">
                  Khoảng xem trước: {previewRangeLabel || "..."}
                  {previewLimited && " (giới hạn 100 dòng đầu tiên)"}
                </div>
              )}
              {previewError && <div className="text-xs text-red-600">{previewError}</div>}
              {previewRows.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-gray-600">
                    Xem trước {previewRows.length.toLocaleString("vi-VN")} dòng đầu tiên sẽ nhập vào hệ thống.
                  </div>
                  <div className="max-h-64 overflow-auto rounded border">
                    <table className="min-w-full text-xs">
                      <thead className="bg-emerald-50 text-emerald-800">
                        <tr>
                          <th className="px-2 py-1 text-left">Số tờ khai</th>
                          <th className="px-2 py-1 text-left">Ngày</th>
                          <th className="px-2 py-1 text-left">MST</th>
                          <th className="px-2 py-1 text-left">Công ty</th>
                          <th className="px-2 py-1 text-left">Nhân viên</th>
                          <th className="px-2 py-1 text-left">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row) => (
                          <tr
                            key={`${row.so_tk}_${row.nhanh || ""}`}
                            className="odd:bg-[color:var(--ds-surface-card)] even:bg-[color:var(--ds-surface-muted)]"
                          >
                            <td className="px-2 py-1">{row.so_tk}</td>
                            <td className="px-2 py-1">{formatDisplayDate(row.date)}</td>
                            <td className="px-2 py-1">{row.mst}</td>
                            <td className="px-2 py-1">{row.cong_ty}</td>
                            <td className="px-2 py-1">{row.nhan_vien || <span className="italic text-gray-400">(chưa gán)</span>}</td>
                            <td className="px-2 py-1">
                              {row.status === "existing" ? (
                                <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700">Đã có</span>
                              ) : (
                                <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Mới</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {syncMessage && <div className="text-sm text-emerald-600">{syncMessage}</div>}
              {syncError && <div className="text-sm text-red-600">{syncError}</div>}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Đang tải cấu hình đồng bộ...</p>
          )}
        </CollapsibleCard>
      ) : (
        <section className={`${CARD_SURFACE_CLASS} p-4`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Đồng bộ ECUS</h2>
              <p className="text-xs text-gray-500">Lần chạy gần nhất: {syncLastRunLabel} • Trạng thái: {syncConfig?.lastStatus || "Chưa có"}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  fetchSyncConfig();
                  fetchSyncStatus();
                }}
                className="rounded border px-3 py-1 text-sm"
                disabled={syncLoading || statusLoading}
              >
                {statusLoading ? "Đang kiểm tra..." : "Cập nhật trạng thái"}
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
              <span className={`rounded px-2 py-1 ${toneClassMap[backendMeta.tone] || toneClassMap.muted}`}>
                Backend: {backendMeta.label}
              </span>
              <span className={`rounded px-2 py-1 ${toneClassMap[databaseMeta.tone] || toneClassMap.muted}`}>
                SQL Server: {databaseMeta.label}
              </span>
            </div>
            <div className="text-xs text-gray-500">Lần kiểm tra: {statusCheckedLabel}</div>
            {(backendMeta.detail || databaseMeta.detail) && (
              <div className="text-xs text-gray-500">
                {[backendMeta.detail, databaseMeta.detail].filter(Boolean).join(" • ")}
              </div>
            )}
            {statusError && <div className="text-xs text-red-600">{statusError}</div>}
            {lastSyncSummaryCard}
          </div>
        </section>
      )}

      <CollapsibleCard
        id="co-code-config"
        title="Cấu hình mã ưu đãi C/O"
        description="Quản lý danh sách mã ưu đãi để hệ thống đánh giá C/O chính xác."
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRefreshCoCodeConfig}
              className="rounded border px-3 py-1 text-sm"
              disabled={coCodeLoading}
              data-tooltip="Tải lại cấu hình mã ưu đãi C/O"
            >
              {coCodeLoading ? "Đang tải..." : "Làm mới"}
            </button>
          </div>
        }
        bodyClassName="space-y-3"
      >
        {coCodeError && <div className="text-sm text-red-600">{coCodeError}</div>}
        {coCodeMessage && <div className="text-sm text-emerald-600">{coCodeMessage}</div>}
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="flex items-center justify-between text-sm font-medium text-gray-700">
              <span>Whitelist ưu tiên</span>
              <span className="text-xs text-gray-400">Mỗi dòng một mã (để trống nếu không dùng)</span>
            </label>
            <textarea
              value={coCodeForm.whitelist}
              onChange={(e) => setCoCodeForm((prev) => ({ ...prev, whitelist: e.target.value }))}
              className="mt-1 h-32 w-full resize-y rounded border px-3 py-2 text-sm"
              placeholder="VD: CA3"
              disabled={coCodeLoading || coCodeSaving || !canManageSync}
            />
          </div>
          <div>
            <label className="flex items-center justify-between text-sm font-medium text-gray-700">
              <span>Blacklist không C/O</span>
              <span className="text-xs text-gray-400">Mỗi dòng một mã</span>
            </label>
            <textarea
              value={coCodeForm.blacklist}
              onChange={(e) => setCoCodeForm((prev) => ({ ...prev, blacklist: e.target.value }))}
              className="mt-1 h-32 w-full resize-y rounded border px-3 py-2 text-sm"
              placeholder="VD: B01"
              disabled={coCodeLoading || coCodeSaving || !canManageSync}
            />
          </div>
        </div>
        <p className="text-xs text-gray-500">Nếu whitelist để trống, hệ thống sẽ sử dụng blacklist để loại bỏ các mã không được xem là C/O.</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSaveCoCodeConfig}
            className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
            disabled={coCodeSaving || coCodeLoading || !canManageSync}
            data-tooltip="Lưu danh sách mã ưu đãi"
          >
            {coCodeSaving ? "Đang lưu..." : "Lưu cấu hình"}
          </button>
          <button
            type="button"
            onClick={handleResetCoCodeForm}
            className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
            disabled={coCodeLoading || coCodeSaving}
            data-tooltip="Khôi phục cấu hình mã ưu đãi"
          >
            Khôi phục
          </button>
        </div>
        <div className="text-xs text-gray-400">{coCodeUpdatedLabel}</div>
      </CollapsibleCard>

      <CollapsibleCard
        id="co-discrepancy"
        title="Đối soát C/O"
        description="Theo dõi chênh lệch giữa dữ liệu hệ thống và ECUS để xử lý kịp thời."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              className="rounded border px-2 py-1 text-xs"
              value={coDiscrepancyRange.from}
              onChange={(e) => setCoDiscrepancyRange((prev) => ({ ...prev, from: e.target.value }))}
              data-tooltip="Ngày bắt đầu đối soát"
            />
            <span className="text-xs text-gray-500">→</span>
            <input
              type="date"
              className="rounded border px-2 py-1 text-xs"
              value={coDiscrepancyRange.to}
              onChange={(e) => setCoDiscrepancyRange((prev) => ({ ...prev, to: e.target.value }))}
              data-tooltip="Ngày kết thúc đối soát"
            />
            <button
              type="button"
              onClick={handleRunCoDiscrepancy}
              className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
              disabled={coDiscrepancyRunning || coDiscrepancyLoading || !canManageSync}
              data-tooltip="Chạy đối chiếu C/O với dữ liệu ECUS"
            >
              {coDiscrepancyRunning ? "Đang chạy..." : "Chạy kiểm tra"}
            </button>
            <button
              type="button"
              onClick={handleRefreshCoDiscrepancy}
              className="rounded border px-3 py-1 text-xs"
              disabled={coDiscrepancyLoading}
              data-tooltip="Làm mới kết quả đối soát"
            >
              {coDiscrepancyLoading ? "Đang tải..." : "Làm mới"}
            </button>
          </div>
        }
        bodyClassName="space-y-3"
      >
        {coDiscrepancyError && <div className="text-sm text-red-600">{coDiscrepancyError}</div>}
        {coDiscrepancyMessage && <div className="text-sm text-emerald-600">{coDiscrepancyMessage}</div>}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border bg-gray-50 px-3 py-2">
            <div className="text-xs uppercase text-gray-500">Trạng thái</div>
            <div className="text-sm font-semibold text-gray-900">{coDiscrepancyStatusLabel}</div>
          </div>
          <div className="rounded border bg-gray-50 px-3 py-2">
            <div className="text-xs uppercase text-gray-500">Lần chạy gần nhất</div>
            <div className="text-sm font-semibold text-gray-900">{coDiscrepancyLastRunLabel}</div>
          </div>
          <div className="rounded border bg-gray-50 px-3 py-2">
            <div className="text-xs uppercase text-gray-500">Chênh lệch</div>
            <div className="text-sm font-semibold text-gray-900">{coMismatchCount.toLocaleString("vi-VN")}</div>
          </div>
          <div className="rounded border bg-gray-50 px-3 py-2">
            <div className="text-xs uppercase text-gray-500">Tổng đã kiểm</div>
            <div className="text-sm font-semibold text-gray-900">{coCheckedCount.toLocaleString("vi-VN")}</div>
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={coDiscrepancyForm.enabled} onChange={(e) => setCoDiscrepancyForm((prev) => ({ ...prev, enabled: e.target.checked }))} disabled={!canManageSync} />
              <span>Bật đối soát tự động</span>
            </label>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-xs font-medium text-gray-600">Cron tự động<input className="mt-1 w-full rounded border px-2 py-1 text-sm" value={coDiscrepancyForm.cron} onChange={(e) => setCoDiscrepancyForm((prev) => ({ ...prev, cron: e.target.value }))} disabled={!canManageSync} placeholder="30 4 * * *" /></label>
              <label className="text-xs font-medium text-gray-600">Số ngày lấy mẫu<input type="number" min={1} className="mt-1 w-full rounded border px-2 py-1 text-sm" value={coDiscrepancyForm.rangeDays} onChange={(e) => setCoDiscrepancyForm((prev) => ({ ...prev, rangeDays: e.target.value }))} disabled={!canManageSync} /></label>
              <label className="text-xs font-medium text-gray-600">Ngưỡng cảnh báo<input type="number" min={1} className="mt-1 w-full rounded border px-2 py-1 text-sm" value={coDiscrepancyForm.threshold} onChange={(e) => setCoDiscrepancyForm((prev) => ({ ...prev, threshold: e.target.value }))} disabled={!canManageSync} /></label>
              <label className="text-xs font-medium text-gray-600">Giới hạn mẫu<input type="number" min={0} className="mt-1 w-full rounded border px-2 py-1 text-sm" value={coDiscrepancyForm.sampleLimit} onChange={(e) => setCoDiscrepancyForm((prev) => ({ ...prev, sampleLimit: e.target.value }))} disabled={!canManageSync} /></label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleSaveCoDiscrepancyConfig} className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50" disabled={coDiscrepancySaving || !canManageSync}>
                {coDiscrepancySaving ? "Đang lưu..." : "Lưu cấu hình"}
              </button>
              <button type="button" onClick={handleResetCoDiscrepancyForm} className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50" disabled={coDiscrepancySaving}>
                Khôi phục
              </button>
            </div>
            <div className="text-xs text-gray-500">
              {coDiscrepancyRangeLabel ? `Khoảng lần chạy gần nhất: ${coDiscrepancyRangeLabel}` : "Chưa có kết quả đối soát."}
              {coMismatchLimited ? " (Đã cắt bớt danh sách do vượt giới hạn mẫu)" : ""}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span>Chênh lệch gợi ý ({coMismatchPreview.length} / {coMismatchCount.toLocaleString("vi-VN")})</span>
              <button type="button" onClick={handleSelectCoMismatches} className="rounded border px-2 py-0.5 text-[11px] text-amber-700 hover:bg-amber-50" disabled={!coMismatchKeySet.size}>
                Chọn trên bảng
              </button>
            </div>
            <div className="overflow-auto rounded border">
              {coMismatchPreview.length ? (
                <table className="min-w-full text-xs">
                  <thead className="bg-amber-50 text-amber-800">
                    <tr>
                      <th className="px-2 py-1 text-left">Tờ khai</th>
                      <th className="px-2 py-1 text-center">C/O lưu trữ</th>
                      <th className="px-2 py-1 text-center">C/O ECUS</th>
                      <th className="px-2 py-1 text-center">Dòng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coMismatchPreview.map((item) => (
                      <tr key={item.key} className="odd:bg-[color:var(--ds-surface-card)] even:bg-[color:var(--ds-surface-muted)]">
                        <td className="px-2 py-1">{formatDeclarationLabel(item)}</td>
                        <td className="px-2 py-1 text-center">{item.stored?.has_co ? "Có" : "Không"} ({item.stored?.co_line_count ?? 0})</td>
                        <td className="px-2 py-1 text-center">{item.remote?.has_co ? "Có" : "Không"} ({item.remote?.co_line_count ?? 0})</td>
                        <td className="px-2 py-1 text-center">{item.remote?.co_codes?.length ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-4 text-center text-xs text-gray-500">Chưa phát hiện chênh lệch nào.</div>
              )}
            </div>
          </div>
        </div>
      </CollapsibleCard>


<section className={`${CARD_SURFACE_CLASS} p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Cảnh báo tờ khai thiếu thông tin</h2>
            <p className="text-xs text-gray-500">Lần rà soát: {lastAlertEvaluated} • Tổng theo dõi: {alertSummary.totalTracked || 0}</p>
          </div>
          <button type="button" onClick={handleRefreshAlerts} className="rounded border px-3 py-1 text-sm" disabled={alertLoading}>
            Làm mới danh sách
          </button>
        </div>
        {alertLoading ? (
          <p className="mt-3 text-sm text-gray-500">Đang tải danh sách cảnh báo...</p>
        ) : outstandingAlerts.length ? (
          <div className="mt-3 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-1 text-left">Số tờ khai</th>
                  <th className="px-2 py-1 text-left">MST</th>
                  <th className="px-2 py-1 text-left">Công ty</th>
                  <th className="px-2 py-1 text-left">Thiếu thông tin</th>
                  <th className="px-2 py-1 text-left">Ngày tờ khai</th>
                  <th className="px-2 py-1 text-left">Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {outstandingAlerts.map((alert) => (
                  <tr
                    key={alert.key}
                    className="odd:bg-[color:var(--ds-surface-card)] even:bg-[color:var(--ds-surface-muted)]"
                  >
                    <td className="px-2 py-1">{alert.so_tk}</td>
                    <td className="px-2 py-1">{alert.mst}</td>
                    <td className="px-2 py-1">{alert.company}</td>
                    <td className="px-2 py-1 text-amber-600">{(alert.missing || []).join(", ")}</td>
                    <td className="px-2 py-1">{formatDisplayDate(alert.date)}</td>
                    <td className="px-2 py-1">{alert.lastUpdated ? new Date(alert.lastUpdated).toLocaleString("vi-VN") : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500">Không có cảnh báo nào đang chờ xử lý.</p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          data-testid="import-file-input"
          ref={fileRef}
          onChange={handleFileChange}
          accept=".xls,.xlsx"
          className="hidden"
          disabled={isReadOnlyForEdits}
        />
        {canEdit && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] shadow-sm hover:bg-[color:var(--ds-surface-muted)]"
          >
            Chọn file XLSX
          </button>
        )}
        {selectedFile && (
          <span className="text-sm text-gray-600">Đã chọn: {selectedFile}</span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={handleImport}
            disabled={!canImport}
            className={`px-3 py-1.5 rounded ${canImport ? "bg-black text-white" : "bg-gray-200 text-gray-500 cursor-not-allowed"}`}
          >
            Import XLSX
          </button>
        )}
        <button
          type="button"
          onClick={() => loadSavedRows()}
          className="px-3 py-1.5 rounded border"
        >
          Hiển thị dữ liệu đã lưu
        </button>
        <span className="ml-auto text-sm text-gray-600">{modeLabel}</span>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={autoAssignStaff} onChange={e => setAutoAssignStaff(e.target.checked)} />
            <span>Tự gán nhân viên theo MST nếu trống (ON)</span>
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={upsert11} onChange={e => setUpsert11(e.target.checked)} />
            <span>Upsert theo 11 số đầu của Số tờ khai</span>
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} />
            <span>Ghi đè toàn bộ dữ liệu hiện có</span>
          </label>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <input
          className="border rounded px-2 py-1 w-72"
          placeholder="Tìm nhanh (Số TK / MST / Công ty / Đại lý)"
          value={query}
          onChange={e => { setQuery(e.target.value); setPage(1); }}
        />
        <label className="flex items-center gap-1 text-sm" data-tooltip="Chọn nhanh khoảng thời gian theo preset">
          <span>Khoảng</span>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={datePreset}
            onChange={(e) => {
              const value = e.target.value;
              if (value === "custom") {
                setDatePreset("custom");
                return;
              }
              applyDatePreset(value);
            }}
          >
            {DATE_RANGE_PRESETS.map((preset) => (
              <option key={preset.key} value={preset.key}>
                {preset.label}
              </option>
            ))}
            <option value="custom">Tự chọn</option>
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm" data-tooltip="Lọc từ ngày (theo ngày đăng ký tờ khai)">
          <span>Từ ngày</span>
          <input
            type="date"
            value={searchRange.from}
            onChange={(e) => {
              const value = e.target.value;
              setDatePreset("custom");
              setSearchRange((prev) => ({ ...prev, from: value }));
            }}
            className="border rounded px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-1 text-sm" data-tooltip="Lọc đến ngày (theo ngày đăng ký tờ khai)">
          <span>Đến ngày</span>
          <input
            type="date"
            value={searchRange.to}
            onChange={(e) => {
              const value = e.target.value;
              setDatePreset("custom");
              setSearchRange((prev) => ({ ...prev, to: value }));
            }}
            className="border rounded px-2 py-1 text-sm"
          />
        </label>
        {(searchRange.from || searchRange.to) && (
          <button
            type="button"
            onClick={handleClearSearchRange}
            data-tooltip="Xóa điều kiện lọc theo ngày"
            className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            Xóa lọc ngày
          </button>
        )}
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={filterNoStaff}
            onChange={e => setFilterNoStaff(e.target.checked)}
          />
          <span>Chưa gán Nhân viên</span>
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={filterNoTeam}
            onChange={e => setFilterNoTeam(e.target.checked)}
          />
          <span>Chưa gán Tổ đội</span>
        </label>
        <label className="flex items-center gap-1 text-sm">
          <span>Lọc C/O</span>
          <select
            value={coFilterMode}
            onChange={(e) => setCoFilterMode(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            {CO_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {coFilterMode === "min" && (
          <label className="flex items-center gap-1 text-sm">
            <span>Tối thiểu dòng C/O</span>
            <input
              type="number"
              min={0}
              className="w-20 border rounded px-2 py-1 text-sm"
              value={coFilterMin}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) {
                  setCoFilterMin(0);
                  return;
                }
                if (raw <= 0) {
                  setCoFilterMin(0);
                  return;
                }
                setCoFilterMin(Math.round(raw));
              }}
            />
          </label>
        )}
        {coFilterActive && (
          <span className="text-sm px-2 py-1 rounded bg-emerald-50 text-emerald-700">
            Đáp ứng C/O: {coFilterMatches} tờ khai
          </span>
        )}
        <button
          type="button"
          onClick={handleSaveCurrentFilter}
          className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
        >
          Lưu bộ lọc
        </button>
        {hasSavedFilter && (
          <>
            <button
              type="button"
              onClick={handleRestoreSavedFilter}
              className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
            >
              Áp dụng bộ lọc đã lưu
            </button>
            <button
              type="button"
              onClick={handleClearSavedFilter}
              className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
            >
              Xóa bộ lọc đã lưu
            </button>
            {filterSavedLabel && (
              <span className="text-xs text-gray-500">Đã lưu: {filterSavedLabel}</span>
            )}
          </>
        )}
        <button
          type="button"
          onClick={handleToggleDuplicateFilter}
          className={`rounded border px-3 py-1 text-xs ${
            filterDuplicate11
              ? "border-amber-400 bg-amber-50 text-amber-700"
              : hasDuplicate11Rows
              ? "text-gray-600 hover:bg-gray-50"
              : "text-gray-400 cursor-not-allowed"
          }`}
          disabled={!hasDuplicate11Rows}
        >
          {filterDuplicate11 ? "Đang lọc tờ khai trùng 11 số đầu" : "Lọc tờ khai trùng 11 số đầu"}
        </button>
        {canResolveDuplicates11 && (
          <button
            type="button"
            onClick={handleDeleteDuplicates11}
            className="rounded border border-red-300 bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
          >
            Xử lý tờ khai trùng 11 số đầu
          </button>
        )}
        {hasDuplicate11Rows && (
          <span className="text-xs text-amber-700">
            {duplicate11GroupCount.toLocaleString("vi-VN")} nhóm trùng •
            {` dự kiến xóa ${duplicate11PlannedRemovalCount.toLocaleString("vi-VN")} bản`}
            {duplicate11PlannedReviewGroups > 0
              ? ` • ${duplicate11PlannedReviewGroups.toLocaleString("vi-VN")} nhóm sẽ được đánh dấu rà soát`
              : ""}
            {duplicate11TotalRows > duplicate11PlannedRemovalCount
              ? ` • tổng ${duplicate11TotalRows.toLocaleString("vi-VN")} dòng`
              : ""}
          </span>
        )}
        {canEdit && mode === "saved" && (
          <button
            type="button"
            onClick={handleAutoApplyLicenseExclusion}
            disabled={!filteredKeys.length}
            data-tooltip="Đối chiếu tự động loại trừ giấy phép cho toàn bộ tờ khai đang lọc"
            className={`rounded border px-3 py-1 text-xs ${
              filteredKeys.length
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "opacity-50 cursor-not-allowed"
            }`}
          >
            Đối chiếu KPI tự động
          </button>
        )}
        <div className="opacity-70 text-sm">
          {total} dòng — Trang {safePage}/{maxPage}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={pageSize}
            onChange={e => setPageSize(Number(e.target.value) || DEFAULT_PAGE_SIZE)}
            className="border rounded px-2 py-1 text-sm"
          >
            {PAGE_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>{size}/trang</option>
            ))}
          </select>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} className="px-2 py-1 border rounded">« Trước</button>
          <button onClick={() => setPage(p => Math.min(maxPage, p + 1))} className="px-2 py-1 border rounded">Sau »</button>
          {canEdit && (
            <button
              onClick={handleSaveAll}
              disabled={!canSave}
              className={`px-3 py-1 rounded border ${canSave ? "" : "opacity-50 cursor-not-allowed"}`}
            >
              Lưu chỉnh sửa
            </button>
          )}
        </div>
      </div>

      {!query && mode === "saved" && (
        <div className="text-xs text-gray-500">
          Hiển thị tối đa {pageSize} dòng trên một trang. Nhập từ khóa hoặc dùng bộ lọc để tìm thêm tờ khai.
        </div>
      )}

      {selectionEnabled && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-600">Đã chọn {selectedKeys.length} tờ khai</span>
          <button
            type="button"
            onClick={handleSelectFiltered}
            disabled={!filteredKeys.length || filteredSelected}
            data-tooltip="Chọn toàn bộ tờ khai phù hợp với bộ lọc hiện tại"
            className={`px-3 py-1 rounded border ${
              filteredKeys.length && !filteredSelected
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "opacity-50 cursor-not-allowed"
            }`}
          >
            Chọn tất cả kết quả lọc
          </button>
          <button
            type="button"
            onClick={handleMarkReviewed}
            disabled={!canReview}
            className={`px-3 py-1 rounded border ${
              canReview ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "opacity-50 cursor-not-allowed"
            }`}
          >
            Đánh dấu đã rà soát
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={!canDelete}
              className={`px-3 py-1 rounded border ${
                canDelete ? "bg-red-50 text-red-600 border-red-300" : "opacity-50 cursor-not-allowed"
              }`}
            >
              Xóa các tờ khai đã chọn
            </button>
          )}
          <button
            type="button"
            onClick={handleApplyLicenseExclusion}
            disabled={selectedKeys.length === 0}
            data-tooltip="Đối chiếu lại giấy phép theo bộ quy tắc và loại bỏ mã bị loại trừ"
            className={`px-3 py-1 rounded border ${
              selectedKeys.length
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "opacity-50 cursor-not-allowed"
            }`}
          >
            Đối chiếu giấy phép
          </button>
          <button
            type="button"
            onClick={handleExportSelected}
            disabled={selectedKeys.length === 0}
            data-tooltip="Xuất Excel danh sách tờ khai đã chọn"
            className={`px-3 py-1 rounded border ${
              selectedKeys.length
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "opacity-50 cursor-not-allowed"
            }`}
          >
            Export Excel
          </button>
          {selectedKeys.length > 0 && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="px-3 py-1 rounded border"
            >
              Bỏ chọn
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto overflow-y-hidden border rounded">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="bg-gray-50">
            <tr>
              {selectionEnabled && <th className="px-2 py-1 text-left w-10">Chọn</th>}
              <th className="px-2 py-1 text-left">Ngày</th>
              <th className="px-2 py-1 text-left">Số tờ khai</th>
              <th className="px-2 py-1 text-left">Số TK AMA</th>
              <th className="px-2 py-1 text-left">MST</th>
              <th className="px-2 py-1 text-left">Công ty</th>
              <th className="px-2 py-1 text-left">Loại hình</th>
              <th className="px-2 py-1 text-left">C/O</th>
              <th className="px-2 py-1 text-left">Mục hàng</th>
              <th className="px-2 py-1 text-left">Nhân viên</th>
              <th className="px-2 py-1 text-left">Tổ đội</th>
              <th className="px-2 py-1 text-left">Đại lý</th>
              <th className="px-2 py-1 text-left">Trạng thái</th>
              <th className="px-2 py-1 text-left">Số lượng GP</th>
              <th className="px-2 py-1 text-left">KPI</th>
              {canEdit && mode === "saved" && <th className="px-2 py-1 text-left w-16">Xóa</th>}
            </tr>
          </thead>
          <tbody>
          {pageRows.map((r, i) => {
            const rowKey = keyOfRow(r);
            const rowEditable = isRowEditable(r);
            const rowReadOnly = isReadOnlyForEdits || !rowEditable;
            return (
              <tr
                key={`${rowKey}_${i}`}
                className="odd:bg-[color:var(--ds-surface-card)] even:bg-[color:var(--ds-surface-muted)]"
              >
                {selectionEnabled && (
                  <td className="px-2 py-1">
                    <input
                      type="checkbox"
                      checked={selectedKeys.includes(rowKey)}
                      onChange={() => handleToggleSelect(r)}
                      disabled={rowReadOnly}
                    />
                  </td>
                )}
                <td className="px-2 py-1">
                  <span title={r.raw_date || ""}>{formatDisplayDate(r.date || r.raw_date || "")}</span>
                </td>
                <td className="px-2 py-1">
                  <div className="flex flex-wrap items-center gap-1">
                    <span>{r.so_tk_full || r.so_tk || ""}</span>
                    {r.so_tk_suffix ? (
                      <span className="text-[10px] uppercase text-gray-400">{r.so_tk_suffix}</span>
                    ) : null}
                    {updatedKeySet.has(rowKey) && (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">Cap nhat</span>
                    )}
                    {coMismatchKeySet.has(rowKey) && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">CO lech</span>
                    )}
                    {duplicate11KeeperSet.has(rowKey) && (
                      <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">Giữ mới nhất</span>
                    )}
                    {duplicate11DuplicatesSet.has(rowKey) && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Trùng 11 số</span>
                    )}
                    {r.duplicate_review_pending && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">Chờ rà soát</span>
                    )}
                    {rowReadOnly && (
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">Chỉ xem</span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-1">
                  <span>{r.so_tk_ama || ""}</span>
                </td>
                <td className="px-2 py-1">
                  <span>{r.mst || ""}</span>
                </td>
                <td className="px-2 py-1">
                  <span>{r.cong_ty || ""}</span>
                </td>
                <td className="px-2 py-1">
                  <span>{r.loai_hinh || ""}</span>
                </td>
                <td className="px-2 py-1">
                  {(() => {
                    const lines = coLineCount(r);
                    const status = coLabel(r);
                    const display = lines > 0 ? String(lines) : status;
                    const hasValue = !!display;
                    return (
                      <span className={hasValue ? "text-emerald-600 font-medium" : "text-gray-400"}>
                        {display || ""}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-2 py-1">
                  <span>{r.muc_hang ?? ""}</span>
                </td>
                <td className="px-2 py-1">
                  {rowReadOnly ? (
                    <span>{r.nhan_vien || ""}</span>
                  ) : (
                    <input
                      className="border rounded px-1 py-0.5 w-32"
                      value={r.nhan_vien || ""}
                      onChange={e => onChangeCell(rowKey, "nhan_vien", e.target.value)}
                    />
                  )}
                </td>
                <td className="px-2 py-1">
                  {rowReadOnly ? (
                    <span>{r.team || ""}</span>
                  ) : (
                    <input
                      className="border rounded px-1 py-0.5 w-24"
                      value={r.team || ""}
                      onChange={e => onChangeCell(rowKey, "team", e.target.value)}
                    />
                  )}
                </td>
                <td className="px-2 py-1">
                  {rowReadOnly ? (
                    <span>{r.agency || r.dai_ly || ""}</span>
                  ) : (
                    <input
                      className="border rounded px-1 py-0.5 w-28"
                      value={r.agency || r.dai_ly || ""}
                      onChange={e => applyEdit(rowKey, () => ({ agency: e.target.value, dai_ly: e.target.value }))}
                    />
                  )}
                </td>
                <td className="px-2 py-1">
                  {(() => {
                    const hasStaff = !!(r.nhan_vien && r.nhan_vien.toString().trim());
                    const hasTeam = !!(r.team && r.team.toString().trim());
                    if (r.reviewed) {
                      return <span className="text-emerald-700">Đã rà soát</span>;
                    }
                    if (!hasStaff || !hasTeam) {
                      const missing = [];
                      if (!hasStaff) missing.push("nhân viên");
                      if (!hasTeam) missing.push("tổ đội");
                      return <span className="text-amber-600">Thiếu {missing.join(" & ")}</span>;
                    }
                    return <span className="text-gray-600">Đủ thông tin</span>;
                  })()}
                </td>
                <td className="px-2 py-1">
                  {rowReadOnly ? (
                    <span>{r.licenses ?? r.so_luong_gp ?? ""}</span>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="border rounded px-1 py-0.5 w-24"
                      value={r.licenses ?? r.so_luong_gp ?? ""}
                      onChange={e => {
                        const input = e.target.value;
                        if (input === "") {
                          applyEdit(rowKey, () => ({ licenses: "", so_luong_gp: "", licenseManualCount: null }));
                          return;
                        }
                        const parsed = Number(input);
                        if (!Number.isFinite(parsed)) return;
                        const normalized = Math.max(0, Math.round(parsed));
                        applyEdit(rowKey, () => ({
                          licenses: normalized,
                          so_luong_gp: normalized,
                          licenseManualCount: normalized,
                        }));
                      }}
                    />
                  )}
                </td>
                <td className="px-2 py-1">
                  {(() => {
                    const kpi = computeKPI(r, rules);
                    if (!Number.isFinite(kpi)) return "-";
                    return kpi.toFixed(1);
                  })()}
                </td>
                {deleteEnabled && rowEditable && (
                  <td className="px-2 py-1">
                    <button
                      type="button"
                      onClick={() => handleDeleteSingle(r)}
                      className="px-2 py-0.5 rounded bg-red-500 text-white text-xs"
                    >
                      Xóa
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
            {pageRows.length === 0 && (
              <tr>
                <td className="px-2 py-4 text-center text-gray-500" colSpan={totalColumns}>
                  Không có dữ liệu
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        * Số lượng GP được tự động đếm theo các loại giấy phép hợp lệ (đã loại trừ theo mục Quy tắc KPI).
        Bạn có thể điều chỉnh thủ công trước khi lưu để phản ánh thực tế kiểm tra.
      </p>
    </div>
    </>
  );
}





