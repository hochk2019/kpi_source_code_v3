import { describe, expect, it } from "vitest";

import resolveImportEligibility from "@/components/dataImporter/importGate.js";

describe("dataImporter import gate", () => {
  it("allows import only when preview context is valid", () => {
    const gate = resolveImportEligibility({
      canUploadFiles: true,
      isReadOnlyForEdits: false,
      mode: "preview",
      previewSource: null,
      effectivePreviewRows: [{ so_tk: "TK-1" }],
      importPreview: { inserted: 1, updated: 0, invalid: 0 },
    });

    expect(gate).toEqual({
      canImport: true,
      reason: "",
    });
  });

  it("returns explicit reason when user lacks upload permission", () => {
    const gate = resolveImportEligibility({
      canUploadFiles: false,
      isReadOnlyForEdits: false,
      mode: "preview",
      previewSource: null,
      effectivePreviewRows: [{ so_tk: "TK-1" }],
      importPreview: { inserted: 1 },
    });

    expect(gate.canImport).toBe(false);
    expect(gate.reason).toContain("chưa được cấp quyền");
  });

  it("returns sync-preview reason when preview source is ECUS", () => {
    const gate = resolveImportEligibility({
      canUploadFiles: true,
      isReadOnlyForEdits: false,
      mode: "preview",
      previewSource: "sync",
      effectivePreviewRows: [{ so_tk: "TK-1" }],
      importPreview: { inserted: 1 },
    });

    expect(gate.canImport).toBe(false);
    expect(gate.reason).toContain("Đồng bộ ngay");
  });

  it("returns preview error reason when preview computation failed", () => {
    const gate = resolveImportEligibility({
      canUploadFiles: true,
      isReadOnlyForEdits: false,
      mode: "preview",
      previewSource: null,
      effectivePreviewRows: [{ so_tk: "TK-1" }],
      importPreview: { error: { message: "preview failed" } },
    });

    expect(gate.canImport).toBe(false);
    expect(gate.reason).toContain("preview failed");
  });
});
