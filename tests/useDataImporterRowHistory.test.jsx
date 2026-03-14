import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import useDataImporterRowHistory from "@/components/dataImporter/useDataImporterRowHistory.js";

function createProps(overrides = {}) {
  return {
    getDeclHistoryForRow: vi.fn(() => [{ at: "2026-03-11T00:00:00.000Z", field: "team" }]),
    historyEntryLimit: 5,
    ...overrides,
  };
}

describe("useDataImporterRowHistory", () => {
  it("loads history entries for a trimmed key", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterRowHistory(props));

    act(() => {
      result.current.refreshRowHistory(" row-1 ");
    });

    expect(props.getDeclHistoryForRow).toHaveBeenCalledWith("row-1", 5);
    expect(result.current.rowHistoryEntries).toEqual({
      "row-1": [{ at: "2026-03-11T00:00:00.000Z", field: "team" }],
    });
  });

  it("ignores blank keys when refreshing history", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterRowHistory(props));

    act(() => {
      result.current.refreshRowHistory("   ");
    });

    expect(props.getDeclHistoryForRow).not.toHaveBeenCalled();
    expect(result.current.rowHistoryEntries).toEqual({});
  });

  it("toggles expansion and only refreshes entries when opening", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterRowHistory(props));

    act(() => {
      result.current.handleToggleHistory("row-2");
    });

    expect(result.current.rowHistoryExpanded).toEqual({ "row-2": true });
    expect(props.getDeclHistoryForRow).toHaveBeenCalledTimes(1);
    expect(result.current.rowHistoryEntries["row-2"]).toEqual([
      { at: "2026-03-11T00:00:00.000Z", field: "team" },
    ]);

    act(() => {
      result.current.handleToggleHistory("row-2");
    });

    expect(result.current.rowHistoryExpanded).toEqual({ "row-2": false });
    expect(props.getDeclHistoryForRow).toHaveBeenCalledTimes(1);
  });
});
