import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import useDataImporterSavedHighlights from "@/components/dataImporter/useDataImporterSavedHighlights.js";

function createHook(overrides = {}) {
  return renderHook(() =>
    useDataImporterSavedHighlights({
      lastSyncSummary: null,
      mode: "saved",
      coMismatchKeySet: new Set(),
      hasDuplicate11Rows: false,
      setSelectedKeys: vi.fn(),
      setPage: vi.fn(),
      setFilterDuplicate11: vi.fn(),
      alertFn: vi.fn(),
      ...overrides,
    })
  );
}

describe("useDataImporterSavedHighlights", () => {
  it("derives last sync totals and preview data from summary payload", () => {
    const lastSyncSummary = {
      rowsFetched: 10,
      rowsInserted: 3,
      rowsUpdated: 2,
      rowsSkipped: 1,
      totalStored: 20,
      updatedDeclarations: [{ so_tk: "A" }, { so_tk: "B" }],
      updatedKeys: ["row-1", "row-2"],
    };

    const { result } = createHook({ lastSyncSummary });

    expect(result.current.lastSyncFetched).toBe(10);
    expect(result.current.lastSyncInserted).toBe(3);
    expect(result.current.lastSyncUpdated).toBe(2);
    expect(result.current.lastSyncSkipped).toBe(1);
    expect(result.current.lastSyncTotal).toBe(20);
    expect(result.current.updatedDeclarations).toEqual([{ so_tk: "A" }, { so_tk: "B" }]);
    expect(result.current.updatedKeys).toEqual(["row-1", "row-2"]);
    expect(Array.from(result.current.updatedKeySet)).toEqual(["row-1", "row-2"]);
    expect(result.current.updatedPreview).toEqual([{ so_tk: "A" }, { so_tk: "B" }]);
    expect(result.current.showUpdatedBanner).toBe(true);
  });

  it("selects updated or C/O mismatch rows in saved mode", () => {
    const setSelectedKeys = vi.fn();
    const setPage = vi.fn();
    const { result } = createHook({
      lastSyncSummary: { updatedKeys: ["row-1", "row-2"] },
      coMismatchKeySet: new Set(["row-3"]),
      setSelectedKeys,
      setPage,
    });

    result.current.handleSelectUpdated();
    result.current.handleSelectCoMismatches();

    expect(setSelectedKeys).toHaveBeenNthCalledWith(1, ["row-1", "row-2"]);
    expect(setSelectedKeys).toHaveBeenNthCalledWith(2, ["row-3"]);
    expect(setPage).toHaveBeenNthCalledWith(1, 1);
    expect(setPage).toHaveBeenNthCalledWith(2, 1);
  });

  it("alerts outside saved mode and toggles duplicate filter only when duplicates exist", () => {
    const alertFn = vi.fn();
    const setFilterDuplicate11 = vi.fn();
    const setPage = vi.fn();

    const notSaved = createHook({
      mode: "preview",
      lastSyncSummary: { updatedKeys: ["row-1"] },
      coMismatchKeySet: new Set(["row-2"]),
      alertFn,
      setPage,
      setFilterDuplicate11,
    });

    notSaved.result.current.handleSelectUpdated();
    notSaved.result.current.handleSelectCoMismatches();
    notSaved.result.current.handleToggleDuplicateFilter();

    expect(alertFn).toHaveBeenCalledTimes(3);
    expect(setPage).not.toHaveBeenCalled();
    expect(setFilterDuplicate11).not.toHaveBeenCalled();

    alertFn.mockClear();
    const saved = createHook({
      hasDuplicate11Rows: true,
      alertFn,
      setPage,
      setFilterDuplicate11,
    });

    saved.result.current.handleToggleDuplicateFilter();

    expect(alertFn).not.toHaveBeenCalled();
    expect(setFilterDuplicate11).toHaveBeenCalledTimes(1);
    expect(typeof setFilterDuplicate11.mock.calls[0][0]).toBe("function");
    expect(setFilterDuplicate11.mock.calls[0][0](false)).toBe(true);
    expect(setPage).toHaveBeenCalledWith(1);
  });
});
