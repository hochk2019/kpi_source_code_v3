import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import clsx from "clsx";
import * as XLSX from "xlsx";

import {
  getMSTMap,

  MST_ASSIGNMENT_STATUS,

  getTeamRoster,

  subscribeTeamRoster,

  normalizeStr,

  normalizeName,

} from "@/lib/store.js";

import useTooltipTitles from "@/hooks/useTooltipTitles.js";

import usePagination from "@/hooks/usePagination.js";

import useMSTQuickFilters from "@/hooks/useMSTQuickFilters.js";
import SharedStaffCombobox, {
  buildStaffComboboxTeams,
} from "@/components/shared/StaffCombobox.jsx";
import MstAssignmentAddFormPanel from "@/components/mst-assignment/forms/MstAssignmentAddFormPanel.jsx";
import MstAssignmentHistoryFilterPanel from "@/components/mst-assignment/filters/MstAssignmentHistoryFilterPanel.jsx";
import MstAssignmentStaffFilterPanel from "@/components/mst-assignment/filters/MstAssignmentStaffFilterPanel.jsx";
import { useMSTAssignmentColumnLayout } from "@/components/mst-assignment/hooks/useMSTAssignmentColumnLayout.js";
import useMSTAssignmentPageSize, {
  MIN_PAGE_SIZE,
  normalizePageSize,
  PAGE_SIZE_OPTIONS,
} from "@/components/mst-assignment/hooks/useMSTAssignmentPageSize.js";
import useMSTAssignmentAddFormWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentAddFormWorkspace.js";
import useMSTAssignmentHistoryWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentHistoryWorkspace.js";
import useMSTAssignmentImportSaveWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentImportSaveWorkspace.js";
import useMSTAssignmentRowCommitWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentRowCommitWorkspace.js";
import useMSTAssignmentRowMutations from "@/components/mst-assignment/hooks/useMSTAssignmentRowMutations.js";
import useMSTAssignmentTimelineWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentTimelineWorkspace.js";
import {
  buildAggregatedRowsByMST,
  buildDisplayList,
  buildGroupedStages,
  sortMSTRows,
} from "@/components/mst-assignment/model/displaySelectors.js";
import HistoryDetails from "@/components/mst-assignment/timeline/HistoryDetails.jsx";
import MstAssignmentTimelinePanel from "@/components/mst-assignment/timeline/MstAssignmentTimelinePanel.jsx";
import MstAssignmentDataTablePanel from "@/components/mst-assignment/table/MstAssignmentDataTablePanel.jsx";

import {
  SearchField,
  SectionHeader,
  SectionSurface,
  SectionToolbar,
} from "@/components/designSystem/shellPrimitives.jsx";

import {

  Command,

  CommandEmpty,

  CommandItem,

} from "@/components/ui/command.jsx";

import { LogIn, LogOut } from "lucide-react";



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



const buildRosterTeams = buildStaffComboboxTeams;

const StaffCombobox = (props) => (
  <SharedStaffCombobox
    {...props}
    allowCustom
    preserveTeamOnCustom
    preserveTeamOnClear
  />
);



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



const HISTORY_FIELD_LABELS = {

  person_import: "Người phụ trách Nhập",

  person_export: "Người phụ trách Xuất",

  effective_from: "Áp dụng từ ngày",

  effective_to: "Đến hết ngày",

};



const makeRowKey = (row) => {

  if (!row) return "";

  return `${row.mst || ""}__${row.effective_from || ""}__${row.effective_to || ""}`;

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



export function CompanyNameCell({ value, isReadOnly, onChange, placeholder = "Tên công ty" }) {
  const safeValue = value == null ? "" : value.toString();
  const trimmedValue = safeValue.trim();
  const shouldWrap = shouldWrapCompanyName(safeValue);
  const textareaRef = useRef(null);

  const adjustTextareaHeight = useCallback(
    (element, nextValue) => {
      const target = element || textareaRef.current;
      if (!target) {
        return;
      }

      const measuredValue = nextValue ?? safeValue;
      const wrapCandidate = shouldWrapCompanyName(measuredValue);
      const baseMinHeight = wrapCandidate ? 40 : 36;

      target.style.minHeight = `${baseMinHeight}px`;
      target.style.height = "auto";
      const nextHeight = Math.max(target.scrollHeight, baseMinHeight);
      target.style.height = `${nextHeight}px`;
    },
    [safeValue]
  );

  useEffect(() => {
    adjustTextareaHeight();
  }, [safeValue, adjustTextareaHeight]);

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
    adjustTextareaHeight(event.target, sanitizedValue);
    if (!onChange) {
      return;
    }

    if (sanitizedValue !== safeValue || event.target.value !== safeValue) {
      onChange(sanitizedValue);
    }
  };

  return (
    <textarea
      ref={textareaRef}
      value={safeValue}
      onChange={handleChange}
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
      <HistoryDetails
        entries={historyEntries}
        label={historyLabel}
        formatTimestamp={formatHistoryTime}
      />
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
  const [groupByMST, setGroupByMST] = useState(true);

  const [search, setSearch] = useState("");

  const [staffFilter, setStaffFilter] = useState("");

  const [applyFrom, setApplyFrom] = useState(""); // yyyy-mm-dd
  const actor = currentUser?.username || "guest";
  const { initialPageSize, persistPageSize } = useMSTAssignmentPageSize();
  const {
    columnMenuOpen,
    columnStyleMap,
    handleColumnResizeStart,
    handleResetColumnWidths,
    isColumnVisible,
    setColumnMenuOpen,
    toggleColumnVisibility,
    visibleColumnKeys,
  } = useMSTAssignmentColumnLayout({ actor });

  const rootRef = useRef(null);

  const setPageRef = useRef(() => {});

  const [rosterSnapshot, setRosterSnapshot] = useState(() => getTeamRoster());

  const rosterTeams = useMemo(() => buildRosterTeams(rosterSnapshot), [rosterSnapshot]);

  const [recentlyImportedKeys, setRecentlyImportedKeys] = useState(() => new Set());

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

  const isReadOnly = !canEdit;

  const {

    favorites: quickFavorites,

    addFavorite: addQuickFavorite,

    removeFavorite: removeQuickFavorite,

    clearType: _clearQuickFavorite,

  } = useMSTQuickFilters();

  const {
    activeStatusFilter,
    applyActionFavorite,
    filteredHistoryCount,
    handleSaveActionFavorite,
    historyFilter,
    historyFilteredRowKeys,
    historyIndex,
    isHistoryFilterActive,
    refreshHistory,
    resetHistoryFilter,
    totalHistoryCount,
    updateHistoryFilter,
  } = useMSTAssignmentHistoryWorkspace({
    addQuickFavorite,
    goToFirstPage: () => setPageRef.current(1),
  });

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
  const buildStatusViewModel = useCallback((row) => {
    const statusValue = normalizeStatusLabel(row?.status);
    const statusDisplay = computeStatusDisplay(row);
    const normalizedStatusDisplay = statusDisplay || "";

    return {
      statusValue,
      statusDisplay,
      isStatusAssigned: normalizedStatusDisplay === MST_ASSIGNMENT_STATUS.ASSIGNED,
      isStatusPending:
        normalizedStatusDisplay === MST_ASSIGNMENT_STATUS.PENDING ||
        normalizedStatusDisplay === normalizeStatusLabel(MST_ASSIGNMENT_STATUS.PENDING),
      isStatusWarning: normalizedStatusDisplay.startsWith("Thiếu"),
    };
  }, []);
  const { rowHasChanges, commitRow } = useMSTAssignmentRowCommitWorkspace({
    actor,
    createRowState,
    isReadOnly,
    makeRowKey,
    normalizeStatusLabel,
    normalizeStr,
    originalRows,
    refreshHistory,
    setOriginalRows,
    setRecentlyImportedKeys,
    setRows,
    tidyMST,
  });

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

      if (historyFilteredRowKeys) {

        const key = makeRowKey(row);

        if (!historyFilteredRowKeys.has(key)) {

          return false;

        }

      }

      if (activeStatusFilter) {

        const hasImport = Boolean(normalizeStr(row.person_import || ""));

        const hasExport = Boolean(normalizeStr(row.person_export || ""));

        if (

          activeStatusFilter === MST_ASSIGNMENT_STATUS.ASSIGNED &&

          (!hasImport || !hasExport)

        ) {

          return false;

        }

        if (

          activeStatusFilter === MST_ASSIGNMENT_STATUS.PENDING &&

          hasImport &&

          hasExport

        ) {

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

    historyFilteredRowKeys,

    activeStatusFilter,

    recentlyImportedKeys,

  ]);



  const groupedStages = useMemo(() => {
    return buildGroupedStages(filtered);
  }, [filtered]);

  const aggregatedByMST = useMemo(() => {
    return buildAggregatedRowsByMST(groupedStages, groupByMST);
  }, [groupByMST, groupedStages]);

  const displayList = useMemo(
    () => buildDisplayList({ groupByMST, aggregatedByMST, filtered }),
    [groupByMST, aggregatedByMST, filtered]
  );

  const {
    page,
    pageSize,
    pageCount: totalPages,
    currentPageItems: pageRows,
    setPage,
    setPageSize,
    nextPage,
    previousPage,
  } = usePagination(displayList, {
    initialPage: 1,
    initialPageSize,
    minPageSize: MIN_PAGE_SIZE,
  });
  const {
    handleOpenAllTimelines,
    handleOpenTimelineGroup,
    handleTimelineDialogOpenChange,
    timelineDialogState,
    timelineGroupsByMST,
  } = useMSTAssignmentTimelineWorkspace({
    groupedStages,
  });


  useEffect(() => {

    setPageRef.current = setPage;

  }, [setPage]);


  useEffect(() => {

    persistPageSize(pageSize);

  }, [pageSize, persistPageSize]);



  const recentlyImportedCount = recentlyImportedKeys.size;

  const {
    fileRef,
    selectedFileName,
    handleFileChange,
    markRecentlyImported,
    onImportXLSX,
    onSave,
  } = useMSTAssignmentImportSaveWorkspace({
    actor,
    applyFrom,
    helpers: {
      createRowState,
      findCell,
      makeRowKey,
      normalizeStatusLabel,
      tidyMST,
      toISO,
    },
    isReadOnly,
    refreshHistory,
    rows,
    setOriginalRows,
    setRecentlyImportedKeys,
    setRows,
    goToFirstPage: () => setPageRef.current(1),
  });

  const {
    updateRow,
    handleRowImportSelect,
    handleRowExportSelect,
    removeRow,
  } = useMSTAssignmentRowMutations({
    computeStoredStatus,
    helpers: {
      makeRowKey,
      normalizeName,
      normalizeStr,
      tidyMST,
    },
    isReadOnly,
    setRecentlyImportedKeys,
    setRows,
  });

  const {
    showAddForm,
    draft,
    addError,
    toggleAddForm,
    startNewStageFromRow,
    handleDraftChange,
    handleDraftImportSelect,
    handleDraftExportSelect,
    handleCloseAddForm,
    handleAddSubmit,
  } = useMSTAssignmentAddFormWorkspace({
    applyFrom,
    computeStoredStatus,
    createRowState,
    goToFirstPage: () => setPageRef.current(1),
    isReadOnly,
    makeRowKey,
    markRecentlyImported,
    normalizeName,
    normalizeStr,
    rows,
    scrollToTopFn: () =>
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    setRows,
    tidyMST,
  });

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



  /** UI */

  return (

    <div ref={rootRef} className="p-6 max-w-6xl mx-auto">

      {isReadOnly && (

        <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">

          Bạn đang xem bảng gán MST ở chế độ chỉ xem. Đăng nhập bằng tài khoản quản trị hoặc được cấp quyền để import, chỉnh sửa và lưu thay đổi.

        </div>

      )}

      <SectionSurface className="mb-4">
        <SectionHeader
          title="Danh sách gán MST"
          description="Quản lý mapping MST, tìm nhanh theo công ty, rồi xuất hoặc lưu working set hiện tại."
          meta={
            <>
              <span className="ds-pill">{filtered.length} dòng đang hiển thị</span>
              {selectedFileName ? <span className="ds-pill">Đã chọn: {selectedFileName}</span> : null}
            </>
          }
        />
        <SectionToolbar
          className="items-start"
          mainClassName="items-end"
          actionsClassName="items-end"
          actions={
            <>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={groupByMST}
                  onChange={(e) => {
                    setGroupByMST(e.target.checked);
                    setPage(1);
                  }}
                />
                Gom theo MST
              </label>
              <SearchField
                label="Tìm nhanh MST hoặc công ty"
                hideLabel
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPageRef.current(1);
                }}
                onClear={() => {
                  setSearch("");
                  setPageRef.current(1);
                }}
                placeholder="Tìm nhanh (MST / Công ty)"
                className="w-full sm:w-72"
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
              {canEdit ? (
                <button
                  onClick={onSave}
                  className="px-3 py-1 rounded bg-emerald-600 text-white"
                  data-tooltip="Lưu danh sách đang hiển thị vào hệ thống"
                >
                  Lưu
                </button>
              ) : null}
            </>
          }
        >
          {canEdit ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={isReadOnly}
                onChange={handleFileChange}
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
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                <span className="font-medium">Áp dụng từ ngày</span>
                <input
                  type="date"
                  value={applyFrom}
                  onChange={(e) => setApplyFrom(e.target.value)}
                  className="border rounded px-2 py-1"
                  placeholder="Áp dụng từ ngày"
                  data-tooltip="Áp dụng từ ngày (ghi vào trường trống khi import)"
                />
              </label>
            </>
          ) : (
            <p className="text-sm text-gray-600">Xem nhanh danh sách MST, tìm kiếm, gom theo MST và xuất dữ liệu hiện tại.</p>
          )}
        </SectionToolbar>
        {canEdit ? (
          <p className="text-xs text-gray-500">
            * Khi lưu, quy tắc mới chỉ áp dụng cho tờ khai có ngày khai báo từ ngày này trở đi.
          </p>
        ) : null}
      </SectionSurface>

      <MstAssignmentStaffFilterPanel
        quickFavorites={quickFavorites}
        staffFilter={staffFilter}
        rosterTeams={rosterTeams}
        onClearStaffFilter={clearStaffFilter}
        onSaveStaffFavorite={handleSaveStaffFavorite}
        onStaffFilterSelect={handleStaffFilterSelect}
        onApplyStaffFavorite={applyStaffFavorite}
        onRemoveQuickFavorite={removeQuickFavorite}
      />

      <MstAssignmentHistoryFilterPanel
        filteredHistoryCount={filteredHistoryCount}
        totalHistoryCount={totalHistoryCount}
        isHistoryFilterActive={isHistoryFilterActive}
        historyFilter={historyFilter}
        quickFavorites={quickFavorites}
        onResetHistoryFilter={resetHistoryFilter}
        onSaveActionFavorite={handleSaveActionFavorite}
        onHistoryFilterChange={updateHistoryFilter}
        onApplyActionFavorite={applyActionFavorite}
        onRemoveQuickFavorite={removeQuickFavorite}
      />



      {showAddForm ? (
        <MstAssignmentAddFormPanel
          StaffComboboxComponent={StaffCombobox}
          draft={draft}
          addError={addError}
          rosterTeams={rosterTeams}
          onSubmit={handleAddSubmit}
          onMstChange={handleDraftChange("mst", tidyMST)}
          onCompanyChange={handleDraftChange("company")}
          onImportSelect={handleDraftImportSelect}
          onExportSelect={handleDraftExportSelect}
          onTeamChange={handleDraftChange("team")}
          onEffectiveFromChange={handleDraftChange("effective_from")}
          onEffectiveToChange={handleDraftChange("effective_to")}
          onCancel={handleCloseAddForm}
        />
      ) : null}

      <MstAssignmentDataTablePanel
        pageRows={pageRows}
        filteredCount={filtered.length}
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        recentlyImportedCount={recentlyImportedCount}
        recentlyImportedKeys={recentlyImportedKeys}
        canEdit={canEdit}
        isReadOnly={isReadOnly}
        rosterTeams={rosterTeams}
        historyIndex={historyIndex}
        timelineGroupsByMST={timelineGroupsByMST}
        visibleColumnKeys={visibleColumnKeys}
        columnMenuOpen={columnMenuOpen}
        setColumnMenuOpen={setColumnMenuOpen}
        isColumnVisible={isColumnVisible}
        toggleColumnVisibility={toggleColumnVisibility}
        handleResetColumnWidths={handleResetColumnWidths}
        columnStyleMap={columnStyleMap}
        handleColumnResizeStart={handleColumnResizeStart}
        rowHasChanges={rowHasChanges}
        onRowChange={updateRow}
        onPageSizeChange={setPageSize}
        onPreviousPage={previousPage}
        onNextPage={nextPage}
        onMstChange={(row, nextMst) => updateRow(row, { mst: tidyMST(nextMst) })}
        onImportAssigneeSelect={handleRowImportSelect}
        onExportAssigneeSelect={handleRowExportSelect}
        onStartNewStage={startNewStageFromRow}
        onCommitRow={commitRow}
        onRemoveRow={removeRow}
        onOpenTimelineGroup={handleOpenTimelineGroup}
        makeRowKey={makeRowKey}
        formatISODate={formatISODate}
        formatHistoryTime={formatHistoryTime}
        buildStatusViewModel={buildStatusViewModel}
        historyFieldLabels={HISTORY_FIELD_LABELS}
        PageSizeControlComponent={PageSizeControl}
        CompanyNameCellComponent={CompanyNameCell}
        AssigneeCellComponent={AssigneeCell}
        PersonColumnHeaderComponent={PersonColumnHeader}
      >
        <MstAssignmentTimelinePanel
          groupedStages={groupedStages}
          onOpenAllTimelines={handleOpenAllTimelines}
          timelineDialogState={timelineDialogState}
          onTimelineDialogOpenChange={handleTimelineDialogOpenChange}
          formatDate={formatISODate}
          getStageKey={makeRowKey}
        />
      </MstAssignmentDataTablePanel>

    </div>

  );

}



