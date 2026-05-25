import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import useDataImporterRowEditing from "@/components/dataImporter/useDataImporterRowEditing.js";

function createProps(overrides = {}) {
  return {
    isReadOnlyForEdits: false,
    mode: "saved",
    rules: { mode: "test" },
    editingRestrictionMessage: "Không thể sửa dòng này.",
    isRowEditable: vi.fn(() => true),
    blockedEditNoticeRef: { current: new Set() },
    keyOfRow: vi.fn((row) => `${row.id}:${row.team}`),
    sanitizeRowUpdates: vi.fn((row, updates) => updates),
    shouldUseServerSearch: true,
    setServerSearchState: vi.fn(),
    setHasUnsaved: vi.fn(),
    setSelectedKeys: vi.fn(),
    setRawRows: vi.fn(),
    computeKPI: vi.fn(() => 12.34),
    ...overrides,
  };
}

describe("useDataImporterRowEditing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates saved rows, remaps selection, and refreshes matching server-search rows", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T09:10:11.000Z"));

    let currentRows = [
      { id: "row-1", team: "OPS", nhan_vien: "An", kpi: 1 },
      { id: "row-2", team: "SALES", nhan_vien: "Binh", kpi: 2 },
    ];
    const props = createProps({
      setRawRows: vi.fn((updater) => {
        currentRows = updater(currentRows);
        return currentRows;
      }),
    });

    const { result } = renderHook(() => useDataImporterRowEditing(props));

    act(() => {
      result.current.applyEdit("row-1:OPS", () => ({
        team: "CS",
        nhan_vien: "Lan",
      }));
    });

    expect(props.setRawRows).toHaveBeenCalledTimes(1);
    expect(currentRows).toEqual([
      {
        id: "row-1",
        team: "CS",
        nhan_vien: "Lan",
        kpi: 12.3,
        updatedAt: "2026-03-11T09:10:11.000Z",
      },
      { id: "row-2", team: "SALES", nhan_vien: "Binh", kpi: 2 },
    ]);

    expect(props.setSelectedKeys).toHaveBeenCalledTimes(1);
    const nextSelection = props.setSelectedKeys.mock.calls[0][0](["row-1:OPS", "row-2:SALES"]);
    expect(nextSelection).toEqual(["row-2:SALES"]);

    expect(props.setHasUnsaved).toHaveBeenCalledWith(true);
    expect(props.setServerSearchState).toHaveBeenCalledTimes(1);
    const nextServerState = props.setServerSearchState.mock.calls[0][0]({
      rows: [
        { id: "row-1", team: "OPS", nhan_vien: "An" },
        { id: "row-9", team: "OPS", nhan_vien: "Khac" },
      ],
      total: 2,
    });
    expect(nextServerState).toEqual({
      rows: [
        {
          id: "row-1",
          team: "CS",
          nhan_vien: "Lan",
          updatedAt: "2026-03-11T09:10:11.000Z",
          kpi: 12.3,
        },
        { id: "row-9", team: "OPS", nhan_vien: "Khac" },
      ],
      total: 2,
    });

    vi.useRealTimers();
  });

  it("alerts once and skips edits for blocked rows", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    let rows = [{ id: "row-1", team: "OPS", nhan_vien: "An" }];
    const props = createProps({
      isRowEditable: vi.fn(() => false),
      setRawRows: vi.fn((updater) => {
        rows = updater(rows);
        return rows;
      }),
    });

    const { result } = renderHook(() => useDataImporterRowEditing(props));

    act(() => {
      result.current.applyEdit("row-1:OPS", () => ({ team: "CS" }));
      result.current.applyEdit("row-1:OPS", () => ({ team: "IMPORT" }));
    });

    expect(props.setRawRows).toHaveBeenCalledTimes(2);
    expect(rows).toEqual([{ id: "row-1", team: "OPS", nhan_vien: "An" }]);
    expect(props.setSelectedKeys).not.toHaveBeenCalled();
    expect(props.setHasUnsaved).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith("Không thể sửa dòng này.");
  });
});
