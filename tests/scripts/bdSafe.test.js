import { describe, expect, it } from "vitest";

import {
  extractCommandName,
  isMutatingCommand,
  parseBdSafeArgs,
} from "../../scripts/bd-safe.mjs";

describe("bd-safe helpers", () => {
  it("parseBdSafeArgs removes wrapper-only flags", () => {
    const parsed = parseBdSafeArgs(["--check", "update", "cng-1", "--no-sync"]);
    expect(parsed).toEqual({
      args: ["update", "cng-1"],
      noSync: true,
      runCheck: true,
    });
  });

  it("extractCommandName returns first non-flag argument", () => {
    expect(extractCommandName(["--json", "ready"])).toBe("ready");
    expect(extractCommandName(["--json", "--verbose"])).toBe("");
  });

  it("isMutatingCommand identifies mutating commands", () => {
    expect(isMutatingCommand("update")).toBe(true);
    expect(isMutatingCommand("close")).toBe(true);
    expect(isMutatingCommand("ready")).toBe(false);
    expect(isMutatingCommand("show")).toBe(false);
  });
});
