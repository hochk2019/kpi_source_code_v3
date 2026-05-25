import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import useDataImporterLicenseExclusions from "@/components/dataImporter/useDataImporterLicenseExclusions.js";

const dialogMocks = vi.hoisted(() => ({
  alert: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/hooks/useAppDialog.tsx", () => ({
  useAppDialog: () => dialogMocks,
}));

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
    vi.clearAllMocks();
    dialogMocks.alert.mockResolvedValue();
  });

  it("applies license exclusions to selected rows and reports the summary", async () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterLicenseExclusions(props));

    await act(async () => {
      await result.current.handleApplyLicenseExclusion();
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
    expect(dialogMocks.alert).toHaveBeenCalledTimes(1);
    expect(dialogMocks.alert.mock.calls[0][0]).toContain("1/1");
    expect(dialogMocks.alert.mock.calls[0][0]).toContain("ZZ00");
    expect(dialogMocks.alert.mock.calls[0][0]).toContain("AG01");
  });

  it("alerts when no selected rows are available for manual apply", async () => {
    const props = createProps({ selectedKeys: [] });
    const { result } = renderHook(() => useDataImporterLicenseExclusions(props));

    await act(async () => {
      await result.current.handleApplyLicenseExclusion();
    });

    expect(props.ensureEditableKeys).not.toHaveBeenCalled();
    expect(props.setRawRows).not.toHaveBeenCalled();
    expect(dialogMocks.alert).toHaveBeenCalledTimes(1);
  });

  it("blocks auto apply when the actor is not allowed to reconcile", async () => {
    const props = createProps({ canAutoReconcile: false });
    const { result } = renderHook(() => useDataImporterLicenseExclusions(props));

    await act(async () => {
      await result.current.handleAutoApplyLicenseExclusion();
    });

    expect(props.ensureEditableKeys).not.toHaveBeenCalled();
    expect(props.setRawRows).not.toHaveBeenCalled();
    expect(dialogMocks.alert).toHaveBeenCalledTimes(1);
  });

  it("blocks auto apply when canEdit is false", async () => {
    const props = createProps({ canEdit: false });
    const { result } = renderHook(() => useDataImporterLicenseExclusions(props));

    await act(async () => {
      await result.current.handleAutoApplyLicenseExclusion();
    });

    expect(props.ensureEditableKeys).not.toHaveBeenCalled();
    expect(dialogMocks.alert).toHaveBeenCalledWith(
      expect.stringContaining("quyền"),
    );
  });

  it("blocks auto apply when mode is source", async () => {
    const props = createProps({ mode: "source" });
    const { result } = renderHook(() => useDataImporterLicenseExclusions(props));

    await act(async () => {
      await result.current.handleAutoApplyLicenseExclusion();
    });

    expect(props.ensureEditableKeys).not.toHaveBeenCalled();
    expect(dialogMocks.alert).toHaveBeenCalledWith(
      expect.stringContaining("đã lưu"),
    );
  });

  it("blocks auto apply when filteredKeys is empty", async () => {
    const props = createProps({ filteredKeys: [] });
    const { result } = renderHook(() => useDataImporterLicenseExclusions(props));

    await act(async () => {
      await result.current.handleAutoApplyLicenseExclusion();
    });

    expect(props.ensureEditableKeys).not.toHaveBeenCalled();
    expect(dialogMocks.alert).toHaveBeenCalledWith(
      expect.stringContaining("bộ lọc"),
    );
  });

  it("auto apply success path calls applyLicenseExclusionForKeys and shows summary", async () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterLicenseExclusions(props));

    await act(async () => {
      await result.current.handleAutoApplyLicenseExclusion();
    });

    expect(props.ensureEditableKeys).toHaveBeenCalledWith(
      ["row-1"],
      "đối chiếu giấy phép tự động",
    );
    expect(props.setRawRows).toHaveBeenCalled();
    expect(props.setHasUnsaved).toHaveBeenCalledWith(true);
    expect(dialogMocks.alert).toHaveBeenCalledWith(
      expect.stringContaining("tờ khai"),
    );
  });
});
