import React from "react";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReportingDashboardOverview } from "@/components/reporting/ReportingDashboardOverview.jsx";

const formatInt = (value) => String(Number(value || 0));
const formatDecimal = (value) => Number(value || 0).toFixed(1);

function createProps(overrides = {}) {
  return {
    summary: {
      decls: 12,
      import: 7,
      export: 5,
      kpi: 88.5,
      licenses: 4,
      licenseCount: 3,
      co: 6,
      coLines: 9,
      licenseSummary: "A01, B02, C03",
    },
    adjustmentsReport: {
      approvedCount: 3,
      pendingCount: 1,
      rejectedCount: 1,
      appliedCount: 3,
      totalPoints: 5.5,
      applied: [
        {
          key: "approved-1",
          date: "2024-08-01",
          displayDate: "2024-08-01",
          label: "Hỗ trợ kiểm tra",
          staffName: "Alice",
          teamName: "Team A",
          quantity: 1,
          unitPoints: 5.5,
          kpi: 5.5,
          referencesText: "TK-01",
          note: "Bổ sung",
        },
      ],
      list: [
        {
          id: "pending-1",
          label: "Chờ duyệt 1",
          category: "support",
          staffName: "Bob",
          month: "2024-08",
          totalPoints: 2,
          status: "pending",
        },
      ],
      totalsList: [{ key: "support", label: "Hỗ trợ", points: 5.5, quantity: 1 }],
    },
    summaryCompanyCardValue: 2,
    companyCardSubtitle: "2 công ty có phát sinh",
    trendSeries: [],
    trendComparison: null,
    chartPalette: ["#2563eb", "#22c55e"],
    teamPieData: [],
    teamDeclPieData: [],
    topStaffMetric: "kpi",
    onTopStaffMetricChange: vi.fn(),
    topStaffByKpi: [
      {
        key: "alice-kpi",
        name: "Alice",
        stats: { kpi: 12.5, decls: 4, items: 7, licenses: 2, co: 1, coLines: 3 },
      },
    ],
    topStaffByDecls: [{ key: "alice-decls", name: "Alice", decls: 9, team: "Team A" }],
    topStaffVisibleCount: 5,
    onTopStaffVisibleCountChange: vi.fn(),
    adjustmentPage: 0,
    adjustmentPageSize: 5,
    onAdjustmentPageChange: vi.fn(),
    onAdjustmentPageSizeChange: vi.fn(),
    formatInt,
    formatDecimal,
    ...overrides,
  };
}

describe("ReportingDashboardOverview", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the extracted overview composition and forwards child interactions", async () => {
    const props = createProps();

    render(<ReportingDashboardOverview {...props} />);

    expect(screen.getByText("Tổng tờ khai")).toBeTruthy();
    expect(screen.getByText("Tổng điểm KPI")).toBeTruthy();
    expect(screen.getByText("Tổng số công ty")).toBeTruthy();
    expect(screen.getByText("Danh sách mã giấy phép")).toBeTruthy();
    expect(screen.getByText(/chưa có dữ liệu để hiển thị biểu đồ xu hướng/i)).toBeTruthy();
    expect(screen.getByText(/phân bổ kpi theo tổ đội/i)).toBeTruthy();
    expect(screen.getByText(/top nhân viên theo điểm kpi/i)).toBeTruthy();
    expect(screen.getAllByText("Điểm KPI +/- bổ sung").length).toBeGreaterThan(0);
    expect(screen.getByText("Hỗ trợ kiểm tra")).toBeTruthy();

    await waitFor(() => {
      expect(props.onAdjustmentPageChange).toHaveBeenCalledWith(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "Số tờ khai" }));
    expect(props.onTopStaffMetricChange).toHaveBeenCalledWith("decls");

    fireEvent.change(screen.getByLabelText("Hiển thị"), {
      target: { value: "7" },
    });
    expect(props.onTopStaffVisibleCountChange).toHaveBeenCalledWith(7);

    fireEvent.change(screen.getByLabelText("Số mục mỗi trang"), {
      target: { value: "20" },
    });
    expect(props.onAdjustmentPageSizeChange).toHaveBeenCalledWith("20");
  });
});
