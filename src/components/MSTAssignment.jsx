import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import clsx from "clsx";

import * as XLSX from "xlsx";

import {

  getMSTHistoryEntries,

  getMSTMap,

  upsertMSTRows,

  saveMSTRow,

  MST_ASSIGNMENT_STATUS,

  getTeamRoster,

  subscribeTeamRoster,

  normalizeStr,

  normalizeName,

} from "@/lib/store.js";

import useTooltipTitles from "@/hooks/useTooltipTitles.js";

import usePagination from "@/hooks/usePagination.js";

import useMSTQuickFilters from "@/hooks/useMSTQuickFilters.js";

import { Button } from "@/components/ui/button.jsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.jsx";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.jsx";

import {

  Command,

  CommandEmpty,

  CommandGroup,

  CommandInput,

  CommandItem,

  CommandList,

} from "@/components/ui/command.jsx";

import { Check, ChevronsUpDown, CircleX, Plus, LogIn, LogOut } from "lucide-react";



/** Utils */

const normalize = (s = "") =>

  s

    .toString()

    .normalize("NFD")

    .replace(/[\u0300-\u036f]/g, "")

    .replace(/\s+/g, " ")

    .trim()

    .toLowerCase();

export const COMPANY_NAME_WRAP_THRESHOLD = 25;

export const shouldWrapCompanyName = (value = "") => {
  if (value == null) {
    return false;
  }

  const raw = value.toString();
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }

  return Array.from(trimmed).length >= COMPANY_NAME_WRAP_THRESHOLD;
};



export const sanitizeCompanyNameInput = (value = "") => {
  if (value == null) {
    return "";
  }

  if (typeof value !== "string") {
    return value.toString();
  }

  return value.replace(/\r?\n|\r/g, " ");
};




const formatISODate = (value) => {

  if (!value) return "";

  try {

    const d = new Date(value);

    if (Number.isNaN(d.getTime())) {

      return value;

    }

    return d.toLocaleDateString("vi-VN");

  } catch (err) {

    console.warn("formatISODate", err);

    return value;

  }

};



const buildRosterTeams = (rosterSnapshot) => {

  const rawTeams = Array.isArray(rosterSnapshot?.teams) ? rosterSnapshot.teams : [];

  const teams = [];



  rawTeams.forEach((team, teamIndex) => {

    const name = normalizeStr(team?.name ?? "");

    const normalized = normalizeName(name);

    if (!name || !normalized) return;



    const members = Array.isArray(team?.members) ? team.members : [];

    const normalizedMembers = members

      .map((member, memberIndex) => {

        const memberName = normalizeStr(member?.name ?? "");

        const memberNormalized = normalizeName(memberName);

        if (!memberName || !memberNormalized) return null;

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

};



function StaffCombobox({

  value,

  teamValue,

  onSelect,

  teams,

  disabled = false,

  placeholder = "Chọn nhân viên",

}) {

  const [open, setOpen] = useState(false);

  const [search, setSearch] = useState("");



  useEffect(() => {

    if (!open) {

      setSearch("");

    }

  }, [open]);



  const normalizedValue = normalizeStr(value || "");

  const normalizedKey = normalizeName(normalizedValue);

  const normalizedTeamValue = normalizeName(normalizeStr(teamValue || ""));



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



  const orderedTeams = useMemo(() => {

    if (!teams.length) return [];

    if (!normalizedTeamValue) return teams;



    const next = [...teams];

    const index = next.findIndex((team) => team.normalized === normalizedTeamValue);

    if (index <= 0) {

      return next;

    }



    const [currentTeam] = next.splice(index, 1);

    return [currentTeam, ...next];

  }, [teams, normalizedTeamValue]);



  const searchValue = normalizeStr(search);

  const searchKey = normalizeName(searchValue);

  const hasExactStaff = staffIndex.some((entry) => entry.normalized === searchKey);

  const canCreateCustom = Boolean(searchKey) && !hasExactStaff;



  const handleSelect = (staffName = "", teamName = "", extra = {}) => {

    onSelect?.({

      staffName,

      teamName,

      isCustom: Boolean(extra.isCustom),

    });

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

          className="w-full justify-between px-2 py-1 text-left font-normal"

        >

          <span className="truncate">{normalizedValue || placeholder}</span>

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

                <CommandItem value="__clear__" onSelect={() => handleSelect("", teamValue || "")}>

                  <CircleX className="mr-2 size-4" />

                  Bỏ chọn nhân viên

                </CommandItem>

              </CommandGroup>

            ) : null}

            {canCreateCustom ? (

              <CommandGroup heading="Thêm mới">

                <CommandItem

                  value={searchValue}

                  onSelect={() =>

                    handleSelect(searchValue, normalizedTeamValue ? teamValue : "", {

                      isCustom: true,

                    })

                  }

                >

                  <Plus className="mr-2 size-4" />

                  Dùng giá trị "{searchValue}"

                </CommandItem>

              </CommandGroup>

            ) : null}

            {orderedTeams.map((team) => (

              <CommandGroup key={team.id} heading={`Tổ: ${team.name}`}>

                {team.members.map((member) => {

                  const isSelected =

                    member.normalized === normalizedKey && team.normalized === normalizedTeamValue;

                  return (

                    <CommandItem

                      key={member.id}

                      value={`${member.name}`}

                      onSelect={() => handleSelect(member.name, team.name, { isCustom: false })}

                    >

                      <Check

                        className={`mr-2 size-4 ${isSelected ? "opacity-100" : "opacity-0"}`}

                      />

                      <span className="truncate">{member.name}</span>

                    </CommandItem>

                  );

                })}

              </CommandGroup>

            ))}

          </CommandList>

        </Command>

      </PopoverContent>

    </Popover>

  );

}



const STATUS_LABELS = Object.values(MST_ASSIGNMENT_STATUS);



const normalizeStatusLabel = (value) => {

  const raw = (value ?? "").toString().trim();

  if (!raw) return "";

  const normalized = normalize(raw);

  const matched = STATUS_LABELS.find((label) => normalize(label) === normalized);

  return matched || raw;

};



const computeStoredStatus = (row) => {

  const hasImport = Boolean(normalizeStr(row?.person_import || ""));

  const hasExport = Boolean(normalizeStr(row?.person_export || ""));

  if (hasImport && hasExport) {

    return MST_ASSIGNMENT_STATUS.ASSIGNED;

  }

  return MST_ASSIGNMENT_STATUS.PENDING;

};



const computeStatusDisplay = (row) => {

  const hasImport = Boolean(normalizeStr(row?.person_import || ""));

  const hasExport = Boolean(normalizeStr(row?.person_export || ""));



  if (hasImport && hasExport) {

    return MST_ASSIGNMENT_STATUS.ASSIGNED;

  }



  if (!hasImport && !hasExport) {

    return MST_ASSIGNMENT_STATUS.PENDING;

  }



  if (!hasImport) {

    return "Thiếu người phụ trách nhập";

  }



  if (!hasExport) {

    return "Thiếu người phụ trách xuất";

  }



  return normalizeStatusLabel(row?.status);

};



const COLUMN_OPTIONS = [

  { key: "mst", label: "MST", required: true },

  { key: "company", label: "Công ty" },

  { key: "person_import", label: "Người phụ trách Nhập" },

  { key: "person_export", label: "Người phụ trách Xuất" },

  { key: "status", label: "Trạng thái" },

  { key: "effective_from", label: "Áp dụng từ ngày" },

  { key: "effective_to", label: "Đến hết ngày" },

  { key: "actions", label: "Hành động" },

];



export const COLUMN_WIDTH_STORAGE_KEY = "mstAssignment.columnWidths";



export const DEFAULT_COLUMN_WIDTHS = Object.freeze({

  mst: 136,

  company: 320,

  person_import: 224,

  person_export: 224,

  status: 180,

  effective_from: 188,

  effective_to: 188,

  actions: 168,

});



export const COLUMN_MIN_WIDTH = 120;



export const COLUMN_MIN_WIDTHS = Object.freeze({

  mst: 120,

  company: 240,

  person_import: 180,

  person_export: 180,

  status: 150,

  effective_from: 160,

  effective_to: 160,

  actions: 150,

});



export const COLUMN_MAX_WIDTH = 640;



const getColumnFallbackWidth = (key, fallback = DEFAULT_COLUMN_WIDTHS) => {

  const width = fallback?.[key];

  if (Number.isFinite(width)) {

    return width;

  }

  const defaultWidth = DEFAULT_COLUMN_WIDTHS[key];

  if (Number.isFinite(defaultWidth)) {

    return defaultWidth;

  }

  return Math.max(COLUMN_MIN_WIDTHS[key] ?? COLUMN_MIN_WIDTH, COLUMN_MIN_WIDTH);

};



export function sanitizeColumnWidths(raw, fallback = DEFAULT_COLUMN_WIDTHS) {

  const result = {};

  COLUMN_OPTIONS.forEach((option) => {

    const { key } = option;

    const baseWidth = getColumnFallbackWidth(key, fallback);

    const minWidth = COLUMN_MIN_WIDTHS[key] ?? COLUMN_MIN_WIDTH;

    const maxWidth = COLUMN_MAX_WIDTH;



    let width = raw?.[key];

    if (typeof width === "string" && width.trim() !== "") {

      width = Number.parseFloat(width);

    }

    if (!Number.isFinite(width)) {

      width = baseWidth;

    }

    width = Math.round(width);

    if (!Number.isFinite(width) || width <= 0) {

      width = baseWidth;

    }

    if (width < minWidth) {

      width = minWidth;

    }

    if (Number.isFinite(maxWidth) && width > maxWidth) {

      width = maxWidth;

    }

    result[key] = width;

  });

  return result;

}



export function readStoredColumnWidths(storage, fallback = DEFAULT_COLUMN_WIDTHS) {

  if (!storage) {

    return sanitizeColumnWidths({}, fallback);

  }

  try {

    const raw = storage.getItem(COLUMN_WIDTH_STORAGE_KEY);

    if (!raw) {

      return sanitizeColumnWidths({}, fallback);

    }

    const parsed = JSON.parse(raw);

    return sanitizeColumnWidths(parsed, fallback);

  } catch (error) {

    console.warn("readStoredColumnWidths", error);

    return sanitizeColumnWidths({}, fallback);

  }

}



export function writeStoredColumnWidths(storage, widths) {

  if (!storage) {

    return false;

  }

  try {

    const sanitized = sanitizeColumnWidths(widths);

    storage.setItem(COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(sanitized));

    return true;

  } catch (error) {

    console.warn("writeStoredColumnWidths", error);

    return false;

  }

}



const getColumnLabel = (key) => COLUMN_OPTIONS.find((option) => option.key === key)?.label || key;



const toISO = (v) => {

  if (!v) return "";

  // v có thể dạng Date, serial excel, "dd/mm/yyyy", "yyyy-mm-dd"

  if (v instanceof Date && !isNaN(v)) {

    const y = v.getFullYear();

    const m = `${v.getMonth() + 1}`.padStart(2, "0");

    const d = `${v.getDate()}`.padStart(2, "0");

    return `${y}-${m}-${d}`;

  }

  if (typeof v === "number") {

    // serial Excel

    const d = XLSX.SSF.parse_date_code(v);

    if (!d) return "";

    const y = d.y;

    const m = `${d.m}`.padStart(2, "0");

    const day = `${d.d}`.padStart(2, "0");

    return `${y}-${m}-${day}`;

  }

  const s = v.toString().trim();

  // dd/mm/yyyy

  const m1 = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (m1) {

    const d = m1[1].padStart(2, "0");

    const m = m1[2].padStart(2, "0");

    const y = m1[3];

    return `${y}-${m}-${d}`;

  }

  // yyyy-mm-dd

  const m2 = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);

  if (m2) {

    const y = m2[1];

    const m = m2[2].padStart(2, "0");

    const d = m2[3].padStart(2, "0");

    return `${y}-${m}-${d}`;

  }

  return "";

};



const headerAliases = {

  mst: ["mst", "mã số thuế", "ma so thue", "mã số thuế (mst)"],

  company: ["company", "công ty", "ten cong ty", "doanh nghiep"],

  person_import: [

    "person_import",

    "người phụ trách nhập",

    "nguoi phu trach nhap",

    "nhap",

  ],

  person_export: [

    "person_export",

    "người phụ trách xuất",

    "nguoi phu trach xuat",

    "xuat",

  ],

  team: ["team", "tổ đội", "to doi", "nhom", "group"],

  effective_from: [

    "effective_from",

    "áp dụng từ ngày",

    "ap dung tu ngay",

    "apply_from",

    "effective from",

  ],

  effective_to: [

    "effective_to",

    "đến hết ngày",

    "den het ngay",

    "apply_to",

    "effective to",

  ],

  status: [

    "status",

    "trạng thái",

    "trang thai",

    "ghi chu trang thai",

    "tinh trang",

  ],

};



const findCell = (row, key) => {

  const wanted = headerAliases[key] || [key];

  const keys = Object.keys(row);

  for (const w of wanted) {

    const hit = keys.find((k) => normalize(k) === normalize(w));

    if (hit) return row[hit];

  }

  return "";

};



const tidyMST = (v) => {

  if (v == null) return "";

  // lấy chuỗi hiển thị (để giữ 0 ở đầu nếu có)

  let s = String(v).trim();

  // loại mọi ký tự không phải số

  s = s.replace(/[^\d]/g, "");

  return s;

};



export const MIN_PAGE_SIZE = 10;

const DEFAULT_PAGE_SIZE = 15;

export const PAGE_SIZE_OPTIONS = [15, 30, 50, 100];

export const PAGE_SIZE_STORAGE_KEY = "mstAssignment.pageSize";

export const normalizePageSize = (value, minValue = MIN_PAGE_SIZE) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return minValue;
  }
  const normalized = Math.trunc(numeric);
  if (normalized < minValue) {
    return minValue;
  }
  return normalized;
};

export const readStoredPageSize = (
  storage,
  fallback = DEFAULT_PAGE_SIZE,
  minValue = MIN_PAGE_SIZE
) => {
  if (!storage) return normalizePageSize(fallback, minValue);
  try {
    const raw = storage.getItem(PAGE_SIZE_STORAGE_KEY);
    if (raw == null || raw === "") {
      return normalizePageSize(fallback, minValue);
    }
    return normalizePageSize(raw, minValue);
  } catch (err) {
    console.warn("readStoredPageSize", err);
    return normalizePageSize(fallback, minValue);
  }
};



const HISTORY_FIELD_LABELS = {

  person_import: "Người phụ trách Nhập",

  person_export: "Người phụ trách Xuất",

  effective_from: "Áp dụng từ ngày",

  effective_to: "Đến hết ngày",

};



const MST_ROW_FIELDS = [

  "mst",

  "company",

  "person_import",

  "person_export",

  "team",

  "effective_from",

  "effective_to",

  "status",

];



const sortMSTRows = (list = []) => {

  return [...list]

    .filter(Boolean)

    .sort((a, b) => {

      const mstA = (a?.mst || "").toString();

      const mstB = (b?.mst || "").toString();

      const byMST = mstA.localeCompare(mstB);

      if (byMST !== 0) return byMST;

      const dateA = a?.effective_from || "";

      const dateB = b?.effective_from || "";

      if (dateA !== dateB) {

        return dateA.localeCompare(dateB);

      }

      const toA = a?.effective_to || "9999-12-31";

      const toB = b?.effective_to || "9999-12-31";

      return toA.localeCompare(toB);

    });

};



const makeRowKey = (row) => {

  if (!row) return "";

  return `${row.mst || ""}__${row.effective_from || ""}__${row.effective_to || ""}`;

};



const buildHistoryIndex = (entries = []) => {

  const map = new Map();

  for (const entry of entries) {

    if (!entry || !entry.rowKey || !entry.field) continue;

    if (!map.has(entry.rowKey)) {

      map.set(entry.rowKey, {});

    }

    const fieldBuckets = map.get(entry.rowKey);

    if (!fieldBuckets[entry.field]) {

      fieldBuckets[entry.field] = [];

    }

    fieldBuckets[entry.field].push(entry);

  }

  return map;

};



const formatHistoryTime = (value) => {

  if (!value) return "";

  try {

    return new Date(value).toLocaleString("vi-VN", { hour12: false });

  } catch (err) {

    console.warn("formatHistoryTime error", err);

    return value;

  }

};



const HistoryDetails = ({ entries = [], label }) => {

  if (!entries.length) return null;

  const renderValue = (value) =>

    value ? (

      <span>{value}</span>

    ) : (

      <span className="italic text-gray-500">(trống)</span>

    );



  return (

    <details className="mt-1 text-xs text-gray-600">

      <summary

        className="cursor-pointer text-blue-600 hover:text-blue-800"

        data-tooltip="Xem nhanh các lần chỉnh sửa trường này"

      >

        Lịch sử {label || ""}

      </summary>

      <ul className="mt-1 space-y-2 max-h-40 overflow-auto pr-1">

        {entries.map((entry) => (

          <li key={entry.id} className="border-t pt-1 first:border-t-0 first:pt-0">

            <div className="font-medium text-gray-700">

              {formatHistoryTime(entry.timestamp)} — {entry.actor || "Hệ thống"}

              {entry.type === "create" && (

                <span className="ml-2 text-emerald-600">(Thêm mới)</span>

              )}

              {entry.type === "update" && (

                <span className="ml-2 text-blue-600">(Chỉnh sửa)</span>

              )}

              {entry.type === "delete" && (

                <span className="ml-2 text-red-600">(Đã xoá)</span>

              )}

            </div>

            <div className="text-gray-600">

              <span className="text-gray-500">Từ:</span> {renderValue(entry.from)}

            </div>

            <div className="text-gray-600">

              <span className="text-gray-500">Đến:</span> {renderValue(entry.to)}

            </div>

          </li>

        ))}

      </ul>

    </details>

  );

};


const StageTimelinePreview = ({ stages = [], onViewFull }) => {
  const safeStages = Array.isArray(stages) ? stages : [];
  const limitedStages = safeStages.slice(0, 3);
  const canViewFull = typeof onViewFull === "function" && safeStages.length > 0;

  return (
    <details className="mt-2 text-xs text-slate-600">
      <summary className="flex cursor-pointer items-center gap-2 text-blue-600 hover:text-blue-800">
        <span>Lịch sử giai đoạn</span>
        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
          {safeStages.length}
        </span>
      </summary>
      {safeStages.length ? (
        <>
          <ul className="mt-1 space-y-1">
            {limitedStages.map((stage, index) => {
              const stageKey =
                makeRowKey(stage) ||
                `${stage?.mst || "stage"}-${stage?.effective_from || ""}-${stage?.effective_to || index}`;
              const startLabel = stage?.effective_from
                ? formatISODate(stage.effective_from)
                : "Không xác định";
              const endLabel = stage?.effective_to ? formatISODate(stage.effective_to) : "Hiện tại";
              const active = !stage?.effective_to;
              return (
                <li
                  key={stageKey}
                  className="rounded border border-slate-200 bg-white px-2 py-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700">
                      {startLabel} → {endLabel}
                    </span>
                    {active ? (
                      <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Hiện hành
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-slate-500">
                    <span>Nhập: {stage?.person_import || "—"}</span>
                    <span>Xuất: {stage?.person_export || "—"}</span>
                    {stage?.status ? <span>Trạng thái: {stage.status}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {safeStages.length > limitedStages.length ? (
            <p className="mt-1 text-[11px] text-slate-500">
              … và {safeStages.length - limitedStages.length} giai đoạn khác
            </p>
          ) : null}
          {canViewFull ? (
            <button
              type="button"
              className="mt-2 inline-flex items-center text-[11px] font-semibold text-blue-600 hover:text-blue-800"
              onClick={onViewFull}
            >
              Xem toàn màn hình
            </button>
          ) : null}
        </>
      ) : (
        <p className="mt-1 italic text-slate-400">Chưa có dữ liệu giai đoạn.</p>
      )}
    </details>
  );
};


const StageTimelineGroups = ({ groups = [] }) => {
  const safeGroups = Array.isArray(groups) ? groups : [];

  if (!safeGroups.length) {
    return (
      <p className="text-sm text-slate-500">
        Không có giai đoạn nào khớp bộ lọc hiện tại.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {safeGroups.map((group, groupIndex) => {
        const stageList = Array.isArray(group?.stages) ? group.stages : [];
        const groupKey = group?.mst || `group-${groupIndex}`;
        return (
          <div
            key={groupKey}
            className="rounded border border-slate-200 bg-slate-50 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  {group?.mst || "(MST trống)"}
                </div>
                <div className="max-w-2xl truncate text-xs text-slate-500">
                  {group?.company || "Chưa cập nhật tên công ty"}
                </div>
              </div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {stageList.length} giai đoạn
              </span>
            </div>
            {stageList.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {stageList.map((stage, stageIndex) => {
                  const stageKey =
                    makeRowKey(stage) ||
                    `${group?.mst || "stage"}-${stage?.effective_from || ""}-${stage?.effective_to || stageIndex}`;
                  const startLabel = stage?.effective_from
                    ? formatISODate(stage.effective_from)
                    : "Không xác định";
                  const endLabel = stage?.effective_to
                    ? formatISODate(stage.effective_to)
                    : "Hiện tại";
                  const active = !stage?.effective_to;
                  return (
                    <div
                      key={stageKey}
                      className={`min-w-[14rem] rounded border px-3 py-2 text-xs ${
                        active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">
                          {startLabel} → {endLabel}
                        </span>
                        {active ? (
                          <span className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            Đang áp dụng
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 space-y-1 text-slate-600">
                        <div>
                          <span className="font-medium text-slate-500">Nhập:</span> {stage?.person_import || "—"}
                        </div>
                        <div>
                          <span className="font-medium text-slate-500">Xuất:</span> {stage?.person_export || "—"}
                        </div>
                        {stage?.status ? (
                          <div>
                            <span className="font-medium text-slate-500">Trạng thái:</span> {stage.status}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-xs italic text-slate-500">Chưa có dữ liệu giai đoạn.</p>
            )}
          </div>
        );
      })}
    </div>
  );
};




export function CompanyNameCell({ value, isReadOnly, onChange, placeholder = "Tên công ty" }) {
  const safeValue = value == null ? "" : value.toString();
  const trimmedValue = safeValue.trim();
  const shouldWrap = shouldWrapCompanyName(safeValue);

  if (isReadOnly) {
    if (!trimmedValue) {
      return (
        <span className="italic text-gray-400" data-company-wrap="empty">
          (Không tên)
        </span>
      );
    }

    return (
      <span
        className={clsx(
          'block whitespace-normal break-words text-gray-900',
          shouldWrap ? 'leading-snug' : 'leading-normal'
        )}
        title={safeValue}
        data-company-wrap={shouldWrap ? 'wrapped' : 'single'}
        style={{ wordBreak: 'break-word' }}
      >
        {safeValue}
      </span>
    );
  }

  const handleChange = (event) => {
    const sanitizedValue = sanitizeCompanyNameInput(event.target.value);
    if (!onChange) {
      return;
    }

    if (sanitizedValue !== safeValue || event.target.value !== safeValue) {
      onChange(sanitizedValue);
    }
  };

  return (
    <textarea
      value={safeValue}
      onChange={handleChange}
      rows={shouldWrap ? 2 : 1}
      className={clsx(
        'border rounded px-2 py-1 w-full resize-y whitespace-normal break-words',
        shouldWrap ? 'leading-snug min-h-[2.5rem]' : 'leading-normal min-h-[2.25rem]'
      )}
      placeholder={placeholder}
      title={trimmedValue ? safeValue : undefined}
      spellCheck={false}
      data-company-wrap={shouldWrap ? 'wrapped' : 'single'}
      style={{ wordBreak: 'break-word' }}
    />
  );
}

const PERSON_HEADER_CONFIG = {
  person_import: {
    icon: LogIn,
    labelLines: ["Phụ trách", "Nhập"],
    tooltip: "Người phụ trách Nhập",
  },
  person_export: {
    icon: LogOut,
    labelLines: ["Phụ trách", "Xuất"],
    tooltip: "Người phụ trách Xuất",
  },
};

export function PersonColumnHeader({ columnKey }) {
  const config = PERSON_HEADER_CONFIG[columnKey];
  if (!config) {
    return null;
  }

  const { icon: Icon, labelLines, tooltip } = config;

  return (
    <div
      className="flex items-start gap-1.5"
      title={tooltip}
      data-tooltip={tooltip}
      data-column={columnKey}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-gray-500" aria-hidden="true" />
      <span className="flex flex-col text-left font-medium leading-tight text-gray-700">
        {labelLines.map((line) => (
          <span key={line}>{line}</span>
        ))}
        <span className="sr-only">{tooltip}</span>
      </span>
    </div>
  );
}

function ColumnResizeHandle({ columnKey, onResizeStart }) {

  const label = getColumnLabel(columnKey);

  const handleMouseDown = (event) => {

    if (typeof onResizeStart === "function") {

      onResizeStart(columnKey, event);

    }

  };

  return (

    <span

      role="separator"

      aria-orientation="vertical"

      aria-label={`Điều chỉnh chiều rộng cột ${label}`}

      title={`Kéo để điều chỉnh chiều rộng cột ${label}`}

      data-resize-handle={columnKey}

      className="absolute inset-y-0 right-0 flex w-3 cursor-col-resize select-none items-center justify-center"

      onMouseDown={handleMouseDown}

    >

      <span className="pointer-events-none h-full w-px bg-amber-500/50 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />

    </span>

  );

}

export function AssigneeCell({
  value = "",
  placeholder,
  isReadOnly,
  teams = [],
  teamValue = "",
  onSelect,
  historyEntries = [],
  historyLabel,
  showTeamHint = false,
}) {
  const safeValue = value == null ? "" : value.toString();
  const trimmedValue = safeValue.trim();
  const normalizedTeam = teamValue == null ? "" : teamValue.toString().trim();
  const hasTeamHint = showTeamHint && normalizedTeam;

  const displayNode = isReadOnly ? (
    trimmedValue ? (
      <span
        className="whitespace-normal break-words text-gray-900 leading-snug"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
        title={trimmedValue}
        data-assignee-state="filled"
      >
        {trimmedValue}
      </span>
    ) : (
      <span className="italic text-gray-400" data-assignee-state="empty">
        (Chưa chọn)
      </span>
    )
  ) : (
    <StaffCombobox
      value={safeValue}
      teamValue={teamValue || ""}
      teams={teams}
      placeholder={placeholder}
      onSelect={onSelect}
    />
  );

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-1">
        {displayNode}
        {hasTeamHint ? (
          <span
            className="text-xs text-gray-500"
            title={`Tổ phụ trách: ${normalizedTeam}`}
            data-team-hint="true"
          >
            Tổ: {normalizedTeam}
          </span>
        ) : null}
      </div>
      <HistoryDetails entries={historyEntries} label={historyLabel} />
    </div>
  );
}

export function PageSizeControl({
  value,
  onChange,
  options = PAGE_SIZE_OPTIONS,
  minValue = MIN_PAGE_SIZE,
  selectId = "mst-assignment-page-size",
}) {
  const hasPredefinedOption = options.includes(value);
  const [customValue, setCustomValue] = useState(() => String(Math.max(minValue, value || minValue)));
  const [selectedOption, setSelectedOption] = useState(() =>
    hasPredefinedOption ? String(value) : "custom"
  );
  const previousValueRef = useRef(value);

  useEffect(() => {
    if (previousValueRef.current === value) {
      return;
    }
    previousValueRef.current = value;
    const nextHasOption = options.includes(value);
    const nextOption = nextHasOption ? String(value) : "custom";
    setSelectedOption(nextOption);
    if (!nextHasOption) {
      setCustomValue(String(Math.max(minValue, value || minValue)));
    }
  }, [minValue, options, value]);

  const handleSelectChange = useCallback(
    (event) => {
      const next = event.target.value;
      if (next === "custom") {
        setSelectedOption("custom");
        setCustomValue(String(Math.max(minValue, value || minValue)));
        return;
      }
      setSelectedOption(next);
      const numeric = Number(next);
      if (Number.isFinite(numeric)) {
        onChange(normalizePageSize(numeric, minValue));
      }
    },
    [minValue, onChange, value]
  );

  const handleCustomChange = useCallback((event) => {
    const next = event.target.value;
    if (/^\d*$/.test(next)) {
      setCustomValue(next);
    }
  }, []);

  const applyCustomValue = useCallback(() => {
    if (customValue === "") {
      const fallback = Math.max(minValue, value || minValue);
      setCustomValue(String(fallback));
      onChange(fallback);
      return;
    }
    const normalized = normalizePageSize(customValue, minValue);
    setCustomValue(String(normalized));
    onChange(normalized);
  }, [customValue, minValue, onChange, value]);

  const handleCustomBlur = useCallback(() => {
    applyCustomValue();
  }, [applyCustomValue]);

  const handleCustomKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyCustomValue();
      }
    },
    [applyCustomValue]
  );

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
      <label htmlFor={selectId} className="font-medium text-gray-700">
        Số dòng mỗi trang
      </label>
      <select
        id={selectId}
        className="rounded border px-2 py-1"
        value={selectedOption}
        onChange={handleSelectChange}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option} dòng
          </option>
        ))}
        <option value="custom">Tùy chỉnh…</option>
      </select>
      {selectedOption === "custom" ? (
        <div className="flex items-center gap-2">
          <label htmlFor={`${selectId}-custom`} className="sr-only">
            Nhập số dòng tùy chỉnh
          </label>
          <input
            id={`${selectId}-custom`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="w-20 rounded border px-2 py-1 text-right"
            value={customValue}
            onChange={handleCustomChange}
            onBlur={handleCustomBlur}
            onKeyDown={handleCustomKeyDown}
            aria-describedby={`${selectId}-hint`}
          />
          <span id={`${selectId}-hint`} className="text-xs text-gray-500">
            Tối thiểu {minValue} dòng
          </span>
        </div>
      ) : null}
    </div>
  );
}

export default function MSTAssignment({ canEdit = true, currentUser = null }) {

  const [rows, setRows] = useState([]); // toàn bộ (bao gồm metadata)

  const [originalRows, setOriginalRows] = useState([]);

  const [search, setSearch] = useState("");

  const [staffFilter, setStaffFilter] = useState("");

  const [applyFrom, setApplyFrom] = useState(""); // yyyy-mm-dd

  const [initialPageSize] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_PAGE_SIZE;
    }
    return readStoredPageSize(window.localStorage, DEFAULT_PAGE_SIZE, MIN_PAGE_SIZE);
  });

  const rootRef = useRef(null);

  const fileRef = useRef();

  const setPageRef = useRef(() => {});

  const [selectedFileName, setSelectedFileName] = useState("");

  const [historyEntries, setHistoryEntries] = useState(() =>

    getMSTHistoryEntries(500)

  );

  const refreshHistory = useCallback(() => {

    setHistoryEntries(getMSTHistoryEntries(500));

  }, []);

  const [historyFilter, setHistoryFilter] = useState({

    from: "",

    to: "",

    type: "all",

  });

  const [rosterSnapshot, setRosterSnapshot] = useState(() => getTeamRoster());

  const rosterTeams = useMemo(() => buildRosterTeams(rosterSnapshot), [rosterSnapshot]);

  const [recentlyImportedKeys, setRecentlyImportedKeys] = useState(() => new Set());

  const markRecentlyImported = useCallback((keys = []) => {

    if (!Array.isArray(keys) || !keys.length) {

      return;

    }

    setRecentlyImportedKeys((prev) => {

      const next = new Set(prev);

      keys.forEach((key) => {

        if (key) {

          next.add(key);

        }

      });

      return next;

    });

  }, []);

  useEffect(() => {

    const unsubscribe = subscribeTeamRoster((next) => {

      setRosterSnapshot(next);

    });

    return () => {

      if (typeof unsubscribe === "function") {

        unsubscribe();

      }

    };

  }, []);

  const filteredHistoryEntries = useMemo(() => {

    if (!historyEntries?.length) return [];

    return historyEntries.filter((entry) => {

      if (!entry) return false;

      const entryDate = (entry.timestamp || "").slice(0, 10);

      if (historyFilter.from && entryDate < historyFilter.from) {

        return false;

      }

      if (historyFilter.to && entryDate > historyFilter.to) {

        return false;

      }

      if (historyFilter.type !== "all" && entry.type !== historyFilter.type) {

        return false;

      }

      return true;

    });

  }, [historyEntries, historyFilter]);

  const historyIndex = useMemo(

    () => buildHistoryIndex(filteredHistoryEntries),

    [filteredHistoryEntries]

  );

  const isHistoryFilterActive = useMemo(

    () =>

      Boolean(

        (historyFilter.from && historyFilter.from.trim()) ||

          (historyFilter.to && historyFilter.to.trim()) ||

          (historyFilter.type && historyFilter.type !== "all")

      ),

    [historyFilter]

  );

  const historyFilteredRowKeys = useMemo(() => {

    if (!isHistoryFilterActive) return null;

    const set = new Set();

    filteredHistoryEntries.forEach((entry) => {

      if (entry?.rowKey) {

        set.add(entry.rowKey);

      }

    });

    return set;

  }, [filteredHistoryEntries, isHistoryFilterActive]);

  const [showAddForm, setShowAddForm] = useState(false);

  const [draft, setDraft] = useState({

    mst: "",

    company: "",

    person_import: "",

    person_export: "",

    team: "",

    effective_from: "",

    effective_to: "",

  });

  const canUseLocalStorage = typeof window !== "undefined" && typeof window.localStorage !== "undefined";

  const [columnWidths, setColumnWidths] = useState(() => {

    if (!canUseLocalStorage) {

      return sanitizeColumnWidths(DEFAULT_COLUMN_WIDTHS);

    }

    return readStoredColumnWidths(window.localStorage, DEFAULT_COLUMN_WIDTHS);

  });

  const columnWidthsRef = useRef(columnWidths);

  useEffect(() => {

    columnWidthsRef.current = columnWidths;

  }, [columnWidths]);

  const pendingColumnWidthsRef = useRef(columnWidths);

  const persistColumnWidthsTimeoutRef = useRef(null);

  const schedulePersistColumnWidths = useCallback(

    (nextWidths) => {

      if (!canUseLocalStorage) {

        return;

      }

      pendingColumnWidthsRef.current = nextWidths;

      if (persistColumnWidthsTimeoutRef.current) {

        clearTimeout(persistColumnWidthsTimeoutRef.current);

      }

      persistColumnWidthsTimeoutRef.current = setTimeout(() => {

        writeStoredColumnWidths(window.localStorage, pendingColumnWidthsRef.current);

        persistColumnWidthsTimeoutRef.current = null;

      }, 280);

    },

    [canUseLocalStorage]

  );

  useEffect(() => {

    schedulePersistColumnWidths(columnWidths);

  }, [columnWidths, schedulePersistColumnWidths]);

  useEffect(() => {

    return () => {

      if (persistColumnWidthsTimeoutRef.current) {

        clearTimeout(persistColumnWidthsTimeoutRef.current);

      }

      if (typeof document !== "undefined" && document.body) {

        document.body.style.removeProperty("user-select");

        document.body.style.removeProperty("cursor");

      }

    };

  }, []);

  const columnResizeStateRef = useRef({ key: null, startX: 0, startWidth: 0 });

  const handleColumnResizeStart = useCallback(

    (key, event) => {

      if (event.button !== 0) {

        return;

      }

      event.preventDefault();

      event.stopPropagation();

      const currentWidths = columnWidthsRef.current || {};

      const startWidth = currentWidths[key] ?? getColumnFallbackWidth(key);

      columnResizeStateRef.current = {

        key,

        startX: event.clientX,

        startWidth,

      };

      if (typeof document !== "undefined" && document.body) {

        document.body.style.userSelect = "none";

        document.body.style.cursor = "col-resize";

      }

    },

    []

  );

  const handleColumnResizeMove = useCallback((event) => {

    const state = columnResizeStateRef.current;

    if (!state?.key) {

      return;

    }

    const delta = event.clientX - state.startX;

    const proposed = state.startWidth + delta;

    const minWidth = COLUMN_MIN_WIDTHS[state.key] ?? COLUMN_MIN_WIDTH;

    const maxWidth = COLUMN_MAX_WIDTH;

    const nextWidth = Math.min(maxWidth, Math.max(minWidth, Math.round(proposed)));

    setColumnWidths((prev) => {

      const current = prev?.[state.key];

      if (current === nextWidth) {

        return prev;

      }

      return { ...prev, [state.key]: nextWidth };

    });

  }, []);

  useEffect(() => {

    if (typeof window === "undefined") {

      return undefined;

    }

    const handleMove = (event) => {

      if (!columnResizeStateRef.current?.key) {

        return;

      }

      handleColumnResizeMove(event);

    };

    const handleUp = (event) => {

      if (!columnResizeStateRef.current?.key) {

        return;

      }

      handleColumnResizeMove(event);

      columnResizeStateRef.current = { key: null, startX: 0, startWidth: 0 };

      if (typeof document !== "undefined" && document.body) {

        document.body.style.removeProperty("user-select");

        document.body.style.removeProperty("cursor");

      }

    };

    window.addEventListener("mousemove", handleMove);

    window.addEventListener("mouseup", handleUp);

    return () => {

      window.removeEventListener("mousemove", handleMove);

      window.removeEventListener("mouseup", handleUp);

    };

  }, [handleColumnResizeMove]);

  const handleResetColumnWidths = useCallback(() => {

    const defaults = sanitizeColumnWidths(DEFAULT_COLUMN_WIDTHS);

    setColumnWidths(defaults);

  }, []);

  const columnStyleMap = useMemo(() => {

    const map = {};

    COLUMN_OPTIONS.forEach((option) => {

      const key = option.key;

      const stored = columnWidths?.[key];

      const minWidth = COLUMN_MIN_WIDTHS[key] ?? COLUMN_MIN_WIDTH;

      const fallbackWidth = getColumnFallbackWidth(key);

      const resolved = Math.max(minWidth, Number.isFinite(stored) ? stored : fallbackWidth);

      map[key] = {

        width: `${resolved}px`,

        minWidth: `${minWidth}px`,

        maxWidth: `${Math.max(resolved, minWidth)}px`,

      };

    });

    return map;

  }, [columnWidths]);

  const [visibleColumns, setVisibleColumns] = useState(() => {

    const defaults = {};

    COLUMN_OPTIONS.forEach((option) => {

      defaults[option.key] = option.required ? true : true;

    });

    return defaults;

  });

  const [columnMenuOpen, setColumnMenuOpen] = useState(false);

  const isColumnVisible = useCallback(

    (key) => {

      const option = COLUMN_OPTIONS.find((item) => item.key === key);

      if (!option) return true;

      if (option.required) return true;

      return visibleColumns[key] !== false;

    },

    [visibleColumns]

  );

  const visibleColumnKeys = useMemo(

    () => COLUMN_OPTIONS.filter((option) => isColumnVisible(option.key)).map((option) => option.key),

    [isColumnVisible]

  );

  const toggleColumnVisibility = useCallback(

    (key) => {

      const option = COLUMN_OPTIONS.find((item) => item.key === key);

      if (option?.required) {

        return;

      }

      setVisibleColumns((prev) => {

        const next = { ...prev };

        next[key] = prev[key] === false ? true : false;

        return next;

      });

    },

    [setVisibleColumns]

  );

  const [addError, setAddError] = useState("");



  const actor = currentUser?.username || "guest";

  const isReadOnly = !canEdit;

  const {

    favorites: quickFavorites,

    addFavorite: addQuickFavorite,

    removeFavorite: removeQuickFavorite,

    clearType: clearQuickFavorite,

  } = useMSTQuickFilters();

  const originalMap = useMemo(() => {

    const map = new Map();

    originalRows.forEach((row) => {

      if (!row) return;

      const key = row.__originalKey || makeRowKey(row);

      if (key) {

        map.set(key, row);

      }

    });

    return map;

  }, [originalRows]);

  const createRowState = useCallback((row, meta = {}) => {

    const mstValue = tidyMST(row?.mst || "");

    const base = {

      mst: mstValue,

      company: String(row?.company || "").trim(),

      person_import: String(row?.person_import || "").trim(),

      person_export: String(row?.person_export || "").trim(),

      team: String(row?.team || "").trim(),

      effective_from: row?.effective_from || "",

      effective_to: row?.effective_to || "",

      status: "",

    };

    base.status = computeStoredStatus(base);

    const originalKey = meta.originalKey ?? (meta.isNew ? null : makeRowKey(base));

    return {

      ...base,

      __originalKey: originalKey,

      __isNew: Boolean(meta.isNew),

    };

  }, []);

  const getRowDiff = useCallback(

    (row) => {

      if (!row) {

        return { changed: false, sanitized: createRowState({}, { isNew: true }) };

      }

      const baseKey = row.__originalKey || "";

      const sanitized = createRowState(row, {

        originalKey: baseKey || undefined,

        isNew: row.__isNew,

      });

      const nextKey = makeRowKey(sanitized);

      const baseline = baseKey ? originalMap.get(baseKey) : null;

      if (!baseline) {

        const payload = {};

        MST_ROW_FIELDS.forEach((field) => {

          payload[field] = sanitized[field] || "";

        });

        return { changed: true, isNew: true, sanitized, patch: payload, keyChanged: true };

      }

      const patch = {};

      MST_ROW_FIELDS.forEach((field) => {

        const nextValue = sanitized[field] || "";

        const prevValue = baseline[field] || "";

        if (field === "effective_from") {

          if ((nextValue || "") !== (prevValue || "")) {

            patch[field] = nextValue;

          }

          return;

        }

        if (field === "effective_to") {

          if ((nextValue || "") !== (prevValue || "")) {

            patch[field] = nextValue;

          }

          return;

        }

        if (field === "status") {

          if (normalizeStatusLabel(nextValue) !== normalizeStatusLabel(prevValue)) {

            patch[field] = normalizeStatusLabel(nextValue);

          }

          return;

        }

        if (field === "mst") {

          if (tidyMST(nextValue) !== tidyMST(prevValue)) {

            patch[field] = tidyMST(nextValue);

          }

          return;

        }

        if (normalizeStr(nextValue) !== normalizeStr(prevValue)) {

          patch[field] = nextValue;

        }

      });

      const keyChanged = nextKey !== (baseKey || nextKey);

      const changed = keyChanged || Object.keys(patch).length > 0;

      return { changed, isNew: false, sanitized, patch, keyChanged, baseline };

    },

    [createRowState, originalMap]

  );

  const rowHasChanges = useCallback((row) => getRowDiff(row).changed, [getRowDiff]);

  const commitRow = useCallback(

    (row) => {

      if (isReadOnly) {

        alert("Bạn không có quyền cập nhật dòng này.");

        return;

      }

      const diff = getRowDiff(row);

      if (!diff.changed) {

        alert("Không có thay đổi mới để lưu.");

        return;

      }

      const payload = { ...diff.sanitized };

      delete payload.__originalKey;

      delete payload.__isNew;

      try {

        const result = saveMSTRow(payload, {

          originalKey: row.__originalKey || null,

          actor,

          detail: "Cập nhật gán MST từ tab Gán MST",

        });

        if (!result?.ok) {

          switch (result?.reason) {

            case "conflict":

              alert(

                "MST và ngày áp dụng trùng với dòng khác. Vui lòng đổi ngày áp dụng hoặc kiểm tra dữ liệu hiện có."

              );

              break;

            case "invalid":

              alert("Dữ liệu chưa hợp lệ, vui lòng kiểm tra lại.");

              break;

            case "not-found":

              alert("Không tìm thấy bản ghi gốc. Hãy tải lại trang trước khi cập nhật.");

              break;

            case "no-change":

              alert("Không có thay đổi mới để lưu.");

              break;

            default:

              alert("Không thể lưu dòng này. Vui lòng thử lại sau.");

          }

          return;

        }

        const savedRow = createRowState(result.row, {

          originalKey: result.key,

          isNew: false,

        });

        setRows((prev) => {

          const current = Array.isArray(prev) ? prev : [];

          const replaced = current.map((item) => (item === row ? savedRow : item));

          return sortMSTRows(replaced);

        });

        setOriginalRows((prev) => {

          const baseKey = result.previousKey || row.__originalKey || "";

          const filtered = (Array.isArray(prev) ? prev : []).filter((item) => {

            const itemKey = item.__originalKey || makeRowKey(item);

            return itemKey !== baseKey;

          });

          const merged = [...filtered, savedRow];

          return sortMSTRows(merged);

        });

        setRecentlyImportedKeys((prev) => {

          const next = new Set(prev);

          const currentKey = makeRowKey(row);

          if (currentKey && next.has(currentKey)) {

            next.delete(currentKey);

          }

          if (row.__originalKey && next.has(row.__originalKey)) {

            next.delete(row.__originalKey);

          }

          next.add(result.key);

          return next;

        });

        refreshHistory();

        alert("Đã lưu thay đổi cho dòng này.");

      } catch (error) {

        console.error("saveMSTRow error", error);

        alert("Không thể lưu dòng này. Vui lòng thử lại sau.");

      }

    },

    [actor, createRowState, getRowDiff, isReadOnly, refreshHistory]

  );

  const handleStaffFilterSelect = useCallback(({ staffName }) => {

    setStaffFilter(staffName || "");

    setPageRef.current(1);

  }, []);

  const clearStaffFilter = useCallback(() => {

    setStaffFilter("");

    setPageRef.current(1);

  }, []);

  const applyStaffFavorite = useCallback((value) => {

    setStaffFilter(value || "");

    setPageRef.current(1);

  }, []);

  const updateHistoryFilter = useCallback((patch) => {

    setHistoryFilter((prev) => ({ ...prev, ...patch }));

  }, []);

  const applyActionFavorite = useCallback(

    (value) => {

      if (!value) {

        updateHistoryFilter({ type: "all" });

      } else {

        updateHistoryFilter({ type: value });

      }

      setPageRef.current(1);

    },

    [updateHistoryFilter]

  );

  const handleSaveStaffFavorite = useCallback(() => {

    if (!staffFilter.trim()) {

      alert("Nhập hoặc chọn nhân viên trước khi lưu bộ lọc.");

      return;

    }

    const result = addQuickFavorite("staff", staffFilter);

    if (!result.ok) {

      if (result.reason === "duplicate") {

        alert("Bộ lọc này đã nằm trong danh sách ưa thích.");

      }

      return;

    }

    alert("Đã lưu bộ lọc nhân viên.");

  }, [addQuickFavorite, staffFilter]);

  const handleSaveActionFavorite = useCallback(() => {

    if (!historyFilter.type || historyFilter.type === "all") {

      alert("Chỉ lưu bộ lọc thao tác khi bạn chọn Thêm mới/Chỉnh sửa/Xóa.");

      return;

    }

    const result = addQuickFavorite("action", historyFilter.type);

    if (!result.ok) {

      if (result.reason === "duplicate") {

        alert("Bộ lọc thao tác đã tồn tại.");

      }

      return;

    }

    alert("Đã lưu bộ lọc thao tác.");

  }, [addQuickFavorite, historyFilter.type]);



  const resetHistoryFilter = () => {

    setHistoryFilter({ from: "", to: "", type: "all" });

  };



  /** Load lần đầu */

  useEffect(() => {

    try {

      const cur = getMSTMap() || [];

      const prepared = sortMSTRows(cur).map((row) =>

        createRowState(row, { originalKey: makeRowKey(row), isNew: false })

      );

      setRows(prepared);

      setOriginalRows(prepared);

    } catch (e) {

      console.error("getMSTMap error:", e);

    }

  }, [createRowState]);



  useEffect(() => {

    refreshHistory();

  }, [refreshHistory]);



  const toggleAddForm = () => {

    if (isReadOnly) {

      alert(

        "Bạn không có quyền thêm mới thủ công. Đăng nhập bằng tài khoản được cấp quyền để tiếp tục."

      );

      return;

    }

    if (showAddForm) {

      setShowAddForm(false);

      setAddError("");

      return;

    }

    setDraft({

      mst: "",

      company: "",

      person_import: "",

      person_export: "",

      team: "",

      effective_from: applyFrom || "",

      effective_to: "",

    });

    setAddError("");

    setShowAddForm(true);

  };



  const computeNextStageStart = useCallback(

    (row) => {

      if (!row) {

        return applyFrom || "";

      }

      const base = row.effective_to || row.effective_from || applyFrom || "";

      if (!base) return "";

      const date = new Date(base);

      if (Number.isNaN(date.getTime())) {

        return base;

      }

      date.setDate(date.getDate() + 1);

      return date.toISOString().slice(0, 10);

    },

    [applyFrom]

  );



  const startNewStageFromRow = useCallback(

    (row) => {

      if (isReadOnly) {

        alert("Bạn không có quyền thêm giai đoạn mới.");

        return;

      }

      const nextStart = computeNextStageStart(row);

      setDraft({

        mst: row?.mst || "",

        company: row?.company || "",

        person_import: row?.person_import || "",

        person_export: row?.person_export || "",

        team: row?.team || "",

        effective_from: nextStart || "",

        effective_to: "",

      });

      setAddError("");

      setShowAddForm(true);

      setTimeout(() => {

        if (rootRef.current) {

          rootRef.current.scrollIntoView({ behavior: "smooth", block: "start" });

        }

      }, 60);

    },

    [computeNextStageStart, isReadOnly]

  );



  const handleDraftChange = (field, formatter = (value) => value) => (event) => {

    const raw = event?.target?.value ?? "";

    const value = formatter(raw);

    setDraft((prev) => ({ ...prev, [field]: value }));

  };



  const handleAddSubmit = (event) => {

    event.preventDefault();

    if (isReadOnly) {

      alert("Bạn không có quyền thêm mới.");

      return;

    }

    const mst = tidyMST(draft.mst);

    if (!mst) {

      setAddError("Vui lòng nhập mã số thuế hợp lệ (chỉ chứa số).");

      return;

    }

    const normalizedCompany = String(draft.company || "").trim();

    const normalizedImport = String(draft.person_import || "").trim();

    const normalizedExport = String(draft.person_export || "").trim();

    const normalizedTeam = String(draft.team || "").trim();

    const normalizedDate = draft.effective_from || "";

    const normalizedEnd = draft.effective_to || "";

    if (normalizedDate && normalizedEnd && normalizedEnd < normalizedDate) {

      setAddError("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");

      return;

    }

    const newRow = {

      mst,

      company: normalizedCompany,

      person_import: normalizedImport,

      person_export: normalizedExport,

      team: normalizedTeam,

      effective_from: normalizedDate,

      effective_to: normalizedEnd,

      status: computeStoredStatus({

        person_import: normalizedImport,

        person_export: normalizedExport,

      }),

    };



    let createdKey = "";

    setRows((prev) => {

      const current = Array.isArray(prev) ? prev : [];

      const newKey = makeRowKey(newRow);

      const next = [...current];

      const existingIndex = next.findIndex((row) => makeRowKey(row) === newKey);

      const resolvedTeam = normalizedTeam || (existingIndex >= 0 ? next[existingIndex]?.team || "" : "");

      const resolvedStatus = computeStoredStatus({

        ...newRow,

        team: resolvedTeam,

        status: newRow.status,

      });

      const payload = { ...newRow, team: resolvedTeam, status: resolvedStatus };

      if (existingIndex >= 0) {

        const originalMeta = next[existingIndex];

        next[existingIndex] = createRowState({ ...originalMeta, ...payload }, {

          originalKey: originalMeta.__originalKey,

          isNew: originalMeta.__isNew,

        });

      } else {

        next.push(createRowState(payload, { isNew: true }));

        createdKey = newKey;

      }

      return sortMSTRows(next);

    });

    if (createdKey) {

      markRecentlyImported([createdKey]);

    }

    setPageRef.current(1);

    setShowAddForm(false);

    setAddError("");

    alert("Đã thêm vào danh sách. Bấm Lưu để ghi vào hệ thống.");

  };



  const exportRowsToExcel = (scope = "filtered") => {

    const source = scope === "all" ? rows : filtered;

    if (!source.length) {

      alert("Không có dữ liệu để xuất Excel.");

      return;

    }

    const data = source.map((item, index) => ({

      STT: index + 1,

      MST: item.mst,

      "Công ty": item.company || "",

      "Người phụ trách Nhập": item.person_import || "",

      "Người phụ trách Xuất": item.person_export || "",

      "Tổ đội": item.team || "",

      "Áp dụng từ ngày": item.effective_from || "",

      "Đến hết ngày": item.effective_to || "",

      "Trạng thái": computeStatusDisplay(item) || item.status || "",

    }));



    const worksheet = XLSX.utils.json_to_sheet(data);

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Gan MST");

    const now = new Date();

    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(

      now.getDate()

    ).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(

      2,

      "0"

    )}`;

    const suffix = scope === "all" ? "toan-bo" : "loc";

    XLSX.writeFile(workbook, `gan-mst-${suffix}-${timestamp}.xlsx`);

  };



  /** Filter + phân trang */

  const filtered = useMemo(() => {

    const query = normalize(search || "");

    const hasQuery = Boolean(query);

    const staffQuery = normalize(staffFilter || "");

    const hasStaffQuery = Boolean(staffQuery);

    const base = rows.filter((row) => {

      if (isHistoryFilterActive) {

        const key = makeRowKey(row);

        if (!historyFilteredRowKeys?.has(key)) {

          return false;

        }

      }

      if (hasStaffQuery) {

        const staffMatched =

          normalize(row.person_import || "").includes(staffQuery) ||

          normalize(row.person_export || "").includes(staffQuery) ||

          normalize(row.team || "").includes(staffQuery);

        if (!staffMatched) {

          return false;

        }

      }

      if (!hasQuery) return true;

      return (

        normalize(row.mst).includes(query) ||

        normalize(row.company).includes(query) ||

        normalize(row.status || "").includes(query)

      );

    });



    const prioritized = [...base].sort((a, b) => {

      const keyA = makeRowKey(a);

      const keyB = makeRowKey(b);

      const aIsNew = recentlyImportedKeys.has(keyA) ? 1 : 0;

      const bIsNew = recentlyImportedKeys.has(keyB) ? 1 : 0;

      if (aIsNew !== bIsNew) {

        return bIsNew - aIsNew;

      }

      const byMST = (a.mst || "").localeCompare(b.mst || "");

      if (byMST !== 0) return byMST;

      const fromCompare = (a.effective_from || "").localeCompare(b.effective_from || "");

      if (fromCompare !== 0) return fromCompare;

      return (a.effective_to || "9999-12-31").localeCompare(b.effective_to || "9999-12-31");

    });



    return prioritized;

  }, [

    rows,

    search,

    staffFilter,

    isHistoryFilterActive,

    historyFilteredRowKeys,

    recentlyImportedKeys,

  ]);



  const {
    page,
    pageSize,
    pageCount: totalPages,
    currentPageItems: pageRows,
    setPage,
    setPageSize,
    nextPage,
    previousPage,
  } = usePagination(filtered, {
    initialPage: 1,
    initialPageSize,
    minPageSize: MIN_PAGE_SIZE,
  });



  const groupedStages = useMemo(() => {
    if (!filtered.length) return [];
    const map = new Map();
    filtered.forEach((row) => {
      const key = row.mst || "__unknown";
      if (!map.has(key)) {
        map.set(key, {
          mst: row.mst || "",
          company: row.company || "",
          stages: [],
        });
      }
      map.get(key).stages.push(row);
    });
    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        stages: sortMSTRows(entry.stages),
      }))
      .sort((a, b) => (a.mst || "").localeCompare(b.mst || ""));
  }, [filtered]);

  const timelineGroupsByMST = useMemo(() => {
    const map = new Map();
    groupedStages.forEach((group) => {
      const key = group?.mst || "__unknown";
      if (!map.has(key)) {
        map.set(key, group);
      }
    });
    return map;
  }, [groupedStages]);

  const [timelineDialogState, setTimelineDialogState] = useState({
    open: false,
    groups: [],
    title: "",
    subtitle: "",
  });

  const showTimelineDialog = useCallback(({ title, subtitle, groups }) => {
    const normalizedGroups = Array.isArray(groups) ? groups.filter(Boolean) : [];
    if (!normalizedGroups.length) {
      setTimelineDialogState((prev) => ({ ...prev, open: false }));
      return;
    }
    setTimelineDialogState({
      open: true,
      groups: normalizedGroups,
      title: title || "Dòng thời gian giai đoạn",
      subtitle: subtitle || "",
    });
  }, []);

  const handleTimelineDialogOpenChange = useCallback((nextOpen) => {
    setTimelineDialogState((prev) => ({ ...prev, open: nextOpen }));
  }, []);

  const handleOpenTimelineGroup = useCallback(
    (group) => {
      if (!group) return;
      const safeGroup = {
        mst: group?.mst || "",
        company: group?.company || "",
        stages: Array.isArray(group?.stages) ? group.stages : [],
      };
      showTimelineDialog({
        title: `Dòng thời gian — ${safeGroup.mst || "(MST trống)"}`,
        subtitle: safeGroup.company ? `Công ty: ${safeGroup.company}` : "",
        groups: [safeGroup],
      });
    },
    [showTimelineDialog]
  );

  const handleOpenAllTimelines = useCallback(() => {
    if (!groupedStages.length) return;
    showTimelineDialog({
      title: "Dòng thời gian giai đoạn",
      subtitle: `${groupedStages.length} MST khớp bộ lọc hiện tại`,
      groups: groupedStages,
    });
  }, [groupedStages, showTimelineDialog]);



  useEffect(() => {

    setPageRef.current(1);

  }, [historyFilter.from, historyFilter.to, historyFilter.type, isHistoryFilterActive]);



  useEffect(() => {

    setPageRef.current = setPage;

  }, [setPage]);



  useTooltipTitles(rootRef, [

    rows,

    search,

    staffFilter,

    applyFrom,

    page,

    pageSize,

    showAddForm,

    selectedFileName,

    historyFilter,

  ]);



  useEffect(() => {

    if (typeof window === "undefined") return;

    try {

      window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize));

    } catch (err) {

      console.warn("persistPageSize", err);

    }

  }, [pageSize]);



  const totalHistoryCount = historyEntries.length;

  const filteredHistoryCount = filteredHistoryEntries.length;

  const recentlyImportedCount = recentlyImportedKeys.size;



  /** Excel import */

  const onImportXLSX = async () => {

    if (isReadOnly) {

      alert("Bạn không có quyền import bảng MST. Đăng nhập bằng tài khoản được cấp quyền để tiếp tục.");

      return;

    }

    const f = fileRef.current?.files?.[0];

    if (!f) {

      alert("Chưa chọn file .xlsx/.xls");

      return;

    }

    try {

      const buf = await f.arrayBuffer();

      const wb = XLSX.read(buf, { type: "array" });

      const sheet = wb.Sheets[wb.SheetNames[0]];

      // lấy text đã format để hạn chế mất 0 đầu

      const json = XLSX.utils.sheet_to_json(sheet, {

        defval: "",

        raw: false,

      });



      const newRowKeys = [];



      const mapped = json

        .map((r) => {

          const mst = tidyMST(findCell(r, "mst"));

          if (!mst) return null;



          return {

            mst,

            company: String(findCell(r, "company") ?? "").trim(),

            person_import: String(findCell(r, "person_import") ?? "").trim(),

            person_export: String(findCell(r, "person_export") ?? "").trim(),

            team: String(findCell(r, "team") ?? "").trim(),

            effective_from:

              toISO(findCell(r, "effective_from")) || applyFrom || "",

            effective_to: toISO(findCell(r, "effective_to")) || "",

            status: normalizeStatusLabel(findCell(r, "status")),

          };

        })

        .filter(Boolean);



      if (!mapped.length) {

        alert("Không thấy dữ liệu hợp lệ trong file.");

        return;

      }



      const sanitizedMapped = mapped.filter((item) => {

        if (item.effective_from && item.effective_to && item.effective_to < item.effective_from) {

          console.warn("Bỏ qua dòng do ngày kết thúc nhỏ hơn ngày bắt đầu", item);

          return false;

        }

        return true;

      });



      if (!sanitizedMapped.length) {

        alert("Tất cả dòng trong file bị bỏ qua vì ngày kết thúc nhỏ hơn ngày bắt đầu.");

        return;

      }



      // Gộp với dữ liệu hiện có theo MST + ngày hiệu lực (ưu tiên dữ liệu mới)

      const byKey = new Map();

      for (const r of rows) {

        byKey.set(makeRowKey(r), { ...r });

      }

      for (const r of sanitizedMapped) {

        const key = makeRowKey(r);

        const previous = byKey.get(key);

        let nextRow;

        if (previous) {

          nextRow = createRowState({ ...previous, ...r }, {

            originalKey: previous.__originalKey,

            isNew: previous.__isNew,

          });

        } else {

          nextRow = createRowState(r, { isNew: true });

        }

        byKey.set(key, nextRow);

        if (!previous) {

          newRowKeys.push(key);

        }

      }



      const nextRows = sortMSTRows(Array.from(byKey.values()));

      setRows(nextRows);

      setPageRef.current(1);

      alert(`Đọc file thành công: ${sanitizedMapped.length} dòng. Bấm Lưu để ghi.`);

      markRecentlyImported(newRowKeys);

    } catch (e) {

      console.error(e);

      alert("Không thể đọc file .xlsx — kiểm tra lại định dạng.");

    } finally {

      if (fileRef.current) fileRef.current.value = "";

      setSelectedFileName("");

    }

  };



  /** Lưu */

  const onSave = () => {

    if (isReadOnly) {

      alert("Bạn không có quyền lưu bảng MST.");

      return;

    }

    try {

      upsertMSTRows(rows, {

        actor,

        detail: "Cập nhật gán MST từ giao diện",

      });

      refreshHistory();

      const synced = sortMSTRows(getMSTMap()).map((row) =>

        createRowState(row, { originalKey: makeRowKey(row), isNew: false })

      );

      setRows(synced);

      setOriginalRows(synced);

      setRecentlyImportedKeys(new Set());

      alert("Lưu thành công!");

    } catch (e) {

      console.error(e);

      alert("Lưu thất bại!");

    }

  };



  /** Thao tác inline */

  const updateRow = (originalRow, patch) => {

    if (isReadOnly) return;

    const nextFrom =

      Object.prototype.hasOwnProperty.call(patch || {}, "effective_from")

        ? patch.effective_from || ""

        : originalRow.effective_from || "";

    const nextTo =

      Object.prototype.hasOwnProperty.call(patch || {}, "effective_to")

        ? patch.effective_to || ""

        : originalRow.effective_to || "";

    if (nextFrom && nextTo && nextTo < nextFrom) {

      alert("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");

      return;

    }

    const targetKey = makeRowKey(originalRow);

    let updatedKey = "";

    let didUpdate = false;

    setRows((prev) =>

      sortMSTRows(

        prev.map((r) => {

          if (makeRowKey(r) !== targetKey) return r;

          const next = { ...r, ...patch };

          next.__originalKey = r.__originalKey ?? null;

          next.__isNew = r.__isNew;

          if (patch && Object.prototype.hasOwnProperty.call(patch, "mst")) {

            next.mst = tidyMST(next.mst);

          }

          if (patch && Object.prototype.hasOwnProperty.call(patch, "effective_from")) {

            next.effective_from = patch.effective_from || "";

          }

          if (patch && Object.prototype.hasOwnProperty.call(patch, "effective_to")) {

            next.effective_to = patch.effective_to || "";

          }

          next.status = computeStoredStatus(next);

          updatedKey = makeRowKey(next);

          didUpdate = true;

          return next;

        })

      )

    );

    if (didUpdate && updatedKey && updatedKey !== targetKey) {

      setRecentlyImportedKeys((prev) => {

        if (!prev.has(targetKey)) return prev;

        const next = new Set(prev);

        next.delete(targetKey);

        next.add(updatedKey);

        return next;

      });

    }

  };



  const removeRow = (row) => {

    if (isReadOnly) return;

    const key = makeRowKey(row);

    const fromLabel = row.effective_from ? row.effective_from : "";

    const toLabel = row.effective_to ? row.effective_to : "";

    const rangeLabel = fromLabel || toLabel ? `(${fromLabel || "…"} → ${toLabel || "…"})` : "";

    const label = `${row.mst}${rangeLabel ? ` ${rangeLabel}` : ""}`;

    if (!confirm(`Xóa dòng ${label}?`)) return;

    setRows((prev) => prev.filter((r) => makeRowKey(r) !== key));

    setRecentlyImportedKeys((prev) => {

      if (!prev.has(key)) return prev;

      const next = new Set(prev);

      next.delete(key);

      return next;

    });

  };



  /** UI */

  return (

    <div ref={rootRef} className="p-6 max-w-6xl mx-auto">

      {isReadOnly && (

        <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">

          Bạn đang xem bảng gán MST ở chế độ chỉ xem. Đăng nhập bằng tài khoản quản trị hoặc được cấp quyền để import, chỉnh sửa và lưu thay đổi.

        </div>

      )}

      <div className="flex flex-wrap items-end gap-2 mb-3">

        {canEdit && (

          <>

            <input

              ref={fileRef}

              type="file"

              accept=".xlsx,.xls"

              className="hidden"

              disabled={isReadOnly}

              onChange={(e) => {

                const name = e.target.files?.[0]?.name || "";

                setSelectedFileName(name);

              }}

            />

            <button

              type="button"

              onClick={() => fileRef.current?.click()}

              className="px-3 py-1 rounded border bg-white hover:bg-gray-50"

              data-tooltip="Chọn file Excel chứa dữ liệu gán MST"

            >

              Chọn file XLSX

            </button>

            <button

              onClick={onImportXLSX}

              className="px-3 py-1 rounded bg-black text-white"

              type="button"

              data-tooltip="Đọc file Excel và đổ vào danh sách tạm"

            >

              Import XLSX

            </button>

            <button

              type="button"

              onClick={toggleAddForm}

              className="px-3 py-1 rounded border bg-white hover:bg-gray-50"

              data-tooltip="Thêm thủ công một dòng gán MST"

            >

              {showAddForm ? "Đóng thêm mới" : "Thêm mới"}

            </button>

            {selectedFileName && (

              <span className="text-sm text-gray-600">Đã chọn: {selectedFileName}</span>

            )}

          </>

        )}



        {canEdit && (

          <input

            type="date"

            value={applyFrom}

            onChange={(e) => setApplyFrom(e.target.value)}

            className="border rounded px-2 py-1"

            placeholder="Áp dụng từ ngày"

            data-tooltip="Áp dụng từ ngày (ghi vào trường trống khi import)"

          />

        )}



        <span className="text-xs text-gray-500 whitespace-nowrap">

          * Khi lưu, quy tắc mới chỉ áp dụng cho tờ khai có ngày khai báo từ ngày này trở đi.

        </span>



        <div className="flex-1" />



        <div className="flex flex-wrap items-center gap-2">

          <input

            type="text"

            value={search}

            onChange={(e) => {

              setSearch(e.target.value);

              setPageRef.current(1);

            }}

            placeholder="Tìm nhanh (MST / Công ty)"

            className="border rounded px-2 py-1 w-64"

            data-tooltip="Tìm nhanh theo mã số thuế hoặc tên công ty"

          />

          <button

            type="button"

            onClick={() => exportRowsToExcel("filtered")}

            className="px-3 py-1 rounded border bg-white hover:bg-gray-50"

            data-tooltip="Xuất ra Excel các dòng đang hiển thị theo bộ lọc hiện tại"

          >

            Export (lọc)

          </button>

          <button

            type="button"

            onClick={() => exportRowsToExcel("all")}

            className="px-3 py-1 rounded border bg-white hover:bg-gray-50"

            data-tooltip="Xuất ra Excel toàn bộ danh sách đang quản lý"

          >

            Export (tất cả)

          </button>

          {canEdit && (

            <button

              onClick={onSave}

              className="px-3 py-1 rounded bg-emerald-600 text-white"

              data-tooltip="Lưu danh sách đang hiển thị vào hệ thống"

            >

              Lưu

            </button>

          )}

        </div>

      </div>



      <div className="mb-4 rounded border border-gray-200 bg-white p-4 shadow-sm">

        <div className="flex flex-wrap items-center gap-3">

          <span className="text-sm font-medium text-gray-700">Lọc theo nhân viên phụ trách</span>

          <div className="w-64">

            <StaffCombobox

              value={staffFilter}

              teamValue=""

              onSelect={handleStaffFilterSelect}

              teams={rosterTeams}

              placeholder="Chọn nhân viên"

            />

          </div>

          {staffFilter ? (

            <button

              type="button"

              onClick={clearStaffFilter}

              className="px-2 py-1 rounded border bg-white hover:bg-gray-50"

            >

              Xóa lọc

            </button>

          ) : null}

          <button

            type="button"

            onClick={handleSaveStaffFavorite}

            className="px-2 py-1 rounded bg-slate-800 text-white hover:bg-slate-900"

            disabled={!staffFilter.trim()}

          >

            Lưu bộ lọc nhân viên

          </button>

        </div>

        {quickFavorites.staff.length ? (

          <div className="mt-3">

            <div className="text-xs font-semibold uppercase text-gray-500 mb-1">

              Bộ lọc nhanh

            </div>

            <div className="flex flex-wrap gap-2">

              {quickFavorites.staff.map((fav) => (

                <div

                  key={`staff-${fav.normalized}`}

                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"

                >

                  <button

                    type="button"

                    onClick={() => applyStaffFavorite(fav.value)}

                    className="font-medium hover:text-slate-900"

                  >

                    {fav.value}

                  </button>

                  <button

                    type="button"

                    onClick={() => removeQuickFavorite("staff", fav.value)}

                    className="text-xs text-slate-500 hover:text-slate-700"

                    aria-label={`Xóa ${fav.value}`}

                  >

                    ×

                  </button>

                </div>

              ))}

            </div>

          </div>

        ) : null}

      </div>



      <div className="mb-4 rounded border border-sky-200 bg-sky-50 p-4 text-sm text-gray-700">

        <div className="flex flex-wrap items-end gap-3">

          <label className="flex flex-col gap-1">

            <span className="font-medium">Từ ngày</span>

            <input

              type="date"

              value={historyFilter.from}

              onChange={(e) => updateHistoryFilter({ from: e.target.value })}

              className="border rounded px-2 py-1"

              data-tooltip="Giới hạn lịch sử từ ngày này trở đi"

            />

          </label>

          <label className="flex flex-col gap-1">

            <span className="font-medium">Đến ngày</span>

            <input

              type="date"

              value={historyFilter.to}

              onChange={(e) => updateHistoryFilter({ to: e.target.value })}

              className="border rounded px-2 py-1"

              data-tooltip="Giới hạn lịch sử tới hết ngày này"

            />

          </label>

          <label className="flex flex-col gap-1">

            <span className="font-medium">Thao tác</span>

            <select

              value={historyFilter.type}

              onChange={(e) => updateHistoryFilter({ type: e.target.value })}

              className="border rounded px-2 py-1"

              data-tooltip="Lọc theo thao tác thêm/sửa/xóa"

            >

              <option value="all">Tất cả</option>

              <option value="create">Thêm mới</option>

              <option value="update">Chỉnh sửa</option>

              <option value="delete">Xóa</option>

            </select>

          </label>

          <button

            type="button"

            onClick={resetHistoryFilter}

            className="px-3 py-1 rounded border bg-white hover:bg-gray-50"

            data-tooltip="Xóa bộ lọc lịch sử"

          >

            Xóa lọc

          </button>

          <button

            type="button"

            onClick={handleSaveActionFavorite}

            className="px-3 py-1 rounded border bg-white hover:bg-gray-50"

            data-tooltip="Lưu nhanh bộ lọc thao tác hiện tại"

          >

            Lưu thao tác

          </button>

          <div className="flex-1" />

          <div className="text-right text-xs text-gray-600">

            <div>

              Hiển thị {filteredHistoryCount} / {totalHistoryCount} bản ghi lịch sử.

            </div>

            <div>Áp dụng cho phần lịch sử của từng dòng bên dưới.</div>

            {isHistoryFilterActive ? (

              <div className="text-amber-600">

                * Danh sách MST cũng đang lọc theo điều kiện lịch sử này.

              </div>

            ) : null}

          </div>

        </div>

        {quickFavorites.action.length ? (

          <div className="mt-3">

            <div className="text-xs font-semibold uppercase text-gray-500 mb-1">

              Thao tác đã lưu

            </div>

            <div className="flex flex-wrap gap-2">

              {quickFavorites.action.map((fav) => (

                <div

                  key={`action-${fav.normalized}`}

                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-700"

                >

                  <button

                    type="button"

                    onClick={() => applyActionFavorite(fav.value)}

                    className="font-medium hover:text-amber-900"

                  >

                    {fav.value}

                  </button>

                  <button

                    type="button"

                    onClick={() => removeQuickFavorite("action", fav.value)}

                    className="text-xs text-amber-600 hover:text-amber-800"

                    aria-label={`Xóa ${fav.value}`}

                  >

                    ×

                  </button>

                </div>

              ))}

            </div>

          </div>

        ) : null}

      </div>



      {showAddForm && (

        <form

          onSubmit={handleAddSubmit}

          className="mb-4 rounded border border-gray-200 bg-white p-4 shadow-sm"

        >

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">

            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">

              Mã số thuế

              <input

                type="text"

                value={draft.mst}

                onChange={handleDraftChange("mst", tidyMST)}

                className="border rounded px-2 py-1"

                placeholder="Nhập mã số thuế"

                required

                data-tooltip="Nhập mã số thuế (chỉ chứa số)"

              />

            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">

              Tên công ty

              <input

                type="text"

                value={draft.company}

                onChange={handleDraftChange("company")}

                className="border rounded px-2 py-1"

                placeholder="Tên công ty"

                data-tooltip="Tên doanh nghiệp tương ứng với MST"

              />

            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">

              Người phụ trách Nhập

              <StaffCombobox

                value={draft.person_import}

                teamValue={draft.team}

                teams={rosterTeams}

                placeholder="Chọn nhân viên nhập"

                onSelect={({ staffName, teamName, isCustom }) => {

                  setDraft((prev) => {

                    const next = { ...prev, person_import: staffName || "" };

                    if (staffName && teamName && !isCustom) {

                      const prevTeamKey = normalizeName(normalizeStr(prev.team || ""));

                      const nextTeamKey = normalizeName(normalizeStr(teamName));

                      if (!prevTeamKey || prevTeamKey === nextTeamKey) {

                        next.team = teamName;

                      }

                    }

                    return next;

                  });

                }}

              />

            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">

              Người phụ trách Xuất

              <StaffCombobox

                value={draft.person_export}

                teamValue={draft.team}

                teams={rosterTeams}

                placeholder="Chọn nhân viên xuất"

                onSelect={({ staffName, teamName, isCustom }) => {

                  setDraft((prev) => {

                    const next = { ...prev, person_export: staffName || "" };

                    if (staffName && teamName && !isCustom) {

                      const prevTeamKey = normalizeName(normalizeStr(prev.team || ""));

                      const nextTeamKey = normalizeName(normalizeStr(teamName));

                      if (!prevTeamKey || prevTeamKey === nextTeamKey) {

                        next.team = teamName;

                      }

                    }

                    return next;

                  });

                }}

              />

            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">

              Tổ đội (tuỳ chọn)

              <input

                type="text"

                value={draft.team}

                onChange={handleDraftChange("team")}

                className="border rounded px-2 py-1"

                placeholder="Tên tổ đội"

                data-tooltip="Ghi chú tổ đội/nhóm phụ trách nếu cần"

              />

            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">

              Áp dụng từ ngày

              <input

                type="date"

                value={draft.effective_from}

                onChange={handleDraftChange("effective_from")}

                className="border rounded px-2 py-1"

                data-tooltip="Ngày bắt đầu áp dụng cấu hình"

              />

            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">

              Đến hết ngày (tuỳ chọn)

              <input

                type="date"

                value={draft.effective_to}

                onChange={handleDraftChange("effective_to")}

                className="border rounded px-2 py-1"

                data-tooltip="Ngày kết thúc hiệu lực. Để trống nếu áp dụng vô thời hạn."

              />

            </label>

          </div>

          {addError && <p className="mt-2 text-sm text-red-600">{addError}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-2">

            <button

              type="submit"

              className="px-3 py-1.5 rounded bg-emerald-600 text-white"

              data-tooltip="Thêm dòng này vào danh sách tạm"

            >

              Thêm vào danh sách

            </button>

            <button

              type="button"

              onClick={() => {

                setShowAddForm(false);

                setAddError("");

              }}

              className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50"

              data-tooltip="Đóng biểu mẫu thêm mới"

            >

              Hủy

            </button>

            <span className="text-xs text-gray-500">

              * Sau khi thêm, bấm Lưu để ghi dữ liệu vào hệ thống chính thức.

            </span>

          </div>

        </form>

      )}



      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">

        <div className="flex flex-wrap items-center gap-2">

          <span>

            {filtered.length} dòng — Trang {page}/{totalPages}

          </span>

          {recentlyImportedCount ? (

            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-amber-700">

              <span className="text-xs font-semibold uppercase">Ưu tiên</span>

              <span>

                {recentlyImportedCount} dòng mới import đang hiển thị đầu danh sách

              </span>

            </span>

          ) : null}

        </div>

        <Popover open={columnMenuOpen} onOpenChange={setColumnMenuOpen}>

          <PopoverTrigger asChild>

            <Button type="button" variant="outline" size="sm" className="gap-2">

              <ChevronsUpDown className="size-4" />

              Cột hiển thị ({visibleColumnKeys.length})

            </Button>

          </PopoverTrigger>

          <PopoverContent className="w-64 p-3" align="end">

            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">

              Tùy chọn hiển thị

            </div>

            <div className="mt-2 flex flex-col gap-2">

              {COLUMN_OPTIONS.map((option) => {

                const checked = isColumnVisible(option.key);

                return (

                  <label key={option.key} className="flex items-center gap-2 text-sm text-gray-700">

                    <input

                      type="checkbox"

                      className="size-4"

                      checked={checked}

                      disabled={option.required}

                      onChange={() => toggleColumnVisibility(option.key)}

                    />

                    <span className="flex-1 truncate">{option.label}</span>

                    {option.required ? (

                      <span className="text-xs text-gray-400">Bắt buộc</span>

                    ) : null}

                  </label>

                );

              })}

            </div>

            <Button

              type="button"

              variant="ghost"

              size="sm"

              className="mt-3 justify-start text-amber-700 hover:text-amber-800"

              onClick={handleResetColumnWidths}

            >

              Đặt lại chiều rộng

            </Button>

            <p className="mt-3 text-xs text-gray-500">

              * Kéo tay cầm bên phải tiêu đề cột để điều chỉnh chiều rộng. Nếu nội dung vượt màn hình, hãy cuộn ngang bảng.

            </p>

          </PopoverContent>

        </Popover>

      </div>



      <div className="border rounded overflow-x-auto">

        <table className="min-w-max table-auto text-sm">

          <thead className="bg-gray-50">

            <tr>

              {isColumnVisible("mst") ? (

                <th

                  className="group relative p-2 text-left whitespace-nowrap align-bottom"

                  data-column-key="mst"

                  style={columnStyleMap.mst}

                  scope="col"

                >

                  <div className="pr-4 font-semibold">MST</div>

                  <ColumnResizeHandle

                    columnKey="mst"

                    onResizeStart={handleColumnResizeStart}

                  />

                </th>

              ) : null}

              {isColumnVisible("company") ? (

                <th

                  className="group relative p-2 text-left align-bottom"

                  data-column-key="company"

                  style={columnStyleMap.company}

                  scope="col"

                >

                  <div className="pr-4 font-semibold">Công ty</div>

                  <ColumnResizeHandle

                    columnKey="company"

                    onResizeStart={handleColumnResizeStart}

                  />

                </th>

              ) : null}

              {isColumnVisible("person_import") ? (

                <th

                  className="group relative p-2 text-left align-bottom"

                  data-column-key="person_import"

                  style={columnStyleMap.person_import}

                  scope="col"

                >

                  <div className="pr-4">

                    <PersonColumnHeader columnKey="person_import" />

                  </div>

                  <ColumnResizeHandle

                    columnKey="person_import"

                    onResizeStart={handleColumnResizeStart}

                  />

                </th>

              ) : null}

              {isColumnVisible("person_export") ? (

                <th

                  className="group relative p-2 text-left align-bottom"

                  data-column-key="person_export"

                  style={columnStyleMap.person_export}

                  scope="col"

                >

                  <div className="pr-4">

                    <PersonColumnHeader columnKey="person_export" />

                  </div>

                  <ColumnResizeHandle

                    columnKey="person_export"

                    onResizeStart={handleColumnResizeStart}

                  />

                </th>

              ) : null}

              {isColumnVisible("status") ? (

                <th

                  className="group relative p-2 text-left whitespace-nowrap align-bottom"

                  data-column-key="status"

                  style={columnStyleMap.status}

                  scope="col"

                >

                  <div className="pr-4 font-semibold">Trạng thái</div>

                  <ColumnResizeHandle

                    columnKey="status"

                    onResizeStart={handleColumnResizeStart}

                  />

                </th>

              ) : null}

              {isColumnVisible("effective_from") ? (

                <th

                  className="group relative p-2 text-left whitespace-nowrap align-bottom"

                  data-column-key="effective_from"

                  style={columnStyleMap.effective_from}

                  scope="col"

                >

                  <div className="pr-4 font-semibold">Áp dụng từ ngày</div>

                  <ColumnResizeHandle

                    columnKey="effective_from"

                    onResizeStart={handleColumnResizeStart}

                  />

                </th>

              ) : null}

              {isColumnVisible("effective_to") ? (

                <th

                  className="group relative p-2 text-left whitespace-nowrap align-bottom"

                  data-column-key="effective_to"

                  style={columnStyleMap.effective_to}

                  scope="col"

                >

                  <div className="pr-4 font-semibold">Đến hết ngày</div>

                  <ColumnResizeHandle

                    columnKey="effective_to"

                    onResizeStart={handleColumnResizeStart}

                  />

                </th>

              ) : null}

              {isColumnVisible("actions") ? (

                <th

                  className="group relative p-2 text-center whitespace-nowrap align-bottom"

                  data-column-key="actions"

                  style={columnStyleMap.actions}

                  scope="col"

                >

                  <div className="pr-4 font-semibold text-center">Hành động</div>

                  <ColumnResizeHandle

                    columnKey="actions"

                    onResizeStart={handleColumnResizeStart}

                  />

                </th>

              ) : null}

            </tr>

          </thead>

          <tbody>

            {pageRows.length === 0 ? (

              <tr>

                <td className="p-3 text-center text-gray-500" colSpan={visibleColumnKeys.length}>

                  Chưa có dữ liệu

                </td>

              </tr>

            ) : (

              pageRows.map((r) => {

                const rowKey = makeRowKey(r);

                const rowHistory = historyIndex.get(rowKey) || {};

                const importHistory = rowHistory.person_import || [];

                const exportHistory = rowHistory.person_export || [];

                const effectiveHistory = rowHistory.effective_from || [];

                const effectiveToHistory = rowHistory.effective_to || [];

                const statusValue = normalizeStatusLabel(r.status);

                const statusDisplay = computeStatusDisplay(r);

                const normalizedStatusDisplay = statusDisplay || "";

                const isStatusAssigned = normalizedStatusDisplay === MST_ASSIGNMENT_STATUS.ASSIGNED;

                const isStatusPending =

                  normalizedStatusDisplay === MST_ASSIGNMENT_STATUS.PENDING ||

                  normalizedStatusDisplay === normalizeStatusLabel(MST_ASSIGNMENT_STATUS.PENDING);

                const isStatusWarning = normalizedStatusDisplay.startsWith("Thiếu");

                const isNewlyImported = recentlyImportedKeys.has(rowKey);

                const isDirty = rowHasChanges(r);

                const updateDisabled = !canEdit || !isDirty;

                const updateLabel = r.__originalKey ? "Cập nhật" : "Lưu mới";

                const timelineGroup = timelineGroupsByMST.get(r.mst || "__unknown");

                const timelineStages = Array.isArray(timelineGroup?.stages)
                  ? timelineGroup.stages
                  : [];

                const timelineCompany = timelineGroup?.company || r.company || "";

                const timelineMST = timelineGroup?.mst || r.mst || "";

                const timelineGroupWithFallback =
                  timelineGroup || {
                    mst: timelineMST,
                    company: timelineCompany,
                    stages: timelineStages,
                  };

                const actionsColumnVisible = isColumnVisible("actions");

                const statusColumnVisible = isColumnVisible("status");

                const showTimelineInStatus = statusColumnVisible && !actionsColumnVisible;

                return (

                  <tr

                    key={rowKey || r.mst}

                    className={`border-t ${isNewlyImported ? "bg-amber-50" : ""}`}

                  >



                    {isColumnVisible("mst") ? (

                      <td

                        className="p-2 align-top whitespace-nowrap"

                        style={columnStyleMap.mst}

                        data-column-key="mst"

                      >

                        {isReadOnly ? (

                          <span>{r.mst}</span>

                        ) : (

                          <input

                            value={r.mst}

                            onChange={(e) =>

                              updateRow(r, { mst: tidyMST(e.target.value) })

                            }

                            className="border rounded px-2 py-1 w-full"

                          />

                        )}

                        {isNewlyImported ? (

                          <span className="ml-2 inline-flex items-center rounded bg-amber-500/10 px-2 py-0.5 text-xs font-semibold uppercase text-amber-700">

                            Mới import

                          </span>

                        ) : null}

                        {isDirty ? (

                          <span className="ml-2 inline-flex items-center rounded bg-blue-500/10 px-2 py-0.5 text-xs font-semibold uppercase text-blue-700">

                            Đã chỉnh sửa

                          </span>

                        ) : null}

                      </td>

                    ) : null}

                    
                    {isColumnVisible("company") ? (
                      <td
                        className="p-2 align-top"
                        style={columnStyleMap.company}
                        data-column-key="company"
                      >
                        <CompanyNameCell
                          value={r.company || ""}
                          isReadOnly={isReadOnly}
                          onChange={(nextValue) => updateRow(r, { company: nextValue })}
                        />
                      </td>
                    ) : null}


                    {isColumnVisible("person_import") ? (

                      <td

                        className="p-2 align-top"

                        style={columnStyleMap.person_import}

                        data-column-key="person_import"

                      >

                        <AssigneeCell

                          value={r.person_import || ""}

                          placeholder="Chọn nhân viên nhập"

                          isReadOnly={isReadOnly}

                          teams={rosterTeams}

                          teamValue={r.team || ""}

                          onSelect={({ staffName, teamName, isCustom }) => {

                            const patch = { person_import: staffName || "" };

                            if (staffName && teamName && !isCustom) {

                              const prevTeamKey = normalizeName(normalizeStr(r.team || ""));

                              const nextTeamKey = normalizeName(normalizeStr(teamName));

                              if (!prevTeamKey || prevTeamKey === nextTeamKey) {

                                patch.team = teamName;

                              }

                            }

                            updateRow(r, patch);

                          }}

                          historyEntries={importHistory}

                          historyLabel={HISTORY_FIELD_LABELS.person_import}

                          showTeamHint

                        />

                      </td>

                    ) : null}


                    {isColumnVisible("person_export") ? (

                      <td

                        className="p-2 align-top"

                        style={columnStyleMap.person_export}

                        data-column-key="person_export"

                      >

                        <AssigneeCell

                          value={r.person_export || ""}

                          placeholder="Chọn nhân viên xuất"

                          isReadOnly={isReadOnly}

                          teams={rosterTeams}

                          teamValue={r.team || ""}

                          onSelect={({ staffName, teamName, isCustom }) => {

                            const patch = { person_export: staffName || "" };

                            if (staffName && teamName && !isCustom) {

                              const prevTeamKey = normalizeName(normalizeStr(r.team || ""));

                              const nextTeamKey = normalizeName(normalizeStr(teamName));

                              if (!prevTeamKey || prevTeamKey === nextTeamKey) {

                                patch.team = teamName;

                              }

                            }

                            updateRow(r, patch);

                          }}

                          historyEntries={exportHistory}

                          historyLabel={HISTORY_FIELD_LABELS.person_export}

                        />

                      </td>

                    ) : null}


                    {statusColumnVisible ? (

                      <td

                        className="p-2 align-top whitespace-nowrap"

                        style={columnStyleMap.status}

                        data-column-key="status"

                      >

                        {statusDisplay ? (

                          <span

                            className={`inline-flex items-center rounded px-2 py-1 text-xs font-semibold ${

                              isStatusAssigned

                                ? "bg-emerald-50 text-emerald-700"

                                : isStatusWarning

                                  ? "bg-amber-50 text-amber-700"

                                  : "bg-slate-100 text-slate-700"

                            }`}

                          >

                            {statusDisplay}

                          </span>

                        ) : (

                          <span className="italic text-gray-400">Chưa thiết lập</span>

                        )}

                        {!isStatusAssigned && !isStatusWarning && !isStatusPending ? (

                          <div className="mt-1 text-xs text-gray-500">{statusValue}</div>

                        ) : null}

                        {showTimelineInStatus ? (

                          <StageTimelinePreview

                            stages={timelineStages}

                            onViewFull={

                              timelineStages.length

                                ? () => handleOpenTimelineGroup(timelineGroupWithFallback)

                                : undefined

                            }

                          />

                        ) : null}

                      </td>

                    ) : null}

                    {isColumnVisible("effective_from") ? (

                      <td

                        className="p-2 align-top whitespace-nowrap"

                        style={columnStyleMap.effective_from}

                        data-column-key="effective_from"

                      >

                        {isReadOnly ? (

                          <span>{r.effective_from || ""}</span>

                        ) : (

                          <input

                            type="date"

                            value={r.effective_from || ""}

                            onChange={(e) =>

                              updateRow(r, { effective_from: e.target.value })

                            }

                            className="border rounded px-2 py-1 w-full"

                          />

                        )}

                        <HistoryDetails

                          entries={effectiveHistory}

                          label={HISTORY_FIELD_LABELS.effective_from}

                        />

                      </td>

                    ) : null}

                    {isColumnVisible("effective_to") ? (

                      <td

                        className="p-2 align-top whitespace-nowrap"

                        style={columnStyleMap.effective_to}

                        data-column-key="effective_to"

                      >

                        {isReadOnly ? (

                          <span>{r.effective_to || ""}</span>

                        ) : (

                          <input

                            type="date"

                            value={r.effective_to || ""}

                            onChange={(e) => updateRow(r, { effective_to: e.target.value })}

                            className="border rounded px-2 py-1 w-full"

                          />

                        )}

                        <HistoryDetails

                          entries={effectiveToHistory}

                          label={HISTORY_FIELD_LABELS.effective_to}

                        />

                      </td>

                    ) : null}

                    {actionsColumnVisible ? (

                      <td

                        className="p-2 align-top text-center whitespace-nowrap"

                        style={columnStyleMap.actions}

                        data-column-key="actions"

                      >

                        <div className="flex flex-col gap-3">

                          {canEdit ? (

                            <div className="flex flex-col gap-2">

                              <button

                                type="button"

                                onClick={() => startNewStageFromRow(r)}

                                className="px-2 py-1 rounded border bg-white text-gray-700 hover:bg-gray-50"

                                data-tooltip="Sao chép thông tin hiện tại để thêm giai đoạn kế tiếp"

                              >

                                Giai đoạn mới

                              </button>

                              <button

                                type="button"

                                onClick={() => commitRow(r)}

                                disabled={updateDisabled}

                                className={`px-2 py-1 rounded text-white ${

                                  updateDisabled

                                    ? "bg-gray-400 cursor-not-allowed"

                                    : "bg-emerald-600 hover:bg-emerald-700"

                                }`}

                                data-tooltip={

                                  updateDisabled

                                    ? "Không có thay đổi mới"

                                    : "Lưu các thay đổi vừa chỉnh"

                                }

                              >

                                {updateLabel}

                              </button>

                              <button

                                onClick={() => removeRow(r)}

                                className="px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600"

                                data-tooltip="Xóa dòng"

                              >

                                Xóa

                              </button>

                            </div>

                          ) : (

                            <span className="text-xs text-gray-400">—</span>

                          )}

                          <StageTimelinePreview

                            stages={timelineStages}

                            onViewFull={

                              timelineStages.length

                                ? () => handleOpenTimelineGroup(timelineGroupWithFallback)

                                : undefined

                            }

                          />

                        </div>

                      </td>

                    ) : null}



                </tr>

              );

            })

            )}

          </tbody>

        </table>

      </div>



      <div className="mt-6 rounded border border-slate-200 bg-slate-50 px-3 py-2">

        <div className="flex flex-wrap items-center justify-between gap-2">

          <div>

            <h2 className="text-sm font-semibold text-slate-700">

              Dòng thời gian giai đoạn

            </h2>

            <p className="text-xs text-slate-500">

              Xem tổng hợp theo bộ lọc hiện tại.

            </p>

          </div>

          <Button

            type="button"

            variant="outline"

            size="sm"

            onClick={handleOpenAllTimelines}

            disabled={!groupedStages.length}

          >

            Mở tổng hợp ({groupedStages.length})

          </Button>

        </div>

      </div>

      {/* Pagination */}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">

        <PageSizeControl value={pageSize} onChange={setPageSize} />

        <div className="flex items-center gap-2">

          <button

            disabled={page <= 1}

            onClick={previousPage}

            className={`px-3 py-1 rounded border ${

              page <= 1 ? "opacity-50 cursor-not-allowed" : ""

            }`}

          >

            ← Trước

          </button>

          <span className="text-sm">

            Trang {page}/{totalPages}

          </span>

          <button

            disabled={page >= totalPages}

            onClick={nextPage}

            className={`px-3 py-1 rounded border ${

              page >= totalPages ? "opacity-50 cursor-not-allowed" : ""

            }`}

          >

            Sau →

          </button>

        </div>

      </div>

      <Dialog

        open={timelineDialogState.open}

        onOpenChange={handleTimelineDialogOpenChange}

      >

        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">

          <DialogHeader>

            <DialogTitle>{timelineDialogState.title || "Dòng thời gian giai đoạn"}</DialogTitle>

            {timelineDialogState.subtitle ? (

              <DialogDescription>{timelineDialogState.subtitle}</DialogDescription>

            ) : null}

          </DialogHeader>

          <div className="max-h-[60vh] overflow-auto pr-1">

            <StageTimelineGroups groups={timelineDialogState.groups} />

          </div>

        </DialogContent>

      </Dialog>

    </div>

  );

}

