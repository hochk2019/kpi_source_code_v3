import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import RulesGeneralInfoPanel from "@/components/rules-editor/RulesGeneralInfoPanel.jsx";

describe("RulesGeneralInfoPanel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("render metadata and forwards tab/default actions", () => {
    const handleSelectTab = vi.fn();
    const handleAddRule = vi.fn();
    const handleSetDefault = vi.fn();
    const handleSetDefaultButton = vi.fn();

    render(
      <RulesGeneralInfoPanel
        collection={{
          activeId: "rule-1",
          sets: [
            { id: "rule-1", name: "Bộ A" },
            { id: "rule-2", name: "Bộ B" },
          ],
        }}
        activeTab="rule-2"
        isReadOnly={false}
        isDefaultRule={false}
        currentVersion={5}
        savedVersion={4}
        rule={{
          id: "rule-2",
          name: "Bộ B",
          description: "Mô tả",
          updatedAt: "2026-03-26T01:00:00.000Z",
        }}
        formatTimestamp={() => "26/03/2026 08:00:00"}
        onSelectTab={handleSelectTab}
        onAddRule={handleAddRule}
        onSetDefault={handleSetDefault}
        onSetDefaultButton={handleSetDefaultButton}
        onRuleChange={vi.fn()}
      />
    );

    expect(screen.getByText(/Phiên bản đang chỉnh:/i)).toBeInTheDocument();
    expect(screen.getByText(/Thông tin chung/i).parentElement?.textContent).toContain(
      "26/03/2026 08:00:00"
    );

    fireEvent.click(screen.getByRole("button", { name: /bộ b/i }));
    fireEvent.click(screen.getByRole("button", { name: "Thêm bộ quy tắc" }));
    fireEvent.change(screen.getByDisplayValue("Bộ A"), { target: { value: "rule-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Đặt bộ đang mở làm mặc định" }));

    expect(handleSelectTab).toHaveBeenCalledWith("rule-2");
    expect(handleAddRule).toHaveBeenCalledTimes(1);
    expect(handleSetDefault).toHaveBeenCalledTimes(1);
    expect(handleSetDefaultButton).toHaveBeenCalledTimes(1);
  });

  it("updates name and description through onRuleChange", () => {
    const handleRuleChange = vi.fn();

    render(
      <RulesGeneralInfoPanel
        collection={{ activeId: "rule-1", sets: [{ id: "rule-1", name: "Bộ A" }] }}
        activeTab="rule-1"
        isReadOnly={false}
        isDefaultRule={true}
        currentVersion={1}
        savedVersion={1}
        rule={{ id: "rule-1", name: "Bộ A", description: "" }}
        formatTimestamp={() => "now"}
        onSelectTab={vi.fn()}
        onAddRule={vi.fn()}
        onSetDefault={vi.fn()}
        onSetDefaultButton={vi.fn()}
        onRuleChange={handleRuleChange}
      />
    );

    const [nameInput, descriptionInput] = screen.getAllByRole("textbox");

    fireEvent.change(nameInput, { target: { value: "Bộ mới" } });
    fireEvent.change(descriptionInput, {
      target: { value: "Ghi chú mới" },
    });

    expect(handleRuleChange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: "Bộ mới" })
    );
    expect(handleRuleChange).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ description: "Ghi chú mới" })
    );
  });
});
