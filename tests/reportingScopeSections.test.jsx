import React from "react";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReportingStaffSection } from "@/components/reporting/ReportingStaffSection.jsx";
import { ReportingTeamSection } from "@/components/reporting/ReportingTeamSection.jsx";

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

function createCompanyRow(name, kpi, overrides = {}) {
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
    ...overrides,
  };
}

function createStaffEntry(key, name, teamLabel, kpi, overrides = {}) {
  return {
    key,
    name,
    teamLabel,
    stats: {
      kpi,
      decls: 2,
      import: 1,
      export: 1,
      items: 3,
      licenses: 1,
      co: 1,
      coLines: 2,
    },
    rows: [createDetailRow(1, { nhan_vien: name }), createDetailRow(2, { nhan_vien: name })],
    companies: [createCompanyRow(`Công ty ${name}`, kpi, { staff: name })],
    licenseSummary: "GP-1",
    adjustmentTotals: [],
    adjustmentMetrics: {},
    ...overrides,
  };
}

function createTeamEntry(key, name, kpi, overrides = {}) {
  return {
    key,
    name,
    stats: {
      kpi,
      decls: 2,
      import: 1,
      export: 1,
      items: 4,
      licenses: 2,
      co: 1,
      coLines: 2,
    },
    members: [
      createStaffEntry(`${key}-member-a`, `An ${name}`, name, kpi - 1),
      createStaffEntry(`${key}-member-b`, `Bình ${name}`, name, kpi + 1),
    ],
    rows: [createDetailRow(1, { team: name }), createDetailRow(2, { team: name })],
    companies: [createCompanyRow(`Công ty ${name}`, kpi, { team: name, staff: `An ${name}` })],
    licenseSummary: "GP-Team",
    adjustmentTotals: [],
    adjustmentMetrics: {},
    ...overrides,
  };
}

function buildStaffSectionProps(overrides = {}) {
  const staffItems = [
    createStaffEntry("alice", "Alice", "Team 1", 12.5),
    createStaffEntry("bob", "Bob", "Team 2", 9.5),
  ];

  return {
    reportLoading: false,
    reportError: "",
    summary: { decls: 2 },
    selectedStaff: "all",
    staffViewMode: "summary",
    setStaffViewMode: vi.fn(),
    staffSortKey: "kpi",
    setStaffSortKey: vi.fn(),
    staffDetailPage: 0,
    setStaffDetailPage: vi.fn(),
    filteredStaffList: staffItems,
    filteredCompanySummaryStaff: [
      createCompanyRow("Công ty Alice", 12.5, { staff: "Alice" }),
      createCompanyRow("Công ty Bob", 9.5, { staff: "Bob" }),
    ],
    activeStaff: null,
    canExport: true,
    exporting: false,
    handleExportStaffAll: vi.fn(),
    handleExportStaffDetail: vi.fn(),
    columnVisibility: {},
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

function buildTeamSectionProps(overrides = {}) {
  const teamItems = [
    createTeamEntry("team-alpha", "Team Alpha", 14.5),
    createTeamEntry("team-beta", "Team Beta", 10.5),
  ];

  return {
    reportLoading: false,
    reportError: "",
    summary: { decls: 2 },
    selectedTeam: "all",
    teamViewMode: "summary",
    setTeamViewMode: vi.fn(),
    teamSortKey: "kpi",
    setTeamSortKey: vi.fn(),
    teamDetailPage: 0,
    setTeamDetailPage: vi.fn(),
    filteredTeamList: teamItems,
    filteredCompanySummaryTeam: [
      createCompanyRow("Công ty Team Alpha", 14.5, {
        team: "Team Alpha",
        staff: "An Team Alpha",
      }),
    ],
    activeTeam: null,
    canExport: true,
    exporting: false,
    handleExportTeamAll: vi.fn(),
    handleExportTeamDetail: vi.fn(),
    columnVisibility: {},
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

describe("reporting scope sections", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders staff guardrail states before summary data exists", () => {
    const props = buildStaffSectionProps({
      reportLoading: true,
      summary: { decls: 0 },
    });

    const { rerender } = render(<ReportingStaffSection {...props} />);
    expect(screen.getByText(/đang tải dữ liệu báo cáo kpi từ máy chủ/i)).toBeTruthy();

    rerender(<ReportingStaffSection {...props} reportLoading={false} reportError="boom" />);
    expect(screen.getByText(/không thể tải báo cáo kpi: boom/i)).toBeTruthy();

    rerender(<ReportingStaffSection {...props} reportLoading={false} reportError="" />);
    expect(
      screen.getByText(/chưa có dữ liệu tờ khai trong khoảng thời gian đã chọn/i),
    ).toBeTruthy();
  });

  it("renders staff summary mode and forwards control actions", () => {
    const props = buildStaffSectionProps();
    render(<ReportingStaffSection {...props} />);

    expect(screen.getByText(/Công ty Alice/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Chi tiết/i }));
    expect(props.setStaffViewMode).toHaveBeenCalledWith("detail");

    fireEvent.click(screen.getByRole("button", { name: "Số tờ khai" }));
    expect(props.setStaffSortKey).toHaveBeenCalledWith("decls");
  });

  it("renders a single active staff detail card when a staff member is selected", () => {
    render(
      <ReportingStaffSection
        {...buildStaffSectionProps({
          selectedStaff: "alice",
          activeStaff: createStaffEntry("alice", "Alice", "Team 1", 12.5),
        })}
      />,
    );

    expect(screen.getByText(/Nhân viên.*Alice/i)).toBeTruthy();
    expect(screen.getByText(/Tổ đội.*Team 1/i)).toBeTruthy();
  });

  it("keeps staff export visible but disabled with reason when permission is denied", () => {
    render(
      <ReportingStaffSection
        {...buildStaffSectionProps({
          canExport: false,
          selectedStaff: "all",
          staffViewMode: "summary",
        })}
      />,
    );

    const exportButton = screen.getByRole("button", { name: "Xuất Excel" });
    expect(exportButton).toBeDisabled();
    expect(screen.getByText(/không có quyền xuất báo cáo/i)).toBeTruthy();
  });

  it("renders team detail mode for the all-teams scope and forwards paging/sort actions", () => {
    const props = buildTeamSectionProps({
      teamViewMode: "detail",
      detailPageSize: 1,
    });

    render(<ReportingTeamSection {...props} />);

    expect(screen.getByText(/Team Alpha/i)).toBeTruthy();
    expect(screen.getByText(/1.*\/.*2/i)).toBeTruthy();
    expect(screen.getByText(/Tổ đội.*Team Alpha/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Số giấy phép/i }));
    expect(props.setTeamSortKey).toHaveBeenCalledWith("licenses");

    fireEvent.click(screen.getByRole("button", { name: "Sau" }));
    expect(props.setTeamDetailPage).toHaveBeenCalledTimes(1);
  });

  it("renders a single active team detail card when a team is selected", () => {
    render(
      <ReportingTeamSection
        {...buildTeamSectionProps({
          selectedTeam: "team-alpha",
          activeTeam: createTeamEntry("team-alpha", "Team Alpha", 14.5),
        })}
      />,
    );

    expect(screen.getByText(/Tổ đội: Team Alpha/i)).toBeTruthy();
    expect(screen.getByText(/thành viên: an team alpha, bình team alpha/i)).toBeTruthy();
  });

  it("disables team export with error hint when report read model has errors", () => {
    render(
      <ReportingTeamSection
        {...buildTeamSectionProps({
          reportError: "boom",
          summary: { decls: 2 },
          selectedTeam: "all",
          teamViewMode: "summary",
        })}
      />,
    );

    const exportButton = screen.getByRole("button", { name: "Xuất Excel" });
    expect(exportButton).toBeDisabled();
    expect(screen.getByText(/không thể xuất báo cáo khi dữ liệu đang lỗi tải: boom/i)).toBeTruthy();
  });
});
