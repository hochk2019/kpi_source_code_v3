import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import RulesApplyActionsPanel from "@/components/rules-editor/RulesApplyActionsPanel.jsx";

describe("RulesApplyActionsPanel", () => {
  beforeEach(() => {
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("updates apply inputs and forwards action callbacks", () => {
    const handleRuleChange = vi.fn();
    const handleApplyNowChange = vi.fn();
    const handleSave = vi.fn();
    const handleReset = vi.fn();
    const handleExportCurrentRule = vi.fn();
    const handleExportAllRules = vi.fn();
    const handleDeleteRule = vi.fn();

    render(
      <RulesApplyActionsPanel
        rule={{ applyFrom: "2026-03-01" }}
        applyNow={false}
        isReadOnly={false}
        canDeleteRule={true}
        onRuleChange={handleRuleChange}
        onApplyNowChange={handleApplyNowChange}
        onSave={handleSave}
        onReset={handleReset}
        onExportCurrentRule={handleExportCurrentRule}
        onImportCurrentRule={vi.fn()}
        onExportAllRules={handleExportAllRules}
        onImportAllRules={vi.fn()}
        onDeleteRule={handleDeleteRule}
      />
    );

    fireEvent.change(screen.getByDisplayValue("2026-03-01"), {
      target: { value: "2026-04-01" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    fireEvent.click(screen.getByRole("button", { name: "Khôi phục bản đã lưu" }));
    fireEvent.click(screen.getByRole("button", { name: "Xuất bộ đang mở" }));
    fireEvent.click(screen.getByRole("button", { name: "Xuất quy tắc (sao lưu)" }));
    fireEvent.click(screen.getByRole("button", { name: "Xóa bộ quy tắc" }));

    expect(handleRuleChange).toHaveBeenCalledWith(expect.objectContaining({ applyFrom: "2026-04-01" }));
    expect(handleApplyNowChange).toHaveBeenCalledWith(true);
    expect(handleSave).toHaveBeenCalledTimes(1);
    expect(handleReset).toHaveBeenCalledTimes(1);
    expect(handleExportCurrentRule).toHaveBeenCalledTimes(1);
    expect(handleExportAllRules).toHaveBeenCalledTimes(1);
    expect(handleDeleteRule).toHaveBeenCalledTimes(1);
  });

  it("uses file input refs for import actions and respects disabled states", () => {
    const handleImportCurrentRule = vi.fn();
    const handleImportAllRules = vi.fn();

    const { rerender } = render(
      <RulesApplyActionsPanel
        rule={{ applyFrom: "" }}
        applyNow={false}
        isReadOnly={false}
        canDeleteRule={false}
        onRuleChange={vi.fn()}
        onApplyNowChange={vi.fn()}
        onSave={vi.fn()}
        onReset={vi.fn()}
        onExportCurrentRule={vi.fn()}
        onImportCurrentRule={handleImportCurrentRule}
        onExportAllRules={vi.fn()}
        onImportAllRules={handleImportAllRules}
        onDeleteRule={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Nhập vào bộ đang mở" }));
    fireEvent.click(screen.getByRole("button", { name: "Khôi phục toàn bộ quy tắc" }));

    expect(HTMLInputElement.prototype.click).toHaveBeenCalledTimes(2);

    const [currentRuleInput, collectionInput] = screen.getAllByTestId(/import-/);
    fireEvent.change(currentRuleInput, { target: { files: [{ name: "rule.json" }] } });
    fireEvent.change(collectionInput, { target: { files: [{ name: "rules.json" }] } });

    expect(handleImportCurrentRule).toHaveBeenCalledTimes(1);
    expect(handleImportAllRules).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Xóa bộ quy tắc" })).toBeDisabled();

    rerender(
      <RulesApplyActionsPanel
        rule={{ applyFrom: "" }}
        applyNow={false}
        isReadOnly={true}
        canDeleteRule={true}
        onRuleChange={vi.fn()}
        onApplyNowChange={vi.fn()}
        onSave={vi.fn()}
        onReset={vi.fn()}
        onExportCurrentRule={vi.fn()}
        onImportCurrentRule={handleImportCurrentRule}
        onExportAllRules={vi.fn()}
        onImportAllRules={handleImportAllRules}
        onDeleteRule={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Nhập vào bộ đang mở" })).toBeDisabled();
  });
});
