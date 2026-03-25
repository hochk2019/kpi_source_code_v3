import { useCallback, useState } from "react";

export const MIN_PAGE_SIZE = 10;
export const DEFAULT_PAGE_SIZE = 15;
export const PAGE_SIZE_OPTIONS = [15, 30, 50, 100];
export const PAGE_SIZE_STORAGE_KEY = "mstAssignment.pageSize";

export const normalizePageSize = (value, minValue = MIN_PAGE_SIZE) => {
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

export const readStoredPageSize = (
  storage,
  fallback = DEFAULT_PAGE_SIZE,
  minValue = MIN_PAGE_SIZE
) => {
  if (!storage) {
    return normalizePageSize(fallback, minValue);
  }
  try {
    const raw = storage.getItem(PAGE_SIZE_STORAGE_KEY);
    if (raw == null || raw === "") {
      return normalizePageSize(fallback, minValue);
    }
    return normalizePageSize(raw, minValue);
  } catch (err) {
    console.warn("readStoredPageSize", err);
    return normalizePageSize(fallback, minValue);
  }
};

export const writeStoredPageSize = (
  storage,
  value,
  minValue = MIN_PAGE_SIZE
) => {
  if (!storage) {
    return false;
  }
  try {
    storage.setItem(PAGE_SIZE_STORAGE_KEY, String(normalizePageSize(value, minValue)));
    return true;
  } catch (err) {
    console.warn("persistPageSize", err);
    return false;
  }
};

export default function useMSTAssignmentPageSize({
  fallback = DEFAULT_PAGE_SIZE,
  minValue = MIN_PAGE_SIZE,
} = {}) {
  const canUseLocalStorage =
    typeof window !== "undefined" && typeof window.localStorage !== "undefined";

  const [initialPageSize] = useState(() => {
    if (!canUseLocalStorage) {
      return normalizePageSize(fallback, minValue);
    }
    return readStoredPageSize(window.localStorage, fallback, minValue);
  });

  const persistPageSize = useCallback(
    (value) => {
      if (!canUseLocalStorage) {
        return false;
      }
      return writeStoredPageSize(window.localStorage, value, minValue);
    },
    [canUseLocalStorage, minValue]
  );

  return {
    initialPageSize,
    persistPageSize,
  };
}
