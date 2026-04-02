import { describe, expect, it } from "vitest";

import {
  computeAdjustmentTotal,
  diffAdjustments,
  normalizeAdjustmentInput,
  normalizeAdjustmentMonth,
  normalizeAdjustmentReferences,
} from "@/lib/kpiAdjustments/entries.js";

function normalizeStr(value) {
  return String(value ?? "").trim();
}

function normalizeMST(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function roundAdjustmentPoint(value, precision = 2) {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function readAdjustmentSettings() {
  return {
    categories: {
      support_misc: {
        defaultMode: "dynamic",
        modeUnits: {
          dynamic: 0.2,
          fixed: 12,
        },
      },
      license_support: {
        licensePoints: {
          ZB03: 2.8,
        },
      },
      tax_refund_customer: {
        extraUnitPoints: 0.5,
      },
    },
    autoApprove: {
      enabled: false,
      note: null,
      updatedAt: null,
      updatedBy: null,
    },
  };
}

describe("kpiAdjustment entry helpers", () => {
  it("normalizes month and dedupes references", () => {
    expect(normalizeAdjustmentMonth("15/03/2026", { normalizeStr })).toBe("2026-03");
    expect(normalizeAdjustmentMonth("202603", { normalizeStr })).toBe("2026-03");
    expect(normalizeAdjustmentReferences([" REF-1 ", "REF-1", "", "REF-2 "], { normalizeStr })).toEqual([
      "REF-1",
      "REF-2",
    ]);
  });

  it("computes totals for quantity, hybrid, and extra-point categories", () => {
    expect(
      computeAdjustmentTotal(
        {
          category: "support_fixed",
          unitPoints: 0.05,
          quantity: 4,
        },
        { normalizeStr, roundAdjustmentPoint },
      ),
    ).toBe(0.2);

    expect(
      computeAdjustmentTotal(
        {
          category: "support_misc",
          unitPoints: 0.2,
          quantity: 5,
          mode: "dynamic",
        },
        { normalizeStr, roundAdjustmentPoint },
      ),
    ).toBe(1);

    expect(
      computeAdjustmentTotal(
        {
          category: "tax_refund_customer",
          unitPoints: 2,
          quantity: 3,
          extraQuantity: 2,
          extraUnitPoints: 0.5,
        },
        { normalizeStr, roundAdjustmentPoint },
      ),
    ).toBe(7);
  });

  it("normalizes payload timestamps and diffs only tracked fields", () => {
    const current = {
      id: "adj-1",
      category: "support_fixed",
      month: "2026-03",
      staffName: "Lan",
      teamName: "Ops",
      quantity: 1,
      unitPoints: 0.05,
      totalPoints: 0.05,
      references: ["REF-1"],
      note: "Cu",
      status: "approved",
      createdAt: "2026-03-01T00:00:00.000Z",
      createdBy: "lead",
      approvedAt: "2026-03-02T00:00:00.000Z",
      approvedBy: "lead",
      history: [],
    };

    const payload = normalizeAdjustmentInput(
      {
        ...current,
        note: "  Moi  ",
        references: ["REF-1", " REF-2 "],
        approvedBy: "  manager  ",
        rejectedAt: "2026-03-04T09:00:00.000Z",
        rejectedBy: "  reviewer  ",
      },
      {
        now: new Date("2026-04-02T10:00:00.000Z"),
        actor: "admin",
        current,
        permissions: { adjustApprove: true },
        normalizeStr,
        normalizeMST,
        roundAdjustmentPoint,
        readAdjustmentSettings,
      },
    );

    expect(payload.approvedAt).toBe("2026-03-02T00:00:00.000Z");
    expect(payload.approvedBy).toBe("manager");
    expect(payload.rejectedAt).toBe("2026-03-04T09:00:00.000Z");
    expect(payload.rejectedBy).toBe("reviewer");

    const changes = diffAdjustments(current, payload);
    expect(changes).toEqual({
      note: { from: "Cu", to: "Moi" },
      references: { from: ["REF-1"], to: ["REF-1", "REF-2"] },
    });
    expect(changes).not.toHaveProperty("approvedAt");
    expect(changes).not.toHaveProperty("rejectedAt");
  });
});
