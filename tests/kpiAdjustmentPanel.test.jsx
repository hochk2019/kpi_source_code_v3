import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import KpiAdjustmentPanel from "@/components/report-viewer/KpiAdjustmentPanel.jsx";

vi.mock("../src/components/report-viewer/KpiAdjustmentDetail.jsx", () => ({
  __esModule: true,
  default: function MockAdjustmentDetail() {
    return <div data-testid="adjustment-detail">mock detail</div>;
  },
}));

const baseProps = {
  adjustmentsReport: {
    totalPoints: 10,
    approvedCount: 3,
    appliedCount: 3,
    pendingCount: 2,
    rejectedCount: 1,
  },
  paginatedAppliedAdjustments: { rows: [], total: 0 },
  pendingAdjustments: [
    { id: "p-1", label: "Điểm cộng thử", month: "2024-12", totalPoints: 2, staffName: "Lan" },
  ],
  rejectedAdjustments: [
    { id: "r-1", label: "Điểm trừ", month: "2024-12", totalPoints: -1, staffName: "Nam" },
  ],
  adjustmentTotals: [
    { key: "support", label: "Hỗ trợ", points: 4, quantity: 2 },
    { key: "cancel", label: "Hủy", points: -1, quantity: 1 },
    { key: "teamwork", label: "Tổ đội", points: 2, quantity: 3 },
  ],
  adjustmentStatusStats: [
    { label: "Đã duyệt", value: 3, tone: "text-emerald-600" },
    { label: "Đang chờ", value: 1, tone: "text-amber-600" },
  ],
  adjustmentPageSize: 10,
  onAdjustmentPageSizeChange: () => {},
  onAdjustmentPrev: () => {},
  onAdjustmentNext: () => {},
  currentAdjustmentPage: 0,
  totalAdjustmentPages: 1,
  defaultExpanded: true,
  onModeChange: () => {},
  formatDecimal: (value) => String(value ?? 0),
  formatInt: (value) => String(value ?? 0),
  formatOptionalDecimal: (value) => String(value ?? 0),
  formatOptionalInt: (value) => String(value ?? 0),
};

function renderPanel(overrides = {}) {
  return render(<KpiAdjustmentPanel {...baseProps} {...overrides} />);
}

describe("KpiAdjustmentPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("lưu trạng thái thu gọn vào localStorage", async () => {
    const user = userEvent.setup();
    renderPanel();

    const collapseButton = screen.getByRole("button", { name: /thu gọn/i });
    await user.click(collapseButton);

    expect(
      screen.getByText(/Khu vực đang được thu gọn. Chọn "Mở rộng" để xem thống kê/),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem("kpi-report.adjustment-panel.expanded")).toBe("0");

    const expandButton = screen.getByRole("button", { name: /mở rộng/i });
    await user.click(expandButton);

    expect(window.localStorage.getItem("kpi-report.adjustment-panel.expanded")).toBe("1");
  });

  it("khóa thao tác thu gọn khi người dùng chỉ đọc", async () => {
    const user = userEvent.setup();
    renderPanel({ readOnly: true });

    const collapseButton = screen.getByRole("button", { name: /thu gọn/i });
    expect(collapseButton).toBeDisabled();

    await user.click(collapseButton);

    const helperText = screen.getByText(/Khu vực đang được thu gọn. Chọn "Mở rộng" để xem thống kê/);
    expect(helperText).toHaveClass("hidden");
    expect(window.localStorage.getItem("kpi-report.adjustment-panel.expanded")).toBe("1");
  });
});
