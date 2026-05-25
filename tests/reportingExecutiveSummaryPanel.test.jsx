import React from "react";

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReportingExecutiveSummaryPanel } from "@/components/reporting/ReportingExecutiveSummaryPanel.jsx";

const formatInt = (value) => String(Number(value || 0));
const formatDecimal = (value) => Number(value || 0).toFixed(1);

describe("ReportingExecutiveSummaryPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders executive highlights and deviation signals from current reporting inputs", () => {
    render(
      <ReportingExecutiveSummaryPanel
        summary={{ kpi: 100, decls: 20 }}
        adjustmentsReport={{ approvedCount: 2, pendingCount: 3 }}
        trendComparison={{
          delta: {
            kpi: -5,
            decls: 2,
            kpiPercent: -4.8,
          },
        }}
        topStaffByKpi={[
          {
            name: "Alice",
            stats: { kpi: 40 },
          },
        ]}
        teamPieData={[
          { name: "Team A", value: 62 },
          { name: "Team B", value: 38 },
        ]}
        formatInt={formatInt}
        formatDecimal={formatDecimal}
      />,
    );

    expect(screen.getByText(/Tóm tắt điều hành KPI/i)).toBeTruthy();
    expect(screen.getByText(/KPI \/ tờ khai/i)).toBeTruthy();
    expect(screen.getByText("5.0")).toBeTruthy();
    expect(screen.getByText(/Nhân sự dẫn đầu/i)).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText(/Tổ đội chiếm tỷ trọng cao nhất/i)).toBeTruthy();
    expect(screen.getByText("Team A")).toBeTruthy();
    expect(screen.getAllByText(/62\.0% tổng KPI/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Điều chỉnh chờ duyệt/i)).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText(/Tín hiệu lệch chuẩn/i)).toBeTruthy();
    expect(screen.getByText(/Xu hướng KPI đang giảm/i)).toBeTruthy();
    expect(screen.getByText(/-5\.0 điểm KPI \(-4\.8%\) so với kỳ liền trước/i)).toBeTruthy();
    expect(screen.getByText(/Điều chỉnh KPI chưa khóa sổ/i)).toBeTruthy();
    expect(screen.getByText(/3 điều chỉnh đang chờ duyệt/i)).toBeTruthy();
    expect(screen.getByText(/KPI đang tập trung mạnh vào một tổ đội/i)).toBeTruthy();
    expect(screen.getByText(/Team A chiếm 62\.0% tổng KPI/i)).toBeTruthy();
    expect(screen.getByText(/Top nhân sự chiếm tỷ trọng KPI cao/i)).toBeTruthy();
    expect(screen.getByText(/Alice đang đóng góp 40\.0% tổng KPI/i)).toBeTruthy();
  });

  it("renders calm fallback when no deviations are detected", () => {
    render(
      <ReportingExecutiveSummaryPanel
        summary={{ kpi: 12, decls: 6 }}
        adjustmentsReport={{ approvedCount: 0, pendingCount: 0 }}
        trendComparison={null}
        topStaffByKpi={[]}
        teamPieData={[]}
        formatInt={formatInt}
        formatDecimal={formatDecimal}
      />,
    );

    expect(screen.getByText(/không phát hiện lệch chuẩn nổi bật trong kỳ hiện tại/i)).toBeTruthy();
  });
});
