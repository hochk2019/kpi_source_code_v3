const SYNC_QUEUE_STORAGE_KEY = "data-importer-ecus-sync-job-v1";
const READY_STATUS_VALUES = new Set(["ok", "ready", "healthy", "connected"]);
const SYNC_HISTORY_LIMIT = 6;

export const SYNC_RETRY_DELAYS_MS = [1500, 3000, 6000, 12000, 24000];

export const SYNC_PROGRESS_STEP_DEFS = [
  { key: "commit", label: "Đồng bộ dữ liệu từ ECUS" },
  { key: "reconcile", label: "Làm mới cấu hình, trạng thái và cảnh báo" },
  { key: "refreshDeclRows", label: "Tải lại tờ khai từ server" },
  { key: "reloadSavedRows", label: "Làm mới danh sách đang hiển thị" },
];

export function createSyncProgressSteps() {
  return SYNC_PROGRESS_STEP_DEFS.map((step) => ({
    ...step,
    status: "pending",
    detail: "",
  }));
}

export function createDefaultSyncJobState() {
  return {
    activeJob: null,
    resumableJob: null,
    lastJob: null,
    jobHistory: [],
  };
}

function toNonNegativeCount(value) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0) {
    return 0;
  }
  return normalized;
}

export function buildSyncJobResultSummary(result = {}) {
  const imported = toNonNegativeCount(result?.imported);
  const updated = toNonNegativeCount(result?.updated);
  const skipped = toNonNegativeCount(result?.skipped);
  const reviewLocked = toNonNegativeCount(result?.reviewLocked);

  return {
    imported,
    updated,
    skipped,
    reviewLocked,
    affectedRows: imported + updated,
    previewedRows: imported + updated + skipped + reviewLocked,
  };
}

export function isHealthySyncStatus(status) {
  if (!status || typeof status !== "object") {
    return false;
  }

  if (status.ok === true) {
    return true;
  }

  const rawValue =
    (typeof status.status === "string" && status.status) ||
    (typeof status.state === "string" && status.state) ||
    "";

  return READY_STATUS_VALUES.has(rawValue.toLowerCase());
}

function hasSavedCredential(syncForm = {}) {
  return !!(syncForm.password || syncForm.hasPassword);
}

export function buildSyncPreflightChecks({
  statusInfo = {},
  syncForm = {},
  manualRange = { from: "", to: "" },
}) {
  const backendReady = isHealthySyncStatus(statusInfo?.backend);
  const databaseReady = isHealthySyncStatus(statusInfo?.database);
  const connectionReady = !!(
    syncForm?.server?.trim() &&
    syncForm?.database?.trim() &&
    syncForm?.user?.trim() &&
    hasSavedCredential(syncForm)
  );

  const hasManualRange = !!(manualRange?.from || manualRange?.to);
  const rangeComplete = !!(manualRange?.from && manualRange?.to);
  const rangeOrdered = !rangeComplete || manualRange.from <= manualRange.to;

  return [
    {
      key: "backend",
      label: "Backend đồng bộ sẵn sàng",
      status: backendReady ? "pass" : "fail",
      blocking: true,
      detail: backendReady
        ? statusInfo?.backend?.message || "Backend đang phản hồi bình thường."
        : statusInfo?.backend?.message || "Backend chưa phản hồi hoặc đang lỗi.",
    },
    {
      key: "database",
      label: "SQL Server sẵn sàng",
      status: databaseReady ? "pass" : "fail",
      blocking: true,
      detail: databaseReady
        ? statusInfo?.database?.message || "Kết nối SQL Server hợp lệ."
        : statusInfo?.database?.message || "Kết nối SQL Server chưa sẵn sàng.",
    },
    {
      key: "connection",
      label: "Cấu hình ECUS/SQL Server đầy đủ",
      status: connectionReady ? "pass" : "fail",
      blocking: true,
      detail: connectionReady
        ? "Đã có máy chủ, cơ sở dữ liệu, tài khoản và thông tin xác thực."
        : "Thiếu máy chủ, cơ sở dữ liệu, tài khoản hoặc mật khẩu lưu cho kết nối ECUS.",
    },
    {
      key: "range",
      label: "Khoảng dữ liệu hợp lệ",
      status: !hasManualRange ? "warn" : rangeComplete && rangeOrdered ? "pass" : "fail",
      blocking: hasManualRange,
      detail: !hasManualRange
        ? "Chưa chọn khoảng ngày thủ công. Lần chạy này sẽ dùng RangeDays mặc định trong cấu hình."
        : rangeComplete && rangeOrdered
          ? `Sẽ đồng bộ từ ${manualRange.from} đến ${manualRange.to}.`
          : "Khoảng ngày chưa hợp lệ. Hãy chọn đủ ngày bắt đầu và kết thúc, đồng thời bảo đảm ngày bắt đầu không lớn hơn ngày kết thúc.",
    },
  ];
}

export function summarizeSyncPreflight(checks = []) {
  const blockingCount = checks.filter((item) => item?.blocking && item?.status === "fail").length;
  const warningCount = checks.filter((item) => item?.status === "warn").length;

  return {
    ready: blockingCount === 0,
    blockingCount,
    warningCount,
  };
}

export function createSyncLogEntry(message, options = {}) {
  const timestamp = options.at || new Date().toISOString();
  return {
    id: `${timestamp}-${options.level || "info"}-${Math.random().toString(36).slice(2, 8)}`,
    level: options.level || "info",
    message,
    at: timestamp,
  };
}

function cloneProgressSteps(progressSteps) {
  if (!Array.isArray(progressSteps) || !progressSteps.length) {
    return createSyncProgressSteps();
  }

  return progressSteps.map((step, index) => ({
    key: step?.key || SYNC_PROGRESS_STEP_DEFS[index]?.key || `step-${index + 1}`,
    label: step?.label || SYNC_PROGRESS_STEP_DEFS[index]?.label || "Bước đồng bộ",
    status: step?.status || "pending",
    detail: step?.detail || "",
  }));
}

function normalizeSyncJob(job) {
  if (!job || typeof job !== "object") {
    return null;
  }

  const resultSummary =
    job.resultSummary && typeof job.resultSummary === "object"
      ? buildSyncJobResultSummary(job.resultSummary)
      : null;

  return {
    id: typeof job.id === "string" ? job.id : `sync-${Date.now()}`,
    actor: typeof job.actor === "string" ? job.actor : "system",
    status: typeof job.status === "string" ? job.status : "queued",
    from: typeof job.from === "string" ? job.from : "",
    to: typeof job.to === "string" ? job.to : "",
    includeTaxCodes: Array.isArray(job.includeTaxCodes) ? job.includeTaxCodes.filter(Boolean) : [],
    excludeTaxCodes: Array.isArray(job.excludeTaxCodes) ? job.excludeTaxCodes.filter(Boolean) : [],
    mstFilterNotice: typeof job.mstFilterNotice === "string" ? job.mstFilterNotice : "",
    attemptCount: Number.isFinite(Number(job.attemptCount)) ? Number(job.attemptCount) : 0,
    currentStepKey:
      typeof job.currentStepKey === "string" ? job.currentStepKey : SYNC_PROGRESS_STEP_DEFS[0].key,
    backendJobId: typeof job.backendJobId === "string" ? job.backendJobId : "",
    backendJobStatus: typeof job.backendJobStatus === "string" ? job.backendJobStatus : "idle",
    backendUpdatedAt: typeof job.backendUpdatedAt === "string" ? job.backendUpdatedAt : null,
    createdAt: typeof job.createdAt === "string" ? job.createdAt : new Date().toISOString(),
    updatedAt: typeof job.updatedAt === "string" ? job.updatedAt : new Date().toISOString(),
    startedAt: typeof job.startedAt === "string" ? job.startedAt : null,
    finishedAt: typeof job.finishedAt === "string" ? job.finishedAt : null,
    lastError: typeof job.lastError === "string" ? job.lastError : "",
    resultSummary,
    progressSteps: cloneProgressSteps(job.progressSteps),
    logs: Array.isArray(job.logs)
      ? job.logs
          .filter((entry) => entry && typeof entry.message === "string")
          .map((entry) => ({
            id:
              typeof entry.id === "string"
                ? entry.id
                : `${entry.at || job.updatedAt}-${entry.level || "info"}`,
            level: typeof entry.level === "string" ? entry.level : "info",
            message: entry.message,
            at: typeof entry.at === "string" ? entry.at : job.updatedAt,
          }))
          .slice(-12)
      : [],
  };
}

function normalizeSyncJobState(state) {
  const base = createDefaultSyncJobState();
  if (!state || typeof state !== "object") {
    return base;
  }

  return {
    activeJob: normalizeSyncJob(state.activeJob),
    resumableJob: normalizeSyncJob(state.resumableJob),
    lastJob: normalizeSyncJob(state.lastJob),
    jobHistory: Array.isArray(state.jobHistory)
      ? state.jobHistory
          .map((job) => normalizeSyncJob(job))
          .filter(Boolean)
          .slice(0, SYNC_HISTORY_LIMIT)
      : [],
  };
}

export function mergeSyncJobHistory(history = [], job) {
  const normalizedJob = normalizeSyncJob(job);
  if (!normalizedJob) {
    return Array.isArray(history) ? history.map((entry) => normalizeSyncJob(entry)).filter(Boolean) : [];
  }

  const normalizedHistory = Array.isArray(history)
    ? history.map((entry) => normalizeSyncJob(entry)).filter(Boolean)
    : [];

  return [normalizedJob, ...normalizedHistory.filter((entry) => entry.id !== normalizedJob.id)].slice(
    0,
    SYNC_HISTORY_LIMIT,
  );
}

export function appendSyncJobLog(job, message, options = {}) {
  const current = normalizeSyncJob(job);
  if (!current) {
    return null;
  }

  const entry = createSyncLogEntry(message, options);

  return {
    ...current,
    logs: [...current.logs, entry].slice(-12),
    updatedAt: entry.at,
  };
}

export function updateSyncJobProgress(job, key, status, detail = "") {
  const current = normalizeSyncJob(job);
  if (!current) {
    return null;
  }

  return {
    ...current,
    currentStepKey: key || current.currentStepKey,
    updatedAt: new Date().toISOString(),
    progressSteps: current.progressSteps.map((step) =>
      step.key === key
        ? {
            ...step,
            status,
            detail,
          }
        : step
    ),
  };
}

export function setSyncJobStatus(job, status, extra = {}) {
  const current = normalizeSyncJob(job);
  if (!current) {
    return null;
  }

  return {
    ...current,
    ...extra,
    status,
    updatedAt: extra.updatedAt || new Date().toISOString(),
  };
}

export function markSyncJobResumable(job) {
  const interrupted = setSyncJobStatus(job, "resume_required", {
    finishedAt: null,
  });

  return appendSyncJobLog(
    interrupted,
    "Phát hiện job đồng bộ dang dở từ phiên trước. Bạn có thể tiếp tục lại cùng tham số đã lưu.",
    { level: "warn" }
  );
}

export function createSyncJob({
  actor = "system",
  manualRange = { from: "", to: "" },
  includeTaxCodes = [],
  excludeTaxCodes = [],
  mstFilterNotice = "",
}) {
  const now = new Date().toISOString();
  const job = {
    id: `ecus-sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actor,
    status: "queued",
    from: manualRange?.from || "",
    to: manualRange?.to || "",
    includeTaxCodes: Array.isArray(includeTaxCodes) ? includeTaxCodes.filter(Boolean) : [],
    excludeTaxCodes: Array.isArray(excludeTaxCodes) ? excludeTaxCodes.filter(Boolean) : [],
    mstFilterNotice,
    attemptCount: 0,
    currentStepKey: SYNC_PROGRESS_STEP_DEFS[0].key,
    backendJobId: "",
    backendJobStatus: "idle",
    backendUpdatedAt: null,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    finishedAt: null,
    lastError: "",
    progressSteps: createSyncProgressSteps(),
    logs: [],
  };

  return appendSyncJobLog(job, "Đã tạo job đồng bộ ECUS và lưu trạng thái để có thể tiếp tục sau khi reload.", {
    level: "info",
    at: now,
  });
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function readStoredSyncJobState() {
  if (!canUseLocalStorage()) {
    return createDefaultSyncJobState();
  }

  try {
    const raw = window.localStorage.getItem(SYNC_QUEUE_STORAGE_KEY);
    if (!raw) {
      return createDefaultSyncJobState();
    }

    const parsed = JSON.parse(raw);
    const normalized = normalizeSyncJobState(parsed);

    if (normalized.activeJob) {
      const resumableJob = markSyncJobResumable(normalized.activeJob);
      const nextState = {
        ...normalized,
        activeJob: null,
        resumableJob,
      };
      writeStoredSyncJobState(nextState);
      return nextState;
    }

    return normalized;
  } catch (error) {
    console.warn("Không thể đọc trạng thái job đồng bộ ECUS đã lưu", error);
    return createDefaultSyncJobState();
  }
}

export function writeStoredSyncJobState(state) {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    const normalized = normalizeSyncJobState(state);
    const hasPayload =
      normalized.activeJob ||
      normalized.resumableJob ||
      normalized.lastJob ||
      normalized.jobHistory.length > 0;

    if (!hasPayload) {
      window.localStorage.removeItem(SYNC_QUEUE_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(SYNC_QUEUE_STORAGE_KEY, JSON.stringify(normalized));
  } catch (error) {
    console.warn("Không thể lưu trạng thái job đồng bộ ECUS", error);
  }
}

export function clearStoredSyncJobState() {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(SYNC_QUEUE_STORAGE_KEY);
  } catch (error) {
    console.warn("Không thể xoá trạng thái job đồng bộ ECUS", error);
  }
}

export function getSyncRetryDelayMs(failureCount) {
  return SYNC_RETRY_DELAYS_MS[failureCount] ?? null;
}

export function isRetriableSyncError(error) {
  const message = error?.message || "";

  if (/^HTTP (5\d\d|429)\b/.test(message)) {
    return true;
  }

  return /fetch|network|timed? out|ECONN|Không thể gửi dữ liệu|Không thể kết nối/i.test(message);
}

export function formatRetryDelayLabel(delayMs) {
  if (!Number.isFinite(delayMs) || delayMs <= 0) {
    return "ngay bây giờ";
  }

  if (delayMs < 1000) {
    return `${delayMs} ms`;
  }

  if (delayMs % 1000 === 0) {
    return `${delayMs / 1000} giây`;
  }

  return `${(delayMs / 1000).toFixed(1)} giây`;
}
