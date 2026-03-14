import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import useDataImporterFilterPresets from "@/components/dataImporter/useDataImporterFilterPresets.js";
import {
  LAST_FILTER_PRESET_KEY,
  LEGACY_FILTER_STORAGE_KEY,
} from "@/components/dataImporter/dataImporterConfig.js";

function createPreset(overrides = {}) {
  return {
    id: "preset-1",
    name: "Preset A",
    updatedAt: "2026-03-11T08:00:00.000Z",
    filters: {
      query: "saved query",
      mst: "0312345678",
      company: "ACME Logistics",
      range: {
        from: "2026-03-01",
        to: "2026-03-05",
      },
      datePreset: "custom",
      filterNoStaff: true,
      filterNoTeam: false,
      filterDuplicate11: true,
      coFilterMode: "min",
      coFilterMin: 7,
      status: ["green", "amber"],
    },
    ...overrides,
  };
}

function createProps(overrides = {}) {
  return {
    savedPresets: [createPreset()],
    presetLoading: false,
    clearPresetError: vi.fn(),
    refreshPresetList: vi.fn(),
    createFilterPreset: vi.fn(async ({ name, filters }) => ({
      id: "preset-new",
      name,
      updatedAt: "2026-03-11T09:00:00.000Z",
      filters,
    })),
    updateFilterPreset: vi.fn(async (id, payload) => ({
      id,
      updatedAt: "2026-03-11T09:15:00.000Z",
      ...payload,
    })),
    deleteFilterPreset: vi.fn(async () => {}),
    datePreset: "none",
    query: "current query",
    quickMST: "0300123456",
    quickCompany: "Beta Co",
    statusFilters: ["red", "green"],
    searchRange: {
      from: "2026-03-07",
      to: "2026-03-10",
    },
    filterNoStaff: false,
    filterNoTeam: true,
    filterDuplicate11: true,
    coFilterMode: "min",
    coFilterMin: 9,
    setDatePreset: vi.fn(),
    setQuery: vi.fn(),
    setQuickMST: vi.fn(),
    setQuickCompany: vi.fn(),
    setStatusFilters: vi.fn(),
    setSearchRange: vi.fn(),
    setFilterNoStaff: vi.fn(),
    setFilterNoTeam: vi.fn(),
    setFilterDuplicate11: vi.fn(),
    setCoFilterMode: vi.fn(),
    setCoFilterMin: vi.fn(),
    setPage: vi.fn(),
    ...overrides,
  };
}

describe("useDataImporterFilterPresets", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("applies the selected preset and persists the applied preset id", () => {
    const props = createProps();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { result } = renderHook(() => useDataImporterFilterPresets(props));

    act(() => {
      result.current.handleSelectPreset("preset-1");
    });

    act(() => {
      result.current.handleApplySelectedPreset();
    });

    expect(props.clearPresetError).toHaveBeenCalled();
    expect(props.setQuery).toHaveBeenCalledWith("saved query");
    expect(props.setQuickMST).toHaveBeenCalledWith("0312345678");
    expect(props.setQuickCompany).toHaveBeenCalledWith("ACME Logistics");
    expect(props.setSearchRange).toHaveBeenCalledWith({
      from: "2026-03-01",
      to: "2026-03-05",
    });
    expect(props.setDatePreset).toHaveBeenCalledWith("custom");
    expect(props.setFilterNoStaff).toHaveBeenCalledWith(true);
    expect(props.setFilterNoTeam).toHaveBeenCalledWith(false);
    expect(props.setFilterDuplicate11).toHaveBeenCalledWith(true);
    expect(props.setCoFilterMode).toHaveBeenCalledWith("min");
    expect(props.setCoFilterMin).toHaveBeenCalledWith(7);
    expect(props.setStatusFilters).toHaveBeenCalledWith(["green", "amber"]);
    expect(props.setPage).toHaveBeenCalledWith(1);
    expect(result.current.selectedPresetId).toBe("preset-1");
    expect(result.current.appliedPreset?.id).toBe("preset-1");
    expect(window.localStorage.getItem(LAST_FILTER_PRESET_KEY)).toBe("preset-1");
    expect(alertSpy).toHaveBeenCalledWith('Đã áp dụng bộ lọc "Preset A".');
  });

  it("saves the current filter state as a new preset and reapplies it silently", async () => {
    const props = createProps();
    vi.spyOn(window, "prompt").mockReturnValue("Preset moi");
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { result } = renderHook(() => useDataImporterFilterPresets(props));

    await act(async () => {
      await result.current.handleSavePresetAsNew();
    });

    expect(props.createFilterPreset).toHaveBeenCalledWith({
      name: "Preset moi",
      filters: {
        datePreset: "none",
        coFilterMode: "min",
        coFilterMin: 9,
        query: "current query",
        mst: "0300123456",
        company: "Beta Co",
        range: {
          from: "2026-03-07",
          to: "2026-03-10",
        },
        filterNoTeam: true,
        filterDuplicate11: true,
        status: ["red", "green"],
      },
    });
    expect(props.setQuery).toHaveBeenCalledWith("current query");
    expect(window.localStorage.getItem(LAST_FILTER_PRESET_KEY)).toBe("preset-new");
    expect(alertSpy).toHaveBeenCalledWith('Đã lưu bộ lọc "Preset moi".');
  });

  it("imports the legacy localStorage filter into a saved preset and applies it", async () => {
    const props = createProps({
      savedPresets: [],
    });
    window.localStorage.setItem(
      LEGACY_FILTER_STORAGE_KEY,
      JSON.stringify({
        name: "Bộ lọc cũ",
        query: "legacy query",
        mst: "0102030405",
        company: "Legacy Co",
        range: {
          from: "2026-02-01",
          to: "2026-02-03",
        },
        filterNoStaff: true,
        status: "green, red",
        datePreset: "custom",
        coFilterMode: "min",
        coFilterMin: 6,
      })
    );

    renderHook(() => useDataImporterFilterPresets(props));

    await waitFor(() => {
      expect(props.createFilterPreset).toHaveBeenCalledTimes(1);
    });

    expect(props.createFilterPreset).toHaveBeenCalledWith({
      name: "Bộ lọc cũ",
      filters: {
        query: "legacy query",
        mst: "0102030405",
        company: "Legacy Co",
        range: {
          from: "2026-02-01",
          to: "2026-02-03",
        },
        filterNoStaff: true,
        status: ["green", "red"],
        datePreset: "custom",
        coFilterMode: "min",
        coFilterMin: 6,
      },
    });
    await waitFor(() => {
      expect(props.setQuery).toHaveBeenCalledWith("legacy query");
    });
    expect(window.localStorage.getItem(LEGACY_FILTER_STORAGE_KEY)).toBeNull();
  });
});
