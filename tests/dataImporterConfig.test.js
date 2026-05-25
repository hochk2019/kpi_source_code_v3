import { describe, expect, it } from "vitest";

import {
  AUX_COLUMN_OPTIONS,
  COLUMN_CONFIG_OPTIONS,
  IMPORT_TABLE_COLUMNS,
  areWidthMapsEqual,
  clampColumnWidth,
  formatMstListForInput,
  isConfigColumnKey,
  parseMstListInput,
  sanitizeColumnWidths,
} from "@/components/dataImporter/dataImporterConfig.js";

describe("dataImporterConfig", () => {
  it("builds column options for import and aux columns", () => {
    expect(IMPORT_TABLE_COLUMNS).toContainEqual(
      expect.objectContaining({ id: "date", label: "Ngày" }),
    );
    expect(AUX_COLUMN_OPTIONS).toContainEqual(
      expect.objectContaining({ id: "history", label: "Nhật ký" }),
    );
    expect(COLUMN_CONFIG_OPTIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "date" }),
        expect.objectContaining({ id: "history" }),
      ]),
    );
  });

  it("recognizes valid config keys and sanitizes width maps", () => {
    expect(isConfigColumnKey("date")).toBe(true);
    expect(isConfigColumnKey("history")).toBe(true);
    expect(isConfigColumnKey("bogus")).toBe(false);

    expect(clampColumnWidth("10")).toBe(80);
    expect(clampColumnWidth("140.2")).toBe(140);

    expect(
      sanitizeColumnWidths({
        date: "10",
        history: 120.7,
        bogus: 999,
        company: "NaN",
      }),
    ).toEqual({
      date: 80,
      history: 121,
    });

    expect(areWidthMapsEqual({ date: 80, history: 121 }, { history: 121, date: 80 })).toBe(true);
    expect(areWidthMapsEqual({ date: 80 }, { date: 81 })).toBe(false);
  });

  it("normalizes MST input lists for sync config textareas", () => {
    expect(parseMstListInput("0101234567\n0101234567;  0207654321")).toEqual([
      "0101234567",
      "0207654321",
    ]);
    expect(parseMstListInput([" 0312345678 ", "0312345678", "0400000001"])).toEqual([
      "0312345678",
      "0400000001",
    ]);
    expect(formatMstListForInput(["0101234567", "", "0207654321"])).toBe("0101234567\n0207654321");
  });
});
