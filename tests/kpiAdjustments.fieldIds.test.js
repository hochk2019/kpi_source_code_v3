import { describe, expect, it } from "vitest";

import {
  buildLicenseFieldId,
  buildSettingsFieldId,
  normalizeFieldSegment,
} from "@/components/kpi-adjustments/model/fieldIds.js";

describe("kpi adjustment field id helpers", () => {
  it("normalizes category and field segments safely", () => {
    expect(normalizeFieldSegment(" Support Misc ")).toBe("support-misc");
    expect(normalizeFieldSegment("ZB/03")).toBe("zb-03");
    expect(normalizeFieldSegment(null)).toBe("");
  });

  it("builds settings field ids from normalized segments", () => {
    expect(buildSettingsFieldId("Support Misc", "defaultUnit")).toBe(
      "kpi-setting-support-misc-defaultunit",
    );
    expect(buildSettingsFieldId(" license_support ", "mode units")).toBe(
      "kpi-setting-license_support-mode-units",
    );
  });

  it("builds license field ids from normalized category and code", () => {
    expect(buildLicenseFieldId("License Support", "ZB/03")).toBe(
      "kpi-setting-license-support-license-zb-03",
    );
    expect(buildLicenseFieldId(null, null)).toBe("kpi-setting--license-");
  });
});
