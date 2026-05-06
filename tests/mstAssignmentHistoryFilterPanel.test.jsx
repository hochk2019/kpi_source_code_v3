import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import MstAssignmentHistoryFilterPanel from "@/components/mst-assignment/filters/MstAssignmentHistoryFilterPanel.jsx";

afterEach(() => {
  cleanup();
});

describe("mst assignment history filter panel", () => {
  it("renders summary, updates filters, and wires toolbar actions", async () => {
    const onResetHistoryFilter = vi.fn();
    const onSaveActionFavorite = vi.fn();
    const onHistoryFilterChange = vi.fn();
    const onApplyActionFavorite = vi.fn();
    const onRemoveQuickFavorite = vi.fn();

    render(
      <MstAssignmentHistoryFilterPanel
        filteredHistoryCount={4}
        totalHistoryCount={9}
        isHistoryFilterActive
        historyFilter={{ from: "2024-01-01", to: "2024-01-31", type: "update" }}
        quickFavorites={{
          action: [{ normalized: "update", value: "update" }],
        }}
        onResetHistoryFilter={onResetHistoryFilter}
        onSaveActionFavorite={onSaveActionFavorite}
        onHistoryFilterChange={onHistoryFilterChange}
        onApplyActionFavorite={onApplyActionFavorite}
        onRemoveQuickFavorite={onRemoveQuickFavorite}
      />
    );

    expect(screen.getByText(/Bộ lọc lịch sử thay đổi/i)).toBeInTheDocument();
    expect(screen.getByText(/Hiển thị 4 \/ 9 bản ghi lịch sử\./)).toBeInTheDocument();
    expect(screen.getByText(/\* Danh sách MST cũng đang lọc theo điều kiện lịch sử này\./)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Từ ngày"), { target: { value: "2024-02-01" } });
    expect(onHistoryFilterChange).toHaveBeenCalledWith({ from: "2024-02-01" });

    fireEvent.change(screen.getByLabelText("Đến ngày"), { target: { value: "2024-02-29" } });
    expect(onHistoryFilterChange).toHaveBeenCalledWith({ to: "2024-02-29" });

    fireEvent.change(screen.getByLabelText("Thao tác / Chuyển trạng thái"), {
      target: { value: "status:assigned" },
    });
    expect(onHistoryFilterChange).toHaveBeenCalledWith({ type: "status:assigned" });

    expect(
      screen.getByRole("option", { name: "Chuyển sang Đã gán nhân viên" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Chuyển sang Chưa gán nhân viên" })
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Xóa lọc" }));
    expect(onResetHistoryFilter).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Lưu thao tác/Trạng thái" }));
    expect(onSaveActionFavorite).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "update" }));
    expect(onApplyActionFavorite).toHaveBeenCalledWith("update");

    await userEvent.click(screen.getByRole("button", { name: "Xóa update" }));
    expect(onRemoveQuickFavorite).toHaveBeenCalledWith("action", "update");
  });

  it("hides the active-state note and saved favorites when no history filter is active", () => {
    render(
      <MstAssignmentHistoryFilterPanel
        filteredHistoryCount={0}
        totalHistoryCount={0}
        isHistoryFilterActive={false}
        historyFilter={{ from: "", to: "", type: "all" }}
        quickFavorites={{ action: [] }}
        onResetHistoryFilter={vi.fn()}
        onSaveActionFavorite={vi.fn()}
        onHistoryFilterChange={vi.fn()}
        onApplyActionFavorite={vi.fn()}
        onRemoveQuickFavorite={vi.fn()}
      />
    );

    expect(
      screen.queryByText(/\* Danh sách MST cũng đang lọc theo điều kiện lịch sử này\./)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Bộ lọc thao tác\/trạng thái đã lưu/i)).not.toBeInTheDocument();
  });
});
