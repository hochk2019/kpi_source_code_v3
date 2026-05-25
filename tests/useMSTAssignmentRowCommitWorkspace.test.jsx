import React, { useState } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  saveMSTRow: vi.fn(),
}));

vi.mock("@/lib/store.js", async () => {
  const actual = await vi.importActual("@/lib/store.js");
  return {
    ...actual,
    saveMSTRow: storeMocks.saveMSTRow,
  };
});

import useMSTAssignmentRowCommitWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentRowCommitWorkspace.js";

function makeRowKey(row) {
  return `${row?.mst || ""}__${row?.effective_from || ""}__${row?.effective_to || ""}`;
}

function createRowState(row, meta = {}) {
  const base = {
    mst: String(row?.mst || "").replace(/\D/g, ""),
    company: String(row?.company || "").trim(),
    person_import: String(row?.person_import || "").trim(),
    person_export: String(row?.person_export || "").trim(),
    team: String(row?.team || "").trim(),
    effective_from: row?.effective_from || "",
    effective_to: row?.effective_to || "",
  };

  return {
    ...base,
    status: base.person_import || base.person_export ? "assigned" : "pending",
    __originalKey: meta.originalKey ?? (meta.isNew ? null : makeRowKey(base)),
    __isNew: Boolean(meta.isNew),
  };
}

function createBaselineRow(overrides = {}) {
  return createRowState(
    {
      mst: "0101234567",
      company: "Công ty A",
      person_import: "",
      person_export: "",
      team: "OPS",
      effective_from: "2025-03-01",
      effective_to: "",
      ...overrides,
    },
    { originalKey: "0101234567__2025-03-01__", isNew: false }
  );
}

function renderWorkspace(overrides = {}) {
  const alertFn = overrides.alertFn ?? vi.fn();
  const refreshHistory = overrides.refreshHistory ?? vi.fn();

  const view = renderHook(() => {
    const [rows, setRows] = useState(overrides.rows ?? [createBaselineRow()]);
    const [originalRows, setOriginalRows] = useState(
      overrides.originalRows ?? [createBaselineRow()]
    );
    const [recentlyImportedKeys, setRecentlyImportedKeys] = useState(
      overrides.recentlyImportedKeys ?? new Set([makeRowKey((overrides.rows ?? [createBaselineRow()])[0])])
    );

    const workspace = useMSTAssignmentRowCommitWorkspace({
      actor: "tester",
      createRowState,
      isReadOnly: overrides.isReadOnly ?? false,
      makeRowKey,
      normalizeStatusLabel: (value) => String(value || "").trim().toLowerCase(),
      normalizeStr: (value) => String(value || "").trim(),
      originalRows,
      refreshHistory,
      setOriginalRows,
      setRecentlyImportedKeys,
      setRows,
      tidyMST: (value) => String(value || "").replace(/\D/g, ""),
      alertFn,
    });

    return {
      rows,
      originalRows,
      recentlyImportedKeys,
      alertFn,
      refreshHistory,
      ...workspace,
    };
  });

  return {
    ...view,
    alertFn,
    refreshHistory,
  };
}

describe("useMSTAssignmentRowCommitWorkspace", () => {
  beforeEach(() => {
    storeMocks.saveMSTRow.mockReset();
  });

  it("alerts when there is no new change to save", () => {
    const { result, alertFn } = renderWorkspace();

    act(() => {
      result.current.commitRow(result.current.rows[0]);
    });

    expect(storeMocks.saveMSTRow).not.toHaveBeenCalled();
    expect(alertFn).toHaveBeenCalledWith("Không có thay đổi mới để lưu.");
  });

  it("persists a changed row and refreshes working/original state", () => {
    const changedRow = {
      ...createBaselineRow(),
      person_import: "Lan",
      status: "assigned",
    };

    storeMocks.saveMSTRow.mockReturnValue({
      ok: true,
      key: "0101234567__2025-03-01__",
      row: {
        ...changedRow,
      },
    });

    const { result, alertFn, refreshHistory } = renderWorkspace({
      rows: [changedRow],
    });

    act(() => {
      result.current.commitRow(result.current.rows[0]);
    });

    expect(storeMocks.saveMSTRow).toHaveBeenCalledWith(
      expect.objectContaining({
        mst: "0101234567",
        person_import: "Lan",
        status: "assigned",
      }),
      expect.objectContaining({
        actor: "tester",
        detail: "Cập nhật gán MST từ tab Gán MST",
        originalKey: "0101234567__2025-03-01__",
      })
    );
    expect(result.current.rows[0]).toMatchObject({
      person_import: "Lan",
      status: "assigned",
      __isNew: false,
      __originalKey: "0101234567__2025-03-01__",
    });
    expect(result.current.originalRows[0]).toMatchObject({
      person_import: "Lan",
      __isNew: false,
      __originalKey: "0101234567__2025-03-01__",
    });
    expect(result.current.recentlyImportedKeys.has("0101234567__2025-03-01__")).toBe(true);
    expect(refreshHistory).toHaveBeenCalledTimes(1);
    expect(alertFn).toHaveBeenCalledWith("Đã lưu thay đổi cho dòng này.");
  });

  it("surfaces save conflicts without mutating the original baseline", () => {
    const changedRow = {
      ...createBaselineRow(),
      effective_to: "2025-03-31",
    };

    storeMocks.saveMSTRow.mockReturnValue({
      ok: false,
      reason: "conflict",
    });

    const { result, alertFn, refreshHistory } = renderWorkspace({
      rows: [changedRow],
    });

    act(() => {
      result.current.commitRow(result.current.rows[0]);
    });

    expect(alertFn).toHaveBeenCalledWith(
      "MST và ngày áp dụng trùng với dòng khác. Vui lòng đổi ngày áp dụng hoặc kiểm tra dữ liệu hiện có."
    );
    expect(refreshHistory).not.toHaveBeenCalled();
    expect(result.current.originalRows[0]).toMatchObject({
      effective_to: "",
      __originalKey: "0101234567__2025-03-01__",
    });
  });
});
