import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import KpiAdjustmentFormPanel from "@/components/kpi-adjustments/panels/KpiAdjustmentFormPanel.jsx";

function buildProps(overrides = {}) {
  return {
    canApprove: true,
    autoApproveEnabled: false,
    autoApproveSaving: false,
    autoApproveStatusMessage: "Auto approve is ready",
    autoApproveError: "",
    onAutoApproveToggle: vi.fn(),
    onRefreshDeclarations: vi.fn(),
    onOpenGuidance: vi.fn(),
    onOpenSettings: vi.fn(),
    onSubmit: vi.fn((event) => event.preventDefault()),
    formFieldIds: {
      month: "month",
      staff: "staff",
      team: "team",
      taxCode: "tax-code",
      company: "company",
      category: "category",
      license: "license",
      status: "status",
      note: "note",
      references: "references",
      mode: "mode",
      quantity: "quantity",
      unit: "unit",
      extraQuantity: "extra-quantity",
      extraUnit: "extra-unit",
    },
    form: {
      month: "2026-03",
      staffName: "Lan",
      teamName: "Team 1",
      taxCode: "0101234567",
      companyName: "Công ty A",
      category: "support_misc",
      licenseCode: "",
      status: "pending",
      note: "ghi chú",
      referencesInput: "",
      gradeValue: 0,
      quantity: "2",
      unitPoints: "1.5",
      extraQuantity: "3",
      extraUnitPoints: "0.5",
    },
    setForm: vi.fn(),
    normalizeStr: (value) => String(value || "").trim().toLowerCase(),
    filteredStaffOptions: [{ name: "Lan", team: "Team 1" }],
    staffOptions: [{ name: "Lan", team: "Team 1" }],
    teamOptions: ["Team 1"],
    mstOptions: [{ value: "0101234567", label: "0101234567 - Công ty A" }],
    onTaxCodeInput: vi.fn(),
    companyOptions: [{ company: "Công ty A", description: "Công ty A • MST 0101234567" }],
    onCompanyInput: vi.fn(),
    selectFieldClass: "select",
    onCategoryChange: vi.fn(),
    categoryOptions: [{ value: "support_misc", label: "Hỗ trợ khác" }],
    formCategoryConfig: {
      type: "default",
      requiresLicenseCode: false,
      extraPointConfig: {
        quantityLabel: "Số lượng bổ sung",
        unitLabel: "Điểm bổ sung mỗi đơn vị",
      },
    },
    isEditing: false,
    statusSet: new Set(["pending", "approved", "rejected"]),
    statusLabels: {
      pending: "Chờ duyệt",
      approved: "Đã duyệt",
      rejected: "Đã từ chối",
    },
    onLicenseChange: vi.fn(),
    licenseOptions: [],
    quickDeclarationSuggestions: [{ key: "decl-1", soTk: "102030" }],
    onReferencePick: vi.fn(),
    declarationSearch: "102",
    onDeclarationSearchChange: vi.fn(),
    filteredDeclarationResults: [
      {
        key: "decl-2",
        soTk: "102031",
        company: "Công ty B",
        mst: "0209999999",
        branch: "HCM",
        date: "2026-03-20",
      },
    ],
    formatDateOnly: (value) => `date:${value}`,
    normalizedMode: "manual",
    modeOptions: [],
    onModeChange: vi.fn(),
    isHybridFixed: false,
    allowManualPointOverride: true,
    computedExtraTotal: 1.5,
    computedTotal: 4.5,
    formatDecimal: (value) => Number(value || 0).toFixed(1),
    formError: "",
    canSubmit: true,
    onReset: vi.fn(),
    historyEntries: [],
    formatDateTime: (value) => `time:${value}`,
    ...overrides,
  };
}

describe("kpi adjustment form panel", () => {
  it("forwards header and declaration workspace callbacks", async () => {
    const props = buildProps();

    render(<KpiAdjustmentFormPanel {...props} />);

    await userEvent.click(screen.getByTestId("auto-approve-toggle"));
    await userEvent.click(screen.getByRole("button", { name: "Làm mới tham chiếu" }));
    await userEvent.click(screen.getByRole("button", { name: "Hướng dẫn" }));
    await userEvent.click(screen.getByRole("button", { name: "Cấu hình mặc định" }));

    // Form starts collapsed; expand it to access declaration suggestions
    await userEvent.click(screen.getByRole("button", { name: /Mở form thêm điểm/i }));

    await userEvent.click(screen.getByRole("button", { name: "102030" }));

    const resultCard = screen.getByText("102031").closest("div[class*='rounded-lg']");
    await userEvent.click(within(resultCard).getByRole("button", { name: "Thêm" }));

    expect(props.onAutoApproveToggle).toHaveBeenCalled();
    expect(props.onRefreshDeclarations).toHaveBeenCalledTimes(1);
    expect(props.onOpenGuidance).toHaveBeenCalled();
    expect(props.onOpenSettings).toHaveBeenCalled();
    expect(props.onReferencePick).toHaveBeenNthCalledWith(1, props.quickDeclarationSuggestions[0]);
    expect(props.onReferencePick).toHaveBeenNthCalledWith(2, props.filteredDeclarationResults[0]);
    expect(screen.getByText("Auto approve is ready")).toBeInTheDocument();
    expect(resultCard).toHaveTextContent("date:2026-03-20");
  });

  it("renders edit state, computed totals, and history", async () => {
    const props = buildProps({
      isEditing: true,
      canSubmit: false,
      allowManualPointOverride: false,
      historyEntries: [{ id: "hist-1", ts: "2026-03-26T10:00:00.000Z", actor: "manager", action: "approve" }],
    });

    render(<KpiAdjustmentFormPanel {...props} />);

    expect(screen.getByLabelText("Trạng thái")).toHaveValue("pending");
    expect(screen.getAllByTestId("kpi-adjust-total-value")[0]).toHaveTextContent("4.5");
    expect(screen.getAllByText("1.5").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Cập nhật điểm" })).toBeDisabled();
    expect(screen.getByText("time:2026-03-26T10:00:00.000Z")).toBeInTheDocument();
    expect(screen.getByText("manager")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Hủy chỉnh sửa" }));
    expect(props.onReset).toHaveBeenCalled();
  });
});
