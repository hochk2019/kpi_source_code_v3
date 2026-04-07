import { describe, expect, it } from "vitest";

import {
  normalizeDeclarationNumber,
  normalizeMST,
  normalizeName,
  normalizeStr,
  safeParse,
  stripDiacritics,
} from "../src/lib/storeCoreHelpers.js";

describe("storeCoreHelpers", () => {
  it("normalizes whitespace-heavy strings", () => {
    expect(normalizeStr("  ACME   Logistics  ")).toBe("ACME Logistics");
    expect(normalizeStr(null)).toBe("");
  });

  it("removes Vietnamese diacritics and lowercases normalized names", () => {
    expect(stripDiacritics(" Hạnh   Phúc ")).toBe("Hanh Phuc");
    expect(normalizeName(" Hạnh   Phúc ")).toBe("hanh phuc");
  });

  it("keeps only MST digits", () => {
    expect(normalizeMST(" 01.023.4567-8 ")).toBe("0102345678");
  });

  it("pads and trims declaration numbers to the requested length", () => {
    expect(normalizeDeclarationNumber("12345")).toBe("00000012345");
    expect(normalizeDeclarationNumber("1234567890123")).toBe("12345678901");
    expect(normalizeDeclarationNumber("AB-12", 4)).toBe("0012");
  });

  it("safely parses JSON with fallback", () => {
    expect(safeParse('{"ok":true}', [])).toEqual({ ok: true });
    expect(safeParse("not-json", ["fallback"])).toEqual(["fallback"]);
    expect(safeParse("null", { ok: false })).toEqual({ ok: false });
  });
});
