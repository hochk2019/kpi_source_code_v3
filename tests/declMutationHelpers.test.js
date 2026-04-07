import { describe, expect, it, vi } from "vitest";

import {
  applyPartialUpdatesToRow,
  getDeclRowSimpleKey,
  sanitizePartialDeclUpdates,
} from "../src/lib/declMutationHelpers.js";

describe("declMutationHelpers", () => {
  it("builds row keys from declaration number and branch", () => {
    expect(getDeclRowSimpleKey({ so_tk: "0001", nhanh: "A" })).toBe("0001_A");
    expect(getDeclRowSimpleKey({ so_tk: "0001" })).toBe("0001_");
    expect(getDeclRowSimpleKey(null)).toBe("");
  });

  it("sanitizes mirrored agency fields and license counts", () => {
    expect(
      sanitizePartialDeclUpdates({
        agency: "  DL Alpha  ",
        licenseManualCount: "3.6",
      }),
    ).toEqual({
      agency: "DL Alpha",
      dai_ly: "DL Alpha",
      licenses: 4,
      so_luong_gp: 4,
      licenseManualCount: 4,
    });
  });

  it("applies sanitized updates, removes null fields, and stamps updatedAt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-07T10:11:12.000Z"));

    const result = applyPartialUpdatesToRow(
      {
        so_tk: "0001",
        agency: "Old",
        dai_ly: "Old",
        licenses: 1,
        obsolete: "remove-me",
      },
      {
        agency: "  New Agency  ",
        licenses: "2",
        obsolete: null,
      },
    );

    expect(result).toEqual({
      changed: true,
      nextRow: {
        so_tk: "0001",
        agency: "New Agency",
        dai_ly: "New Agency",
        licenses: 2,
        so_luong_gp: 2,
        licenseManualCount: 2,
        updatedAt: "2026-04-07T10:11:12.000Z",
      },
    });

    vi.useRealTimers();
  });

  it("returns the original row when nothing changes", () => {
    const row = { so_tk: "0002", agency: "Same", dai_ly: "Same" };
    expect(applyPartialUpdatesToRow(row, { agency: "Same" })).toEqual({
      changed: false,
      nextRow: row,
    });
  });
});
