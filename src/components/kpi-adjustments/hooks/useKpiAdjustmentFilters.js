import { useCallback, useEffect, useMemo, useState } from "react";

import { normalizeName, normalizeStr } from "@/lib/store.js";

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function useKpiAdjustmentFilters({
  adjustments,
  staffOptions,
  currentStaffKey,
  canApprove,
  isAuthenticated,
}) {
  const [filterMonth, setFilterMonth] = useState(getCurrentMonth());
  const [filterStatus, setFilterStatus] = useState("all");
  const [showMineOnly, setShowMineOnly] = useState(
    () => Boolean(isAuthenticated && currentStaffKey && !canApprove)
  );
  const [staffFilter, setStaffFilter] = useState("all");
  const [filterSignature, setFilterSignature] = useState("");

  useEffect(() => {
    const signature = `${isAuthenticated ? 1 : 0}:${canApprove ? 1 : 0}:${currentStaffKey || ""}`;
    if (filterSignature === signature) {
      return;
    }
    setFilterSignature(signature);
    if (!isAuthenticated || !currentStaffKey) {
      setShowMineOnly(false);
      setStaffFilter("all");
      return;
    }
    if (!canApprove) {
      setShowMineOnly(true);
      setStaffFilter("all");
    } else {
      setStaffFilter("all");
    }
  }, [isAuthenticated, canApprove, currentStaffKey, filterSignature]);

  const staffFilterOptions = useMemo(() => {
    const entries = new Map();
    for (const option of staffOptions) {
      const key = normalizeName(option?.name);
      if (key) {
        entries.set(key, option.name);
      }
    }
    for (const entry of adjustments) {
      if (!entry) continue;
      const name = normalizeStr(entry.staffName);
      const key = normalizeName(name);
      if (key && name) {
        entries.set(key, name);
      }
    }
    return Array.from(entries.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "vi", { sensitivity: "base" }));
  }, [staffOptions, adjustments]);

  useEffect(() => {
    if (staffFilter === "all") {
      return;
    }
    if (!staffFilterOptions.some((item) => item.value === staffFilter)) {
      setStaffFilter("all");
    }
  }, [staffFilter, staffFilterOptions]);

  const handleMineToggle = useCallback(
    (checked) => {
      if (!currentStaffKey) {
        setShowMineOnly(false);
        return;
      }
      const nextValue = Boolean(checked);
      setShowMineOnly(nextValue);
      if (nextValue) {
        setStaffFilter("all");
      }
    },
    [currentStaffKey]
  );

  const filteredAdjustments = useMemo(() => {
    return adjustments
      .filter((item) => {
        if (!item) return false;
        if (filterMonth && filterMonth !== "all" && item.month !== filterMonth) {
          return false;
        }
        if (filterStatus !== "all" && item.status !== filterStatus) {
          return false;
        }
        const itemStaffKey = normalizeName(item.staffName);
        if (showMineOnly && currentStaffKey) {
          if (itemStaffKey !== currentStaffKey) {
            return false;
          }
        } else if (canApprove && staffFilter !== "all") {
          if (itemStaffKey !== staffFilter) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(b.updatedAt || b.createdAt || 0).getTime();
        const timeB = new Date(a.updatedAt || a.createdAt || 0).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return (b.month || "").localeCompare(a.month || "");
      });
  }, [adjustments, filterMonth, filterStatus, showMineOnly, currentStaffKey, canApprove, staffFilter]);

  return {
    filterMonth,
    setFilterMonth,
    filterStatus,
    setFilterStatus,
    showMineOnly,
    staffFilter,
    setStaffFilter,
    staffFilterOptions,
    handleMineToggle,
    filteredAdjustments,
  };
}
