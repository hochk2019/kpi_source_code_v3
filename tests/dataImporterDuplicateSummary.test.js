import { describe, expect, it } from "vitest";

import { buildDuplicateSummary } from "@/components/dataImporter/dataImporterDuplicateSummary.js";

describe("dataImporterDuplicateSummary", () => {
  it("gom nhom duplicate 11 so dau, chon keeper va tao metadata cho dialog review", () => {
    const rows = [
      {
        id: "older-reviewed",
        so_tk_full: "1020304050601",
        nhanh: "HCM",
        updated_at: "2025-03-01T10:00:00.000Z",
        reviewed: true,
        nhan_vien: "An",
        team: "OPS",
        kpi: 12,
      },
      {
        id: "newest",
        so_tk_full: "1020304050602",
        nhanh: "HCM",
        updated_at: "2025-03-05T08:00:00.000Z",
        nhan_vien: "",
        team: "",
        kpi: 9,
      },
      {
        id: "third",
        so_tk_full: "1020304050603",
        nhanh: "HCM",
        updated_at: "2025-03-02T09:00:00.000Z",
        nhan_vien: "Binh",
        team: "OPS",
        kpi: 5,
      },
      {
        id: "unique",
        so_tk_full: "9988776655443",
        nhanh: "HN",
        updated_at: "2025-03-04T08:00:00.000Z",
      },
    ];

    const summary = buildDuplicateSummary(rows, {
      keyOfRow: (row) => row.id,
    });

    expect(summary.groups).toBe(1);
    expect(summary.totalRows).toBe(3);
    expect(summary.hasDuplicates).toBe(true);
    expect(summary.counts.get("10203040506")).toBe(3);
    expect(summary.removalKeys).toEqual(["third", "older-reviewed"]);
    expect(Array.from(summary.duplicatesSet)).toEqual(["third", "older-reviewed"]);
    expect(Array.from(summary.keptKeys)).toEqual(["newest"]);

    expect(summary.details).toHaveLength(1);
    expect(summary.details[0]).toMatchObject({
      prefix: "10203040506 - HCM",
      rawPrefix: "10203040506",
      total: 3,
      keeperKey: "newest",
      keeperLabel: "1020304050602 (HCM)",
    });
    expect(summary.details[0].items.map((item) => item.key)).toEqual([
      "newest",
      "third",
      "older-reviewed",
    ]);
    expect(summary.details[0].items[0]).toMatchObject({
      sourceLabel: "Không xác định",
      status: "Thiếu nhân viên & tổ đội",
      timestampLabel: "Cập nhật gần nhất",
    });
  });

  it("tra ve summary rong khi khong co duplicate hop le", () => {
    const summary = buildDuplicateSummary(
      [
        { id: "a", so_tk_full: "123", nhanh: "HCM" },
        { id: "b", so_tk_full: "456", nhanh: "HN" },
      ],
      { keyOfRow: (row) => row.id },
    );

    expect(summary.groups).toBe(0);
    expect(summary.totalRows).toBe(0);
    expect(summary.hasDuplicates).toBe(false);
    expect(summary.removalKeys).toEqual([]);
    expect(Array.from(summary.duplicatesSet)).toEqual([]);
    expect(Array.from(summary.keptKeys)).toEqual([]);
    expect(summary.details).toEqual([]);
  });
});
