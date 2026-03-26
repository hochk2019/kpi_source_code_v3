import { describe, expect, it } from "vitest";

import {
  formatDateOnly,
  formatDecimal,
  formatInt,
} from "@/components/kpi-adjustments/model/formatting.js";

describe("kpi adjustment formatting helpers", () => {
  it("formats date-only values defensively", () => {
    expect(formatDateOnly("2025-03-27T10:30:00.000Z")).toBeTruthy();
    expect(formatDateOnly("")).toBe("");
    expect(formatDateOnly("invalid-date")).toBe("");
  });

  it("formats integer values with vi-VN separators", () => {
    expect(formatInt(12345)).toBe("12.345");
    expect(formatInt(null)).toBe("0");
    expect(formatInt("bad")).toBe("0");
  });

  it("formats decimal values with two fraction digits", () => {
    expect(formatDecimal(12.3)).toBe("12,30");
    expect(formatDecimal(0)).toBe("0,00");
    expect(formatDecimal("bad")).toBe("0,0");
  });
});
