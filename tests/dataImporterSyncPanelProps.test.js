import { describe, expect, it } from "vitest";

import {
  TONE_CLASS_MAP,
  createDataImporterSyncPanelProps,
  resolveStatusMeta,
} from "@/components/dataImporter/dataImporterSyncPanelProps.js";

describe("dataImporterSyncPanelProps", () => {
  it("resolveStatusMeta maps ok, timeout, and not-configured states", () => {
    expect(resolveStatusMeta(null, "fallback")).toEqual({
      tone: "muted",
      label: "fallback",
      detail: "",
    });

    expect(
      resolveStatusMeta({ ok: true, message: "ready" }, "fallback", "backend"),
    ).toEqual({
      tone: "success",
      label: "Backend hoạt động",
      detail: "ready",
    });

    expect(
      resolveStatusMeta({ state: "not_configured" }, "fallback", "database"),
    ).toEqual({
      tone: "warning",
      label: "Chưa cấu hình SQL Server",
      detail: "",
    });

    expect(
      resolveStatusMeta({ state: "timeout", message: "slow" }, "fallback", "database"),
    ).toEqual({
      tone: "danger",
      label: "Timeout kết nối SQL Server",
      detail: "slow",
    });
  });

  it("builds sync, co-code, and monitoring panel props from importer state", () => {
    const alertSummary = { pending: 3 };
    const alertEntries = [{ key: "a-1" }];
    const coCodeForm = { whitelist: "A01" };
    const coDiscrepancyRange = { from: "2026-03-01", to: "2026-03-05" };
    const coDiscrepancyForm = { threshold: 2 };
    const lastSyncSummaryCard = { type: "summary-card" };
    const syncConfig = { enabled: true };
    const syncForm = { schedule: "daily" };
    const manualRange = { from: "2026-03-01", to: "2026-03-03" };
    const previewRows = [{ so_tk: "102030" }];
    const syncProgressSteps = [{ key: "commit", status: "done", label: "Đồng bộ dữ liệu từ ECUS" }];
    const syncPreflightChecks = [{ key: "backend", status: "pass", label: "Backend đồng bộ sẵn sàng" }];
    const syncPreflightSummary = { ready: true, blockingCount: 0, warningCount: 0 };
    const syncActivityLog = [{ id: "log-1", message: "queued", at: "2026-03-10T02:15:00.000Z" }];
    const syncResumeJob = { id: "job-1" };
    const formatDisplayDate = (value) => `DATE:${value}`;
    const fetchSyncConfig = () => "fetch-config";
    const fetchSyncStatus = () => "fetch-status";
    const handleSaveSyncConfig = () => "save-config";
    const handleManualRangeChange = () => "change-manual-range";
    const handlePreviewSync = () => "preview-sync";
    const handleRunSync = () => "run-sync";
    const handleResumeSync = () => "resume-sync";
    const handleRefreshAlerts = () => "refresh-alerts";
    const handleRunCoDiscrepancy = () => "run-co";
    const handleRefreshCoDiscrepancy = () => "refresh-co";
    const handleSaveCoDiscrepancyConfig = () => "save-co";
    const handleResetCoDiscrepancyForm = () => "reset-co";
    const handleRefreshCoCodeConfig = () => "refresh-code";
    const handleSaveCoCodeConfig = () => "save-code";
    const handleResetCoCodeForm = () => "reset-code";
    const setCoCodeForm = () => "set-code-form";
    const setCoDiscrepancyRange = () => "set-range";
    const setCoDiscrepancyForm = () => "set-co-form";
    const setSyncForm = () => "set-sync-form";
    const onApplyRangePreset = () => "apply-range";
    const onSelectMismatches = () => "select-mismatches";

    const {
      coCodeConfigProps,
      monitoringAlertsProps,
      monitoringCoDiscrepancyProps,
      syncConfigPanelProps,
    } = createDataImporterSyncPanelProps({
      canManageSync: true,
      isAdminRole: true,
      alertSummary,
      alertEntries,
      alertLoading: false,
      lastAlertEvaluated: "2026-03-10T01:00:00.000Z",
      coCodeLoading: false,
      coCodeSaving: true,
      coCodeError: "co-code-error",
      coCodeMessage: "co-code-message",
      coCodeForm,
      handleRefreshCoCodeConfig,
      handleSaveCoCodeConfig,
      handleResetCoCodeForm,
      setCoCodeForm,
      coCodeUpdatedLabel: "updated-now",
      coDiscrepancyRange,
      setCoDiscrepancyRange,
      handleRunCoDiscrepancy,
      handleRefreshCoDiscrepancy,
      coDiscrepancyRunning: true,
      coDiscrepancyLoading: false,
      coDiscrepancyError: "co-error",
      coDiscrepancyMessage: "co-message",
      coDiscrepancyStatusLabel: "status-ready",
      coDiscrepancyLastRunLabel: "last-run",
      coMismatchCount: 5,
      coCheckedCount: 12,
      coDiscrepancyForm,
      setCoDiscrepancyForm,
      coDiscrepancySaving: false,
      handleSaveCoDiscrepancyConfig,
      handleResetCoDiscrepancyForm,
      coDiscrepancyRangeLabel: "01-03 -> 05-03",
      coMismatchLimited: true,
      coMismatchPreview: [{ key: "mm-1" }],
      coMismatchKeyCount: 7,
      onSelectMismatches,
      handleRefreshAlerts,
      syncLastRunLabel: "sync-run",
      syncConfig,
      fetchSyncConfig,
      fetchSyncStatus,
      handleSaveSyncConfig,
      syncLoading: false,
      statusLoading: true,
      syncForm,
      setSyncForm,
      statusInfo: {
        backend: { ok: true, message: "healthy" },
        database: { state: "timeout", message: "slow" },
        checkedAt: "2026-03-10T02:15:00.000Z",
      },
      statusError: "status-error",
      lastSyncSummaryCard,
      manualRange,
      onApplyRangePreset,
      handleManualRangeChange,
      syncRunning: false,
      previewLoading: true,
      handlePreviewSync,
      handleRunSync,
      mstFilterNotice: "only-MST",
      previewRangeInfo: { from: "2026-03-01", to: "2026-03-02" },
      previewRangeLabel: "preview-label",
      previewLimited: true,
      previewError: "preview-error",
      previewRows,
      syncPreflightChecks,
      syncPreflightSummary,
      syncActivityLog,
      syncResumeJob,
      syncResumeLabel: "resume-label",
      syncProgressSteps,
      formatDisplayDate,
      syncMessage: "sync-message",
      syncError: "sync-error",
      handleResumeSync,
      cardSurfaceClass: "surface-card",
    });

    expect(coCodeConfigProps).toMatchObject({
      canManageSync: true,
      saving: true,
      error: "co-code-error",
      message: "co-code-message",
      form: coCodeForm,
      updatedLabel: "updated-now",
      onFormChange: setCoCodeForm,
      onRefresh: handleRefreshCoCodeConfig,
      onSave: handleSaveCoCodeConfig,
      onReset: handleResetCoCodeForm,
    });

    expect(monitoringAlertsProps).toEqual({
      lastEvaluated: "2026-03-10T01:00:00.000Z",
      summary: alertSummary,
      onRefresh: handleRefreshAlerts,
      loading: false,
      outstandingAlerts: alertEntries,
    });

    expect(monitoringCoDiscrepancyProps).toMatchObject({
      canManageSync: true,
      range: coDiscrepancyRange,
      onRangeChange: setCoDiscrepancyRange,
      onRun: handleRunCoDiscrepancy,
      mismatchCount: 5,
      checkedCount: 12,
      mismatchKeyCount: 7,
      onSelectMismatches,
    });

    expect(syncConfigPanelProps.toneClassMap).toBe(TONE_CLASS_MAP);
    expect(syncConfigPanelProps.backendMeta).toEqual({
      tone: "success",
      label: "Backend hoạt động",
      detail: "healthy",
    });
    expect(syncConfigPanelProps.databaseMeta).toEqual({
      tone: "danger",
      label: "Timeout kết nối SQL Server",
      detail: "slow",
    });
    expect(syncConfigPanelProps.statusCheckedLabel).toBe(
      new Date("2026-03-10T02:15:00.000Z").toLocaleString("vi-VN"),
    );
    expect(syncConfigPanelProps.lastSyncSummaryCard).toBe(lastSyncSummaryCard);
    expect(syncConfigPanelProps.rangePresets).toBeUndefined();
    expect(syncConfigPanelProps.manualRange).toBe(manualRange);
    expect(syncConfigPanelProps.onApplyRangePreset).toBe(onApplyRangePreset);
    expect(syncConfigPanelProps.onManualRangeChange).toBe(handleManualRangeChange);
    expect(syncConfigPanelProps.previewRows).toBe(previewRows);
    expect(syncConfigPanelProps.syncPreflightChecks).toBe(syncPreflightChecks);
    expect(syncConfigPanelProps.syncPreflightSummary).toBe(syncPreflightSummary);
    expect(syncConfigPanelProps.syncActivityLog).toBe(syncActivityLog);
    expect(syncConfigPanelProps.syncResumeJob).toBe(syncResumeJob);
    expect(syncConfigPanelProps.syncResumeLabel).toBe("resume-label");
    expect(syncConfigPanelProps.syncProgressSteps).toBe(syncProgressSteps);
    expect(syncConfigPanelProps.formatDisplayDate).toBe(formatDisplayDate);
    expect(syncConfigPanelProps.onResumeSync).toBe(handleResumeSync);
    expect(syncConfigPanelProps.cardSurfaceClass).toBe("surface-card");
  });
});
