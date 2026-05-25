import { beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  getDeclRows: vi.fn(),
  getMSTMap: vi.fn(),
  sortDeclRows: vi.fn((rows) => rows),
}));

vi.mock("@/lib/store.js", async () => {
  const actual = await vi.importActual("@/lib/store.js");
  return {
    ...actual,
    getDeclRows: storeMocks.getDeclRows,
    getMSTMap: storeMocks.getMSTMap,
    sortDeclRows: storeMocks.sortDeclRows,
  };
});

import { KPI_ADJUSTMENT_CATEGORY_CONFIG } from "../shared/kpiAdjustments.js";
import {
  buildBusinessDirectory,
  buildDeclarationSuggestions,
  extractCompanyFromRow,
  extractDigits,
  extractMstFromRow,
} from "@/components/kpi-adjustments/model/businessDirectory.js";
import {
  buildCalculationInfo,
  resolveCategoryDefaults,
} from "@/components/kpi-adjustments/model/calculationInfo.js";
import { buildGuidanceGroups } from "@/components/kpi-adjustments/model/guidanceGroups.js";
import { buildSettingsDraft } from "@/components/kpi-adjustments/model/settingsDraft.js";

describe("kpi adjustment model builders", () => {
  beforeEach(() => {
    storeMocks.getDeclRows.mockReset();
    storeMocks.getMSTMap.mockReset();
    storeMocks.sortDeclRows.mockReset();
    storeMocks.sortDeclRows.mockImplementation((rows) => rows);
  });

  it("extracts company, mst and digits from mixed declaration rows", () => {
    expect(extractCompanyFromRow({ customer: "  Cong ty A  " })).toBe("Cong ty A");
    expect(extractMstFromRow({ "Tax Code": "0101-22" })).toBe("010122");
    expect(extractDigits("TK-001/2025")).toBe("0012025");
  });

  it("builds declaration suggestions and business directory from declaration and mst sources", () => {
    storeMocks.getDeclRows.mockReturnValue([
      { so_tk_full: "307871769240", date: "2025-01-03", nhanh: "", cong_ty: "Cong ty C", mst: "0303" },
      { so_tk: "TK-001", date: "2025-01-02", nhanh: "", customer: "Cong ty B", mst: "0202" },
    ]);
    storeMocks.getMSTMap.mockReturnValue([{ mst: "0101", company: "Cong ty A" }]);

    const suggestions = buildDeclarationSuggestions(10);
    const directory = buildBusinessDirectory(suggestions);

    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]).toEqual(
      expect.objectContaining({
        soTk: "307871769240",
        company: "Cong ty C",
        mst: "0303",
      })
    );

    expect(directory.entries.map((entry) => entry.mst)).toEqual(["0101", "0202", "0303"]);
    expect(directory.byMst.get("0202")).toEqual(
      expect.objectContaining({
        mst: "0202",
        company: "Cong ty B",
      })
    );
    const companyC = Array.from(directory.byCompany.values()).find((entry) => entry.company === "Cong ty C");
    expect(companyC).toBeTruthy();
    expect(Array.from(companyC.msts)).toEqual(["0303"]);
  });

  it("resolves hybrid defaults and builds calculation info from overrides", () => {
    const settings = {
      categories: {
        support_misc: {
          defaultMode: "fixed",
          modeUnits: { fixed: 12 },
        },
      },
    };

    const defaults = resolveCategoryDefaults("support_misc", settings);
    const info = buildCalculationInfo(KPI_ADJUSTMENT_CATEGORY_CONFIG.support_misc, defaults);

    expect(defaults).toMatchObject({
      mode: "fixed",
      unitPoints: 12,
      quantity: 1,
    });
    expect(info.badge).toBe("Chế độ: Điểm cố định");
    expect(info.description).toContain("điểm cố định");
  });

  it("groups guidance items and marks categories with active overrides", () => {
    const settings = {
      categories: {
        support_misc: {
          defaultMode: "fixed",
          modeUnits: { fixed: 12 },
        },
        tax_refund_customer: {
          extraUnitPoints: 1,
        },
        license_support: {
          licensePoints: { ZB03: 2.8 },
        },
      },
    };

    const groups = buildGuidanceGroups(settings);
    const supportMiscGroup = groups.find((group) => group.key === "support_misc");
    const supportMiscItem = supportMiscGroup.items.find((item) => item.key === "support_misc");
    const licenseGroup = groups.find((group) => group.key === "license_support");
    const licenseItem = licenseGroup.items.find((item) => item.key === "license_support");
    const taxGroup = groups.find((group) => group.key === "tax");
    const taxItem = taxGroup.items.find((item) => item.key === "tax_refund_customer");

    expect(supportMiscItem.hasOverride).toBe(true);
    expect(supportMiscItem.notes).toContain("Đang áp dụng cấu hình tuỳ chỉnh của đơn vị.");
    expect(licenseItem.licensePoints).toEqual(
      expect.arrayContaining([{ code: "ZB03", points: 2.8 }])
    );
    expect(taxItem.extraUnit).toBe(1);
  });

  it("builds settings draft strings for hybrid, license and extra-point categories", () => {
    const settings = {
      categories: {
        support_misc: {
          defaultMode: "fixed",
          defaultUnit: 0.5,
          modeUnits: { fixed: 12, dynamic: 0.2 },
        },
        license_support: {
          defaultUnit: 1.9,
          licensePoints: { ZB02: 2.4, ZB03: 2.8 },
        },
        tax_refund_customer: {
          defaultUnit: 2.2,
          extraUnitPoints: 1,
        },
      },
    };

    const draft = buildSettingsDraft(settings);

    expect(draft.support_misc).toEqual({
      defaultMode: "fixed",
      defaultUnit: 0.5,
      modeUnits: {
        fixed: "12",
        dynamic: "0.2",
      },
    });
    expect(draft.license_support.defaultUnit).toBe(1.9);
    expect(draft.license_support.licensePoints).toEqual(
      expect.objectContaining({
        ZB02: "2.4",
        ZB03: "2.8",
      })
    );
    expect(draft.tax_refund_customer).toEqual({
      defaultUnit: 2.2,
      extraUnitPoints: 1,
    });
  });
});
