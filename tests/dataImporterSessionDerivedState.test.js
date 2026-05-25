import { describe, expect, it } from "vitest";

import { buildDataImporterSessionDerivedState } from "@/components/dataImporter/dataImporterSessionDerivedState.js";

describe("buildDataImporterSessionDerivedState", () => {
  it("derives normalized filters, deleted rows, and reset key from importer filter state", () => {
    const rows = [
      {
        id: "row-1",
        so_tk: "00000000001",
        mst: "0101",
        cong_ty: "Acme company a",
        status: "new",
        date: "2026-03-03",
        deleted_at: null,
        so_luong_co: 4,
      },
      {
        id: "row-2",
        so_tk: "00000000001",
        mst: "0101",
        cong_ty: "Acme company a",
        status: "new",
        date: "2026-03-04",
        deleted_at: "2026-03-10T00:00:00.000Z",
        so_luong_co: 8,
      },
      {
        id: "row-3",
        so_tk: "00000000002",
        mst: "0202",
        cong_ty: "Another company",
        status: "draft",
        date: "2026-04-01",
        deleted_at: null,
        so_luong_co: 12,
      },
    ];

    const derived = buildDataImporterSessionDerivedState({
      rawRows: rows,
      mode: "saved",
      pageSize: 50,
      query: "acme",
      quickMST: "0101",
      quickCompany: "company a",
      normalizedQuickMST: "0101",
      normalizedQuickCompany: "company a",
      statusFilters: ["new", "reviewed"],
      searchRange: { from: "2026-03-01", to: "2026-03-31" },
      filterNoStaff: true,
      filterNoTeam: false,
      filterDuplicate11: true,
      coFilterMode: "gte",
      coFilterMin: "5",
      showDeletedRows: true,
      serverSearchThreshold: 2,
    });

    expect(derived.deletedRowCount).toBe(1);
    expect(derived.coThreshold).toBe(5);
    expect(derived.baseFilterInputs).toMatchObject({
      query: "acme",
      mst: "0101",
      company: "company a",
      statuses: ["new", "reviewed"],
      range: { from: "2026-03-01", to: "2026-03-31" },
      noStaff: true,
      noTeam: false,
      duplicate: true,
      coMode: "gte",
      coMin: 5,
    });
    expect(derived.normalizedFilters).toEqual({
      query: "acme",
      mst: "0101",
      company: "company a",
      statuses: ["new", "reviewed"],
      range: { from: "2026-03-01", to: "2026-03-31" },
      noStaff: true,
      noTeam: false,
      duplicate: true,
      coMode: "all",
      coMin: 5,
      includeDeleted: true,
    });
    expect(derived.softDeletedRows).toEqual([rows[1]]);
    expect(derived.shouldUseServerSearch).toBe(true);
    expect(derived.pageResetKey).toBe(
      "50::true::false::true::gte::5::2026-03-01::2026-03-31::0101::company a::new|reviewed::true::true",
    );
  });

  it("clamps invalid C/O thresholds and disables server search outside saved mode", () => {
    const derived = buildDataImporterSessionDerivedState({
      rawRows: [{ id: "row-1", deleted_at: null }],
      mode: "preview",
      pageSize: 25,
      query: "",
      quickMST: "",
      quickCompany: "",
      normalizedQuickMST: "",
      normalizedQuickCompany: "",
      statusFilters: [],
      searchRange: { from: "", to: "" },
      filterNoStaff: false,
      filterNoTeam: false,
      filterDuplicate11: false,
      coFilterMode: "all",
      coFilterMin: "-3",
      showDeletedRows: false,
      serverSearchThreshold: 0,
    });

    expect(derived.deletedRowCount).toBe(0);
    expect(derived.coThreshold).toBe(0);
    expect(derived.softDeletedRows).toEqual([]);
    expect(derived.shouldUseServerSearch).toBe(false);
    expect(derived.normalizedFilters.includeDeleted).toBe(false);
  });
});
