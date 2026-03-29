export const TONE_CLASS_MAP = {
  success: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border border-amber-200 bg-amber-50 text-amber-700",
  danger: "border border-red-200 bg-red-50 text-red-700",
  muted:
    "border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-muted)]",
};

export function resolveStatusMeta(status, fallback, kind = "database") {
  if (!status) {
    return { tone: "muted", label: fallback, detail: "" };
  }

  if (status.ok) {
    const label = kind === "backend" ? "Backend hoạt động" : "SQL Server sẵn sàng";
    return { tone: "success", label, detail: status.message || "" };
  }

  if (status.state === "not_configured") {
    return { tone: "warning", label: "Chưa cấu hình SQL Server", detail: "" };
  }

  if (status.state === "timeout") {
    return {
      tone: "danger",
      label: "Timeout kết nối SQL Server",
      detail: status.message || "",
    };
  }

  const detail = status.message || "";
  const label = kind === "backend" ? "Backend gặp sự cố" : "Lỗi kết nối SQL Server";

  return { tone: "danger", label, detail };
}

export function createDataImporterSyncPanelProps({
  mode = "saved",
  previewSource = null,
  canManageSync = false,
  isAdminRole = false,
  alertSummary = null,
  alertEntries = [],
  alertLoading = false,
  lastAlertEvaluated = "",
  coCodeLoading = false,
  coCodeSaving = false,
  coCodeError = "",
  coCodeMessage = "",
  coCodeForm = {},
  handleRefreshCoCodeConfig,
  handleSaveCoCodeConfig,
  handleResetCoCodeForm,
  setCoCodeForm,
  coCodeUpdatedLabel = "",
  coDiscrepancyRange = { from: "", to: "" },
  setCoDiscrepancyRange,
  handleRunCoDiscrepancy,
  handleRefreshCoDiscrepancy,
  coDiscrepancyRunning = false,
  coDiscrepancyLoading = false,
  coDiscrepancyError = "",
  coDiscrepancyMessage = "",
  coDiscrepancyStatusLabel = "",
  coDiscrepancyLastRunLabel = "",
  coMismatchCount = 0,
  coCheckedCount = 0,
  coDiscrepancyForm = {},
  setCoDiscrepancyForm,
  coDiscrepancySaving = false,
  handleSaveCoDiscrepancyConfig,
  handleResetCoDiscrepancyForm,
  coDiscrepancyRangeLabel = "",
  coMismatchLimited = false,
  coMismatchPreview = [],
  coMismatchKeyCount = 0,
  onSelectMismatches,
  handleRefreshAlerts,
  syncLastRunLabel = "",
  syncConfig = null,
  fetchSyncConfig,
  fetchSyncStatus,
  handleSaveSyncConfig,
  syncLoading = false,
  statusLoading = false,
  syncForm = {},
  setSyncForm,
  statusInfo = {},
  statusError = "",
  lastSyncSummaryCard = null,
  rangePresets,
  manualRange = { from: "", to: "" },
  onApplyRangePreset,
  handleManualRangeChange,
  syncRunning = false,
  previewLoading = false,
  handlePreviewSync,
  handleRunSync,
  mstFilterNotice = "",
  previewRangeInfo = null,
  previewRangeLabel = "",
  previewLimited = false,
  previewError = "",
  previewRows = [],
  syncPreflightChecks = [],
  syncPreflightSummary = null,
  syncActivityLog = [],
  syncResumeJob = null,
  syncResumeLabel = "",
  formatDisplayDate,
  syncProgressSteps = [],
  syncMessage = "",
  syncError = "",
  handleResumeSync,
  cardSurfaceClass = "",
}) {
  const backendMeta = resolveStatusMeta(
    statusInfo?.backend,
    "Backend chưa kiểm tra",
    "backend",
  );
  const databaseMeta = resolveStatusMeta(
    statusInfo?.database,
    "SQL Server chưa kiểm tra",
    "database",
  );
  const statusCheckedLabel = statusInfo?.checkedAt
    ? new Date(statusInfo.checkedAt).toLocaleString("vi-VN")
    : "Chưa kiểm tra";

  const coCodeConfigProps = {
    canManageSync,
    loading: coCodeLoading,
    saving: coCodeSaving,
    error: coCodeError,
    message: coCodeMessage,
    form: coCodeForm,
    onFormChange: setCoCodeForm,
    onRefresh: handleRefreshCoCodeConfig,
    onSave: handleSaveCoCodeConfig,
    onReset: handleResetCoCodeForm,
    updatedLabel: coCodeUpdatedLabel,
  };

  const monitoringCoDiscrepancyProps = {
    canManageSync,
    range: coDiscrepancyRange,
    onRangeChange: setCoDiscrepancyRange,
    onRun: handleRunCoDiscrepancy,
    onRefresh: handleRefreshCoDiscrepancy,
    running: coDiscrepancyRunning,
    loading: coDiscrepancyLoading,
    error: coDiscrepancyError,
    message: coDiscrepancyMessage,
    statusLabel: coDiscrepancyStatusLabel,
    lastRunLabel: coDiscrepancyLastRunLabel,
    mismatchCount: coMismatchCount,
    checkedCount: coCheckedCount,
    form: coDiscrepancyForm,
    onFormChange: setCoDiscrepancyForm,
    saving: coDiscrepancySaving,
    onSaveConfig: handleSaveCoDiscrepancyConfig,
    onResetForm: handleResetCoDiscrepancyForm,
    rangeLabel: coDiscrepancyRangeLabel,
    mismatchLimited: coMismatchLimited,
    mismatchPreview: coMismatchPreview,
    mismatchKeyCount: coMismatchKeyCount,
    onSelectMismatches,
  };

  const monitoringAlertsProps = {
    lastEvaluated: lastAlertEvaluated,
    summary: alertSummary,
    onRefresh: handleRefreshAlerts,
    loading: alertLoading,
    outstandingAlerts: alertEntries,
  };

  const syncConfigPanelProps = {
    isAdminRole,
    canManageSync,
    syncLastRunLabel,
    syncConfig,
    fetchSyncConfig,
    fetchSyncStatus,
    handleSaveSyncConfig,
    syncLoading,
    statusLoading,
    syncForm,
    setSyncForm,
    toneClassMap: TONE_CLASS_MAP,
    backendMeta,
    databaseMeta,
    statusCheckedLabel,
    statusError,
    lastSyncSummaryCard,
    rangePresets,
    manualRange,
    onApplyRangePreset,
    onManualRangeChange: handleManualRangeChange,
    syncRunning,
    previewLoading,
    onPreview: handlePreviewSync,
    onRunSync: handleRunSync,
    mstFilterNotice,
    showPreviewRange: !!previewRangeInfo,
    previewRangeLabel,
    previewLimited,
    previewError,
    previewRows,
    syncPreflightChecks,
    syncPreflightSummary,
    syncActivityLog,
    syncResumeJob,
    syncResumeLabel,
    showPreviewTableInline: !(mode === "preview" && previewSource === "sync" && previewRows.length > 0),
    formatDisplayDate,
    syncProgressSteps,
    syncMessage,
    syncError,
    onResumeSync: handleResumeSync,
    cardSurfaceClass,
  };

  return {
    coCodeConfigProps,
    monitoringCoDiscrepancyProps,
    monitoringAlertsProps,
    syncConfigPanelProps,
  };
}

export default createDataImporterSyncPanelProps;
