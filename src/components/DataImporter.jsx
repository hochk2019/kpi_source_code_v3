// src/components/DataImporter.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  getDeclRows,
  saveDeclRows,
  sortDeclRows,
  pushImportLog,
  pushAuditLog,
  updateDeclRowFields,
  getDeclHistoryForRow,
  getTeamRoster,
  mapMemberNamesToTeams,
  markDeclRowsReviewed,
  unmarkDeclRowsReviewed,
  mapHQAgenciesByMST,
  normalizeStr,
  normalizeDeclarationNumber,
  normalizeName,
  refreshDeclRowsFromServer,
  IMPORT_COLUMN_IDS,
  getImportColumnConfig,
  saveImportColumnConfig,
  subscribeImportColumnConfig,
} from "@/lib/store.js";
import { mapRow, detectDateOrder } from "@/lib/importer.js";
import { loadRules, computeKPI, extractLicenseCodesFromRowObj } from "@/lib/rules.js";
import { computeLicenseSnapshot } from "../../shared/licenseSummary.js";
import CollapsibleCard from "./CollapsibleCard.jsx";
import { deriveCOStatus, coLabel, coLineCount } from "@/shared/co.js";
import { formatDisplayDate, formatDateRangeLabel } from "@/shared/format.js";
import { fetchWithAuth } from "@/auth/localAuth.js";
import useTooltipTitles from "@/hooks/useTooltipTitles.js";
import useFilterPresets from "@/hooks/useFilterPresets.js";
import { Button } from "@/components/ui/button.jsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command.jsx";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.jsx";
import { ScrollArea } from "@/components/ui/scroll-area.jsx";
import { toast } from "@/shared/toast.js";
import { Check, ChevronsUpDown, CircleX, Plus } from "lucide-react";

function getRowKey(row) {
  const soTk = (row?.so_tk || "").toString();
  const nhanh = (row?.nhanh || "").toString();
  return `${soTk}_${nhanh}`;
}

const EDITABLE_FIELD_KEYS = [
  "nhan_vien",
  "team",
  "agency",
  "dai_ly",
  "licenses",
  "so_luong_gp",
  "licenseManualCount",
];

const DECL_HISTORY_FIELD_LABELS = Object.freeze({
  nhan_vien: "Nhân viên",
  team: "Tổ đội",
  agency: "Đại lý",
  dai_ly: "Đại lý",
  licenses: "Số lượng giấy phép",
  so_luong_gp: "Số lượng giấy phép",
  licenseManualCount: "Số lượng giấy phép (thủ công)",
});

const DECL_HISTORY_ENTRY_LIMIT = 15;

const IMPORT_TABLE_COLUMN_LABELS = Object.freeze({
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

const IMPORT_TABLE_COLUMNS = Object.freeze(
  IMPORT_COLUMN_IDS.map((id) => ({
    id,
    label: IMPORT_TABLE_COLUMN_LABELS[id] || id,
  }))
);

function normalizeComparableValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return normalizeStr(value);
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : "";
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return JSON.stringify(value);
}

function collectEditableDiff(baseline, current) {
  if (!baseline || typeof baseline !== "object") return null;
  if (!current || typeof current !== "object") return null;
  const diff = {};
  for (const field of EDITABLE_FIELD_KEYS) {
    const baseValue = Object.prototype.hasOwnProperty.call(baseline, field)
      ? baseline[field]
      : null;
    const currentHasField = Object.prototype.hasOwnProperty.call(current, field);
    const currentValue = currentHasField ? current[field] : null;
    if (normalizeComparableValue(baseValue) === normalizeComparableValue(currentValue)) {
      continue;
    }
    diff[field] = currentHasField ? currentValue : null;
  }
  return Object.keys(diff).length ? diff : null;
}

function buildRosterTeams(rosterSnapshot) {
  const rawTeams = Array.isArray(rosterSnapshot?.teams) ? rosterSnapshot.teams : [];
  const teams = [];

  rawTeams.forEach((team, teamIndex) => {
    const name = normalizeStr(team?.name);
    const normalized = normalizeName(name);
    if (!name || !normalized) {
      return;
    }

    const members = Array.isArray(team?.members) ? team.members : [];
    const normalizedMembers = members
      .map((member, memberIndex) => {
        const memberName = normalizeStr(member?.name);
        const memberNormalized = normalizeName(memberName);
        if (!memberName || !memberNormalized) {
          return null;
        }
        return {
          id: member?.id || `${teamIndex}-${memberIndex}`,
          name: memberName,
          normalized: memberNormalized,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name, "vi", { sensitivity: "base" }));

    teams.push({
      id: team?.id || `${teamIndex}`,
      name,
      normalized,
      members: normalizedMembers,
    });
  });

  return teams.sort((a, b) => a.name.localeCompare(b.name, "vi", { sensitivity: "base" }));
}

function TeamCombobox({ value, onSelect, teams, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const normalizedValue = normalizeStr(value);
  const normalizedKey = normalizeName(normalizedValue);
  const existingKeys = useMemo(() => new Set(teams.map((team) => team.normalized)), [teams]);
  const searchValue = normalizeStr(search);
  const searchKey = normalizeName(searchValue);
  const canCreateCustom = Boolean(searchKey) && !existingKeys.has(searchKey);

  const handleSelect = (teamName) => {
    onSelect?.({ teamName });
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-28 justify-between px-2 py-0 text-left font-normal"
        >
          <span className="truncate">
            {normalizedValue || "Chọn tổ đội"}
          </span>
          <ChevronsUpDown className="ml-2 size-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Tìm tổ đội"
            value={search}
            onValueChange={setSearch}
            autoFocus
          />
          <CommandList className="max-h-60 overflow-y-auto">
            <CommandEmpty>Không có tổ đội phù hợp.</CommandEmpty>
            {normalizedValue ? (
              <CommandGroup heading="Tùy chọn">
                <CommandItem value="__clear__" onSelect={() => handleSelect("")}>
                  <CircleX className="mr-2 size-4" />
                  Bỏ chọn tổ đội
                </CommandItem>
              </CommandGroup>
            ) : null}
            {canCreateCustom ? (
              <CommandGroup heading="Thêm mới">
                <CommandItem value={searchValue} onSelect={() => handleSelect(searchValue)}>
                  <Plus className="mr-2 size-4" />
                  Dùng giá trị "{searchValue}"
                </CommandItem>
              </CommandGroup>
            ) : null}
            <CommandGroup heading="Danh sách tổ đội">
              {teams.map((team) => {
                const isSelected = team.normalized === normalizedKey;
                return (
                  <CommandItem
                    key={team.id}
                    value={`${team.name}`}
                    onSelect={() => handleSelect(team.name)}
                  >
                    <Check
                      className={`mr-2 size-4 ${isSelected ? "opacity-100" : "opacity-0"}`}
                    />
                    <span className="truncate">{team.name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function StaffCombobox({
  value,
  teamValue,
  onSelect,
  teams,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const normalizedValue = normalizeStr(value);
  const normalizedKey = normalizeName(normalizedValue);
  const normalizedTeamValue = normalizeName(normalizeStr(teamValue));

  const staffIndex = useMemo(() => {
    const result = [];
    teams.forEach((team) => {
      team.members.forEach((member) => {
        result.push({
          teamId: team.id,
          teamName: team.name,
          teamNormalized: team.normalized,
          memberId: member.id,
          name: member.name,
          normalized: member.normalized,
        });
      });
    });
    return result;
  }, [teams]);

  const filteredTeams = useMemo(() => {
    if (normalizedTeamValue) {
      const match = teams.filter((team) => team.normalized === normalizedTeamValue);
      if (match.length) {
        return match;
      }
    }
    return teams;
  }, [teams, normalizedTeamValue]);

  const searchValue = normalizeStr(search);
  const searchKey = normalizeName(searchValue);
  const hasExactStaff = staffIndex.some((entry) => entry.normalized === searchKey);
  const canCreateCustom = Boolean(searchKey) && !hasExactStaff;

  const handleSelect = (staffName, teamName) => {
    onSelect?.({ staffName, teamName });
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-36 justify-between px-2 py-0 text-left font-normal"
        >
          <span className="truncate">
            {normalizedValue || "Chọn nhân viên"}
          </span>
          <ChevronsUpDown className="ml-2 size-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Tìm nhân viên"
            value={search}
            onValueChange={setSearch}
            autoFocus
          />
          <CommandList className="max-h-60 overflow-y-auto">
            <CommandEmpty>Không có nhân viên phù hợp.</CommandEmpty>
            {normalizedValue ? (
              <CommandGroup heading="Tùy chọn">
                <CommandItem value="__clear__" onSelect={() => handleSelect("", undefined)}>
                  <CircleX className="mr-2 size-4" />
                  Bỏ chọn nhân viên
                </CommandItem>
              </CommandGroup>
            ) : null}
            {canCreateCustom ? (
              <CommandGroup heading="Thêm mới">
                <CommandItem value={searchValue} onSelect={() => handleSelect(searchValue, undefined)}>
                  <Plus className="mr-2 size-4" />
                  Dùng giá trị "{searchValue}"
                </CommandItem>
              </CommandGroup>
            ) : null}
            {filteredTeams.map((team) => (
              <CommandGroup key={team.id} heading={`Tổ: ${team.name}`}>
                {team.members.map((member) => {
                  const isSelected = member.normalized === normalizedKey;
                  return (
                    <CommandItem
                      key={member.id}
                      value={`${member.name} ${team.name}`}
                      onSelect={() => handleSelect(member.name, team.name)}
                    >
                      <Check
                        className={`mr-2 size-4 ${isSelected ? "opacity-100" : "opacity-0"}`}
                      />
                      <span className="flex-1 truncate">{member.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{team.name}</span>
                    </CommandItem>
                  );
                })}
                {team.members.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Chưa có nhân viên trong tổ này.
                  </div>
                ) : null}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

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

const FILTER_PRESET_SCOPE = "data-importer";
const LAST_FILTER_PRESET_KEY = "kpi:data-importer:last-preset-v1";
const LEGACY_FILTER_STORAGE_KEY = "kpi:data-importer:filter:v1";

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
    fields: [
      "co",
      "co_status",
      "co_notes",
      "co_issue",
      "__co_status",
      "__co_lines",
    ],
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

const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_IMPORT_ROWS = 5000;
const ACCEPTED_IMPORT_EXTENSIONS = Object.freeze([".xlsx", ".xlsm"]);

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

function humanizeDiffKey(key) {
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
    } catch (err) {
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
    const joined = value
      .map((item) => formatDiffValue(item, key))
      .filter((part) => part !== "")
      .join(DUPLICATE_DIFF_MULTILINE_KEYS.has(key) ? "\n" : ", ");
    return joined;
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch (err) {
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

function createDuplicateDiffGroups(baseValues, compareValues) {
  if (!baseValues || !compareValues) return [];
  const remainingKeys = new Set([
    ...Object.keys(baseValues || {}),
    ...Object.keys(compareValues || {}),
  ]);
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
      if (typeof baseValue === "string" || typeof compareValue === "string") {
        // keep for further formatting below
      }
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
    const label = DUPLICATE_DIFF_FIELD_LABELS[key] || humanizeDiffKey(key);
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
      label,
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

function normalizeAgencyKey(value) {
  let normalized = normalizeStr(value);
  if (!normalized) return "";
  let previous = null;
  while (normalized && normalized !== previous) {
    previous = normalized;
    normalized = normalized.replace(/^[\s"'([{<]+|[\s"'(){}\]}>]+$/g, "");
    normalized = normalizeStr(normalized);
  }
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
    if (value === undefined || value === null) return;
    const normalized = normalizeAgencyKey(value);
    if (normalized) {
      keys.add(normalized);
    }
    const parentMatches = String(value)
      .match(/\(([^)]+)\)/g);
    if (parentMatches) {
      parentMatches.forEach((segment) => {
        const inner = segment.replace(/^\(|\)$/g, "");
        const normalizedInner = normalizeAgencyKey(inner);
        if (normalizedInner) {
          keys.add(normalizedInner);
        }
      });
    }
  };
  if (Array.isArray(row?.agents)) {
    for (const agent of row.agents) {
      addKey(agent);
    }
  }
  const raw = row?.agency ?? row?.dai_ly ?? row?.hq_agency ?? "";
  if (Array.isArray(raw)) {
    for (const value of raw) {
      addKey(value);
    }
  } else if (typeof raw === "string") {
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

function formatHistoryTimestamp(timestamp) {
  if (!timestamp) {
    return "Không xác định";
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: undefined,
    hour12: false,
  });
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
  const savedRowSnapshotRef = useRef(new Map());
  const [baselineVersion, setBaselineVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState("saved");         // saved | preview
  const [selectedFile, setSelectedFile] = useState("");
  const {
    presets: savedPresets,
    loading: presetLoading,
    error: presetError,
    clearError: clearPresetError,
    refresh: refreshPresetList,
    createPreset: createFilterPreset,
    updatePreset: updateFilterPreset,
    deletePreset: deleteFilterPreset,
  } = useFilterPresets(FILTER_PRESET_SCOPE);
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
  const [rowSaveStatus, setRowSaveStatus] = useState({});
  const [rowHistoryExpanded, setRowHistoryExpanded] = useState({});
  const [rowHistoryEntries, setRowHistoryEntries] = useState({});
  const [duplicateReviewOpen, setDuplicateReviewOpen] = useState(false);
  const [duplicateReviewConfirmed, setDuplicateReviewConfirmed] = useState(false);
  const [duplicate11Plan, setDuplicate11Plan] = useState({});
  const [duplicateDiffState, setDuplicateDiffState] = useState({
    open: false,
    group: null,
    baseKey: null,
    compareKey: null,
  });
  const [columnConfigState, setColumnConfigState] = useState(() => getImportColumnConfig());
  const [columnConfigOpen, setColumnConfigOpen] = useState(false);
  const [columnDraftHidden, setColumnDraftHidden] = useState(() => new Set());
  const [columnDraftError, setColumnDraftError] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [appliedPresetId, setAppliedPresetId] = useState("");
  const [presetSaving, setPresetSaving] = useState(false);
  const lastPresetSeedRef = useRef("");
  const presetAutoAppliedRef = useRef(false);

  // Tuỳ chọn
  const [overwrite, setOverwrite] = useState(false);         // Ghi đè toàn bộ
  const [upsert11, setUpsert11] = useState(true);            // Upsert theo 11 số đầu (nếu có dùng merge cục bộ)
  const [autoAssignStaff, setAutoAssignStaff] = useState(true); // Tự gán nhân viên theo MST nếu trống

  const actor = currentUser?.username || "guest";
  const isReadOnlyForEdits = !canEdit;
  const canReviewAlerts = canEdit || canManageAlerts;
  const normalizedRole = normalizeRoleKey(currentUser?.role);
  const isTeamLead = normalizedRole === TEAM_LEAD_ROLE;
  const isStaffRole = normalizedRole === DEFAULT_ROLE;
  const isAdminRole = normalizedRole === ADMIN_ROLE;
  const isManagerRole = normalizedRole === MANAGER_ROLE || normalizedRole === ADMIN_ROLE;
  const rosterSnapshot = useMemo(() => getTeamRoster(), [currentUser]);
  const rosterTeams = useMemo(() => buildRosterTeams(rosterSnapshot), [rosterSnapshot]);
  const memberTeamMap = useMemo(() => mapMemberNamesToTeams(rosterSnapshot), [rosterSnapshot]);
  const staffDisplayName = normalizeStr(currentUser?.name || currentUser?.username || "");
  const staffNameKey = normalizeName(staffDisplayName);
  const assignedTeam = staffNameKey ? memberTeamMap.get(staffNameKey)?.team || "" : "";
  const assignedTeamKey = normalizeName(assignedTeam);
  const totalBaseColumns = IMPORT_TABLE_COLUMNS.length;
  const columnHiddenSet = useMemo(() => {
    const hiddenList = Array.isArray(columnConfigState?.hidden) ? columnConfigState.hidden : [];
    const set = new Set();
    hiddenList.forEach((key) => {
      if (typeof key === "string" && IMPORT_TABLE_COLUMN_LABELS[key]) {
        set.add(key);
      }
    });
    return set;
  }, [columnConfigState]);
  const visibleColumnCount = Math.max(1, totalBaseColumns - columnHiddenSet.size);
  const canUploadFiles = canEdit && !(isTeamLead || isStaffRole);
  const canOverwriteData = isAdminRole && canUploadFiles;

  const updateBaselineSnapshot = useCallback((rows) => {
    const snapshot = new Map();
    if (Array.isArray(rows)) {
      for (const row of rows) {
        const key = getRowKey(row);
        if (!key) continue;
        snapshot.set(key, { ...row });
      }
    }
    savedRowSnapshotRef.current = snapshot;
    setBaselineVersion((prev) => prev + 1);
  }, []);

  const refreshRowHistory = useCallback((rowKey) => {
    const key = typeof rowKey === "string" ? rowKey.trim() : String(rowKey || "").trim();
    if (!key) {
      return;
    }
    const entries = getDeclHistoryForRow(key, DECL_HISTORY_ENTRY_LIMIT) || [];
    setRowHistoryEntries((prev) => ({
      ...prev,
      [key]: entries,
    }));
  }, []);

  const handleToggleHistory = useCallback(
    (rowKey) => {
      const key = typeof rowKey === "string" ? rowKey.trim() : String(rowKey || "").trim();
      if (!key) {
        return;
      }
      setRowHistoryExpanded((prev) => {
        const nextExpanded = !prev[key];
        const nextState = { ...prev, [key]: nextExpanded };
        if (nextExpanded) {
          refreshRowHistory(key);
        }
        return nextState;
      });
    },
    [refreshRowHistory]
  );

  const handleOpenColumnConfig = useCallback(() => {
    setColumnDraftHidden(new Set(columnHiddenSet));
    setColumnDraftError("");
    setColumnConfigOpen(true);
  }, [columnHiddenSet]);

  const handleOverwriteToggle = useCallback(
    (nextValue) => {
      if (!canOverwriteData) {
        setOverwrite(false);
        return;
      }
      if (nextValue) {
        const confirmed =
          typeof window !== "undefined" &&
          window.confirm(
            "Cảnh báo: Ghi đè toàn bộ sẽ thay thế dữ liệu hiện có bằng file import. Bạn chắc chắn muốn tiếp tục?"
          );
        if (!confirmed) {
          return;
        }
      }
      setOverwrite(nextValue);
    },
    [canOverwriteData]
  );

  const handleToggleColumnDraft = useCallback(
    (columnId) => {
      if (typeof columnId !== "string" || !IMPORT_TABLE_COLUMN_LABELS[columnId]) {
        return;
      }
      setColumnDraftHidden((prev) => {
        const next = new Set(prev);
        if (next.has(columnId)) {
          next.delete(columnId);
          setColumnDraftError("");
          return next;
        }
        if (totalBaseColumns - next.size <= 1) {
          setColumnDraftError("Cần giữ lại ít nhất một cột hiển thị.");
          return next;
        }
        next.add(columnId);
        setColumnDraftError("");
        return next;
      });
    },
    [totalBaseColumns]
  );

  const handleApplyColumnConfig = useCallback(() => {
    const hiddenList = Array.from(columnDraftHidden).filter((key) => IMPORT_TABLE_COLUMN_LABELS[key]);
    if (hiddenList.length >= totalBaseColumns) {
      setColumnDraftError("Cần giữ lại ít nhất một cột hiển thị.");
      return;
    }
    const isSame =
      hiddenList.length === columnHiddenSet.size && hiddenList.every((key) => columnHiddenSet.has(key));
    if (isSame) {
      setColumnConfigOpen(false);
      return;
    }
    try {
      const result = saveImportColumnConfig({ hidden: hiddenList }, { actor });
      if (result.hidden.length >= totalBaseColumns) {
        setColumnDraftError("Cần giữ lại ít nhất một cột hiển thị.");
        return;
      }
      setColumnConfigOpen(false);
      setColumnDraftError("");
      toast.success("Đã cập nhật cấu hình cột Import Data.");
    } catch (err) {
      console.error("Không thể lưu cấu hình cột Import Data", err);
      setColumnDraftError("Có lỗi xảy ra khi lưu cấu hình. Vui lòng thử lại.");
    }
  }, [actor, columnDraftHidden, columnHiddenSet, totalBaseColumns]);

  useEffect(() => {
    const unsubscribe = subscribeImportColumnConfig((config) => {
      setColumnConfigState(config);
    });
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (!columnConfigOpen) {
      return;
    }
    setColumnDraftHidden(new Set(columnHiddenSet));
    setColumnDraftError("");
  }, [columnConfigOpen, columnHiddenSet]);

  useEffect(() => {
    if (!canOverwriteData && overwrite) {
      setOverwrite(false);
    }
  }, [canOverwriteData, overwrite]);
  const editingRestrictionMessage = useMemo(() => {
    if (!canEdit) return "";
    if (isManagerRole) return "";
    if (isTeamLead) {
      return assignedTeam
        ? `Bạn chỉ có thể chỉnh sửa tờ khai thuộc tổ ${assignedTeam}.`
        : "Bạn chỉ có thể chỉnh sửa tờ khai thuộc tổ đội do mình phụ trách.";
    }
    if (isStaffRole) {
      if (assignedTeam) {
        return `Bạn chỉ có thể chỉnh sửa tờ khai thuộc tổ ${assignedTeam}.`;
      }
      return "Bạn chỉ có thể chỉnh sửa tờ khai đã gán cho tên của bạn.";
    }
    return "";
  }, [assignedTeam, canEdit, isManagerRole, isStaffRole, isTeamLead]);
  const teamChangeRestrictionMessage = useMemo(() => {
    if (!canEdit) return "";
    if (!isStaffRole) return "";
    if (!assignedTeam) {
      return "Bạn không thể gán tờ khai sang tổ đội khác.";
    }
    return `Bạn chỉ được gán tổ đội ${assignedTeam}.`;
  }, [assignedTeam, canEdit, isStaffRole]);
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
      const rowTeamKey = normalizeName(row?.team);
      if (isTeamLead) {
        if (!assignedTeamKey) return false;
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
        if (!assignedTeamKey) {
          return rowStaffKey && rowStaffKey === staffNameKey;
        }
        if (!rowTeamKey) {
          if (!rowStaffKey) return true;
          return rowStaffKey === staffNameKey;
        }
        return rowTeamKey === assignedTeamKey;
      }
      return true;
    },
    [
      assignedTeamKey,
      canEdit,
      isManagerRole,
      isStaffRole,
      isTeamLead,
      memberTeamMap,
      staffNameKey,
    ]
  );
  const sanitizeRowUpdates = useCallback(
    (row, updates) => {
      if (!updates || typeof updates !== "object") return updates;
      if (!isStaffRole) return updates;
      if (!Object.prototype.hasOwnProperty.call(updates, "team")) {
        return updates;
      }
      const nextTeamRaw = updates.team ?? "";
      const nextTeamKey = normalizeName(nextTeamRaw);
      if (!assignedTeamKey) {
        return updates;
      }
      if (nextTeamKey && nextTeamKey !== assignedTeamKey) {
        if (teamChangeRestrictionMessage) {
          alert(teamChangeRestrictionMessage);
        }
        return null;
      }
      return updates;
    },
    [assignedTeamKey, isStaffRole, teamChangeRestrictionMessage]
  );
  const keyOfRow = useCallback((row) => getRowKey(row), []);
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

  const buildFilterPresetPayload = useCallback(() => {
    const payload = {
      datePreset,
      coFilterMode,
      coFilterMin,
    };
    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      payload.query = trimmedQuery;
    }
    if (searchRange.from || searchRange.to) {
      payload.range = {
        from: searchRange.from || "",
        to: searchRange.to || "",
      };
    }
    if (filterNoStaff) {
      payload.filterNoStaff = true;
    }
    if (filterNoTeam) {
      payload.filterNoTeam = true;
    }
    if (filterDuplicate11) {
      payload.filterDuplicate11 = true;
    }
    return payload;
  }, [query, searchRange.from, searchRange.to, filterNoStaff, filterNoTeam, filterDuplicate11, coFilterMode, coFilterMin, datePreset]);

  const applyPresetFilters = useCallback(
    (preset, { notify = true } = {}) => {
      if (!preset || typeof preset !== "object") {
        alert("Không tìm thấy bộ lọc đã lưu.");
        return;
      }
      clearPresetError();
      const filters = preset.filters && typeof preset.filters === "object" ? preset.filters : {};
      setQuery(typeof filters.query === "string" ? filters.query : "");
      if (filters.range && typeof filters.range === "object") {
        setSearchRange({
          from: typeof filters.range.from === "string" ? filters.range.from : "",
          to: typeof filters.range.to === "string" ? filters.range.to : "",
        });
      } else {
        setSearchRange({ from: "", to: "" });
      }
      const nextPresetKey =
        typeof filters.datePreset === "string" && filters.datePreset
          ? filters.datePreset
          : filters.range && (filters.range.from || filters.range.to)
          ? "custom"
          : "none";
      setDatePreset(nextPresetKey);
      setFilterNoStaff(filters.filterNoStaff === true);
      setFilterNoTeam(filters.filterNoTeam === true);
      setFilterDuplicate11(filters.filterDuplicate11 === true);
      setCoFilterMode(
        typeof filters.coFilterMode === "string" && filters.coFilterMode
          ? filters.coFilterMode
          : "all"
      );
      const minValue = Number(filters.coFilterMin);
      setCoFilterMin(Number.isFinite(minValue) ? Math.max(0, Math.round(minValue)) : 5);
      setPage(1);
      if (preset.id) {
        setSelectedPresetId(preset.id);
        setAppliedPresetId(preset.id);
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(LAST_FILTER_PRESET_KEY, preset.id);
          } catch (error) {
            console.warn("Không thể lưu bộ lọc đang áp dụng", error);
          }
        }
      }
      presetAutoAppliedRef.current = true;
      if (notify) {
        alert(`Đã áp dụng bộ lọc "${preset.name}".`);
      }
    },
    [clearPresetError]
  );

  const presetBusy = presetLoading || presetSaving;

  const selectedPreset = useMemo(
    () => savedPresets.find((item) => item.id === selectedPresetId) || null,
    [savedPresets, selectedPresetId]
  );

  const appliedPreset = useMemo(
    () => savedPresets.find((item) => item.id === appliedPresetId) || null,
    [savedPresets, appliedPresetId]
  );

  const appliedPresetUpdatedAt = useMemo(() => {
    if (!appliedPreset?.updatedAt) {
      return "";
    }
    try {
      return new Date(appliedPreset.updatedAt).toLocaleString("vi-VN");
    } catch (error) {
      console.warn("Không thể định dạng thời gian cập nhật bộ lọc", error);
      return "";
    }
  }, [appliedPreset]);

  useEffect(() => {
    if (typeof window === "undefined") {
      presetAutoAppliedRef.current = true;
      return;
    }
    try {
      const storedId = window.localStorage.getItem(LAST_FILTER_PRESET_KEY);
      if (storedId) {
        lastPresetSeedRef.current = storedId;
        setSelectedPresetId(storedId);
      }
    } catch (error) {
      console.warn("Không thể đọc bộ lọc đã áp dụng gần đây", error);
    }
  }, []);

  useEffect(() => {
    if (presetAutoAppliedRef.current) {
      return;
    }
    if (!savedPresets.length) {
      return;
    }
    const targetId = lastPresetSeedRef.current;
    if (targetId) {
      const preset = savedPresets.find((item) => item.id === targetId);
      if (preset) {
        applyPresetFilters(preset, { notify: false });
        return;
      }
    }
    presetAutoAppliedRef.current = true;
  }, [savedPresets, applyPresetFilters]);

  useEffect(() => {
    if (selectedPresetId && !savedPresets.some((item) => item.id === selectedPresetId)) {
      setSelectedPresetId("");
    }
  }, [selectedPresetId, savedPresets]);

  useEffect(() => {
    if (appliedPresetId && !savedPresets.some((item) => item.id === appliedPresetId)) {
      setAppliedPresetId("");
    }
  }, [appliedPresetId, savedPresets]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const raw = window.localStorage.getItem(LEGACY_FILTER_STORAGE_KEY);
        if (!raw) {
          return;
        }
        const stored = JSON.parse(raw);
        if (!stored || typeof stored !== "object") {
          window.localStorage.removeItem(LEGACY_FILTER_STORAGE_KEY);
          return;
        }
        if (savedPresets.length > 0) {
          window.localStorage.removeItem(LEGACY_FILTER_STORAGE_KEY);
          return;
        }
        const range =
          stored.range && typeof stored.range === "object"
            ? {
                from: typeof stored.range.from === "string" ? stored.range.from : "",
                to: typeof stored.range.to === "string" ? stored.range.to : "",
              }
            : null;
        const normalizedFilters = {};
        if (typeof stored.query === "string" && stored.query.trim()) {
          normalizedFilters.query = stored.query.trim();
        }
        if (range && (range.from || range.to)) {
          normalizedFilters.range = range;
        }
        if (stored.filterNoStaff === true) {
          normalizedFilters.filterNoStaff = true;
        }
        if (stored.filterNoTeam === true) {
          normalizedFilters.filterNoTeam = true;
        }
        if (stored.filterDuplicate11 === true) {
          normalizedFilters.filterDuplicate11 = true;
        }
        if (typeof stored.coFilterMode === "string" && stored.coFilterMode) {
          normalizedFilters.coFilterMode = stored.coFilterMode;
        }
        if (Number.isFinite(stored.coFilterMin)) {
          normalizedFilters.coFilterMin = Math.max(0, Math.round(Number(stored.coFilterMin)));
        }
        if (typeof stored.datePreset === "string" && stored.datePreset) {
          normalizedFilters.datePreset = stored.datePreset;
        }
        if (Object.keys(normalizedFilters).length === 0) {
          window.localStorage.removeItem(LEGACY_FILTER_STORAGE_KEY);
          return;
        }
        const preset = await createFilterPreset({
          name:
            typeof stored.name === "string" && stored.name.trim()
              ? stored.name.trim()
              : "Bộ lọc cũ",
          filters: normalizedFilters,
        });
        window.localStorage.removeItem(LEGACY_FILTER_STORAGE_KEY);
        if (!cancelled && preset) {
          applyPresetFilters(preset, { notify: false });
        }
      } catch (error) {
        console.warn("Không thể nhập bộ lọc đã lưu trước đây", error);
        try {
          window.localStorage.removeItem(LEGACY_FILTER_STORAGE_KEY);
        } catch (err) {
          console.warn("Không thể xoá bộ lọc cũ khỏi localStorage", err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [savedPresets, createFilterPreset, applyPresetFilters]);

  const handleApplySelectedPreset = useCallback(() => {
    const preset = savedPresets.find((item) => item.id === selectedPresetId);
    if (!preset) {
      alert("Vui lòng chọn bộ lọc cần áp dụng.");
      return;
    }
    applyPresetFilters(preset);
  }, [savedPresets, selectedPresetId, applyPresetFilters]);

  const handleSavePresetAsNew = useCallback(async () => {
    let presetName = selectedPreset ? `${selectedPreset.name} (bản sao)` : "Bộ lọc mới";
    if (typeof window !== "undefined") {
      const input = window.prompt("Đặt tên cho bộ lọc mới", presetName);
      if (input === null) {
        return;
      }
      presetName = input.trim();
      if (!presetName) {
        alert("Tên bộ lọc không được bỏ trống.");
        return;
      }
    }
    clearPresetError();
    setPresetSaving(true);
    try {
      const preset = await createFilterPreset({ name: presetName, filters: buildFilterPresetPayload() });
      setSelectedPresetId(preset.id);
      applyPresetFilters(preset, { notify: false });
      alert(`Đã lưu bộ lọc "${preset.name}".`);
    } catch (error) {
      alert(error?.message || "Không thể lưu bộ lọc đã lưu.");
    } finally {
      setPresetSaving(false);
    }
  }, [selectedPreset, clearPresetError, createFilterPreset, buildFilterPresetPayload, applyPresetFilters]);

  const handleOverwriteSelectedPreset = useCallback(async () => {
    if (!selectedPreset) {
      alert("Vui lòng chọn bộ lọc cần ghi đè.");
      return;
    }
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Ghi đè bộ lọc "${selectedPreset.name}" bằng điều kiện hiện tại?`)
    ) {
      return;
    }
    clearPresetError();
    setPresetSaving(true);
    try {
      const preset = await updateFilterPreset(selectedPreset.id, {
        name: selectedPreset.name,
        filters: buildFilterPresetPayload(),
      });
      applyPresetFilters(preset, { notify: false });
      alert(`Đã cập nhật bộ lọc "${preset.name}".`);
    } catch (error) {
      alert(error?.message || "Không thể cập nhật bộ lọc đã lưu.");
    } finally {
      setPresetSaving(false);
    }
  }, [selectedPreset, clearPresetError, updateFilterPreset, buildFilterPresetPayload, applyPresetFilters]);

  const handleDeleteSelectedPreset = useCallback(async () => {
    if (!selectedPreset) {
      alert("Vui lòng chọn bộ lọc cần xoá.");
      return;
    }
    if (typeof window !== "undefined" && !window.confirm(`Xoá bộ lọc "${selectedPreset.name}"?`)) {
      return;
    }
    clearPresetError();
    setPresetSaving(true);
    try {
      await deleteFilterPreset(selectedPreset.id);
      if (typeof window !== "undefined") {
        try {
          const storedId = window.localStorage.getItem(LAST_FILTER_PRESET_KEY);
          if (storedId === selectedPreset.id) {
            window.localStorage.removeItem(LAST_FILTER_PRESET_KEY);
          }
        } catch (error) {
          console.warn("Không thể cập nhật bộ lọc đã áp dụng gần đây", error);
        }
      }
      if (appliedPresetId === selectedPreset.id) {
        setAppliedPresetId("");
      }
      setSelectedPresetId("");
      alert(`Đã xoá bộ lọc "${selectedPreset.name}".`);
    } catch (error) {
      alert(error?.message || "Không thể xoá bộ lọc đã lưu.");
    } finally {
      setPresetSaving(false);
    }
  }, [selectedPreset, clearPresetError, deleteFilterPreset, appliedPresetId]);

  const handleRefreshPresetList = useCallback(() => {
    clearPresetError();
    refreshPresetList();
  }, [clearPresetError, refreshPresetList]);

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
      const agencyKey = normalizeAgencyKey(entry?.agency);
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
    updateBaselineSnapshot(saved);
    setRowSaveStatus({});
    setRowHistoryExpanded({});
    setRowHistoryEntries({});
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
  }, [fileRef, hasUnsaved, mode, updateBaselineSnapshot]);

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

  useEffect(() => {
    if (mode !== "saved") return;
    const pending = rowDiffMap.size > 0;
    setHasUnsaved((prev) => (prev === pending ? prev : pending));
  }, [mode, rowDiffMap]);

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
      const locked = payload?.result?.reviewLocked ?? 0;
      const skippedNote = skipped > 0 ? `, bỏ qua ${skipped} tờ khai đã có` : '';
      const lockedNote = locked > 0 ? `, khóa ${locked} tờ khai đã rà soát` : '';
      setSyncMessage(`Đã đồng bộ ${imported} tờ khai mới từ ECUS${skippedNote}${lockedNote}.`);
      setPreviewRows([]);
      setPreviewRangeInfo(null);
      setPreviewLimited(false);
      setPreviewError("");
      await fetchSyncConfig();
      await fetchSyncStatus();
      await fetchAlerts();
      await fetchCoDiscrepancy();
      try {
        await refreshDeclRowsFromServer();
      } catch (refreshError) {
        console.error("Không thể tải dữ liệu tờ khai sau đồng bộ", refreshError);
      }
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
    refreshDeclRowsFromServer,
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
    const inputElement = e.target;
    const resetInput = () => {
      if (fileRef.current) {
        fileRef.current.value = "";
      }
      if (inputElement) {
        inputElement.value = "";
      }
    };

    const file = inputElement.files?.[0];
    if (!file) return;

    const normalizedName = (file.name || "").toLowerCase();
    const extension = normalizedName.slice(normalizedName.lastIndexOf("."));
    if (extension && !ACCEPTED_IMPORT_EXTENSIONS.some(ext => normalizedName.endsWith(ext))) {
      toast.error("Chỉ hỗ trợ import file Excel định dạng .xlsx hoặc .xlsm.");
      resetInput();
      return;
    }

    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      const limitMb = (MAX_IMPORT_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(1).replace(/\.0$/, "");
      toast.error(
        `File vượt quá ${limitMb} MB. Vui lòng tách nhỏ hoặc xoá bớt sheet trước khi import.`
      );
      resetInput();
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      toast.error("Không thể đọc file Excel. Vui lòng thử lại hoặc kiểm tra định dạng file.");
      resetInput();
    };
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: "array" });
        const sheetName = workbook.SheetNames?.[0];
        if (!sheetName) {
          toast.error("File Excel không chứa sheet dữ liệu nào. Vui lòng kiểm tra lại.");
          resetInput();
          return;
        }
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: "" });
        if (!Array.isArray(rows) || rows.length === 0) {
          toast.error("File Excel không có dữ liệu tờ khai. Vui lòng kiểm tra lại nội dung.");
          resetInput();
          return;
        }
        if (rows.length > MAX_IMPORT_ROWS) {
          toast.error(
            `File chứa ${rows.length.toLocaleString("vi-VN")} dòng, vượt giới hạn ${MAX_IMPORT_ROWS.toLocaleString(
              "vi-VN"
            )} dòng cho mỗi lần import. Vui lòng tách file hoặc lọc lại dữ liệu.`
          );
          resetInput();
          return;
        }

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

        const normalizedRows = rows
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
          .map(ensureLicenseFields);

        const invalidDateCount = normalizedRows.filter(row => !row.date).length;
        if (invalidDateCount > 0) {
          toast.error(
            `Có ${invalidDateCount.toLocaleString(
              "vi-VN"
            )} dòng có ngày tờ khai không hợp lệ. Vui lòng kiểm tra lại định dạng ngày (dd/mm/yyyy).`
          );
          resetInput();
          return;
        }

        const sanitizedRows = normalizedRows.filter(row => row.so_tk && row.date);
        if (!sanitizedRows.length) {
          toast.error("Không tìm thấy tờ khai hợp lệ sau khi kiểm tra file Excel.");
          resetInput();
          return;
        }

        setRawRows(sortDeclRows(sanitizedRows));
        setPage(1);
        setPageSize(DEFAULT_PAGE_SIZE);
        setMode("preview");
        setSelectedFile(file.name || "");
        setQuery("");
        setFilterNoStaff(false);
        setFilterNoTeam(false);
        setCoFilterMode("all");
        setCoFilterMin(5);
        setSelectedKeys([]);
        setHasUnsaved(false);
      } catch (err) {
        console.error("Không thể xử lý file Excel import", err);
        toast.error("Không thể xử lý file Excel. Vui lòng kiểm tra định dạng và thử lại.");
      } finally {
        resetInput();
      }
    };
    reader.readAsArrayBuffer(file);
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

  const prepareRowForDiff = useCallback(
    (row) => {
      if (!row || typeof row !== "object") {
        return {};
      }
      const normalized = { ...row };
      if (!normalized.so_tk_full && normalized.so_tk) {
        normalized.so_tk_full = normalized.so_tk;
      }
      const licenseSnapshot = summarizeLicenseSnapshot(row);
      normalized.__license_source_count = licenseSnapshot.sourceCount;
      normalized.__license_included_count = licenseSnapshot.includedCount;
      normalized.__license_excluded_count = licenseSnapshot.excludedCount;
      normalized.__license_source_codes = licenseSnapshot.sourceCodes;
      normalized.__license_included_codes = licenseSnapshot.includedCodes;
      normalized.__license_excluded_codes = licenseSnapshot.excludedCodes;
      normalized.__co_status = coLabel(row);
      normalized.__co_lines = coLineCount(row);
      const timestampDetail = extractRowTimestampDetail(row);
      normalized.__timestamp_field = timestampDetail?.label && timestampDetail?.display
        ? `${timestampDetail.label}: ${timestampDetail.display}`
        : timestampDetail?.display || "";
      const agentSet = new Set();
      const pushAgent = (value) => {
        if (!value && value !== 0) return;
        const text = String(value).trim();
        if (text) {
          agentSet.add(text);
        }
      };
      if (Array.isArray(row.agents)) {
        row.agents.forEach(pushAgent);
      }
      pushAgent(row.agency);
      pushAgent(row.dai_ly);
      pushAgent(row.hq_agency);
      normalized.__agents_display = Array.from(agentSet);
      return normalized;
    },
    [summarizeLicenseSnapshot]
  );

  useEffect(() => {
    setDuplicateDiffState((prev) => {
      if (!prev.open) {
        return prev;
      }
      const group = duplicate11Details.find((entry) => entry.rawPrefix === prev.group);
      if (!group) {
        return { open: false, group: null, baseKey: null, compareKey: null };
      }
      const availableKeys = group.items.map((item) => item.key);
      const fallbackBase = availableKeys.includes(group.keeperKey)
        ? group.keeperKey
        : availableKeys[0] || null;
      const baseKey = availableKeys.includes(prev.baseKey) ? prev.baseKey : fallbackBase;
      let compareKey = availableKeys.includes(prev.compareKey) ? prev.compareKey : null;
      if (!compareKey || compareKey === baseKey) {
        compareKey = group.items.find((item) => item.key !== baseKey)?.key || null;
      }
      if (baseKey === prev.baseKey && compareKey === prev.compareKey) {
        return prev;
      }
      return { ...prev, baseKey, compareKey };
    });
  }, [duplicate11Details]);

  const duplicateDiffGroup = useMemo(() => {
    if (!duplicateDiffState.open || !duplicateDiffState.group) return null;
    return duplicate11Details.find((group) => group.rawPrefix === duplicateDiffState.group) || null;
  }, [duplicate11Details, duplicateDiffState.group, duplicateDiffState.open]);

  const duplicateDiffBaseItem = useMemo(() => {
    if (!duplicateDiffGroup) return null;
    const baseKey = duplicateDiffState.baseKey || duplicateDiffGroup.keeperKey || duplicateDiffGroup.items[0]?.key || null;
    if (!baseKey) return null;
    return duplicateDiffGroup.items.find((item) => item.key === baseKey) || null;
  }, [duplicateDiffGroup, duplicateDiffState.baseKey]);

  const duplicateDiffCompareItem = useMemo(() => {
    if (!duplicateDiffGroup) return null;
    const compareKey = duplicateDiffState.compareKey;
    if (!compareKey) {
      return duplicateDiffGroup.items.find((item) => item.key !== (duplicateDiffState.baseKey || duplicateDiffGroup.keeperKey));
    }
    return duplicateDiffGroup.items.find((item) => item.key === compareKey) || null;
  }, [duplicateDiffGroup, duplicateDiffState.baseKey, duplicateDiffState.compareKey]);

  const duplicateDiffGroups = useMemo(() => {
    if (!duplicateDiffGroup || !duplicateDiffBaseItem || !duplicateDiffCompareItem) return [];
    return createDuplicateDiffGroups(
      prepareRowForDiff(duplicateDiffBaseItem.row),
      prepareRowForDiff(duplicateDiffCompareItem.row)
    );
  }, [duplicateDiffGroup, duplicateDiffBaseItem, duplicateDiffCompareItem, prepareRowForDiff]);

  const duplicateDiffChangedCount = useMemo(() => {
    if (!Array.isArray(duplicateDiffGroups)) return 0;
    return duplicateDiffGroups.reduce((total, group) => {
      if (!group || !Array.isArray(group.rows)) return total;
      return total + group.rows.filter((row) => row.changed).length;
    }, 0);
  }, [duplicateDiffGroups]);

  const duplicateDiffGroupLabel = duplicateDiffGroup?.prefix || duplicateDiffGroup?.rawPrefix || "";
  const duplicateDiffBaseLabel = duplicateDiffBaseItem?.label || formatDeclarationLabel(duplicateDiffBaseItem?.row || {});
  const duplicateDiffCompareLabel = duplicateDiffCompareItem?.label || formatDeclarationLabel(duplicateDiffCompareItem?.row || {});

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

  const rowDiffMap = useMemo(() => {
    if (mode !== "saved") {
      return new Map();
    }
    const baseline = savedRowSnapshotRef.current || new Map();
    const diffMap = new Map();
    for (const row of rawRows) {
      const key = keyOfRow(row);
      if (!key) continue;
      const baselineRow = baseline.get(key);
      if (!baselineRow) continue;
      const diff = collectEditableDiff(baselineRow, row);
      if (diff) {
        diffMap.set(key, diff);
      }
    }
    return diffMap;
  }, [keyOfRow, mode, rawRows, baselineVersion]);

  const filteredSelected = useMemo(() => {
    if (!filteredKeys.length) return false;
    if (!selectedKeys.length) return false;
    const selectedSet = new Set(selectedKeys);
    return filteredKeys.every((key) => selectedSet.has(key));
}, [filteredKeys, selectedKeys]);

const selectedReviewedCount = useMemo(() => {
  if (!selectedKeys.length) return 0;
  const keySet = new Set(selectedKeys);
  let count = 0;
  for (const row of rawRows) {
    if (!row || typeof row !== "object") continue;
    if (!keySet.has(keyOfRow(row))) continue;
    if (row.reviewed) count += 1;
  }
  return count;
}, [selectedKeys, rawRows, keyOfRow]);

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
      const updates = sanitizeRowUpdates(current, updater(current));
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
    sanitizeRowUpdates,
  ]);

  const handleSelectStaff = useCallback(
    (rowKey, selection) => {
      if (!selection) return;
      const staffName = normalizeStr(selection.staffName);
      const providedTeam = selection.teamName;
      applyEdit(rowKey, (row) => {
        const updates = {};
        const currentStaff = normalizeStr(row.nhan_vien);
        if (staffName !== currentStaff) {
          updates.nhan_vien = staffName;
        }
        if (providedTeam !== undefined) {
          const nextTeam = normalizeStr(providedTeam);
          const currentTeam = normalizeStr(row.team);
          if (nextTeam !== currentTeam) {
            updates.team = nextTeam;
          }
        }
        return Object.keys(updates).length ? updates : null;
      });
    },
    [applyEdit]
  );

  const handleSelectTeam = useCallback(
    (rowKey, teamName) => {
      const safeTeam = normalizeStr(teamName);
      applyEdit(rowKey, (row) => {
        const currentTeam = normalizeStr(row.team);
        const nextTeam = safeTeam;
        if (nextTeam === currentTeam) {
          return null;
        }
        const updates = { team: nextTeam };
        const currentStaffInfo = row.nhan_vien ? memberTeamMap.get(normalizeName(row.nhan_vien)) : null;
        if (
          row.nhan_vien &&
          currentStaffInfo &&
          normalizeName(currentStaffInfo.team) !== normalizeName(nextTeam)
        ) {
          updates.nhan_vien = "";
        }
        return updates;
      });
    },
    [applyEdit, memberTeamMap]
  );

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
    const result = saveDeclRows(rows, {
      overwrite: effectiveOverwrite,
      actor,
      detail: `Import từ ${selectedFile || "file XLSX"}`,
    });
    const insertedLabel = result.inserted.toLocaleString("vi-VN");
    const updatedLabel = result.updated.toLocaleString("vi-VN");
    const skippedLabel = result.skipped.toLocaleString("vi-VN");
    const lockedLabel = result.locked.toLocaleString("vi-VN");
    const totalLabel = result.totalStored.toLocaleString("vi-VN");
    const skippedSummary =
      result.locked > 0
        ? `bỏ qua ${skippedLabel} (khóa ${lockedLabel})`
        : `bỏ qua ${skippedLabel}`;
    const message = `Import ${selectedFile || "file XLSX"}: +${insertedLabel} / cập nhật ${updatedLabel} / ${skippedSummary} → tổng ${totalLabel}`;
    pushImportLog({
      kind: "manual-import",
      actor,
      message,
      summary: {
        file: selectedFile || "",
        totalIncoming: result.totalIncoming,
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped,
        locked: result.locked,
        invalid: result.invalid,
        totalStored: result.totalStored,
        newBusinesses: result.newBusinessCount,
      },
      meta: {
        file: selectedFile || "",
        errors: Array.isArray(result.errors) ? result.errors : [],
        newBusinesses: Array.isArray(result.newBusinesses)
          ? result.newBusinesses.slice(0, 50)
          : [],
      },
      insertedDeclarations: result.insertedDeclarations,
      updatedDeclarations: result.updatedDeclarations,
      lockedDeclarations: result.lockedDeclarations,
    });
    alert(`Import xong: thêm ${insertedLabel}, cập nhật ${updatedLabel}, ${skippedSummary}.`);
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
    const result = saveDeclRows(rawRows, {
      overwrite: true,
      actor,
      detail: "Lưu chỉnh sửa tờ khai thủ công",
    });
    alert(`Đã lưu ${result.totalStored.toLocaleString("vi-VN")} bản ghi (ghi đè).`);
    setHasUnsaved(false);
    loadSavedRows({ bypassConfirm: true });
    fetchAlerts();
  }

  const handleSaveRowChanges = useCallback(
    (rowKey) => {
      if (isReadOnlyForEdits) {
        alert("Bạn không có quyền lưu chỉnh sửa.");
        return;
      }
      if (mode !== "saved") {
        alert("Chỉ có thể cập nhật khi đang xem dữ liệu đã lưu.");
        return;
      }
      const diff = rowDiffMap.get(rowKey);
      if (!diff || Object.keys(diff).length === 0) {
        toast.info("Không có thay đổi nào cần lưu cho tờ khai này.");
        return;
      }
      setRowSaveStatus((prev) => ({
        ...prev,
        [rowKey]: { saving: true, error: "" },
      }));
      try {
        const fieldList = Object.keys(diff);
        const result = updateDeclRowFields(rowKey, diff, {
          actor,
          detail: `Cập nhật thủ công (${fieldList.join(", ")}) qua Import Data`,
        });
        if (!result?.success) {
          const errorMessage =
            result?.reason === "not-found"
              ? "Tờ khai đã bị xóa hoặc thay đổi. Vui lòng tải lại dữ liệu."
              : result?.reason === "no-change"
              ? "Không có thay đổi mới để lưu."
              : "Không thể cập nhật tờ khai. Hãy thử lại.";
          setRowSaveStatus((prev) => ({
            ...prev,
            [rowKey]: { saving: false, error: errorMessage },
          }));
          toast.error(errorMessage);
          return;
        }
        const normalizedRow = ensureCOFields(ensureLicenseFields(result.row || {}));
        setRawRows((prev) => {
          if (!Array.isArray(prev) || prev.length === 0) return prev;
          const index = prev.findIndex((row) => keyOfRow(row) === rowKey);
          if (index === -1) return prev;
          const next = prev.slice();
          next[index] = { ...prev[index], ...normalizedRow };
          return next;
        });
        savedRowSnapshotRef.current.set(rowKey, { ...normalizedRow });
        setBaselineVersion((prev) => prev + 1);
        setRowSaveStatus((prev) => ({
          ...prev,
          [rowKey]: { saving: false, error: "" },
        }));
        refreshRowHistory(rowKey);
        toast.success("Đã lưu cập nhật cho tờ khai.");
      } catch (err) {
        console.error("Không thể cập nhật tờ khai", err);
        const fallbackMessage = "Có lỗi xảy ra khi cập nhật. Vui lòng thử lại.";
        setRowSaveStatus((prev) => ({
          ...prev,
          [rowKey]: { saving: false, error: fallbackMessage },
        }));
        toast.error(fallbackMessage);
      }
    },
    [actor, isReadOnlyForEdits, keyOfRow, mode, refreshRowHistory, rowDiffMap]
  );

  const selectionEnabled = mode === "saved" && (canEdit || canManageAlerts);
  const updateEnabled = canEdit && mode === "saved";
  const deleteEnabled = canEdit && mode === "saved";
  const historyEnabled = mode === "saved";
  const hiddenColumns = columnHiddenSet;
  const baseColumnCount = visibleColumnCount; // số cột dữ liệu đang hiển thị
  const totalColumns =
    baseColumnCount +
    (selectionEnabled ? 1 : 0) +
    (updateEnabled ? 1 : 0) +
    (deleteEnabled ? 1 : 0) +
    (historyEnabled ? 1 : 0);

  const columnDraftVisibleCount = Math.max(1, totalBaseColumns - columnDraftHidden.size);

  const canImport = !isReadOnlyForEdits && mode === "preview" && rawRows.length > 0;
  const canSave = !isReadOnlyForEdits && mode === "saved" && rawRows.length > 0;
  const canDelete = deleteEnabled && selectedKeys.length > 0;
  const canReview = selectionEnabled && selectedKeys.length > 0 && canReviewAlerts;
  const canUnreview = selectionEnabled && selectedReviewedCount > 0 && canReviewAlerts;
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

  const handleOpenDuplicateDiff = useCallback((groupPrefix, baseKey, compareKey) => {
    setDuplicateDiffState({
      open: true,
      group: groupPrefix,
      baseKey: baseKey || null,
      compareKey: compareKey || null,
    });
  }, []);

  const handleCloseDuplicateDiff = useCallback(() => {
    setDuplicateDiffState({ open: false, group: null, baseKey: null, compareKey: null });
  }, []);

  const handleChangeDuplicateDiffBase = useCallback((nextKey) => {
    setDuplicateDiffState((prev) => {
      if (!prev.open) return prev;
      const baseKey = nextKey || null;
      let compareKey = prev.compareKey;
      if (compareKey && compareKey === baseKey) {
        compareKey = null;
      }
      return { ...prev, baseKey, compareKey };
    });
  }, []);

  const handleChangeDuplicateDiffCompare = useCallback((nextKey) => {
    setDuplicateDiffState((prev) => {
      if (!prev.open) return prev;
      return { ...prev, compareKey: nextKey || null };
    });
  }, []);

  const handleSwapDuplicateDiff = useCallback(() => {
    setDuplicateDiffState((prev) => {
      if (!prev.open) return prev;
      if (!prev.baseKey || !prev.compareKey) {
        return prev;
      }
      return { ...prev, baseKey: prev.compareKey, compareKey: prev.baseKey };
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

      const summary = {
        processedKeys: new Set(),
        totalSourceCodes: 0,
        totalExcludedCodes: 0,
        totalKeptCodes: 0,
        details: [],
        globalCodes: new Set(),
        agencyCodes: new Map(),
        skippedNoSource: 0,
      };

      let changed = 0;
      let matchedCount = 0;
      const nextRows = rawRows.map((row) => {
        const rowKey = keyOfRow(row);
        if (!keySet.has(rowKey)) {
          return row;
        }

        const excludeSet = getLicenseExcludeSetForRow(row);
        const normalizedSource = new Set();
        const addCodes = (list) => {
          if (!Array.isArray(list)) return;
          for (const code of list) {
            const normalized = normalizeLicenseCode(code);
            if (normalized) {
              normalizedSource.add(normalized);
            }
          }
        };

        addCodes(row.licenseSourceCodes);
        addCodes(row.licenseCodes);
        addCodes(row.licenseExcludedCodes);
        const extractedCodes = extractLicenseCodesFromRowObj(row) || [];
        for (const code of extractedCodes) {
          const normalized = normalizeLicenseCode(code);
          if (normalized) {
            normalizedSource.add(normalized);
          }
        }

        let fallbackSnapshot = null;
        if (normalizedSource.size === 0) {
          fallbackSnapshot = computeLicenseSnapshot(row, rules);
          const fallbackLists = [
            fallbackSnapshot?.sourceCodes,
            fallbackSnapshot?.includedCodes,
            fallbackSnapshot?.excludedCodes,
          ];
          for (const list of fallbackLists) {
            if (!Array.isArray(list)) continue;
            for (const code of list) {
              const normalized = normalizeLicenseCode(code);
              if (normalized) {
                normalizedSource.add(normalized);
              }
            }
          }
        }

        if (normalizedSource.size === 0) {
          summary.skippedNoSource += 1;
          summary.details.push({
            key: rowKey,
            soTk: row.so_tk,
            source: [],
            kept: [],
            excluded: [],
            reason: "no_source_codes",
            manualCount:
              fallbackSnapshot && Number.isFinite(fallbackSnapshot.manualCount)
                ? fallbackSnapshot.manualCount
                : undefined,
          });
          return row;
        }

        const sourceList = Array.from(normalizedSource).sort((a, b) => a.localeCompare(b));
        const effectiveCodes = sourceList.filter((code) => !excludeSet.has(code));
        const excludedCodes = sourceList.filter((code) => excludeSet.has(code));
        const currentCodes = Array.isArray(row.licenseCodes)
          ? row.licenseCodes.map(normalizeLicenseCode).filter(Boolean).sort((a, b) => a.localeCompare(b))
          : sourceList;
        const currentExcludedCodes = Array.isArray(row.licenseExcludedCodes)
          ? row.licenseExcludedCodes.map(normalizeLicenseCode).filter(Boolean).sort((a, b) => a.localeCompare(b))
          : [];
        const nextLicenseCount = effectiveCodes.length;
        const currentLicenseCount = Number(row.licenses ?? row.so_luong_gp ?? currentCodes.length ?? 0);

        matchedCount += 1;
        summary.processedKeys.add(rowKey);
        summary.totalSourceCodes += sourceList.length;
        summary.totalExcludedCodes += excludedCodes.length;
        summary.totalKeptCodes += effectiveCodes.length;

        if (sourceList.length > 0) {
          const agencyKeys = extractAgencyKeys(row);
          const excludedReasons = excludedCodes.map((code) => {
            const reasons = [];
            if (licenseExcludeSet.has(code)) {
              reasons.push({ type: "global" });
              summary.globalCodes.add(code);
            }
            for (const key of agencyKeys) {
              const agencySet = licenseAgencyExcludeMap.get(normalizeAgencyKey(key));
              if (agencySet?.has(code)) {
                reasons.push({ type: "agency", key: normalizeAgencyKey(key) });
                const list = summary.agencyCodes.get(normalizeAgencyKey(key)) || new Set();
                list.add(code);
                summary.agencyCodes.set(normalizeAgencyKey(key), list);
              }
            }
            if (!reasons.length) {
              reasons.push({ type: "other" });
            }
            return { code, reasons };
          });
          summary.details.push({
            key: rowKey,
            soTk: row.so_tk,
            source: sourceList,
            kept: effectiveCodes,
            excluded: excludedCodes,
            excludedReasons,
          });
        }

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
          licenseSourceCodes: sourceList,
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

      return {
        ok: true,
        changed,
        matchedCount,
        blocked: blockedCount,
        summary: {
          totalRows: summary.processedKeys.size,
          totalSourceCodes: summary.totalSourceCodes,
          totalExcludedCodes: summary.totalExcludedCodes,
          totalKeptCodes: summary.totalKeptCodes,
          details: summary.details,
          globalCodes: Array.from(summary.globalCodes),
          agencyCodes: Array.from(summary.agencyCodes.entries()).map(([agency, codes]) => ({
            agency,
            codes: Array.from(codes),
          })),
          skippedNoSource: summary.skippedNoSource,
        },
      };
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

const formatLicenseExclusionAlert = useCallback(
  (result) => {
    if (!result?.summary) {
      return `Đã cập nhật ${result?.changed ?? 0}/${result?.matchedCount ?? 0} tờ khai.`;
    }
    const {
      totalSourceCodes,
      totalExcludedCodes,
      totalKeptCodes,
      globalCodes = [],
      agencyCodes = [],
      skippedNoSource = 0,
    } = result.summary;
    const lines = [
      `Đã cập nhật ${result.changed}/${result.matchedCount} tờ khai.`,
      `Tổng mã gốc: ${totalSourceCodes}, giữ lại: ${totalKeptCodes}, loại trừ: ${totalExcludedCodes}.`,
    ];
    if (globalCodes.length) {
      lines.push(`Mã bị loại theo quy tắc toàn cục: ${Array.from(new Set(globalCodes)).join(", ")}`);
    }
    if (agencyCodes.length) {
      const agencyDetails = agencyCodes
        .map(({ agency, codes }) => `${agency}: ${codes.join(", ")}`)
        .join("; ");
      lines.push(`Mã bị loại theo đại lý: ${agencyDetails}`);
    }
    if (skippedNoSource > 0) {
      lines.push(`Bỏ qua ${skippedNoSource} tờ khai không có mã giấy phép nguồn để đối chiếu.`);
    }
    if (totalExcludedCodes === totalSourceCodes && totalSourceCodes > 0) {
      lines.push(
        "Lưu ý: các mã của tờ khai này đều nằm trong danh sách loại trừ KPI nên kết quả sau đối chiếu còn 0."
      );
    }
    return lines.join("\n");
  },
  []
);

const handleApplyLicenseExclusion = useCallback(() => {
  if (selectedKeys.length === 0) {
    alert("Hay chon it nhat mot to khai de doi chieu giay phep.");
    return;
  }
  const allowedKeys = ensureEditableKeys(selectedKeys, "doi chieu giay phep");
  if (!allowedKeys) {
    return;
  }
  const result = applyLicenseExclusionForKeys(allowedKeys, { alreadyFiltered: true });
  if (!result?.ok) {
    if (result?.reason === "mode") {
      alert("Chi co the dieu chinh giay phep khi dang xem du lieu da luu.");
      return;
    }
    if (result?.reason === "unchanged") {
      alert("Cac to khai duoc chon da khong con ma giay phep nam trong danh sach loai tru.");
      return;
    }
    if (result?.reason === "missing" || result?.reason === "empty") {
      alert("Khong tim thay to khai phu hop de doi chieu.");
      return;
    }
    alert("Khong the doi chieu giay phep cho lua chon hien tai.");
    return;
  }
  alert(formatLicenseExclusionAlert(result));
}, [applyLicenseExclusionForKeys, ensureEditableKeys, formatLicenseExclusionAlert, selectedKeys]);

const handleUnmarkReviewed = useCallback(async () => {
  if (!canReviewAlerts) {
    alert("Bạn không có quyền bỏ đánh dấu rà soát các tờ khai.");
    return;
  }
  if (mode !== "saved") {
    alert("Chỉ bỏ đánh dấu rà soát khi đang xem dữ liệu đã lưu.");
    return;
  }
  if (selectedKeys.length === 0) {
    alert("Chưa chọn tờ khai để bỏ đánh dấu.");
    return;
  }
  const allowedKeys = ensureEditableKeys(selectedKeys, "bỏ đánh dấu rà soát");
  if (!allowedKeys) {
    return;
  }
  const keySet = new Set(allowedKeys);
  const reviewedKeys = rawRows
    .filter((row) => row && keySet.has(keyOfRow(row)) && row.reviewed)
    .map((row) => keyOfRow(row));
  if (reviewedKeys.length === 0) {
    alert("Các tờ khai đã chọn chưa được đánh dấu rà soát.");
    return;
  }
  const updated = unmarkDeclRowsReviewed(reviewedKeys, { actor });
  if (updated === 0) {
    alert("Không tìm thấy tờ khai nào để bỏ đánh dấu.");
  }
  try {
    await fetchWithAuth("/api/import/alerts/unreview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys: reviewedKeys, actor }),
      credentials: "include",
    });
  } catch (err) {
    console.warn("Không thể đồng bộ trạng thái bỏ rà soát với máy chủ", err);
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
  keyOfRow,
  loadSavedRows,
  mode,
  rawRows,
  selectedKeys,
]);

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
      <Dialog open={columnConfigOpen} onOpenChange={setColumnConfigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cấu hình cột Import Data</DialogTitle>
            <DialogDescription>
              Chọn các cột dữ liệu cần hiển thị. Thiết lập áp dụng cho toàn bộ hệ thống.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-gray-600">
              Đang giữ {columnDraftVisibleCount}/{totalBaseColumns} cột hiển thị.
            </p>
            <div className="grid gap-2">
              {IMPORT_TABLE_COLUMNS.map((column) => {
                const checked = !columnDraftHidden.has(column.id);
                return (
                  <label
                    key={column.id}
                    className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                  >
                    <span>{column.label}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleColumnDraft(column.id)}
                    />
                  </label>
                );
              })}
            </div>
            {columnDraftError ? (
              <p className="text-xs text-red-600">{columnDraftError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setColumnConfigOpen(false)}
              className="rounded border px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleApplyColumnConfig}
              className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
            >
              Lưu cấu hình
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={duplicateDiffState.open}
        onOpenChange={(next) => {
          if (next) {
            if (!duplicateDiffState.group && duplicate11Details?.[0]?.rawPrefix) {
              handleOpenDuplicateDiff(
                duplicate11Details[0].rawPrefix,
                duplicate11Details[0].keeperKey || duplicate11Details[0].items?.[0]?.key || null,
                duplicate11Details[0].items?.find((item) => item.key !== (duplicate11Details[0].keeperKey || duplicate11Details[0].items?.[0]?.key))?.key || null,
              );
              return;
            }
            setDuplicateDiffState((prev) => ({ ...prev, open: true }));
            return;
          }
          handleCloseDuplicateDiff();
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>So sánh bản ghi trùng</DialogTitle>
            <DialogDescription>
              So sánh sự khác biệt giữa <strong>{duplicateDiffBaseLabel || "bản giữ"}</strong> và {" "}
              <strong>{duplicateDiffCompareLabel || "bản so sánh"}</strong>
              {duplicateDiffGroupLabel ? ` trong nhóm ${duplicateDiffGroupLabel}` : ""}.
            </DialogDescription>
          </DialogHeader>
          {duplicateDiffGroup ? (
            <div className="space-y-3 text-sm">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end text-xs">
                <label className="flex flex-col gap-1">
                  <span className="font-medium text-gray-600 dark:text-gray-300">Bản tham chiếu</span>
                  <select
                    className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-2 py-1 text-sm"
                    value={duplicateDiffBaseItem?.key || ""}
                    onChange={(e) => handleChangeDuplicateDiffBase(e.target.value)}
                  >
                    {duplicateDiffGroup.items.map((item) => (
                      <option key={`diff-base-${item.key}`} value={item.key}>
                        {item.label} — {item.sourceLabel}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-medium text-gray-600 dark:text-gray-300">Bản so sánh</span>
                  <select
                    className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-2 py-1 text-sm"
                    value={duplicateDiffCompareItem?.key || ""}
                    onChange={(e) => handleChangeDuplicateDiffCompare(e.target.value)}
                  >
                    {duplicateDiffGroup.items
                      .filter((item) => item.key !== duplicateDiffBaseItem?.key)
                      .map((item) => (
                        <option key={`diff-compare-${item.key}`} value={item.key}>
                          {item.label} — {item.sourceLabel}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={handleSwapDuplicateDiff}
                  disabled={!duplicateDiffBaseItem || !duplicateDiffCompareItem}
                  className="h-9 self-end rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 text-xs font-medium text-[color:var(--ds-text-secondary)] transition hover:bg-[color:var(--ds-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Đổi vị trí
                </button>
              </div>
              <div className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--ds-border-subtle)] px-3 py-2 text-xs text-[color:var(--ds-text-secondary)]">
                  <span>
                    Nhóm: <strong className="text-[color:var(--ds-text-primary)]">{duplicateDiffGroupLabel}</strong> • Tổng {duplicateDiffGroup?.total?.toLocaleString?.("vi-VN") || duplicateDiffGroup?.items?.length || 0} bản ghi
                  </span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-300">
                    {duplicateDiffChangedCount.toLocaleString("vi-VN") || 0} trường khác nhau
                  </span>
                </div>
                <ScrollArea className="max-h-[60vh] pr-2">
                  <div className="space-y-4 px-3 py-3">
                    {duplicateDiffGroups.length > 0 ? (
                      duplicateDiffGroups.map((group) => (
                        <div key={`diff-group-${group.title}`} className="space-y-1">
                          <h4 className="text-xs uppercase tracking-wide text-[color:var(--ds-text-muted)]">{group.title}</h4>
                          <table className="min-w-full overflow-hidden rounded border border-[color:var(--ds-border-subtle)] text-xs">
                            <thead className="bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-secondary)]">
                              <tr>
                                <th className="px-2 py-1 text-left">Trường</th>
                                <th className="px-2 py-1 text-left">Bản giữ</th>
                                <th className="px-2 py-1 text-left">Bản so sánh</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.rows.map((row) => (
                                <tr
                                  key={`diff-row-${group.title}-${row.key}`}
                                  className={`border-b border-[color:var(--ds-border-subtle)] last:border-b-0 ${
                                    row.changed
                                      ? "bg-amber-50 dark:bg-amber-500/10"
                                      : "bg-[color:var(--ds-surface-card)]"
                                  }`}
                                >
                                  <td className="whitespace-nowrap px-2 py-1 font-medium text-[color:var(--ds-text-secondary)]">
                                    {row.label}
                                  </td>
                                  <td className="max-w-[240px] whitespace-pre-wrap px-2 py-1 text-[color:var(--ds-text-primary)]">
                                    {row.baseValue || <span className="text-[color:var(--ds-text-muted)]">(trống)</span>}
                                  </td>
                                  <td className="max-w-[240px] whitespace-pre-wrap px-2 py-1 text-[color:var(--ds-text-primary)]">
                                    {row.compareValue || <span className="text-[color:var(--ds-text-muted)]">(trống)</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))
                    ) : (
                      <p className="py-6 text-center text-xs text-[color:var(--ds-text-muted)]">
                        Không có dữ liệu khác biệt giữa hai bản ghi.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[color:var(--ds-text-muted)]">Không tìm thấy nhóm trùng để so sánh.</p>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={handleCloseDuplicateDiff}
              className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-1 text-sm text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)]"
            >
              Đóng
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
                                <th className="px-2 py-1 text-left">So sánh</th>
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
                                const fallbackBaseKey = keeperKey || group.items[0]?.key || null;
                                const baseForDiff = fallbackBaseKey || item.key;
                                let compareForDiff = item.key;
                                if (compareForDiff === baseForDiff) {
                                  compareForDiff = group.items.find((candidate) => candidate.key !== baseForDiff)?.key || null;
                                }
                                const canOpenDiff = Boolean(compareForDiff);
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
                                    <td className="px-2 py-1">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenDuplicateDiff(group.rawPrefix, baseForDiff, compareForDiff)}
                                        disabled={!canOpenDiff}
                                        className="rounded border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-blue-100 disabled:text-blue-300 disabled:opacity-60 dark:border-blue-500/50 dark:text-blue-200 dark:hover:bg-blue-500/10"
                                      >
                                        So sánh
                                      </button>
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
          {canOverwriteData && (
            <label className="flex items-center gap-1 text-amber-700">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => handleOverwriteToggle(e.target.checked)}
              />
              <span>Ghi đè toàn bộ dữ liệu hiện có</span>
            </label>
          )}
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
        <div className="flex flex-wrap items-center gap-2 border-l border-gray-200 pl-3 dark:border-slate-700">
          <label className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Bộ lọc đã lưu
            </span>
            <select
              value={selectedPresetId}
              onChange={(event) => {
                clearPresetError();
                setSelectedPresetId(event.target.value);
              }}
              className="min-w-[180px] rounded border border-gray-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
            >
              <option value="">Chọn bộ lọc</option>
              {savedPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleApplySelectedPreset}
            disabled={!selectedPresetId || presetBusy}
            className="rounded border px-3 py-1 text-xs text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"
          >
            Áp dụng
          </button>
          <button
            type="button"
            onClick={handleSavePresetAsNew}
            disabled={presetBusy}
            className="rounded border px-3 py-1 text-xs text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"
          >
            {presetSaving ? "Đang lưu…" : "Lưu preset mới"}
          </button>
          {selectedPresetId && (
            <>
              <button
                type="button"
                onClick={handleOverwriteSelectedPreset}
                disabled={presetBusy}
                className="rounded border px-3 py-1 text-xs text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"
              >
                Ghi đè preset
              </button>
              <button
                type="button"
                onClick={handleDeleteSelectedPreset}
                disabled={presetBusy}
                className="rounded border px-3 py-1 text-xs text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/60 dark:text-red-300 dark:hover:bg-red-500/10"
              >
                Xoá preset
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleRefreshPresetList}
            disabled={presetBusy}
            className="rounded border px-3 py-1 text-xs text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"
          >
            {presetLoading ? "Đồng bộ…" : "Đồng bộ"}
          </button>
        </div>
        {presetError && (
          <div className="text-xs text-red-600 dark:text-red-400">
            {presetError}
            <button
              type="button"
              onClick={clearPresetError}
              className="ml-2 underline"
            >
              Đóng
            </button>
          </div>
        )}
        {appliedPreset && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Đang áp dụng: <span className="font-medium text-gray-700 dark:text-gray-200">{appliedPreset.name}</span>
            {appliedPresetUpdatedAt ? ` • Cập nhật ${appliedPresetUpdatedAt}` : ""}
          </div>
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

      {isAdminRole && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
          <span>
            Đang hiển thị {visibleColumnCount}/{totalBaseColumns} cột dữ liệu.
          </span>
          <button
            type="button"
            onClick={handleOpenColumnConfig}
            className="rounded border px-3 py-1 text-xs text-gray-600 transition hover:bg-gray-50"
          >
            Cấu hình cột hiển thị
          </button>
        </div>
      )}

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
          <button
            type="button"
            onClick={handleUnmarkReviewed}
            disabled={!canUnreview}
            className={`px-3 py-1 rounded border ${
              canUnreview ? "bg-orange-50 text-orange-700 border-orange-300" : "opacity-50 cursor-not-allowed"
            }`}
          >
            Bỏ đánh dấu đã rà soát
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
              {!hiddenColumns.has("date") && (
                <th className="px-2 py-1 text-left">{IMPORT_TABLE_COLUMN_LABELS.date}</th>
              )}
              {!hiddenColumns.has("declaration") && (
                <th className="px-2 py-1 text-left">{IMPORT_TABLE_COLUMN_LABELS.declaration}</th>
              )}
              {!hiddenColumns.has("mst") && (
                <th className="px-2 py-1 text-left">{IMPORT_TABLE_COLUMN_LABELS.mst}</th>
              )}
              {!hiddenColumns.has("company") && (
                <th className="px-2 py-1 text-left">{IMPORT_TABLE_COLUMN_LABELS.company}</th>
              )}
              {!hiddenColumns.has("type") && (
                <th className="px-2 py-1 text-left">{IMPORT_TABLE_COLUMN_LABELS.type}</th>
              )}
              {!hiddenColumns.has("co") && (
                <th className="px-2 py-1 text-left">{IMPORT_TABLE_COLUMN_LABELS.co}</th>
              )}
              {!hiddenColumns.has("items") && (
                <th className="px-2 py-1 text-left">{IMPORT_TABLE_COLUMN_LABELS.items}</th>
              )}
              {!hiddenColumns.has("staff") && (
                <th className="px-2 py-1 text-left">{IMPORT_TABLE_COLUMN_LABELS.staff}</th>
              )}
              {!hiddenColumns.has("team") && (
                <th className="px-2 py-1 text-left">{IMPORT_TABLE_COLUMN_LABELS.team}</th>
              )}
              {!hiddenColumns.has("agency") && (
                <th className="px-2 py-1 text-left">{IMPORT_TABLE_COLUMN_LABELS.agency}</th>
              )}
              {!hiddenColumns.has("status") && (
                <th className="px-2 py-1 text-left">{IMPORT_TABLE_COLUMN_LABELS.status}</th>
              )}
              {!hiddenColumns.has("licenses") && (
                <th className="px-2 py-1 text-left">{IMPORT_TABLE_COLUMN_LABELS.licenses}</th>
              )}
              {!hiddenColumns.has("kpi") && (
                <th className="px-2 py-1 text-left">{IMPORT_TABLE_COLUMN_LABELS.kpi}</th>
              )}
              {historyEnabled && <th className="px-2 py-1 text-left w-32">Nhật ký</th>}
              {updateEnabled && <th className="px-2 py-1 text-left w-24">Cập nhật</th>}
              {deleteEnabled && <th className="px-2 py-1 text-left w-16">Xóa</th>}
            </tr>
          </thead>
          <tbody>
          {pageRows.map((r, i) => {
            const rowKey = keyOfRow(r);
            const rowEditable = isRowEditable(r);
            const rowReadOnly = isReadOnlyForEdits || !rowEditable;
          const rowDiff = rowDiffMap.get(rowKey);
          const hasPendingDiff = !!(rowDiff && Object.keys(rowDiff).length > 0);
          const canSaveRow = hasPendingDiff && !rowReadOnly;
          const currentSaveState = rowSaveStatus[rowKey] || { saving: false, error: "" };
          const { saving: rowSaving, error: rowError } = currentSaveState;
          const historyList = rowHistoryEntries[rowKey] || [];
          const historyExpanded = !!rowHistoryExpanded[rowKey];
          const historyCount = Array.isArray(historyList) ? historyList.length : 0;
          return (
            <React.Fragment key={`${rowKey}_${i}`}>
              <tr
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
                {!hiddenColumns.has("date") && (
                  <td className="px-2 py-1">
                    <span title={r.raw_date || ""}>{formatDisplayDate(r.date || r.raw_date || "")}</span>
                  </td>
                )}
                {!hiddenColumns.has("declaration") && (
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
                )}
                {!hiddenColumns.has("mst") && (
                  <td className="px-2 py-1">
                    <span>{r.mst || ""}</span>
                  </td>
                )}
                {!hiddenColumns.has("company") && (
                  <td className="px-2 py-1">
                    <span>{r.cong_ty || ""}</span>
                  </td>
                )}
                {!hiddenColumns.has("type") && (
                  <td className="px-2 py-1">
                    <span>{r.loai_hinh || ""}</span>
                  </td>
                )}
                {!hiddenColumns.has("co") && (
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
                )}
                {!hiddenColumns.has("items") && (
                  <td className="px-2 py-1">
                    <span>{r.muc_hang ?? ""}</span>
                  </td>
                )}
                {!hiddenColumns.has("staff") && (
                  <td className="px-2 py-1">
                    {rowReadOnly ? (
                      <span>{r.nhan_vien || ""}</span>
                    ) : (
                      <StaffCombobox
                        value={r.nhan_vien || ""}
                        teamValue={r.team || ""}
                        teams={rosterTeams}
                        onSelect={(selection) => handleSelectStaff(rowKey, selection)}
                      />
                    )}
                  </td>
                )}
                {!hiddenColumns.has("team") && (
                  <td className="px-2 py-1">
                    {rowReadOnly ? (
                      <span>{r.team || ""}</span>
                    ) : (
                      <TeamCombobox
                        value={r.team || ""}
                        teams={rosterTeams}
                        onSelect={({ teamName }) => handleSelectTeam(rowKey, teamName)}
                      />
                    )}
                  </td>
                )}
                {!hiddenColumns.has("agency") && (
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
                )}
                {!hiddenColumns.has("status") && (
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
                )}
                {!hiddenColumns.has("licenses") && (
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
                )}
                {!hiddenColumns.has("kpi") && (
                  <td className="px-2 py-1">
                    {(() => {
                      const kpi = computeKPI(r, rules);
                      if (!Number.isFinite(kpi)) return "-";
                      return kpi.toFixed(1);
                    })()}
                  </td>
                )}
                {historyEnabled && (
                  <td className="px-2 py-1">
                    <button
                      type="button"
                      onClick={() => handleToggleHistory(rowKey)}
                      className={`rounded px-2 py-0.5 text-xs border ${
                        historyExpanded
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-300 bg-white text-gray-700 hover:border-blue-400 hover:text-blue-700"
                      }`}
                    >
                      {historyExpanded ? "Thu gọn" : "Nhật ký"}
                      {historyCount > 0 ? ` (${historyCount})` : ""}
                    </button>
                  </td>
                )}
                {updateEnabled && (
                  <td className="px-2 py-1">
                    {rowReadOnly ? (
                      <span className="text-[11px] text-gray-400">Chỉ xem</span>
                    ) : canSaveRow ? (
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => handleSaveRowChanges(rowKey)}
                          disabled={rowSaving}
                          className={`rounded px-2 py-0.5 text-xs font-medium text-white ${
                            rowSaving
                              ? "cursor-not-allowed bg-blue-300"
                              : "bg-blue-600 hover:bg-blue-700"
                          }`}
                        >
                          {rowSaving ? "Đang lưu…" : "Cập nhật"}
                        </button>
                        {rowError ? (
                          <span className="text-[11px] text-red-600">{rowError}</span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-400">Đã đồng bộ</span>
                    )}
                  </td>
                )}
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
              {historyEnabled && historyExpanded && (
                <tr className="bg-blue-50/40">
                  {selectionEnabled && <td className="px-2 py-1" />}
                  <td
                    className="px-4 py-3 text-xs text-gray-700"
                    colSpan={totalColumns - (selectionEnabled ? 1 : 0)}
                  >
                    <div className="flex flex-col gap-3">
                      {historyList.length > 0 ? (
                        historyList.map((entry) => {
                          const timestampLabel = formatHistoryTimestamp(entry.ts);
                          const actorLabel = entry.actor || "system";
                          return (
                            <div
                              key={entry.id}
                              className="rounded border border-blue-100 bg-white p-2 shadow-sm"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
                                <span className="font-medium text-gray-700">{timestampLabel}</span>
                                <span className="text-gray-500">{`Bởi: ${actorLabel}`}</span>
                              </div>
                              <ul className="mt-2 space-y-1">
                                {entry.changes.map((change, idx) => {
                                  const label = DECL_HISTORY_FIELD_LABELS[change.field] || humanizeDiffKey(change.field);
                                  const beforeEmpty = change.before === "" || change.before === null || change.before === undefined;
                                  const afterEmpty = change.after === "" || change.after === null || change.after === undefined;
                                  const beforeLabel = beforeEmpty ? "Trống" : change.before;
                                  const afterLabel = afterEmpty ? "Trống" : change.after;
                                  const beforeClass = beforeEmpty
                                    ? "text-gray-400 italic"
                                    : "text-red-600 line-through decoration-red-400";
                                  const afterClass = afterEmpty
                                    ? "text-gray-500 italic"
                                    : "text-emerald-700 font-medium";
                                  return (
                                    <li key={`${entry.id}-${idx}`} className="flex flex-wrap items-start gap-2">
                                      <span className="min-w-[8rem] shrink-0 text-gray-500">{label}</span>
                                      <span className="flex flex-wrap items-center gap-1">
                                        <span className={beforeClass}>{beforeLabel}</span>
                                        <span className="text-gray-400">→</span>
                                        <span className={afterClass}>{afterLabel}</span>
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded border border-dashed border-gray-200 bg-white p-4 text-center text-gray-500">
                          Chưa có nhật ký chỉnh sửa cho tờ khai này.
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
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







