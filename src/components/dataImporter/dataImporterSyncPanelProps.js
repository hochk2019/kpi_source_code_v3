export const TONE_CLASS_MAP = {
  success: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border border-amber-200 bg-amber-50 text-amber-700",
  danger: "border border-red-200 bg-red-50 text-red-700",
  muted:
    "border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-muted)]",
};

const HTTP_5XX_PATTERN = /\bHTTP 5\d\d\b/i;
const HTTP_AUTH_PATTERN = /\bHTTP (401|403)\b/i;
const NETWORK_ERROR_PATTERN =
  /\b(fetch|network|vpn|econn|timed?\s*out|timeout|không thể kết nối)\b/i;
const SQL_ERROR_PATTERN =
  /\b(sql|database|credential|mật khẩu|login|đăng nhập|server)\b/i;
const NO_DATA_PATTERN = /không tìm thấy tờ khai mới/i;

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

function appendRecoveryHint(target, key, title, detail) {
  if (!target.some((hint) => hint.key === key)) {
    target.push({ key, title, detail });
  }
}

export function buildDataImporterSyncRecoveryHints({
  previewError = "",
  syncError = "",
  syncPreflightChecks = [],
  syncResumeJob = null,
}) {
  const hints = [];
  const hasFailedCheck = (key) =>
    syncPreflightChecks.some((check) => check?.key === key && check?.status === "fail");
  const combinedError = [previewError, syncError].filter(Boolean).join(" \n");

  if (hasFailedCheck("connection")) {
    appendRecoveryHint(
      hints,
      "connection-config",
      "Rà soát lại cấu hình ECUS/SQL Server",
      "Kiểm tra lại máy chủ, cơ sở dữ liệu, tài khoản và mật khẩu đã lưu. Sau đó bấm 'Kiểm tra kết nối' trước khi chạy lại.",
    );
  }

  if (hasFailedCheck("database") || SQL_ERROR_PATTERN.test(combinedError)) {
    appendRecoveryHint(
      hints,
      "vpn-sql",
      "Kiểm tra VPN và đường vào SQL Server",
      "Nếu đang làm việc ngoài văn phòng, hãy kết nối VPN hoặc mạng nội bộ rồi thử lại. Nếu đã vào VPN nhưng vẫn lỗi, báo CNTT để kiểm tra SQL Server.",
    );
  }

  if (hasFailedCheck("backend") || HTTP_5XX_PATTERN.test(combinedError)) {
    appendRecoveryHint(
      hints,
      "retry-backend",
      "Làm mới trạng thái rồi thử lại",
      "Bấm 'Kiểm tra kết nối', chờ Backend và SQL Server về trạng thái sẵn sàng, rồi thử lại thao tác xem trước hoặc đồng bộ.",
    );
  }

  if (NETWORK_ERROR_PATTERN.test(combinedError)) {
    appendRecoveryHint(
      hints,
      "network",
      "Kiểm tra mạng trước khi chạy lại",
      "Lỗi hiện tại giống mất kết nối hoặc timeout. Hãy kiểm tra VPN, Wi-Fi hoặc mạng nội bộ rồi chạy lại thao tác vừa thất bại.",
    );
  }

  if (hasFailedCheck("range")) {
    appendRecoveryHint(
      hints,
      "range",
      "Điền lại khoảng ngày hợp lệ",
      "Chọn đủ ngày bắt đầu và kết thúc, đồng thời bảo đảm ngày bắt đầu không lớn hơn ngày kết thúc trước khi xem trước hoặc đồng bộ.",
    );
  }

  if (NO_DATA_PATTERN.test(previewError)) {
    appendRecoveryHint(
      hints,
      "no-data",
      "Mở rộng khoảng ngày hoặc nới bộ lọc MST",
      "Không tìm thấy dữ liệu trong phạm vi hiện tại. Hãy thử tăng khoảng ngày hoặc bỏ bớt điều kiện lọc MST rồi bấm 'Xem trước dữ liệu' lại.",
    );
  }

  if (HTTP_AUTH_PATTERN.test(combinedError) || /không có quyền/i.test(combinedError)) {
    appendRecoveryHint(
      hints,
      "permission",
      "Kiểm tra lại quyền truy cập",
      "Tài khoản hiện tại có thể thiếu quyền với API hoặc SQL Server. Nếu đăng nhập lại mà vẫn lỗi, gửi CNTT thời điểm lỗi để kiểm tra quyền.",
    );
  }

  if (syncResumeJob && syncError) {
    appendRecoveryHint(
      hints,
      "resume",
      "Ưu tiên tiếp tục job dang dở",
      "Nếu cùng một job vừa bị gián đoạn, hãy dùng nút 'Tiếp tục job dang dở' để chạy lại đúng tham số đã lưu trước khi tạo job mới.",
    );
  }

  if ((previewError || syncError || syncPreflightChecks.some((check) => check?.status === "fail")) && !hints.some((hint) => hint.key === "escalate")) {
    appendRecoveryHint(
      hints,
      "escalate",
      "Báo CNTT nếu lỗi lặp lại",
      "Nếu đã thử lại 2-3 lần mà vẫn lỗi, hãy chụp màn hình cùng thời điểm xảy ra lỗi và gửi CNTT để họ tra log backend/SQL Server.",
    );
  }

  return hints;
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
  previewConflictSummary = null,
  previewConflictWarningActive = false,
  syncPreflightChecks = [],
  syncPreflightSummary = null,
  syncActivityLog = [],
  syncHistory = [],
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
  const syncRecoveryHints = buildDataImporterSyncRecoveryHints({
    previewError,
    syncError,
    syncPreflightChecks,
    syncResumeJob,
  });

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
    previewConflictSummary,
    previewConflictWarningActive,
    syncRecoveryHints,
    syncPreflightChecks,
    syncPreflightSummary,
    syncActivityLog,
    syncHistory,
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
