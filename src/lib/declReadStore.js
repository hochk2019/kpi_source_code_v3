export function createDeclReadStore({
  getItem = () => null,
  setItem = () => {},
  refreshSharedKeys = async () => {},
  safeParse = (_json, fallback) => fallback,
  normalizeDeclRows = (rows) => (Array.isArray(rows) ? rows : []),
  applyAgenciesToDeclRows = (rows) => rows,
  declKey = "decl_rows_v1",
} = {}) {
  function getDeclRowsRaw() {
    const rawString = getItem(declKey);
    const stored = safeParse(rawString, []);
    const normalized = normalizeDeclRows(stored);

    try {
      const serialized = JSON.stringify(normalized);
      if (rawString !== serialized) {
        setItem(declKey, serialized);
      }
    } catch {
      // Bo qua loi tuan tu hoa, ham van tra ve du lieu da chuan hoa
    }

    return normalized;
  }

  function getDeclRows() {
    const rows = getDeclRowsRaw();
    return applyAgenciesToDeclRows(rows);
  }

  async function refreshDeclRowsFromServer(options = {}) {
    await refreshSharedKeys([declKey], options);
    const rows = getDeclRowsRaw();
    return applyAgenciesToDeclRows(rows);
  }

  function sortDeclRows(rows) {
    const arr = Array.isArray(rows) ? rows : [];

    const parseTime = (value) => {
      if (!value) return 0;
      const ts = Date.parse(value);
      return Number.isFinite(ts) ? ts : 0;
    };

    return arr
      .map((row, idx) => ({ row, idx, ts: parseTime(row?.date) }))
      .sort((a, b) => {
        if (a.ts !== b.ts) return b.ts - a.ts;

        const soA = (a.row?.so_tk ?? "").toString();
        const soB = (b.row?.so_tk ?? "").toString();
        if (soA !== soB) {
          const cmp = soB.localeCompare(soA, undefined, {
            numeric: true,
            sensitivity: "base",
          });
          if (cmp !== 0) return cmp;
        }

        const nhanhA = (a.row?.nhanh ?? "").toString();
        const nhanhB = (b.row?.nhanh ?? "").toString();
        if (nhanhA !== nhanhB) {
          const cmpNhanh = nhanhB.localeCompare(nhanhA, undefined, {
            numeric: true,
            sensitivity: "base",
          });
          if (cmpNhanh !== 0) return cmpNhanh;
        }

        return b.idx - a.idx;
      })
      .map((item) => item.row);
  }

  function getRecentDeclRows(limit = 20) {
    const sorted = sortDeclRows(getDeclRows());
    if (!Number.isFinite(limit) || limit <= 0) return sorted;
    return sorted.slice(0, limit);
  }

  function getData() {
    return getDeclRows();
  }

  return {
    getData,
    getDeclRows,
    getDeclRowsRaw,
    getRecentDeclRows,
    refreshDeclRowsFromServer,
    sortDeclRows,
  };
}
