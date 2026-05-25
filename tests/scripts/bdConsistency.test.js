import { describe, expect, it } from "vitest";

import {
  parseActiveBead,
  parseReadyBeads,
  shouldWarnMissingActiveBead,
} from "../../scripts/check-bd-consistency.mjs";

describe("check-bd-consistency parsers", () => {
  it("parses active bead from task.md content", () => {
    const content = `
## Active Slice
-- Title: Something
-- Bead: cng-7z0.7
-- Status: in_progress
`;
    expect(parseActiveBead(content)).toBe("cng-7z0.7");
  });

  it("parses ready beads from open-backlog ready section only", () => {
    const content = `
Current highest-priority ready items:
- backend:
  - \`cng-2k4.5\` — one
  - \`cng-2k4.6\` — two
## Technical Stabilization
- \`cng-0\` not in ready block
`;
    expect(parseReadyBeads(content)).toEqual(["cng-2k4.5", "cng-2k4.6"]);
  });

  it("returns empty list when ready section is missing", () => {
    expect(parseReadyBeads("No ready block here")).toEqual([]);
  });

  it("does not warn about a missing active bead when no work is in progress", () => {
    expect(
      shouldWarnMissingActiveBead({
        activeBead: "",
        inProgressIds: new Set(),
      }),
    ).toBe(false);
  });

  it("warns about a missing active bead when BD still has in-progress work", () => {
    expect(
      shouldWarnMissingActiveBead({
        activeBead: "",
        inProgressIds: new Set(["cng-7z0.7"]),
      }),
    ).toBe(true);
  });
});
