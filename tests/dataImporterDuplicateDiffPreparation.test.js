import { describe, expect, it, vi } from "vitest";

import { prepareDuplicateDiffRow } from "@/components/dataImporter/dataImporterDuplicateDiffPreparation.js";

describe("dataImporterDuplicateDiffPreparation", () => {
  it("returns an empty object for invalid rows", () => {
    expect(
      prepareDuplicateDiffRow(null, {
        summarizeLicenseSnapshot: vi.fn(),
        coLabel: vi.fn(),
        coLineCount: vi.fn(),
        extractRowTimestampDetail: vi.fn(),
      }),
    ).toEqual({});
  });

  it("normalizes duplicate diff metadata for a declaration row", () => {
    const summarizeLicenseSnapshot = vi.fn(() => ({
      sourceCount: 5,
      includedCount: 3,
      excludedCount: 2,
      sourceCodes: ["A1", "B2"],
      includedCodes: ["A1"],
      excludedCodes: ["B2"],
    }));
    const extractRowTimestampDetail = vi.fn(() => ({
      label: "Cập nhật gần nhất",
      display: "11/03/2026 09:15:00",
    }));

    const prepared = prepareDuplicateDiffRow(
      {
        so_tk: "10203040506",
        agents: ["Alpha", "Beta", "Alpha"],
        agency: "Gamma",
        dai_ly: "Beta",
        hq_agency: " Delta ",
      },
      {
        summarizeLicenseSnapshot,
        coLabel: () => "Đã có C/O",
        coLineCount: () => 4,
        extractRowTimestampDetail,
      },
    );

    expect(prepared.so_tk_full).toBe("10203040506");
    expect(prepared.__license_source_count).toBe(5);
    expect(prepared.__license_included_count).toBe(3);
    expect(prepared.__license_excluded_count).toBe(2);
    expect(prepared.__license_source_codes).toEqual(["A1", "B2"]);
    expect(prepared.__license_included_codes).toEqual(["A1"]);
    expect(prepared.__license_excluded_codes).toEqual(["B2"]);
    expect(prepared.__co_status).toBe("Đã có C/O");
    expect(prepared.__co_lines).toBe(4);
    expect(prepared.__timestamp_field).toBe(
      "Cập nhật gần nhất: 11/03/2026 09:15:00",
    );
    expect(prepared.__agents_display).toEqual(["Alpha", "Beta", "Gamma", "Delta"]);
  });
});
