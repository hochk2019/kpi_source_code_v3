import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import useKpiAdjustmentPageSize, {
  DEFAULT_KPI_ADJUSTMENT_PAGE_SIZE,
  KPI_ADJUSTMENT_PAGE_SIZE_STORAGE_KEY,
  MIN_KPI_ADJUSTMENT_PAGE_SIZE,
  normalizeKpiAdjustmentPageSize,
  readStoredKpiAdjustmentPageSize,
  writeStoredKpiAdjustmentPageSize,
} from "@/components/kpi-adjustments/hooks/useKpiAdjustmentPageSize.js";

describe("useKpiAdjustmentPageSize helpers", () => {
  it("normalizes valid numeric values", () => {
    expect(normalizeKpiAdjustmentPageSize("25", MIN_KPI_ADJUSTMENT_PAGE_SIZE)).toBe(25);
  });

  it("falls back to minimum for invalid values", () => {
    expect(normalizeKpiAdjustmentPageSize("abc", MIN_KPI_ADJUSTMENT_PAGE_SIZE)).toBe(
      MIN_KPI_ADJUSTMENT_PAGE_SIZE
    );
  });

  it("reads stored values safely", () => {
    const storage = { getItem: vi.fn().mockReturnValue("30") };
    expect(readStoredKpiAdjustmentPageSize(storage)).toBe(30);
    expect(storage.getItem).toHaveBeenCalledWith(KPI_ADJUSTMENT_PAGE_SIZE_STORAGE_KEY);
  });

  it("writes normalized values safely", () => {
    const storage = { setItem: vi.fn() };
    expect(writeStoredKpiAdjustmentPageSize(storage, 8)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(
      KPI_ADJUSTMENT_PAGE_SIZE_STORAGE_KEY,
      String(MIN_KPI_ADJUSTMENT_PAGE_SIZE)
    );
  });
});

describe("useKpiAdjustmentPageSize", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("restores the stored page size and persists updates", () => {
    window.localStorage.setItem(KPI_ADJUSTMENT_PAGE_SIZE_STORAGE_KEY, "30");

    const { result } = renderHook(() => useKpiAdjustmentPageSize());

    expect(result.current.initialPageSize).toBe(30);
    expect(result.current.persistPageSize(12)).toBe(true);
    expect(window.localStorage.getItem(KPI_ADJUSTMENT_PAGE_SIZE_STORAGE_KEY)).toBe("12");
  });

  it("falls back to the default page size when storage is empty", () => {
    const { result } = renderHook(() => useKpiAdjustmentPageSize());

    expect(result.current.initialPageSize).toBe(DEFAULT_KPI_ADJUSTMENT_PAGE_SIZE);
  });
});
