import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CompanySummaryTable } from "@/components/reporting/CompanySummaryTable.jsx";
import {
  SummaryCard,
  TeamPieWidget,
  TopStaffWidget,
  TrendLineChart,
} from "@/components/reporting/ReportingOverviewWidgets.jsx";

const formatInt = (value) => String(Number(value || 0));
const formatDecimal = (value) => Number(value || 0).toFixed(1);

describe("reporting overview widgets", () => {
  it("sorts company summary rows by the requested metric", () => {
    render(
      <CompanySummaryTable
        rows={[
          { cong_ty: "Beta", mst: "002", kpi: 4, decls: 7, licenses: 1, licenseSummary: "B1" },
          { cong_ty: "Alpha", mst: "001", kpi: 8, decls: 3, licenses: 2, licenseSummary: "A1" },
        ]}
        sortKey="kpi"
        formatInt={formatInt}
        formatDecimal={formatDecimal}
      />
    );

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("Alpha")).toBeTruthy();
    expect(within(rows[2]).getByText("Beta")).toBeTruthy();
  });

  it("renders summary and empty-state trend widgets", () => {
    render(
      <>
        <SummaryCard title="Tổng KPI" value="88.0" subtitle="So với kỳ trước" />
        <TrendLineChart data={[]} comparison={null} />
      </>
    );

    expect(screen.getByText("Tổng KPI")).toBeTruthy();
    expect(screen.getByText("88.0")).toBeTruthy();
    expect(screen.getByText(/chưa có dữ liệu để hiển thị biểu đồ xu hướng/i)).toBeTruthy();
  });

  it("renders top staff and team pie widgets without chart noise paths", () => {
    render(
      <>
        <TopStaffWidget
          metric="kpi"
          onMetricChange={() => {}}
          kpiData={[
            {
              key: "alice",
              name: "Alice",
              stats: { kpi: 12.5, decls: 4, items: 7, licenses: 2, co: 1, coLines: 3 },
            },
          ]}
          declData={[]}
          visibleCountPreference={5}
          onVisibleCountPreferenceChange={() => {}}
          formatInt={formatInt}
          formatDecimal={formatDecimal}
        />
        <TeamPieWidget kpiData={[]} declData={[]} formatInt={formatInt} formatDecimal={formatDecimal} />
      </>
    );

    expect(screen.getByText(/top nhân viên theo điểm kpi/i)).toBeTruthy();
    expect(screen.getByText(/1. Alice/)).toBeTruthy();
    expect(screen.getByText(/phân bổ kpi theo tổ đội/i)).toBeTruthy();
    expect(screen.getByText(/chưa có dữ liệu kpi cho các tổ đội/i)).toBeTruthy();
  });
});
