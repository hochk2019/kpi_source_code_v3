// src/shared/declSearch.js
import { coLineCount } from "./co.js";

function normalizeWhitespace(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value)
    .replace(/\s+/gu, " ")
    .trim();
}

export function normalizeStatusKey(status) {
  if (status === null || status === undefined) {
    return "";
  }
  return normalizeWhitespace(status).toLowerCase();
}

export function normalizeDeclarationNumber(input, length = 11) {
  const raw = (input ?? "").toString();
  if (!raw.trim()) return "";
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  const maxLength = Number.isFinite(length) && length > 0 ? length : 11;
  if (digits.length >= maxLength) {
    return digits.slice(0, maxLength);
  }
  return digits.padStart(maxLength, "0");
}

function normalizeDateInput(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return "";
  return normalized.slice(0, 10);
}

function buildAgencySearchString(row) {
  if (!row || typeof row !== "object") {
    return "";
  }
  const parts = [];
  if (row.agency) parts.push(row.agency);
  if (row.dai_ly) parts.push(row.dai_ly);
  if (Array.isArray(row.agents)) {
    for (const agent of row.agents) {
      if (agent) parts.push(agent);
    }
  }
  return normalizeWhitespace(parts.join(" ")).toLowerCase();
}

function extractDuplicatePrefix(row) {
  return normalizeDeclarationNumber(row?.so_tk_full ?? row?.so_tk ?? "", 11);
}

export function computeDuplicatePrefixCounts(rows) {
  const counts = new Map();
  if (!Array.isArray(rows)) {
    return counts;
  }
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const prefix = extractDuplicatePrefix(row);
    if (!prefix) continue;
    counts.set(prefix, (counts.get(prefix) || 0) + 1);
  }
  return counts;
}

function parseBooleanInput(value) {
  if (value === true) {
    return true;
  }
  if (value === false) {
    return false;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return false;
    }
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    if (["1", "true", "yes", "y", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "n", "off"].includes(normalized)) {
      return false;
    }
    return false;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (parseBooleanInput(entry)) {
        return true;
      }
    }
    return false;
  }
  return false;
}

function prepareFilters(rawFilters = {}) {
  const normalized = {
    query: typeof rawFilters.query === "string" ? rawFilters.query.trim() : "",
    mst: typeof rawFilters.mst === "string" ? rawFilters.mst.trim() : "",
    company: typeof rawFilters.company === "string" ? rawFilters.company.trim() : "",
    statuses: Array.isArray(rawFilters.statuses)
      ? rawFilters.statuses
      : typeof rawFilters.status === "string"
      ? rawFilters.status.split(",")
      : [],
    range: rawFilters.range && typeof rawFilters.range === "object" ? rawFilters.range : {},
    noStaff:
      parseBooleanInput(rawFilters.noStaff) ||
      parseBooleanInput(rawFilters.filterNoStaff),
    noTeam:
      parseBooleanInput(rawFilters.noTeam) ||
      parseBooleanInput(rawFilters.filterNoTeam),
    duplicate:
      parseBooleanInput(rawFilters.duplicate) ||
      parseBooleanInput(rawFilters.filterDuplicate11),
    coMode: typeof rawFilters.coMode === "string" ? rawFilters.coMode.trim().toLowerCase() : "all",
    coMin: rawFilters.coMin,
  };

  const statusList = [];
  for (const status of normalized.statuses) {
    const key = normalizeStatusKey(status);
    if (key) {
      statusList.push(key);
    }
  }
  normalized.statusSet = statusList.length ? new Set(statusList) : null;

  const from = typeof normalized.range.from === "string" ? normalized.range.from : rawFilters.from;
  const to = typeof normalized.range.to === "string" ? normalized.range.to : rawFilters.to;
  normalized.rangeFrom = normalizeDateInput(from);
  normalized.rangeTo = normalizeDateInput(to);

  normalized.queryLower = normalized.query.toLowerCase();
  normalized.mstNeedle = normalizeWhitespace(normalized.mst).toLowerCase();
  normalized.companyNeedle = normalizeWhitespace(normalized.company).toLowerCase();

  if (normalized.coMode !== "has" && normalized.coMode !== "min") {
    normalized.coMode = "all";
  }
  const rawCoMin = Number(rawFilters.coMin ?? rawFilters.coThreshold ?? rawFilters.coFilterMin);
  const coMin = Number.isFinite(rawCoMin) ? Math.max(0, Math.round(rawCoMin)) : 0;
  normalized.coMinValue = coMin;

  return normalized;
}

export function normalizeDeclSearchFilters(rawFilters = {}) {
  const normalized = prepareFilters(rawFilters);
  return {
    query: normalized.query,
    mst: normalized.mst,
    company: normalized.company,
    statuses: normalized.statusSet ? Array.from(normalized.statusSet) : [],
    range: {
      from: normalized.rangeFrom,
      to: normalized.rangeTo,
    },
    noStaff: normalized.noStaff,
    noTeam: normalized.noTeam,
    duplicate: normalized.duplicate,
    coMode: normalized.coMode,
    coMin: normalized.coMinValue,
  };
}

export function filterDeclRows(rows, rawFilters = {}, context = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const filters = prepareFilters(rawFilters);
  const duplicateCounts = filters.duplicate
    ? context.duplicateCounts instanceof Map
      ? context.duplicateCounts
      : computeDuplicatePrefixCounts(list)
    : null;

  const result = [];
  for (const row of list) {
    if (!row || typeof row !== "object") {
      continue;
    }

    if (filters.queryLower) {
      const soTk = (row.so_tk ?? "").toString().toLowerCase();
      const soTkFull = (row.so_tk_full ?? "").toString().toLowerCase();
      const mstRaw = (row.mst ?? row.ma_so_thue ?? "").toString().toLowerCase();
      const companyRaw = (row.cong_ty ?? row.company ?? row.ten_cong_ty ?? row.doanh_nghiep ?? "").toString().toLowerCase();
      const staffRaw = (row.nhan_vien ?? row.staff ?? "").toString().toLowerCase();
      const teamRaw = (row.team ?? row.to_doi ?? row.bo_phan ?? "").toString().toLowerCase();
      const agencySearch = buildAgencySearchString(row);
      if (
        !soTk.includes(filters.queryLower) &&
        !soTkFull.includes(filters.queryLower) &&
        !mstRaw.includes(filters.queryLower) &&
        !companyRaw.includes(filters.queryLower) &&
        !staffRaw.includes(filters.queryLower) &&
        !teamRaw.includes(filters.queryLower) &&
        !agencySearch.includes(filters.queryLower)
      ) {
        continue;
      }
    }

    if (filters.mstNeedle) {
      const mstNormalized = normalizeWhitespace(row.mst ?? row.ma_so_thue ?? "").toLowerCase();
      if (!mstNormalized.includes(filters.mstNeedle)) {
        continue;
      }
    }

    if (filters.companyNeedle) {
      const companyNormalized = normalizeWhitespace(
        row.cong_ty ?? row.company ?? row.ten_cong_ty ?? row.doanh_nghiep ?? ""
      ).toLowerCase();
      if (!companyNormalized.includes(filters.companyNeedle)) {
        continue;
      }
    }

    if (filters.statusSet) {
      const status = normalizeStatusKey(
        row.status ?? row.trang_thai ?? row.previewStatus ?? row.importStatus ?? row.state ?? ""
      );
      if (!filters.statusSet.has(status)) {
        continue;
      }
    }

    if (filters.rangeFrom || filters.rangeTo) {
      const rowDate = normalizeDateInput(row.date ?? row.raw_date ?? "");
      if (filters.rangeFrom && (!rowDate || rowDate < filters.rangeFrom)) {
        continue;
      }
      if (filters.rangeTo && (!rowDate || rowDate > filters.rangeTo)) {
        continue;
      }
    }

    if (filters.noStaff) {
      const staff = normalizeWhitespace(row.nhan_vien ?? "");
      if (staff) {
        continue;
      }
    }

    if (filters.noTeam) {
      const team = normalizeWhitespace(row.team ?? "");
      if (team) {
        continue;
      }
    }

    if (filters.coMode === "has") {
      if (coLineCount(row) <= 0) {
        continue;
      }
    } else if (filters.coMode === "min") {
      if (coLineCount(row) < filters.coMinValue) {
        continue;
      }
    }

    if (duplicateCounts) {
      const prefix = extractDuplicatePrefix(row);
      if (!prefix) {
        continue;
      }
      if ((duplicateCounts.get(prefix) || 0) <= 1) {
        continue;
      }
    }

    result.push(row);
  }
  return result;
}
