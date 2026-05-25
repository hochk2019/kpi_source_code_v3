import { describe, expect, it } from "vitest";

import {
  applyDeclarationPatch,
  normalizeDeclarationPatch,
} from "../../server-v4/src/modules/declarations/declarationsStore.ts";

describe("server-v4 declarations store helpers", () => {
  it("normalizes alias edit fields into the canonical declaration patch shape", () => {
    const normalized = normalizeDeclarationPatch({
      staffName: "Lan",
      agencyText: "Agency A",
      licenseManualCount: "3",
      licenseSourceCodes: ["GP01", "ZN02", "GP01"],
      licenseExcludedCodes: ["ZN02"],
    });

    expect(normalized.requestedFields).toEqual([
      "nhan_vien",
      "agency",
      "licenses",
      "licenseSourceCodes",
      "licenseExcludedCodes",
    ]);
    expect(normalized.patch).toMatchObject({
      nhan_vien: "Lan",
      staff_name_snapshot: "Lan",
      agency: "Agency A",
      dai_ly: "Agency A",
      agency_text: "Agency A",
      licenses: 3,
      so_luong_gp: 3,
      licenseManualCount: 3,
      license_count: 3,
      licenseSourceCodes: ["GP01", "ZN02"],
      licenseExcludedCodes: ["ZN02"],
    });
  });

  it("applies declaration edits and derives visible license codes from source and excluded arrays", () => {
    const normalized = normalizeDeclarationPatch({
      teamName: "Blue Team",
      licenseSourceCodes: ["GP01", "ZN02", "GP01"],
      licenseExcludedCodes: ["ZN02"],
    });

    const result = applyDeclarationPatch(
      {
        team: "",
        team_name_snapshot: "",
        licenseCodes: ["OLD"],
        licenseSourceCodes: ["OLD"],
        licenseExcludedCodes: [],
      },
      normalized,
    );

    expect(result.changed).toBe(true);
    expect(result.nextRecord.team).toBe("Blue Team");
    expect(result.nextRecord.team_name_snapshot).toBe("Blue Team");
    expect(result.nextRecord.licenseSourceCodes).toEqual(["GP01", "ZN02"]);
    expect(result.nextRecord.licenseExcludedCodes).toEqual(["ZN02"]);
    expect(result.nextRecord.licenseCodes).toEqual(["GP01"]);
    expect(result.historyChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "team", before: "", after: "Blue Team" }),
        expect.objectContaining({
          field: "licenseSourceCodes",
          before: "OLD",
          after: "GP01, ZN02",
        }),
        expect.objectContaining({
          field: "licenseExcludedCodes",
          before: "",
          after: "ZN02",
        }),
      ]),
    );
  });
});
