import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import * as XLSX from "xlsx";

import {
  upsertHQAgencies,
  saveHQAgencyRow,
  deleteHQAgencyRow,
  normalizeMST,
  normalizeStr,
  parseAgencyList,
  formatAgencyList,
  getHQHistoryEntries,
  HQ_HISTORY_LIMIT,
} from "@/lib/store.js";

import { refreshHQHistoryCache } from "@/lib/hqHistoryClient.js";

import { FilterSelect } from "@/components/designSystem/primitives.jsx";
import HQAgencyTable from "@/components/hq-agency-manager/HQAgencyTable.jsx";
import {
  PAGE_SIZE,
  STATUS_FILTER_OPTIONS,
  COLUMN_WIDTH_STORAGE_KEY,
  MIN_COLUMN_WIDTHS,
  DEFAULT_COLUMN_WIDTHS,
  clampColumnWidth,
  pickCell,
  sanitizeRowModel,
  cloneDraft,
  createEmptyDraft,
  readDraftsFromStore,
  mergeRows,
  computeRowState,
  suggestCompanyByMST,
  formatHistoryTimestamp,
} from "@/components/hq-agency-manager/hqAgencyManagerModel.js";

export default function HQAgencyManager({ canEdit = true, currentUser = null }) {
  const initialDraftsRef = useRef(null);

  const initialErrorRef = useRef(null);

  if (initialDraftsRef.current === null) {
    const { drafts, error } = readDraftsFromStore();

    initialDraftsRef.current = drafts;

    initialErrorRef.current = error;
  }

  const initialDrafts = Array.isArray(initialDraftsRef.current) ? initialDraftsRef.current : [];

  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const resizeCleanupRef = useRef(null);

  const [baseline, setBaseline] = useState(() => initialDrafts.map(cloneDraft));

  const [rows, setRows] = useState(() => initialDrafts.map(cloneDraft));

  const [search, setSearch] = useState("");

  const [agencyFilter, setAgencyFilter] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");

  const [page, setPage] = useState(1);

  const [dirty, setDirty] = useState(false);

  const [selectedFile, setSelectedFile] = useState("");

  const [historyStamp, setHistoryStamp] = useState(() => Date.now());

  const [openHistory, setOpenHistory] = useState([]);

  const [loadError, setLoadError] = useState(() =>
    initialErrorRef.current ? "Không thể tải danh sách Đại lý HQ. Vui lòng thử lại." : null,
  );

  const fileRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      const next = { ...DEFAULT_COLUMN_WIDTHS };
      let hasCustomWidth = false;
      for (const key of Object.keys(next)) {
        if (Object.prototype.hasOwnProperty.call(parsed, key)) {
          const clamped = clampColumnWidth(key, parsed[key]);
          next[key] = clamped;
          if (clamped !== DEFAULT_COLUMN_WIDTHS[key]) {
            hasCustomWidth = true;
          }
        }
      }
      if (hasCustomWidth) {
        setColumnWidths(next);
      }
    } catch (err) {
      console.warn("Không thể đọc cấu hình độ rộng cột Đại lý HQ", err);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(columnWidths));
    } catch (err) {
      console.warn("Không thể lưu cấu hình độ rộng cột Đại lý HQ", err);
    }
  }, [columnWidths]);

  useEffect(
    () => () => {
      if (typeof window === "undefined") return;
      if (typeof resizeCleanupRef.current === "function") {
        resizeCleanupRef.current();
      }
    },
    [],
  );

  const actor = currentUser?.username || "guest";

  const isReadOnly = !canEdit;

  const handleResizeStart = useCallback(
    (key, event) => {
      if (typeof window === "undefined") return;
      if (!event || typeof event.clientX !== "number") return;
      event.preventDefault();
      if (typeof resizeCleanupRef.current === "function") {
        resizeCleanupRef.current();
      }
      const startX = event.clientX;
      const baseWidth =
        columnWidths[key] ?? DEFAULT_COLUMN_WIDTHS[key] ?? MIN_COLUMN_WIDTHS[key] ?? 120;
      const body = typeof document !== "undefined" ? document.body : null;
      const previousUserSelect = body?.style.userSelect ?? "";
      const previousCursor = body?.style.cursor ?? "";
      if (body) {
        body.style.userSelect = "none";
        body.style.cursor = "col-resize";
      }
      const onMouseMove = (moveEvent) => {
        const delta = (moveEvent?.clientX ?? startX) - startX;
        const nextWidth = clampColumnWidth(key, baseWidth + delta);
        setColumnWidths((prev) => {
          if (prev[key] === nextWidth) return prev;
          return { ...prev, [key]: nextWidth };
        });
      };
      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        if (body) {
          body.style.userSelect = previousUserSelect;
          body.style.cursor = previousCursor;
        }
        resizeCleanupRef.current = null;
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      resizeCleanupRef.current = onMouseUp;
    },
    [columnWidths],
  );

  const getColumnStyle = useCallback(
    (key) => {
      const width =
        columnWidths[key] ?? DEFAULT_COLUMN_WIDTHS[key] ?? MIN_COLUMN_WIDTHS[key] ?? 120;
      const minWidth = MIN_COLUMN_WIDTHS[key] ?? 60;
      return {
        width: `${Math.round(width)}px`,
        minWidth: `${Math.round(minWidth)}px`,
      };
    },
    [columnWidths],
  );

  const renderResizeHandle = useCallback(
    (key) => (
      <span
        aria-hidden="true"
        onMouseDown={(event) => handleResizeStart(key, event)}
        className="absolute right-0 top-0 flex h-full w-2 cursor-col-resize select-none items-center justify-center"
      >
        <span className="pointer-events-none h-3/4 w-[1px] rounded bg-slate-400 opacity-25 transition-opacity group-hover:opacity-80" />
      </span>
    ),
    [handleResizeStart],
  );

  const baselineMap = useMemo(() => {
    const map = new Map();

    for (const row of baseline) {
      if (!row?._originalMst) continue;

      map.set(row._originalMst, row);
    }

    return map;
  }, [baseline]);

  const computeRowDirty = useCallback(
    (row) => {
      if (!row) return false;

      const normalizedDraft = sanitizeRowModel(row);

      const baselineRow = row._originalMst ? baselineMap.get(row._originalMst) : null;

      const normalizedBaseline = baselineRow ? sanitizeRowModel(baselineRow) : null;

      if (!normalizedBaseline) {
        return Boolean(normalizedDraft.mst || normalizedDraft.company || normalizedDraft.agent);
      }

      return (
        normalizedDraft.mst !== normalizedBaseline.mst ||
        normalizedDraft.company !== normalizedBaseline.company ||
        normalizedDraft.agent !== normalizedBaseline.agent
      );
    },
    [baselineMap],
  );

  const computeHasDirty = useCallback(
    (list) => {
      return Array.isArray(list) && list.some((item) => computeRowDirty(item));
    },
    [computeRowDirty],
  );

  const updateRows = useCallback(
    (updater) => {
      setRows((prev) => {
        const base = Array.isArray(prev) ? prev : [];

        const next = typeof updater === "function" ? updater(base.slice()) : updater;

        if (!Array.isArray(next)) {
          return base;
        }

        setDirty(computeHasDirty(next));

        return next;
      });
    },
    [computeHasDirty],
  );

  const loadFromStore = useCallback(() => {
    const { drafts, error } = readDraftsFromStore();

    const baselineDrafts = drafts.map(cloneDraft);

    const workingDrafts = drafts.map(cloneDraft);

    initialDraftsRef.current = drafts;

    setBaseline(baselineDrafts);

    setRows(workingDrafts);

    setDirty(false);

    setPage(1);

    setLoadError(error ? "Không thể tải danh sách Đại lý HQ. Vui lòng thử lại." : null);
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      await refreshHQHistoryCache({ limit: HQ_HISTORY_LIMIT });
    } catch (err) {
      console.warn("Không thể tải lịch sử Đại lý HQ", err);
    } finally {
      setHistoryStamp(Date.now());
    }
  }, []);

  const historyEntries = useMemo(() => getHQHistoryEntries(historyStamp), [historyStamp]);

  const historyMap = useMemo(() => {
    const map = new Map();

    for (const entry of historyEntries) {
      const mst = normalizeMST(entry?.mst);

      if (!mst) continue;

      const list = map.get(mst) ?? [];

      list.push(entry);

      map.set(mst, list);
    }

    for (const list of map.values()) {
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    return map;
  }, [historyEntries]);

  const historyOverview = useMemo(() => {
    if (!Array.isArray(historyEntries) || historyEntries.length === 0) {
      return {
        total: 0,

        lastTimestamp: null,

        lastActor: "",

        lastMst: "",

        last24h: 0,
      };
    }

    const total = historyEntries.length;

    const latest = historyEntries[0];

    let lastTimestamp = null;

    let lastActor = "";

    let lastMst = "";

    if (latest?.timestamp) {
      const ts = new Date(latest.timestamp);

      if (!Number.isNaN(ts.getTime())) {
        lastTimestamp = ts;
      }
    }

    if (latest?.actor) {
      lastActor = latest.actor;
    }

    if (latest?.mst) {
      lastMst = latest.mst;
    }

    const now = Date.now();

    const dayAgo = now - 24 * 60 * 60 * 1000;

    let last24h = 0;

    for (const entry of historyEntries) {
      const ts = new Date(entry?.timestamp);

      if (Number.isNaN(ts.getTime())) continue;

      if (ts.getTime() >= dayAgo) {
        last24h += 1;
      } else {
        break;
      }
    }

    return {
      total,

      lastTimestamp,

      lastActor,

      lastMst,

      last24h,
    };
  }, [historyEntries]);

  const agencyOptions = useMemo(() => {
    const values = new Map();

    const collect = (list) => {
      for (const row of list || []) {
        for (const agent of row?.agents || []) {
          const label = normalizeStr(agent);

          if (!label) continue;

          if (!values.has(label)) {
            values.set(label, agent);
          }
        }
      }
    };

    collect(baseline);

    collect(rows);

    return Array.from(values.values()).sort((a, b) =>
      a.localeCompare(b, "vi", { sensitivity: "base" }),
    );
  }, [baseline, rows]);

  const agencySelectOptions = useMemo(
    () => agencyOptions.map((label) => ({ value: label, label })),

    [agencyOptions],
  );

  const toggleHistory = useCallback((mst) => {
    const key = normalizeMST(mst);

    if (!key) return;

    setOpenHistory((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  }, []);

  const filtered = useMemo(() => {
    const q = normalizeStr(search).toLowerCase();

    const agencyQuery = normalizeStr(agencyFilter).toLowerCase();

    const now = Date.now();

    return rows.filter((row) => {
      const state = computeRowState(row, baselineMap, historyMap, now);

      const mstText = (row.mst || "").toLowerCase();

      const companyText = (row.company || "").toLowerCase();

      const agentText = (row.agent || "").toLowerCase();

      if (q && !mstText.includes(q) && !companyText.includes(q) && !agentText.includes(q)) {
        return false;
      }

      if (agencyQuery) {
        const hasAgencyMatch = state.draft.agents.some((agent) =>
          agent.toLowerCase().includes(agencyQuery),
        );

        if (!hasAgencyMatch) {
          return false;
        }
      }

      if (statusFilter === "pending" && !state.hasChanges) {
        return false;
      }

      if (statusFilter === "missing" && state.hasAgents) {
        return false;
      }

      if (statusFilter === "recent" && !state.isRecent) {
        return false;
      }

      if (statusFilter === "noHistory" && state.hasHistory) {
        return false;
      }

      return true;
    });
  }, [rows, search, agencyFilter, statusFilter, baselineMap, historyMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const safePage = Math.min(page, totalPages);

  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [safePage, page]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const handleChangeField = useCallback(
    (index, field, value) => {
      updateRows((prev) => {
        if (index < 0 || index >= prev.length) return prev;

        const next = prev.slice();

        const current = cloneDraft(next[index] ?? createEmptyDraft());

        if (field === "mst") {
          const nextMst = normalizeMST(value);

          current.mst = nextMst;

          if (nextMst) {
            const suggestion = suggestCompanyByMST(nextMst);

            if (suggestion && !normalizeStr(current.company)) {
              current.company = suggestion;
            }
          }
        } else if (field === "company") {
          current.company = normalizeStr(value);
        } else if (field === "agent") {
          const agents = parseAgencyList(value);

          current.agents = agents;

          current.agent = formatAgencyList(agents);
        } else {
          current[field] = normalizeStr(value);
        }

        if (!current._originalMst) {
          current._isNew = true;
        }

        next[index] = current;

        return next;
      });
    },
    [updateRows],
  );

  const handleQuickAddAgent = useCallback(
    (index, agentName) => {
      const sanitizedAgent = normalizeStr(agentName);

      if (!sanitizedAgent) return;

      updateRows((prev) => {
        if (index < 0 || index >= prev.length) return prev;

        const next = prev.slice();

        const current = cloneDraft(next[index] ?? createEmptyDraft());

        const existingSet = new Set((current.agents || []).map((item) => normalizeStr(item)));

        if (existingSet.has(sanitizedAgent)) {
          return prev;
        }

        const agents = [...(current.agents || []), sanitizedAgent];

        current.agents = agents;

        current.agent = formatAgencyList(agents);

        if (!current._originalMst) {
          current._isNew = true;
        }

        next[index] = current;

        return next;
      });
    },
    [updateRows],
  );

  const handleAddRow = useCallback(() => {
    updateRows((prev) => [createEmptyDraft(), ...(Array.isArray(prev) ? prev : [])]);

    setPage(1);
  }, [updateRows]);

  const handleDelete = useCallback(
    async (index) => {
      const row = rows[index];

      if (!row) return;

      if (!row._isNew && row._originalMst) {
        if (
          !window.confirm(`Bạn chắc chắn muốn xóa cấu hình đại lý cho MST ${row._originalMst}?`)
        ) {
          return;
        }

        try {
          deleteHQAgencyRow(row._originalMst, {
            actor,

            detail: `Xóa đại lý HQ từ giao diện (${row._originalMst})`,
          });

          loadFromStore();

          await refreshHistory();

          alert(`Đã xóa cấu hình đại lý cho MST ${row._originalMst}.`);
        } catch (err) {
          console.error("Không thể xóa đại lý HQ", err);

          alert("Không thể xóa đại lý HQ. Vui lòng thử lại.");
        }

        return;
      }

      updateRows((prev) => {
        if (!Array.isArray(prev)) return prev;

        const next = prev.slice();

        next.splice(index, 1);

        return next;
      });
    },
    [rows, actor, loadFromStore, refreshHistory, updateRows],
  );

  const handleReload = useCallback(async () => {
    if (
      dirty &&
      !window.confirm("Bạn có thay đổi chưa lưu. Bạn có chắc muốn bỏ qua và tải lại dữ liệu?")
    ) {
      return;
    }

    loadFromStore();

    setSelectedFile("");

    if (fileRef.current) fileRef.current.value = "";

    await refreshHistory();
  }, [dirty, loadFromStore, refreshHistory]);

  const handleImport = useCallback(async () => {
    if (isReadOnly) {
      alert("Bạn không có quyền import dữ liệu Đại lý HQ.");

      return;
    }

    const file = fileRef.current?.files?.[0];

    if (!file) {
      alert("Chưa chọn file .xlsx");

      return;
    }

    try {
      const buffer = await file.arrayBuffer();

      const wb = XLSX.read(buffer, { type: "array" });

      const sheet = wb.Sheets[wb.SheetNames[0]];

      const json = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: "" });

      const mapped = json

        .map((row) => {
          const mst = normalizeMST(pickCell(row, "mst"));

          if (!mst) return null;

          const company = normalizeStr(pickCell(row, "company"));

          const agents = parseAgencyList(pickCell(row, "agency"));

          return {
            mst,

            company,

            agents,

            agent: formatAgencyList(agents),
          };
        })

        .filter(Boolean);

      if (!mapped.length) {
        alert("Không tìm thấy dữ liệu hợp lệ trong file.");

        return;
      }

      updateRows((prev) => mergeRows(prev, mapped));

      setPage(1);

      alert(`Đã đọc ${mapped.length} dòng từ file. Bấm Lưu để ghi vào hệ thống.`);
    } catch (err) {
      console.error("Không thể đọc file Đại lý HQ", err);

      alert("Không thể đọc file Excel — vui lòng kiểm tra lại định dạng.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";

      setSelectedFile("");
    }
  }, [isReadOnly, updateRows]);

  const handleFilePick = useCallback((event) => {
    const file = event.target.files?.[0];

    setSelectedFile(file ? file.name : "");
  }, []);

  const handleSave = useCallback(async () => {
    if (isReadOnly) {
      alert("Bạn không có quyền lưu cấu hình Đại lý HQ.");

      return;
    }

    const sanitized = rows

      .map((row) => {
        const normalized = sanitizeRowModel(row);

        if (!normalized.mst) return null;

        let company = normalized.company;

        if (!company) {
          const suggestion = suggestCompanyByMST(normalized.mst);

          if (suggestion) {
            company = suggestion;
          }
        }

        return {
          mst: normalized.mst,

          company,

          agents: normalized.agents,
        };
      })

      .filter(Boolean);

    if (!sanitized.length) {
      alert("Không có dòng hợp lệ để lưu. Vui lòng kiểm tra lại dữ liệu.");

      return;
    }

    try {
      upsertHQAgencies(sanitized, {
        actor,

        detail: "Cập nhật danh sách Đại lý HQ từ giao diện",
      });

      loadFromStore();

      await refreshHistory();

      setSelectedFile("");

      if (fileRef.current) fileRef.current.value = "";

      alert("Đã lưu cấu hình Đại lý HQ.");
    } catch (err) {
      console.error("Không thể lưu cấu hình Đại lý HQ", err);

      alert("Không thể lưu cấu hình Đại lý HQ. Vui lòng thử lại.");
    }
  }, [actor, isReadOnly, rows, loadFromStore, refreshHistory]);

  const handleSaveRow = useCallback(
    async (index) => {
      const row = rows[index];

      if (!row) return;

      if (isReadOnly) {
        alert("Bạn không có quyền lưu đại lý HQ.");

        return;
      }

      const normalized = sanitizeRowModel(row);

      if (!normalized.mst) {
        alert("Vui lòng nhập mã số thuế trước khi lưu.");

        return;
      }

      try {
        saveHQAgencyRow(
          {
            mst: normalized.mst,

            company: normalized.company,

            agents: normalized.agents,
          },

          {
            actor,

            previousMst: row._originalMst,

            detail: `Cập nhật đại lý HQ từ bảng (${normalized.mst})`,
          },
        );

        loadFromStore();

        await refreshHistory();

        alert(`Đã lưu đại lý HQ cho MST ${normalized.mst}.`);
      } catch (err) {
        console.error("Không thể lưu đại lý HQ", err);

        alert("Không thể lưu đại lý HQ. Vui lòng thử lại.");
      }
    },
    [rows, isReadOnly, actor, loadFromStore, refreshHistory],
  );

  const handleResetFilters = useCallback(() => {
    setAgencyFilter("");

    setStatusFilter("all");

    setSearch("");

    setPage(1);
  }, []);

  return (
    <section className="hq-agency-view space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Danh sách Đại lý Hải quan hợp tác</h2>

          <p className="text-sm text-gray-500">
            Gán tên Đại lý theo từng MST để tự động chú thích khi import tờ khai.
          </p>

          <p className="text-xs text-gray-500">
            Một MST có thể gắn nhiều đại lý; hãy nhập và ngăn cách bằng dấu phẩy (,).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          {dirty && <span className="text-amber-600">Có thay đổi chưa lưu</span>}

          <button type="button" onClick={handleReload} className="rounded border px-3 py-1">
            Tải lại
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={handleSave}
              className="rounded bg-amber-500 px-3 py-1 text-white hover:bg-amber-600"
              disabled={!rows.length}
            >
              Lưu cấu hình
            </button>
          )}
        </div>
      </header>

      {isReadOnly && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
          Bạn đang ở chế độ chỉ xem. Đăng nhập bằng tài khoản quản trị để thêm hoặc chỉnh sửa danh
          sách Đại lý HQ.
        </div>
      )}

      {loadError && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-secondary)]">
        {historyOverview.total === 0 ? (
          <span>Chưa ghi nhận lịch sử đồng bộ Đại lý HQ.</span>
        ) : (
          <>
            <span>
              <strong className="font-semibold text-[color:var(--ds-text-primary)]">
                {historyOverview.total}
              </strong>{" "}
              bản ghi lịch sử được lưu.
            </span>

            <span>
              24 giờ qua:{" "}
              <strong className="font-semibold text-[color:var(--ds-text-primary)]">
                {historyOverview.last24h}
              </strong>
            </span>

            {historyOverview.lastTimestamp && (
              <span>
                Cập nhật gần nhất:{" "}
                <strong className="font-semibold text-[color:var(--ds-text-primary)]">
                  {formatHistoryTimestamp(historyOverview.lastTimestamp)}
                </strong>
                {historyOverview.lastActor ? ` • ${historyOverview.lastActor}` : ""}
                {historyOverview.lastMst ? ` • MST ${historyOverview.lastMst}` : ""}
              </span>
            )}
          </>
        )}

        <button
          type="button"
          onClick={refreshHistory}
          className="ml-auto rounded border border-[color:var(--ds-border-strong)] px-3 py-1 text-xs font-medium text-[color:var(--ds-text-primary)] hover:bg-[color:var(--ds-surface-muted)]"
        >
          Làm mới lịch sử
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          className="hidden"
          data-testid="hq-file-input"
          ref={fileRef}
          accept=".xls,.xlsx"
          onChange={handleFilePick}
          disabled={isReadOnly}
        />

        {canEdit && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded border px-3 py-1.5"
          >
            Chọn file Excel
          </button>
        )}

        {selectedFile && <span className="text-sm text-gray-600">Đã chọn: {selectedFile}</span>}

        {canEdit && (
          <button
            type="button"
            onClick={handleImport}
            className="rounded bg-black px-3 py-1.5 text-white disabled:opacity-50"
            disabled={isReadOnly}
          >
            Import Excel
          </button>
        )}

        {canEdit && (
          <button type="button" onClick={handleAddRow} className="rounded border px-3 py-1.5">
            Thêm dòng mới
          </button>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <FilterSelect
            value={agencyFilter}
            onChange={(value) => {
              setAgencyFilter(value);

              setPage(1);
            }}
            options={agencySelectOptions}
            emptyLabel="Tất cả đại lý"
            placeholder="Lọc theo đại lý"
            triggerClassName="min-w-[180px]"
          />

          <FilterSelect
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);

              setPage(1);
            }}
            options={STATUS_FILTER_OPTIONS}
            placeholder="Trạng thái"
            triggerClassName="min-w-[180px]"
          />

          <input
            className="w-64 rounded border px-2 py-1"
            placeholder="Tìm theo MST, Công ty hoặc Đại lý"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />

          <button
            type="button"
            onClick={handleResetFilters}
            className="rounded border px-2 py-1 text-sm text-gray-600"
          >
            Xóa lọc
          </button>

          <span className="text-sm text-gray-500">
            {filtered.length} dòng • Trang {safePage}/{totalPages}
          </span>

          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border px-2 py-1"
          >
            « Trước
          </button>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded border px-2 py-1"
          >
            Sau »
          </button>
        </div>
      </div>

      <HQAgencyTable
        agencyOptions={agencyOptions}
        baselineMap={baselineMap}
        canEdit={canEdit}
        getColumnStyle={getColumnStyle}
        historyMap={historyMap}
        isReadOnly={isReadOnly}
        onChangeField={handleChangeField}
        onDeleteRow={handleDelete}
        onQuickAddAgent={handleQuickAddAgent}
        onSaveRow={handleSaveRow}
        onToggleHistory={toggleHistory}
        openHistory={openHistory}
        pageRows={pageRows}
        rows={rows}
        safePage={safePage}
        renderResizeHandle={renderResizeHandle}
      />

      <p className="text-xs text-gray-500">
        • Cột "Đại lý HQ" sẽ xuất hiện trong mục Import Data để mọi tờ khai thuộc MST tương ứng được
        gắn nhãn tự động.
        <br />• Có thể import danh sách từ file Excel gồm các cột MST, Công ty, Đại lý HQ hoặc nhập
        thủ công từng dòng.
      </p>
    </section>
  );
}
