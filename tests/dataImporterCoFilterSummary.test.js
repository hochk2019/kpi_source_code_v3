import { describe, expect, it } from "vitest";

import { buildDataImporterCoFilterSummary } from "@/components/dataImporter/dataImporterCoFilterSummary.js";

describe("buildDataImporterCoFilterSummary", () => {
  const rows = [{ lines: 0 }, { lines: 1 }, { lines: 3 }];
  const getCoLineCount = (row) => row.lines ?? 0;

  it("disables the filter and returns the full row count for all mode", () => {
    expect(
      buildDataImporterCoFilterSummary({
        rawRows: rows,
        coFilterMode: "all",
        coThreshold: 2,
        getCoLineCount,
      }),
    ).toEqual({
      coFilterActive: false,
      coFilterMatches: 3,
    });
  });

  it("counts rows with at least one C/O line for has mode", () => {
    expect(
      buildDataImporterCoFilterSummary({
        rawRows: rows,
        coFilterMode: "has",
        coThreshold: 0,
        getCoLineCount,
      }),
    ).toEqual({
      coFilterActive: true,
      coFilterMatches: 2,
    });
  });

  it("enforces the minimum threshold only when it is positive", () => {
    expect(
      buildDataImporterCoFilterSummary({
        rawRows: rows,
        coFilterMode: "min",
        coThreshold: 2,
        getCoLineCount,
      }),
    ).toEqual({
      coFilterActive: true,
      coFilterMatches: 1,
    });
    expect(
      buildDataImporterCoFilterSummary({
        rawRows: rows,
        coFilterMode: "min",
        coThreshold: 0,
        getCoLineCount,
      }),
    ).toEqual({
      coFilterActive: false,
      coFilterMatches: 3,
    });
  });
});
