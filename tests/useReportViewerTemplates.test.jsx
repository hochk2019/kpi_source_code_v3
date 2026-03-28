import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import useReportViewerTemplates from "@/components/reporting/useReportViewerTemplates.js";

describe("useReportViewerTemplates", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "prompt").mockImplementation(() => "Mẫu tuần này");
    vi.spyOn(window, "confirm").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("saves, applies, overwrites, and deletes local report templates", () => {
    const applyTemplateSpy = vi.fn();
    const initialPayload = {
      quickRange: "custom",
      from: "2024-09-01",
      to: "2024-09-30",
      scope: "team",
      selectedStaff: "all",
      selectedTeam: "team-7",
      staffSortKey: "decls",
      teamSortKey: "licenses",
      topStaffMetric: "decls",
      topStaffVisibleCount: 12,
      columns: { items: false },
      ruleId: "rule-9",
      adjustmentPageSize: 20,
      detailPageSize: 180,
    };

    const { result, rerender } = renderHook(
      ({ templatePayload }) =>
        useReportViewerTemplates({
          templatePayload,
          onApplyTemplateFilters: applyTemplateSpy,
        }),
      { initialProps: { templatePayload: initialPayload } },
    );

    act(() => {
      result.current.handleSaveTemplateAsNew();
    });

    expect(result.current.templates).toHaveLength(1);
    expect(result.current.selectedTemplateId).toBe(result.current.templates[0].id);
    expect(result.current.appliedTemplate?.name).toBe("Mẫu tuần này");

    act(() => {
      result.current.handleApplySelectedTemplate();
    });

    expect(applyTemplateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        quickRange: "custom",
        selectedTeam: "team-7",
        ruleId: "rule-9",
      }),
    );

    rerender({
      templatePayload: {
        ...initialPayload,
        selectedTeam: "team-9",
        ruleId: "rule-10",
      },
    });

    act(() => {
      result.current.handleOverwriteSelectedTemplate();
    });

    expect(result.current.templates[0].filters).toMatchObject({
      selectedTeam: "team-9",
      ruleId: "rule-10",
    });

    act(() => {
      result.current.handleDeleteSelectedTemplate();
    });

    expect(result.current.templates).toHaveLength(0);
    expect(result.current.selectedTemplateId).toBe("");
    expect(result.current.appliedTemplate).toBeNull();
  });
});

