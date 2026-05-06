import React from "react";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ReportingAdjustmentsPanel } from "@/components/reporting/ReportingAdjustmentsPanel.jsx";

function formatInt(value) {
  return String(Number(value || 0));
}

function formatDecimal(value) {
  return Number(value || 0).toFixed(2);
}

function createAppliedAdjustment(index, overrides = {}) {
  return {
    key: `approved-${index}`,
    date: `2024-08-${String(index).padStart(2, "0")}`,
    displayDate: `2024-08-${String(index).padStart(2, "0")}`,
    label: `Hạng mục ${index}`,
    staffName: `Nhân viên ${index}`,
    teamName: `Tổ đội ${index}`,
    quantity: index,
    unitPoints: 1.5,
    kpi: index * 2,
    referencesText: `TK-${index}`,
    note: `Ghi chú ${index}`,
    ...overrides,
  };
}

function createPendingAdjustment(index, overrides = {}) {
  return {
    id: `pending-${index}`,
    label: `Chờ duyệt ${index}`,
    category: "support",
    staffName: `Nhân viên chờ ${index}`,
    month: "2024-08",
    totalPoints: index,
    status: "pending",
    ...overrides,
  };
}

function createRejectedAdjustment(index, overrides = {}) {
  return {
    id: `rejected-${index}`,
    label: `Từ chối ${index}`,
    category: "cancel",
    staffName: `Nhân viên từ chối ${index}`,
    month: "2024-08",
    totalPoints: -index,
    status: "rejected",
    ...overrides,
  };
}

function createAdjustmentsReport(overrides = {}) {
  const applied =
    overrides.applied ||
    Array.from({ length: 6 }, (_, index) => createAppliedAdjustment(index + 1));
  const pending =
    overrides.pending || [createPendingAdjustment(1), createPendingAdjustment(2)];
  const rejected =
    overrides.rejected || [1, 2, 3, 4].map((index) => createRejectedAdjustment(index));
  const totalPoints = applied.reduce((sum, item) => sum + Number(item.kpi || 0), 0);

  return {
    approvedCount: applied.length,
    pendingCount: pending.length,
    rejectedCount: rejected.length,
    appliedCount: applied.length,
    totalPoints,
    applied,
    list: [...pending, ...rejected],
    totalsList: [
      { key: "support", label: "Hỗ trợ", points: 8, quantity: 2 },
      { key: "cancel", label: "Hủy", points: -3, quantity: 1 },
    ],
    ...overrides,
  };
}

function renderPanel(options = {}) {
  const report = createAdjustmentsReport(options.reportOverrides || {});

  function Harness() {
    const [adjustmentPage, setAdjustmentPage] = React.useState(options.adjustmentPage ?? 0);
    const [adjustmentPageSize, setAdjustmentPageSize] = React.useState(
      options.adjustmentPageSize ?? 5,
    );

    return (
      <ReportingAdjustmentsPanel
        adjustmentsReport={report}
        adjustmentPage={adjustmentPage}
        adjustmentPageSize={adjustmentPageSize}
        onAdjustmentPageChange={setAdjustmentPage}
        onAdjustmentPageSizeChange={setAdjustmentPageSize}
        formatInt={formatInt}
        formatDecimal={formatDecimal}
      />
    );
  }

  return render(<Harness />);
}

describe("ReportingAdjustmentsPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders approved adjustments, pending/rejected summaries, and resets paging after page-size change", async () => {
    renderPanel();

    expect(screen.getByText(/Hạng mục 1/i)).toBeTruthy();
    expect(screen.getByText(/Hạng mục 5/i)).toBeTruthy();
    expect(screen.queryByText(/Hạng mục 6/i)).toBeNull();
    expect(screen.getByText("Trang 1/2")).toBeTruthy();
    expect(screen.getByText(/Chờ duyệt 1/i)).toBeTruthy();
    expect(screen.getByText(/Từ chối 1/i)).toBeTruthy();
    expect(screen.getByText(/Còn 1 mục khác đã bị từ chối\./i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Sau" }));

    expect(screen.getByText("Trang 2/2")).toBeTruthy();
    expect(screen.getByText(/Hạng mục 6/i)).toBeTruthy();
    expect(screen.queryByText(/Hạng mục 1/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Sau" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Số mục mỗi trang"), {
      target: { value: "10" },
    });

    await waitFor(() => {
      expect(screen.getByText("Trang 1/1")).toBeTruthy();
    });

    expect(screen.getByText(/Hạng mục 1/i)).toBeTruthy();
    expect(screen.getByText(/Hạng mục 6/i)).toBeTruthy();
  });

  it("renders empty states when there are no approved or queued adjustments", () => {
    renderPanel({
      reportOverrides: {
        approvedCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        appliedCount: 0,
        totalPoints: 0,
        applied: [],
        pending: [],
        rejected: [],
        list: [],
        totalsList: [],
      },
    });

    expect(
      screen.getByText(/Chưa có điểm bổ sung nào được duyệt trong khoảng thời gian này\./i),
    ).toBeTruthy();
    expect(screen.getByText(/Không có yêu cầu đang chờ\./i)).toBeTruthy();
    expect(screen.getByText(/Chưa có dữ liệu phân bổ\./i)).toBeTruthy();
    expect(screen.queryByText(/Đã từ chối gần đây/i)).toBeNull();
  });
});
