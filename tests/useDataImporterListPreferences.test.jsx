import { describe, expect, it, vi, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

import useDataImporterListPreferences from "@/components/dataImporter/useDataImporterListPreferences.js";

function createProps(overrides = {}) {
  return {
    columnHiddenSet: new Set(["agency"]),
    pageSize: 50,
    canOverwriteData: true,
    defaultPageSize: 20,
    maxPageSize: 500,
    viewModes: { TABLE: "table", CARD: "card" },
    cardGridColumnOptions: [1, 2, 3, 4],
    defaultCardGridColumns: 2,
    setColumnDraftHidden: vi.fn(),
    setColumnDraftError: vi.fn(),
    setColumnConfigOpen: vi.fn(),
    setPageSizeMode: vi.fn(),
    setPageSizeCustomInput: vi.fn(),
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    setViewMode: vi.fn(),
    setFreezeColumnsEnabled: vi.fn(),
    setCardGridColumns: vi.fn(),
    setShowDeletedRows: vi.fn(),
    setOverwrite: vi.fn(),
    confirmOverwrite: vi.fn(() => true),
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useDataImporterListPreferences", () => {
  it("opens column config with a cloned hidden set and cleared error state", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterListPreferences(props));

    act(() => {
      result.current.handleOpenColumnConfig();
    });

    expect(props.setColumnDraftHidden).toHaveBeenCalledTimes(1);
    const draftSet = props.setColumnDraftHidden.mock.calls[0][0];
    expect(draftSet).toEqual(new Set(["agency"]));
    expect(draftSet).not.toBe(props.columnHiddenSet);
    expect(props.setColumnDraftError).toHaveBeenCalledWith("");
    expect(props.setColumnConfigOpen).toHaveBeenCalledWith(true);
  });

  it("switches to custom page size mode and seeds the current page size", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterListPreferences(props));

    act(() => {
      result.current.handleToolbarPageSizeSelect("custom");
    });

    expect(props.setPageSizeMode).toHaveBeenCalledWith("custom");
    expect(props.setPageSizeCustomInput).toHaveBeenCalledTimes(1);
    const updater = props.setPageSizeCustomInput.mock.calls[0][0];
    expect(updater("")).toBe("50");
    expect(updater("120")).toBe("120");
    expect(props.setPage).toHaveBeenCalledWith(1);
  });

  it("normalizes toolbar preferences and clamps custom page size input", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterListPreferences(props));

    act(() => {
      result.current.handleToolbarViewModeChange("invalid");
      result.current.handleToolbarFreezeColumnsEnabledChange("yes");
      result.current.handleToolbarCardGridColumnsChange(99);
      result.current.handleToolbarPageSizeCustomInput("999");
      result.current.handleToolbarToggleShowDeletedRows();
    });

    expect(props.setViewMode).toHaveBeenCalledWith("table");
    expect(props.setFreezeColumnsEnabled).toHaveBeenCalledWith(true);
    expect(props.setCardGridColumns).toHaveBeenCalledWith(2);
    expect(props.setPageSizeCustomInput).toHaveBeenCalledWith("999");
    expect(props.setPage).toHaveBeenCalledWith(1);
    expect(props.setPageSize).toHaveBeenCalledWith(500);
    expect(props.setPageSizeCustomInput).toHaveBeenCalledWith("500");
    expect(props.setShowDeletedRows).toHaveBeenCalledTimes(1);
    const toggleUpdater = props.setShowDeletedRows.mock.calls[0][0];
    expect(toggleUpdater(false)).toBe(true);
  });

  it("guards overwrite mode behind permissions and confirmation", () => {
    const confirmOverwrite = vi.fn(() => false);
    const props = createProps({ confirmOverwrite });
    const { result } = renderHook(() => useDataImporterListPreferences(props));

    act(() => {
      result.current.handleOverwriteToggle(true);
    });

    expect(confirmOverwrite).toHaveBeenCalledTimes(1);
    expect(props.setOverwrite).not.toHaveBeenCalled();

    const deniedProps = createProps({ canOverwriteData: false });
    const { result: deniedResult } = renderHook(() => useDataImporterListPreferences(deniedProps));

    act(() => {
      deniedResult.current.handleOverwriteToggle(true);
    });

    expect(deniedProps.setOverwrite).toHaveBeenCalledWith(false);
  });
});
