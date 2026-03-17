import { describe, expect, it } from "vitest";

import buildDataImporterSessionControllerResult from "@/components/dataImporter/buildDataImporterSessionControllerResult.js";

describe("buildDataImporterSessionControllerResult", () => {
  it("merges the controller bundles into the public session shape", () => {
    const result = buildDataImporterSessionControllerResult({
      identity: { actor: "sam", rules: { version: 2 } },
      rowHistory: { handleToggleHistory: () => "history" },
      access: { isReadOnlyForEdits: false, canViewSavedRows: true },
      columnConfig: { visibleColumnCount: 12 },
      filters: { deletedRowCount: 3, pageResetKey: "reset-key" },
      preview: { effectivePreviewRows: [{ id: "preview-1" }] },
      listPreferences: { pageSize: 50 },
      actionGuards: { ensureEditableKeys: () => [] },
      presets: { selectedPresetId: "preset-1" },
      license: { licenseExcludeSet: new Set(["E01"]) },
      sync: { loadSavedRows: () => true, syncMessage: "ok" },
      queryFilters: { queryFilterControlsProps: { query: "acme" } },
    });

    expect(result).toMatchObject({
      actor: "sam",
      deletedRowCount: 3,
      pageResetKey: "reset-key",
      pageSize: 50,
      selectedPresetId: "preset-1",
      syncMessage: "ok",
      queryFilterControlsProps: { query: "acme" },
    });
    expect(result.loadSavedRows()).toBe(true);
  });
});
