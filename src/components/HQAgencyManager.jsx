import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import * as XLSX from "xlsx";

import {

  getHQAgencies,

  upsertHQAgencies,

  saveHQAgencyRow,

  deleteHQAgencyRow,

  normalizeMST,

  normalizeStr,

  getDeclRows,

  parseAgencyList,

  formatAgencyList,

  getHQHistoryEntries,

  HQ_HISTORY_LIMIT,

} from "@/lib/store.js";

import { refreshHQHistoryCache } from "@/lib/hqHistoryClient.js";

import { FilterSelect, StatusBadge } from "@/components/designSystem/primitives.jsx";



const PAGE_SIZE = 50;



const CARD_SURFACE_CLASS = "rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] shadow-sm";

const RECENT_UPDATE_WINDOW = 30 * 24 * 60 * 60 * 1000; // 30 ngày

const STATUS_FILTER_OPTIONS = [

  { value: "all", label: "Tất cả trạng thái" },

  { value: "pending", label: "Chưa lưu" },

  { value: "missing", label: "Chưa gán đại lý" },

  { value: "recent", label: "Cập nhật 30 ngày gần đây" },

  { value: "noHistory", label: "Chưa từng cập nhật" },

];

const AGENCY_SUGGESTION_DATALIST = "hq-agency-suggestions";



const headerAliases = {

  mst: ["mst", "mã số thuế", "ma so thue", "mst (vat)"],

  company: ["công ty", "cong ty", "company", "doanh nghiệp", "ten doanh nghiep"],

  agency: ["đại lý", "dai ly", "đại lý hq", "dai ly hq", "agency"],

};



function normaliseHeader(value = "") {

  return value

    .toString()

    .normalize("NFD")

    .replace(/[\u0300-\u036f]/g, "")

    .replace(/\s+/g, " ")

    .trim()

    .toLowerCase();

}



function pickCell(row, key) {

  const wanted = headerAliases[key] || [key];

  const keys = Object.keys(row || {});

  for (const w of wanted) {

    const hit = keys.find(k => normaliseHeader(k) === normaliseHeader(w));

    if (hit) return row[hit];

  }

  return "";

}



function sanitizeRowModel(row) {

  const mst = normalizeMST(row?.mst);

  const company = normalizeStr(row?.company ?? "");

  const agents = parseAgencyList(row?.agents ?? row?.agent);

  return {

    mst,

    company,

    agents,

    agent: formatAgencyList(agents),

  };

}



function cloneDraft(row) {

  return {

    ...row,

    agents: Array.isArray(row?.agents) ? row.agents.slice() : [],

  };

}



function createDraftFromStore(row) {

  const sanitized = sanitizeRowModel(row || {});

  return {

    mst: sanitized.mst,

    company: sanitized.company,

    agents: sanitized.agents,

    agent: sanitized.agent,

    _originalMst: sanitized.mst,

    _isNew: false,

  };

}



function createEmptyDraft() {

  return {

    mst: "",

    company: "",

    agents: [],

    agent: "",

    _originalMst: "",

    _isNew: true,

  };

}



function readDraftsFromStore() {

  try {

    const rows = getHQAgencies();

    const drafts = Array.isArray(rows) ? rows.map(createDraftFromStore) : [];

    return { drafts, error: null };

  } catch (err) {

    console.error("Không thể đọc danh sách Đại lý HQ", err);

    return { drafts: [], error: err instanceof Error ? err : new Error(String(err)) };

  }

}



function mergeRows(current, incoming) {

  const preservedDrafts = [];

  const draftsByMst = new Map();



  for (const row of current) {

    const sanitized = sanitizeRowModel(row || {});

    const key = sanitized.mst || row?._originalMst || "";

    if (!key) {

      preservedDrafts.push(cloneDraft(row));

      continue;

    }

    draftsByMst.set(key, cloneDraft({

      ...row,

      mst: sanitized.mst,

      company: sanitized.company,

      agents: sanitized.agents,

      agent: sanitized.agent,

    }));

  }



  for (const row of incoming) {

    const normalized = sanitizeRowModel(row);

    if (!normalized.mst) continue;

    const existing = draftsByMst.get(normalized.mst);

    const combinedAgents = Array.from(new Set([...(existing?.agents ?? []), ...normalized.agents]));

    const company = normalized.company || existing?.company || "";

    draftsByMst.set(normalized.mst, {

      mst: normalized.mst,

      company,

      agents: combinedAgents,

      agent: formatAgencyList(combinedAgents),

      _originalMst: existing?._originalMst ?? "",

      _isNew: existing?._isNew ?? !existing,

    });

  }



  const merged = [...preservedDrafts, ...Array.from(draftsByMst.values())];

  merged.sort((a, b) => {

    const cmpCompany = (a.company || "").localeCompare(b.company || "", "vi", { sensitivity: "base" });

    if (cmpCompany !== 0) return cmpCompany;

    return (a.mst || "").localeCompare(b.mst || "");

  });

  return merged;

}



function computeRowState(row, baselineMap, historyMap, now = Date.now()) {

  const draft = row || {};

  const normalizedDraft = sanitizeRowModel(draft);

  const baselineRow = draft._originalMst ? baselineMap.get(draft._originalMst) : null;

  const normalizedBaseline = baselineRow ? sanitizeRowModel(baselineRow) : null;



  const hasChanges = normalizedBaseline

    ? normalizedDraft.mst !== normalizedBaseline.mst

      || normalizedDraft.company !== normalizedBaseline.company

      || normalizedDraft.agent !== normalizedBaseline.agent

    : Boolean(normalizedDraft.mst || normalizedDraft.company || normalizedDraft.agent);



  const lookupKey = normalizedDraft.mst || normalizeMST(draft._originalMst);

  const historyList = lookupKey ? historyMap.get(lookupKey) || [] : [];

  const lastTimestamp = historyList.length

    ? new Date(historyList[0].timestamp).getTime()

    : 0;

  const isRecent = lastTimestamp && !Number.isNaN(lastTimestamp) && now - lastTimestamp <= RECENT_UPDATE_WINDOW;

  const hasHistory = historyList.length > 0;

  const hasAgents = normalizedDraft.agents.length > 0;



  return {

    draft: normalizedDraft,

    baseline: normalizedBaseline,

    hasChanges,

    hasAgents,

    hasHistory,

    isRecent,

    lastTimestamp,

    isNew: !normalizedBaseline,

  };

}



function suggestCompanyByMST(mst) {

  const normalized = normalizeMST(mst);

  if (!normalized) return "";

  const rows = getDeclRows();

  if (!Array.isArray(rows) || rows.length === 0) return "";

  const freq = new Map();

  for (const row of rows) {

    const rowMst = normalizeMST(row?.mst);

    if (rowMst !== normalized) continue;

    const company = normalizeStr(row?.cong_ty || row?.company || row?.customer || "");

    if (!company) continue;

    const count = freq.get(company) || 0;

    freq.set(company, count + 1);

  }

  let best = "";

  let bestCount = 0;

  for (const [company, count] of freq.entries()) {

    if (count > bestCount) {

      best = company;

      bestCount = count;

    }

  }

  return best;

}



function formatHistoryTimestamp(value) {

  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  try {

    return date.toLocaleString('vi-VN', { hour12: false });

  } catch (err) {

    console.warn('Khong the dinh dang thoi gian lich su Dai ly HQ', value, err);

    return date.toISOString();

  }

}



export default function HQAgencyManager({ canEdit = true, currentUser = null }) {

  const initialDraftsRef = useRef(null);

  const initialErrorRef = useRef(null);

  if (initialDraftsRef.current === null) {

    const { drafts, error } = readDraftsFromStore();

    initialDraftsRef.current = drafts;

    initialErrorRef.current = error;

  }



  const initialDrafts = Array.isArray(initialDraftsRef.current) ? initialDraftsRef.current : [];



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

  const [loadError, setLoadError] = useState(() => (initialErrorRef.current ? "Không thể tải danh sách Đại lý HQ. Vui lòng thử lại." : null));

  const fileRef = useRef(null);



  const actor = currentUser?.username || "guest";

  const isReadOnly = !canEdit;



  const baselineMap = useMemo(() => {

    const map = new Map();

    for (const row of baseline) {

      if (!row?._originalMst) continue;

      map.set(row._originalMst, row);

    }

    return map;

  }, [baseline]);



  const computeRowDirty = useCallback((row) => {

    if (!row) return false;

    const normalizedDraft = sanitizeRowModel(row);

    const baselineRow = row._originalMst ? baselineMap.get(row._originalMst) : null;

    const normalizedBaseline = baselineRow ? sanitizeRowModel(baselineRow) : null;

    if (!normalizedBaseline) {

      return Boolean(normalizedDraft.mst || normalizedDraft.company || normalizedDraft.agent);

    }

    return (

      normalizedDraft.mst !== normalizedBaseline.mst

      || normalizedDraft.company !== normalizedBaseline.company

      || normalizedDraft.agent !== normalizedBaseline.agent

    );

  }, [baselineMap]);



  const computeHasDirty = useCallback((list) => {

    return Array.isArray(list) && list.some(item => computeRowDirty(item));

  }, [computeRowDirty]);



  const updateRows = useCallback((updater) => {

    setRows(prev => {

      const base = Array.isArray(prev) ? prev : [];

      const next = typeof updater === "function" ? updater(base.slice()) : updater;

      if (!Array.isArray(next)) {

        return base;

      }

      setDirty(computeHasDirty(next));

      return next;

    });

  }, [computeHasDirty]);



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

        lastActor: '',

        lastMst: '',

        last24h: 0,

      };

    }

    const total = historyEntries.length;

    const latest = historyEntries[0];

    let lastTimestamp = null;

    let lastActor = '';

    let lastMst = '';

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

    return Array.from(values.values()).sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base" }));

  }, [baseline, rows]);



  const agencySelectOptions = useMemo(

    () => agencyOptions.map((label) => ({ value: label, label })),

    [agencyOptions]

  );



  const toggleHistory = useCallback((mst) => {

    const key = normalizeMST(mst);

    if (!key) return;

    setOpenHistory(prev => (prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key]));

  }, []);



  const filtered = useMemo(() => {

    const q = normalizeStr(search).toLowerCase();

    const agencyQuery = normalizeStr(agencyFilter).toLowerCase();

    const now = Date.now();

    return rows.filter(row => {

      const state = computeRowState(row, baselineMap, historyMap, now);

      const mstText = (row.mst || "").toLowerCase();

      const companyText = (row.company || "").toLowerCase();

      const agentText = (row.agent || "").toLowerCase();



      if (q && !mstText.includes(q) && !companyText.includes(q) && !agentText.includes(q)) {

        return false;

      }



      if (agencyQuery) {

        const hasAgencyMatch = state.draft.agents.some(agent => agent.toLowerCase().includes(agencyQuery));

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



  const handleChangeField = useCallback((index, field, value) => {

    updateRows(prev => {

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

  }, [updateRows]);



  const handleQuickAddAgent = useCallback((index, agentName) => {

    const sanitizedAgent = normalizeStr(agentName);

    if (!sanitizedAgent) return;

    updateRows(prev => {

      if (index < 0 || index >= prev.length) return prev;

      const next = prev.slice();

      const current = cloneDraft(next[index] ?? createEmptyDraft());

      const existingSet = new Set((current.agents || []).map(item => normalizeStr(item)));

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

  }, [updateRows]);



  const handleAddRow = useCallback(() => {

    updateRows(prev => [createEmptyDraft(), ...(Array.isArray(prev) ? prev : [])]);

    setPage(1);

  }, [updateRows]);



  const handleDelete = useCallback(async (index) => {

    const row = rows[index];

    if (!row) return;



    if (!row._isNew && row._originalMst) {

      if (!window.confirm(`Bạn chắc chắn muốn xóa cấu hình đại lý cho MST ${row._originalMst}?`)) {

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



    updateRows(prev => {

      if (!Array.isArray(prev)) return prev;

      const next = prev.slice();

      next.splice(index, 1);

      return next;

    });

  }, [rows, actor, loadFromStore, refreshHistory, updateRows]);



  const handleReload = useCallback(async () => {

    if (dirty && !window.confirm("Bạn có thay đổi chưa lưu. Bạn có chắc muốn bỏ qua và tải lại dữ liệu?")) {

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

        .map(row => {

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

      updateRows(prev => mergeRows(prev, mapped));

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

      .map(row => {

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



  const handleSaveRow = useCallback(async (index) => {

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

  }, [rows, isReadOnly, actor, loadFromStore, refreshHistory]);



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

          <p className="text-sm text-gray-500">Gán tên Đại lý theo từng MST để tự động chú thích khi import tờ khai.</p>

          <p className="text-xs text-gray-500">Một MST có thể gắn nhiều đại lý; hãy nhập và ngăn cách bằng dấu phẩy (,).</p>

        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">

          {dirty && <span className="text-amber-600">Có thay đổi chưa lưu</span>}

          <button

            type="button"

            onClick={handleReload}

            className="rounded border px-3 py-1"

          >

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

          Bạn đang ở chế độ chỉ xem. Đăng nhập bằng tài khoản quản trị để thêm hoặc chỉnh sửa danh sách Đại lý HQ.

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

              <strong className="font-semibold text-[color:var(--ds-text-primary)]">{historyOverview.total}</strong>{' '}

              bản ghi lịch sử được lưu.

            </span>

            <span>

              24 giờ qua:{' '}

              <strong className="font-semibold text-[color:var(--ds-text-primary)]">{historyOverview.last24h}</strong>

            </span>

            {historyOverview.lastTimestamp && (

              <span>

                Cập nhật gần nhất:{' '}

                <strong className="font-semibold text-[color:var(--ds-text-primary)]">

                  {formatHistoryTimestamp(historyOverview.lastTimestamp)}

                </strong>

                {historyOverview.lastActor ? ` • ${historyOverview.lastActor}` : ''}

                {historyOverview.lastMst ? ` • MST ${historyOverview.lastMst}` : ''}

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

          <button

            type="button"

            onClick={handleAddRow}

            className="rounded border px-3 py-1.5"

          >

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

            onChange={e => { setSearch(e.target.value); setPage(1); }}

          />

          <button

            type="button"

            onClick={handleResetFilters}

            className="rounded border px-2 py-1 text-sm text-gray-600"

          >

            Xóa lọc

          </button>

          <span className="text-sm text-gray-500">{filtered.length} dòng • Trang {safePage}/{totalPages}</span>

          <button

            type="button"

            onClick={() => setPage(p => Math.max(1, p - 1))}

            className="rounded border px-2 py-1"

          >

            « Trước

          </button>

          <button

            type="button"

            onClick={() => setPage(p => Math.min(totalPages, p + 1))}

            className="rounded border px-2 py-1"

          >

            Sau »

          </button>

        </div>

      </div>



      <div className="overflow-auto rounded border">

        <table className="min-w-full text-sm">

          <thead className="bg-[color:var(--ds-surface-muted)]">

            <tr>

              <th className="w-16 px-2 py-1 text-left">STT</th>

              <th className="px-2 py-1 text-left">Mã số thuế</th>

              <th className="px-2 py-1 text-left">Công ty</th>

              <th className="px-2 py-1 text-left">Đại lý HQ

                <span

                  className="ml-1 text-xs text-gray-400"

                  title="Nhập nhiều đại lý và ngăn cách bằng dấu phẩy (,) hoặc xuống dòng khi cần."

                >

                  ⓘ

                </span>

              </th>

              {canEdit && <th className="w-16 px-2 py-1 text-left">Xóa</th>}

            </tr>

          </thead>

          <tbody>

            {pageRows.map((row, idx) => {

              const rowIndex = rows.indexOf(row);

              const globalIndex = (safePage - 1) * PAGE_SIZE + idx + 1;

              const state = computeRowState(row, baselineMap, historyMap);

              const historyKey = state.draft.mst || normalizeMST(row._originalMst);

              const historyForRow = historyKey ? historyMap.get(historyKey) ?? [] : [];

              const isHistoryOpen = historyKey ? openHistory.includes(historyKey) : false;

              const historyEntriesToShow = historyForRow.slice(0, 10);

              const historyButtonDisabled = !historyKey || historyForRow.length === 0;

              const historyButtonTitle = historyButtonDisabled

                ? "Chưa có lịch sử cho MST này"

                : "Xem lịch sử chỉnh sửa đại lý HQ cho MST này";

              const latestTimestamp = historyForRow[0]?.timestamp ?? null;

              const canCommitRow = !isReadOnly && state.draft.mst && state.hasChanges;

              const rowKey = `${historyKey || "row"}_${idx}`;

              const statusBadges = [];

              if (state.isNew && state.hasChanges) {

                statusBadges.push({ label: "Mới", tone: "info" });

              }

              if (state.hasChanges) {

                statusBadges.push({ label: "Chưa lưu", tone: "warning" });

              }

              if (!state.hasChanges && !state.hasAgents) {

                statusBadges.push({ label: "Chưa gán đại lý", tone: "neutral" });

              }

              if (!state.hasChanges && state.isRecent) {

                statusBadges.push({ label: "Cập nhật gần đây", tone: "success", title: latestTimestamp ? `Cập nhật lúc ${formatHistoryTimestamp(latestTimestamp)}` : undefined });

              }

              if (!state.hasChanges && !state.isRecent && state.hasHistory) {

                statusBadges.push({ label: "Đã có lịch sử", tone: "info" });

              }

              if (!state.draft.mst) {

                statusBadges.push({ label: "Chưa nhập MST", tone: "danger" });

              }

              return (

                <React.Fragment key={rowKey}>

                  <tr className="odd:bg-[color:var(--ds-surface-card)] even:bg-[color:var(--ds-surface-muted)]">

                    <td className="px-2 py-1">{globalIndex}</td>

                    <td className="px-2 py-1">

                      {isReadOnly ? (

                        <span>{row.mst}</span>

                      ) : (

                        <input

                          className="w-40 rounded border px-2 py-1"

                          value={row.mst}

                          onChange={e => handleChangeField(rowIndex, "mst", e.target.value)}

                        />

                      )}

                    </td>

                    <td className="px-2 py-1">

                      {isReadOnly ? (

                        <span>{row.company}</span>

                      ) : (

                        <input

                          className="w-64 rounded border px-2 py-1"

                          value={row.company}

                          onChange={e => handleChangeField(rowIndex, "company", e.target.value)}

                        />

                      )}

                    </td>

                    <td className="px-2 py-1 align-top">

                      <div className="flex flex-col gap-2">

                        <div className="flex flex-wrap items-start gap-2">

                          {isReadOnly ? (

                            <span>{row.agent}</span>

                          ) : (

                            <input

                              className="w-56 rounded border px-2 py-1"

                              value={row.agent}

                              onChange={e => handleChangeField(rowIndex, "agent", e.target.value)}

                              placeholder="Ví dụ: Đại lý A, Đại lý B"

                              list={AGENCY_SUGGESTION_DATALIST}

                            />

                          )}

                          {canEdit && agencyOptions.length > 0 && (

                            <select

                              className="rounded border px-2 py-1 text-xs text-gray-600"

                              value=""

                              onChange={e => {

                                handleQuickAddAgent(rowIndex, e.target.value);

                                e.target.value = "";

                              }}

                            >

                              <option value="">Chọn nhanh đại lý</option>

                              {agencyOptions.map(option => (

                                <option key={`${rowKey}-opt-${option}`} value={option}>

                                  {option}

                                </option>

                              ))}

                            </select>

                          )}

                          <span

                            className="pt-1 text-xs text-gray-400"

                            title="Nhập nhiều đại lý và ngăn cách bằng dấu phẩy (,) hoặc xuống dòng khi cần."

                          >

                            ⓘ

                          </span>

                          <button

                            type="button"

                            onClick={() => historyKey && toggleHistory(historyKey)}

                            className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-2 py-1 text-xs text-[color:var(--ds-text-secondary)] transition hover:bg-[color:var(--ds-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"

                            disabled={historyButtonDisabled}

                            title={historyButtonTitle}

                          >

                            Lịch sử{historyForRow.length > 0 ? ` (${historyForRow.length})` : ""}

                          </button>

                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">

                          {statusBadges.map((badge) => (

                            <StatusBadge

                              key={`${rowKey}-badge-${badge.label}`}

                              tone={badge.tone}

                              title={badge.title}

                            >

                              {badge.label}

                            </StatusBadge>

                          ))}

                          {canEdit && (

                            <button

                              type="button"

                              onClick={() => handleSaveRow(rowIndex)}

                              className="rounded bg-emerald-500 px-3 py-0.5 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-gray-300"

                              disabled={!canCommitRow}

                              title={!state.draft.mst ? "Nhập MST trước khi lưu" : state.hasChanges ? "Lưu các thay đổi của dòng này" : "Không có thay đổi để lưu"}

                            >

                              Cập nhật

                            </button>

                          )}

                        </div>

                      </div>

                    </td>

                    {canEdit && (

                      <td className="px-2 py-1">

                        <button

                          type="button"

                          onClick={() => handleDelete(rowIndex)}

                          className="rounded bg-red-500 px-2 py-0.5 text-xs text-white"

                        >

                          Xóa

                        </button>

                      </td>

                    )}

                  </tr>

                  {isHistoryOpen && historyEntriesToShow.length > 0 && (

                    <tr className="bg-slate-50">

                      <td colSpan={canEdit ? 5 : 4} className="px-4 pb-4 pt-2">

                        <div className="space-y-2 text-xs text-slate-600">

                          {historyEntriesToShow.map((entry) => {

                            const fieldLabel = entry.field === "company" ? "Công ty" : "Đại lý HQ";

                            const typeLabel =

                              entry.type === "create"

                                ? "Thêm"

                                : entry.type === "delete"

                                ? "Xóa"

                                : "Sửa";

                            return (

                              <div

                                key={entry.id}

                                className={`${CARD_SURFACE_CLASS} p-2`}

                              >

                                <div className="flex flex-wrap items-center justify-between gap-2 text-slate-500">

                                  <span className="font-medium text-slate-700">{fieldLabel}</span>

                                  <span>

                                    {typeLabel} • {formatHistoryTimestamp(entry.timestamp)}

                                  </span>

                                </div>

                                <div className="mt-1 grid gap-1 text-slate-600 sm:grid-cols-2">

                                  <div>

                                    <span className="font-medium text-slate-700">Từ:</span>{' '}

                                    {entry.from || "—"}

                                  </div>

                                  <div>

                                    <span className="font-medium text-slate-700">Đến:</span>{' '}

                                    {entry.to || "—"}

                                  </div>

                                </div>

                                <div className="mt-1 text-slate-500">Bởi: {entry.actor || "system"}</div>

                              </div>

                            );

                          })}

                          {historyForRow.length > historyEntriesToShow.length && (

                            <p className="text-[11px] text-slate-500">Chỉ hiển thị 10 dòng gần nhất.</p>

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

                <td className="px-2 py-6 text-center text-gray-500" colSpan={canEdit ? 5 : 4}>

                  Không có dữ liệu phù hợp.

                </td>

              </tr>

            )}

          </tbody>

        </table>

      </div>

      <p className="text-xs text-gray-500">

        • Cột "Đại lý HQ" sẽ xuất hiện trong mục Import Data để mọi tờ khai thuộc MST tương ứng được gắn nhãn tự động.<br />

        • Có thể import danh sách từ file Excel gồm các cột MST, Công ty, Đại lý HQ hoặc nhập thủ công từng dòng.

      </p>

      <datalist id={AGENCY_SUGGESTION_DATALIST}>

        {agencyOptions.map(agent => (

          <option key={`suggest-${agent}`} value={agent} />

        ))}

      </datalist>

    </section>

  );

}

