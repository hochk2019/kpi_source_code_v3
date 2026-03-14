import { describe, expect, it, vi } from "vitest";

import createDataImporterDialogProps from "@/components/dataImporter/dataImporterDialogProps.js";

describe("createDataImporterDialogProps", () => {
  it("maps importer dialog state into the container prop shape", () => {
    const handleDeletedDialogOpenChange = vi.fn();
    const handleHardDeletedRetry = vi.fn();
    const setColumnConfigOpen = vi.fn();
    const handleToggleColumnDraft = vi.fn();
    const handleResetColumnConfig = vi.fn();
    const handleApplyColumnConfig = vi.fn();
    const handleDuplicateDiffOpenChange = vi.fn();
    const handleChangeDuplicateDiffBase = vi.fn();
    const handleChangeDuplicateDiffCompare = vi.fn();
    const handleSwapDuplicateDiff = vi.fn();
    const handleCloseDuplicateDiff = vi.fn();
    const handleDuplicateReviewOpenChange = vi.fn();
    const setDuplicateReviewConfirmed = vi.fn();
    const handleChangeDuplicateKeeper = vi.fn();
    const handleOpenDuplicateDiff = vi.fn();
    const handleChangeDuplicateMerge = vi.fn();
    const handleChangeDuplicateResolution = vi.fn();
    const handleChangeDuplicateNote = vi.fn();
    const handleCloseDuplicateReview = vi.fn();
    const handleConfirmDuplicateRemoval = vi.fn();
    const handleSelectUpdated = vi.fn();
    const clearSelection = vi.fn();
    const formatDeclarationLabel = vi.fn((row) => row?.so_tk || "");

    const props = createDataImporterDialogProps({
      deletedDialogOpen: true,
      handleDeletedDialogOpenChange,
      deletedRangeLabel: "01/03 -> 05/03",
      deletedTotalCount: 2,
      softDeletedCount: 1,
      hardDeletedCount: 1,
      hardDeletedLoading: false,
      hardDeletedError: "",
      handleHardDeletedRetry,
      deletedEntries: [{ key: "soft:1" }],
      zebraTableBodyClass: "zebra",
      columnConfigOpen: true,
      setColumnConfigOpen,
      columnConfigOptions: [{ id: "company" }],
      columnDraftHidden: ["team"],
      columnDraftVisibleCount: 8,
      totalConfigColumns: 10,
      isAdminRole: true,
      sensitiveColumnSet: new Set(["agency"]),
      columnDraftError: "err",
      handleToggleColumnDraft,
      handleResetColumnConfig,
      handleApplyColumnConfig,
      duplicateDiffState: { open: true },
      handleDuplicateDiffOpenChange,
      duplicateDiffGroup: { id: "group-1" },
      duplicateDiffGroupLabel: "G1",
      duplicateDiffBaseLabel: "Base",
      duplicateDiffCompareLabel: "Compare",
      duplicateDiffBaseItem: { id: "base" },
      duplicateDiffCompareItem: { id: "compare" },
      duplicateDiffChangedCount: 3,
      duplicateDiffGroups: [{ id: "group-1" }],
      handleChangeDuplicateDiffBase,
      handleChangeDuplicateDiffCompare,
      handleSwapDuplicateDiff,
      handleCloseDuplicateDiff,
      duplicateReviewOpen: true,
      handleDuplicateReviewOpenChange,
      duplicate11Details: { groups: [] },
      duplicate11Plan: { actions: [] },
      duplicate11PlanHasActions: true,
      duplicate11PlannedRemovalCount: 4,
      duplicate11PlannedDeleteGroups: 2,
      duplicate11PlannedReviewGroups: 1,
      duplicateReviewConfirmed: true,
      setDuplicateReviewConfirmed,
      duplicateMergeFields: ["agency"],
      handleChangeDuplicateKeeper,
      handleOpenDuplicateDiff,
      handleChangeDuplicateMerge,
      handleChangeDuplicateResolution,
      handleChangeDuplicateNote,
      handleCloseDuplicateReview,
      handleConfirmDuplicateRemoval,
      showUpdatedBanner: true,
      lastSyncUpdated: 6,
      lastSyncRunAtLabel: "11/03/2026 21:00",
      updatedPreview: [{ so_tk: "TK-1" }],
      updatedDeclarations: [{ so_tk: "TK-1" }],
      formatDeclarationLabel,
      handleSelectUpdated,
      clearSelection,
    });

    expect(props.deletedDialog).toMatchObject({
      open: true,
      rangeLabel: "01/03 -> 05/03",
      totalCount: 2,
      softDeletedCount: 1,
      hardDeletedCount: 1,
      tableClassName: "zebra",
    });
    expect(props.deletedDialog.onOpenChange).toBe(handleDeletedDialogOpenChange);
    expect(props.deletedDialog.onRetry).toBe(handleHardDeletedRetry);

    expect(props.columnConfigDialog).toMatchObject({
      open: true,
      visibleCount: 8,
      totalCount: 10,
      isAdminRole: true,
      errorMessage: "err",
    });
    expect(props.columnConfigDialog.onOpenChange).toBe(setColumnConfigOpen);
    expect(props.columnConfigDialog.onToggleColumn).toBe(handleToggleColumnDraft);

    expect(props.duplicateDiffDialog).toMatchObject({
      open: true,
      duplicateDiffGroupLabel: "G1",
      duplicateDiffChangedCount: 3,
    });
    expect(props.duplicateDiffDialog.onSwap).toBe(handleSwapDuplicateDiff);

    expect(props.duplicateReviewDialog).toMatchObject({
      open: true,
      duplicate11PlanHasActions: true,
      duplicate11PlannedRemovalCount: 4,
      duplicateReviewConfirmed: true,
    });
    expect(props.duplicateReviewDialog.onConfirmedChange).toBe(setDuplicateReviewConfirmed);
    expect(props.duplicateReviewDialog.onConfirm).toBe(handleConfirmDuplicateRemoval);

    expect(props.updatedRowsBanner).toMatchObject({
      isAdminRole: true,
      showUpdatedBanner: true,
      lastSyncUpdated: 6,
      lastSyncRunAtLabel: "11/03/2026 21:00",
      updatedPreview: [{ so_tk: "TK-1" }],
    });
    expect(props.updatedRowsBanner.onSelectUpdated).toBe(handleSelectUpdated);
    expect(props.updatedRowsBanner.onClearSelection).toBe(clearSelection);
  });
});
