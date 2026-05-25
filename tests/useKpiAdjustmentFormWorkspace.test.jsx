import React, { useState } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  getDeclRows: vi.fn(),
  getMSTMap: vi.fn(),
}));

vi.mock("@/lib/store.js", async () => {
  const actual = await vi.importActual("@/lib/store.js");
  return {
    ...actual,
    getDeclRows: storeMocks.getDeclRows,
    getMSTMap: storeMocks.getMSTMap,
  };
});

import { useKpiAdjustmentFormWorkspace } from "@/components/kpi-adjustments/hooks/useKpiAdjustmentFormWorkspace.js";

function createHookForm(overrides = {}) {
  return {
    category: "support_fixed",
    month: "2026-03",
    staffName: "",
    teamName: "",
    companyName: "",
    taxCode: "",
    quantity: 1,
    unitPoints: 0.05,
    gradeValue: 0,
    extraQuantity: 0,
    extraUnitPoints: 0,
    mode: "",
    licenseCode: "",
    note: "",
    referencesInput: "",
    status: "pending",
    history: [],
    ...overrides,
  };
}

describe("useKpiAdjustmentFormWorkspace", () => {
  beforeEach(() => {
    storeMocks.getDeclRows.mockReset();
    storeMocks.getMSTMap.mockReset();
    storeMocks.getMSTMap.mockReturnValue([]);
  });

  it("filters declarations and appends selected reference with business metadata", () => {
    storeMocks.getDeclRows.mockReturnValue([
      {
        so_tk_full: "1020250001",
        mst: "0312345678",
        cong_ty: "Cong ty A",
        nhanh: "HCM",
        date: "2025-01-03",
      },
      {
        so_tk_full: "2020250002",
        mst: "0310000002",
        cong_ty: "Cong ty B",
        nhanh: "HN",
        date: "2025-01-04",
      },
    ]);

    const { result } = renderHook(() => {
      const [form, setForm] = useState(createHookForm());
      const workspace = useKpiAdjustmentFormWorkspace({
        form,
        setForm,
        settings: {},
        roster: { teams: [] },
        staffOptions: [],
        canOverridePoints: false,
        parseReferences: (text) =>
          text
            .split(/[\n,;]+/)
            .map((item) => item.trim())
            .filter(Boolean),
      });
      return { form, ...workspace };
    });

    expect(result.current.quickDeclarationSuggestions).toHaveLength(2);

    act(() => {
      result.current.setDeclarationSearch("0001");
    });

    expect(result.current.filteredDeclarationResults[0]).toMatchObject({
      soTk: "1020250001",
      mst: "0312345678",
      company: "Cong ty A",
    });

    act(() => {
      result.current.handleReferencePick(result.current.filteredDeclarationResults[0]);
    });

    expect(result.current.form.referencesInput).toBe("1020250001");
    expect(result.current.form.taxCode).toBe("0312345678");
    expect(result.current.form.companyName).toBe("Cong ty A");
  });

  it("derives team filters, license options, and computed totals for the form panel", () => {
    storeMocks.getDeclRows.mockReturnValue([]);

    const { result } = renderHook(() => {
      const [form, setForm] = useState(
        createHookForm({
          category: "tax_refund_customer",
          teamName: "Team 1",
          quantity: "4",
          unitPoints: "0.5",
          extraQuantity: "2",
          extraUnitPoints: "1.25",
        })
      );
      const workspace = useKpiAdjustmentFormWorkspace({
        form,
        setForm,
        settings: {},
        roster: {
          teams: [
            { name: "Team 1", members: [{ name: "Lan" }, { name: "Bình" }] },
            { name: "Team 2", members: [{ name: "Hà" }] },
          ],
        },
        staffOptions: [
          { team: "Team 1", name: "Lan" },
          { team: "Team 1", name: "Bình" },
          { team: "Team 2", name: "Hà" },
        ],
        canOverridePoints: false,
        parseReferences: () => [],
      });
      return workspace;
    });

    expect(result.current.teamOptions).toEqual(["Team 1", "Team 2"]);
    expect(result.current.filteredStaffOptions).toEqual([
      { team: "Team 1", name: "Lan" },
      { team: "Team 1", name: "Bình" },
    ]);
    expect(result.current.computedExtraTotal).toBe(2.5);
    expect(result.current.computedTotal).toBe(4.5);
    expect(result.current.allowManualPointOverride).toBe(false);
    expect(result.current.licenseOptions.some((option) => option.value === "ZB99")).toBe(true);
  });
});
