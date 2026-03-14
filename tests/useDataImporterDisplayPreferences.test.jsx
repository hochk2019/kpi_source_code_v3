import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import useDataImporterDisplayPreferences from "@/components/dataImporter/useDataImporterDisplayPreferences.js";
import {
  DEFAULT_CARD_GRID_COLUMNS,
  DEFAULT_PAGE_SIZE,
  FREEZE_COLUMNS_STORAGE_KEY,
  GRID_COLUMNS_STORAGE_KEY,
  PAGE_SIZE_STORAGE_KEY,
  VIEW_MODES,
  VIEW_MODE_STORAGE_KEY,
} from "@/components/dataImporter/dataImporterConfig.js";

describe("useDataImporterDisplayPreferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("hydrates display preferences from localStorage and clamps page size", () => {
    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, "999");
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, VIEW_MODES.CARD);
    window.localStorage.setItem(FREEZE_COLUMNS_STORAGE_KEY, "0");
    window.localStorage.setItem(GRID_COLUMNS_STORAGE_KEY, "3");

    const { result } = renderHook(() => useDataImporterDisplayPreferences());

    expect(result.current.pageSize).toBe(200);
    expect(result.current.pageSizeMode).toBe("preset");
    expect(result.current.pageSizeCustomInput).toBe("");
    expect(result.current.viewMode).toBe(VIEW_MODES.CARD);
    expect(result.current.freezeColumnsEnabled).toBe(false);
    expect(result.current.cardGridColumns).toBe(3);
  });

  it("falls back to defaults for invalid stored values", () => {
    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, "abc");
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, "grid");
    window.localStorage.setItem(FREEZE_COLUMNS_STORAGE_KEY, "maybe");
    window.localStorage.setItem(GRID_COLUMNS_STORAGE_KEY, "99");

    const { result } = renderHook(() => useDataImporterDisplayPreferences());

    expect(result.current.pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(result.current.pageSizeMode).toBe("preset");
    expect(result.current.pageSizeCustomInput).toBe("");
    expect(result.current.viewMode).toBe(VIEW_MODES.TABLE);
    expect(result.current.freezeColumnsEnabled).toBe(true);
    expect(result.current.cardGridColumns).toBe(DEFAULT_CARD_GRID_COLUMNS);
  });

  it("persists updated preferences back to localStorage", async () => {
    const { result } = renderHook(() => useDataImporterDisplayPreferences());

    act(() => {
      result.current.setPageSize(120);
      result.current.setPageSizeMode("custom");
      result.current.setPageSizeCustomInput("120");
      result.current.setViewMode(VIEW_MODES.CARD);
      result.current.setFreezeColumnsEnabled(false);
      result.current.setCardGridColumns(2);
    });

    await waitFor(() => {
      expect(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY)).toBe("120");
      expect(window.localStorage.getItem(VIEW_MODE_STORAGE_KEY)).toBe(VIEW_MODES.CARD);
      expect(window.localStorage.getItem(FREEZE_COLUMNS_STORAGE_KEY)).toBe("0");
      expect(window.localStorage.getItem(GRID_COLUMNS_STORAGE_KEY)).toBe("2");
    });
  });
});
