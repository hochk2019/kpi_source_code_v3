import { describe, expect, it } from "vitest";

import {
  coerceLicenseValue,
  ensureCOFields,
  ensureLicenseFields,
  extractAgencyKeys,
  joinCodeList,
  normalizeAgencyKey,
  normalizeLicenseCode,
  parseCodeListInput,
} from "@/components/dataImporter/dataImporterLicenseUtils.js";

describe("dataImporterLicenseUtils", () => {
  it("chuan hoa so luong license va uu tien manual override", () => {
    expect(coerceLicenseValue(" 4.6 ")).toBe(5);
    expect(coerceLicenseValue("")).toBe("");
    expect(coerceLicenseValue("-3")).toBe(0);

    expect(
      ensureLicenseFields({
        licenses: "2",
        so_luong_gp: "",
        licenseManualCount: "5",
      }),
    ).toEqual({
      licenses: 5,
      so_luong_gp: 5,
      licenseManualCount: 5,
    });
  });

  it("chuan hoa ma license va parse/join danh sach code", () => {
    expect(normalizeLicenseCode(" zb01 ")).toBe("ZB01");
    expect(parseCodeListInput("gp01, gp02 gp01;\nGP03")).toEqual(["GP01", "GP02", "GP03"]);
    expect(joinCodeList(["GP01", "GP02"])).toBe("GP01\nGP02");
  });

  it("chuan hoa key dai ly va trich xuat tu nhieu nguon", () => {
    expect(normalizeAgencyKey(' "agent a" ')).toBe("AGENT A");

    expect(
      extractAgencyKeys({
        agents: ["Agent A", "Agent B"],
        agency: "Agent A (Branch 1), Agent C",
      }),
    ).toEqual(["AGENT A", "AGENT B", "AGENT A (BRANCH 1", "BRANCH 1", "AGENT C"]);
  });

  it("dong bo lai co fields tu deriveCOStatus", () => {
    expect(
      ensureCOFields({
        co: "Có",
        has_co: true,
        co_line_count: 3,
      }),
    ).toEqual({
      co: "Có",
      has_co: true,
      co_line_count: 3,
    });

    const normalized = ensureCOFields({
      co: "",
      has_co: true,
      co_line_count: 0,
    });

    expect(normalized.co).toBe("Có");
    expect(normalized.has_co).toBe(true);
    expect(normalized.co_line_count).toBe(1);
  });
});
