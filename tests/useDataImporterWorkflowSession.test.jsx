import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/dataImporter/useDataImporterSavedSession.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterSync.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterImportFlow.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterReviewActions.js", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/dataImporter/useDataImporterOverview.js", () => ({
  default: vi.fn(),
}));

import useDataImporterImportFlow from "@/components/dataImporter/useDataImporterImportFlow.js";
import useDataImporterOverview from "@/components/dataImporter/useDataImporterOverview.js";
import useDataImporterReviewActions from "@/components/dataImporter/useDataImporterReviewActions.js";
import useDataImporterSavedSession from "@/components/dataImporter/useDataImporterSavedSession.js";
import useDataImporterSync from "@/components/dataImporter/useDataImporterSync.js";
import useDataImporterWorkflowSession from "@/components/dataImporter/useDataImporterWorkflowSession.js";

function createProps(overrides = {}) {
  return {
    actor: "guest",
    canManageSync: true,
    canReviewAlerts: true,
    canUploadFiles: true,
    isReadOnlyForEdits: false,
    isAdminRole: false,
    hasUnsaved: false,
    mode: "saved",
    rawRows: [{ id: "row-1" }],
    selectedKeys: ["row-1"],
    selectedFile: "decl.xlsx",
    previewSource: null,
    effectivePreviewRows: [],
    importPreview: { totalRows: 1 },
    canOverwriteData: true,
    overwrite: false,
    autoAssignStaff: true,
    alertSummary: { outstanding: 1 },
    alertEntries: [{ id: "alert-1" }],
    showDeletedRows: false,
    fileRef: { current: { value: "" } },
    loadRules: vi.fn(),
    getDeclRows: vi.fn(),
    sortDeclRows: vi.fn((rows) => rows),
    ensureLicenseFields: vi.fn((row) => row),
    ensureCOFields: vi.fn((row) => row),
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
    handleRefreshCoDiscrepancy: vi.fn(),
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
    FileReaderCtor: function FileReader() {},
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
    acceptedImportExtensions: [".xlsx"],
    maxImportFileSizeBytes: 1024,
    maxImportRows: 100,
    ensureEditableKeys: vi.fn((keys) => keys),
    keyOfRow: vi.fn((row) => row?.id ?? ""),
    markDeclRowsReviewed: vi.fn(),
    unmarkDeclRowsReviewed: vi.fn(),
    formatDateRangeLabel: vi.fn(() => "range"),
    formatDisplayDate: vi.fn(() => "date"),
    toDateInputValue: vi.fn((date) => date.toISOString().slice(0, 10)),
    ...overrides,
  };
}

describe("useDataImporterWorkflowSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useDataImporterSavedSession.mockReturnValue({
      loadSavedRows: vi.fn(() => true),
    });

    useDataImporterSync.mockReturnValue({
      syncConfig: { enabled: true },
      syncForm: { enabled: true },
      setSyncForm: vi.fn(),
      syncLoading: false,
      syncRunning: false,
      syncMessage: "ok",
      syncError: "",
      manualRange: { from: "", to: "" },
      setManualRange: vi.fn(),
      handleManualRangeChange: vi.fn(),
      alertSummary: { outstanding: 1 },
      alertEntries: [{ id: "alert-1" }],
      alertLoading: false,
      statusInfo: { backend: { ok: true } },
      statusLoading: false,
      statusError: "",
      previewRows: [],
      previewLimited: false,
      previewLoading: false,
      previewError: "",
      previewRangeInfo: null,
      previewRangeLabel: "",
      mstFilterNotice: "",
      syncPreflightChecks: [],
      syncPreflightSummary: { ready: true, blockingCount: 0, warningCount: 0 },
      syncActivityLog: [],
      syncResumeJob: null,
      syncResumeLabel: "",
      fetchSyncConfig: vi.fn(),
      fetchSyncStatus: vi.fn(),
      handleRefreshAlerts: vi.fn(),
      handleSaveSyncConfig: vi.fn(),
      handleRunSync: vi.fn(),
      handleResumeSync: vi.fn(),
      handlePreviewSync: vi.fn(),
    });

    useDataImporterImportFlow.mockReturnValue({
      handleFileChange: vi.fn(),
      handleImport: vi.fn(),
    });

    useDataImporterReviewActions.mockReturnValue({
      handleRefreshAlerts: vi.fn(),
      handleMarkReviewed: vi.fn(),
      handleUnmarkReviewed: vi.fn(),
    });

    useDataImporterOverview.mockReturnValue({
      outstandingAlerts: [{ id: "alert-1" }],
      summaryCards: [{ label: "A" }],
      lastAlertEvaluated: "2026-03-11T00:00:00.000Z",
      syncLastRunLabel: "11/03",
      lastSyncSummary: { imported: 2 },
      lastSyncRangeLabel: "range",
      lastSyncRunAtLabel: "runAt",
    });
  });

  it("connects saved-session state into sync, import, review, and overview hooks", () => {
    const props = createProps();

    const { result } = renderHook(() => useDataImporterWorkflowSession(props));

    const loadSavedRows = useDataImporterSavedSession.mock.results[0].value.loadSavedRows;
    const handleRefreshAlerts = useDataImporterSync.mock.results[0].value.handleRefreshAlerts;

    expect(useDataImporterSync).toHaveBeenCalledWith(
      expect.objectContaining({
        loadSavedRows,
        onAfterSyncSuccess: props.handleRefreshCoDiscrepancy,
      }),
    );
    expect(useDataImporterImportFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        loadSavedRows,
        fetchAlerts: handleRefreshAlerts,
      }),
    );
    expect(useDataImporterReviewActions).toHaveBeenCalledWith(
      expect.objectContaining({
        loadSavedRows,
        fetchAlerts: handleRefreshAlerts,
      }),
    );
    expect(useDataImporterOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        alertSummary: { outstanding: 1 },
        alertEntries: [{ id: "alert-1" }],
      }),
    );

    expect(result.current.loadSavedRows).toBe(loadSavedRows);
    expect(result.current.fetchAlerts).toBe(handleRefreshAlerts);
    expect(result.current.summaryCards).toEqual([{ label: "A" }]);
    expect(result.current.handleImport).toBe(useDataImporterImportFlow.mock.results[0].value.handleImport);
  });

  it("applies quick date presets through the sync manual range setter", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T07:08:09.000Z"));

    const props = createProps();
    const { result } = renderHook(() => useDataImporterWorkflowSession(props));

    act(() => {
      result.current.applyRangePreset(2);
    });

    expect(useDataImporterSync.mock.results[0].value.setManualRange).toHaveBeenCalledWith({
      from: "2026-03-09",
      to: "2026-03-11",
    });

    vi.useRealTimers();
  });

  it("promotes successful ECUS preview rows into the shared review flow", async () => {
    const previewRows = [{ id: "sync-row-1" }, { id: "sync-row-2" }];
    const previewSyncRows = vi.fn().mockResolvedValue({
      ok: true,
      rows: previewRows,
      fetched: 7,
      limited: false,
      range: { from: "2026-03-01", to: "2026-03-02" },
    });

    useDataImporterSync.mockReturnValue({
      ...useDataImporterSync.mock.results[0]?.value,
      syncConfig: { enabled: true },
      syncForm: { enabled: true },
      setSyncForm: vi.fn(),
      syncLoading: false,
      syncRunning: false,
      syncMessage: "ok",
      syncError: "",
      manualRange: { from: "", to: "" },
      setManualRange: vi.fn(),
      handleManualRangeChange: vi.fn(),
      alertSummary: { outstanding: 0 },
      alertEntries: [],
      alertLoading: false,
      statusInfo: { backend: { ok: true } },
      statusLoading: false,
      statusError: "",
      previewRows,
      previewLimited: false,
      previewLoading: false,
      previewError: "",
      previewRangeInfo: null,
      previewRangeLabel: "",
      mstFilterNotice: "",
      syncPreflightChecks: [],
      syncPreflightSummary: { ready: true, blockingCount: 0, warningCount: 0 },
      syncActivityLog: [],
      syncResumeJob: null,
      syncResumeLabel: "",
      fetchSyncConfig: vi.fn(),
      fetchSyncStatus: vi.fn(),
      handleRefreshAlerts: vi.fn(),
      handleSaveSyncConfig: vi.fn(),
      handleRunSync: vi.fn(),
      handleResumeSync: vi.fn(),
      handlePreviewSync: previewSyncRows,
    });

    const props = createProps({
      rawRows: [],
      mode: "saved",
      selectedFile: "stale.xlsx",
      setPreviewSource: vi.fn(),
      setRawRows: vi.fn(),
      setMode: vi.fn(),
      setPage: vi.fn(),
      setSelectedFile: vi.fn(),
      setQuery: vi.fn(),
      setFilterNoStaff: vi.fn(),
      setFilterNoTeam: vi.fn(),
      setFilterDuplicate11: vi.fn(),
      setCoFilterMode: vi.fn(),
      setCoFilterMin: vi.fn(),
      setSelectedKeys: vi.fn(),
      setHasUnsaved: vi.fn(),
      ensureLicenseFields: vi.fn((row) => row),
      ensureCOFields: vi.fn((row) => row),
      sortDeclRows: vi.fn((rows) => rows),
    });

    const { result } = renderHook(() => useDataImporterWorkflowSession(props));

    await act(async () => {
      await result.current.handlePreviewSync();
    });

    expect(previewSyncRows).toHaveBeenCalledTimes(1);
    expect(props.setRawRows).toHaveBeenCalledWith(previewRows);
    expect(props.setPage).toHaveBeenCalledWith(1);
    expect(props.setMode).toHaveBeenCalledWith("preview");
    expect(props.setSelectedFile).toHaveBeenCalledWith("");
    expect(props.setPreviewSource).toHaveBeenCalledWith("sync");
    expect(props.setSyncPreviewMeta).toHaveBeenCalledWith({ fetched: 7 });
    expect(props.setQuery).toHaveBeenCalledWith("");
    expect(props.setFilterNoStaff).toHaveBeenCalledWith(false);
    expect(props.setFilterNoTeam).toHaveBeenCalledWith(false);
    expect(props.setFilterDuplicate11).toHaveBeenCalledWith(false);
    expect(props.setCoFilterMode).toHaveBeenCalledWith("all");
    expect(props.setCoFilterMin).toHaveBeenCalledWith(5);
    expect(props.setSelectedKeys).toHaveBeenCalledWith([]);
    expect(props.setHasUnsaved).toHaveBeenCalledWith(false);
  });
});
