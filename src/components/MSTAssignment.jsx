import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.jsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command.jsx";
import { Check, ChevronsUpDown, CircleX, Plus } from "lucide-react";

/** Utils */
const normalize = (s = "") =>
  s
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

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
  { key: "actions", label: "Hành động" },
];

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

const DEFAULT_PAGE_SIZE = 50;

const HISTORY_FIELD_LABELS = {
  person_import: "Người phụ trách Nhập",
  person_export: "Người phụ trách Xuất",
  effective_from: "Áp dụng từ ngày",
};

const MST_ROW_FIELDS = [
  "mst",
  "company",
  "person_import",
  "person_export",
  "team",
  "effective_from",
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
      return dateA.localeCompare(dateB);
    });
};

const makeRowKey = (row) => {
  if (!row) return "";
  return `${row.mst || ""}__${row.effective_from || ""}`;
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

export default function MSTAssignment({ canEdit = true, currentUser = null }) {
  const [rows, setRows] = useState([]); // toàn bộ (bao gồm metadata)
  const [originalRows, setOriginalRows] = useState([]);
  const [search, setSearch] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [applyFrom, setApplyFrom] = useState(""); // yyyy-mm-dd
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
  });
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
    });
    setAddError("");
    setShowAddForm(true);
  };

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
    const newRow = {
      mst,
      company: normalizedCompany,
      person_import: normalizedImport,
      person_export: normalizedExport,
      team: normalizedTeam,
      effective_from: normalizedDate,
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
      return (a.effective_from || "").localeCompare(b.effective_from || "");
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
    pageCount: totalPages,
    currentPageItems: pageRows,
    setPage,
    nextPage,
    previousPage,
  } = usePagination(filtered, {
    initialPage: 1,
    initialPageSize: DEFAULT_PAGE_SIZE,
  });

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
    showAddForm,
    selectedFileName,
    historyFilter,
  ]);

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
            status: normalizeStatusLabel(findCell(r, "status")),
          };
        })
        .filter(Boolean);

      if (!mapped.length) {
        alert("Không thấy dữ liệu hợp lệ trong file.");
        return;
      }

      // Gộp với dữ liệu hiện có theo MST + ngày hiệu lực (ưu tiên dữ liệu mới)
      const byKey = new Map();
      for (const r of rows) {
        byKey.set(makeRowKey(r), { ...r });
      }
      for (const r of mapped) {
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
      alert(`Đọc file thành công: ${mapped.length} dòng. Bấm Lưu để ghi.`);
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
    const label = row.effective_from
      ? `${row.mst} (${row.effective_from})`
      : row.mst;
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
            <p className="mt-3 text-xs text-gray-500">
              * Kéo thanh trượt ngang của bảng nếu nội dung vượt quá chiều rộng màn hình.
            </p>
          </PopoverContent>
        </Popover>
      </div>

      <div className="border rounded overflow-x-auto">
        <table className="min-w-max table-auto text-sm">
          <thead className="bg-gray-50">
            <tr>
              {isColumnVisible("mst") ? (
                <th className="p-2 text-left whitespace-nowrap w-32">MST</th>
              ) : null}
              {isColumnVisible("company") ? (
                <th className="p-2 text-left min-w-[18rem]">Công ty</th>
              ) : null}
              {isColumnVisible("person_import") ? (
                <th className="p-2 text-left whitespace-nowrap min-w-[14rem]">
                  Người phụ trách Nhập
                </th>
              ) : null}
              {isColumnVisible("person_export") ? (
                <th className="p-2 text-left whitespace-nowrap min-w-[14rem]">
                  Người phụ trách Xuất
                </th>
              ) : null}
              {isColumnVisible("status") ? (
                <th className="p-2 text-left whitespace-nowrap w-36">Trạng thái</th>
              ) : null}
              {isColumnVisible("effective_from") ? (
                <th className="p-2 text-left whitespace-nowrap w-40">Áp dụng từ ngày</th>
              ) : null}
              {isColumnVisible("actions") ? (
                <th className="p-2 text-center whitespace-nowrap w-36">Hành động</th>
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
                return (
                  <tr
                    key={rowKey || r.mst}
                    className={`border-t ${isNewlyImported ? "bg-amber-50" : ""}`}
                  >

                    {isColumnVisible("mst") ? (
                      <td className="p-2 align-top whitespace-nowrap">
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
                      <td className="p-2 align-top min-w-[18rem]">
                        {isReadOnly ? (
                          r.company ? (
                            <span>{r.company}</span>
                          ) : (
                            <span className="italic text-gray-400">(Không tên)</span>
                          )
                        ) : (
                          <input
                            value={r.company || ""}
                            onChange={(e) =>
                              updateRow(r, { company: e.target.value })
                            }
                            className="border rounded px-2 py-1 w-full"
                            placeholder="Tên công ty"
                          />
                        )}
                      </td>
                    ) : null}
                    {isColumnVisible("person_import") ? (
                      <td className="p-2 align-top whitespace-nowrap min-w-[14rem]">
                        {isReadOnly ? (
                          r.person_import ? (
                            <span>{r.person_import}</span>
                          ) : (
                            <span className="italic text-gray-400">(Chưa chọn)</span>
                          )
                        ) : (
                          <StaffCombobox
                            value={r.person_import || ""}
                            teamValue={r.team || ""}
                            teams={rosterTeams}
                            placeholder="Chọn nhân viên nhập"
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
                          />
                        )}
                        <HistoryDetails
                          entries={importHistory}
                          label={HISTORY_FIELD_LABELS.person_import}
                        />
                      </td>
                    ) : null}
                    {isColumnVisible("person_export") ? (
                      <td className="p-2 align-top whitespace-nowrap min-w-[14rem]">
                        {isReadOnly ? (
                          r.person_export ? (
                            <span>{r.person_export}</span>
                          ) : (
                            <span className="italic text-gray-400">(Chưa chọn)</span>
                          )
                        ) : (
                          <StaffCombobox
                            value={r.person_export || ""}
                            teamValue={r.team || ""}
                            teams={rosterTeams}
                            placeholder="Chọn nhân viên xuất"
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
                          />
                        )}
                        <HistoryDetails
                          entries={exportHistory}
                          label={HISTORY_FIELD_LABELS.person_export}
                        />
                      </td>
                    ) : null}
                    {isColumnVisible("status") ? (
                      <td className="p-2 align-top whitespace-nowrap">
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
                      </td>
                    ) : null}
                    {isColumnVisible("effective_from") ? (
                      <td className="p-2 align-top whitespace-nowrap">
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
                    {isColumnVisible("actions") ? (
                      <td className="p-2 align-top text-center whitespace-nowrap">
                        {canEdit ? (
                          <div className="flex flex-col gap-2">
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
                      </td>
                    ) : null}

                </tr>
              );
            })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3">
        <div />
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
        <div />
      </div>
    </div>
  );
}
