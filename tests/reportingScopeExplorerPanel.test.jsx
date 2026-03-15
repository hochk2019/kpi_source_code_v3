import React from "react";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReportingScopeExplorerPanel } from "@/components/reporting/ReportingScopeExplorerPanel.jsx";

vi.mock("@/components/reporting/ReportingStaffSection.jsx", () => ({
  ReportingStaffSection: (props) => (
    <div data-testid="staff-section">staff-section:{props.selectedStaff}</div>
  ),
}));

vi.mock("@/components/reporting/ReportingTeamSection.jsx", () => ({
  ReportingTeamSection: (props) => <div data-testid="team-section">team-section:{props.selectedTeam}</div>,
}));

function buildProps(overrides = {}) {
  return {
    scope: "staff",
    onScopeChange: vi.fn(),
    selectedStaff: "all",
    onSelectedStaffChange: vi.fn(),
    selectedTeam: "all",
    onSelectedTeamChange: vi.fn(),
    staffOptions: [
      { value: "all", label: "Tất cả nhân viên (2)" },
      { value: "alice", label: "Alice — Team 1" },
    ],
    teamOptions: [
      { value: "all", label: "Tất cả tổ đội (2)" },
      { value: "team-alpha", label: "Team Alpha" },
    ],
    columnVisibility: {
      items: true,
      licenses: false,
      co: true,
      coLines: true,
      licenseCodes: true,
    },
    onToggleColumnVisibility: vi.fn(),
    reportLoading: false,
    reportError: "",
    summary: { decls: 2 },
    staffViewMode: "summary",
    setStaffViewMode: vi.fn(),
    staffSortKey: "kpi",
    setStaffSortKey: vi.fn(),
    staffDetailPage: 0,
    setStaffDetailPage: vi.fn(),
    filteredStaffList: [],
    filteredCompanySummaryStaff: [],
    activeStaff: null,
    handleExportStaffAll: vi.fn(),
    handleExportStaffDetail: vi.fn(),
    teamViewMode: "summary",
    setTeamViewMode: vi.fn(),
    teamSortKey: "kpi",
    setTeamSortKey: vi.fn(),
    teamDetailPage: 0,
    setTeamDetailPage: vi.fn(),
    filteredTeamList: [],
    filteredCompanySummaryTeam: [],
    activeTeam: null,
    handleExportTeamAll: vi.fn(),
    handleExportTeamDetail: vi.fn(),
    canExport: true,
    exporting: false,
    detailPageSize: 20,
    detailPageSizeMode: "preset",
    detailPageSizeCustomInput: "",
    handleDetailPageSizeChange: vi.fn(),
    handleDetailPageSizeCustomInputChange: vi.fn(),
    formatInt: (value) => String(Number(value || 0)),
    formatDecimal: (value) => Number(value || 0).toFixed(1),
    ...overrides,
  };
}

describe("ReportingScopeExplorerPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the staff branch and forwards scope, selection, and column toggle actions", () => {
    const props = buildProps();
    render(<ReportingScopeExplorerPanel {...props} />);

    expect(screen.getByTestId("staff-section").textContent).toContain("all");
    expect(screen.queryByTestId("team-section")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Tổ đội" }));
    expect(props.onScopeChange).toHaveBeenCalledWith("team");

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "alice" },
    });
    expect(props.onSelectedStaffChange).toHaveBeenCalledWith("alice");

    fireEvent.click(screen.getByLabelText("Số giấy phép"));
    expect(props.onToggleColumnVisibility).toHaveBeenCalledWith("licenses");
  });

  it("renders the team branch and forwards team selection", () => {
    const props = buildProps({
      scope: "team",
      selectedTeam: "team-alpha",
    });
    render(<ReportingScopeExplorerPanel {...props} />);

    expect(screen.getByTestId("team-section").textContent).toContain("team-alpha");
    expect(screen.queryByTestId("staff-section")).toBeNull();

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "all" },
    });
    expect(props.onSelectedTeamChange).toHaveBeenCalledWith("all");
  });
});
