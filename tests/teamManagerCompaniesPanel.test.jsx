import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TeamManagerCompaniesPanel from "@/components/team-manager/TeamManagerCompaniesPanel.jsx";

function renderPanel(overrides = {}) {
  const props = {
    activeMember: null,
    selectedTeam: { id: "team-1", name: "Team Alpha" },
    displayCompanies: [
      {
        mst: "0312345678",
        company: "Cong ty A",
        person_import: "Nguyen Van A",
        person_export: "Tran Thi B",
        effective_from: "2025-01-01",
      },
      {
        mst: "0312345679",
        company: "Cong ty B",
        person_import: "Nguyen Van C",
        person_export: "Tran Thi D",
        effective_from: "2025-02-01",
      },
    ],
    pagedCompanies: [
      {
        mst: "0312345678",
        company: "Cong ty A",
        person_import: "Nguyen Van A",
        person_export: "Tran Thi B",
        effective_from: "2025-01-01",
      },
    ],
    currentCompanyPage: 1,
    totalCompanyPages: 2,
    showPagination: true,
    onShowAllTeamCompanies: vi.fn(),
    onPreviousPage: vi.fn(),
    onNextPage: vi.fn(),
    ...overrides,
  };

  render(<TeamManagerCompaniesPanel {...props} />);
  return props;
}

describe("TeamManagerCompaniesPanel", () => {
  it("renders team company table and pagination callbacks", () => {
    const props = renderPanel();

    expect(screen.getByText(/Doanh nghiệp theo Team Alpha/i)).toBeInTheDocument();
    expect(screen.getByText("Cong ty A")).toBeInTheDocument();
    expect(screen.getByText("Nguyen Van A")).toBeInTheDocument();
    expect(screen.getByText("Trang 1/2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tiếp theo →" }));
    expect(props.onNextPage).toHaveBeenCalledTimes(1);
  });

  it("renders member-specific view and empty state", () => {
    const props = renderPanel({
      activeMember: { id: "member-1", name: "Nguyen Van A" },
      displayCompanies: [],
      pagedCompanies: [],
      showPagination: false,
    });

    expect(screen.getByText(/Doanh nghiệp phụ trách của Nguyen Van A/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Thành viên này chưa được gán doanh nghiệp nào trong bảng MST\./i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Xem toàn bộ team" }));
    expect(props.onShowAllTeamCompanies).toHaveBeenCalledTimes(1);
  });
});
