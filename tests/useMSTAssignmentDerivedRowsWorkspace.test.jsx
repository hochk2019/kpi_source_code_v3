import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import useMSTAssignmentDerivedRowsWorkspace, {
  filterAndPrioritizeRows,
} from "@/components/mst-assignment/hooks/useMSTAssignmentDerivedRowsWorkspace.js";
import { MST_ASSIGNMENT_STATUS } from "@/lib/mstAssignments.js";
import { normalizeStr } from "@/lib/storeCoreHelpers.js";

describe("useMSTAssignmentDerivedRowsWorkspace", () => {
  it("filters rows by history, status, staff query, and search while prioritizing imported rows", () => {
    const rows = [
      {
        mst: "0312",
        company: "Cong ty Alpha",
        person_import: "Lan",
        person_export: "Binh",
        team: "North",
        effective_from: "2024-02-01",
        effective_to: "",
        status: "assigned",
      },
      {
        mst: "0311",
        company: "Cong ty Alpha Branch",
        person_import: "Lan",
        person_export: "Binh",
        team: "North",
        effective_from: "2024-01-01",
        effective_to: "",
        status: "assigned",
      },
      {
        mst: "0999",
        company: "Cong ty Beta",
        person_import: "Hai",
        person_export: "",
        team: "South",
        effective_from: "2024-03-01",
        effective_to: "",
        status: "pending",
      },
    ];

    const makeRowKey = (row) => `${row.mst}::${row.effective_from}`;
    const recentlyImportedKeys = new Set([makeRowKey(rows[0])]);
    const historyFilteredRowKeys = new Set([makeRowKey(rows[0]), makeRowKey(rows[1])]);

    expect(
      filterAndPrioritizeRows({
        activeStatusFilter: MST_ASSIGNMENT_STATUS.ASSIGNED,
        leadViewFilter: null,
        historyFilteredRowKeys,
        makeRowKey,
        normalizeStr,
        recentlyImportedKeys,
        rows,
        search: "alpha",
        staffFilter: "lan",
      })
    ).toEqual([rows[0], rows[1]]);
  });

  it("applies compact lead-view filters for current staffing state and team", () => {
    const rows = [
      {
        mst: "0310",
        company: "Cong ty Team Alpha",
        person_import: "Lan",
        person_export: "",
        team: "Alpha",
        effective_from: "2024-01-01",
        effective_to: "",
        status: "pending",
      },
      {
        mst: "0311",
        company: "Cong ty Team Alpha Assigned",
        person_import: "Lan",
        person_export: "Binh",
        team: "Alpha",
        effective_from: "2024-01-02",
        effective_to: "",
        status: "assigned",
      },
      {
        mst: "0312",
        company: "Cong ty Team Beta Pending",
        person_import: "Mai",
        person_export: "",
        team: "Beta",
        effective_from: "2024-01-03",
        effective_to: "",
        status: "pending",
      },
    ];

    expect(
      filterAndPrioritizeRows({
        activeStatusFilter: null,
        leadViewFilter: {
          enabled: true,
          status: "pending",
          team: "Alpha",
        },
        historyFilteredRowKeys: null,
        makeRowKey: (row) => `${row.mst}::${row.effective_from}`,
        normalizeStr,
        recentlyImportedKeys: new Set(),
        rows,
        search: "",
        staffFilter: "",
      }),
    ).toEqual([rows[0]]);
  });

  it("derives grouped and aggregated display data from the filtered rows", () => {
    const rows = [
      {
        mst: "0312",
        company: "Cong ty A",
        person_import: "Lan",
        person_export: "",
        team: "Alpha",
        effective_from: "2024-01-01",
        effective_to: "2024-01-31",
        status: "pending",
      },
      {
        mst: "0312",
        company: "Cong ty A",
        person_import: "Lan",
        person_export: "Binh",
        team: "Alpha",
        effective_from: "2024-02-01",
        effective_to: "",
        status: "assigned",
      },
      {
        mst: "0311",
        company: "Cong ty B",
        person_import: "Hai",
        person_export: "Mai",
        team: "Beta",
        effective_from: "2024-01-15",
        effective_to: "",
        status: "assigned",
      },
    ];

    const { result } = renderHook(() =>
      useMSTAssignmentDerivedRowsWorkspace({
        activeStatusFilter: null,
        groupByMST: true,
        leadViewFilter: null,
        historyFilteredRowKeys: null,
        makeRowKey: (row) => `${row.mst}::${row.effective_from}`,
        normalizeStr,
        recentlyImportedKeys: new Set(),
        rows,
        search: "",
        staffFilter: "",
      })
    );

    expect(result.current.filtered).toEqual([rows[2], rows[0], rows[1]]);
    expect(result.current.groupedStages).toEqual([
      {
        mst: "0311",
        company: "Cong ty B",
        stages: [rows[2]],
        conflictSummary: null,
      },
      {
        mst: "0312",
        company: "Cong ty A",
        stages: [rows[0], rows[1]],
        conflictSummary: null,
      },
    ]);
    expect(result.current.aggregatedByMST).toEqual([
      {
        ...rows[2],
        __group: true,
      },
      {
        ...rows[1],
        __group: true,
      },
    ]);
    expect(result.current.displayList).toEqual(result.current.aggregatedByMST);
  });

  it("returns the raw filtered rows as display list when group-by-MST is disabled", () => {
    const rows = [
      {
        mst: "0312",
        company: "Cong ty A",
        person_import: "Lan",
        person_export: "Binh",
        team: "Alpha",
        effective_from: "2024-02-01",
        effective_to: "",
        status: "assigned",
      },
    ];

    const { result } = renderHook(() =>
      useMSTAssignmentDerivedRowsWorkspace({
        activeStatusFilter: null,
        groupByMST: false,
        leadViewFilter: null,
        historyFilteredRowKeys: null,
        makeRowKey: (row) => `${row.mst}::${row.effective_from}`,
        normalizeStr,
        recentlyImportedKeys: new Set(),
        rows,
        search: "",
        staffFilter: "",
      })
    );

    expect(result.current.displayList).toBe(result.current.filtered);
    expect(result.current.displayList).toEqual(rows);
  });
});
