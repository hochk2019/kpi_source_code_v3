import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getImportColumnConfig,
  saveImportColumnConfig,
  subscribeImportColumnConfig,
} from "@/lib/importColumnConfig.js";
import {
  AUX_COLUMN_LABELS,
  IMPORT_TABLE_COLUMNS,
  IMPORT_TABLE_COLUMN_LABELS,
  SENSITIVE_COLUMN_SET,
  VALID_COLUMN_WIDTH_KEYS,
  FROZEN_COLUMN_WIDTHS,
  MIN_COLUMN_WIDTH,
  clampColumnWidth,
  sanitizeColumnWidths,
  areWidthMapsEqual,
  isConfigColumnKey,
} from "@/components/dataImporter/dataImporterConfig.js";
import { toast } from "@/shared/toast.js";

const AUX_COLUMN_IDS = Object.freeze(Object.keys(AUX_COLUMN_LABELS));

export default function useDataImporterColumnConfig({ actor, isAdminRole }) {
  const initialColumnConfig = useMemo(() => getImportColumnConfig(), []);
  const [columnConfigState, setColumnConfigState] = useState(initialColumnConfig);
  const [columnWidths, setColumnWidths] = useState(() =>
    sanitizeColumnWidths(initialColumnConfig?.widths),
  );
  const [columnConfigOpen, setColumnConfigOpen] = useState(false);
  const [columnDraftHidden, setColumnDraftHidden] = useState(() => new Set());
  const [columnDraftError, setColumnDraftError] = useState("");

  const columnWidthsRef = useRef(columnWidths);
  const headerRefs = useRef(new Map());
  const activeResizeRef = useRef(null);

  const totalBaseColumns = IMPORT_TABLE_COLUMNS.length;
  const totalConfigColumns = totalBaseColumns + AUX_COLUMN_IDS.length;

  const columnHiddenSet = useMemo(() => {
    const hiddenList = Array.isArray(columnConfigState?.hidden)
      ? columnConfigState.hidden
      : [];
    const set = new Set();
    hiddenList.forEach((key) => {
      if (typeof key !== "string") return;
      const trimmed = key.trim();
      if (!trimmed) return;
      if (IMPORT_TABLE_COLUMN_LABELS[trimmed] || AUX_COLUMN_LABELS[trimmed]) {
        set.add(trimmed);
      }
    });
    return set;
  }, [columnConfigState]);

  const hiddenBaseColumnCount = useMemo(() => {
    let count = 0;
    columnHiddenSet.forEach((key) => {
      if (IMPORT_TABLE_COLUMN_LABELS[key]) {
        count += 1;
      }
    });
    return count;
  }, [columnHiddenSet]);

  const visibleColumnCount = Math.max(1, totalBaseColumns - hiddenBaseColumnCount);

  useEffect(() => {
    columnWidthsRef.current = columnWidths;
  }, [columnWidths]);

  useEffect(() => {
    const sanitized = sanitizeColumnWidths(columnConfigState?.widths);
    setColumnWidths((prev) => {
      if (areWidthMapsEqual(prev, sanitized)) {
        return prev;
      }
      return sanitized;
    });
  }, [columnConfigState]);

  const registerHeaderRef = useCallback((key, node) => {
    const map = headerRefs.current;
    if (!map) {
      return;
    }
    if (node) {
      map.set(key, node);
    } else {
      map.delete(key);
    }
  }, []);

  useEffect(
    () => () => {
      const active = activeResizeRef.current;
      if (active) {
        window.removeEventListener("mousemove", active.move);
        window.removeEventListener("mouseup", active.up);
        activeResizeRef.current = null;
      }
    },
    [],
  );

  const handleColumnResizeStart = useCallback(
    (event, key) => {
      if (!VALID_COLUMN_WIDTH_KEYS.has(key)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const active = activeResizeRef.current;
      if (active) {
        window.removeEventListener("mousemove", active.move);
        window.removeEventListener("mouseup", active.up);
      }
      const headerEl = headerRefs.current.get(key) || null;
      const storedWidth = columnWidthsRef.current?.[key];
      const fallbackWidth = headerEl ? headerEl.getBoundingClientRect().width : 0;
      const baseWidth = clampColumnWidth(
        Number.isFinite(storedWidth) && storedWidth > 0
          ? storedWidth
          : fallbackWidth || FROZEN_COLUMN_WIDTHS[key] || MIN_COLUMN_WIDTH,
      );
      const startX = event.clientX ?? 0;
      const resizeState = { key, startX, startWidth: baseWidth };
      const handleMove = (moveEvent) => {
        const delta = (moveEvent.clientX ?? resizeState.startX) - resizeState.startX;
        const nextWidth = clampColumnWidth(resizeState.startWidth + delta);
        setColumnWidths((prev) => {
          const currentWidth = prev[key];
          if (currentWidth === nextWidth) {
            return prev;
          }
          return { ...prev, [key]: nextWidth };
        });
      };
      const handleUp = (upEvent) => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
        activeResizeRef.current = null;
        const delta = (upEvent.clientX ?? resizeState.startX) - resizeState.startX;
        const finalWidth = clampColumnWidth(resizeState.startWidth + delta);
        const merged = { ...columnWidthsRef.current, [key]: finalWidth };
        const sanitized = sanitizeColumnWidths(merged);
        columnWidthsRef.current = sanitized;
        setColumnWidths(sanitized);
        try {
          saveImportColumnConfig({ widths: sanitized }, { actor });
        } catch (error) {
          console.error("Không thể lưu chiều rộng cột Import Data", error);
          toast.error("Không thể lưu chiều rộng cột. Vui lòng thử lại.");
        }
      };
      activeResizeRef.current = { move: handleMove, up: handleUp };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [actor],
  );

  const renderResizeHandle = useCallback(
    (key) => {
      if (!VALID_COLUMN_WIDTH_KEYS.has(key)) {
        return null;
      }
      return (
        <span
          role="presentation"
          className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none bg-transparent transition-colors hover:bg-blue-500/10"
          onMouseDown={(event) => handleColumnResizeStart(event, key)}
        />
      );
    },
    [handleColumnResizeStart],
  );

  const countHiddenBaseColumns = useCallback((set) => {
    let count = 0;
    for (const key of set) {
      if (IMPORT_TABLE_COLUMN_LABELS[key]) {
        count += 1;
      }
    }
    return count;
  }, []);

  const handleToggleColumnDraft = useCallback(
    (columnId) => {
      if (!isConfigColumnKey(columnId)) {
        return;
      }
      if (!isAdminRole && SENSITIVE_COLUMN_SET.has(columnId)) {
        toast.info("Chỉ tài khoản admin mới được thay đổi hiển thị của mục này.");
        return;
      }
      setColumnDraftHidden((prev) => {
        const next = new Set(prev);
        const alreadyHidden = next.has(columnId);
        if (alreadyHidden) {
          next.delete(columnId);
          setColumnDraftError("");
          return next;
        }
        next.add(columnId);
        const hiddenBaseAfter = countHiddenBaseColumns(next);
        if (hiddenBaseAfter >= totalBaseColumns) {
          next.delete(columnId);
          setColumnDraftError("Cần giữ lại ít nhất một cột dữ liệu hiển thị.");
          return next;
        }
        setColumnDraftError("");
        return next;
      });
    },
    [countHiddenBaseColumns, isAdminRole, totalBaseColumns],
  );

  const handleApplyColumnConfig = useCallback(() => {
    const hiddenList = Array.from(columnDraftHidden).filter((key) => isConfigColumnKey(key));
    const hiddenBaseCount = hiddenList.reduce(
      (count, key) => (IMPORT_TABLE_COLUMN_LABELS[key] ? count + 1 : count),
      0,
    );
    if (hiddenBaseCount >= totalBaseColumns) {
      setColumnDraftError("Cần giữ lại ít nhất một cột dữ liệu hiển thị.");
      return;
    }
    const sanitizedWidths = sanitizeColumnWidths(columnWidthsRef.current);
    const widthChanged = !areWidthMapsEqual(sanitizedWidths, columnConfigState?.widths || {});
    const isSame =
      hiddenList.length === columnHiddenSet.size && hiddenList.every((key) => columnHiddenSet.has(key));
    if (isSame && !widthChanged) {
      setColumnConfigOpen(false);
      return;
    }
    try {
      const result = saveImportColumnConfig(
        { hidden: hiddenList, widths: sanitizedWidths },
        { actor },
      );
      const persistedHidden = Array.isArray(result?.hidden) ? result.hidden : hiddenList;
      const resultHiddenBase = persistedHidden.filter((key) => IMPORT_TABLE_COLUMN_LABELS[key]).length;
      if (resultHiddenBase >= totalBaseColumns) {
        setColumnDraftError("Cần giữ lại ít nhất một cột dữ liệu hiển thị.");
        return;
      }
      setColumnConfigOpen(false);
      setColumnDraftError("");
      setColumnWidths(sanitizedWidths);
      columnWidthsRef.current = sanitizedWidths;
      toast.success("Đã cập nhật cấu hình cột Import Data.");
    } catch (error) {
      console.error("Không thể lưu cấu hình cột Import Data", error);
      setColumnDraftError("Có lỗi xảy ra khi lưu cấu hình. Vui lòng thử lại.");
    }
  }, [actor, columnConfigState, columnDraftHidden, columnHiddenSet, totalBaseColumns]);

  const handleResetColumnConfig = useCallback(() => {
    const defaultHidden = [...new Set([...AUX_COLUMN_IDS, "status"])];
    try {
      saveImportColumnConfig({ hidden: defaultHidden, widths: {} }, { actor });
      setColumnDraftHidden(new Set(defaultHidden));
      setColumnDraftError("");
      setColumnWidths({});
      columnWidthsRef.current = {};
      toast.success("Đã khôi phục cấu hình cột Import Data mặc định.");
    } catch (error) {
      console.error("Không thể khôi phục cấu hình cột Import Data", error);
      toast.error("Không thể khôi phục cấu hình cột. Vui lòng thử lại.");
    }
  }, [actor]);

  useEffect(() => {
    const unsubscribe = subscribeImportColumnConfig((config) => {
      setColumnConfigState(config);
    });
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (!columnConfigOpen) {
      return;
    }
    setColumnDraftHidden(new Set(columnHiddenSet));
    setColumnDraftError("");
  }, [columnConfigOpen, columnHiddenSet]);

  return {
    columnConfigState,
    columnWidths,
    columnConfigOpen,
    columnDraftHidden,
    columnDraftError,
    columnHiddenSet,
    totalBaseColumns,
    totalConfigColumns,
    visibleColumnCount,
    setColumnConfigOpen,
    setColumnDraftHidden,
    setColumnDraftError,
    registerHeaderRef,
    renderResizeHandle,
    handleToggleColumnDraft,
    handleApplyColumnConfig,
    handleResetColumnConfig,
  };
}
