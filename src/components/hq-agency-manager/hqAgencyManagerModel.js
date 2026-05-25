import {
  getHQAgencies,
  getDeclRows,
  normalizeMST,
  normalizeStr,
  parseAgencyList,
  formatAgencyList,
} from "@/lib/store.js";

export const PAGE_SIZE = 50;

export const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "pending", label: "Chưa lưu" },
  { value: "missing", label: "Chưa gán đại lý" },
  { value: "recent", label: "Cập nhật 30 ngày gần đây" },
  { value: "noHistory", label: "Chưa từng cập nhật" },
];

export const COLUMN_WIDTH_STORAGE_KEY = "hqAgency.table.columnWidths";

export const MIN_COLUMN_WIDTHS = {
  index: 72,
  mst: 180,
  company: 240,
  agency: 280,
  actions: 96,
};

const MAX_COLUMN_WIDTHS = {
  index: 160,
  mst: 360,
  company: 640,
  agency: 720,
  actions: 240,
};

export const DEFAULT_COLUMN_WIDTHS = {
  index: 80,
  mst: 220,
  company: 320,
  agency: 360,
  actions: 112,
};

const RECENT_UPDATE_WINDOW = 30 * 24 * 60 * 60 * 1000;

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

export function clampColumnWidth(key, value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_COLUMN_WIDTHS[key] ?? MIN_COLUMN_WIDTHS[key] ?? 120;
  }
  const min = MIN_COLUMN_WIDTHS[key] ?? 60;
  const max = MAX_COLUMN_WIDTHS[key] ?? 720;
  return Math.min(Math.max(numeric, min), max);
}

export function pickCell(row, key) {
  const wanted = headerAliases[key] || [key];
  const keys = Object.keys(row || {});

  for (const wantedKey of wanted) {
    const hit = keys.find((candidate) => normaliseHeader(candidate) === normaliseHeader(wantedKey));
    if (hit) return row[hit];
  }

  return "";
}

export function sanitizeRowModel(row) {
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

export function cloneDraft(row) {
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

export function createEmptyDraft() {
  return {
    mst: "",
    company: "",
    agents: [],
    agent: "",
    _originalMst: "",
    _isNew: true,
  };
}

export function readDraftsFromStore() {
  try {
    const rows = getHQAgencies();
    const drafts = Array.isArray(rows) ? rows.map(createDraftFromStore) : [];

    return { drafts, error: null };
  } catch (err) {
    console.error("Không thể đọc danh sách Đại lý HQ", err);
    return { drafts: [], error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export function mergeRows(current, incoming) {
  const preservedDrafts = [];
  const draftsByMst = new Map();

  for (const row of current) {
    const sanitized = sanitizeRowModel(row || {});
    const key = sanitized.mst || row?._originalMst || "";

    if (!key) {
      preservedDrafts.push(cloneDraft(row));
      continue;
    }

    draftsByMst.set(
      key,
      cloneDraft({
        ...row,
        mst: sanitized.mst,
        company: sanitized.company,
        agents: sanitized.agents,
        agent: sanitized.agent,
      }),
    );
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
  merged.sort((left, right) => {
    const cmpCompany = (left.company || "").localeCompare(right.company || "", "vi", {
      sensitivity: "base",
    });
    if (cmpCompany !== 0) return cmpCompany;
    return (left.mst || "").localeCompare(right.mst || "");
  });

  return merged;
}

export function computeRowState(row, baselineMap, historyMap, now = Date.now()) {
  const draft = row || {};
  const normalizedDraft = sanitizeRowModel(draft);
  const baselineRow = draft._originalMst ? baselineMap.get(draft._originalMst) : null;
  const normalizedBaseline = baselineRow ? sanitizeRowModel(baselineRow) : null;

  const hasChanges = normalizedBaseline
    ? normalizedDraft.mst !== normalizedBaseline.mst ||
      normalizedDraft.company !== normalizedBaseline.company ||
      normalizedDraft.agent !== normalizedBaseline.agent
    : Boolean(normalizedDraft.mst || normalizedDraft.company || normalizedDraft.agent);

  const lookupKey = normalizedDraft.mst || normalizeMST(draft._originalMst);
  const historyList = lookupKey ? historyMap.get(lookupKey) || [] : [];
  const lastTimestamp = historyList.length ? new Date(historyList[0].timestamp).getTime() : 0;
  const isRecent =
    lastTimestamp && !Number.isNaN(lastTimestamp) && now - lastTimestamp <= RECENT_UPDATE_WINDOW;
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

export function suggestCompanyByMST(mst) {
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

export function formatHistoryTimestamp(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  try {
    return date.toLocaleString("vi-VN", { hour12: false });
  } catch (err) {
    console.warn("Khong the dinh dang thoi gian lich su Dai ly HQ", value, err);
    return date.toISOString();
  }
}
