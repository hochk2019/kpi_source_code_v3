import { useCallback, useEffect, useMemo, useState } from "react";

import { getMSTHistoryEntries, MST_ASSIGNMENT_STATUS } from "@/lib/store.js";

const HISTORY_ACTION_TYPES = new Set(["create", "update", "delete"]);

const STATUS_FILTER_MAP = new Map([
  ["status:assigned", MST_ASSIGNMENT_STATUS.ASSIGNED],
  ["status:pending", MST_ASSIGNMENT_STATUS.PENDING],
]);

function buildHistoryIndex(entries = []) {
  const map = new Map();

  for (const entry of entries) {
    if (!entry || !entry.rowKey || !entry.field) continue;

    if (!map.has(entry.rowKey)) {
      map.set(entry.rowKey, {});
    }

    const fieldBuckets = map.get(entry.rowKey);
    if (!fieldBuckets[entry.field]) {
      fieldBuckets[entry.field] = [];
    }

    fieldBuckets[entry.field].push(entry);
  }

  return map;
}

const NOOP_ALERT = () => {};
const DEFAULT_HISTORY_LIMIT = 500;

export default function useMSTAssignmentHistoryWorkspace({
  addQuickFavorite,
  goToFirstPage,
  alertFn = typeof window !== "undefined" && typeof window.alert === "function"
    ? window.alert.bind(window)
    : NOOP_ALERT,
  loadHistoryEntries = () => getMSTHistoryEntries(DEFAULT_HISTORY_LIMIT),
}) {
  const [historyEntries, setHistoryEntries] = useState(() => loadHistoryEntries() || []);
  const [historyFilter, setHistoryFilter] = useState({
    from: "",
    to: "",
    type: "all",
  });

  const refreshHistory = useCallback(() => {
    setHistoryEntries(loadHistoryEntries() || []);
  }, [loadHistoryEntries]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const filteredHistoryEntries = useMemo(() => {
    if (!historyEntries?.length) return [];

    const shouldFilterByActionType = HISTORY_ACTION_TYPES.has(historyFilter.type);

    return historyEntries.filter((entry) => {
      if (!entry) return false;

      const entryDate = (entry.timestamp || "").slice(0, 10);
      if (historyFilter.from && entryDate < historyFilter.from) {
        return false;
      }

      if (historyFilter.to && entryDate > historyFilter.to) {
        return false;
      }

      if (shouldFilterByActionType && entry.type !== historyFilter.type) {
        return false;
      }

      return true;
    });
  }, [historyEntries, historyFilter]);

  const historyIndex = useMemo(
    () => buildHistoryIndex(filteredHistoryEntries),
    [filteredHistoryEntries]
  );

  const isHistoryFilterActive = useMemo(
    () =>
      Boolean(
        (historyFilter.from && historyFilter.from.trim()) ||
          (historyFilter.to && historyFilter.to.trim()) ||
          (historyFilter.type && historyFilter.type !== "all")
      ),
    [historyFilter]
  );

  const historyFilteredRowKeys = useMemo(() => {
    if (!isHistoryFilterActive) return null;
    if (!HISTORY_ACTION_TYPES.has(historyFilter.type)) {
      return null;
    }

    const set = new Set();
    filteredHistoryEntries.forEach((entry) => {
      if (entry?.rowKey) {
        set.add(entry.rowKey);
      }
    });

    return set;
  }, [filteredHistoryEntries, historyFilter.type, isHistoryFilterActive]);

  const activeStatusFilter = useMemo(() => {
    if (!isHistoryFilterActive) return null;
    return STATUS_FILTER_MAP.get(historyFilter.type) || null;
  }, [historyFilter.type, isHistoryFilterActive]);

  const updateHistoryFilter = useCallback((patch) => {
    setHistoryFilter((prev) => ({ ...prev, ...patch }));
  }, []);

  const applyActionFavorite = useCallback(
    (value) => {
      updateHistoryFilter({ type: value || "all" });
      goToFirstPage?.();
    },
    [goToFirstPage, updateHistoryFilter]
  );

  const handleSaveActionFavorite = useCallback(() => {
    if (!historyFilter.type || historyFilter.type === "all") {
      alertFn("Chỉ lưu bộ lọc khi bạn chọn thao tác hoặc trạng thái cụ thể.");
      return;
    }

    const result = addQuickFavorite(historyFilter.type ? "action" : "", historyFilter.type);
    if (!result?.ok) {
      if (result?.reason === "duplicate") {
        const duplicateMessage = HISTORY_ACTION_TYPES.has(historyFilter.type)
          ? "Bộ lọc thao tác đã tồn tại."
          : STATUS_FILTER_MAP.has(historyFilter.type)
            ? "Bộ lọc trạng thái đã tồn tại."
            : "Bộ lọc đã tồn tại.";

        alertFn(duplicateMessage);
      }
      return;
    }

    const successMessage = HISTORY_ACTION_TYPES.has(historyFilter.type)
      ? "Đã lưu bộ lọc thao tác."
      : STATUS_FILTER_MAP.has(historyFilter.type)
        ? "Đã lưu bộ lọc trạng thái nhân viên."
        : "Đã lưu bộ lọc.";

    alertFn(successMessage);
  }, [addQuickFavorite, alertFn, historyFilter.type]);

  const resetHistoryFilter = useCallback(() => {
    setHistoryFilter({ from: "", to: "", type: "all" });
  }, []);

  useEffect(() => {
    goToFirstPage?.();
  }, [goToFirstPage, historyFilter.from, historyFilter.to, historyFilter.type, isHistoryFilterActive]);

  const totalHistoryCount = Array.isArray(historyEntries) ? historyEntries.length : 0;
  const filteredHistoryCount = filteredHistoryEntries.length;

  return {
    activeStatusFilter,
    applyActionFavorite,
    filteredHistoryCount,
    filteredHistoryEntries,
    handleSaveActionFavorite,
    historyEntries,
    historyFilter,
    historyFilteredRowKeys,
    historyIndex,
    isHistoryFilterActive,
    refreshHistory,
    resetHistoryFilter,
    totalHistoryCount,
    updateHistoryFilter,
  };
}
