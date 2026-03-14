import { describe, expect, it, vi } from "vitest";

import { LEGACY_BUSINESS_HOT_PATH_KEYS } from "../../server-v4/src/persistence/businessSnapshotReader.ts";
import { PostgresMstAssignmentAsyncReader } from "../../server-v4/src/modules/mst-assignments/postgresMstAssignmentAsyncReader.ts";

describe("server-v4 postgres MST assignment async reader", () => {
  it("maps relational assignment rows onto the legacy-compatible snapshot shape", async () => {
    const fallbackReader = createFallbackReader([
      { mst: "0999999999", company: "Blob Co", person_import: "Blob User", team: "Blob Team" },
    ]);
    const pool = {
      query: vi.fn(async () => ({
        rows: [
          {
            mst: "0101234567",
            company: " Cong ty A ",
            person_import: " Minh ",
            person_export: " Bao ",
            team: " Blue Team ",
            effective_from: "2026-02-01",
            effective_to: "",
            status: " assigned ",
          },
        ],
      })),
    };
    const reader = new PostgresMstAssignmentAsyncReader(fallbackReader, pool, {
      sourceKind: "dual-write",
    });

    await expect(reader.readMstAssignmentRows()).resolves.toEqual([
      {
        mst: "0101234567",
        company: "Cong ty A",
        person_import: "Minh",
        person_export: "Bao",
        team: "Blue Team",
        effective_from: "2026-02-01",
        effective_to: "",
        status: "assigned",
      },
    ]);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(fallbackReader.readMstAssignmentRows).not.toHaveBeenCalled();
  });

  it("falls back to the SQLite compatibility reader when the relational query fails", async () => {
    const fallbackRows = [
      {
        mst: "0101234567",
        company: "Cong ty A",
        person_import: "Lan",
        person_export: "",
        team: "Blue Team",
        effective_from: "2026-01-01",
        effective_to: "",
        status: "assigned",
      },
    ];
    const fallbackReader = createFallbackReader(fallbackRows);
    const pool = {
      query: vi.fn(async () => {
        throw new Error("connection refused");
      }),
    };
    const reader = new PostgresMstAssignmentAsyncReader(fallbackReader, pool, {
      sourceKind: "dual-write",
    });

    await expect(reader.readMstAssignmentRows()).resolves.toEqual(fallbackRows);
    expect(fallbackReader.readMstAssignmentRows).toHaveBeenCalledTimes(1);
  });
});

function createFallbackReader(rows) {
  return {
    getSourceKind: () => "dual-write",
    getHotPathKeys: () => LEGACY_BUSINESS_HOT_PATH_KEYS,
    getLegacyDbFile: () => ":memory:",
    readMstAssignmentRows: vi.fn(async () => rows),
  };
}
