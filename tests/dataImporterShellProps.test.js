import { describe, expect, it, vi } from "vitest";

import createDataImporterShellProps from "@/components/dataImporter/dataImporterShellProps.js";

describe("dataImporterShellProps", () => {
  it("builds preview-mode file, grid, duplicate, and list props", () => {
    const setPage = vi.fn();
    const fileInputRef = { current: { click: vi.fn() } };
    const onFileChange = vi.fn();
    const onImport = vi.fn();
    const onPreviewSync = vi.fn();
    const onRunSync = vi.fn();
    const onLoadSavedRows = vi.fn();
    const onOpenDeletedList = vi.fn();
    const onChangeViewMode = vi.fn();
    const onChangeFreezeColumnsEnabled = vi.fn();
    const onChangeCardGridColumns = vi.fn();
    const onChangePageSizeSelect = vi.fn();
    const onChangePageSizeCustomInput = vi.fn();
    const onToggleShowDeletedRows = vi.fn();
    const onSaveAll = vi.fn();
    const onAutoAssignStaffChange = vi.fn();
    const onUpsert11Change = vi.fn();
    const onOverwriteToggle = vi.fn();
    const onOpenColumnConfig = vi.fn();

    const props = createDataImporterShellProps({
      columnDraftHidden: new Set(["c1", "c2", "c3", "c4"]),
      totalConfigColumns: 4,
      isReadOnlyForEdits: false,
      mode: "preview",
      effectivePreviewRows: [{ id: "preview-1" }],
      importPreview: { error: "" },
      canEdit: true,
      rawRowsLength: 10,
      selectedFile: "input.xlsx",
      canViewSavedRows: true,
      syncPreviewRows: [{ id: "sync-preview-1" }],
      previewLoading: false,
      syncRunning: false,
      fileInputRef,
      onFileChange,
      onImport,
      onPreviewSync,
      onRunSync,
      onLoadSavedRows,
      onOpenDeletedList,
      canUploadFiles: true,
      canManageSync: true,
      selectedPresetId: "preset-1",
      savedPresets: [{ id: "preset-1" }],
      presetBusy: false,
      presetSaving: false,
      presetLoading: false,
      presetError: "",
      appliedPreset: { id: "preset-1" },
      appliedPresetUpdatedAt: "2026-03-11T10:00:00.000Z",
      onSelectPreset: vi.fn(),
      onApplySelectedPreset: vi.fn(),
      onSavePresetAsNew: vi.fn(),
      onOverwriteSelectedPreset: vi.fn(),
      onDeleteSelectedPreset: vi.fn(),
      onRefreshPresetList: vi.fn(),
      onClearPresetError: vi.fn(),
      filterDuplicate11: true,
      hasDuplicate11Rows: true,
      duplicate11GroupCount: 2,
      duplicate11PlannedRemovalCount: 3,
      duplicate11PlannedReviewGroups: 1,
      duplicate11TotalRows: 6,
      filteredKeyCount: 4,
      canAutoReconcile: true,
      onToggleDuplicateFilter: vi.fn(),
      onDeleteDuplicates11: vi.fn(),
      onAutoApplyLicenseExclusion: vi.fn(),
      deleteEnabled: true,
      shouldUseServerSearch: true,
      serverSearchState: { loading: false },
      total: 24,
      safePage: 3,
      maxPage: 6,
      viewMode: "table",
      freezeColumnsEnabled: true,
      appliedCardColumns: 4,
      effectiveCardColumns: 3,
      cardGridColumnOptions: [{ value: 3 }],
      pageSize: 25,
      pageSizeMode: "preset",
      pageSizeCustomInput: "",
      pageSizeOptions: [25, 50],
      showDeletedRows: false,
      deletedRowCount: 2,
      canSave: false,
      onChangeViewMode,
      onChangeFreezeColumnsEnabled,
      onChangeCardGridColumns,
      onChangePageSizeSelect,
      onChangePageSizeCustomInput,
      onToggleShowDeletedRows,
      setPage,
      onSaveAll,
      autoAssignStaff: true,
      upsert11: true,
      overwrite: false,
      query: "A12",
      visibleColumnCount: 8,
      totalBaseColumns: 12,
      selectionEnabled: true,
      queryFilterControlsProps: { query: "A12" },
      selectionActionsProps: { selectedCount: 2 },
      onAutoAssignStaffChange,
      onUpsert11Change,
      onOverwriteToggle,
      onOpenColumnConfig,
      hasUnsaved: true,
    });

    expect(props.columnDraftVisibleCount).toBe(1);
    expect(props.canImport).toBe(true);
    expect(props.importDisabledReason).toBe("");
    expect(props.canSave).toBe(false);
    expect(props.canResolveDuplicates11).toBe(true);

    expect(props.fileActionsProps).toMatchObject({
      fileInputRef,
      onFileChange,
      onImport,
      onLoadSavedRows,
      onOpenDeletedList,
      canEdit: true,
      canImport: true,
      importDisabledReason: "",
      canViewSavedRows: true,
      selectedFile: "input.xlsx",
      modeLabel: "Đang xem dữ liệu từ file (chưa lưu)",
    });

    expect(props.filterPresetControlsProps.selectedPresetId).toBe("preset-1");
    expect(props.workflowGuideProps).toMatchObject({
      mode: "preview",
      canEdit: true,
      canImport: true,
      canSave: false,
      canUploadFiles: true,
      canManageSync: true,
      selectedFile: "input.xlsx",
      previewRowCount: 1,
      syncPreviewRowCount: 1,
      previewLoading: false,
      syncRunning: false,
      hasRows: true,
      hasUnsaved: true,
      onOpenFilePicker: expect.any(Function),
      onImport,
      onPreviewSync,
      onRunSync,
      onLoadSavedRows,
      onSaveAll,
    });
    expect(props.duplicateWorkflowControlsProps).toMatchObject({
      filterDuplicate11: true,
      hasDuplicate11Rows: true,
      canResolveDuplicates11: true,
      duplicate11PlannedRemovalCount: 3,
      filteredKeyCount: 4,
      onToggleDuplicateFilter: expect.any(Function),
    });

    props.gridToolbarControlsProps.onPreviousPage();
    props.gridToolbarControlsProps.onNextPage();
    expect(setPage).toHaveBeenCalledTimes(2);
    expect(setPage.mock.calls[0][0](3)).toBe(2);
    expect(setPage.mock.calls[1][0](5)).toBe(6);

    expect(props.listControlsPanelProps).toMatchObject({
      mode: "preview",
      total: 24,
      query: "A12",
      visibleColumnCount: 8,
      totalBaseColumns: 12,
      selectionEnabled: true,
      autoAssignStaff: true,
      upsert11: true,
      overwrite: false,
      queryFilterControlsProps: { query: "A12" },
      selectionActionsProps: { selectedCount: 2 },
      onAutoAssignStaffChange,
      onUpsert11Change,
      onOverwriteToggle,
      onOpenColumnConfig,
    });
  });

  it("switches mode labels and disables preview import when data is invalid", () => {
    const props = createDataImporterShellProps({
      columnDraftHidden: new Set(),
      totalConfigColumns: 3,
      isReadOnlyForEdits: true,
      mode: "saved",
      effectivePreviewRows: [],
      importPreview: { error: "preview-error" },
      canEdit: false,
      rawRowsLength: 0,
      selectedFile: "",
      canViewSavedRows: false,
      syncPreviewRows: [],
      previewLoading: false,
      syncRunning: false,
      fileInputRef: { current: null },
      onFileChange: vi.fn(),
      onImport: vi.fn(),
      onPreviewSync: vi.fn(),
      onRunSync: vi.fn(),
      onLoadSavedRows: vi.fn(),
      onOpenDeletedList: vi.fn(),
      canUploadFiles: false,
      canManageSync: false,
      selectedPresetId: "",
      savedPresets: [],
      presetBusy: false,
      presetSaving: false,
      presetLoading: false,
      presetError: "",
      appliedPreset: null,
      appliedPresetUpdatedAt: "",
      onSelectPreset: vi.fn(),
      onApplySelectedPreset: vi.fn(),
      onSavePresetAsNew: vi.fn(),
      onOverwriteSelectedPreset: vi.fn(),
      onDeleteSelectedPreset: vi.fn(),
      onRefreshPresetList: vi.fn(),
      onClearPresetError: vi.fn(),
      filterDuplicate11: false,
      hasDuplicate11Rows: false,
      duplicate11GroupCount: 0,
      duplicate11PlannedRemovalCount: 0,
      duplicate11PlannedReviewGroups: 0,
      duplicate11TotalRows: 0,
      filteredKeyCount: 0,
      canAutoReconcile: false,
      onToggleDuplicateFilter: vi.fn(),
      onDeleteDuplicates11: vi.fn(),
      onAutoApplyLicenseExclusion: vi.fn(),
      deleteEnabled: false,
      shouldUseServerSearch: false,
      serverSearchState: null,
      total: 0,
      safePage: 1,
      maxPage: 1,
      viewMode: "card",
      freezeColumnsEnabled: false,
      appliedCardColumns: 2,
      effectiveCardColumns: 2,
      cardGridColumnOptions: [],
      pageSize: 25,
      pageSizeMode: "preset",
      pageSizeCustomInput: "",
      pageSizeOptions: [25],
      showDeletedRows: false,
      deletedRowCount: 0,
      canSave: false,
      onChangeViewMode: vi.fn(),
      onChangeFreezeColumnsEnabled: vi.fn(),
      onChangeCardGridColumns: vi.fn(),
      onChangePageSizeSelect: vi.fn(),
      onChangePageSizeCustomInput: vi.fn(),
      onToggleShowDeletedRows: vi.fn(),
      setPage: vi.fn(),
      onSaveAll: vi.fn(),
      autoAssignStaff: false,
      upsert11: false,
      overwrite: true,
      query: "",
      visibleColumnCount: 0,
      totalBaseColumns: 0,
      selectionEnabled: false,
      queryFilterControlsProps: {},
      selectionActionsProps: {},
      onAutoAssignStaffChange: vi.fn(),
      onUpsert11Change: vi.fn(),
      onOverwriteToggle: vi.fn(),
      onOpenColumnConfig: vi.fn(),
      hasUnsaved: false,
    });

    expect(props.canImport).toBe(false);
    expect(props.importDisabledReason).not.toBe("");
    expect(props.canSave).toBe(false);
    expect(props.workflowGuideProps).toMatchObject({
      mode: "saved",
      canEdit: false,
      canImport: false,
      canSave: false,
      canUploadFiles: false,
      canManageSync: false,
      selectedFile: "",
      previewRowCount: 0,
      syncPreviewRowCount: 0,
      previewLoading: false,
      syncRunning: false,
      hasRows: false,
      hasUnsaved: false,
      onOpenFilePicker: expect.any(Function),
    });
    expect(props.fileActionsProps.modeLabel).toBe("Đang xem dữ liệu đã lưu");
    expect(props.fileActionsProps.importDisabledReason).toBe(props.importDisabledReason);
    expect(props.duplicateWorkflowControlsProps.canResolveDuplicates11).toBe(false);
    expect(props.columnDraftVisibleCount).toBe(3);
  });

  it("marks sync review mode and disables file import actions for ECUS preview", () => {
    const props = createDataImporterShellProps({
      columnDraftHidden: new Set(),
      totalConfigColumns: 4,
      isReadOnlyForEdits: false,
      mode: "preview",
      previewSource: "sync",
      effectivePreviewRows: [{ id: "sync-row-1" }],
      importPreview: { error: "" },
      canEdit: true,
      rawRowsLength: 2,
      selectedFile: "",
      canViewSavedRows: true,
      canUploadFiles: true,
      canManageSync: true,
      syncPreviewRows: [{ id: "sync-row-1" }],
      previewLoading: false,
      syncRunning: false,
      fileInputRef: { current: { click: vi.fn() } },
      onFileChange: vi.fn(),
      onImport: vi.fn(),
      onPreviewSync: vi.fn(),
      onRunSync: vi.fn(),
      onLoadSavedRows: vi.fn(),
      onOpenDeletedList: vi.fn(),
      selectedPresetId: "",
      savedPresets: [],
      presetBusy: false,
      presetSaving: false,
      presetLoading: false,
      presetError: "",
      appliedPreset: null,
      appliedPresetUpdatedAt: "",
      onSelectPreset: vi.fn(),
      onApplySelectedPreset: vi.fn(),
      onSavePresetAsNew: vi.fn(),
      onOverwriteSelectedPreset: vi.fn(),
      onDeleteSelectedPreset: vi.fn(),
      onRefreshPresetList: vi.fn(),
      onClearPresetError: vi.fn(),
      filterDuplicate11: false,
      hasDuplicate11Rows: false,
      duplicate11GroupCount: 0,
      duplicate11PlannedRemovalCount: 0,
      duplicate11PlannedReviewGroups: 0,
      duplicate11TotalRows: 0,
      filteredKeyCount: 0,
      canAutoReconcile: false,
      onToggleDuplicateFilter: vi.fn(),
      onDeleteDuplicates11: vi.fn(),
      onAutoApplyLicenseExclusion: vi.fn(),
      deleteEnabled: false,
      shouldUseServerSearch: false,
      serverSearchState: null,
      total: 2,
      safePage: 1,
      maxPage: 1,
      viewMode: "table",
      freezeColumnsEnabled: false,
      appliedCardColumns: 2,
      effectiveCardColumns: 2,
      cardGridColumnOptions: [],
      pageSize: 25,
      pageSizeMode: "preset",
      pageSizeCustomInput: "",
      pageSizeOptions: [25],
      showDeletedRows: false,
      deletedRowCount: 0,
      canSave: false,
      onChangeViewMode: vi.fn(),
      onChangeFreezeColumnsEnabled: vi.fn(),
      onChangeCardGridColumns: vi.fn(),
      onChangePageSizeSelect: vi.fn(),
      onChangePageSizeCustomInput: vi.fn(),
      onToggleShowDeletedRows: vi.fn(),
      setPage: vi.fn(),
      onSaveAll: vi.fn(),
      autoAssignStaff: true,
      upsert11: true,
      overwrite: true,
      canOverwriteData: true,
      query: "",
      visibleColumnCount: 6,
      totalBaseColumns: 10,
      selectionEnabled: true,
      queryFilterControlsProps: {},
      selectionActionsProps: {},
      onAutoAssignStaffChange: vi.fn(),
      onUpsert11Change: vi.fn(),
      onOverwriteToggle: vi.fn(),
      onOpenColumnConfig: vi.fn(),
      hasUnsaved: false,
    });

    expect(props.canImport).toBe(false);
    expect(props.importDisabledReason).toContain("Đồng bộ ngay");
    expect(props.fileActionsProps.modeLabel).toBe("Đang rà soát xem trước đồng bộ ECUS");
    expect(props.fileActionsProps.canImport).toBe(false);
    expect(props.fileActionsProps.importDisabledReason).toContain("Đồng bộ ngay");
    expect(props.workflowGuideProps.previewSource).toBe("sync");
    expect(props.listControlsPanelProps.previewSource).toBe("sync");
  });
});
