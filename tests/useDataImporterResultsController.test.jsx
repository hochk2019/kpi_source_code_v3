import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@/components/dataImporter/useDataImporterRowEditing.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterAssignments.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterRowMutations.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterSelectionActions.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterRowPresentation.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterLayout.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterSelectionBulkActions.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/dataImporterResultsProps.js", () => ({
  default: vi.fn(),
}));

import useDataImporterAssignments from "@/components/dataImporter/useDataImporterAssignments.js";
import useDataImporterLayout from "@/components/dataImporter/useDataImporterLayout.js";
import createDataImporterResultsProps from "@/components/dataImporter/dataImporterResultsProps.js";
import useDataImporterResultsController from "@/components/dataImporter/useDataImporterResultsController.js";
import useDataImporterRowEditing from "@/components/dataImporter/useDataImporterRowEditing.js";
import useDataImporterRowMutations from "@/components/dataImporter/useDataImporterRowMutations.js";
import useDataImporterRowPresentation from "@/components/dataImporter/useDataImporterRowPresentation.js";
import useDataImporterSelectionActions from "@/components/dataImporter/useDataImporterSelectionActions.js";
import useDataImporterSelectionBulkActions from "@/components/dataImporter/useDataImporterSelectionBulkActions.js";

function createProps(overrides = {}) {
  return {
    actor: "guest",
    mode: "saved",
    canEdit: false,
    canManageAlerts: true,
    isReadOnlyForEdits: true,
    shouldUseServerSearch: false,
    rawRows: [{ id: "row-1", reviewed: false }],
    pageRows: [{ id: "row-1", reviewed: false }],
    filteredKeys: ["row-1"],
    selectedKeys: ["row-1"],
    rowDiffMap: {},
    rowSaveStatus: {},
    rowHistoryEntries: {},
    rowHistoryExpanded: {},
    updatedKeySet: new Set(["row-1"]),
    coMismatchKeySet: new Set(),
    duplicate11KeeperSet: new Set(),
    duplicate11DuplicatesSet: new Set(),
    rosterTeams: ["OPS"],
    agencyOptions: [{ label: "Agency A", value: "agency-a" }],
    columnHiddenSet: new Set(),
    columnWidths: {},
    freezeColumnsEnabled: false,
    cardGridColumns: 3,
    containerWidth: 1200,
    visibleColumnCount: 8,
    formatDisplayDate: vi.fn((value) => `fmt:${value}`),
    renderResizeHandle: vi.fn(() => null),
    registerHeaderRef: vi.fn(),
    handleToggleHistory: vi.fn(),
    handleSaveRowChanges: vi.fn(),
    summarizeLicenseSnapshot: vi.fn(() => ({ includedCodes: [], excludedCodes: [] })),
    handleMarkReviewed: vi.fn(),
    handleUnmarkReviewed: vi.fn(),
    handleApplyLicenseExclusion: vi.fn(),
    keyOfRow: vi.fn((row) => row?.id ?? ""),
    normalizeStr: vi.fn((value) => value),
    normalizeName: vi.fn((value) => value),
    editingRestrictionMessage: "Không thể sửa dòng này.",
    reviewLockMessage: "Đã rà soát.",
    blockedEditNoticeRef: { current: new Set() },
    isRowEditable: vi.fn(() => true),
    isRowReviewLocked: vi.fn(() => false),
    sanitizeRowUpdates: vi.fn((row, updates) => updates),
    setServerSearchState: vi.fn(),
    setHasUnsaved: vi.fn(),
    setPage: vi.fn(),
    setSelectedKeys: vi.fn(),
    setRawRows: vi.fn(),
    memberTeamMap: {},
    ensureEditableKeys: vi.fn((keys) => keys),
    ensureHardDeleteKeys: vi.fn((keys) => keys),
    filterEditableKeys: vi.fn((keys) => keys),
    filterHardDeleteKeys: vi.fn((keys) => keys),
    loadSavedRows: vi.fn(),
    fetchAlerts: vi.fn(),
    softDeleteDeclRows: vi.fn(),
    hardDeleteDeclRows: vi.fn(),
    restoreDeclRows: vi.fn(),
    pushAuditLog: vi.fn(),
    canReviewAlerts: true,
    xlsx: { writeFile: vi.fn() },
    toast: { success: vi.fn(), error: vi.fn() },
    ...overrides,
  };
}

describe("useDataImporterResultsController", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useDataImporterRowEditing.mockReturnValue({
      applyEdit: vi.fn(),
    });

    useDataImporterAssignments.mockReturnValue({
      handleSelectStaff: vi.fn(),
      handleSelectTeam: vi.fn(),
      handleSelectAgency: vi.fn(),
    });

    useDataImporterRowMutations.mockReturnValue({
      handleDeleteSelected: vi.fn(),
      handleHardDeleteSelected: vi.fn(),
      handleDeleteSingle: vi.fn(),
      handleHardDeleteSingle: vi.fn(),
      handleRestoreSingle: vi.fn(),
    });

    useDataImporterSelectionActions.mockReturnValue({
      filteredSelected: false,
      selectedReviewedCount: 0,
      handleToggleSelect: vi.fn(),
      handleClearSelection: vi.fn(),
      handleSelectFiltered: vi.fn(),
    });

    useDataImporterRowPresentation.mockReturnValue({
      buildRowState: vi.fn(() => ({ tone: "ok" })),
      handleCardLicenseCountChange: vi.fn(),
      getCardCoDisplay: vi.fn(() => "co"),
      getCardKpiDisplay: vi.fn(() => "kpi"),
    });

    useDataImporterLayout.mockReturnValue({
      getColumnStyle: vi.fn(() => ({})),
      frozenOffsets: {},
      getFrozenStyle: vi.fn(() => ({})),
      historyIndent: 12,
      effectiveCardColumns: 4,
      appliedCardColumns: 4,
      cardGridStyle: { gridTemplateColumns: "repeat(4, 1fr)" },
      totalColumns: 9,
      frozenHeaderClass: "frozen-header",
      frozenCellClass: "frozen-cell",
    });

    useDataImporterSelectionBulkActions.mockReturnValue({
      selectionActionsProps: {
        selectedCount: 1,
      },
    });

    createDataImporterResultsProps.mockReturnValue({
      tableResultsProps: { kind: "table" },
      cardResultsProps: { kind: "card" },
    });
  });

  it("wires saved-mode results controllers and exposes shell-facing flags", () => {
    const props = createProps();

    const { result } = renderHook(() => useDataImporterResultsController(props));

    expect(useDataImporterSelectionActions).toHaveBeenCalledWith(
      expect.objectContaining({
        selectionEnabled: true,
      }),
    );
    expect(useDataImporterLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        selectionEnabled: true,
        updateEnabled: false,
        deleteEnabled: false,
        historyEnabled: true,
      }),
    );
    expect(useDataImporterSelectionBulkActions).toHaveBeenCalledWith(
      expect.objectContaining({
        deleteEnabled: false,
        selectionEnabled: true,
      }),
    );
    expect(createDataImporterResultsProps).toHaveBeenCalledWith(
      expect.objectContaining({
        pageRows: props.pageRows,
        rosterTeams: props.rosterTeams,
        agencyOptions: props.agencyOptions,
      }),
    );

    expect(result.current.selectionEnabled).toBe(true);
    expect(result.current.deleteEnabled).toBe(false);
    expect(result.current.appliedCardColumns).toBe(4);
    expect(result.current.effectiveCardColumns).toBe(4);
    expect(result.current.tableResultsProps).toEqual({ kind: "table" });
    expect(result.current.cardResultsProps).toEqual({ kind: "card" });
    expect(result.current.selectionActionsProps).toEqual({ selectedCount: 1 });
  });

  it("turns off saved-mode affordances outside saved mode", () => {
    const props = createProps({
      mode: "preview",
      canEdit: true,
      canManageAlerts: true,
      columnHiddenSet: new Set(["history"]),
    });

    const { result } = renderHook(() => useDataImporterResultsController(props));

    expect(useDataImporterSelectionActions).toHaveBeenCalledWith(
      expect.objectContaining({
        selectionEnabled: false,
      }),
    );
    expect(useDataImporterLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        selectionEnabled: false,
        updateEnabled: false,
        deleteEnabled: false,
        historyEnabled: false,
      }),
    );
    expect(result.current.selectionEnabled).toBe(false);
    expect(result.current.deleteEnabled).toBe(false);
  });
});
