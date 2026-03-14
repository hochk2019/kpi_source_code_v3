import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import useDataImporterLicenseExclusions from "@/components/dataImporter/useDataImporterLicenseExclusions.js";

function createProps(overrides = {}) {
  return {
    mode: "saved",
    rawRows: [
      {
        rowKey: "row-1",
        so_tk: "TK-001",
        agency: "agency-a",
        licenseSourceCodes: ["zb02", "zz00", "ag01"],
        licenseCodes: ["zb02", "zz00", "ag01"],
        licenseExcludedCodes: [],
        licenses: 3,
        so_luong_gp: 3,
      },
    ],
    rules: {},
    selectedKeys: ["row-1"],
    filteredKeys: ["row-1"],
    canEdit: true,
    canAutoReconcile: true,
    ensureEditableKeys: vi.fn((keys) => keys),
    filterEditableKeys: vi.fn((keys) => ({ allowed: keys, blocked: 0 })),
    keyOfRow: vi.fn((row) => row.rowKey),
    getLicenseExcludeSetForRow: vi.fn(() => new Set(["ZZ00", "AG01"])),
    licenseExcludeSet: new Set(["ZZ00"]),
    licenseAgencyExcludeMap: new Map([["agency-a", new Set(["AG01"])]]),
    setRawRows: vi.fn(),
    setHasUnsaved: vi.fn(),
    normalizeLicenseCode: vi.fn((value) =>
      typeof value === "string" ? value.trim().toUpperCase() : ""
    ),
    normalizeAgencyKey: vi.fn((value) =>
      typeof value === "string" ? value.trim().toLowerCase() : ""
    ),
    extractAgencyKeys: vi.fn((row) => (row.agency ? [row.agency] : [])),
    extractLicenseCodesFromRowObj: vi.fn(() => []),
    computeLicenseSnapshot: vi.fn(() => ({
      sourceCodes: [],
      includedCodes: [],
      excludedCodes: [],
      manualCount: 0,
    })),
    computeKPI: vi.fn(() => 12.34),
    ...overrides,
  };
}

describe("useDataImporterLicenseExclusions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applies license exclusions to selected rows and reports the summary", () => {
    const props = createProps();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { result } = renderHook(() => useDataImporterLicenseExclusions(props));

    act(() => {
      result.current.handleApplyLicenseExclusion();
    });

    expect(props.ensureEditableKeys).toHaveBeenCalledWith(
      ["row-1"],
      "doi chieu giay phep"
    );
    expect(props.setRawRows).toHaveBeenCalledWith([
      expect.objectContaining({
        rowKey: "row-1",
        licenseSourceCodes: ["AG01", "ZB02", "ZZ00"],
        licenseExcludedCodes: ["AG01", "ZZ00"],
        licenseCodes: ["ZB02"],
        licenses: 1,
        so_luong_gp: 1,
        licenseManualCount: 1,
        kpi: 12.3,
        updatedAt: expect.any(String),
      }),
    ]);
    expect(props.setHasUnsaved).toHaveBeenCalledWith(true);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toContain("1/1");
    expect(alertSpy.mock.calls[0][0]).toContain("ZZ00");
    expect(alertSpy.mock.calls[0][0]).toContain("AG01");
  });

  it("alerts when no selected rows are available for manual apply", () => {
    const props = createProps({ selectedKeys: [] });
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { result } = renderHook(() => useDataImporterLicenseExclusions(props));

    act(() => {
      result.current.handleApplyLicenseExclusion();
    });

    expect(props.ensureEditableKeys).not.toHaveBeenCalled();
    expect(props.setRawRows).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it("blocks auto apply when the actor is not allowed to reconcile", () => {
    const props = createProps({ canAutoReconcile: false });
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { result } = renderHook(() => useDataImporterLicenseExclusions(props));

    act(() => {
      result.current.handleAutoApplyLicenseExclusion();
    });

    expect(props.ensureEditableKeys).not.toHaveBeenCalled();
    expect(props.setRawRows).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });
});
