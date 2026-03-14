import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import useDataImporterSavedSession from "@/components/dataImporter/useDataImporterSavedSession.js";

function createProps(overrides = {}) {
  const fileRef = overrides.fileRef ?? { current: { value: "selected.xlsx" } };

  return {
    fileRef,
    hasUnsaved: false,
    mode: "saved",
    rawRowsLength: 1,
    defaultCoFilterMin: 5,
    loadRules: vi.fn(() => ({ license: { exclude: { codes: ["E01"] } } })),
    getDeclRows: vi.fn(() => [
      { so_tk: "TK-002", date: "2025-01-02" },
      { so_tk: "TK-001", date: "2025-01-01" },
    ]),
    sortDeclRows: vi.fn((rows) => [...rows].sort((a, b) => a.so_tk.localeCompare(b.so_tk))),
    ensureLicenseFields: vi.fn((row) => ({ ...row, licenseReady: true })),
    ensureCOFields: vi.fn((row) => ({ ...row, coReady: true })),
    updateBaselineSnapshot: vi.fn(),
    setRules: vi.fn(),
    setRawRows: vi.fn(),
    setRowSaveStatus: vi.fn(),
    setRowHistoryExpanded: vi.fn(),
    setRowHistoryEntries: vi.fn(),
    setMode: vi.fn(),
    setPage: vi.fn(),
    setQuery: vi.fn(),
    setSelectedFile: vi.fn(),
    setFilterNoStaff: vi.fn(),
    setFilterNoTeam: vi.fn(),
    setFilterDuplicate11: vi.fn(),
    setCoFilterMode: vi.fn(),
    setCoFilterMin: vi.fn(),
    setSelectedKeys: vi.fn(),
    setHasUnsaved: vi.fn(),
    ...overrides,
  };
}

describe("useDataImporterSavedSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads saved rows and resets the saved-session UI state", async () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterSavedSession(props));

    let loaded = false;
    await act(async () => {
      loaded = result.current.loadSavedRows();
    });

    expect(loaded).toBe(true);
    expect(props.loadRules).toHaveBeenCalledTimes(1);
    expect(props.setRules).toHaveBeenCalledWith({ license: { exclude: { codes: ["E01"] } } });
    expect(props.setRawRows).toHaveBeenCalledWith([
      { so_tk: "TK-001", date: "2025-01-01", licenseReady: true, coReady: true },
      { so_tk: "TK-002", date: "2025-01-02", licenseReady: true, coReady: true },
    ]);
    expect(props.updateBaselineSnapshot).toHaveBeenCalledWith([
      { so_tk: "TK-001", date: "2025-01-01", licenseReady: true, coReady: true },
      { so_tk: "TK-002", date: "2025-01-02", licenseReady: true, coReady: true },
    ]);
    expect(props.setRowSaveStatus).toHaveBeenCalledWith({});
    expect(props.setRowHistoryExpanded).toHaveBeenCalledWith({});
    expect(props.setRowHistoryEntries).toHaveBeenCalledWith({});
    expect(props.setMode).toHaveBeenCalledWith("saved");
    expect(props.setPage).toHaveBeenCalledWith(1);
    expect(props.setQuery).toHaveBeenCalledWith("");
    expect(props.setSelectedFile).toHaveBeenCalledWith("");
    expect(props.setFilterNoStaff).toHaveBeenCalledWith(false);
    expect(props.setFilterNoTeam).toHaveBeenCalledWith(false);
    expect(props.setFilterDuplicate11).toHaveBeenCalledWith(false);
    expect(props.setCoFilterMode).toHaveBeenCalledWith("all");
    expect(props.setCoFilterMin).toHaveBeenCalledWith(5);
    expect(props.setSelectedKeys).toHaveBeenCalledWith([]);
    expect(props.setHasUnsaved).toHaveBeenCalledWith(false);
    expect(props.fileRef.current.value).toBe("");
  });

  it("prompts before discarding unsaved saved-mode edits", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const props = createProps({
      hasUnsaved: true,
      mode: "saved",
    });
    const { result } = renderHook(() => useDataImporterSavedSession(props));

    let loaded = true;
    await act(async () => {
      loaded = result.current.loadSavedRows();
    });

    expect(loaded).toBe(false);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(props.setRawRows).not.toHaveBeenCalled();
    expect(props.fileRef.current.value).toBe("");
  });

  it("auto-loads saved rows on mount and clears duplicate-only filter when leaving saved mode", async () => {
    const props = createProps({
      hasUnsaved: false,
      mode: "saved",
      rawRowsLength: 0,
    });
    const { rerender } = renderHook((hookProps) => useDataImporterSavedSession(hookProps), {
      initialProps: props,
    });

    await waitFor(() => {
      expect(props.setRawRows).toHaveBeenCalledTimes(1);
    });

    const nextProps = {
      ...props,
      mode: "preview",
      rawRowsLength: 2,
    };

    rerender(nextProps);

    await waitFor(() => {
      expect(props.setFilterDuplicate11).toHaveBeenCalledWith(false);
    });
  });
});
