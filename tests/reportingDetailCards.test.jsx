import React from "react";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StaffDetailCard } from "@/components/reporting/StaffDetailCard.jsx";
import { TeamDetailCard } from "@/components/reporting/TeamDetailCard.jsx";

function createDetailRow(index, overrides = {}) {
  return {
    date: `2024-08-0${index}`,
    so_tk: `TK-00${index}`,
    loai_hinh: index % 2 === 0 ? "B11" : "E11",
    isExport: index % 2 === 0,
    num_items: index * 2,
    licenses: index,
    hasCO: index % 2 === 1,
    coLineCount: index,
    licenseSummary: `GP-${index}`,
    licenseExcludedSummary: "",
    kpi: index * 1.5,
    mst: `0100${index}`,
    cong_ty: `Công ty ${index}`,
    nhan_vien: `Nhân viên ${index}`,
    ...overrides,
  };
}

function createCompanyRow(name, kpi) {
  return {
    cong_ty: name,
    mst: `${name}-mst`,
    kpi,
    decls: 1,
    items: 2,
    licenses: 1,
    co: 1,
    coLines: 1,
    licenseSummary: "GP-1",
  };
}

describe("reporting detail cards", () => {
  afterEach(() => {
    cleanup();
  });

  it("pages staff detail rows after switching from summary to detail", () => {
    render(
      <StaffDetailCard
        staff={{
          key: "alice",
          name: "Alice",
          teamLabel: "Team 1",
          stats: { kpi: 9.5, decls: 3, import: 2, export: 1, co: 1, coLines: 2, licenseCount: 2 },
          rows: [createDetailRow(1), createDetailRow(2), createDetailRow(3)],
          companies: [createCompanyRow("Công ty Alpha", 9.5)],
          licenseSummary: "GP-1, GP-2",
          adjustmentTotals: [],
          adjustmentMetrics: {},
        }}
        canExport
        onExport={vi.fn()}
        exporting={false}
        visibleColumns={{}}
        detailPageSize={2}
        detailPageSizeMode="preset"
        detailPageSizeCustomInput=""
        onDetailPageSizeChange={vi.fn()}
        onDetailPageSizeCustomInputChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Công ty Alpha")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Chi tiết" }));

    expect(screen.getByText("1-2 / 3")).toBeTruthy();
    expect(screen.getByText("Trang 1/2")).toBeTruthy();

    const nextButton = screen.getByRole("button", { name: "Sau" });
    fireEvent.click(nextButton);

    expect(screen.getByText("3-3 / 3")).toBeTruthy();
    expect(screen.getByText("Trang 2/2")).toBeTruthy();
    expect(nextButton).toBeDisabled();
  });

  it("sorts team members by metric and pages declaration details", () => {
    render(
      <TeamDetailCard
        team={{
          key: "team-1",
          name: "Team 1",
          stats: { kpi: 12.5, decls: 2, import: 1, export: 1, co: 1, coLines: 2, licenseCount: 2 },
          members: [
            {
              key: "an",
              name: "An",
              stats: {
                kpi: 4,
                decls: 1,
                import: 1,
                export: 0,
                items: 2,
                licenses: 1,
                co: 0,
                coLines: 0,
              },
            },
            {
              key: "binh",
              name: "Bình",
              stats: {
                kpi: 8,
                decls: 1,
                import: 0,
                export: 1,
                items: 3,
                licenses: 1,
                co: 1,
                coLines: 2,
              },
            },
          ],
          rows: [
            createDetailRow(1, { nhan_vien: "An" }),
            createDetailRow(2, { nhan_vien: "Bình" }),
          ],
          companies: [createCompanyRow("Công ty Beta", 12.5)],
          licenseSummary: "GP-Team",
          adjustmentTotals: [],
          adjustmentMetrics: {},
        }}
        canExport
        onExport={vi.fn()}
        exporting={false}
        visibleColumns={{}}
        memberSortKey="kpi"
        detailPageSize={1}
        detailPageSizeMode="preset"
        detailPageSizeCustomInput=""
        onDetailPageSizeChange={vi.fn()}
        onDetailPageSizeCustomInputChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Chi tiết" }));

    const memberTable = screen.getAllByRole("table")[0];
    const memberRows = within(memberTable).getAllByRole("row");
    expect(within(memberRows[1]).getByText("Bình")).toBeTruthy();
    expect(within(memberRows[2]).getByText("An")).toBeTruthy();

    expect(screen.getByText("1-1 / 2")).toBeTruthy();
    expect(screen.getByText("Trang 1/2")).toBeTruthy();

    const nextButton = screen.getByRole("button", { name: "Sau" });
    fireEvent.click(nextButton);

    expect(screen.getByText("2-2 / 2")).toBeTruthy();
    expect(screen.getByText("Trang 2/2")).toBeTruthy();
    expect(nextButton).toBeDisabled();
  });
});
