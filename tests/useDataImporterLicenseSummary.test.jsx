import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";

import useDataImporterLicenseSummary from "@/components/dataImporter/useDataImporterLicenseSummary.js";

describe("useDataImporterLicenseSummary", () => {
  it("combines global and agency-specific exclusion codes for a row", () => {
    const rules = {
      license: {
        exclude: {
          codes: [" zz00 ", ""],
          agencies: [
            { agency: "Agency A", codes: ["ag01", " "] },
            { agency: "Agency B", codes: ["zb02"] },
          ],
        },
      },
    };

    const { result } = renderHook(() => useDataImporterLicenseSummary({ rules }));

    expect(Array.from(result.current.licenseExcludeSet)).toEqual(["ZZ00"]);
    expect(Array.from(result.current.licenseAgencyExcludeMap.get("AGENCY A"))).toEqual(["AG01"]);
    expect(
      Array.from(
        result.current.getLicenseExcludeSetForRow({
          agency: "Agency A; Agency C",
          agents: ["Agency B"],
        }),
      ).sort(),
    ).toEqual(["AG01", "ZB02", "ZZ00"]);
  });

  it("summarizes source, included, excluded, and manual counts", () => {
    const rules = {
      license: {
        exclude: {
          codes: ["zz00"],
          agencies: [{ agency: "Agency A", codes: ["ag01"] }],
        },
      },
    };

    const { result } = renderHook(() => useDataImporterLicenseSummary({ rules }));

    expect(
      result.current.summarizeLicenseSnapshot({
        agency: "Agency A",
        licenseSourceCodes: ["zz00", "ag01", "zb02"],
        licenseCodes: ["ag01", "zb02"],
        licenseExcludedCodes: ["zz00"],
        licenseManualCount: 2,
      }),
    ).toEqual({
      sourceCodes: ["ZZ00", "AG01", "ZB02"],
      includedCodes: ["ZB02"],
      excludedCodes: ["ZZ00", "AG01"],
      sourceCount: 3,
      includedCount: 2,
      excludedCount: 2,
    });
  });

  it("returns an empty snapshot for invalid rows", () => {
    const { result } = renderHook(() => useDataImporterLicenseSummary({ rules: null }));

    expect(result.current.summarizeLicenseSnapshot(null)).toEqual({
      sourceCodes: [],
      includedCodes: [],
      excludedCodes: [],
      sourceCount: 0,
      includedCount: 0,
      excludedCount: 0,
    });
  });
});
