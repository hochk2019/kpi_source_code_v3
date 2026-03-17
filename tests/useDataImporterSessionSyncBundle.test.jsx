import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/dataImporter/useDataImporterCoMonitoring.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterWorkflowSession.js", () => ({
  default: vi.fn(),
}));

import useDataImporterCoMonitoring from "@/components/dataImporter/useDataImporterCoMonitoring.js";
import useDataImporterSessionSyncBundle from "@/components/dataImporter/useDataImporterSessionSyncBundle.js";
import useDataImporterWorkflowSession from "@/components/dataImporter/useDataImporterWorkflowSession.js";

describe("useDataImporterSessionSyncBundle", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useDataImporterCoMonitoring.mockReturnValue({
      coCodeForm: { enabled: true },
      handleRefreshCoDiscrepancy: vi.fn(),
      coDiscrepancyStatusLabel: "ok",
    });

    useDataImporterWorkflowSession.mockReturnValue({
      loadSavedRows: vi.fn(),
      syncMessage: "Synced",
      summaryCards: [{ label: "alerts" }],
    });
  });

  it("wires sync workflow to the co-monitoring refresh seam", () => {
    const props = {
      actor: "sam",
      canManageSync: true,
      canReviewAlerts: true,
      canUploadFiles: true,
      isReadOnlyForEdits: false,
      isAdminRole: true,
      hasUnsaved: false,
      mode: "saved",
      rawRows: [{ id: "row-1" }],
      selectedKeys: ["row-1"],
      selectedFile: "decl.xlsx",
      previewSource: "upload",
      effectivePreviewRows: [{ id: "preview-1" }],
      importPreview: { totalRows: 1 },
      canOverwriteData: true,
      overwrite: false,
      autoAssignStaff: true,
      showDeletedRows: false,
      fileRef: { current: null },
      loadRules: vi.fn(),
      getDeclRows: vi.fn(),
      sortDeclRows: vi.fn(),
      ensureLicenseFields: vi.fn(),
      ensureCOFields: vi.fn(),
      updateBaselineSnapshot: vi.fn(),
      setRules: vi.fn(),
      setRawRows: vi.fn(),
      setRowSaveStatus: vi.fn(),
      setRowHistoryExpanded: vi.fn(),
      setRowHistoryEntries: vi.fn(),
      setMode: vi.fn(),
      setPage: vi.fn(),
      setQuery: vi.fn(),
      setSelectedFile: vi.fn(),
      setPreviewSource: vi.fn(),
      setSyncPreviewMeta: vi.fn(),
      setFilterNoStaff: vi.fn(),
      setFilterNoTeam: vi.fn(),
      setFilterDuplicate11: vi.fn(),
      setCoFilterMode: vi.fn(),
      setCoFilterMin: vi.fn(),
      setSelectedKeys: vi.fn(),
      setHasUnsaved: vi.fn(),
      fetchWithAuth: vi.fn(),
      refreshDeclRowsFromServer: vi.fn(),
      getTeamRoster: vi.fn(),
      mapMemberNamesToTeams: vi.fn(),
      mapHQAgenciesByMST: vi.fn(),
      detectDateOrder: vi.fn(),
      mapRow: vi.fn(),
      saveDeclRows: vi.fn(),
      pushImportLog: vi.fn(),
      xlsx: {},
      FileReaderCtor: null,
      toast: { error: vi.fn() },
      acceptedImportExtensions: [".xlsx"],
      maxImportFileSizeBytes: 123,
      maxImportRows: 1000,
      ensureEditableKeys: vi.fn((keys) => keys),
      keyOfRow: vi.fn((row) => row?.id ?? ""),
      markDeclRowsReviewed: vi.fn(),
      unmarkDeclRowsReviewed: vi.fn(),
      formatDateRangeLabel: vi.fn(),
      formatDisplayDate: vi.fn(),
      toDateInputValue: vi.fn(),
      extractErrorMessage: vi.fn(),
    };

    const { result } = renderHook(() => useDataImporterSessionSyncBundle(props));

    expect(useDataImporterCoMonitoring).toHaveBeenCalledWith({
      canManageSync: true,
      fetchWithAuth: props.fetchWithAuth,
      extractErrorMessage: props.extractErrorMessage,
    });
    expect(useDataImporterWorkflowSession).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "sam",
        handleRefreshCoDiscrepancy:
          useDataImporterCoMonitoring.mock.results[0].value.handleRefreshCoDiscrepancy,
      }),
    );
    expect(result.current.coCodeForm).toEqual({ enabled: true });
    expect(result.current.loadSavedRows).toBe(
      useDataImporterWorkflowSession.mock.results[0].value.loadSavedRows,
    );
    expect(result.current.syncMessage).toBe("Synced");
  });
});
