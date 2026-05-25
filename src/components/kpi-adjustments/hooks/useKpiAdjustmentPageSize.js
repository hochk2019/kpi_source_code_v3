import { useCallback, useState } from "react";

export const MIN_KPI_ADJUSTMENT_PAGE_SIZE = 10;
export const DEFAULT_KPI_ADJUSTMENT_PAGE_SIZE = 15;
export const KPI_ADJUSTMENT_PAGE_SIZE_OPTIONS = [15, 30, 50, 100];
export const KPI_ADJUSTMENT_PAGE_SIZE_STORAGE_KEY = "kpiAdjustments.pageSize";

export const normalizeKpiAdjustmentPageSize = (
  value,
  minValue = MIN_KPI_ADJUSTMENT_PAGE_SIZE
) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return minValue;
  }

  const normalized = Math.trunc(numeric);
  if (normalized < minValue) {
    return minValue;
  }

  return normalized;
};

export const readStoredKpiAdjustmentPageSize = (
  storage,
  fallback = DEFAULT_KPI_ADJUSTMENT_PAGE_SIZE,
  minValue = MIN_KPI_ADJUSTMENT_PAGE_SIZE
) => {
  if (!storage) {
    return normalizeKpiAdjustmentPageSize(fallback, minValue);
  }

  try {
    const raw = storage.getItem(KPI_ADJUSTMENT_PAGE_SIZE_STORAGE_KEY);
    if (raw == null || raw === "") {
      return normalizeKpiAdjustmentPageSize(fallback, minValue);
    }

    return normalizeKpiAdjustmentPageSize(raw, minValue);
  } catch (error) {
    console.warn("readStoredKpiAdjustmentPageSize", error);
    return normalizeKpiAdjustmentPageSize(fallback, minValue);
  }
};

export const writeStoredKpiAdjustmentPageSize = (
  storage,
  value,
  minValue = MIN_KPI_ADJUSTMENT_PAGE_SIZE
) => {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(
      KPI_ADJUSTMENT_PAGE_SIZE_STORAGE_KEY,
      String(normalizeKpiAdjustmentPageSize(value, minValue))
    );
    return true;
  } catch (error) {
    console.warn("writeStoredKpiAdjustmentPageSize", error);
    return false;
  }
};

export default function useKpiAdjustmentPageSize({
  fallback = DEFAULT_KPI_ADJUSTMENT_PAGE_SIZE,
  minValue = MIN_KPI_ADJUSTMENT_PAGE_SIZE,
} = {}) {
  const canUseLocalStorage =
    typeof window !== "undefined" && typeof window.localStorage !== "undefined";

  const [initialPageSize] = useState(() => {
    if (!canUseLocalStorage) {
      return normalizeKpiAdjustmentPageSize(fallback, minValue);
    }

    return readStoredKpiAdjustmentPageSize(window.localStorage, fallback, minValue);
  });

  const persistPageSize = useCallback(
    (value) => {
      if (!canUseLocalStorage) {
        return false;
      }

      return writeStoredKpiAdjustmentPageSize(window.localStorage, value, minValue);
    },
    [canUseLocalStorage, minValue]
  );

  return {
    initialPageSize,
    persistPageSize,
  };
}
