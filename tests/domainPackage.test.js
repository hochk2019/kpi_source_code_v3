import { describe, expect, it } from "vitest";

import {
  DEFAULT_RULES,
  computeLicenseSnapshot,
  formatDisplayDate,
  seedSampleDeclarations,
} from "../packages/domain/src/index.js";

describe("packages/domain", () => {
  it("re-exports stable domain helpers from the workspace package", () => {
    expect(formatDisplayDate("2026-03-12")).toBe("12/03/2026");
    expect(DEFAULT_RULES).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        groups: expect.any(Object),
      }),
    );

    const snapshot = computeLicenseSnapshot(
      {
        licenseCodes: ["zb02", " ZN02 ", "zb03"],
        agency: "G&B",
      },
      DEFAULT_RULES,
    );

    expect(snapshot.sourceCodes).toEqual(["ZB02", "ZB03", "ZN02"]);
    expect(snapshot.includedCodes).toEqual([]);
    expect(snapshot.excludedCodes).toEqual(["ZB02", "ZB03", "ZN02"]);
  });

  it("keeps sample declaration seeding available from the package boundary", () => {
    const rows = seedSampleDeclarations({ actor: "package-test", count: 6, rules: DEFAULT_RULES });

    expect(rows).toHaveLength(6);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        so_tk: expect.any(String),
        loai_hinh: expect.any(String),
      }),
    );
  });
});
