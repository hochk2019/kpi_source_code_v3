import { describe, expect, it, vi } from "vitest";

import createDataImporterContainerProps from "@/components/dataImporter/dataImporterContainerProps.js";

describe("createDataImporterContainerProps", () => {
  it("builds the top-level DataImporterShell prop tree from granular controller state", () => {
    const onClearSelection = vi.fn();
    const props = createDataImporterContainerProps({
      rootRef: { current: null },
      canUploadFiles: true,
      isReadOnlyForEdits: false,
      canManageAlerts: true,
      isAdminRole: true,
      mode: "saved",
      deletedDialog: {
        open: true,
        onOpenChange: vi.fn(),
        rangeLabel: "01-31",
        totalCount: 2,
        softDeletedCount: 1,
        hardDeletedCount: 1,
        hardDeletedLoading: false,
        hardDeletedError: "",
        onRetry: vi.fn(),
        entries: [{ key: "row-1" }],
        tableClassName: "zebra",
      },
      columnConfigDialog: {
        open: true,
        onOpenChange: vi.fn(),
        columnOptions: [{ id: "mst" }],
        hiddenColumnIds: ["staff"],
        visibleCount: 10,
        totalCount: 12,
        isAdminRole: true,
        sensitiveColumnIds: ["salary"],
        errorMessage: "",
        onToggleColumn: vi.fn(),
        onReset: vi.fn(),
        onApply: vi.fn(),
      },
      duplicateDiffDialog: {
        open: true,
        onOpenChange: vi.fn(),
        duplicateDiffGroup: [],
        duplicateDiffGroupLabel: "dup",
        duplicateDiffBaseLabel: "base",
        duplicateDiffCompareLabel: "compare",
        duplicateDiffBaseItem: { id: "a" },
        duplicateDiffCompareItem: { id: "b" },
        duplicateDiffChangedCount: 2,
        duplicateDiffGroups: [{ id: "g1" }],
        onChangeBase: vi.fn(),
        onChangeCompare: vi.fn(),
        onSwap: vi.fn(),
        onClose: vi.fn(),
      },
      duplicateReviewDialog: {
        open: true,
        onOpenChange: vi.fn(),
        duplicate11Details: [],
        duplicate11Plan: {},
        duplicate11PlanHasActions: true,
        duplicate11PlannedRemovalCount: 2,
        duplicate11PlannedDeleteGroups: ["g1"],
        duplicate11PlannedReviewGroups: ["g2"],
        duplicateReviewConfirmed: false,
        onConfirmedChange: vi.fn(),
        duplicateMergeFields: ["mst"],
        onChangeKeeper: vi.fn(),
        onOpenDuplicateDiff: vi.fn(),
        onChangeMerge: vi.fn(),
        onChangeResolution: vi.fn(),
        onChangeNote: vi.fn(),
        onClose: vi.fn(),
        onConfirm: vi.fn(),
      },
      summaryCards: [{ label: "Summary" }],
      cardSurfaceClass: "card",
      updatedRowsBanner: {
        isAdminRole: true,
        showUpdatedBanner: true,
        lastSyncUpdated: 3,
        lastSyncRunAtLabel: "11/03",
        updatedPreview: [{ key: "row-1" }],
        updatedDeclarations: ["TK1"],
        formatDeclarationLabel: vi.fn((value) => value),
        onSelectUpdated: vi.fn(),
        onClearSelection,
      },
      syncConfigPanelProps: { panel: "sync" },
      coCodeConfigProps: { panel: "co" },
      monitoringCoDiscrepancyProps: { panel: "co-discrepancy" },
      monitoringAlertsProps: { panel: "alerts" },
      formatDeclarationLabel: vi.fn((value) => value),
      formatDisplayDate: vi.fn((value) => value),
      fileActionsProps: { section: "file" },
      importPreview: { totalRows: 4 },
      errorReasonLabels: { missing: "Missing" },
      listControlsPanelProps: { section: "list" },
      viewMode: "table",
      tableResultsProps: { kind: "table" },
      cardResultsProps: { kind: "card" },
    });

    expect(props).toMatchObject({
      rootRef: { current: null },
      canUploadFiles: true,
      isReadOnlyForEdits: false,
      canManageAlerts: true,
      isAdminRole: true,
      mode: "saved",
      deletedRowsDialogProps: {
        totalCount: 2,
        tableClassName: "zebra",
      },
      summaryCardsProps: {
        cardSurfaceClass: "card",
      },
      monitoringPanelProps: {
        coDiscrepancy: { panel: "co-discrepancy" },
        alerts: { panel: "alerts" },
      },
      importPreviewSummaryProps: {
        importPreview: { totalRows: 4 },
        errorReasonLabels: { missing: "Missing" },
      },
      resultsPanelProps: {
        viewMode: "table",
        tableProps: { kind: "table" },
        cardProps: { kind: "card" },
      },
    });

    props.updatedRowsBannerProps.onClearSelection();
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });
});
