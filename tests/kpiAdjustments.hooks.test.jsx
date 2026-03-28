import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearStorageCache } from "@/lib/storageClient.js";

const storeMocks = vi.hoisted(() => ({
  getKpiAdjustments: vi.fn(),
  getKpiAdjustmentSettings: vi.fn(),
  saveKpiAdjustment: vi.fn(),
  saveKpiAdjustmentSettings: vi.fn(),
}));

vi.mock("@/lib/store.js", async () => {
  const actual = await vi.importActual("@/lib/store.js");
  return {
    ...actual,
    getKpiAdjustments: storeMocks.getKpiAdjustments,
    getKpiAdjustmentSettings: storeMocks.getKpiAdjustmentSettings,
    saveKpiAdjustment: storeMocks.saveKpiAdjustment,
    saveKpiAdjustmentSettings: storeMocks.saveKpiAdjustmentSettings,
  };
});

import { useKpiAdjustmentFilters } from "@/components/kpi-adjustments/hooks/useKpiAdjustmentFilters.js";
import { useKpiAdjustmentForm } from "@/components/kpi-adjustments/hooks/useKpiAdjustmentForm.js";

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

describe("kpi adjustment hooks", () => {
  beforeEach(() => {
    clearStorageCache();
    storeMocks.getKpiAdjustments.mockReset();
    storeMocks.getKpiAdjustmentSettings.mockReset();
    storeMocks.saveKpiAdjustment.mockReset();
    storeMocks.saveKpiAdjustmentSettings.mockReset();
  });

  it("filters to the current staff by default for non-approvers", () => {
    const currentMonth = getCurrentMonth();
    const adjustments = [
      { id: "a", month: currentMonth, staffName: "Lan", status: "pending", updatedAt: "2025-01-02" },
      { id: "b", month: currentMonth, staffName: "Bình", status: "approved", updatedAt: "2025-01-01" },
    ];

    const { result } = renderHook(() =>
      useKpiAdjustmentFilters({
        adjustments,
        staffOptions: [{ name: "Lan" }, { name: "Bình" }],
        currentStaffKey: "lan",
        canApprove: false,
        isAuthenticated: true,
      })
    );

    expect(result.current.showMineOnly).toBe(true);
    expect(result.current.filteredAdjustments.map((item) => item.id)).toEqual(["a"]);

    act(() => {
      result.current.handleMineToggle(false);
    });

    expect(result.current.showMineOnly).toBe(false);
    expect(result.current.filteredAdjustments.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("persists filter preferences per user scope and restores them on remount", () => {
    const currentMonth = getCurrentMonth();
    const adjustments = [
      { id: "a", month: currentMonth, staffName: "Lan", status: "pending", updatedAt: "2025-01-02" },
      { id: "b", month: currentMonth, staffName: "Bình", status: "approved", updatedAt: "2025-01-01" },
    ];
    const baseProps = {
      adjustments,
      staffOptions: [{ name: "Lan" }, { name: "Bình" }],
      currentStaffKey: "lan",
      canApprove: false,
      isAuthenticated: true,
    };

    const { result, unmount } = renderHook(() => useKpiAdjustmentFilters(baseProps));

    act(() => {
      result.current.handleMineToggle(false);
      result.current.setFilterStatus("approved");
      result.current.setFilterMonth("all");
    });

    expect(result.current.showMineOnly).toBe(false);
    expect(result.current.filterStatus).toBe("approved");
    expect(result.current.filterMonth).toBe("all");

    unmount();

    const restored = renderHook(() => useKpiAdjustmentFilters(baseProps));
    expect(restored.result.current.showMineOnly).toBe(false);
    expect(restored.result.current.filterStatus).toBe("approved");
    expect(restored.result.current.filterMonth).toBe("all");

    const otherUser = renderHook(() =>
      useKpiAdjustmentFilters({
        ...baseProps,
        currentStaffKey: "binh",
      })
    );
    expect(otherUser.result.current.showMineOnly).toBe(true);
    expect(otherUser.result.current.filterStatus).toBe("all");
    expect(otherUser.result.current.filterMonth).toBe(currentMonth);
  });

  it("initializes form defaults and submits a support adjustment payload", () => {
    const currentMonth = getCurrentMonth();
    const setAdjustments = vi.fn();
    const setSettings = vi.fn();

    storeMocks.getKpiAdjustments.mockReturnValue([{ id: "saved-1" }]);

    const { result } = renderHook(() =>
      useKpiAdjustmentForm({
        currentUser: {
          username: "staff",
          permissions: { adjustSubmit: true },
        },
        settings: {},
        setSettings,
        filterMonth: currentMonth,
        staffDefaults: { staffName: "Bình", teamName: "Team 1" },
        canApprove: false,
        canSubmit: true,
        parseReferences: (text) =>
          text
            .split(/[\n,;]+/)
            .map((item) => item.trim())
            .filter(Boolean),
        setAdjustments,
      })
    );

    expect(result.current.form.staffName).toBe("Bình");
    expect(result.current.form.teamName).toBe("Team 1");

    act(() => {
      result.current.handleCategoryChange("support_fixed");
    });

    expect(result.current.form.category).toBe("support_fixed");
    expect(result.current.form.unitPoints).toBe(0.05);

    act(() => {
      result.current.setForm((prev) => ({
        ...prev,
        month: currentMonth,
        staffName: "Bình",
        teamName: "Team 1",
        quantity: 3,
        note: "Ho tro thong quan",
        referencesInput: "TK001",
      }));
    });

    act(() => {
      result.current.handleSubmit({ preventDefault: vi.fn() });
    });

    expect(storeMocks.saveKpiAdjustment).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "support_fixed",
        month: currentMonth,
        staffName: "Bình",
        teamName: "Team 1",
        quantity: 3,
        unitPoints: 0.05,
        references: ["TK001"],
        status: "pending",
      }),
      expect.objectContaining({
        actor: "staff",
        permissions: { adjustSubmit: true },
      })
    );
    expect(setAdjustments).toHaveBeenCalledWith([{ id: "saved-1" }]);
    expect(result.current.form.staffName).toBe("Bình");
    expect(result.current.form.teamName).toBe("Team 1");
    expect(result.current.form.referencesInput).toBe("");
  });

  it("opens settings draft from current settings and resets back to config defaults", () => {
    const currentMonth = getCurrentMonth();

    const { result } = renderHook(() =>
      useKpiAdjustmentForm({
        currentUser: {
          username: "manager",
          permissions: { adjustApprove: true, adjustSubmit: true },
        },
        settings: {
          categories: {
            support_misc: {
              defaultMode: "fixed",
              modeUnits: { fixed: 12, dynamic: 0.2 },
            },
            license_support: {
              licensePoints: { ZB03: 2.8 },
            },
            tax_refund_customer: {
              extraUnitPoints: 1,
            },
          },
        },
        setSettings: vi.fn(),
        filterMonth: currentMonth,
        staffDefaults: { staffName: "Lan", teamName: "Team 1" },
        canApprove: true,
        canSubmit: true,
        parseReferences: () => [],
        setAdjustments: vi.fn(),
      })
    );

    act(() => {
      result.current.openSettingsDialog();
    });

    expect(result.current.settingsOpen).toBe(true);
    expect(result.current.settingsDraft.support_misc.modeUnits.fixed).toBe("12");
    expect(result.current.settingsDraft.license_support.licensePoints.ZB03).toBe("2.8");
    expect(result.current.settingsDraft.tax_refund_customer.extraUnitPoints).toBe(1);

    act(() => {
      result.current.handleSettingsReset();
    });

    expect(result.current.settingsDraft.support_misc.modeUnits.fixed).toBe("10");
    expect(result.current.settingsDraft.license_support.licensePoints.ZB03).toBe("1.5");
    expect(result.current.settingsDraft.tax_refund_customer.extraUnitPoints).toBe(0.5);
  });
});
