import { useEffect, useMemo, useRef, useState } from "react";

import { QUICK_RANGE_OPTIONS, computeQuickRange } from "@/lib/reports.js";
import {
  DEFAULT_DETAIL_PAGE_SIZE,
  DETAIL_PAGE_SIZE_OPTIONS,
} from "@/components/reporting/reportingDetailUtils.js";

const METRIC_SORT_KEYS = ["kpi", "decls", "licenses"];
const ADJUSTMENT_PAGE_SIZE_OPTIONS = [5, 10, 20];
const DEFAULT_ADJUSTMENT_PAGE_SIZE = 10;

const TOP_STAFF_VISIBLE_COUNT_OPTIONS = [5, 7, 8, 9, 10, 12, 15];
const TOP_STAFF_VISIBLE_COUNT_SET = new Set(TOP_STAFF_VISIBLE_COUNT_OPTIONS);

export const REPORT_PREFS_STORAGE_KEY = "kpi_report_viewer_prefs_v1";

const EXPORT_COLUMN_KEYS = ["items", "licenses", "co", "coLines", "licenseCodes"];

const QUICK_RANGE_VALUES = new Set([...QUICK_RANGE_OPTIONS.map((option) => option.value), "custom"]);
const SCOPE_VALUES = new Set(["staff", "team"]);

/**
 * Sanitizes quick range value to ensure valid option
 * @param {string} value - Input value
 * @returns {string} Valid quick range value
 */
export function sanitizeQuickRange(value) {
  if (typeof value !== "string") {
    return "this_month";
  }

  const normalized = value.trim();
  return QUICK_RANGE_VALUES.has(normalized) ? normalized : "this_month";
}

/**
 * Sanitizes sort key to ensure valid metric
 * @param {string} value - Input value
 * @returns {string} Valid sort key (kpi | decls | licenses)
 */
export function sanitizeSortKey(value) {
  return METRIC_SORT_KEYS.includes(value) ? value : "kpi";
}

/**
 * Sanitizes scope value to ensure valid scope
 * @param {string} value - Input value
 * @returns {string} Valid scope (staff | team)
 */
export function sanitizeScope(value) {
  if (typeof value !== "string") {
    return "staff";
  }

  const normalized = value.trim();
  return SCOPE_VALUES.has(normalized) ? normalized : "staff";
}

/**
 * Sanitizes top staff metric value
 * @param {string} value - Input value
 * @returns {string} Valid metric (decls | kpi)
 */
export function sanitizeTopStaffMetric(value) {
  return value === "decls" ? "decls" : "kpi";
}

/**
 * Sanitizes visible count for top staff display
 * @param {string|number} value - Input value
 * @returns {number|string} Valid count or "auto"
 */
export function sanitizeTopStaffVisibleCount(value) {
  if (value === "auto") {
    return "auto";
  }

  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "auto";
  }

  const rounded = Math.round(num);
  return TOP_STAFF_VISIBLE_COUNT_SET.has(rounded) ? rounded : "auto";
}

/**
 * Sanitizes selection value
 * @param {string} value - Input value
 * @returns {string} Valid selection or "all"
 */
export function sanitizeSelection(value) {
  if (typeof value !== "string") {
    return "all";
  }

  const normalized = value.trim();
  return normalized || "all";
}

/**
 * Sanitizes adjustment page size
 * @param {number} value - Input value
 * @returns {number} Valid page size
 */
export function sanitizeAdjustmentPageSize(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return DEFAULT_ADJUSTMENT_PAGE_SIZE;
  }

  return ADJUSTMENT_PAGE_SIZE_OPTIONS.includes(num) ? num : DEFAULT_ADJUSTMENT_PAGE_SIZE;
}

/**
 * Sanitizes detail page size with clamp
 * @param {number} value - Input value
 * @returns {number} Valid page size (1-500)
 */
export function sanitizeDetailPageSize(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return DEFAULT_DETAIL_PAGE_SIZE;
  }

  const normalized = Math.round(num);
  return Math.max(1, Math.min(normalized, 500));
}

/**
 * Sanitizes rule preference string
 * @param {string} value - Input value
 * @returns {string} Trimmed value
 */
export function sanitizeRulePreference(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

/**
 * Sanitizes date input with fallback
 * @param {string} value - Input value
 * @param {string} fallback - Fallback value
 * @returns {string} Valid date string
 */
export function sanitizeDateInput(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized || fallback;
}

/**
 * Builds sanitized report template payload from raw values
 * @param {object} params - Template parameters
 * @returns {object} Sanitized payload
 */
export function buildReportTemplatePayload({
  quickRange,
  from,
  to,
  scope,
  selectedStaff,
  selectedTeam,
  staffSortKey,
  teamSortKey,
  topStaffMetric,
  topStaffVisibleCount,
  columns,
  ruleId,
  adjustmentPageSize,
  detailPageSize,
} = {}) {
  return {
    quickRange: sanitizeQuickRange(quickRange),
    from: typeof from === "string" ? from : "",
    to: typeof to === "string" ? to : "",
    scope: sanitizeScope(scope),
    selectedStaff: sanitizeSelection(selectedStaff),
    selectedTeam: sanitizeSelection(selectedTeam),
    staffSortKey: sanitizeSortKey(staffSortKey),
    teamSortKey: sanitizeSortKey(teamSortKey),
    topStaffMetric: sanitizeTopStaffMetric(topStaffMetric),
    topStaffVisibleCount: sanitizeTopStaffVisibleCount(topStaffVisibleCount),
    columns: sanitizeColumnVisibility(columns),
    ruleId: sanitizeRulePreference(ruleId),
    adjustmentPageSize: sanitizeAdjustmentPageSize(adjustmentPageSize),
    detailPageSize: sanitizeDetailPageSize(detailPageSize),
  };
}

/**
 * Sanitizes report template filters with computed date range
 * @param {object} input - Raw filter values
 * @returns {object} Sanitized filters
 */
export function sanitizeReportTemplateFilters(input = {}) {
  const quickRange = sanitizeQuickRange(input.quickRange);
  const quickRangeBase = quickRange === "custom" ? "this_month" : quickRange;
  const computedRange = computeQuickRange(quickRangeBase);

  return buildReportTemplatePayload({
    quickRange,
    from: sanitizeDateInput(input.from, computedRange.from),
    to: sanitizeDateInput(input.to, computedRange.to),
    scope: input.scope,
    selectedStaff: input.selectedStaff,
    selectedTeam: input.selectedTeam,
    staffSortKey: input.staffSortKey,
    teamSortKey: input.teamSortKey,
    topStaffMetric: input.topStaffMetric,
    topStaffVisibleCount: input.topStaffVisibleCount,
    columns: input.columns,
    ruleId: input.ruleId,
    adjustmentPageSize: input.adjustmentPageSize,
    detailPageSize: input.detailPageSize,
  });
}

/**
 * Loads report preferences from localStorage
 * @returns {object} Saved preferences or empty object
 */
export function loadReportPreferences() {
  if (typeof window === "undefined" || !window.localStorage) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(REPORT_PREFS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

let debounceTimer = null;

/**
 * Saves report preferences to localStorage with debounce
 * @param {object} prefs - Preferences to save
 */
export function saveReportPreferences(prefs) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    try {
      window.localStorage.setItem(REPORT_PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch (err) {
      console.warn("Khong the luu bo loc bao cao vao localStorage", err);
    }
  }, 300);
}

/**
 * Sanitizes column visibility configuration
 * @param {object} input - Raw visibility config
 * @returns {object} Sanitized visibility config
 */
export function sanitizeColumnVisibility(input = {}) {
  if (!input || typeof input !== "object") {
    return {};
  }

  const result = {};
  for (const key of EXPORT_COLUMN_KEYS) {
    if (input[key] === false) {
      result[key] = false;
    }
  }

  return result;
}

/**
 * Builds column visibility state from stored preferences
 * @param {object} storedColumnPrefs - Stored column preferences
 * @returns {object} Column visibility state
 */
function buildColumnVisibilityState(storedColumnPrefs) {
  return {
    items: storedColumnPrefs.items !== false,
    licenses: storedColumnPrefs.licenses !== false,
    co: storedColumnPrefs.co !== false,
    coLines: storedColumnPrefs.coLines !== false,
    licenseCodes: storedColumnPrefs.licenseCodes !== false,
  };
}

/**
 * Hook for managing report viewer preferences with localStorage persistence
 * @returns {object} Preference state and setters
 */
export function useReportViewerPreferences() {
  const storedPrefs = useMemo(() => loadReportPreferences(), []);
  const storedRuleId = useMemo(
    () => sanitizeRulePreference(storedPrefs.ruleId),
    [storedPrefs.ruleId],
  );

  const initialQuickRange = sanitizeQuickRange(storedPrefs.quickRange);
  const quickRangeBase = initialQuickRange === "custom" ? "this_month" : initialQuickRange;
  const initialRange = useMemo(() => computeQuickRange(quickRangeBase), [quickRangeBase]);
  const initialFrom =
    initialQuickRange === "custom"
      ? sanitizeDateInput(storedPrefs.from, initialRange.from)
      : initialRange.from;
  const initialTo =
    initialQuickRange === "custom"
      ? sanitizeDateInput(storedPrefs.to, initialRange.to)
      : initialRange.to;

  const [quickRange, setQuickRange] = useState(initialQuickRange);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [scope, setScope] = useState(() => sanitizeScope(storedPrefs.scope));
  const [selectedStaff, setSelectedStaff] = useState(() =>
    sanitizeSelection(storedPrefs.selectedStaff),
  );
  const [selectedTeam, setSelectedTeam] = useState(() =>
    sanitizeSelection(storedPrefs.selectedTeam),
  );
  const [staffViewMode, setStaffViewMode] = useState("summary");
  const [teamViewMode, setTeamViewMode] = useState("summary");
  const [topStaffMetric, setTopStaffMetric] = useState(() =>
    sanitizeTopStaffMetric(storedPrefs.topStaffMetric),
  );
  const [staffSortKey, setStaffSortKey] = useState(() =>
    sanitizeSortKey(storedPrefs.staffSortKey),
  );
  const [teamSortKey, setTeamSortKey] = useState(() => sanitizeSortKey(storedPrefs.teamSortKey));
  const [topStaffVisibleCount, setTopStaffVisibleCount] = useState(() =>
    sanitizeTopStaffVisibleCount(storedPrefs.topStaffVisibleCount),
  );

  const storedColumnPrefs = useMemo(
    () => sanitizeColumnVisibility(storedPrefs.columns),
    [storedPrefs],
  );
  const [columnVisibility, setColumnVisibility] = useState(() =>
    buildColumnVisibilityState(storedColumnPrefs),
  );
  const exportColumns = useMemo(
    () => sanitizeColumnVisibility(columnVisibility),
    [columnVisibility],
  );

  const prefsSnapshotRef = useRef("");
  const [scheduleCollapsed, setScheduleCollapsed] = useState(
    () => storedPrefs.scheduleCollapsed === true,
  );
  const [selectedRuleId, setSelectedRuleId] = useState(storedRuleId);
  const [adjustmentPageSize, setAdjustmentPageSize] = useState(() =>
    sanitizeAdjustmentPageSize(storedPrefs.adjustmentPageSize),
  );
  const [adjustmentPage, setAdjustmentPage] = useState(0);

  const initialDetailPageSize = useMemo(
    () => sanitizeDetailPageSize(storedPrefs.detailPageSize),
    [storedPrefs.detailPageSize],
  );
  const [detailPageSize, setDetailPageSize] = useState(initialDetailPageSize);
  const [detailPageSizeMode, setDetailPageSizeMode] = useState(() =>
    DETAIL_PAGE_SIZE_OPTIONS.includes(initialDetailPageSize) ? "preset" : "custom",
  );
  const [detailPageSizeCustomInput, setDetailPageSizeCustomInput] = useState(() =>
    DETAIL_PAGE_SIZE_OPTIONS.includes(initialDetailPageSize) ? "" : String(initialDetailPageSize),
  );
  const [staffDetailPage, setStaffDetailPage] = useState(0);
  const [teamDetailPage, setTeamDetailPage] = useState(0);

  useEffect(() => {
    const payload = {
      quickRange,
      from,
      to,
      scope,
      selectedStaff,
      selectedTeam,
      staffSortKey,
      teamSortKey,
      topStaffMetric,
      topStaffVisibleCount,
      columns: exportColumns,
      ruleId: selectedRuleId,
      adjustmentPageSize,
      detailPageSize,
      scheduleCollapsed,
    };

    const snapshot = JSON.stringify(payload);
    if (prefsSnapshotRef.current === snapshot) {
      return;
    }

    prefsSnapshotRef.current = snapshot;
    saveReportPreferences(payload);
  }, [
    quickRange,
    from,
    to,
    scope,
    selectedStaff,
    selectedTeam,
    staffSortKey,
    teamSortKey,
    topStaffMetric,
    topStaffVisibleCount,
    exportColumns,
    selectedRuleId,
    adjustmentPageSize,
    detailPageSize,
    scheduleCollapsed,
  ]);

  useEffect(() => {
    setStaffViewMode("detail");
  }, [selectedStaff, scope]);

  useEffect(() => {
    setTeamViewMode("detail");
  }, [selectedTeam, scope]);

  const handleToggleColumnVisibility = (key) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [key]: prev[key] === false,
    }));
  };

  const handleQuickRangeChange = (value) => {
    setQuickRange(value);
    if (value === "custom") {
      return;
    }

    const range = computeQuickRange(value);
    setFrom(range.from);
    setTo(range.to);
  };

  const handleDetailPageSizeChange = (event) => {
    const raw = event?.target?.value;
    if (raw === "custom") {
      setDetailPageSizeMode("custom");
      setDetailPageSizeCustomInput((prev) => {
        if (prev && Number(prev) > 0) {
          return prev;
        }

        return String(detailPageSize);
      });
      return;
    }

    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return;
    }

    const normalized = sanitizeDetailPageSize(numeric);
    setDetailPageSizeMode("preset");
    setDetailPageSize(normalized);
    setDetailPageSizeCustomInput("");
    setStaffDetailPage(0);
    setTeamDetailPage(0);
  };

  const handleDetailPageSizeCustomInputChange = (event) => {
    const raw = event?.target?.value ?? "";
    setDetailPageSizeMode("custom");

    if (!raw.trim()) {
      setDetailPageSizeCustomInput("");
      return;
    }

    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setDetailPageSizeCustomInput(raw);
      return;
    }

    const normalized = sanitizeDetailPageSize(numeric);
    const normalizedText = String(normalized);

    setDetailPageSizeCustomInput(normalizedText);
    if (normalized !== detailPageSize) {
      setDetailPageSize(normalized);
      setStaffDetailPage(0);
      setTeamDetailPage(0);
    }
  };

  const handleAdjustmentPageSizeChange = (value) => {
    setAdjustmentPageSize(sanitizeAdjustmentPageSize(value));
  };

  const templatePayload = useMemo(
    () =>
      buildReportTemplatePayload({
        quickRange,
        from,
        to,
        scope,
        selectedStaff,
        selectedTeam,
        staffSortKey,
        teamSortKey,
        topStaffMetric,
        topStaffVisibleCount,
        columns: exportColumns,
        ruleId: selectedRuleId,
        adjustmentPageSize,
        detailPageSize,
      }),
    [
      adjustmentPageSize,
      detailPageSize,
      exportColumns,
      from,
      quickRange,
      scope,
      selectedRuleId,
      selectedStaff,
      selectedTeam,
      staffSortKey,
      teamSortKey,
      to,
      topStaffMetric,
      topStaffVisibleCount,
    ],
  );

  const applyTemplateFilters = (input = {}) => {
    const nextFilters = sanitizeReportTemplateFilters(input);
    const nextColumnPrefs = sanitizeColumnVisibility(nextFilters.columns);
    const nextDetailPageSize = sanitizeDetailPageSize(nextFilters.detailPageSize);

    setQuickRange(nextFilters.quickRange);
    setFrom(nextFilters.from);
    setTo(nextFilters.to);
    setScope(nextFilters.scope);
    setSelectedStaff(nextFilters.selectedStaff);
    setSelectedTeam(nextFilters.selectedTeam);
    setTopStaffMetric(nextFilters.topStaffMetric);
    setStaffSortKey(nextFilters.staffSortKey);
    setTeamSortKey(nextFilters.teamSortKey);
    setTopStaffVisibleCount(nextFilters.topStaffVisibleCount);
    setColumnVisibility(buildColumnVisibilityState(nextColumnPrefs));
    setSelectedRuleId(nextFilters.ruleId);
    setAdjustmentPageSize(nextFilters.adjustmentPageSize);
    setAdjustmentPage(0);
    setDetailPageSize(nextDetailPageSize);
    setDetailPageSizeMode(
      DETAIL_PAGE_SIZE_OPTIONS.includes(nextDetailPageSize) ? "preset" : "custom",
    );
    setDetailPageSizeCustomInput(
      DETAIL_PAGE_SIZE_OPTIONS.includes(nextDetailPageSize) ? "" : String(nextDetailPageSize),
    );
    setStaffDetailPage(0);
    setTeamDetailPage(0);
  };

  return {
    storedRuleId,
    quickRange,
    setQuickRange,
    from,
    setFrom,
    to,
    setTo,
    scope,
    setScope,
    selectedStaff,
    setSelectedStaff,
    selectedTeam,
    setSelectedTeam,
    staffViewMode,
    setStaffViewMode,
    teamViewMode,
    setTeamViewMode,
    topStaffMetric,
    setTopStaffMetric,
    staffSortKey,
    setStaffSortKey,
    teamSortKey,
    setTeamSortKey,
    topStaffVisibleCount,
    setTopStaffVisibleCount,
    columnVisibility,
    exportColumns,
    handleToggleColumnVisibility,
    scheduleCollapsed,
    setScheduleCollapsed,
    selectedRuleId,
    setSelectedRuleId,
    adjustmentPageSize,
    adjustmentPage,
    setAdjustmentPage,
    detailPageSize,
    detailPageSizeMode,
    detailPageSizeCustomInput,
    templatePayload,
    staffDetailPage,
    setStaffDetailPage,
    teamDetailPage,
    setTeamDetailPage,
    applyTemplateFilters,
    handleQuickRangeChange,
    handleDetailPageSizeChange,
    handleDetailPageSizeCustomInputChange,
    handleAdjustmentPageSizeChange,
  };
}

export default useReportViewerPreferences;
