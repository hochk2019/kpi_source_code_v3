import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import RulesHistoryPanel from "@/components/rules-editor/RulesHistoryPanel.jsx";

function createHistoryEntry() {
  return {
    id: "history-1",
    name: "Bộ lịch sử",
    updatedAt: "2026-03-25T10:00:00.000Z",
    applyFrom: "2026-03-01",
    snapshot: {
      id: "rule-default",
      name: "Bộ lịch sử",
      version: 3,
      points: { base: 1.5, licenses: 0.3 },
    },
  };
}

describe("RulesHistoryPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("goi callback thu gon va lam moi", () => {
    const onToggleCollapsed = vi.fn();
    const onRefresh = vi.fn();

    render(
      <RulesHistoryPanel
        collapsed
        onToggleCollapsed={onToggleCollapsed}
        onRefresh={onRefresh}
        onToggleExpanded={vi.fn()}
        onRestoreEntry={vi.fn()}
        formatTimestamp={(value) => value}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Mở rộng" }));
    fireEvent.click(screen.getByRole("button", { name: "Làm mới" }));

    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("render bang lich su va cho phep expand, restore", () => {
    const entry = createHistoryEntry();
    const onToggleExpanded = vi.fn();
    const onRestoreEntry = vi.fn();

    const { rerender } = render(
      <RulesHistoryPanel
        entries={[entry]}
        collapsed={false}
        expandedId={null}
        onToggleCollapsed={vi.fn()}
        onRefresh={vi.fn()}
        onToggleExpanded={onToggleExpanded}
        onRestoreEntry={onRestoreEntry}
        formatTimestamp={() => "25/03/2026 17:00:00"}
      />
    );

    expect(screen.getByText("Bộ lịch sử")).toBeInTheDocument();
    expect(screen.getByText("1.5")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Xem" }));
    expect(onToggleExpanded).toHaveBeenCalledWith("history-1");

    fireEvent.click(screen.getByRole("button", { name: "Khôi phục" }));
    expect(onRestoreEntry).toHaveBeenCalledWith(entry);

    rerender(
      <RulesHistoryPanel
        entries={[entry]}
        collapsed={false}
        expandedId="history-1"
        onToggleCollapsed={vi.fn()}
        onRefresh={vi.fn()}
        onToggleExpanded={onToggleExpanded}
        onRestoreEntry={onRestoreEntry}
        formatTimestamp={() => "25/03/2026 17:00:00"}
      />
    );

    expect(screen.getByText("Chi tiết điểm & cấu hình")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Thu gọn" })[1]);
    expect(onToggleExpanded).toHaveBeenCalledWith(null);
  });
});
