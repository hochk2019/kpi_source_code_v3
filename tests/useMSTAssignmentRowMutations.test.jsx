import React, { useState } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import useMSTAssignmentRowMutations from "@/components/mst-assignment/hooks/useMSTAssignmentRowMutations.js";

function makeRowKey(row) {
  return `${row?.mst || ""}__${row?.effective_from || ""}__${row?.effective_to || ""}`;
}

function createRows() {
  return [
    {
      mst: "0101234567",
      company: "Công ty A",
      person_import: "",
      person_export: "",
      team: "",
      effective_from: "2025-03-01",
      effective_to: "",
      status: "pending",
      __originalKey: "0101234567__2025-03-01__",
      __isNew: true,
    },
  ];
}

function renderWorkspace(overrides = {}) {
  const alertFn = overrides.alertFn ?? vi.fn();
  const confirmFn = overrides.confirmFn ?? vi.fn(() => true);

  const view = renderHook(() => {
    const [rows, setRows] = useState(overrides.rows ?? createRows());
    const [recentlyImportedKeys, setRecentlyImportedKeys] = useState(
      overrides.recentlyImportedKeys ?? new Set([makeRowKey(rows[0])])
    );

    const workspace = useMSTAssignmentRowMutations({
      computeStoredStatus:
        overrides.computeStoredStatus ??
        ((row) => (row.person_import || row.person_export ? "assigned" : "pending")),
      helpers: {
        makeRowKey,
        normalizeName: (value) => String(value || "").trim().toLowerCase(),
        normalizeStr: (value) => String(value || "").trim(),
        tidyMST: (value) => String(value || "").replace(/\D/g, ""),
      },
      isReadOnly: overrides.isReadOnly ?? false,
      setRecentlyImportedKeys,
      setRows,
      alertFn,
      confirmFn,
    });

    return {
      rows,
      recentlyImportedKeys,
      alertFn,
      confirmFn,
      ...workspace,
    };
  });

  return {
    ...view,
    alertFn,
    confirmFn,
  };
}

describe("useMSTAssignmentRowMutations", () => {
  it("updates rows, recomputes status, and migrates imported keys when the row key changes", () => {
    const { result, alertFn } = renderWorkspace();

    act(() => {
      result.current.updateRow(result.current.rows[0], {
        mst: "0109999999",
        person_import: "Lan",
      });
    });

    expect(alertFn).not.toHaveBeenCalled();
    expect(result.current.rows[0]).toMatchObject({
      mst: "0109999999",
      person_import: "Lan",
      status: "assigned",
      __isNew: true,
    });
    expect(result.current.recentlyImportedKeys.has("0101234567__2025-03-01__")).toBe(false);
    expect(result.current.recentlyImportedKeys.has("0109999999__2025-03-01__")).toBe(true);
  });

  it("builds assignee patches and removes rows through confirm-protected actions", () => {
    const { result, confirmFn } = renderWorkspace();

    act(() => {
      result.current.handleRowImportSelect(result.current.rows[0], {
        staffName: "Lan",
        teamName: "OPS",
        isCustom: false,
      });
    });

    expect(result.current.rows[0]).toMatchObject({
      person_import: "Lan",
      team: "OPS",
      status: "assigned",
    });

    act(() => {
      result.current.removeRow(result.current.rows[0]);
    });

    expect(confirmFn).toHaveBeenCalledWith("Xóa dòng 0101234567 (2025-03-01 → …)?");
    expect(result.current.rows).toHaveLength(0);
    expect(result.current.recentlyImportedKeys.size).toBe(0);
  });
});
