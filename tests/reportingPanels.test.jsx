import React from "react";

import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import {
  ReportingControlsPanel,
  ReportingSchedulePanel,
} from "@/components/reporting/ReportingPanels.tsx";
import {
  createScheduleDraft,
  toSchedulePayload,
} from "@/components/reporting/reportingScheduleDraft.js";

describe("ReportingPanels", () => {
  it("normalizes schedule draft state and save payload", () => {
    const draft = createScheduleDraft({
      id: "weekly-kpi",
      name: "KPI tuần",
      recipients: ["ceo@company.vn", "ops@company.vn"],
      formats: [],
      active: true,
    });

    expect(draft.recipientsInput).toBe("ceo@company.vn, ops@company.vn");
    expect(draft.formats).toEqual(["excel"]);
    expect(draft.deliveryChannels).toEqual(["email"]);

    expect(
      toSchedulePayload({
        ...draft,
        frequency: "monthly",
        dayOfMonth: 15,
        recipientsInput: "ceo@company.vn",
        deliveryChannels: ["report_center", "download_bundle"],
      })
    ).toMatchObject({
      id: "weekly-kpi",
      frequency: "monthly",
      dayOfWeek: null,
      dayOfMonth: 15,
      recipients: "ceo@company.vn",
      formats: ["excel"],
      deliveryChannels: ["report_center", "download_bundle"],
      active: true,
    });
  });

  it("renders the reporting controls shell with rule and aggregate status", () => {
    render(
      <ReportingControlsPanel
        summaryDeclsText="12 tờ khai hợp lệ"
        selectedRuleName="Rules tháng 8"
        reloading={false}
        onReloadData={() => {}}
        quickRange="this_month"
        onQuickRangeChange={() => {}}
        from="2024-08-01"
        to="2024-08-31"
        onFromChange={() => {}}
        onToChange={() => {}}
        ruleOptions={[{ value: "rules-aug", label: "Rules tháng 8" }]}
        selectedRuleId="rules-aug"
        onRuleChange={() => {}}
        selectedRuleVersionLabel="v2"
        ruleComparisonLabel=""
        activeRuleMessage="Đang xem đúng bộ quy tắc đang áp dụng."
        nextScheduleRun={{ nextRun: "2024-08-31T01:00:00.000Z" }}
        reportRange={{ from: "2024-08-01", to: "2024-08-31" }}
        ruleApply="Áp dụng từ 2024-08-01"
        scheduleAggregateStatus={{
          available: true,
          range: { from: "2024-08-01", to: "2024-08-31" },
          generatedAt: "2024-08-30T01:00:00.000Z",
        }}
        templates={[{ id: "template-1", name: "Ban điều hành", updatedAt: "2024-08-30T01:00:00.000Z" }]}
        selectedTemplateId="template-1"
        appliedTemplate={{ id: "template-1", name: "Ban điều hành" }}
        appliedTemplateUpdatedAt="30/08/2024 08:00:00"
        templateBusy={false}
        templateSaving={false}
        onSelectTemplate={() => {}}
        onApplySelectedTemplate={() => {}}
        onSaveTemplateAsNew={() => {}}
        onOverwriteSelectedTemplate={() => {}}
        onDeleteSelectedTemplate={() => {}}
        onRefreshTemplates={() => {}}
      />
    );

    expect(screen.getByRole("region", { name: /điều khiển báo cáo kpi/i })).toBeTruthy();
    expect(screen.getAllByText("Rules tháng 8")).toHaveLength(2);
    expect(screen.getByText(/lịch gửi tiếp theo:/i)).toBeTruthy();
    expect(screen.getByText(/tổng hợp tháng mặc định: 2024-08-01 → 2024-08-31/i)).toBeTruthy();
    expect(screen.getByText(/mẫu báo cáo/i)).toBeTruthy();
    expect(screen.getByText(/đang áp dụng:/i)).toBeTruthy();
  });

  it("renders the schedule panel form semantics and schedule list", () => {
    const draft = createScheduleDraft({
      name: "KPI tuần",
      recipients: ["ceo@company.vn"],
    });

    render(
      <ReportingSchedulePanel
        collapsed={false}
        onToggleCollapsed={() => {}}
        nextScheduleRun={{ nextRun: "2024-08-31T01:00:00.000Z" }}
        scheduleAggregateStatus={{ available: true }}
        scheduleDraft={draft}
        editingScheduleId=""
        onSubmit={(event) => event.preventDefault()}
        onFieldChange={() => {}}
        onToggleFormat={() => {}}
        onToggleDeliveryChannel={() => {}}
        onReset={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        schedules={[
          {
            id: "weekly-kpi",
            name: "KPI tuần",
            frequency: "weekly",
            dayOfWeek: 1,
            time: "08:00",
            active: true,
            nextRun: "2024-08-31T01:00:00.000Z",
            deliveryChannels: ["email", "report_center"],
            deliveryStatus: "success",
            lastDeliveryAt: "2024-08-30T01:00:00.000Z",
            formatsSummary: "EXCEL",
            recipientsSummary: "ceo@company.vn",
          },
        ]}
      />
    );

    expect(screen.getByRole("region", { name: /lập lịch gửi báo cáo kpi/i })).toBeTruthy();
    expect(screen.getByRole("form", { name: /biểu mẫu lịch gửi báo cáo kpi/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /thu gọn/i })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("list", { name: /danh sách lịch gửi báo cáo kpi/i })).toBeTruthy();
    expect(screen.getAllByText("KPI tuần").length).toBeGreaterThan(0);
    expect(screen.getByText(/kênh giao báo cáo/i)).toBeTruthy();
    expect(screen.getByText(/đã giao thành công/i)).toBeTruthy();
  });

  it("renders draft preview output and estimated next run before saving", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:00:00.000Z"));

    const draft = createScheduleDraft({
      name: "Lịch điều hành tháng",
      recipients: ["ceo@company.vn", "ops@company.vn", "audit@company.vn"],
      formats: ["excel", "pdf"],
      deliveryChannels: ["report_center", "download_bundle"],
      frequency: "monthly",
      dayOfMonth: 31,
      time: "09:45",
      active: false,
    });

    try {
      cleanup();

      render(
        <ReportingSchedulePanel
          collapsed={false}
          onToggleCollapsed={() => {}}
          nextScheduleRun={null}
          scheduleAggregateStatus={{
            available: true,
            range: { from: "2026-03-01", to: "2026-03-31" },
          }}
          scheduleDraft={draft}
          editingScheduleId=""
          onSubmit={(event) => event.preventDefault()}
          onFieldChange={() => {}}
          onToggleFormat={() => {}}
          onToggleDeliveryChannel={() => {}}
          onReset={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          schedules={[]}
        />
      );

      const scheduleRegion = screen.getByRole("region", { name: /lập lịch gửi báo cáo kpi/i });

      expect(within(scheduleRegion).getByText(/xem trước lần gửi kế tiếp/i)).toBeTruthy();
      expect(within(scheduleRegion).getByText("Lịch điều hành tháng")).toBeTruthy();
      expect(within(scheduleRegion).getByText(/ngày 31 hàng tháng lúc 09:45/i)).toBeTruthy();
      expect(within(scheduleRegion).getByText("Lịch đang tạm tắt")).toBeTruthy();
      expect(within(scheduleRegion).getByText("Excel + PDF")).toBeTruthy();
      expect(within(scheduleRegion).getByText("Không dùng email")).toBeTruthy();
      expect(within(scheduleRegion).getByText("Trung tâm báo cáo + Gói tải xuống")).toBeTruthy();
      expect(within(scheduleRegion).getByText(/read model tháng mặc định 2026-03-01 → 2026-03-31/i)).toBeTruthy();
      expect(within(scheduleRegion).getByText(/09:45 31\/03\/2026/)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
