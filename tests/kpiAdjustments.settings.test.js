import { describe, expect, it, vi } from "vitest";

import { KPI_ADJUSTMENT_SETTINGS_KEY } from "@/lib/kpiAdjustments/constants.js";
import {
  createKpiAdjustmentSettingsStore,
  normalizeAutoApproveSettings,
} from "@/lib/kpiAdjustments/settings.js";

function normalizeStr(value) {
  return String(value ?? "").trim();
}

function roundAdjustmentPoint(value, precision = 2) {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function createSettingsHarness(initialState = {}) {
  const storage = new Map(Object.entries(initialState));
  const refreshSharedKeys = vi.fn();
  const pushAuditLog = vi.fn();

  const store = createKpiAdjustmentSettingsStore({
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    refreshSharedKeys,
    pushAuditLog,
    normalizeStr,
    roundAdjustmentPoint,
  });

  return {
    getStoredJson: (key) => storage.get(key),
    pushAuditLog,
    refreshSharedKeys,
    store,
  };
}

describe("kpiAdjustment settings helpers", () => {
  it("normalizes auto approve note and actor fields", () => {
    expect(
      normalizeAutoApproveSettings(
        {
          enabled: true,
          note: "  Duyet nhanh  ",
          updatedAt: "2026-04-02T10:00:00.000Z",
          updatedBy: "  lead  ",
        },
        { normalizeStr },
      ),
    ).toEqual({
      enabled: true,
      note: "Duyet nhanh",
      updatedAt: "2026-04-02T10:00:00.000Z",
      updatedBy: "lead",
    });
  });

  it("returns builtin defaults when storage is empty", () => {
    const { store } = createSettingsHarness();

    const settings = store.getKpiAdjustmentSettings();

    expect(settings.autoApprove).toEqual({
      enabled: false,
      note: null,
      updatedAt: null,
      updatedBy: null,
    });
    expect(settings.categories.tax_refund_customer).toEqual(
      expect.objectContaining({
        extraUnitPoints: 0.5,
      }),
    );
  });

  it("merges settings patches and records audit side effects", () => {
    const { getStoredJson, pushAuditLog, refreshSharedKeys, store } = createSettingsHarness({
      [KPI_ADJUSTMENT_SETTINGS_KEY]: JSON.stringify({
        categories: {
          support_misc: {
            defaultMode: "dynamic",
            modeUnits: { dynamic: 0.2 },
          },
        },
        autoApprove: {
          enabled: false,
          note: null,
          updatedAt: null,
          updatedBy: null,
        },
      }),
    });

    const result = store.saveKpiAdjustmentSettings(
      {
        categories: {
          support_misc: {
            modeUnits: { fixed: "12" },
          },
          tax_refund_customer: {
            extraUnitPoints: "0.75",
          },
        },
        autoApprove: {
          enabled: true,
          note: "  Duyet tu dong  ",
        },
      },
      {
        actor: "admin",
        permissions: { adjustApprove: true },
      },
    );

    expect(result.categories.support_misc).toEqual({
      defaultMode: "dynamic",
      modeUnits: {
        dynamic: 0.2,
        fixed: 12,
      },
    });
    expect(result.categories.tax_refund_customer).toEqual({
      extraUnitPoints: 0.75,
    });
    expect(result.autoApprove).toEqual(
      expect.objectContaining({
        enabled: true,
        note: "Duyet tu dong",
        updatedBy: "admin",
      }),
    );

    expect(JSON.parse(getStoredJson(KPI_ADJUSTMENT_SETTINGS_KEY))).toEqual(
      expect.objectContaining({
        categories: expect.objectContaining({
          support_misc: expect.objectContaining({
            defaultMode: "dynamic",
          }),
        }),
        autoApprove: expect.objectContaining({
          enabled: true,
          note: "Duyet tu dong",
        }),
        updatedBy: "admin",
      }),
    );
    expect(refreshSharedKeys).toHaveBeenCalledWith([KPI_ADJUSTMENT_SETTINGS_KEY]);
    expect(pushAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "kpi.adjustment.defaults",
        meta: expect.objectContaining({
          autoApprove: true,
        }),
      }),
    );
  });
});
