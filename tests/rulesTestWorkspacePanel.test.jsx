import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import RulesTestWorkspacePanel from "@/components/rules-editor/RulesTestWorkspacePanel.jsx";

function createWorkspace(overrides = {}) {
  return {
    filteredTestList: [
      {
        key: "0-TK001-2025-01-01",
        label: "2025-01-01 | TK001 | 0101234567 | Công ty A | A11",
      },
    ],
    handleSearchSubmit: vi.fn((event) => event.preventDefault()),
    kpiManual: 12.5,
    kpiPicked: 9.5,
    manualAgency: "G&B",
    manualCoLines: 0,
    manualHasCO: true,
    manualItems: 10,
    manualLicenses: "ZB02,ZB03",
    manualType: "A11",
    pickedKey: "0-TK001-2025-01-01",
    pickedRow: {
      so_tk: "TK001",
      loai_hinh: "A11",
      num_items: 3,
      mst: "0101234567",
      cong_ty: "Công ty A",
    },
    setManualAgency: vi.fn(),
    setManualCoLines: vi.fn(),
    setManualHasCO: vi.fn(),
    setManualItems: vi.fn(),
    setManualLicenses: vi.fn(),
    setManualType: vi.fn(),
    setPickedKey: vi.fn(),
    setTestSearch: vi.fn(),
    testList: [{ key: "0-TK001-2025-01-01" }],
    testSearch: "",
    ...overrides,
  };
}

describe("RulesTestWorkspacePanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("render ket qua test nhanh va manual scenario", () => {
    render(
      <RulesTestWorkspacePanel
        workspace={createWorkspace()}
        licenseOptions={[{ value: "ZB02", count: 3 }]}
        agencyOptions={[{ value: "G&B", hint: "HQ" }]}
      />
    );

    expect(screen.getByText("Test nhanh 1 tờ khai đã import")).toBeInTheDocument();
    expect(screen.getByText("Test nhập tay")).toBeInTheDocument();
    expect(screen.getByText(/Hiển thị 1 \/ 1 tờ khai đã lưu/i)).toBeInTheDocument();
    expect(screen.getByText(/Số tờ khai:/i)).toBeInTheDocument();
    expect(screen.getByText("9.5")).toBeInTheDocument();
    expect(screen.getByText("12.5")).toBeInTheDocument();
  });

  it("goi callback khi thao tac tim nhanh va sua manual scenario", () => {
    const workspace = createWorkspace();

    render(
      <RulesTestWorkspacePanel
        workspace={workspace}
        licenseOptions={[{ value: "ZB02", count: 3 }]}
        agencyOptions={[{ value: "G&B", hint: "HQ" }]}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Nhập số tờ khai để tìm"), {
      target: { value: "TK009" },
    });
    expect(workspace.setTestSearch).toHaveBeenCalledWith("TK009");

    fireEvent.click(screen.getByRole("button", { name: "Tìm theo số tờ khai" }));
    expect(workspace.handleSearchSubmit).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByDisplayValue("A11"), {
      target: { value: "b11" },
    });
    expect(workspace.setManualType).toHaveBeenCalledWith("B11");

    fireEvent.change(screen.getByDisplayValue("ZB02,ZB03"), {
      target: { value: "ZB04" },
    });
    expect(workspace.setManualLicenses).toHaveBeenCalledWith("ZB04");

    fireEvent.click(screen.getByRole("checkbox", { name: "Có C/O" }));
    expect(workspace.setManualHasCO).toHaveBeenCalledWith(false);

    fireEvent.change(screen.getByRole("listbox"), {
      target: { value: "" },
    });
    expect(workspace.setPickedKey).toHaveBeenCalledWith("");
  });
});
