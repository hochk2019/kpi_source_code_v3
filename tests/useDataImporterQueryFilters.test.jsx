import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import useDataImporterQueryFilters from "@/components/dataImporter/useDataImporterQueryFilters.js";

function createProps(overrides = {}) {
  return {
    query: "alpha",
    mainSearchHelpTextId: "search-help",
    datePreset: "none",
    dateRangePresets: [
      {
        key: "30d",
        label: "30 ngày",
        getRange: () => ({ from: "2026-02-10", to: "2026-03-11" }),
      },
    ],
    searchRange: { from: "", to: "" },
    filterNoStaff: true,
    filterNoTeam: false,
    coFilterMode: "min",
    coFilterMin: 5,
    coFilterActive: true,
    coFilterMatches: 12,
    coFilterOptions: [
      { value: "all", label: "Tất cả" },
      { value: "min", label: "Tối thiểu số dòng" },
    ],
    setQuery: vi.fn(),
    setPage: vi.fn(),
    setDatePreset: vi.fn(),
    setSearchRange: vi.fn(),
    setFilterNoStaff: vi.fn(),
    setFilterNoTeam: vi.fn(),
    setCoFilterMode: vi.fn(),
    setCoFilterMin: vi.fn(),
    ...overrides,
  };
}

describe("useDataImporterQueryFilters", () => {
  it("applies a date preset and updates the current range", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterQueryFilters(props));

    act(() => {
      result.current.queryFilterControlsProps.onDatePresetChange("30d");
    });

    expect(props.setDatePreset).toHaveBeenCalledWith("30d");
    expect(props.setSearchRange).toHaveBeenCalledWith({
      from: "2026-02-10",
      to: "2026-03-11",
    });
  });

  it("routes query and manual range changes through the expected setters", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterQueryFilters(props));

    act(() => {
      result.current.queryFilterControlsProps.onQueryChange("beta");
      result.current.queryFilterControlsProps.onClearQuery();
      result.current.queryFilterControlsProps.onDatePresetChange("custom");
      result.current.queryFilterControlsProps.onSearchRangeFromChange("2026-03-01");
      result.current.queryFilterControlsProps.onSearchRangeToChange("2026-03-05");
      result.current.queryFilterControlsProps.onClearSearchRange();
    });

    expect(props.setQuery).toHaveBeenNthCalledWith(1, "beta");
    expect(props.setQuery).toHaveBeenNthCalledWith(2, "");
    expect(props.setPage).toHaveBeenCalledTimes(2);
    expect(props.setPage).toHaveBeenNthCalledWith(1, 1);
    expect(props.setPage).toHaveBeenNthCalledWith(2, 1);
    expect(props.setDatePreset).toHaveBeenNthCalledWith(1, "custom");
    expect(props.setDatePreset).toHaveBeenNthCalledWith(2, "custom");
    expect(props.setDatePreset).toHaveBeenNthCalledWith(3, "custom");
    expect(props.setDatePreset).toHaveBeenNthCalledWith(4, "none");
    expect(props.setSearchRange).toHaveBeenNthCalledWith(1, expect.any(Function));
    expect(props.setSearchRange).toHaveBeenNthCalledWith(2, expect.any(Function));
    expect(props.setSearchRange).toHaveBeenNthCalledWith(3, { from: "", to: "" });
  });

  it("normalizes the C/O minimum threshold and preserves direct setter passthroughs", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterQueryFilters(props));

    act(() => {
      result.current.queryFilterControlsProps.onFilterNoStaffChange(false);
      result.current.queryFilterControlsProps.onFilterNoTeamChange(true);
      result.current.queryFilterControlsProps.onCoFilterModeChange("all");
      result.current.queryFilterControlsProps.onCoFilterMinChange("8.4");
      result.current.queryFilterControlsProps.onCoFilterMinChange("0");
    });

    expect(props.setFilterNoStaff).toHaveBeenCalledWith(false);
    expect(props.setFilterNoTeam).toHaveBeenCalledWith(true);
    expect(props.setCoFilterMode).toHaveBeenCalledWith("all");
    expect(props.setCoFilterMin).toHaveBeenNthCalledWith(1, 8);
    expect(props.setCoFilterMin).toHaveBeenNthCalledWith(2, 0);
  });
});
