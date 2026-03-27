import React from "react";

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import HQAgencyTable from "@/components/hq-agency-manager/HQAgencyTable.jsx";

function createRow(overrides = {}) {
  return {
    mst: "0101234567",
    company: "Alpha Trading",
    agent: "AIR, SEA",
    agents: ["AIR", "SEA"],
    _originalMst: "0101234567",
    _isNew: false,
    ...overrides,
  };
}

function renderTable(overrides = {}) {
  const row = overrides.row ?? createRow();
  const props = {
    agencyOptions: ["AIR", "SEA"],
    baselineMap: new Map([
      [
        "0101234567",
        {
          ...row,
          agent: "AIR",
          agents: ["AIR"],
        },
      ],
    ]),
    canEdit: true,
    getColumnStyle: () => ({}),
    historyMap: new Map(),
    isReadOnly: false,
    onChangeField: vi.fn(),
    onDeleteRow: vi.fn(),
    onQuickAddAgent: vi.fn(),
    onSaveRow: vi.fn(),
    onToggleHistory: vi.fn(),
    openHistory: [],
    pageRows: [row],
    rows: [row],
    safePage: 1,
    renderResizeHandle: () => null,
    ...overrides,
  };

  return {
    ...render(<HQAgencyTable {...props} />),
    props,
    row,
  };
}

describe("HQAgencyTable", () => {
  afterEach(() => {
    cleanup();
  });

  it("delegates edit actions through the provided callbacks", async () => {
    const user = userEvent.setup();
    const { props } = renderTable();

    const companyInput = screen.getByDisplayValue("Alpha Trading");
    fireEvent.change(companyInput, { target: { value: "Beta Logistics" } });

    expect(props.onChangeField).toHaveBeenLastCalledWith(0, "company", "Beta Logistics");

    await user.click(screen.getByRole("button", { name: "Cập nhật" }));
    expect(props.onSaveRow).toHaveBeenCalledWith(0);

    await user.click(screen.getByRole("button", { name: "Xóa" }));
    expect(props.onDeleteRow).toHaveBeenCalledWith(0);
  });

  it("renders history details and read-only values when configured", () => {
    const row = createRow({ agent: "AIR" });

    renderTable({
      baselineMap: new Map([["0101234567", row]]),
      canEdit: false,
      historyMap: new Map([
        [
          "0101234567",
          [
            {
              id: "hist-1",
              field: "agent",
              type: "update",
              from: "SEA",
              to: "AIR",
              actor: "admin",
              timestamp: "2026-03-27T10:15:00.000Z",
            },
          ],
        ],
      ]),
      isReadOnly: true,
      openHistory: ["0101234567"],
      row,
    });

    expect(screen.queryByDisplayValue("Alpha Trading")).not.toBeInTheDocument();
    expect(screen.getByText("Alpha Trading")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lịch sử (1)" })).toBeEnabled();
    expect(screen.getByText(/Từ:/i)).toBeInTheDocument();
    expect(screen.getByText(/Bởi: admin/i)).toBeInTheDocument();
  });
});
