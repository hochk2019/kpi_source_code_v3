import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_SYNC_CONFIG,
  formatMstListForInput,
  parseMstListInput,
} from "@/components/dataImporter/dataImporterConfig.js";
import {
  appendSyncJobLog,
  buildSyncPreflightChecks,
  createDefaultSyncJobState,
  createSyncJob,
  createSyncProgressSteps,
  formatRetryDelayLabel,
  getSyncRetryDelayMs,
  isRetriableSyncError,
  readStoredSyncJobState,
  SYNC_RETRY_DELAYS_MS,
  setSyncJobStatus,
  summarizeSyncPreflight,
  updateSyncJobProgress,
  writeStoredSyncJobState,
} from "@/components/dataImporter/dataImporterSyncQueue.js";
import { formatDateRangeLabel } from "../../../packages/domain/src/format.js";

const ECUS_CONFIG_ROUTE = "/api/v4/declarations/imports/ecus-config";
const ECUS_COMMIT_ROUTE = "/api/v4/declarations/imports/ecus-commit";
const ECUS_PREVIEW_ROUTE = "/api/v4/declarations/imports/ecus-preview";
const ECUS_STATUS_ROUTE = "/api/v4/declarations/imports/ecus-status";
const ALERTS_ROUTE = "/api/v4/declarations/imports/alerts";

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

export default function useDataImporterSync({
  actor = "system",
  canManageSync = false,
  fetchWithAuth,
  refreshDeclRowsFromServer,
  loadSavedRows,
  onAfterSyncSuccess,
}) {
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

    const { createdAt, from, to } = syncJobState.resumableJob;
    const createdLabel = createdAt ? new Date(createdAt).toLocaleString("vi-VN") : "không rõ thời gian";

    if (from && to) {
      return `Job lưu lúc ${createdLabel} cho khoảng ${from} → ${to}.`;
    }

    return `Job lưu lúc ${createdLabel} sẽ dùng RangeDays mặc định trong cấu hình.`;
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

  const waitForDelay = useCallback((delayMs) => {
    return new Promise((resolve) => {
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
    fetchSyncConfig();
    fetchAlerts();
    fetchSyncStatus();
  }, [fetchAlerts, fetchSyncConfig, fetchSyncStatus]);

  const handleSaveSyncConfig = useCallback(async () => {
    if (!canManageSync) {
      alert("Bạn không có quyền cập nhật cấu hình đồng bộ.");
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

    const persistActiveJob = (nextJob) => {
      workingJob = nextJob;
      setSyncProgressSteps(nextJob?.progressSteps || createSyncProgressSteps());
      updateSyncJobState((prev) => ({
        ...prev,
        activeJob: nextJob,
        resumableJob: prev?.resumableJob?.id === nextJob?.id ? null : prev?.resumableJob || null,
        lastJob: prev?.lastJob || null,
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
      let payload = null;

      for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
        persistActiveJob(
          setSyncJobStatus(workingJob, "running", {
            attemptCount: attempt,
            currentStepKey: "commit",
          })
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
            }),
            credentials: "include",
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          payload = await response.json();

          if (attempt > 1) {
            appendActivityLog(
              `Yêu cầu đồng bộ ECUS đã thành công ở lần ${attempt}/${totalAttempts}.`
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
            "warn"
          );
          updateSyncStep(
            "commit",
            "active",
            `Lần ${attempt}/${totalAttempts} thất bại (${commitError?.message || "Không rõ lỗi"}). Sẽ tự thử lại sau ${retryLabel}.`,
          );
          await waitForDelay(delayMs);
        }
      }

      const imported = payload?.result?.imported ?? 0;
      const updated = payload?.result?.updated ?? 0;
      const skipped = payload?.result?.skipped ?? 0;
      const locked = payload?.result?.reviewLocked ?? 0;
      const updatedNote = updated > 0 ? `, cập nhật ${updated} tờ khai đã có` : "";
      const skippedNote = skipped > 0 ? `, bỏ qua ${skipped} tờ khai đã có` : "";
      const lockedNote = locked > 0 ? `, khóa ${locked} tờ khai đã rà soát` : "";
      const attemptNote =
        workingJob.attemptCount > 1 ? ` Hoàn tất sau ${workingJob.attemptCount} lần thử.` : "";
      const baseMessage = `Đã đồng bộ ${imported} tờ khai mới từ ECUS${updatedNote}${skippedNote}${lockedNote}.${attemptNote}`;
      const messageParts = [baseMessage];

      if (workingJob.mstFilterNotice) {
        messageParts.push(`${workingJob.mstFilterNotice}.`);
      }

      updateSyncStep(
        "commit",
        "done",
        `Đã nhập ${imported} mới, cập nhật ${updated}, bỏ qua ${skipped}, khóa ${locked}.`,
      );
      appendActivityLog(
        `ECUS đã trả kết quả: nhập ${imported}, cập nhật ${updated}, bỏ qua ${skipped}, khóa ${locked}.`
      );
      setSyncMessage(messageParts.join(" ").replace(/\s+/g, " ").trim());

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
          "warn"
        );
        updateSyncStep(
          "refreshDeclRows",
          "error",
          refreshError?.message || "Không thể tải lại dữ liệu tờ khai từ server.",
        );
      }

      updateSyncStep("reloadSavedRows", "active", "Đang làm mới danh sách tờ khai trong giao diện.");
      loadSavedRows({ bypassConfirm: true });
      updateSyncStep(
        "reloadSavedRows",
        "done",
        "Danh sách tờ khai trên giao diện đã được làm mới.",
      );
      appendActivityLog("Danh sách tờ khai trong giao diện đã được làm mới.");

      persistFinishedJob(
        setSyncJobStatus(
          appendSyncJobLog(workingJob, "Job đồng bộ ECUS đã hoàn tất.", { level: "info" }),
          "completed",
          {
            finishedAt: new Date().toISOString(),
            lastError: "",
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
  ]);

  const handleRunSync = useCallback(async () => {
    if (!canManageSync) {
      alert("Bạn không có quyền chạy đồng bộ ECUS.");
      return false;
    }

    if (!syncPreflightSummary.ready) {
      setSyncMessage("");
      setSyncError("Checklist trước khi chạy chưa đạt yêu cầu. Hãy xử lý các mục đang báo lỗi rồi thử lại.");
      return false;
    }

    if (previewConflictWarningActive) {
      const confirmedOverwrite = window.confirm(
        buildOverwriteConfirmationMessage(previewConflictSummary),
      );
      if (!confirmedOverwrite) {
        return false;
      }
    }

    if (!manualRange.from && !manualRange.to) {
      const confirmDefault = window.confirm(
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
      alert("Bạn không có quyền xem trước dữ liệu đồng bộ.");
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
