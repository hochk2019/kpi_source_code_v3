import { describe, expect, it } from "vitest";

import { CATEGORY_OPTIONS, resolveCategoryOptions } from "@/components/kpi-adjustments/model/categoryOptions.js";

describe("kpi adjustment category options", () => {
  it("maps category config entries into select options", () => {
    const options = resolveCategoryOptions();

    expect(options.length).toBeGreaterThan(0);
    expect(options).toContainEqual(
      expect.objectContaining({
        value: "support_misc",
        label: expect.any(String),
        type: expect.any(String),
      }),
    );
    expect(options).toContainEqual(
      expect.objectContaining({
        value: "license_support",
        label: expect.any(String),
        type: expect.any(String),
      }),
    );
  });

  it("keeps the exported constant aligned with the helper output", () => {
    expect(CATEGORY_OPTIONS).toEqual(resolveCategoryOptions());
  });
});
