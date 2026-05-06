import React from "react";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CompanySummaryTable } from "@/components/reporting/CompanySummaryTable.jsx";
import {
  SummaryCard,
  TeamPieWidget,
  TopStaffWidget,
  TrendLineChart,
} from "@/components/reporting/ReportingOverviewWidgets.jsx";

const formatInt = (value) => String(Number(value || 0));
const formatDecimal = (value) => Number(value || 0).toFixed(1);
const ZERO_SIZE_WARNING_PATTERN =
  /The width\(0\) and height\(0\) of chart should be greater than 0/i;

function collectConsoleMessages(spy) {
  return spy.mock.calls
    .flat()
    .map((value) => String(value))
    .join("\n");
}

describe("reporting overview widgets", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
      />,
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
      </>,
    );

    expect(screen.getByText(/Tổng KPI/i)).toBeTruthy();
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
        <TeamPieWidget
          kpiData={[]}
          declData={[]}
          formatInt={formatInt}
          formatDecimal={formatDecimal}
        />
      </>,
    );

    expect(screen.getByText(/top nhân viên theo điểm kpi/i)).toBeTruthy();
    expect(screen.getByText(/1. Alice/)).toBeTruthy();
    expect(screen.getByText(/phân bổ kpi theo tổ đội/i)).toBeTruthy();
    expect(screen.getByText(/chưa có dữ liệu kpi cho các tổ đội/i)).toBeTruthy();
  });

  it("renders populated chart branches without zero-size jsdom warnings", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(
      <>
        <TrendLineChart
          data={[
            { period: "2026-01", kpi: 8.5, decls: 4 },
            { period: "2026-02", kpi: 10, decls: 6 },
          ]}
          comparison={{
            delta: {
              kpi: 1.5,
              decls: 2,
              kpiPercent: 17.6,
            },
          }}
        />
        <TopStaffWidget
          metric="decls"
          onMetricChange={() => {}}
          kpiData={[]}
          declData={[
            {
              key: "alice",
              name: "Alice",
              decls: 9,
              team: "Team A",
            },
          ]}
          visibleCountPreference={5}
          onVisibleCountPreferenceChange={() => {}}
          formatInt={formatInt}
          formatDecimal={formatDecimal}
        />
      </>,
    );

    expect(screen.getByText(/so với kỳ liền trước:/i)).toBeTruthy();
    expect(screen.getByText(/\+1\.5 điểm KPI/i)).toBeTruthy();
    expect(screen.getByText(/top nhân viên theo số tờ khai/i)).toBeTruthy();
    expect(screen.getByText(/tổng: 9 tờ khai/i)).toBeTruthy();
    expect(collectConsoleMessages(consoleError)).not.toMatch(ZERO_SIZE_WARNING_PATTERN);
    expect(collectConsoleMessages(consoleWarn)).not.toMatch(ZERO_SIZE_WARNING_PATTERN);
  });
});
