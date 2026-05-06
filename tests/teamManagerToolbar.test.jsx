import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TeamManagerToolbar from "@/components/team-manager/TeamManagerToolbar.jsx";

function renderToolbar(overrides = {}) {
  const props = {
    dirty: true,
    isReadOnly: false,
    roster: { teams: [{ id: "team-1" }, { id: "team-2" }] },
    totalMembers: 5,
    onSave: vi.fn(),
    onReloadRoster: vi.fn(),
    onRefreshMST: vi.fn(),
    historyOpen: false,
    onToggleHistory: vi.fn(),
    onExportExcel: vi.fn(),
    ...overrides,
  };

  render(<TeamManagerToolbar {...props} />);
  return props;
}

describe("TeamManagerToolbar", () => {
  it("renders counters and forwards toolbar actions", () => {
    const props = renderToolbar();

    expect(screen.getByText(/Tổng cộng 2 tổ đội — 5 thành viên/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    fireEvent.click(screen.getByRole("button", { name: "Hoàn tác về dữ liệu đã lưu" }));
    fireEvent.click(screen.getByRole("button", { name: "Tải lại dữ liệu MST" }));
    fireEvent.click(screen.getByRole("button", { name: "Lịch sử cập nhật" }));
    fireEvent.click(screen.getByRole("button", { name: "Export Excel" }));

    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onReloadRoster).toHaveBeenCalledTimes(1);
    expect(props.onRefreshMST).toHaveBeenCalledTimes(1);
    expect(props.onToggleHistory).toHaveBeenCalledTimes(1);
    expect(props.onExportExcel).toHaveBeenCalledTimes(1);
  });

  it("shows read-only state messaging", () => {
    renderToolbar({ dirty: false, isReadOnly: true, historyOpen: true });

    expect(screen.getByText(/Chế độ chỉ xem — không thể lưu thay đổi/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ẩn lịch sử" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Lưu thay đổi" }).at(-1)).toBeDisabled();
  });
});
