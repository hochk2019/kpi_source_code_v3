import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, afterEach, expect } from "vitest";

import ReportContextToolbar from "@/components/report-viewer/ReportContextToolbar.jsx";

const TEMPLATE_OPTIONS = [{ value: "tpl-1", label: "Template KPI" }];
const RULE_OPTIONS = [{ value: "rule-1", label: "Rules tháng 8" }];

function renderToolbar(props = {}) {
  return render(
    <ReportContextToolbar
      templateOptions={TEMPLATE_OPTIONS}
      ruleOptions={RULE_OPTIONS}
      onTemplateChange={() => {}}
      onRuleChange={() => {}}
      onSaveTemplate={() => {}}
      onOverwriteTemplate={() => {}}
      onDeleteTemplate={() => {}}
      appliedContextLabel="Template: Tuỳ chỉnh • Bộ quy tắc: Rules tháng 8"
      reportInfo={{
        totalDeclsLabel: "25",
        rangeLabel: "Khoảng: 2024-08-01 → 2024-08-31",
        contextLabel: "Template: Tuỳ chỉnh • Bộ quy tắc: Rules tháng 8",
        ruleApplyLabel: "Áp dụng từ 2024-08-01",
      }}
      {...props}
    />
  );
}

describe("ReportContextToolbar", () => {
  afterEach(() => {
    cleanup();
    window.localStorage?.clear();
  });

  it("mặc định thu gọn các panel và chỉ hiển thị nội dung khi người dùng mở", async () => {
    const user = userEvent.setup();
    renderToolbar();
    expect(screen.queryByLabelText("Template báo cáo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Bộ quy tắc KPI")).not.toBeInTheDocument();
    expect(screen.getByText("Template báo cáo")).toBeInTheDocument();
    const templateToggle = document.querySelector(
      '[data-collapsible-id="report-template-panel"] button[data-tooltip]'
    );
    expect(templateToggle).toHaveAttribute("aria-expanded", "false");
    await user.click(templateToggle);
    expect(screen.getByLabelText("Template báo cáo")).toBeInTheDocument();
    expect(templateToggle).toHaveAttribute("aria-expanded", "true");
  });

  it("hiển thị mô tả phạm vi báo cáo ngay cả khi panel bị thu gọn", () => {
    renderToolbar();
    expect(screen.getByText("Áp dụng từ 2024-08-01")).toBeInTheDocument();
    expect(screen.getByText("Thông tin báo cáo")).toBeInTheDocument();
  });
});
