import { useMemo } from "react";

import {
  buildAggregatedRowsByMST,
  buildDisplayList,
  buildGroupedStages,
} from "@/components/mst-assignment/model/displaySelectors.js";
import { MST_ASSIGNMENT_STATUS } from "@/lib/mstAssignments.js";

const EMPTY_SET = new Set();

const normalize = (value = "") =>
  value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const hasCoverageForAssignedState = (row, normalizeStr) => {
  const hasImport = Boolean(normalizeStr(row?.person_import || ""));
  const hasExport = Boolean(normalizeStr(row?.person_export || ""));

  return hasImport && hasExport;
};

function matchesAssignmentState(row, statusFilter, normalizeStr) {
  if (!statusFilter || statusFilter === "all") {
    return true;
  }

  const isAssigned = hasCoverageForAssignedState(row, normalizeStr);

  if (statusFilter === MST_ASSIGNMENT_STATUS.ASSIGNED || statusFilter === "assigned") {
    return isAssigned;
  }

  if (statusFilter === MST_ASSIGNMENT_STATUS.PENDING || statusFilter === "pending") {
    return !isAssigned;
  }

  return true;
}

export function filterAndPrioritizeRows({
  activeStatusFilter,
  leadViewFilter,
  historyFilteredRowKeys,
  makeRowKey,
  normalizeStr,
  recentlyImportedKeys = EMPTY_SET,
  rows = [],
  search = "",
  staffFilter = "",
}) {
  const query = normalize(search || "");
  const hasQuery = Boolean(query);
  const staffQuery = normalize(staffFilter || "");
  const hasStaffQuery = Boolean(staffQuery);
  const leadStatusFilter = leadViewFilter?.status || "all";
  const effectiveStatusFilter =
    leadStatusFilter !== "all" ? leadStatusFilter : activeStatusFilter;
  const teamQuery = normalize(leadViewFilter?.team || "");
  const hasTeamQuery = Boolean(teamQuery);

  const base = rows.filter((row) => {
    if (historyFilteredRowKeys) {
      const key = makeRowKey(row);
      if (!historyFilteredRowKeys.has(key)) {
        return false;
      }
    }

    if (!matchesAssignmentState(row, effectiveStatusFilter, normalizeStr)) {
      return false;
    }

    if (hasTeamQuery && normalize(row.team || "") !== teamQuery) {
      return false;
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

    if (!hasQuery) {
      return true;
    }

    return (
      normalize(row.mst).includes(query) ||
      normalize(row.company).includes(query) ||
      normalize(row.status || "").includes(query)
    );
  });

  return [...base].sort((a, b) => {
    const keyA = makeRowKey(a);
    const keyB = makeRowKey(b);
    const aIsNew = recentlyImportedKeys.has(keyA) ? 1 : 0;
    const bIsNew = recentlyImportedKeys.has(keyB) ? 1 : 0;

    if (aIsNew !== bIsNew) {
      return bIsNew - aIsNew;
    }

    const byMST = (a.mst || "").localeCompare(b.mst || "");
    if (byMST !== 0) {
      return byMST;
    }

    const fromCompare = (a.effective_from || "").localeCompare(b.effective_from || "");
    if (fromCompare !== 0) {
      return fromCompare;
    }

    return (a.effective_to || "9999-12-31").localeCompare(b.effective_to || "9999-12-31");
  });
}

export default function useMSTAssignmentDerivedRowsWorkspace({
  activeStatusFilter,
  groupByMST,
  leadViewFilter,
  historyFilteredRowKeys,
  makeRowKey,
  normalizeStr,
  recentlyImportedKeys,
  rows,
  search,
  staffFilter,
}) {
  const filtered = useMemo(
    () =>
      filterAndPrioritizeRows({
        activeStatusFilter,
        leadViewFilter,
        historyFilteredRowKeys,
        makeRowKey,
        normalizeStr,
        recentlyImportedKeys,
        rows,
        search,
        staffFilter,
      }),
    [
      activeStatusFilter,
      leadViewFilter,
      historyFilteredRowKeys,
      makeRowKey,
      normalizeStr,
      recentlyImportedKeys,
      rows,
      search,
      staffFilter,
    ]
  );

  const groupedStages = useMemo(() => buildGroupedStages(filtered), [filtered]);
  const aggregatedByMST = useMemo(
    () => buildAggregatedRowsByMST(groupedStages, groupByMST),
    [groupByMST, groupedStages]
  );
  const displayList = useMemo(
    () => buildDisplayList({ groupByMST, aggregatedByMST, filtered }),
    [aggregatedByMST, filtered, groupByMST]
  );

  return {
    aggregatedByMST,
    displayList,
    filtered,
    groupedStages,
  };
}
