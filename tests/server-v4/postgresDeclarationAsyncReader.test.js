import { describe, expect, it, vi } from "vitest";

import { PostgresDeclarationAsyncReader } from "../../server-v4/src/modules/declarations/postgresDeclarationAsyncReader.ts";
import { LEGACY_BUSINESS_HOT_PATH_KEYS } from "../../server-v4/src/persistence/businessSnapshotReader.ts";

describe("server-v4 postgres declaration async reader", () => {
  it("reads canonical declarations rows from postgres before falling back to typed snapshots", async () => {
    const fallbackReader = createFallbackReader([{ so_tk: "BLOB-TK" }]);
    const pool = {
      query: vi.fn(async () => ({
        rows: [
          {
            declaration_id: "decl-1",
            declaration_no: "00000012345",
            declaration_no_raw: "12345ABC",
            branch_code: "Chi nhanh A",
            declared_at: "2026-02-14",
            tax_code: "0101234567-1",
            company_name: "Cong ty A",
            customs_type_code: "A11",
            item_count: 3,
            license_count: 2,
            staff_name_snapshot: "Lan",
            team_name_snapshot: "Blue Team",
            agency_text: "Agency A",
            is_export: false,
            co_line_count: 1,
            license_codes: ["GP01"],
            license_source_codes: ["GP01", "ZN02"],
            license_excluded_codes: ["ZN02"],
          },
        ],
      })),
    };
    const reader = new PostgresDeclarationAsyncReader(fallbackReader, pool, {
      sourceKind: "dual-write",
    });

    await expect(reader.readDeclarationRows()).resolves.toEqual([
      {
        declaration_id: "decl-1",
        declaration_no: "00000012345",
        so_tk: "00000012345",
        declaration_no_raw: "12345ABC",
        so_tk_full: "12345ABC",
        branch_code: "Chi nhanh A",
        branch: "Chi nhanh A",
        nhanh: "Chi nhanh A",
        declared_at: "2026-02-14",
        date: "2026-02-14",
        tax_code: "0101234567-1",
        mst: "0101234567-1",
        company_name: "Cong ty A",
        cong_ty: "Cong ty A",
        customs_type_code: "A11",
        ma_loai_hinh: "A11",
        loai_hinh: "A11",
        item_count: 3,
        num_items: 3,
        muc_hang: 3,
        license_count: 2,
        licenses: 2,
        so_luong_gp: 2,
        staff_name_snapshot: "Lan",
        nhan_vien: "Lan",
        team_name_snapshot: "Blue Team",
        team: "Blue Team",
        agency_text: "Agency A",
        agency: "Agency A",
        dai_ly: "Agency A",
        is_export: false,
        isExport: false,
        co_line_count: 1,
        has_co: true,
        reviewed: false,
        reviewed_at: "",
        reviewed_by: "",
        licenseCodes: ["GP01"],
        licenseSourceCodes: ["GP01", "ZN02"],
        licenseExcludedCodes: ["ZN02"],
      },
    ]);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(fallbackReader.readDeclarationRows).not.toHaveBeenCalled();
  });

  it("falls back to the compatibility reader when canonical declarations are not materialized yet", async () => {
    const fallbackRows = [{ so_tk: "FALLBACK-TK", nhanh: "Fallback Branch", mst: "0999999999" }];
    const fallbackReader = createFallbackReader(fallbackRows);
    const pool = {
      query: vi.fn().mockResolvedValueOnce({ rows: [] }),
    };
    const reader = new PostgresDeclarationAsyncReader(fallbackReader, pool);

    await expect(reader.readDeclarationRows()).resolves.toEqual(fallbackRows);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(fallbackReader.readDeclarationRows).toHaveBeenCalledTimes(1);
  });

  it("falls back to the SQLite compatibility reader when the postgres queries fail", async () => {
    const fallbackRows = [{ so_tk: "FALLBACK-TK", nhanh: "Fallback Branch", mst: "0999999999" }];
    const fallbackReader = createFallbackReader(fallbackRows);
    const pool = {
      query: vi.fn(async () => {
        throw new Error("postgres unavailable");
      }),
    };
    const reader = new PostgresDeclarationAsyncReader(fallbackReader, pool);

    await expect(reader.readDeclarationRows()).resolves.toEqual(fallbackRows);
    expect(fallbackReader.readDeclarationRows).toHaveBeenCalledTimes(1);
  });
});

function createFallbackReader(rows) {
  return {
    getSourceKind: () => "dual-write",
    getHotPathKeys: () => LEGACY_BUSINESS_HOT_PATH_KEYS,
    getLegacyDbFile: () => ":memory:",
    readDeclarationRows: vi.fn(async () => rows),
  };
}
