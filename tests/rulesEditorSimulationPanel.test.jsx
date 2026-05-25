import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import RulesSimulationPanel from "@/components/rules-editor/RulesSimulationPanel.jsx";

describe("RulesSimulationPanel", () => {
  it("hien thi trang thai rong va goi callback mo phong", () => {
    const onRunSimulation = vi.fn();

    render(<RulesSimulationPanel declarationCount={12} onRunSimulation={onRunSimulation} />);

    expect(screen.getByText('Mô phỏng KPI "Thu"')).toBeInTheDocument();
    expect(screen.getByText(/Chưa có dữ liệu mô phỏng/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Chạy mô phỏng" }));
    expect(onRunSimulation).toHaveBeenCalledTimes(1);
  });

  it("render ket qua preview, baseline va chenh lech", () => {
    render(
      <RulesSimulationPanel
        declarationCount={1}
        simResult={{
          preview: { total: 12.5, average: 12.5, version: 4 },
          baseline: { total: 10, average: 10, version: 3 },
          difference: 2.5,
        }}
      />
    );

    expect(screen.getByText(/Phiên bản đang chỉnh/i)).toBeInTheDocument();
    expect(screen.getByText(/Phiên bản đã lưu/i)).toBeInTheDocument();
    expect(screen.getByText("+2.50")).toBeInTheDocument();
  });
});
