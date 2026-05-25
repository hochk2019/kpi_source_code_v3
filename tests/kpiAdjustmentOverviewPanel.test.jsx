import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import KpiAdjustmentOverviewPanel from "@/components/kpi-adjustments/panels/KpiAdjustmentOverviewPanel.jsx";

describe("kpi adjustment overview panel", () => {
  it("renders all summary metrics with the expected formatter", () => {
    const formatInt = vi.fn((value) => `int:${value}`);
    const formatDecimal = vi.fn((value) => `dec:${value}`);

    render(
      <KpiAdjustmentOverviewPanel
        stats={{ total: 12, approved: 7, pending: 3, totalPoints: 18.75 }}
        formatInt={formatInt}
        formatDecimal={formatDecimal}
      />
    );

    expect(screen.getByText(/Tổng quan điểm KPI \+\/-/i)).toBeInTheDocument();
    expect(screen.getByText(/Tổng số mục/i)).toBeInTheDocument();
    expect(screen.getByText(/Đã duyệt/i)).toBeInTheDocument();
    expect(screen.getByText(/Chờ duyệt/i)).toBeInTheDocument();
    expect(screen.getByText(/Điểm đã cộng\/trừ/i)).toBeInTheDocument();

    expect(screen.getByText("int:12")).toBeInTheDocument();
    expect(screen.getByText("int:7")).toBeInTheDocument();
    expect(screen.getByText("int:3")).toBeInTheDocument();
    expect(screen.getByText("dec:18.75")).toBeInTheDocument();

    expect(formatInt).toHaveBeenCalledTimes(3);
    expect(formatInt).toHaveBeenNthCalledWith(1, 12);
    expect(formatInt).toHaveBeenNthCalledWith(2, 7);
    expect(formatInt).toHaveBeenNthCalledWith(3, 3);
    expect(formatDecimal).toHaveBeenCalledWith(18.75);
  });
});
