import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import useMSTAssignmentDerivedRowsWorkspace, {
  filterAndPrioritizeRows,
} from "@/components/mst-assignment/hooks/useMSTAssignmentDerivedRowsWorkspace.js";
import { MST_ASSIGNMENT_STATUS, normalizeStr } from "@/lib/store.js";

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
      },
      {
        mst: "0312",
        company: "Cong ty A",
        stages: [rows[0], rows[1]],
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
