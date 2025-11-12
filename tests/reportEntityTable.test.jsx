import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import ReportEntityTable from "@/components/report-viewer/ReportEntityTable.jsx";

describe("ReportEntityTable", () => {
  it("renders visible columns and custom cell content", () => {
    const columns = [
      {
        key: "name",
        label: "Nhân viên",
        renderCell: (row) => <span data-testid={`name-${row.key}`}>{row.name}</span>,
      },
      {
        key: "team",
        label: "Tổ đội",
        visible: false,
        renderCell: (row) => row.team,
      },
      {
        key: "decls",
        label: "Tờ khai",
        align: "right",
        renderCell: (row) => row.decls.toLocaleString("vi-VN"),
      },
    ];

    const rows = [
      { key: "staff-1", name: "Nguyễn Văn A", team: "Team 1", decls: 12 },
    ];

    render(
      <ReportEntityTable
        columns={columns}
        rows={rows}
        emptyMessage="Không có dữ liệu"
      />
    );

    expect(screen.getByText("Nhân viên")).toBeInTheDocument();
    expect(screen.getByTestId("name-staff-1")).toHaveTextContent("Nguyễn Văn A");
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.queryByText("Tổ đội")).toBeNull();
  });

  it("shows the empty message when there are no rows", () => {
    render(
      <ReportEntityTable
        columns={[{ key: "name", label: "Tên" }]}
        rows={[]}
        emptyMessage="Không có nhân viên phù hợp"
      />
    );

    expect(screen.getByText("Không có nhân viên phù hợp")).toBeInTheDocument();
  });

  it("calls pagination and sorting callbacks", () => {
    const handlePageSizeChange = vi.fn();
    const handlePrev = vi.fn();
    const handleNext = vi.fn();
    const handleCustomChange = vi.fn();
    const handleSort = vi.fn();

    const columns = [
      {
        key: "name",
        label: "Nhân viên",
        sortable: true,
        renderCell: (row) => row.name,
      },
    ];

    const rows = [
      { key: "row-1", name: "A" },
      { key: "row-2", name: "B" },
    ];

    render(
      <ReportEntityTable
        columns={columns}
        rows={rows}
        emptyMessage="Không có dữ liệu"
        onSort={handleSort}
        sortState={{ key: "name", direction: "desc" }}
        pagination={{
          totalRows: 2,
          pageSize: 10,
          pageSizeMode: "preset",
          pageSizeOptions: [10, 20],
          onPageSizeChange: handlePageSizeChange,
          customPageSizeValue: "",
          onCustomPageSizeChange: handleCustomChange,
          rangeLabel: "1–2 / 2",
          onPrevPage: handlePrev,
          onNextPage: handleNext,
          isFirstPage: false,
          isLastPage: false,
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /nhân viên/i }));
    expect(handleSort).toHaveBeenCalledWith("name", "asc");

    fireEvent.change(screen.getByDisplayValue("10"), { target: { value: "20" } });
    expect(handlePageSizeChange).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Trước" }));
    expect(handlePrev).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Sau" }));
    expect(handleNext).toHaveBeenCalled();
  });
});
