import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppDialog } from "@/hooks/useAppDialog";

import { toast } from "@/shared/toast.js";
import {
  DEFAULT_SYNC_CONFIG,
  formatMstListForInput,
  parseMstListInput,
} from "@/components/dataImporter/dataImporterConfig.js";
import {
  appendSyncJobLog,
  buildSyncJobResultSummary,
  buildSyncPreflightChecks,
  createDefaultSyncJobState,
  createSyncJob,
  createSyncProgressSteps,
  formatRetryDelayLabel,
  getSyncRetryDelayMs,
  isRetriableSyncError,
  mergeSyncJobHistory,
  readStoredSyncJobState,
  SYNC_RETRY_DELAYS_MS,
  setSyncJobStatus,
  summarizeSyncPreflight,
  updateSyncJobProgress,
  writeStoredSyncJobState,
} from "@/components/dataImporter/dataImporterSyncQueue.js";
import { resolveNextSyncExecutionStep } from "@/components/dataImporter/dataImporterSyncResume.js";
import { formatDateRangeLabel } from "../../../packages/domain/src/format.js";

const ECUS_CONFIG_ROUTE = "/api/v4/declarations/imports/ecus-config";
const ECUS_COMMIT_ROUTE = "/api/v4/declarations/imports/ecus-commit";
const ECUS_COMMIT_JOB_ROUTE = "/api/v4/declarations/imports/ecus-jobs";
const ECUS_PREVIEW_ROUTE = "/api/v4/declarations/imports/ecus-preview";
const ECUS_STATUS_ROUTE = "/api/v4/declarations/imports/ecus-status";
const ALERTS_ROUTE = "/api/v4/declarations/imports/alerts";
const ECUS_COMMIT_POLL_BASE_DELAY_MS = 1000;
const ECUS_COMMIT_POLL_MAX_DELAY_MS = 10000;
const ECUS_COMMIT_POLL_MAX_ROUNDS = 60;

const DEFAULT_ALERT_SUMMARY = {
  outstanding: 0,
  totalTracked: 0,
  lastEvaluatedAt: null,
};

const DEFAULT_STATUS_INFO = {
  backend: null,
  database: null,
  checkedAt: null,
};

function buildMstFilterNotice(includeTaxCodes, excludeTaxCodes) {
  if (!includeTaxCodes.length && !excludeTaxCodes.length) {
    return "";
  }

  const parts = [];
  if (includeTaxCodes.length) {
    parts.push(`chỉ MST: ${includeTaxCodes.join(", ")}`);
  }
  if (excludeTaxCodes.length) {
    parts.push(`loại trừ MST: ${excludeTaxCodes.join(", ")}`);
  }

  return parts.length ? `Lọc theo ${parts.join("; ")}` : "";
}

function buildPreviewRequestKey({ from = "", to = "", includeTaxCodes = [], excludeTaxCodes = [] }) {
  return JSON.stringify({
    from,
    to,
    includeTaxCodes: [...includeTaxCodes].sort(),
    excludeTaxCodes: [...excludeTaxCodes].sort(),
  });
}

function summarizePreviewConflictRows(rows) {
  return (Array.isArray(rows) ? rows : []).reduce(
    (summary, row) => {
      summary.totalRows += 1;

      if (row?.status !== "existing") {
        summary.newCount += 1;
        return summary;
      }

      summary.existingCount += 1;

      if (row?.locked) {
        summary.lockedCount += 1;
        return summary;
      }

      if (Array.isArray(row?.changedFields) && row.changedFields.length > 0) {
        summary.overwriteCount += 1;
        return summary;
      }

      summary.unchangedCount += 1;
      return summary;
    },
    {
      totalRows: 0,
      newCount: 0,
      existingCount: 0,
      overwriteCount: 0,
      unchangedCount: 0,
      lockedCount: 0,
    },
  );
}

function buildOverwriteConfirmationMessage(summary) {
  const overwriteLine = `${summary.overwriteCount.toLocaleString(
    "vi-VN",
  )} tờ khai đã tồn tại sẽ bị cập nhật nếu bạn tiếp tục đồng bộ.`;
  const lockedLine =
    summary.lockedCount > 0
      ? `\n${summary.lockedCount.toLocaleString("vi-VN")} tờ khai đã khóa rà soát sẽ bị bỏ qua.`
      : "";
  const unchangedLine =
    summary.unchangedCount > 0
      ? `\n${summary.unchangedCount.toLocaleString("vi-VN")} tờ khai trùng nhưng không đổi sẽ được bỏ qua.`
      : "";

  return `Cảnh báo xung đột dữ liệu:\n${overwriteLine}${lockedLine}${unchangedLine}\n\nBạn có muốn tiếp tục không?`;
}

function buildSyncCompletionMessage(resultSummary, attemptCount = 0, mstFilterNotice = "") {
  const summary = buildSyncJobResultSummary(resultSummary);
  const updatedNote = summary.updated > 0 ? `, cập nhật ${summary.updated} tờ khai đã có` : "";
  const skippedNote = summary.skipped > 0 ? `, bỏ qua ${summary.skipped} tờ khai đã có` : "";
  const lockedNote =
    summary.reviewLocked > 0 ? `, khóa ${summary.reviewLocked} tờ khai đã rà soát` : "";
  const attemptNote = attemptCount > 1 ? ` Hoàn tất sau ${attemptCount} lần thử.` : "";
  const messageParts = [
    `Đã đồng bộ ${summary.imported} tờ khai mới từ ECUS${updatedNote}${skippedNote}${lockedNote}.${attemptNote}`,
  ];

  if (mstFilterNotice) {
    messageParts.push(`${mstFilterNotice}.`);
  }

  return messageParts.join(" ").replace(/\s+/g, " ").trim();
}

function normalizeCommitJobStatus(status) {
  if (typeof status !== "string") {
    return "unknown";
  }
  const normalized = status.trim().toLowerCase();
  if (["queued", "running", "completed", "failed"].includes(normalized)) {
    return normalized;
  }
  return "unknown";
}

function pickCommitJobError(jobPayload) {
  const nestedMessage =
    typeof jobPayload?.error?.message === "string" && jobPayload.error.message.trim()
      ? jobPayload.error.message.trim()
      : "";
  if (nestedMessage) {
    return nestedMessage;
  }

  if (typeof jobPayload?.lastError === "string" && jobPayload.lastError.trim()) {
    return jobPayload.lastError.trim();
  }

  return "Job đồng bộ ECUS thất bại.";
}

export default function useDataImporterSync({
  actor = "system",
  canManageSync = false,
  fetchWithAuth,
  refreshDeclRowsFromServer,
  loadSavedRows,
  onAfterSyncSuccess,
}) {
  const { confirm } = useAppDialog();
  const [syncConfig, setSyncConfig] = useState(() => ({ ...DEFAULT_SYNC_CONFIG }));
  const [syncForm, setSyncForm] = useState(() => ({
    enabled: DEFAULT_SYNC_CONFIG.enabled,
    schedule: DEFAULT_SYNC_CONFIG.schedule,
    rangeDays: DEFAULT_SYNC_CONFIG.rangeDays,
    preferMonthFirst: DEFAULT_SYNC_CONFIG.preferMonthFirst,
    server: DEFAULT_SYNC_CONFIG.connection.server,
    database: DEFAULT_SYNC_CONFIG.connection.database,
    user: DEFAULT_SYNC_CONFIG.connection.user,
    password: "",
    hasPassword: !!DEFAULT_SYNC_CONFIG.connection.hasPassword,
    includeTaxCodesText: formatMstListForInput(DEFAULT_SYNC_CONFIG.includeTaxCodes),
    excludeTaxCodesText: formatMstListForInput(DEFAULT_SYNC_CONFIG.excludeTaxCodes),
  }));
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncError, setSyncError] = useState("");
  const [manualRange, setManualRange] = useState({ from: "", to: "" });
  const [alertSummary, setAlertSummary] = useState(DEFAULT_ALERT_SUMMARY);
  const [alertEntries, setAlertEntries] = useState([]);
  const [alertLoading, setAlertLoading] = useState(false);
  const [statusInfo, setStatusInfo] = useState(DEFAULT_STATUS_INFO);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [previewRows, setPreviewRows] = useState([]);
  const [previewLimited, setPreviewLimited] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewRangeInfo, setPreviewRangeInfo] = useState(null);
  const [previewHash, setPreviewHash] = useState("");
  const [previewRequestKey, setPreviewRequestKey] = useState("");
  const [syncProgressSteps, setSyncProgressSteps] = useState(() => createSyncProgressSteps());
  const [syncJobState, setSyncJobState] = useState(() => readStoredSyncJobState());

  const previewRangeLabel = useMemo(() => formatDateRangeLabel(previewRangeInfo), [previewRangeInfo]);

  const activeIncludeTaxCodes = useMemo(
    () => parseMstListInput(syncForm?.includeTaxCodesText || []),
    [syncForm?.includeTaxCodesText]
  );

  const activeExcludeTaxCodes = useMemo(
    () => parseMstListInput(syncForm?.excludeTaxCodesText || []),
    [syncForm?.excludeTaxCodesText]
  );

  const mstFilterNotice = useMemo(
    () => buildMstFilterNotice(activeIncludeTaxCodes, activeExcludeTaxCodes),
    [activeExcludeTaxCodes, activeIncludeTaxCodes]
  );

  const currentPreviewRequestKey = useMemo(
    () =>
      buildPreviewRequestKey({
        from: manualRange.from,
        to: manualRange.to,
        includeTaxCodes: activeIncludeTaxCodes,
        excludeTaxCodes: activeExcludeTaxCodes,
      }),
    [activeExcludeTaxCodes, activeIncludeTaxCodes, manualRange.from, manualRange.to],
  );

  const previewConflictSummary = useMemo(
    () => summarizePreviewConflictRows(previewRows),
    [previewRows],
  );

  const previewConflictWarningActive = useMemo(
    () =>
      previewRequestKey === currentPreviewRequestKey && previewConflictSummary.overwriteCount > 0,
    [currentPreviewRequestKey, previewConflictSummary.overwriteCount, previewRequestKey],
  );

  const visibleSyncJob = useMemo(
    () => syncJobState.activeJob || syncJobState.resumableJob || syncJobState.lastJob || null,
    [syncJobState.activeJob, syncJobState.lastJob, syncJobState.resumableJob]
  );

  const syncHistory = useMemo(
    () => (Array.isArray(syncJobState.jobHistory) ? syncJobState.jobHistory : []),
    [syncJobState.jobHistory],
  );

  const syncPreflightChecks = useMemo(
    () =>
      buildSyncPreflightChecks({
        statusInfo,
        syncForm,
        manualRange,
      }),
    [manualRange, statusInfo, syncForm]
  );

  const syncPreflightSummary = useMemo(
    () => summarizeSyncPreflight(syncPreflightChecks),
    [syncPreflightChecks]
  );

  const syncActivityLog = useMemo(
    () => (Array.isArray(visibleSyncJob?.logs) ? visibleSyncJob.logs : []),
    [visibleSyncJob]
  );

  const syncResumeLabel = useMemo(() => {
    if (!syncJobState.resumableJob) {
      return "";
    }

    const { createdAt, from, to, progressSteps } = syncJobState.resumableJob;
    const createdLabel = createdAt ? new Date(createdAt).toLocaleString("vi-VN") : "không rõ thời gian";
    const resumeStep = resolveNextSyncExecutionStep(progressSteps);
    const resumeStepNote = resumeStep ? ` Tiếp tục từ bước: ${resumeStep.label}.` : "";

    if (from && to) {
      return `Job lưu lúc ${createdLabel} cho khoảng ${from} → ${to}.${resumeStepNote}`;
    }

    return `Job lưu lúc ${createdLabel} sẽ dùng RangeDays mặc định trong cấu hình.${resumeStepNote}`;
  }, [syncJobState.resumableJob]);

  const applyConfigToForm = useCallback((config) => {
    const normalizedConfig = {
      ...DEFAULT_SYNC_CONFIG,
      ...(config && typeof config === "object" ? config : {}),
      connection: {
        ...DEFAULT_SYNC_CONFIG.connection,
        ...((config && typeof config === "object" && config.connection && typeof config.connection === "object")
          ? config.connection
          : {}),
      },
    };

    setSyncConfig(normalizedConfig);
    setSyncForm({
      enabled: !!normalizedConfig.enabled,
      schedule: normalizedConfig.schedule || "0 * * * *",
      rangeDays: normalizedConfig.rangeDays ?? 1,
      preferMonthFirst: !!normalizedConfig.preferMonthFirst,
      server: normalizedConfig.connection?.server || "",
      database: normalizedConfig.connection?.database || "",
      user: normalizedConfig.connection?.user || "",
      password: "",
      hasPassword: !!normalizedConfig.connection?.hasPassword,
      includeTaxCodesText: formatMstListForInput(normalizedConfig.includeTaxCodes),
      excludeTaxCodesText: formatMstListForInput(normalizedConfig.excludeTaxCodes),
    });
  }, []);

  const updateSyncJobState = useCallback((updater) => {
    setSyncJobState((prev) => {
      const nextState =
        typeof updater === "function"
          ? updater(prev || createDefaultSyncJobState())
          : updater || createDefaultSyncJobState();

      writeStoredSyncJobState(nextState);
      return nextState;
    });
  }, []);

  const syncCancelledRef = useRef(false);

  useEffect(() => {
    syncCancelledRef.current = false;
    return () => { syncCancelledRef.current = true; };
  }, []);

  const waitForDelay = useCallback((delayMs) => {
    return new Promise((resolve) => {
      if (syncCancelledRef.current) { resolve(); return; }
      window.setTimeout(resolve, delayMs);
    });
  }, []);

  useEffect(() => {
    const nextSteps =
      Array.isArray(visibleSyncJob?.progressSteps) && visibleSyncJob.progressSteps.length
        ? visibleSyncJob.progressSteps
        : createSyncProgressSteps();

    setSyncProgressSteps(nextSteps);
  }, [visibleSyncJob]);

  useEffect(() => {
    if (!syncJobState.resumableJob || syncRunning) {
      return;
    }

    setSyncMessage((prev) =>
      prev ||
      "Đã phát hiện một job đồng bộ dang dở từ phiên trước. Bạn có thể tiếp tục lại với đúng tham số đã lưu."
    );
  }, [syncJobState.resumableJob, syncRunning]);

  useEffect(() => {
    setPreviewRows([]);
    setPreviewLimited(false);
    setPreviewError("");
    setPreviewRequestKey("");
    setPreviewRangeInfo(null);
  }, [
    activeExcludeTaxCodes,
    activeIncludeTaxCodes,
    manualRange.from,
    manualRange.to,
  ]);

  const fetchSyncConfig = useCallback(async (options = {}) => {
    const { preserveMessage = false } = options;
    setSyncLoading(true);
    setSyncError("");

    try {
      const response = await fetchWithAuth(ECUS_CONFIG_ROUTE, {
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      if (payload?.config) {
        applyConfigToForm(payload.config);
        if (!preserveMessage) {
          setSyncMessage("Đã tải cấu hình đồng bộ mới nhất.");
        }
      } else {
        if (!preserveMessage) {
          setSyncMessage("Không tìm thấy cấu hình lưu trữ, sử dụng giá trị mặc định.");
        }
        applyConfigToForm(DEFAULT_SYNC_CONFIG);
      }
    } catch (err) {
      console.error("Không thể tải cấu hình đồng bộ ECUS", err);
      setSyncError(
        "Không thể tải cấu hình đồng bộ ECUS. Hãy kiểm tra dịch vụ backend (pnpm server) hoặc kết nối mạng LAN."
      );
      if (!preserveMessage) {
        setSyncMessage("");
      }
      applyConfigToForm(DEFAULT_SYNC_CONFIG);
    } finally {
      setSyncLoading(false);
    }
  }, [applyConfigToForm, fetchWithAuth]);

  const fetchSyncStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError("");

    try {
      const response = await fetchWithAuth(ECUS_STATUS_ROUTE, {
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      setStatusInfo({
        backend: payload?.backend || null,
        database: payload?.database || null,
        checkedAt: payload?.database?.checkedAt || payload?.backend?.checkedAt || new Date().toISOString(),
      });

      if (payload?.config) {
        applyConfigToForm(payload.config);
      }
    } catch (err) {
      console.error("Không thể tải trạng thái đồng bộ", err);
      setStatusError("Không thể kiểm tra kết nối backend/SQL Server.");
    } finally {
      setStatusLoading(false);
    }
  }, [applyConfigToForm, fetchWithAuth]);

  const fetchAlerts = useCallback(async () => {
    setAlertLoading(true);

    try {
      const response = await fetchWithAuth(ALERTS_ROUTE, {
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      if (payload?.alerts) {
        setAlertEntries(Array.isArray(payload.alerts) ? payload.alerts : []);
      }
      if (payload?.summary) {
        setAlertSummary(payload.summary);
      }
    } catch (err) {
      console.error("Không thể tải cảnh báo tờ khai", err);
    } finally {
      setAlertLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    Promise.allSettled([fetchSyncConfig(), fetchAlerts(), fetchSyncStatus()]);
  }, [fetchAlerts, fetchSyncConfig, fetchSyncStatus]);

  const handleSaveSyncConfig = useCallback(async () => {
    if (!canManageSync) {
      toast?.error?.("Bạn không có quyền cập nhật cấu hình đồng bộ.");
      return;
    }

    if (!syncForm) return;

    setSyncLoading(true);
    setSyncMessage("");
    setSyncError("");

    try {
      const includeTaxCodes = activeIncludeTaxCodes;
      const excludeTaxCodes = activeExcludeTaxCodes;
      const payload = {
        config: {
          enabled: !!syncForm.enabled,
          schedule: syncForm.schedule || "0 * * * *",
          rangeDays: Number(syncForm.rangeDays) || 1,
          preferMonthFirst: !!syncForm.preferMonthFirst,
          connection: {
            server: syncForm.server || "",
            database: syncForm.database || "",
            user: syncForm.user || "",
          },
          includeTaxCodes,
          excludeTaxCodes,
        },
        preservePassword: !syncForm.password && syncForm.hasPassword,
      };

      if (syncForm.password) {
        payload.config.connection.password = syncForm.password;
      }
      if (syncConfig?.columnMap) {
        payload.config.columnMap = syncConfig.columnMap;
      }

      const response = await fetchWithAuth(ECUS_CONFIG_ROUTE, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const next = await response.json();
      if (next?.config) {
        applyConfigToForm(next.config);
        setSyncMessage("Đã lưu cấu hình đồng bộ ECUS.");
      }
    } catch (err) {
      console.error("Không thể lưu cấu hình ECUS", err);
      setSyncError(err?.message || "Không thể lưu cấu hình đồng bộ");
    } finally {
      setSyncLoading(false);
    }
  }, [
    activeExcludeTaxCodes,
    activeIncludeTaxCodes,
    applyConfigToForm,
    canManageSync,
    fetchWithAuth,
    syncConfig,
    syncForm,
  ]);

  const executeSyncJob = useCallback(async (job, options = {}) => {
    if (!job) {
      return false;
    }

    const totalAttempts = 1 + SYNC_RETRY_DELAYS_MS.length;

    setSyncRunning(true);
    setSyncMessage("");
    setSyncError("");
    setPreviewRows([]);
    setPreviewRangeInfo(null);
    setPreviewLimited(false);
    setPreviewError("");
    setPreviewRequestKey("");

    let currentStepKey = "commit";
    let workingJob = setSyncJobStatus(job, "running", {
      startedAt: job.startedAt || new Date().toISOString(),
      finishedAt: null,
      lastError: "",
    });
    let resultSummary = workingJob?.resultSummary
      ? buildSyncJobResultSummary(workingJob.resultSummary)
      : null;

    const persistActiveJob = (nextJob) => {
      workingJob = nextJob;
      setSyncProgressSteps(nextJob?.progressSteps || createSyncProgressSteps());
      updateSyncJobState((prev) => ({
        ...prev,
        activeJob: nextJob,
        resumableJob: prev?.resumableJob?.id === nextJob?.id ? null : prev?.resumableJob || null,
        lastJob: prev?.lastJob || null,
        jobHistory: prev?.jobHistory || [],
      }));
      return nextJob;
    };

    const persistFinishedJob = (nextJob) => {
      workingJob = nextJob;
      setSyncProgressSteps(nextJob?.progressSteps || createSyncProgressSteps());
      updateSyncJobState((prev) => ({
        ...prev,
        activeJob: null,
        resumableJob: null,
        lastJob: nextJob,
        jobHistory: mergeSyncJobHistory(prev?.jobHistory, nextJob),
      }));
      return nextJob;
    };

    const updateWorkingJob = (transformer) => {
      const nextJob = transformer(workingJob);
      return persistActiveJob(nextJob || workingJob);
    };

    const appendActivityLog = (message, level = "info") => {
      updateWorkingJob((current) => appendSyncJobLog(current, message, { level }));
    };

    const updateSyncStep = (key, status, detail = "") => {
      currentStepKey = key;
      updateWorkingJob((current) => updateSyncJobProgress(current, key, status, detail));
    };

    persistActiveJob(
      appendSyncJobLog(
        workingJob,
        options.resumed
          ? "Đang tiếp tục job đồng bộ ECUS đã lưu từ phiên trước."
          : "Bắt đầu chạy job đồng bộ ECUS.",
        { level: "info" }
      )
    );

    try {
      const stepKeys = ["commit", "reconcile", "refreshDeclRows", "reloadSavedRows"];
      const resumeStep = options.resumed ? resolveNextSyncExecutionStep(workingJob.progressSteps) : null;

      if (options.resumed && resumeStep) {
        currentStepKey = resumeStep.key;
        appendActivityLog(`Tiếp tục job từ bước "${resumeStep.label}".`);
      }

      if (options.resumed && !resumeStep) {
        const completedMessage = buildSyncCompletionMessage(
          resultSummary,
          workingJob.attemptCount,
          workingJob.mstFilterNotice,
        );
        persistFinishedJob(
          setSyncJobStatus(
            appendSyncJobLog(workingJob, "Job đồng bộ ECUS đã được tiếp tục và không còn bước nào chờ xử lý.", {
              level: "info",
            }),
            "completed",
            {
              finishedAt: new Date().toISOString(),
              lastError: "",
              resultSummary,
            },
          ),
        );
        setSyncMessage(completedMessage);
        setSyncError("");
        return true;
      }

      const startStepIndex = Math.max(
        0,
        stepKeys.findIndex((stepKey) => stepKey === currentStepKey),
      );
      const remainingStepKeys = stepKeys.slice(startStepIndex);

      if (remainingStepKeys.includes("commit")) {
        let payload = null;
        const readCommitJobStatus = async (jobId) => {
          const response = await fetchWithAuth(
            `${ECUS_COMMIT_JOB_ROUTE}/${encodeURIComponent(jobId)}`,
            {
              cache: "no-store",
              credentials: "include",
            },
          );

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const responsePayload = await response.json();
          if (!responsePayload?.job) {
            throw new Error("Phản hồi job đồng bộ ECUS không hợp lệ.");
          }
          return responsePayload.job;
        };

        const waitForCommitJobCompletion = async (jobId) => {
          for (let round = 1; round <= ECUS_COMMIT_POLL_MAX_ROUNDS; round += 1) {
            const remoteJob = await readCommitJobStatus(jobId);
            const remoteStatus = normalizeCommitJobStatus(remoteJob?.status);

            persistActiveJob(
              setSyncJobStatus(workingJob, "running", {
                backendJobId: jobId,
                backendJobStatus: remoteStatus,
                backendUpdatedAt: remoteJob?.updatedAt || new Date().toISOString(),
              }),
            );

            if (remoteStatus === "completed") {
              return remoteJob?.result || null;
            }

            if (remoteStatus === "failed") {
              throw new Error(pickCommitJobError(remoteJob));
            }

            updateSyncStep(
              "commit",
              "active",
              `Job đồng bộ đang xử lý trên backend (${round}/${ECUS_COMMIT_POLL_MAX_ROUNDS}).`,
            );

            if (round >= ECUS_COMMIT_POLL_MAX_ROUNDS) {
              throw new Error("Job đồng bộ ECUS đang chạy quá lâu. Hãy resume lại để tiếp tục theo dõi.");
            }

            const backoffDelay = Math.min(
              ECUS_COMMIT_POLL_BASE_DELAY_MS * Math.pow(2, round - 1),
              ECUS_COMMIT_POLL_MAX_DELAY_MS,
            );
            const jitter = backoffDelay * (0.5 + Math.random() * 0.5);
            await waitForDelay(Math.round(jitter));
          }

          return null;
        };

        let shouldStartNewCommit = true;
        const hasDetachedCommitJob = Boolean(options.resumed && workingJob.backendJobId);
        if (hasDetachedCommitJob) {
          const detachedJobId = workingJob.backendJobId;
          appendActivityLog(
            `Phát hiện job backend ${detachedJobId}. Tiếp tục theo dõi trạng thái thay vì gửi lại yêu cầu commit.`,
          );
          updateSyncStep("commit", "active", "Đang đồng bộ lại trạng thái job backend đã lưu.");

          try {
            payload = {
              result: await waitForCommitJobCompletion(detachedJobId),
            };
            shouldStartNewCommit = false;
          } catch (detachedError) {
            if (!/^HTTP 404\b/.test(detachedError?.message || "")) {
              throw detachedError;
            }

            appendActivityLog(
              "Job backend đã lưu không còn tồn tại trên server. Hệ thống sẽ gửi lại commit từ snapshot hiện tại.",
              "warn",
            );
            persistActiveJob(
              setSyncJobStatus(workingJob, "running", {
                backendJobId: "",
                backendJobStatus: "missing",
                backendUpdatedAt: new Date().toISOString(),
              }),
            );
          }
        }

        if (shouldStartNewCommit) {
          for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
            persistActiveJob(
              setSyncJobStatus(workingJob, "running", {
                attemptCount: attempt,
                currentStepKey: "commit",
                backendJobStatus: "starting",
                backendUpdatedAt: new Date().toISOString(),
              }),
            );

            updateSyncStep(
              "commit",
              "active",
              attempt === 1
                ? "Đang gửi yêu cầu đồng bộ tới ECUS."
                : `Đang thử lại lần ${attempt}/${totalAttempts}.`,
            );
            appendActivityLog(`Gửi yêu cầu đồng bộ ECUS lần ${attempt}/${totalAttempts}.`);

            try {
              const response = await fetchWithAuth(ECUS_COMMIT_ROUTE, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  actor: workingJob.actor || actor,
                  from: workingJob.from || undefined,
                  to: workingJob.to || undefined,
                  includeTaxCodes: workingJob.includeTaxCodes || [],
                  excludeTaxCodes: workingJob.excludeTaxCodes || [],
                  previewHash: previewHash || undefined,
                  async: true,
                }),
                credentials: "include",
              });

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
              }

              payload = await response.json();

              const startedJobId =
                typeof payload?.job?.id === "string" && payload.job.id.trim()
                  ? payload.job.id.trim()
                  : "";
              if (startedJobId) {
                appendActivityLog(`Đã tạo job backend ${startedJobId}. Đang theo dõi tiến trình.`);
                persistActiveJob(
                  setSyncJobStatus(workingJob, "running", {
                    backendJobId: startedJobId,
                    backendJobStatus: normalizeCommitJobStatus(payload?.job?.status),
                    backendUpdatedAt: payload?.job?.updatedAt || new Date().toISOString(),
                  }),
                );
                payload = {
                  ...payload,
                  result: await waitForCommitJobCompletion(startedJobId),
                };
              }

              if (attempt > 1) {
                appendActivityLog(
                  `Yêu cầu đồng bộ ECUS đã thành công ở lần ${attempt}/${totalAttempts}.`,
                );
              }
              break;
            } catch (commitError) {
              const delayMs = isRetriableSyncError(commitError)
                ? getSyncRetryDelayMs(attempt - 1)
                : null;

              if (!delayMs || attempt >= totalAttempts) {
                throw commitError;
              }

              const retryLabel = formatRetryDelayLabel(delayMs);
              appendActivityLog(
                `Lần ${attempt}/${totalAttempts} thất bại: ${commitError?.message || "Không rõ lỗi"}. Sẽ thử lại sau ${retryLabel}.`,
                "warn",
              );
              updateSyncStep(
                "commit",
                "active",
                `Lần ${attempt}/${totalAttempts} thất bại (${commitError?.message || "Không rõ lỗi"}). Sẽ tự thử lại sau ${retryLabel}.`,
              );
              await waitForDelay(delayMs);
            }
          }
        }

        resultSummary = buildSyncJobResultSummary(payload?.result);
        persistActiveJob(
          setSyncJobStatus(workingJob, "running", {
            resultSummary,
            backendJobStatus: "completed",
          }),
        );
        updateSyncStep(
          "commit",
          "done",
          `Đã nhập ${resultSummary.imported} mới, cập nhật ${resultSummary.updated}, bỏ qua ${resultSummary.skipped}, khóa ${resultSummary.reviewLocked}.`,
        );
        appendActivityLog(
          `ECUS đã trả kết quả: nhập ${resultSummary.imported}, cập nhật ${resultSummary.updated}, bỏ qua ${resultSummary.skipped}, khóa ${resultSummary.reviewLocked}.`,
        );
        setSyncMessage(
          buildSyncCompletionMessage(resultSummary, workingJob.attemptCount, workingJob.mstFilterNotice),
        );
      } else if (resultSummary) {
        setSyncMessage(
          buildSyncCompletionMessage(resultSummary, workingJob.attemptCount, workingJob.mstFilterNotice),
        );
      }

      if (remainingStepKeys.includes("reconcile")) {
        updateSyncStep(
          "reconcile",
          "active",
          "Đang tải lại cấu hình, trạng thái kết nối và cảnh báo sau khi đồng bộ.",
        );
        appendActivityLog("Đang đồng bộ lại cấu hình, trạng thái kết nối và cảnh báo.");
        await fetchSyncConfig({ preserveMessage: true });
        await fetchSyncStatus();
        await fetchAlerts();
        if (typeof onAfterSyncSuccess === "function") {
          await onAfterSyncSuccess();
        }
        updateSyncStep("reconcile", "done", "Đã làm mới cấu hình, trạng thái kết nối và cảnh báo.");
      }

      if (remainingStepKeys.includes("refreshDeclRows")) {
        updateSyncStep("refreshDeclRows", "active", "Đang tải lại dữ liệu tờ khai từ server.");
        try {
          const refreshedRows = await refreshDeclRowsFromServer();
          const refreshedCount = Array.isArray(refreshedRows) ? refreshedRows.length : null;
          updateSyncStep(
            "refreshDeclRows",
            "done",
            refreshedCount === null
              ? "Đã tải lại dữ liệu tờ khai từ server."
              : `Đã tải ${refreshedCount.toLocaleString("vi-VN")} tờ khai từ server.`,
          );
        } catch (refreshError) {
          console.error("Không thể tải dữ liệu tờ khai sau đồng bộ", refreshError);
          appendActivityLog(
            `Bỏ qua lỗi khi tải lại dữ liệu tờ khai: ${refreshError?.message || "Không rõ lỗi"}.`,
            "warn",
          );
          updateSyncStep(
            "refreshDeclRows",
            "error",
            refreshError?.message || "Không thể tải lại dữ liệu tờ khai từ server.",
          );
        }
      }

      if (remainingStepKeys.includes("reloadSavedRows")) {
        updateSyncStep("reloadSavedRows", "active", "Đang làm mới danh sách tờ khai trong giao diện.");
        loadSavedRows({ bypassConfirm: true });
        updateSyncStep(
          "reloadSavedRows",
          "done",
          "Danh sách tờ khai trên giao diện đã được làm mới.",
        );
        appendActivityLog("Danh sách tờ khai trong giao diện đã được làm mới.");
      }

      persistFinishedJob(
        setSyncJobStatus(
          appendSyncJobLog(workingJob, "Job đồng bộ ECUS đã hoàn tất.", { level: "info" }),
          "completed",
          {
            finishedAt: new Date().toISOString(),
            lastError: "",
            resultSummary,
          }
        )
      );
      setSyncError("");
      return true;
    } catch (err) {
      console.error("Đồng bộ ECUS thất bại", err);
      updateSyncStep(
        currentStepKey,
        "error",
        err?.message || "Không thể hoàn tất bước đồng bộ hiện tại.",
      );
      const failedJob = setSyncJobStatus(
        appendSyncJobLog(
          workingJob,
          `Job đồng bộ ECUS thất bại: ${err?.message || "Không rõ lỗi"}.`,
          { level: "error" }
        ),
        "failed",
        {
          finishedAt: new Date().toISOString(),
          lastError: err?.message || "Không thể đồng bộ ECUS",
        }
      );
      persistFinishedJob(failedJob);
      setSyncMessage("");
      setSyncError(err?.message || "Không thể đồng bộ ECUS");
      return false;
    } finally {
      setSyncRunning(false);
    }
  }, [
    actor,
    fetchAlerts,
    fetchSyncConfig,
    fetchSyncStatus,
    fetchWithAuth,
    loadSavedRows,
    onAfterSyncSuccess,
    refreshDeclRowsFromServer,
    updateSyncJobState,
    waitForDelay,
    previewHash,
  ]);

  const handleRunSync = useCallback(async () => {
    if (!canManageSync) {
      toast?.error?.("Bạn không có quyền chạy đồng bộ ECUS.");
      return false;
    }

    if (!syncPreflightSummary.ready) {
      setSyncMessage("");
      setSyncError("Checklist trước khi chạy chưa đạt yêu cầu. Hãy xử lý các mục đang báo lỗi rồi thử lại.");
      return false;
    }

    if (previewConflictWarningActive) {
      const confirmedOverwrite = await confirm(
        buildOverwriteConfirmationMessage(previewConflictSummary),
      );
      if (!confirmedOverwrite) {
        return false;
      }
    }

    if (!manualRange.from && !manualRange.to) {
      const confirmDefault = await confirm(
        "Bạn chưa chọn khoảng thời gian cụ thể. Hệ thống sẽ dùng số ngày mặc định trong cấu hình (RangeDays). Bạn có muốn tiếp tục?"
      );
      if (!confirmDefault) {
        return false;
      }
    }

    const job = createSyncJob({
      actor,
      manualRange,
      includeTaxCodes: activeIncludeTaxCodes,
      excludeTaxCodes: activeExcludeTaxCodes,
      mstFilterNotice,
    });

    updateSyncJobState((prev) => ({
      ...prev,
      activeJob: null,
      resumableJob: null,
      lastJob: prev?.lastJob || null,
      jobHistory: prev?.jobHistory || [],
    }));

    return executeSyncJob(job, { resumed: false });
  }, [
    activeExcludeTaxCodes,
    activeIncludeTaxCodes,
    actor,
    canManageSync,
    executeSyncJob,
    manualRange,
    mstFilterNotice,
    previewConflictSummary,
    previewConflictWarningActive,
    syncPreflightSummary.ready,
    updateSyncJobState,
    confirm,
  ]);

  const handleResumeSync = useCallback(async () => {
    if (!syncJobState.resumableJob) {
      return false;
    }

    if (!syncPreflightSummary.ready) {
      setSyncMessage("");
      setSyncError("Checklist trước khi resume chưa đạt yêu cầu. Hãy xử lý các mục đang báo lỗi rồi thử lại.");
      return false;
    }

    setManualRange({
      from: syncJobState.resumableJob.from || "",
      to: syncJobState.resumableJob.to || "",
    });
    setSyncForm((prev) => ({
      ...prev,
      includeTaxCodesText: formatMstListForInput(syncJobState.resumableJob.includeTaxCodes),
      excludeTaxCodesText: formatMstListForInput(syncJobState.resumableJob.excludeTaxCodes),
    }));

    return executeSyncJob(syncJobState.resumableJob, { resumed: true });
  }, [
    executeSyncJob,
    setSyncForm,
    syncJobState.resumableJob,
    syncPreflightSummary.ready,
  ]);

  const handlePreviewSync = useCallback(async () => {
    if (!canManageSync) {
      toast?.error?.("Bạn không có quyền xem trước dữ liệu đồng bộ.");
      return { ok: false, denied: true };
    }

    setPreviewLoading(true);
    setPreviewError("");

    try {
      const response = await fetchWithAuth(ECUS_PREVIEW_ROUTE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: manualRange.from || undefined,
          to: manualRange.to || undefined,
          limit: 100,
          includeTaxCodes: activeIncludeTaxCodes,
          excludeTaxCodes: activeExcludeTaxCodes,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const rows = Array.isArray(payload?.preview?.rows) ? payload.preview.rows : [];
      const fetched = Number.isFinite(Number(payload?.preview?.fetched))
        ? Number(payload.preview.fetched)
        : rows.length;

      setPreviewRows(rows);
      setPreviewLimited(!!payload?.preview?.limited);
      setPreviewRequestKey(currentPreviewRequestKey);
      setPreviewRangeInfo(payload?.preview?.range || null);
      setPreviewHash(typeof payload?.preview?.previewHash === "string" ? payload.preview.previewHash : "");

      if (!rows.length) {
        const baseMessage = "Không tìm thấy tờ khai mới trong khoảng thời gian đã chọn.";
        setPreviewError(mstFilterNotice ? `${baseMessage} (${mstFilterNotice}).` : baseMessage);
      }

      return {
        ok: true,
        rows,
        fetched,
        limited: !!payload?.preview?.limited,
        range: payload?.preview?.range || null,
      };
    } catch (err) {
      console.error("Không thể xem trước dữ liệu ECUS", err);
      setPreviewError(err?.message || "Không thể xem trước dữ liệu đồng bộ");
      setPreviewRows([]);
      setPreviewLimited(false);
      setPreviewRequestKey("");
      setPreviewRangeInfo(null);
      setPreviewHash("");
      return { ok: false, error: err };
    } finally {
      setPreviewLoading(false);
    }
  }, [
    activeExcludeTaxCodes,
    activeIncludeTaxCodes,
    canManageSync,
    currentPreviewRequestKey,
    fetchWithAuth,
    manualRange.from,
    manualRange.to,
    mstFilterNotice,
  ]);

  const handleRefreshAlerts = useCallback(() => {
    return fetchAlerts();
  }, [fetchAlerts]);

  const handleManualRangeChange = useCallback((field, value) => {
    setManualRange((prev) => ({ ...prev, [field]: value }));
  }, []);

  return {
    syncConfig,
    syncForm,
    setSyncForm,
    syncLoading,
    syncRunning,
    syncMessage,
    syncError,
    manualRange,
    setManualRange,
    handleManualRangeChange,
    alertSummary,
    alertEntries,
    alertLoading,
    statusInfo,
    statusLoading,
    statusError,
    previewRows,
    previewLimited,
    previewLoading,
    previewError,
    previewRangeInfo,
    previewRangeLabel,
    previewConflictSummary,
    previewConflictWarningActive,
    syncProgressSteps,
    syncPreflightChecks,
    syncPreflightSummary,
    syncActivityLog,
    syncHistory,
    syncResumeJob: syncJobState.resumableJob,
    syncResumeLabel,
    activeIncludeTaxCodes,
    activeExcludeTaxCodes,
    mstFilterNotice,
    fetchSyncConfig,
    fetchSyncStatus,
    handleRefreshAlerts,
    handleSaveSyncConfig,
    handleRunSync,
    handleResumeSync,
    handlePreviewSync,
  };
}
