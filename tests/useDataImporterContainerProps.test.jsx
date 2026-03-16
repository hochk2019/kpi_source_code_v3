import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/store.js", async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    sortDeclRows: vi.fn((rows) => rows),
    pushAuditLog: vi.fn(),
    saveDeclRows: vi.fn(),
  };
});

vi.mock("@/components/dataImporter/useDataImporterBaselineSnapshot.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterContainerWidth.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterDuplicateWorkflow.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterResultsSurface.jsx", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterSessionController.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/dataImporterSyncPanelProps.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/dataImporterShellProps.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/dataImporterDialogProps.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/dataImporterContainerProps.js", () => ({
  default: vi.fn(),
}));

import createDataImporterContainerProps from "@/components/dataImporter/dataImporterContainerProps.js";
import createDataImporterDialogProps from "@/components/dataImporter/dataImporterDialogProps.js";
import createDataImporterShellProps from "@/components/dataImporter/dataImporterShellProps.js";
import createDataImporterSyncPanelProps from "@/components/dataImporter/dataImporterSyncPanelProps.js";
import useDataImporterBaselineSnapshot from "@/components/dataImporter/useDataImporterBaselineSnapshot.js";
import useDataImporterContainerProps from "@/components/dataImporter/useDataImporterContainerProps.js";
import useDataImporterContainerWidth from "@/components/dataImporter/useDataImporterContainerWidth.js";
import useDataImporterDuplicateWorkflow from "@/components/dataImporter/useDataImporterDuplicateWorkflow.js";
import useDataImporterResultsSurface from "@/components/dataImporter/useDataImporterResultsSurface.jsx";
import useDataImporterSessionController from "@/components/dataImporter/useDataImporterSessionController.js";

function createProps(overrides = {}) {
  return {
    currentUser: { username: "sam", role: "admin" },
    canEdit: true,
    canImportUpload: true,
    canManageSync: true,
    canManageAlerts: true,
    allowAdminUploadOverride: true,
    ...overrides,
  };
}

describe("useDataImporterContainerProps", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useDataImporterContainerWidth.mockReturnValue(1280);
    useDataImporterBaselineSnapshot.mockReturnValue({
      rowDiffMap: new Map([["row-1", { changed: true }]]),
      updateBaselineSnapshot: vi.fn(),
      commitRowToBaseline: vi.fn(),
    });
    useDataImporterSessionController.mockReturnValue({
      actor: "sam",
      isReadOnlyForEdits: false,
      canReviewAlerts: true,
      canViewSavedRows: true,
      agencyOptions: [{ value: "hq-1", label: "HQ 1" }],
      blockedEditNoticeRef: { current: new Set() },
      canAutoReconcile: true,
      editingRestrictionMessage: "",
      isAdminRole: true,
      isRowEditable: vi.fn(() => true),
      memberTeamMap: {},
      rosterTeams: ["OPS"],
      sanitizeRowUpdates: vi.fn((row, updates) => updates),
      rowSaveStatus: {},
      setRowSaveStatus: vi.fn(),
      rowHistoryExpanded: {},
      rowHistoryEntries: {},
      refreshRowHistory: vi.fn(),
      handleToggleHistory: vi.fn(),
      columnWidths: {},
      columnConfigOpen: false,
      columnDraftHidden: new Set(["deleted_at"]),
      columnDraftError: "",
      columnHiddenSet: new Set(["deleted_at"]),
      totalBaseColumns: 10,
      totalConfigColumns: 12,
      visibleColumnCount: 11,
      setColumnConfigOpen: vi.fn(),
      registerHeaderRef: vi.fn(),
      renderResizeHandle: vi.fn(),
      handleToggleColumnDraft: vi.fn(),
      handleApplyColumnConfig: vi.fn(),
      handleResetColumnConfig: vi.fn(),
      reviewLockMessage: "",
      isRowReviewLocked: vi.fn(() => false),
      filterDuplicate11: false,
      setFilterDuplicate11: vi.fn(),
      deletedRowCount: 2,
      normalizedFilters: { query: "acme" },
      deletedDialogOpen: false,
      hardDeletedLoading: false,
      hardDeletedError: "",
      deletedEntries: [{ key: "row-2" }],
      softDeletedCount: 1,
      hardDeletedCount: 1,
      deletedTotalCount: 2,
      deletedRangeLabel: "2026-03",
      openDeletedDialog: vi.fn(),
      handleDeletedDialogOpenChange: vi.fn(),
      handleHardDeletedRetry: vi.fn(),
      shouldUseServerSearch: false,
      pageResetKey: 0,
      effectivePreviewRows: [{ key: "preview-1" }],
      canUploadFiles: true,
      canOverwriteData: true,
      importPreview: { totalRows: 1 },
      pageSize: 25,
      pageSizeMode: "preset",
      pageSizeCustomInput: "",
      viewMode: "table",
      freezeColumnsEnabled: true,
      cardGridColumns: 3,
      handleOpenColumnConfig: vi.fn(),
      handleToolbarViewModeChange: vi.fn(),
      handleToolbarFreezeColumnsEnabledChange: vi.fn(),
      handleToolbarCardGridColumnsChange: vi.fn(),
      handleToolbarPageSizeSelect: vi.fn(),
      handleToolbarPageSizeCustomInput: vi.fn(),
      handleToolbarToggleShowDeletedRows: vi.fn(),
      handleOverwriteToggle: vi.fn(),
      filterEditableKeys: vi.fn((keys) => keys),
      filterHardDeleteKeys: vi.fn((keys) => keys),
      ensureEditableKeys: vi.fn((keys) => keys),
      ensureHardDeleteKeys: vi.fn((keys) => keys),
      selectedPresetId: "preset-1",
      appliedPreset: { id: "preset-1" },
      appliedPresetUpdatedAt: "2026-03-14T08:00:00.000Z",
      presetSaving: false,
      presetBusy: false,
      savedPresets: [{ id: "preset-1", name: "Preset 1" }],
      presetLoading: false,
      presetError: "",
      clearPresetError: vi.fn(),
      handleSelectPreset: vi.fn(),
      handleApplySelectedPreset: vi.fn(),
      handleSavePresetAsNew: vi.fn(),
      handleOverwriteSelectedPreset: vi.fn(),
      handleDeleteSelectedPreset: vi.fn(),
      handleRefreshPresetList: vi.fn(),
      licenseExcludeSet: new Set(["A11"]),
      licenseAgencyExcludeMap: {},
      getLicenseExcludeSetForRow: vi.fn(() => new Set(["A11"])),
      summarizeLicenseSnapshot: vi.fn(() => "A11"),
      coCodeConfig: { include: [] },
      coCodeForm: { include: "" },
      setCoCodeForm: vi.fn(),
      coCodeLoading: false,
      coCodeSaving: false,
      coCodeError: "",
      coCodeMessage: "",
      handleSaveCoCodeConfig: vi.fn(),
      handleResetCoCodeForm: vi.fn(),
      handleRefreshCoCodeConfig: vi.fn(),
      coCodeUpdatedLabel: "14/03",
      coDiscrepancyState: { lastRunAt: null },
      coDiscrepancyForm: { enabled: true },
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
      coMismatchPreview: [{ key: "row-1" }],
      coMismatchCount: 1,
      coCheckedCount: 4,
      coMismatchLimited: false,
      coDiscrepancyRangeLabel: "tháng này",
      coDiscrepancyLastRunLabel: "14/03",
      coDiscrepancyStatusLabel: "OK",
      loadSavedRows: vi.fn(),
      syncConfig: { enabled: true },
      syncForm: { enabled: true },
      setSyncForm: vi.fn(),
      syncLoading: false,
      syncRunning: false,
      syncMessage: "",
      syncError: "",
      manualRange: { from: "", to: "" },
      handleManualRangeChange: vi.fn(),
      alertSummary: { outstanding: 1 },
      alertLoading: false,
      statusInfo: { backend: { ok: true } },
      statusLoading: false,
      statusError: "",
      previewRows: [{ key: "sync-preview-1" }],
      previewLimited: false,
      previewLoading: false,
      previewError: "",
      previewRangeInfo: { from: "2026-03-01", to: "2026-03-02" },
      previewRangeLabel: "01/03 - 02/03",
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
      alertEntries: [{ id: "alert-full-1" }, { id: "alert-full-2" }, { id: "alert-full-3" }],
      outstandingAlerts: [{ id: "alert-1" }],
      summaryCards: [{ label: "Tổng cộng" }],
      lastAlertEvaluated: "2026-03-14T08:00:00.000Z",
      syncLastRunLabel: "14/03",
      lastSyncSummary: { imported: 2 },
      lastSyncRangeLabel: "tháng này",
      lastSyncRunAtLabel: "14/03",
      queryFilterControlsProps: { query: "acme" },
    });
    useDataImporterDuplicateWorkflow.mockReturnValue({
      duplicate11Summary: { groups: 1 },
      duplicate11GroupCount: 1,
      duplicate11TotalRows: 2,
      duplicate11DuplicatesSet: new Set(["row-1"]),
      duplicate11KeeperSet: new Set(["row-1"]),
      duplicate11Details: [{ groupId: "dup-1" }],
      hasDuplicate11Rows: true,
      lastSyncFetched: 3,
      lastSyncInserted: 1,
      lastSyncUpdated: 2,
      lastSyncSkipped: 0,
      lastSyncTotal: 3,
      updatedDeclarations: ["TK1"],
      updatedKeySet: new Set(["row-1"]),
      updatedPreview: [{ key: "row-1" }],
      showUpdatedBanner: true,
      handleSelectUpdated: vi.fn(),
      handleSelectCoMismatches: vi.fn(),
      handleToggleDuplicateFilter: vi.fn(),
      duplicateDiffState: { open: false },
      duplicateDiffGroup: [],
      duplicateDiffBaseItem: null,
      duplicateDiffCompareItem: null,
      duplicateDiffGroups: [],
      duplicateDiffChangedCount: 0,
      duplicateDiffGroupLabel: "Nhóm 1",
      duplicateDiffBaseLabel: "Giữ lại",
      duplicateDiffCompareLabel: "So sánh",
      handleOpenDuplicateDiff: vi.fn(),
      handleCloseDuplicateDiff: vi.fn(),
      handleChangeDuplicateDiffBase: vi.fn(),
      handleChangeDuplicateDiffCompare: vi.fn(),
      handleSwapDuplicateDiff: vi.fn(),
      handleDuplicateDiffOpenChange: vi.fn(),
      duplicateReviewOpen: false,
      duplicateReviewConfirmed: false,
      duplicate11Plan: {},
      duplicate11PlanHasActions: true,
      duplicate11PlannedDeleteGroups: ["dup-1"],
      duplicate11PlannedReviewGroups: ["dup-2"],
      duplicate11PlannedRemovalCount: 1,
      setDuplicateReviewConfirmed: vi.fn(),
      handleChangeDuplicateKeeper: vi.fn(),
      handleChangeDuplicateMerge: vi.fn(),
      handleChangeDuplicateResolution: vi.fn(),
      handleChangeDuplicateNote: vi.fn(),
      handleDeleteDuplicates11: vi.fn(),
      handleCloseDuplicateReview: vi.fn(),
      handleDuplicateReviewOpenChange: vi.fn(),
      handleConfirmDuplicateRemoval: vi.fn(),
    });
    useDataImporterResultsSurface.mockReturnValue({
      appliedCardColumns: 3,
      cardResultsProps: { kind: "card" },
      deleteEnabled: true,
      effectiveCardColumns: 3,
      filteredKeys: ["row-1"],
      handleAutoApplyLicenseExclusion: vi.fn(),
      handleSaveAll: vi.fn(),
      lastSyncSummaryCard: { label: "Đồng bộ gần nhất" },
      maxPage: 2,
      safePage: 1,
      selectionEnabled: true,
      selectionActionsProps: { selectedCount: 1 },
      serverSearchState: { loading: false },
      tableResultsProps: { kind: "table" },
      total: 1,
    });
    createDataImporterSyncPanelProps.mockReturnValue({
      coCodeConfigProps: { section: "co-code" },
      monitoringCoDiscrepancyProps: { section: "co-discrepancy" },
      monitoringAlertsProps: { section: "alerts" },
      syncConfigPanelProps: { section: "sync" },
    });
    createDataImporterShellProps.mockReturnValue({
      columnDraftVisibleCount: 11,
      workflowGuideProps: { section: "workflow" },
      fileActionsProps: { section: "file" },
      listControlsPanelProps: { section: "list" },
    });
    createDataImporterDialogProps.mockReturnValue({
      deletedDialog: { section: "deleted" },
      columnConfigDialog: { section: "column-config" },
      duplicateDiffDialog: { section: "duplicate-diff" },
      duplicateReviewDialog: { section: "duplicate-review" },
      updatedRowsBanner: { section: "updated-banner" },
    });
    createDataImporterContainerProps.mockReturnValue({
      rootRef: { current: null },
      workflowGuideProps: { section: "workflow" },
      resultsPanelProps: { section: "results" },
    });
  });

  it("wires session, duplicate, results, and prop-builder seams into final shell props", () => {
    const props = createProps();

    const { result } = renderHook(() => useDataImporterContainerProps(props));

    expect(useDataImporterSessionController).toHaveBeenCalledWith(
      expect.objectContaining({
        currentUser: props.currentUser,
        canEdit: true,
        canImportUpload: true,
        canManageSync: true,
        canManageAlerts: true,
        allowAdminUploadOverride: true,
        rawRows: [],
        showDeletedRows: false,
        selectedFile: "",
        previewSource: null,
        keyOfRow: expect.any(Function),
      }),
    );

    expect(useDataImporterDuplicateWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "sam",
        lastSyncSummary: { imported: 2 },
        coMismatchKeySet: new Set(["row-1"]),
        keyOfRow: expect.any(Function),
        setSelectedKeys: expect.any(Function),
      }),
    );

    expect(useDataImporterResultsSurface).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: "sam",
        containerWidth: 1280,
        duplicate11Summary: { groups: 1 },
        lastSyncSummary: { imported: 2 },
        updatedKeySet: new Set(["row-1"]),
        rawRows: [],
        selectedKeys: [],
      }),
    );

    expect(createDataImporterShellProps).toHaveBeenCalledWith(
      expect.objectContaining({
        filteredKeyCount: 1,
        queryFilterControlsProps: { query: "acme" },
        selectionActionsProps: { selectedCount: 1 },
        serverSearchState: { loading: false },
      }),
    );

    expect(createDataImporterContainerProps).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "saved",
        workflowGuideProps: { section: "workflow" },
        fileActionsProps: { section: "file" },
        listControlsPanelProps: { section: "list" },
        deletedDialog: { section: "deleted" },
        cardResultsProps: { kind: "card" },
        tableResultsProps: { kind: "table" },
      }),
    );

    expect(createDataImporterSyncPanelProps).toHaveBeenCalledWith(
      expect.objectContaining({
        alertEntries: [{ id: "alert-full-1" }, { id: "alert-full-2" }, { id: "alert-full-3" }],
      }),
    );

    expect(result.current).toEqual({
      rootRef: { current: null },
      workflowGuideProps: { section: "workflow" },
      resultsPanelProps: { section: "results" },
    });
  });
});
