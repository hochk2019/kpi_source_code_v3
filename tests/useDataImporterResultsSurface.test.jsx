import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/dataImporter/useDataImporterResultRows.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterSavedEdits.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterLicenseExclusions.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterResultsController.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/hooks/useTooltipTitles.js", () => ({
  default: vi.fn(),
}));

import useDataImporterLicenseExclusions from "@/components/dataImporter/useDataImporterLicenseExclusions.js";
import useDataImporterResultRows from "@/components/dataImporter/useDataImporterResultRows.js";
import useDataImporterResultsController from "@/components/dataImporter/useDataImporterResultsController.js";
import useDataImporterResultsSurface from "@/components/dataImporter/useDataImporterResultsSurface.jsx";
import useDataImporterSavedEdits from "@/components/dataImporter/useDataImporterSavedEdits.js";
import useTooltipTitles from "@/hooks/useTooltipTitles.js";

function createProps(overrides = {}) {
  return {
    actor: "guest",
    agencyOptions: [],
    blockedEditNoticeRef: { current: new Set() },
    canAutoReconcile: true,
    canEdit: true,
    canManageAlerts: true,
    canReviewAlerts: true,
    cardGridColumns: 3,
    coCodeConfig: { enabled: true },
    coDiscrepancyForm: { enabled: true },
    coDiscrepancyState: { enabled: true },
    coMismatchKeySet: new Set(),
    columnHiddenSet: new Set(),
    columnWidths: {},
    commitRowToBaseline: vi.fn(),
    containerWidth: 1280,
    duplicate11DuplicatesSet: new Set(),
    duplicate11KeeperSet: new Set(),
    duplicate11Summary: { counts: {} },
    editingRestrictionMessage: "",
    ensureEditableKeys: vi.fn((keys) => keys),
    ensureHardDeleteKeys: vi.fn((keys) => keys),
    fetchAlerts: vi.fn(),
    filterEditableKeys: vi.fn((keys) => keys),
    filterHardDeleteKeys: vi.fn((keys) => keys),
    freezeColumnsEnabled: false,
    getLicenseExcludeSetForRow: vi.fn(() => new Set()),
    handleMarkReviewed: vi.fn(),
    handleToggleHistory: vi.fn(),
    handleUnmarkReviewed: vi.fn(),
    isAdminRole: false,
    isReadOnlyForEdits: false,
    isRowEditable: vi.fn(() => true),
    isRowReviewLocked: vi.fn(() => false),
    keyOfRow: vi.fn((row) => row?.id ?? ""),
    licenseAgencyExcludeMap: {},
    licenseExcludeSet: new Set(),
    loadSavedRows: vi.fn(),
    memberTeamMap: {},
    mode: "saved",
    normalizedFilters: { query: "abc" },
    page: 2,
    pageResetKey: "reset-key",
    pageSize: 25,
    pushAuditLog: vi.fn(),
    rawRows: [{ id: "row-1" }],
    refreshRowHistory: vi.fn(),
    registerHeaderRef: vi.fn(),
    renderResizeHandle: vi.fn(() => null),
    reviewLockMessage: "",
    rootRef: { current: document.createElement("div") },
    rosterTeams: ["OPS"],
    rowDiffMap: new Map([["row-1", { field: "staff" }]]),
    rowHistoryEntries: {},
    rowHistoryExpanded: {},
    rowSaveStatus: {},
    rules: { licenseExclude: [] },
    sanitizeRowUpdates: vi.fn((row, updates) => updates),
    selectedKeys: ["row-1"],
    setHasUnsaved: vi.fn(),
    setPage: vi.fn(),
    setRawRows: vi.fn(),
    setRowSaveStatus: vi.fn(),
    setSelectedKeys: vi.fn(),
    shouldUseServerSearch: true,
    showDeletedRows: false,
    summarizeLicenseSnapshot: vi.fn(() => ({ includedCodes: [] })),
    syncConfig: { enabled: true },
    updatedKeySet: new Set(["row-1"]),
    visibleColumnCount: 8,
    lastSyncFetched: 1,
    lastSyncInserted: 2,
    lastSyncRangeLabel: "01/03-11/03",
    lastSyncRunAtLabel: "11/03 09:00",
    lastSyncSkipped: 3,
    lastSyncSummary: { imported: 6 },
    lastSyncTotal: 6,
    lastSyncUpdated: 4,
    ...overrides,
  };
}

describe("useDataImporterResultsSurface", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useDataImporterResultRows.mockReturnValue({
      serverSearchState: { loading: false },
      setServerSearchState: vi.fn(),
      total: 12,
      maxPage: 3,
      safePage: 2,
      pageRows: [{ id: "row-1" }],
      filteredKeys: ["row-1"],
    });

    useDataImporterSavedEdits.mockReturnValue({
      handleSaveAll: vi.fn(),
      handleSaveRowChanges: vi.fn(),
    });

    useDataImporterLicenseExclusions.mockReturnValue({
      handleApplyLicenseExclusion: vi.fn(),
      handleAutoApplyLicenseExclusion: vi.fn(),
    });

    useDataImporterResultsController.mockReturnValue({
      selectionEnabled: true,
      deleteEnabled: true,
      effectiveCardColumns: 4,
      appliedCardColumns: 4,
      tableResultsProps: { kind: "table" },
      cardResultsProps: { kind: "card" },
      selectionActionsProps: { selectedCount: 1 },
    });
  });

  it("wires row search, save/edit, exclusion, tooltip, and results controller flows", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterResultsSurface(props));

    expect(useDataImporterResultRows).toHaveBeenCalledWith(
      expect.objectContaining({
        page: props.page,
        pageSize: props.pageSize,
        normalizedFilters: props.normalizedFilters,
        shouldUseServerSearch: true,
      }),
    );
    expect(useDataImporterSavedEdits).toHaveBeenCalledWith(
      expect.objectContaining({
        rowDiffMap: props.rowDiffMap,
        loadSavedRows: props.loadSavedRows,
        fetchAlerts: props.fetchAlerts,
      }),
    );
    expect(useDataImporterLicenseExclusions).toHaveBeenCalledWith(
      expect.objectContaining({
        filteredKeys: ["row-1"],
        selectedKeys: props.selectedKeys,
      }),
    );
    expect(useDataImporterResultsController).toHaveBeenCalledWith(
      expect.objectContaining({
        pageRows: [{ id: "row-1" }],
        filteredKeys: ["row-1"],
        duplicate11KeeperSet: props.duplicate11KeeperSet,
      }),
    );
    expect(useTooltipTitles).toHaveBeenCalledWith(props.rootRef, [
      props.rawRows,
      ["row-1"],
      props.selectedKeys,
      props.coDiscrepancyState,
      props.syncConfig,
      props.coCodeConfig,
      props.coDiscrepancyForm,
      props.mode,
    ]);

    expect(result.current.total).toBe(12);
    expect(result.current.maxPage).toBe(3);
    expect(result.current.safePage).toBe(2);
    expect(result.current.tableResultsProps).toEqual({ kind: "table" });
    expect(result.current.cardResultsProps).toEqual({ kind: "card" });
    expect(result.current.selectionActionsProps).toEqual({ selectedCount: 1 });
    expect(result.current.lastSyncSummaryCard.props).toEqual(
      expect.objectContaining({
        visible: true,
        rangeLabel: "01/03-11/03",
        runAtLabel: "11/03 09:00",
        fetched: 1,
        inserted: 2,
        updated: 4,
        skipped: 3,
        total: 6,
      }),
    );
  });

  it("syncs unsaved state only in saved mode", () => {
    const setHasUnsaved = vi.fn();
    renderHook(() => useDataImporterResultsSurface(createProps({ setHasUnsaved })));

    expect(setHasUnsaved).toHaveBeenCalledTimes(1);
    expect(setHasUnsaved.mock.calls[0][0](false)).toBe(true);
    expect(setHasUnsaved.mock.calls[0][0](true)).toBe(true);

    setHasUnsaved.mockClear();

    renderHook(() =>
      useDataImporterResultsSurface(createProps({ mode: "preview", setHasUnsaved })),
    );

    expect(setHasUnsaved).not.toHaveBeenCalled();
  });
});
