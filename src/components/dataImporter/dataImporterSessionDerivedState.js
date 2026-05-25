import { filterDeclRows, normalizeDeclSearchFilters } from "../../../packages/domain/src/declSearch.js";

export function buildDataImporterSessionFilterState({
  query = "",
  normalizedQuickMST = "",
  normalizedQuickCompany = "",
  statusFilters = [],
  searchRange = { from: "", to: "" },
  filterNoStaff = false,
  filterNoTeam = false,
  filterDuplicate11 = false,
  coFilterMode = "all",
  coFilterMin = 0,
  showDeletedRows = false,
}) {
  const coThreshold = Math.max(0, Number(coFilterMin) || 0);
  const baseFilterInputs = {
    query,
    mst: normalizedQuickMST,
    company: normalizedQuickCompany,
    statuses: statusFilters,
    range: searchRange,
    noStaff: filterNoStaff,
    noTeam: filterNoTeam,
    duplicate: filterDuplicate11,
    coMode: coFilterMode,
    coMin: coThreshold,
  };
  const normalizedFilters = normalizeDeclSearchFilters({
    ...baseFilterInputs,
    includeDeleted: showDeletedRows,
  });

  return {
    coThreshold,
    baseFilterInputs,
    normalizedFilters,
  };
}

export function buildDataImporterSessionRowState({
  rawRows = [],
  mode = "saved",
  baseFilterInputs = null,
  serverSearchThreshold = 0,
}) {
  const deletedRowCount = Array.isArray(rawRows)
    ? rawRows.filter((row) => row && typeof row === "object" && row.deleted_at).length
    : 0;
  const softDeletedRows =
    Array.isArray(rawRows) && rawRows.length > 0 && baseFilterInputs
      ? filterDeclRows(rawRows, {
          ...baseFilterInputs,
          includeDeleted: true,
        }).filter((row) => row && row.deleted_at)
      : [];
  const shouldUseServerSearch =
    mode === "saved" && Array.isArray(rawRows) && rawRows.length > serverSearchThreshold;

  return {
    deletedRowCount,
    softDeletedRows,
    shouldUseServerSearch,
  };
}

export function buildDataImporterPageResetKey({
  pageSize = 0,
  quickMST = "",
  quickCompany = "",
  statusFilters = [],
  searchRange = { from: "", to: "" },
  filterNoStaff = false,
  filterNoTeam = false,
  filterDuplicate11 = false,
  coFilterMode = "all",
  coThreshold = 0,
  shouldUseServerSearch = false,
  showDeletedRows = false,
}) {
  return [
    pageSize,
    filterNoStaff,
    filterNoTeam,
    filterDuplicate11,
    coFilterMode,
    coThreshold,
    searchRange.from,
    searchRange.to,
    quickMST,
    quickCompany,
    statusFilters.join("|"),
    shouldUseServerSearch,
    showDeletedRows,
  ].join("::");
}

export function buildDataImporterSessionDerivedState({
  rawRows = [],
  mode = "saved",
  pageSize = 0,
  query = "",
  quickMST = "",
  quickCompany = "",
  normalizedQuickMST = "",
  normalizedQuickCompany = "",
  statusFilters = [],
  searchRange = { from: "", to: "" },
  filterNoStaff = false,
  filterNoTeam = false,
  filterDuplicate11 = false,
  coFilterMode = "all",
  coFilterMin = 0,
  showDeletedRows = false,
  serverSearchThreshold = 0,
}) {
  const filterState = buildDataImporterSessionFilterState({
    pageSize,
    query,
    quickMST,
    quickCompany,
    normalizedQuickMST,
    normalizedQuickCompany,
    statusFilters,
    searchRange,
    filterNoStaff,
    filterNoTeam,
    filterDuplicate11,
    coFilterMode,
    coFilterMin,
    showDeletedRows,
  });
  const rowState = buildDataImporterSessionRowState({
    rawRows,
    mode,
    baseFilterInputs: filterState.baseFilterInputs,
    serverSearchThreshold,
  });
  const pageResetKey = buildDataImporterPageResetKey({
    pageSize,
    quickMST,
    quickCompany,
    statusFilters,
    searchRange,
    filterNoStaff,
    filterNoTeam,
    filterDuplicate11,
    coFilterMode,
    coThreshold: filterState.coThreshold,
    shouldUseServerSearch: rowState.shouldUseServerSearch,
    showDeletedRows,
  });

  return {
    ...filterState,
    ...rowState,
    pageResetKey,
  };
}
