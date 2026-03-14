import { describe, expect, it, vi, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

import useDataImporterSelectionActions from "@/components/dataImporter/useDataImporterSelectionActions.js";

function createProps(overrides = {}) {
  return {
    selectionEnabled: true,
    filteredKeys: ["row-1", "row-2"],
    selectedKeys: ["row-1"],
    rawRows: [
      { id: "row-1", reviewed: true },
      { id: "row-2", reviewed: false },
      { id: "row-3", reviewed: true },
    ],
    keyOfRow: (row) => row?.id ?? "",
    setSelectedKeys: vi.fn(),
    setPage: vi.fn(),
    isReadOnlyForEdits: false,
    isRowEditable: (row) => row?.id !== "locked",
    isRowReviewLocked: (row) => row?.id === "locked",
    reviewLockMessage: "Đã khóa rà soát",
    editingRestrictionMessage: "Không thể chỉnh sửa",
    toast: { warning: vi.fn() },
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useDataImporterSelectionActions", () => {
  it("derives filteredSelected and reviewed counts from the current selection", () => {
    const props = createProps({ selectedKeys: ["row-1", "row-2"] });
    const { result } = renderHook(() => useDataImporterSelectionActions(props));

    expect(result.current.filteredSelected).toBe(true);
    expect(result.current.selectedReviewedCount).toBe(1);
  });

  it("selects all filtered rows and resets paging", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterSelectionActions(props));

    act(() => {
      result.current.handleSelectFiltered();
    });

    expect(props.setSelectedKeys).toHaveBeenCalledWith(["row-1", "row-2"]);
    expect(props.setPage).toHaveBeenCalledWith(1);
  });

  it("warns for locked rows, toggles editable rows, and clears selection", () => {
    const props = createProps();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { result } = renderHook(() => useDataImporterSelectionActions(props));

    act(() => {
      result.current.handleToggleSelect({ id: "locked" });
      result.current.handleToggleSelect({ id: "row-2" });
      result.current.handleClearSelection();
    });

    expect(props.toast.warning).toHaveBeenCalledWith("Đã khóa rà soát");
    expect(alertSpy).not.toHaveBeenCalled();
    expect(props.setSelectedKeys).toHaveBeenNthCalledWith(1, expect.any(Function));
    expect(props.setSelectedKeys).toHaveBeenNthCalledWith(2, []);

    const updater = props.setSelectedKeys.mock.calls[0][0];
    expect(updater(["row-1"])).toEqual(["row-1", "row-2"]);
  });
});
