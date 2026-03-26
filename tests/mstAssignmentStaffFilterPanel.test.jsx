import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import MstAssignmentStaffFilterPanel from "@/components/mst-assignment/filters/MstAssignmentStaffFilterPanel.jsx";

afterEach(() => {
  cleanup();
});

describe("mst assignment staff filter panel", () => {
  it("renders the saved quick filters and wires actions to the provided callbacks", async () => {
    const onClearStaffFilter = vi.fn();
    const onSaveStaffFavorite = vi.fn();
    const onStaffFilterSelect = vi.fn();
    const onApplyStaffFavorite = vi.fn();
    const onRemoveQuickFavorite = vi.fn();

    render(
      <MstAssignmentStaffFilterPanel
        quickFavorites={{
          staff: [
            { normalized: "nguyen van a", value: "Nguyễn Văn A" },
            { normalized: "tran thi b", value: "Trần Thị B" },
          ],
        }}
        staffFilter="Nguyễn Văn A"
        rosterTeams={[]}
        onClearStaffFilter={onClearStaffFilter}
        onSaveStaffFavorite={onSaveStaffFavorite}
        onStaffFilterSelect={onStaffFilterSelect}
        onApplyStaffFavorite={onApplyStaffFavorite}
        onRemoveQuickFavorite={onRemoveQuickFavorite}
      />
    );

    expect(screen.getByText("Bộ lọc nhân viên phụ trách")).toBeInTheDocument();
    expect(screen.getByText("2 bộ lọc nhanh")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu bộ lọc nhân viên" })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: "Xóa lọc" }));
    expect(onClearStaffFilter).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Lưu bộ lọc nhân viên" }));
    expect(onSaveStaffFavorite).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Nguyễn Văn A" }));
    expect(onApplyStaffFavorite).toHaveBeenCalledWith("Nguyễn Văn A");

    await userEvent.click(screen.getByRole("button", { name: "Xóa Nguyễn Văn A" }));
    expect(onRemoveQuickFavorite).toHaveBeenCalledWith("staff", "Nguyễn Văn A");
  });

  it("disables saving when the active staff filter is empty", () => {
    render(
      <MstAssignmentStaffFilterPanel
        quickFavorites={{ staff: [] }}
        staffFilter="   "
        rosterTeams={[]}
        onClearStaffFilter={vi.fn()}
        onSaveStaffFavorite={vi.fn()}
        onStaffFilterSelect={vi.fn()}
        onApplyStaffFavorite={vi.fn()}
        onRemoveQuickFavorite={vi.fn()}
      />
    );

    expect(screen.queryByText(/bộ lọc nhanh/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu bộ lọc nhân viên" })).toBeDisabled();
  });
});
