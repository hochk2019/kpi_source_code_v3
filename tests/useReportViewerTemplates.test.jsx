import React from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import useReportViewerTemplates from "@/components/reporting/useReportViewerTemplates.js";

const { appDialogAlertMock, appDialogConfirmMock } = vi.hoisted(() => ({
  appDialogAlertMock: vi.fn().mockResolvedValue(undefined),
  appDialogConfirmMock: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/hooks/useAppDialog.tsx", () => ({
  useAppDialog: () => ({
    alert: appDialogAlertMock,
    confirm: appDialogConfirmMock,
  }),
  AppDialogProvider: ({ children }) => children,
}));

describe("useReportViewerTemplates", () => {
  beforeEach(() => {
    window.localStorage.clear();
    appDialogAlertMock.mockClear().mockResolvedValue(undefined);
    appDialogConfirmMock.mockClear().mockResolvedValue(true);
    vi.spyOn(window, "prompt").mockImplementation(() => "Mẫu tuần này");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("saves, applies, overwrites, and deletes local report templates", async () => {
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
      {
        initialProps: { templatePayload: initialPayload },
      },
    );

    await act(async () => {
      await result.current.handleSaveTemplateAsNew();
    });

    expect(result.current.templates).toHaveLength(1);
    expect(result.current.selectedTemplateId).toBe(result.current.templates[0].id);
    expect(result.current.appliedTemplate?.name).toBe("Mẫu tuần này");

    await act(async () => {
      await result.current.handleApplySelectedTemplate();
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

    await act(async () => {
      await result.current.handleOverwriteSelectedTemplate();
    });

    expect(result.current.templates[0].filters).toMatchObject({
      selectedTeam: "team-9",
      ruleId: "rule-10",
    });

    await act(async () => {
      await result.current.handleDeleteSelectedTemplate();
    });

    expect(result.current.templates).toHaveLength(0);
    expect(result.current.selectedTemplateId).toBe("");
    expect(result.current.appliedTemplate).toBeNull();
  });
});

