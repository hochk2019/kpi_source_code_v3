import { describe, expect, it, vi } from "vitest";

import { PostgresKpiRulesAsyncReader } from "../../server-v4/src/modules/kpi-rules/postgresKpiRulesAsyncReader.ts";
import { LEGACY_BUSINESS_HOT_PATH_KEYS } from "../../server-v4/src/persistence/businessSnapshotReader.ts";

describe("server-v4 postgres KPI rules async reader", () => {
  it("reads KPI rule sets from postgres before falling back to SQLite compatibility", async () => {
    const fallbackReader = createFallbackReader({
      version: 2,
      activeId: "blob-kpi",
      sets: [{ id: "blob-kpi", name: "Blob KPI", groups: {} }],
    });
    const pool = {
      query: vi.fn(async () => ({
        rows: [
          {
            id: "rule-1",
            name: "Rule 1",
            rules_jsonb: JSON.stringify({
              description: "First rule",
              groups: {
                group1: {
                  key: "group1",
                  title: "Nhom 1",
                  codes: ["A11"],
                },
              },
            }),
            is_active: false,
            created_at: "2026-03-01T00:00:00.000Z",
            activated_at: null,
          },
          {
            id: "rule-2",
            name: "Rule 2",
            rules_jsonb: {
              description: "Second rule",
              groups: {
                group2: {
                  key: "group2",
                  title: "Nhom 2",
                  codes: ["B11"],
                },
              },
            },
            is_active: true,
            created_at: "2026-03-05T00:00:00.000Z",
            activated_at: "2026-03-06T00:00:00.000Z",
          },
        ],
      })),
    };
    const reader = new PostgresKpiRulesAsyncReader(fallbackReader, pool, {
      sourceKind: "dual-write",
    });

    await expect(reader.readRuleCollection()).resolves.toEqual({
      version: 2,
      activeId: "rule-2",
      sets: [
        expect.objectContaining({
          id: "rule-1",
          name: "Rule 1",
          groups: expect.objectContaining({
            group1: expect.objectContaining({
              codes: ["A11"],
            }),
          }),
        }),
        expect.objectContaining({
          id: "rule-2",
          name: "Rule 2",
          applyFrom: "2026-03-06T00:00:00.000Z",
          groups: expect.objectContaining({
            group2: expect.objectContaining({
              codes: ["B11"],
            }),
          }),
        }),
      ],
    });
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(fallbackReader.readRuleCollection).not.toHaveBeenCalled();
  });

  it("falls back to the SQLite compatibility reader when the postgres query fails", async () => {
    const fallbackCollection = {
      version: 2,
      activeId: "fallback-kpi",
      sets: [{ id: "fallback-kpi", name: "Fallback KPI", groups: {} }],
    };
    const fallbackReader = createFallbackReader(fallbackCollection);
    const pool = {
      query: vi.fn(async () => {
        throw new Error("postgres unavailable");
      }),
    };
    const reader = new PostgresKpiRulesAsyncReader(fallbackReader, pool);

    await expect(reader.readRuleCollection()).resolves.toEqual(fallbackCollection);
    expect(fallbackReader.readRuleCollection).toHaveBeenCalledTimes(1);
  });
});

function createFallbackReader(collection) {
  return {
    getSourceKind: () => "dual-write",
    getHotPathKeys: () => LEGACY_BUSINESS_HOT_PATH_KEYS,
    getLegacyDbFile: () => ":memory:",
    readRuleCollection: vi.fn(async () => collection),
  };
}
