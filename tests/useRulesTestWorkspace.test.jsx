import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import useRulesTestWorkspace from "@/components/rules-editor/hooks/useRulesTestWorkspace.js";
import { DEFAULT_RULES } from "@/lib/rules.js";

function UseRulesTestWorkspaceHarness() {
  const state = useRulesTestWorkspace({
    data: [
      {
        so_tk: "TK001",
        date: "2025-01-01",
        mst: "0101234567",
        cong_ty: "Công ty A",
        loai_hinh: "A11",
        num_items: 3,
        licenseCodes: [],
      },
      {
        so_tk: "TK002",
        date: "2025-01-02",
        mst: "0107654321",
        cong_ty: "Công ty B",
        loai_hinh: "B11",
        num_items: 2,
        licenseCodes: ["ZB02"],
      },
    ],
    rule: DEFAULT_RULES,
  });

  return (
    <>
      <form onSubmit={state.handleSearchSubmit}>
        <input
          aria-label="search-declaration"
          value={state.testSearch}
          onChange={(event) => state.setTestSearch(event.target.value)}
        />
        <button type="submit">submit-search</button>
      </form>
      <input
        aria-label="manual-type"
        value={state.manualType}
        onChange={(event) => state.setManualType(event.target.value.toUpperCase())}
      />
      <input
        aria-label="manual-items"
        value={state.manualItems}
        onChange={(event) => state.setManualItems(Number(event.target.value))}
      />
      <input
        aria-label="manual-licenses"
        value={state.manualLicenses}
        onChange={(event) => state.setManualLicenses(event.target.value)}
      />
      <input
        aria-label="manual-hasco"
        type="checkbox"
        checked={state.manualHasCO}
        onChange={(event) => state.setManualHasCO(event.target.checked)}
      />
      <pre data-testid="workspace-state">
        {JSON.stringify({
          filteredCount: state.filteredTestList.length,
          pickedRow: state.pickedRow?.so_tk || null,
          kpiPicked: state.kpiPicked,
          manualRow: state.manualRow,
          kpiManual: state.kpiManual,
        })}
      </pre>
    </>
  );
}

describe("useRulesTestWorkspace", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("loc va chon to khai theo so tim nhanh", () => {
    render(<UseRulesTestWorkspaceHarness />);

    fireEvent.change(screen.getByLabelText("search-declaration"), {
      target: { value: "TK002" },
    });
    fireEvent.click(screen.getByRole("button", { name: "submit-search" }));

    expect(screen.getByTestId("workspace-state").textContent).toContain('"filteredCount":1');
    expect(screen.getByTestId("workspace-state").textContent).toContain('"pickedRow":"TK002"');
  });

  it("cap nhat manual scenario va tinh lai KPI", () => {
    render(<UseRulesTestWorkspaceHarness />);

    const before = JSON.parse(screen.getByTestId("workspace-state").textContent);

    fireEvent.change(screen.getByLabelText("manual-type"), {
      target: { value: "b11" },
    });
    fireEvent.change(screen.getByLabelText("manual-items"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("manual-licenses"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByLabelText("manual-hasco"));

    const after = JSON.parse(screen.getByTestId("workspace-state").textContent);

    expect(after.manualRow.loaiHinh).toBe("B11");
    expect(after.manualRow.num_items).toBe(2);
    expect(after.manualRow.licenseCodes).toEqual([]);
    expect(after.manualRow.has_co).toBe(false);
    expect(after.kpiManual).not.toBe(before.kpiManual);
  });
});
