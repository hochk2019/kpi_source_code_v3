import { useEffect, useState } from "react";

import {
  CARD_GRID_COLUMN_OPTIONS,
  DEFAULT_CARD_GRID_COLUMNS,
  DEFAULT_PAGE_SIZE,
  FREEZE_COLUMNS_STORAGE_KEY,
  GRID_COLUMNS_STORAGE_KEY,
  PAGE_SIZE_OPTIONS,
  PAGE_SIZE_STORAGE_KEY,
  SERVER_SEARCH_MAX_PAGE_SIZE,
  VIEW_MODES,
  VIEW_MODE_STORAGE_KEY,
} from "@/components/dataImporter/dataImporterConfig.js";

function readStoredPageSize() {
  if (typeof window === "undefined") {
    return DEFAULT_PAGE_SIZE;
  }

  const stored = window.localStorage?.getItem(PAGE_SIZE_STORAGE_KEY);
  const parsed = Number.parseInt(stored || "", 10);
  if (Number.isFinite(parsed) && parsed >= 1) {
    return Math.min(parsed, SERVER_SEARCH_MAX_PAGE_SIZE);
  }
  return DEFAULT_PAGE_SIZE;
}

function readStoredViewMode() {
  if (typeof window === "undefined") {
    return VIEW_MODES.TABLE;
  }

  const stored = window.localStorage?.getItem(VIEW_MODE_STORAGE_KEY);
  return stored === VIEW_MODES.CARD ? VIEW_MODES.CARD : VIEW_MODES.TABLE;
}

function readStoredFreezeColumnsEnabled() {
  if (typeof window === "undefined") {
    return true;
  }

  const stored = window.localStorage?.getItem(FREEZE_COLUMNS_STORAGE_KEY);
  if (stored === "0") return false;
  if (stored === "1") return true;
  return true;
}

function readStoredCardGridColumns() {
  if (typeof window === "undefined") {
    return DEFAULT_CARD_GRID_COLUMNS;
  }

  const stored = window.localStorage?.getItem(GRID_COLUMNS_STORAGE_KEY);
  const parsed = Number.parseInt(stored || "", 10);
  if (CARD_GRID_COLUMN_OPTIONS.includes(parsed)) {
    return parsed;
  }
  return DEFAULT_CARD_GRID_COLUMNS;
}

export default function useDataImporterDisplayPreferences() {
  const initialPageSize = readStoredPageSize();

  const [pageSize, setPageSize] = useState(initialPageSize);
  const [pageSizeMode, setPageSizeMode] = useState(() =>
    PAGE_SIZE_OPTIONS.includes(initialPageSize) ? "preset" : "custom"
  );
  const [pageSizeCustomInput, setPageSizeCustomInput] = useState(() =>
    PAGE_SIZE_OPTIONS.includes(initialPageSize) ? "" : String(initialPageSize)
  );
  const [viewMode, setViewMode] = useState(readStoredViewMode);
  const [freezeColumnsEnabled, setFreezeColumnsEnabled] = useState(readStoredFreezeColumnsEnabled);
  const [cardGridColumns, setCardGridColumns] = useState(readStoredCardGridColumns);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage?.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize));
    }
  }, [pageSize]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage?.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch (error) {
      console.warn("Không thể lưu chế độ hiển thị Import Data", error);
    }
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage?.setItem(FREEZE_COLUMNS_STORAGE_KEY, freezeColumnsEnabled ? "1" : "0");
    } catch (error) {
      console.warn("Không thể lưu tuỳ chọn giữ cột cố định", error);
    }
  }, [freezeColumnsEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage?.setItem(
        GRID_COLUMNS_STORAGE_KEY,
        String(
          CARD_GRID_COLUMN_OPTIONS.includes(cardGridColumns)
            ? cardGridColumns
            : DEFAULT_CARD_GRID_COLUMNS
        )
      );
    } catch (error) {
      console.warn("Không thể lưu số cột dạng thẻ", error);
    }
  }, [cardGridColumns]);

  return {
    pageSize,
    setPageSize,
    pageSizeMode,
    setPageSizeMode,
    pageSizeCustomInput,
    setPageSizeCustomInput,
    viewMode,
    setViewMode,
    freezeColumnsEnabled,
    setFreezeColumnsEnabled,
    cardGridColumns,
    setCardGridColumns,
  };
}
