import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import KpiAdjustmentListPanel from "@/components/kpi-adjustments/panels/KpiAdjustmentListPanel.jsx";

describe("kpi adjustment list panel", () => {
  it("renders filters and forwards filter interactions", async () => {
    const onFilterMonthChange = vi.fn();
    const onFilterStatusChange = vi.fn();
    const onMineToggle = vi.fn();
    const onStaffFilterChange = vi.fn();

    render(
      <KpiAdjustmentListPanel
        formFieldIds={{
          filterMonth: "filter-month",
          filterStatus: "filter-status",
          filterMine: "filter-mine",
          filterStaff: "filter-staff",
        }}
        selectFieldClass="select"
        filterMonth="2026-03"
        onFilterMonthChange={onFilterMonthChange}
        filterStatus="pending"
        onFilterStatusChange={onFilterStatusChange}
        showMineToggle
        showMineOnly={false}
        currentStaffKey="lan"
        onMineToggle={onMineToggle}
        canApprove
        staffFilter="all"
        onStaffFilterChange={onStaffFilterChange}
        staffFilterOptions={[{ value: "lan", label: "Lan - Team 1" }]}
        filteredAdjustments={[]}
        categoryConfig={{}}
        statusLabels={{}}
        formatDecimal={(value) => String(value)}
        formatDateTime={(value) => String(value)}
        onEdit={vi.fn()}
        onViewDetail={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    await userEvent.clear(screen.getByLabelText("Lọc theo tháng"));
    await userEvent.type(screen.getByLabelText("Lọc theo tháng"), "2026-04");
    expect(onFilterMonthChange).toHaveBeenCalled();

    await userEvent.selectOptions(screen.getByLabelText("Trạng thái"), "approved");
    expect(onFilterStatusChange).toHaveBeenCalledWith("approved");

    await userEvent.click(screen.getByRole("switch"));
    expect(onMineToggle).toHaveBeenCalled();

    await userEvent.selectOptions(screen.getByLabelText("Lọc theo nhân viên"), "lan");
    expect(onStaffFilterChange).toHaveBeenCalledWith("lan");

    expect(screen.getByText("Không có điểm KPI bổ sung nào phù hợp với bộ lọc hiện tại.")).toBeInTheDocument();
  });

  it("renders row badges and forwards action callbacks", async () => {
    const onEdit = vi.fn();
    const onViewDetail = vi.fn();
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const onDelete = vi.fn();
    const item = {
      id: "adj-1",
      month: "2026-03",
      category: "support_misc",
      companyName: "Công ty A",
      taxCode: "0101234567",
      staffName: "Lan",
      teamName: "Team 1",
      totalPoints: 1.5,
      status: "pending",
      updatedAt: "2026-03-26T10:00:00.000Z",
      mode: "fixed",
      licenseCode: "ZB03",
      extraQuantity: 2,
      extraUnitPoints: 0.5,
    };

    render(
      <KpiAdjustmentListPanel
        formFieldIds={{
          filterMonth: "filter-month",
          filterStatus: "filter-status",
          filterMine: "filter-mine",
          filterStaff: "filter-staff",
        }}
        selectFieldClass="select"
        filterMonth="all"
        onFilterMonthChange={vi.fn()}
        filterStatus="all"
        onFilterStatusChange={vi.fn()}
        showMineToggle={false}
        showMineOnly={false}
        currentStaffKey=""
        onMineToggle={vi.fn()}
        canApprove
        staffFilter="all"
        onStaffFilterChange={vi.fn()}
        staffFilterOptions={[]}
        filteredAdjustments={[item]}
        categoryConfig={{
          support_misc: {
            label: "Hỗ trợ khác",
            groupLabel: "Nhóm hỗ trợ",
            extraPointConfig: { defaultUnit: 0.2 },
          },
        }}
        statusLabels={{ pending: "Chờ duyệt" }}
        formatDecimal={(value) => Number(value || 0).toFixed(1)}
        formatDateTime={(value) => `fmt:${value}`}
        onEdit={onEdit}
        onViewDetail={onViewDetail}
        onApprove={onApprove}
        onReject={onReject}
        onDelete={onDelete}
      />
    );

    const row = screen.getByText("Hỗ trợ khác").closest("tr");
    const queries = within(row);

    expect(queries.getByText("Chế độ: Cố định")).toBeInTheDocument();
    expect(queries.getByText("GP: ZB03")).toBeInTheDocument();
    expect(queries.getByText("Nhóm hỗ trợ")).toBeInTheDocument();
    expect(queries.getByText("Chờ duyệt")).toBeInTheDocument();
    expect(queries.getByText("fmt:2026-03-26T10:00:00.000Z")).toBeInTheDocument();

    await userEvent.click(queries.getByRole("button", { name: "Sửa" }));
    await userEvent.click(queries.getByRole("button", { name: "Chi tiết" }));
    await userEvent.click(queries.getByRole("button", { name: "Duyệt" }));
    await userEvent.click(queries.getByRole("button", { name: "Từ chối" }));
    await userEvent.click(queries.getByRole("button", { name: "Xóa" }));

    expect(onEdit).toHaveBeenCalledWith(item);
    expect(onViewDetail).toHaveBeenCalledWith(item);
    expect(onApprove).toHaveBeenCalledWith(item);
    expect(onReject).toHaveBeenCalledWith(item);
    expect(onDelete).toHaveBeenCalledWith(item);
  });
});
