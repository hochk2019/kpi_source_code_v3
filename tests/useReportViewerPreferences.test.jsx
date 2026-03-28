import React from "react";

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  REPORT_PREFS_STORAGE_KEY,
  buildReportTemplatePayload,
  loadReportPreferences,
  sanitizeColumnVisibility,
  sanitizeReportTemplateFilters,
  useReportViewerPreferences,
} from "@/components/reporting/useReportViewerPreferences.js";

describe("useReportViewerPreferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("loads stored preferences and normalizes persisted fields", async () => {
    window.localStorage.setItem(
      REPORT_PREFS_STORAGE_KEY,
      JSON.stringify({
        quickRange: "custom",
        from: "2024-08-01",
        to: "2024-08-31",
        scope: "team",
        selectedStaff: "staff-a",
        selectedTeam: "team-a",
        staffSortKey: "decls",
        teamSortKey: "licenses",
        topStaffMetric: "decls",
        topStaffVisibleCount: 12,
        columns: { items: false, co: false, ignored: false },
        ruleId: " boosted-kpi ",
        adjustmentPageSize: 20,
        detailPageSize: 300,
        scheduleCollapsed: true,
      }),
    );

    const { result } = renderHook(() => useReportViewerPreferences());

    await waitFor(() => {
      expect(result.current.teamViewMode).toBe("detail");
    });

    expect(result.current.quickRange).toBe("custom");
    expect(result.current.from).toBe("2024-08-01");
    expect(result.current.to).toBe("2024-08-31");
    expect(result.current.scope).toBe("team");
    expect(result.current.selectedStaff).toBe("staff-a");
    expect(result.current.selectedTeam).toBe("team-a");
    expect(result.current.staffSortKey).toBe("decls");
    expect(result.current.teamSortKey).toBe("licenses");
    expect(result.current.topStaffMetric).toBe("decls");
    expect(result.current.topStaffVisibleCount).toBe(12);
    expect(result.current.columnVisibility.items).toBe(false);
    expect(result.current.columnVisibility.co).toBe(false);
    expect(result.current.exportColumns).toEqual({ items: false, co: false });
    expect(result.current.selectedRuleId).toBe("boosted-kpi");
    expect(result.current.adjustmentPageSize).toBe(20);
    expect(result.current.detailPageSize).toBe(300);
    expect(result.current.scheduleCollapsed).toBe(true);
  });

  it("persists sanitized updates for quick range, adjustment page size, and detail page size", async () => {
    const { result } = renderHook(() => useReportViewerPreferences());

    act(() => {
      result.current.handleQuickRangeChange("all_time");
      result.current.handleAdjustmentPageSizeChange(999);
    });

    act(() => {
      result.current.handleDetailPageSizeCustomInputChange({ target: { value: "999" } });
    });

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(REPORT_PREFS_STORAGE_KEY) || "{}");
      expect(saved.quickRange).toBe("all_time");
      expect(saved.adjustmentPageSize).toBe(10);
      expect(saved.detailPageSize).toBe(500);
    });

    expect(result.current.detailPageSizeMode).toBe("custom");
    expect(result.current.detailPageSize).toBe(500);
    expect(result.current.detailPageSizeCustomInput).toBe("500");
  });

  it("guards invalid localStorage payloads and only keeps known export columns", () => {
    window.localStorage.setItem(REPORT_PREFS_STORAGE_KEY, "{bad json");

    expect(loadReportPreferences()).toEqual({});
    expect(
      sanitizeColumnVisibility({
        items: false,
        licenses: false,
        extra: false,
      }),
    ).toEqual({
      items: false,
      licenses: false,
    });
  });

  it("builds and applies a sanitized report template snapshot", async () => {
    const { result } = renderHook(() => useReportViewerPreferences());

    act(() => {
      result.current.applyTemplateFilters({
        quickRange: "custom",
        from: "2024-09-01",
        to: "2024-09-30",
        scope: "team",
        selectedStaff: "staff-9",
        selectedTeam: "team-2",
        staffSortKey: "decls",
        teamSortKey: "licenses",
        topStaffMetric: "decls",
        topStaffVisibleCount: 12,
        columns: { items: false, licenseCodes: false, ignored: false },
        ruleId: " custom-rule ",
        adjustmentPageSize: 20,
        detailPageSize: 180,
      });
    });

    await waitFor(() => {
      expect(result.current.scope).toBe("team");
      expect(result.current.selectedRuleId).toBe("custom-rule");
    });

    expect(result.current.quickRange).toBe("custom");
    expect(result.current.from).toBe("2024-09-01");
    expect(result.current.to).toBe("2024-09-30");
    expect(result.current.selectedStaff).toBe("staff-9");
    expect(result.current.selectedTeam).toBe("team-2");
    expect(result.current.staffSortKey).toBe("decls");
    expect(result.current.teamSortKey).toBe("licenses");
    expect(result.current.topStaffMetric).toBe("decls");
    expect(result.current.topStaffVisibleCount).toBe(12);
    expect(result.current.columnVisibility.items).toBe(false);
    expect(result.current.columnVisibility.licenseCodes).toBe(false);
    expect(result.current.adjustmentPageSize).toBe(20);
    expect(result.current.detailPageSize).toBe(180);
    expect(result.current.templatePayload).toEqual(
      buildReportTemplatePayload({
        quickRange: "custom",
        from: "2024-09-01",
        to: "2024-09-30",
        scope: "team",
        selectedStaff: "staff-9",
        selectedTeam: "team-2",
        staffSortKey: "decls",
        teamSortKey: "licenses",
        topStaffMetric: "decls",
        topStaffVisibleCount: 12,
        columns: { items: false, licenseCodes: false },
        ruleId: "custom-rule",
        adjustmentPageSize: 20,
        detailPageSize: 180,
      }),
    );

    expect(
      sanitizeReportTemplateFilters({
        quickRange: "all_time",
        scope: "invalid",
        topStaffVisibleCount: "999",
      }),
    ).toMatchObject({
      quickRange: "all_time",
      scope: "staff",
      topStaffVisibleCount: "auto",
    });
  });
});
