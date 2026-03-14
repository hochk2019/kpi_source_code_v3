import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useFilterPresets.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterDisplayPreferences.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterSyncStatusToast.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterRowHistory.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterEditAccess.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterColumnConfig.jsx", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterDeletedRows.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterImportPreview.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterListPreferences.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterActionGuards.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterFilterPresets.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterLicenseSummary.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterCoMonitoring.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterWorkflowSession.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterQueryFilters.js", () => ({
  default: vi.fn(),
}));

import useFilterPresets from "@/hooks/useFilterPresets.js";
import useDataImporterActionGuards from "@/components/dataImporter/useDataImporterActionGuards.js";
import useDataImporterCoMonitoring from "@/components/dataImporter/useDataImporterCoMonitoring.js";
import useDataImporterColumnConfig from "@/components/dataImporter/useDataImporterColumnConfig.jsx";
import useDataImporterDeletedRows from "@/components/dataImporter/useDataImporterDeletedRows.js";
import useDataImporterDisplayPreferences from "@/components/dataImporter/useDataImporterDisplayPreferences.js";
import useDataImporterEditAccess from "@/components/dataImporter/useDataImporterEditAccess.js";
import useDataImporterFilterPresets from "@/components/dataImporter/useDataImporterFilterPresets.js";
import useDataImporterImportPreview from "@/components/dataImporter/useDataImporterImportPreview.js";
import useDataImporterLicenseSummary from "@/components/dataImporter/useDataImporterLicenseSummary.js";
import useDataImporterListPreferences from "@/components/dataImporter/useDataImporterListPreferences.js";
import useDataImporterQueryFilters from "@/components/dataImporter/useDataImporterQueryFilters.js";
import useDataImporterRowHistory from "@/components/dataImporter/useDataImporterRowHistory.js";
import useDataImporterSessionController from "@/components/dataImporter/useDataImporterSessionController.js";
import useDataImporterSyncStatusToast from "@/components/dataImporter/useDataImporterSyncStatusToast.js";
import useDataImporterWorkflowSession from "@/components/dataImporter/useDataImporterWorkflowSession.js";

function createProps(overrides = {}) {
  return {
    currentUser: { username: "sam" },
    canEdit: false,
    canImportUpload: true,
    canManageSync: true,
    canManageAlerts: true,
    allowAdminUploadOverride: true,
    mainSearchHelpTextId: "search-help",
    fileRef: { current: null },
    rawRows: [
      { id: "row-1", deleted_at: null },
      { id: "row-2", deleted_at: "2026-03-11T00:00:00.000Z" },
    ],
    showDeletedRows: false,
    setShowDeletedRows: vi.fn(),
    query: "acme",
    setQuery: vi.fn(),
    quickMST: "0101",
    setQuickMST: vi.fn(),
    quickCompany: "Acme",
    setQuickCompany: vi.fn(),
    statusFilters: ["new"],
    setStatusFilters: vi.fn(),
    page: 2,
    setPage: vi.fn(),
    mode: "saved",
    setMode: vi.fn(),
    selectedFile: "decl.xlsx",
    setSelectedFile: vi.fn(),
    selectedKeys: ["row-1"],
    setSelectedKeys: vi.fn(),
    hasUnsaved: false,
    setHasUnsaved: vi.fn(),
    overwrite: false,
    setOverwrite: vi.fn(),
    upsert11: true,
    autoAssignStaff: true,
    rowDiffMap: new Map(),
    updateBaselineSnapshot: vi.fn(),
    keyOfRow: vi.fn((row) => row?.id ?? ""),
    ...overrides,
  };
}

describe("useDataImporterSessionController", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useFilterPresets.mockReturnValue({
      presets: [{ id: "preset-1", name: "Preset 1" }],
      loading: false,
      error: "",
      clearError: vi.fn(),
      refresh: vi.fn(),
      createPreset: vi.fn(),
      updatePreset: vi.fn(),
      deletePreset: vi.fn(),
    });

    useDataImporterDisplayPreferences.mockReturnValue({
      pageSize: 50,
      setPageSize: vi.fn(),
      pageSizeMode: "preset",
      setPageSizeMode: vi.fn(),
      pageSizeCustomInput: "",
      setPageSizeCustomInput: vi.fn(),
      viewMode: "table",
      setViewMode: vi.fn(),
      freezeColumnsEnabled: true,
      setFreezeColumnsEnabled: vi.fn(),
      cardGridColumns: 3,
      setCardGridColumns: vi.fn(),
    });

    useDataImporterRowHistory.mockReturnValue({
      rowHistoryExpanded: {},
      rowHistoryEntries: {},
      setRowHistoryExpanded: vi.fn(),
      setRowHistoryEntries: vi.fn(),
      refreshRowHistory: vi.fn(),
      handleToggleHistory: vi.fn(),
    });

    useDataImporterEditAccess.mockReturnValue({
      agencyOptions: [{ label: "Agency A", value: "agency-a" }],
      blockedEditNoticeRef: { current: new Set() },
      canAutoReconcile: true,
      editingRestrictionMessage: "blocked",
      isAdminRole: false,
      isRowEditable: vi.fn(() => true),
      memberTeamMap: {},
      rosterTeams: ["OPS"],
      sanitizeRowUpdates: vi.fn((row, updates) => updates),
    });

    useDataImporterColumnConfig.mockReturnValue({
      columnWidths: {},
      columnConfigOpen: false,
      columnDraftHidden: [],
      columnDraftError: "",
      columnHiddenSet: new Set(),
      totalBaseColumns: 10,
      totalConfigColumns: 12,
      visibleColumnCount: 10,
      setColumnConfigOpen: vi.fn(),
      setColumnDraftHidden: vi.fn(),
      setColumnDraftError: vi.fn(),
      registerHeaderRef: vi.fn(),
      renderResizeHandle: vi.fn(() => null),
      handleToggleColumnDraft: vi.fn(),
      handleApplyColumnConfig: vi.fn(),
      handleResetColumnConfig: vi.fn(),
    });

    useDataImporterDeletedRows.mockReturnValue({
      deletedDialogOpen: false,
      hardDeletedLoading: false,
      hardDeletedError: "",
      deletedEntries: [{ key: "row-2" }],
      softDeletedCount: 1,
      hardDeletedCount: 0,
      deletedTotalCount: 1,
      deletedRangeLabel: "range",
      openDeletedDialog: vi.fn(),
      handleDeletedDialogOpenChange: vi.fn(),
      handleHardDeletedRetry: vi.fn(),
    });

    useDataImporterImportPreview.mockReturnValue({
      effectivePreviewRows: [{ id: "preview-1" }],
      canUploadFiles: true,
      canOverwriteData: true,
      importPreview: { totalRows: 1 },
    });

    useDataImporterListPreferences.mockReturnValue({
      handleOpenColumnConfig: vi.fn(),
      handleToolbarViewModeChange: vi.fn(),
      handleToolbarFreezeColumnsEnabledChange: vi.fn(),
      handleToolbarCardGridColumnsChange: vi.fn(),
      handleToolbarPageSizeSelect: vi.fn(),
      handleToolbarPageSizeCustomInput: vi.fn(),
      handleToolbarToggleShowDeletedRows: vi.fn(),
      handleOverwriteToggle: vi.fn(),
    });

    useDataImporterActionGuards.mockReturnValue({
      filterEditableKeys: vi.fn((keys) => keys),
      filterHardDeleteKeys: vi.fn((keys) => keys),
      ensureEditableKeys: vi.fn((keys) => keys),
      ensureHardDeleteKeys: vi.fn((keys) => keys),
    });

    useDataImporterFilterPresets.mockReturnValue({
      selectedPresetId: "preset-1",
      appliedPreset: { id: "preset-1" },
      appliedPresetUpdatedAt: "2026-03-11T00:00:00.000Z",
      presetSaving: false,
      presetBusy: false,
      handleSelectPreset: vi.fn(),
      handleApplySelectedPreset: vi.fn(),
      handleSavePresetAsNew: vi.fn(),
      handleOverwriteSelectedPreset: vi.fn(),
      handleDeleteSelectedPreset: vi.fn(),
      handleRefreshPresetList: vi.fn(),
    });

    useDataImporterLicenseSummary.mockReturnValue({
      licenseExcludeSet: new Set(),
      licenseAgencyExcludeMap: new Map(),
      getLicenseExcludeSetForRow: vi.fn(() => new Set()),
      summarizeLicenseSnapshot: vi.fn(() => ({ includedCodes: [] })),
    });

    useDataImporterCoMonitoring.mockReturnValue({
      coCodeConfig: {},
      coCodeForm: {},
      setCoCodeForm: vi.fn(),
      coCodeLoading: false,
      coCodeSaving: false,
      coCodeError: "",
      coCodeMessage: "",
      handleSaveCoCodeConfig: vi.fn(),
      handleResetCoCodeForm: vi.fn(),
      handleRefreshCoCodeConfig: vi.fn(),
      coCodeUpdatedLabel: "11/03",
      coDiscrepancyState: {},
      coDiscrepancyForm: {},
      setCoDiscrepancyForm: vi.fn(),
      coDiscrepancyRange: { from: "", to: "" },
      setCoDiscrepancyRange: vi.fn(),
      coDiscrepancyLoading: false,
      coDiscrepancySaving: false,
      coDiscrepancyRunning: false,
      coDiscrepancyError: "",
      coDiscrepancyMessage: "",
      handleSaveCoDiscrepancyConfig: vi.fn(),
      handleResetCoDiscrepancyForm: vi.fn(),
      handleRunCoDiscrepancy: vi.fn(),
      handleRefreshCoDiscrepancy: vi.fn(),
      coMismatchKeySet: new Set(["row-1"]),
      coMismatchPreview: [{ id: "row-1" }],
      coMismatchCount: 1,
      coCheckedCount: 3,
      coMismatchLimited: false,
      coDiscrepancyRangeLabel: "range",
      coDiscrepancyLastRunLabel: "11/03",
      coDiscrepancyStatusLabel: "ok",
    });

    useDataImporterWorkflowSession.mockReturnValue({
      loadSavedRows: vi.fn(),
      syncConfig: { enabled: true },
      syncForm: { enabled: true },
      setSyncForm: vi.fn(),
      syncLoading: false,
      syncRunning: false,
      syncMessage: "ok",
      syncError: "",
      manualRange: { from: "", to: "" },
      handleManualRangeChange: vi.fn(),
      alertSummary: { outstanding: 1 },
      alertLoading: false,
      statusInfo: { backend: { ok: true } },
      statusLoading: false,
      statusError: "",
      previewRows: [{ id: "preview-1" }],
      previewLimited: false,
      previewLoading: false,
      previewError: "",
      previewRangeInfo: null,
      previewRangeLabel: "range",
      mstFilterNotice: "",
      fetchSyncConfig: vi.fn(),
      fetchSyncStatus: vi.fn(),
      fetchAlerts: vi.fn(),
      handleSaveSyncConfig: vi.fn(),
      handleRunSync: vi.fn(),
      handlePreviewSync: vi.fn(),
      handleFileChange: vi.fn(),
      handleImport: vi.fn(),
      applyRangePreset: vi.fn(),
      handleRefreshAlerts: vi.fn(),
      handleMarkReviewed: vi.fn(),
      handleUnmarkReviewed: vi.fn(),
      outstandingAlerts: [{ id: "alert-1" }],
      summaryCards: [{ label: "alerts" }],
      lastAlertEvaluated: "2026-03-11T00:00:00.000Z",
      syncLastRunLabel: "11/03",
      lastSyncSummary: { imported: 2 },
      lastSyncRangeLabel: "range",
      lastSyncRunAtLabel: "runAt",
    });

    useDataImporterQueryFilters.mockReturnValue({
      queryFilterControlsProps: { query: "acme" },
    });
  });

  it("wires child controllers and returns session bundles for the parent importer", () => {
    const props = createProps();

    const { result } = renderHook(() => useDataImporterSessionController(props));

    expect(useDataImporterSyncStatusToast).toHaveBeenCalledWith(
      expect.objectContaining({
        notifyError: expect.any(Function),
      }),
    );
    expect(useDataImporterWorkflowSession).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "sam",
        canReviewAlerts: true,
        handleRefreshCoDiscrepancy:
          useDataImporterCoMonitoring.mock.results[0].value.handleRefreshCoDiscrepancy,
      }),
    );
    expect(useDataImporterQueryFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "acme",
        mainSearchHelpTextId: "search-help",
      }),
    );

    expect(result.current.actor).toBe("sam");
    expect(result.current.canReviewAlerts).toBe(true);
    expect(result.current.canViewSavedRows).toBe(true);
    expect(result.current.deletedRowCount).toBe(1);
    expect(result.current.queryFilterControlsProps).toEqual({ query: "acme" });
    expect(result.current.agencyOptions).toEqual([{ label: "Agency A", value: "agency-a" }]);
    expect(result.current.summaryCards).toEqual([{ label: "alerts" }]);
  });

  it("derives read-only and saved-view flags correctly when edit access is disabled", () => {
    const props = createProps({
      canEdit: false,
      canManageAlerts: false,
      canManageSync: true,
      canImportUpload: false,
      currentUser: null,
    });

    const { result } = renderHook(() => useDataImporterSessionController(props));

    expect(result.current.actor).toBe("guest");
    expect(result.current.isReadOnlyForEdits).toBe(true);
    expect(result.current.canReviewAlerts).toBe(false);
    expect(result.current.canViewSavedRows).toBe(true);
    expect(result.current.reviewLockMessage).toContain("rà soát");
    expect(result.current.isRowReviewLocked({ reviewed: true })).toBe(true);
    expect(result.current.isRowReviewLocked({ reviewed: false })).toBe(false);
  });
});
