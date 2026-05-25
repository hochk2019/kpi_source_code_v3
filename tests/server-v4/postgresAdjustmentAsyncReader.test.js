import { describe, expect, it, vi } from "vitest";

import { PostgresAdjustmentAsyncReader } from "../../server-v4/src/modules/kpi-adjustments/postgresAdjustmentAsyncReader.ts";
import { LEGACY_BUSINESS_HOT_PATH_KEYS } from "../../server-v4/src/persistence/businessSnapshotReader.ts";

describe("server-v4 postgres adjustment async reader", () => {
  it("reads canonical kpi_adjustments rows from postgres before falling back to compatibility snapshots", async () => {
    const fallbackReader = createFallbackReader([{ id: "blob-adj", totalPoints: 0 }]);
    const pool = {
      query: vi.fn(async () => ({
        rows: [
          {
            id: "adj-1",
            month: "2026-02",
            category: "license_support",
            mode: "dynamic",
            license_code: "ZB02",
            staff_name: "Lan",
            team_name: "Blue Team",
            tax_code: "0312345678",
            company_name: "Acme Co",
            quantity: "2.5",
            unit_points: "1.25",
            extra_quantity: "1",
            extra_unit_points: "0.5",
            total_points: "3.625",
            references: ["REF-1", " REF-2 "],
            note: "Manual support",
            status: "approved",
            created_at: "2026-02-01T08:00:00.000Z",
            updated_at: new Date("2026-02-01T09:00:00.000Z"),
            approved_at: "2026-02-02T10:00:00.000Z",
            rejected_at: "",
            history_jsonb: [{ action: "created" }],
          },
        ],
      })),
    };
    const reader = new PostgresAdjustmentAsyncReader(fallbackReader, pool, {
      sourceKind: "dual-write",
    });

    await expect(reader.readAdjustmentRows()).resolves.toEqual([
      {
        id: "adj-1",
        month: "2026-02",
        category: "license_support",
        mode: "dynamic",
        licenseCode: "ZB02",
        staffName: "Lan",
        teamName: "Blue Team",
        taxCode: "0312345678",
        companyName: "Acme Co",
        quantity: 2.5,
        unitPoints: 1.25,
        extraQuantity: 1,
        extraUnitPoints: 0.5,
        totalPoints: 3.625,
        references: ["REF-1", "REF-2"],
        note: "Manual support",
        status: "approved",
        createdAt: "2026-02-01T08:00:00.000Z",
        updatedAt: "2026-02-01T09:00:00.000Z",
        approvedAt: "2026-02-02T10:00:00.000Z",
        rejectedAt: "",
        history: [{ action: "created" }],
      },
    ]);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(fallbackReader.readAdjustmentRows).not.toHaveBeenCalled();
  });

  it("falls back to the compatibility reader when canonical adjustments are not materialized yet", async () => {
    const fallbackRows = [{ id: "fallback-adj", status: "approved", totalPoints: 2 }];
    const fallbackReader = createFallbackReader(fallbackRows);
    const pool = {
      query: vi.fn().mockResolvedValueOnce({ rows: [] }),
    };
    const reader = new PostgresAdjustmentAsyncReader(fallbackReader, pool);

    await expect(reader.readAdjustmentRows()).resolves.toEqual(fallbackRows);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(fallbackReader.readAdjustmentRows).toHaveBeenCalledTimes(1);
  });

  it("falls back to the SQLite compatibility reader when the postgres queries fail", async () => {
    const fallbackRows = [{ id: "fallback-adj", status: "approved", totalPoints: 2 }];
    const fallbackReader = createFallbackReader(fallbackRows);
    const pool = {
      query: vi.fn(async () => {
        throw new Error("postgres unavailable");
      }),
    };
    const reader = new PostgresAdjustmentAsyncReader(fallbackReader, pool);

    await expect(reader.readAdjustmentRows()).resolves.toEqual(fallbackRows);
    expect(fallbackReader.readAdjustmentRows).toHaveBeenCalledTimes(1);
  });
});

function createFallbackReader(rows) {
  return {
    getSourceKind: () => "dual-write",
    getHotPathKeys: () => LEGACY_BUSINESS_HOT_PATH_KEYS,
    getLegacyDbFile: () => ":memory:",
    readAdjustmentRows: vi.fn(async () => rows),
  };
}
