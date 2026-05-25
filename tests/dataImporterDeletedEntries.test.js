import { describe, expect, it } from "vitest";

import {
  buildDeletedEntries,
  buildDeletedRangeLabel,
} from "@/components/dataImporter/dataImporterDeletedEntries.js";

describe("dataImporterDeletedEntries", () => {
  it("buildDeletedEntries merges soft and hard deleted rows with stable formatting", () => {
    const formatDateTime = (date) => `TS:${date.toISOString()}`;
    const formatDisplayDate = (value) => `DATE:${value}`;
    const keyOfRow = (row) => row.uuid || row.so_tk_full || row.id || "missing";

    const entries = buildDeletedEntries({
      softDeletedRows: [
        {
          uuid: "soft-row",
          so_tk_full: "TK-SOFT-1",
          nhanh: "HN",
          mst: "0100000001",
          cong_ty: "Cong ty xoa mem",
          date: "2026-03-02",
          deleted_at: "2026-03-03T08:15:00.000Z",
          deleted_by: "lead-a",
        },
      ],
      hardDeletedRows: [
        {
          id: "hard-row",
          declaration_number: "TK-HARD-1",
          branch: "HP",
          tax_code: "0100000002",
          enterprise: "Cong ty xoa cung",
          raw_date: "2026-03-01",
          deletedAtTm: "2026-03-05T09:30:00.000Z",
          actor: "admin-b",
        },
        {
          id: "hard-legacy",
          declarationNumber: "TK-HARD-LEGACY",
          deletedTimestamp: "khong-hop-le",
        },
      ],
      keyOfRow,
      formatDateTime,
      formatDisplayDate,
    });

    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => entry.key)).toEqual([
      "hard:hard-row",
      "soft:soft-row",
      "hard:hard-legacy",
    ]);

    expect(entries[0]).toMatchObject({
      type: "hard",
      typeLabel: "Đã xóa vĩnh viễn",
      tone: "danger",
      soTk: "TK-HARD-1",
      branch: "HP",
      mst: "0100000002",
      company: "Cong ty xoa cung",
      dateLabel: "DATE:2026-03-01",
      deletedAtLabel: "TS:2026-03-05T09:30:00.000Z",
      deletedByLabel: "admin-b",
    });

    expect(entries[1]).toMatchObject({
      type: "soft",
      typeLabel: "Đã xóa tạm thời",
      tone: "warning",
      soTk: "TK-SOFT-1",
      branch: "HN",
      mst: "0100000001",
      company: "Cong ty xoa mem",
      dateLabel: "DATE:2026-03-02",
      deletedAtLabel: "TS:2026-03-03T08:15:00.000Z",
      deletedByLabel: "lead-a",
    });

    expect(entries[2]).toMatchObject({
      type: "hard",
      deletedAtLabel: "khong-hop-le",
      deletedByLabel: "Không rõ",
    });
  });

  it("buildDeletedRangeLabel falls back when the filter range is empty", () => {
    const formatDateRangeLabel = ({ from, to }) =>
      from || to ? `${from || "?"} -> ${to || "?"}` : "";

    expect(
      buildDeletedRangeLabel(
        { from: "2026-03-01", to: "2026-03-07" },
        { formatDateRangeLabel },
      ),
    ).toBe("2026-03-01 -> 2026-03-07");

    expect(
      buildDeletedRangeLabel(
        { from: "", to: "" },
        { formatDateRangeLabel },
      ),
    ).toBe("Không giới hạn");
  });
});
