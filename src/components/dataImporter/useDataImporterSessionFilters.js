import { useMemo } from "react";

import { normalizeStr } from "@/lib/storeCoreHelpers.js";
import { coLineCount } from "../../../packages/domain/src/co.js";
import useDataImporterDeletedRows from "@/components/dataImporter/useDataImporterDeletedRows.js";
import { buildDataImporterCoFilterSummary } from "@/components/dataImporter/dataImporterCoFilterSummary.js";
import useDataImporterQueryFilters from "@/components/dataImporter/useDataImporterQueryFilters.js";
import {
  buildDataImporterPageResetKey,
  buildDataImporterSessionFilterState,
  buildDataImporterSessionRowState,
} from "@/components/dataImporter/dataImporterSessionDerivedState.js";
import {
  CO_FILTER_OPTIONS,
  DATE_RANGE_PRESETS,
  SERVER_SEARCH_THRESHOLD,
} from "@/components/dataImporter/dataImporterConfig.js";

export default function useDataImporterSessionFilters({
  rawRows,
  mode,
  pageSize,
  query,
  quickMST,
  quickCompany,
  statusFilters,
  searchRange,
  filterNoStaff,
  filterNoTeam,
  filterDuplicate11,
  coFilterMode,
  coFilterMin,
  showDeletedRows,
  fetchWithAuth,
  filterDeclRows,
  keyOfRow,
  extractErrorMessage,
  formatDateTime,
  formatDisplayDate,
  formatDateRangeLabel,
  mainSearchHelpTextId,
  datePreset,
  setQuery,
  setPage,
  setDatePreset,
  setSearchRange,
  setFilterNoStaff,
  setFilterNoTeam,
  setCoFilterMode,
  setCoFilterMin,
}) {
  const normalizedQuickMST = useMemo(() => normalizeStr(quickMST), [quickMST]);
  const normalizedQuickCompany = useMemo(() => normalizeStr(quickCompany), [quickCompany]);

  const { coThreshold, baseFilterInputs, normalizedFilters } = useMemo(
    () =>
      buildDataImporterSessionFilterState({
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
      }),
    [
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
    ],
  );

  const { deletedRowCount, softDeletedRows, shouldUseServerSearch } = useMemo(
    () =>
      buildDataImporterSessionRowState({
        rawRows,
        mode,
        baseFilterInputs,
        serverSearchThreshold: SERVER_SEARCH_THRESHOLD,
      }),
    [rawRows, mode, baseFilterInputs],
  );

  const pageResetKey = useMemo(
    () =>
      buildDataImporterPageResetKey({
        pageSize,
        quickMST,
        quickCompany,
        statusFilters,
        searchRange,
        filterNoStaff,
        filterNoTeam,
        filterDuplicate11,
        coFilterMode,
        coThreshold,
        shouldUseServerSearch,
        showDeletedRows,
      }),
    [
      pageSize,
      quickMST,
      quickCompany,
      statusFilters,
      searchRange,
      filterNoStaff,
      filterNoTeam,
      filterDuplicate11,
      coFilterMode,
      coThreshold,
      shouldUseServerSearch,
      showDeletedRows,
    ],
  );

  const deletedRows = useDataImporterDeletedRows({
    searchRange,
    softDeletedRows,
    baseFilterInputs,
    fetchWithAuth,
    filterDeclRows,
    keyOfRow,
    extractErrorMessage,
    formatDateTime,
    formatDisplayDate,
    formatDateRangeLabel,
  });

  const { coFilterActive, coFilterMatches } = useMemo(
    () =>
      buildDataImporterCoFilterSummary({
        rawRows,
        coFilterMode,
        coThreshold,
        getCoLineCount: coLineCount,
      }),
    [rawRows, coFilterMode, coThreshold],
  );

  const { queryFilterControlsProps } = useDataImporterQueryFilters({
    query,
    mainSearchHelpTextId,
    datePreset,
    dateRangePresets: DATE_RANGE_PRESETS,
    searchRange,
    filterNoStaff,
    filterNoTeam,
    coFilterMode,
    coFilterMin,
    coFilterActive,
    coFilterMatches,
    coFilterOptions: CO_FILTER_OPTIONS,
    setQuery,
    setPage,
    setDatePreset,
    setSearchRange,
    setFilterNoStaff,
    setFilterNoTeam,
    setCoFilterMode,
    setCoFilterMin,
  });

  return {
    deletedRowCount,
    baseFilterInputs,
    normalizedFilters,
    shouldUseServerSearch,
    pageResetKey,
    queryFilterControlsProps,
    ...deletedRows,
  };
}
