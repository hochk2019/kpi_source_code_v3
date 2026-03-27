import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TeamManagerHistoryPanel from "@/components/team-manager/TeamManagerHistoryPanel.jsx";

function renderPanel(overrides = {}) {
  const props = {
    historyOpen: true,
    historyTab: "team",
    teamHistory: [
      {
        ts: "2025-03-01T10:15:00Z",
        actor: "admin",
        detail: "Lưu tổ đội",
      },
    ],
    mstHistory: [
      {
        id: "mst-1",
        timestamp: "2025-03-02T08:00:00Z",
        actor: "ops",
        mst: "0312345678",
        field: "person_import",
        from: "",
        to: "Nguyễn Văn A",
      },
    ],
    onHistoryTabChange: vi.fn(),
    onRefresh: vi.fn(),
    ...overrides,
  };

  render(<TeamManagerHistoryPanel {...props} />);
  return props;
}

describe("TeamManagerHistoryPanel", () => {
  it("renders nothing when history is closed", () => {
    renderPanel({ historyOpen: false });

    expect(screen.queryByText("Lịch sử thay đổi")).not.toBeInTheDocument();
  });

  it("renders team history, switches tabs, and refreshes", () => {
    const props = renderPanel();

    expect(screen.getByText("Lưu tổ đội")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "MST" }));
    expect(props.onHistoryTabChange).toHaveBeenCalledWith("mst");

    fireEvent.click(screen.getByRole("button", { name: "Làm mới" }));
    expect(props.onRefresh).toHaveBeenCalledTimes(1);
  });

  it("renders MST history details with field labels and empty placeholders", () => {
    renderPanel({ historyTab: "mst" });

    expect(screen.getByText(/0312345678/)).toBeInTheDocument();
    expect(screen.getByText(/Người phụ trách Nhập/)).toBeInTheDocument();
    expect(screen.getByText("(trống)")).toBeInTheDocument();
    expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
  });
});
