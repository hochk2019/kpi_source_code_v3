import { useCallback, useEffect, useMemo, useState } from "react";

import { normalizeName, normalizeStr } from "@/lib/storeCoreHelpers.js";
import { getItem, setItem } from "@/lib/storageClient.js";

const KPI_ADJUSTMENT_FILTER_PREFERENCES_KEY = "kpi_adjustment_filter_preferences_v1";
const FILTER_MONTH_PATTERN = /^\d{4}-\d{2}$/;

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function buildFilterPreferenceScope({ isAuthenticated, canApprove, currentStaffKey }) {
  if (!isAuthenticated) {
    return "guest";
  }
  const role = canApprove ? "approver" : "staff";
  const identity = currentStaffKey || "anonymous";
  return `${role}:${identity}`;
}

function buildDefaultFilterState({ isAuthenticated, currentStaffKey, canApprove }) {
  return {
    filterMonth: getCurrentMonth(),
    filterStatus: "all",
    showMineOnly: Boolean(isAuthenticated && currentStaffKey && !canApprove),
    staffFilter: "all",
  };
}

function readFilterPreferenceMap() {
  const raw = getItem(KPI_ADJUSTMENT_FILTER_PREFERENCES_KEY);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readFilterPreferences(scope) {
  const preferenceMap = readFilterPreferenceMap();
  const stored = preferenceMap[scope];
  return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : null;
}

function writeFilterPreferences(scope, value) {
  if (!scope) {
    return;
  }
  const preferenceMap = readFilterPreferenceMap();
  preferenceMap[scope] = value;
  setItem(KPI_ADJUSTMENT_FILTER_PREFERENCES_KEY, JSON.stringify(preferenceMap));
}

function sanitizeFilterMonth(value, fallback) {
  if (value === "all") {
    return "all";
  }
  return typeof value === "string" && FILTER_MONTH_PATTERN.test(value) ? value : fallback;
}

function sanitizeFilterStatus(value) {
  return value === "approved" || value === "pending" || value === "rejected" ? value : "all";
}

function sanitizeStoredFilters(stored, defaults, { currentStaffKey, canApprove }) {
  const filterMonth = sanitizeFilterMonth(stored?.filterMonth, defaults.filterMonth);
  const filterStatus = sanitizeFilterStatus(stored?.filterStatus);
  const showMineOnly = Boolean(currentStaffKey) &&
    (stored && Object.prototype.hasOwnProperty.call(stored, "showMineOnly")
      ? Boolean(stored.showMineOnly)
      : defaults.showMineOnly);
  const staffFilter =
    canApprove && !showMineOnly && typeof stored?.staffFilter === "string" && stored.staffFilter.trim()
      ? stored.staffFilter.trim()
      : "all";

  return {
    filterMonth,
    filterStatus,
    showMineOnly,
    staffFilter,
  };
}

export function useKpiAdjustmentFilters({
  adjustments,
  staffOptions,
  currentStaffKey,
  canApprove,
  isAuthenticated,
}) {
  const preferenceScope = useMemo(
    () => buildFilterPreferenceScope({ isAuthenticated, canApprove, currentStaffKey }),
    [isAuthenticated, canApprove, currentStaffKey]
  );
  const defaultFilters = useMemo(
    () => buildDefaultFilterState({ isAuthenticated, currentStaffKey, canApprove }),
    [isAuthenticated, currentStaffKey, canApprove]
  );
  const [filterMonth, setFilterMonth] = useState(defaultFilters.filterMonth);
  const [filterStatus, setFilterStatus] = useState("all");
  const [showMineOnly, setShowMineOnly] = useState(defaultFilters.showMineOnly);
  const [staffFilter, setStaffFilter] = useState("all");
  const [hydratedScope, setHydratedScope] = useState("");

  useEffect(() => {
    const stored = readFilterPreferences(preferenceScope);
    const nextFilters = sanitizeStoredFilters(stored, defaultFilters, { currentStaffKey, canApprove });
    setFilterMonth(nextFilters.filterMonth);
    setFilterStatus(nextFilters.filterStatus);
    setShowMineOnly(nextFilters.showMineOnly);
    setStaffFilter(nextFilters.staffFilter);
    setHydratedScope(preferenceScope);
  }, [preferenceScope, defaultFilters, currentStaffKey, canApprove]);

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

  useEffect(() => {
    if (!hydratedScope || hydratedScope !== preferenceScope) {
      return;
    }
    writeFilterPreferences(preferenceScope, {
      filterMonth: filterMonth || defaultFilters.filterMonth,
      filterStatus,
      showMineOnly: Boolean(currentStaffKey && showMineOnly),
      staffFilter: canApprove && !showMineOnly ? staffFilter : "all",
    });
  }, [
    hydratedScope,
    preferenceScope,
    filterMonth,
    filterStatus,
    showMineOnly,
    staffFilter,
    canApprove,
    currentStaffKey,
    defaultFilters.filterMonth,
  ]);

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
