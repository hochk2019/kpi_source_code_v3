import {
  getDeclRows,
  getMSTMap,
  normalizeMST,
  normalizeName,
  normalizeStr,
  sortDeclRows,
} from "@/lib/store.js";

export const MAX_DECLARATION_SUGGESTIONS = 200;

const COMPANY_FIELD_KEYS = new Set([
  "company",
  "cong ty",
  "ten cong ty",
  "ten doanh nghiep",
  "doanh nghiep",
  "customer",
]);

const MST_FIELD_KEYS = new Set(["mst", "ma so thue", "ma so thue (mst)", "tax code"]);

export function extractCompanyFromRow(row) {
  if (!row || typeof row !== "object") return "";

  const direct = normalizeStr(row?.company ?? row?.cong_ty ?? row?.customer ?? "");
  if (direct) return direct;

  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined || value === "") continue;
    const normalizedKey = normalizeName(key);
    if (!COMPANY_FIELD_KEYS.has(normalizedKey)) continue;
    const strValue = normalizeStr(value);
    if (strValue) return strValue;
  }

  return "";
}

export function extractDigits(value) {
  if (value === null || value === undefined) return "";
  return value.toString().replace(/\D+/g, "").trim();
}

export function extractMstFromRow(row) {
  if (!row || typeof row !== "object") return "";

  const direct = normalizeMST(row?.mst);
  if (direct) return direct;

  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined || value === "") continue;
    const normalizedKey = normalizeName(key);
    if (!MST_FIELD_KEYS.has(normalizedKey)) continue;
    const candidate = normalizeMST(value);
    if (candidate) return candidate;
  }

  return "";
}

export function buildDeclarationSuggestions(limit = MAX_DECLARATION_SUGGESTIONS) {
  const rows = sortDeclRows(getDeclRows());
  const suggestions = [];
  const seenKeys = new Set();
  const baseTime = Date.now();

  for (let index = 0; index < rows.length && suggestions.length < limit; index += 1) {
    const row = rows[index];
    if (!row) continue;

    const rawNumber = row?.so_tk_full ?? row?.so_tk ?? "";
    const soTk = normalizeStr(rawNumber);
    const soTkDigits = extractDigits(rawNumber);
    if (!soTk && !soTkDigits) continue;

    const branch = normalizeStr(row?.nhanh ?? row?.branch ?? "");
    const key = `${soTkDigits || soTk}|${branch}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const mst = extractMstFromRow(row);
    const company = extractCompanyFromRow(row);
    const parsedTs = row?.date ? Date.parse(row.date) : Number.NaN;
    const timestamp = Number.isFinite(parsedTs) ? parsedTs : baseTime - index;

    suggestions.push({
      key,
      soTk,
      soTkDigits,
      branch,
      mst,
      company,
      date: row?.date || "",
      timestamp,
    });
  }

  return suggestions;
}

export function buildBusinessDirectory(declarationSuggestions = null) {
  const byMst = new Map();
  const byCompany = new Map();

  const registerEntry = (mstValue, companyValue, timestamp = 0) => {
    const mst = normalizeMST(mstValue || "");
    const company = normalizeStr(companyValue || "");
    if (!mst && !company) return;

    if (mst) {
      if (!byMst.has(mst)) {
        byMst.set(mst, { mst, company: company || "", lastSeen: timestamp });
      }
      const entry = byMst.get(mst);
      if (company && (!entry.company || timestamp >= entry.lastSeen)) {
        entry.company = company;
        entry.lastSeen = timestamp;
      }
    }

    if (company) {
      const companyKey = normalizeName(company);
      if (!byCompany.has(companyKey)) {
        byCompany.set(companyKey, {
          company,
          normalized: companyKey,
          msts: new Set(),
          lastSeen: timestamp,
        });
      }
      const companyEntry = byCompany.get(companyKey);
      if (timestamp >= companyEntry.lastSeen) {
        companyEntry.company = company;
        companyEntry.lastSeen = timestamp;
      }
      if (mst) {
        companyEntry.msts.add(mst);
        const mstEntry = byMst.get(mst);
        if (mstEntry && !mstEntry.company) {
          mstEntry.company = company;
        }
      }
    }
  };

  const mstRows = getMSTMap();
  const mstBaseTs = Date.now();
  mstRows.forEach((row, index) => {
    if (!row) return;
    registerEntry(row.mst, row.company, mstBaseTs + index);
  });

  const declSuggestions = Array.isArray(declarationSuggestions)
    ? declarationSuggestions
    : buildDeclarationSuggestions(MAX_DECLARATION_SUGGESTIONS);
  declSuggestions.forEach((item, index) => {
    if (!item) return;
    registerEntry(item.mst, item.company, (item.timestamp ?? 0) - index);
  });

  const entries = Array.from(byMst.values()).sort((a, b) => {
    if (a.company && b.company && a.company !== b.company) {
      return a.company.localeCompare(b.company, "vi", { sensitivity: "base" });
    }
    if (a.company && !b.company) return -1;
    if (!a.company && b.company) return 1;
    return a.mst.localeCompare(b.mst);
  });

  const companyDirectory = new Map();
  for (const [key, value] of byCompany.entries()) {
    companyDirectory.set(key, {
      company: value.company,
      normalized: key,
      msts: new Set(value.msts),
      lastSeen: value.lastSeen,
    });
  }

  return { entries, byMst, byCompany: companyDirectory };
}
