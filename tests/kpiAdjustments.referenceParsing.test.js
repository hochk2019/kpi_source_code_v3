import { describe, expect, it } from "vitest";

import { parseReferences } from "@/components/kpi-adjustments/model/referenceParsing.js";

describe("kpi adjustment reference parsing helper", () => {
  it("returns an empty list for falsy input", () => {
    expect(parseReferences("")).toEqual([]);
    expect(parseReferences(null)).toEqual([]);
  });

  it("splits multiline and punctuated inputs into normalized unique references", () => {
    expect(parseReferences(" TK001 ; tk002\nTK001,  tk003 ")).toEqual(["TK001", "tk002", "tk003"]);
  });

  it("drops blank items after normalization", () => {
    expect(parseReferences(" ; \n , ")).toEqual([]);
  });
});
