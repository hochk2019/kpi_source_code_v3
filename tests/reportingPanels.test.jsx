import React from "react";

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  createScheduleDraft,
  ReportingControlsPanel,
  ReportingSchedulePanel,
  toSchedulePayload,
} from "@/components/reporting/ReportingPanels.jsx";

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

    expect(
      toSchedulePayload({
        ...draft,
        frequency: "monthly",
        dayOfMonth: 15,
        recipientsInput: "ceo@company.vn",
      })
    ).toMatchObject({
      id: "weekly-kpi",
      frequency: "monthly",
      dayOfWeek: null,
      dayOfMonth: 15,
      recipients: "ceo@company.vn",
      formats: ["excel"],
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
      />
    );

    expect(screen.getByRole("region", { name: /điều khiển báo cáo kpi/i })).toBeTruthy();
    expect(screen.getAllByText("Rules tháng 8")).toHaveLength(2);
    expect(screen.getByText(/lịch gửi tiếp theo:/i)).toBeTruthy();
    expect(screen.getByText(/tổng hợp tháng mặc định: 2024-08-01 → 2024-08-31/i)).toBeTruthy();
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
  });
});
