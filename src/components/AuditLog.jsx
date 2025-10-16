import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/shared/toast";
import { fetchWithAuth } from '@/auth/localAuth.js';

import { getAuditLogs, clearAuditLogs } from "@/lib/store.js";
import {
  BACKUP_REASON_LABELS,
  translateBackupFailure,
} from '@/shared/backupMessages.js';

function formatTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("vi-VN", {
      hour12: false,
    });
  } catch {
    return value;
  }
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const display = size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1);
  return `${display} ${units[unitIndex]}`;
}

function inferCategoryFromAction(action) {
  if (typeof action !== "string" || !action) {
    return "khac";
  }
  const normalized = action.trim();
  const index = normalized.indexOf(".");
  if (index <= 0) {
    return normalized || "khac";
  }
  return normalized.slice(0, index);
}

function normalizeNote(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return `${value}`.trim();
}

const CONTROL_CLASS =
  "rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0";
const CONTROL_CLASS_COMPACT =
  "rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-2 py-1.5 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0";

export default function AuditLog({ currentUser }) {
  const [logs, setLogs] = useState(() => getAuditLogs(200));
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [cronDraft, setCronDraft] = useState("");
  const [cronError, setCronError] = useState("");
  const [savingCron, setSavingCron] = useState(false);
  const [retentionDraft, setRetentionDraft] = useState("");
  const [retentionError, setRetentionError] = useState("");
  const [backupFiles, setBackupFiles] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState("");
  const [backupNote, setBackupNote] = useState("");
  const [restoreNote, setRestoreNote] = useState("");

  const canManageBackups = Boolean(
    currentUser?.role === "admin" && currentUser?.permissions?.accountManage
  );

  const refreshLogs = useCallback(() => {
    setLogs(getAuditLogs(200));
  }, []);

  const loadSummary = useCallback(async () => {
    if (typeof fetch !== "function") {
      setSummary(null);
      setSummaryError("Trình duyệt không hỗ trợ tải thông tin sao lưu.");
      setSummaryLoading(false);
      return;
    }
    setSummaryLoading(true);
    setSummaryError("");
    try {
      const response = await fetchWithAuth("/api/admin/backups/summary", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(response.statusText || `HTTP ${response.status}`);
      }
      const payload = await response.json();
      setSummary(payload?.summary ?? null);
    } catch (err) {
      setSummary(null);
      setSummaryError(err?.message || "Không thể tải thông tin sao lưu.");
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const fetchBackupFiles = useCallback(async () => {
    if (!canManageBackups || typeof fetch !== "function") {
      return;
    }
    setLoadingBackups(true);
    try {
      const response = await fetchWithAuth("/api/admin/backups/files", {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        const message = payload?.error || response.statusText || `HTTP ${response.status}`;
        toast.error(message || "Không thể tải danh sách bản sao lưu.");
        return;
      }
      const files = Array.isArray(payload?.files) ? payload.files : [];
      setBackupFiles(files);
      setSelectedBackup((prev) => {
        if (prev && files.some((file) => file?.filename === prev)) {
          return prev;
        }
        return files.length > 0 ? files[0].filename : "";
      });
    } catch (err) {
      toast.error(err?.message || "Không thể tải danh sách bản sao lưu.");
    } finally {
      setLoadingBackups(false);
    }
  }, [canManageBackups]);

  const refresh = useCallback(() => {
    refreshLogs();
    void loadSummary();
    void fetchBackupFiles();
  }, [fetchBackupFiles, loadSummary, refreshLogs]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (canManageBackups) {
      void fetchBackupFiles();
    }
  }, [canManageBackups, fetchBackupFiles]);

  const schedule = summary?.schedule;
  useEffect(() => {
    if (schedule && typeof schedule.cron === "string") {
      setCronDraft(schedule.cron);
    }
    if (schedule) {
      if (schedule.retentionCopies === null || schedule.retentionCopies === undefined) {
        setRetentionDraft("");
      } else {
        setRetentionDraft(String(schedule.retentionCopies));
      }
    }
  }, [schedule]);

  const filteredLogs = useMemo(() => {
    const keyword = filter.trim().toLowerCase();
    const typeValue = (typeFilter || "all").toLowerCase();
    const fromMs = fromDate ? Date.parse(`${fromDate}T00:00:00`) : Number.NaN;
    const toMs = toDate ? Date.parse(`${toDate}T23:59:59.999`) : Number.NaN;

    return logs.filter((entry) => {
      if (!entry || typeof entry !== "object") {
        return false;
      }
      const category = (entry.category || inferCategoryFromAction(entry.action)).toLowerCase();
      if (typeValue && typeValue !== "all" && category !== typeValue) {
        return false;
      }
      const ts = entry.ts ? Date.parse(entry.ts) : Number.NaN;
      if (!Number.isNaN(fromMs) && Number.isFinite(fromMs) && Number.isFinite(ts) && ts < fromMs) {
        return false;
      }
      if (!Number.isNaN(toMs) && Number.isFinite(toMs) && Number.isFinite(ts) && ts > toMs) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      const haystack = [
        entry.actor,
        entry.action,
        entry.detail,
        entry.note,
        entry.result,
        category,
        entry.meta ? JSON.stringify(entry.meta) : "",
      ]
        .filter(Boolean)
        .map((text) => `${text}`.toLowerCase());
      return haystack.some((text) => text.includes(keyword));
    });
  }, [filter, fromDate, logs, toDate, typeFilter]);

  const availableCategories = useMemo(() => {
    const set = new Set();
    for (const entry of logs) {
      if (!entry) continue;
      const category = (entry.category || inferCategoryFromAction(entry.action)).toLowerCase();
      if (category) {
        set.add(category);
      }
    }
    return ["all", ...Array.from(set).sort()];
  }, [logs]);

  const handleCronSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!canManageBackups) return;
      const value = cronDraft.trim();
      if (!value) {
        setCronError("Vui lòng nhập biểu thức cron.");
        return;
      }
      const retentionValueRaw = retentionDraft.trim();
      let retentionPayload = null;
      if (retentionValueRaw) {
        if (!/^\d+$/.test(retentionValueRaw)) {
          setRetentionError("Số bản sao lưu giữ lại phải là số nguyên không âm hoặc để trống.");
          return;
        }
        retentionPayload = Number.parseInt(retentionValueRaw, 10);
      }
      setSavingCron(true);
      setCronError("");
      setRetentionError("");
      try {
        const response = await fetchWithAuth("/api/admin/backups/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cron: value, retentionCopies: retentionValueRaw ? retentionPayload : null }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok === false) {
          const message = payload?.error || response.statusText || `HTTP ${response.status}`;
          setCronError(message);
          if (payload?.field === "retentionCopies") {
            setRetentionError(message);
          }
          toast.error(message || "Không thể cập nhật lịch sao lưu.");
          return;
        }
        if (typeof payload?.config?.cron === "string") {
          setCronDraft(payload.config.cron);
        }
        if (payload?.config && Object.prototype.hasOwnProperty.call(payload.config, "retentionCopies")) {
          const storedRetention = payload.config.retentionCopies;
          if (storedRetention === null || storedRetention === undefined) {
            setRetentionDraft("");
          } else {
            setRetentionDraft(String(storedRetention));
          }
        }
        if (payload?.summary) {
          setSummary(payload.summary);
        } else {
          await loadSummary();
        }
        toast.success("Đã cập nhật lịch sao lưu CSDL.");
      } catch (err) {
        const message = err?.message || "Không thể cập nhật lịch sao lưu.";
        setCronError(message);
        toast.error(message);
      } finally {
        setSavingCron(false);
      }
    },
    [canManageBackups, cronDraft, loadSummary, retentionDraft]
  );

  const handleClear = () => {
    if (!window.confirm("Xóa toàn bộ nhật ký và ghi lại thao tác này?")) return;
    clearAuditLogs({ actor: currentUser?.username || "system", note: "Xóa nhật ký thủ công" });
    refresh();
  };

  const handleResetFilters = useCallback(() => {
    setFilter("");
    setTypeFilter("all");
    setFromDate("");
    setToDate("");
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      if (typeFilter && typeFilter !== "all") params.set("type", typeFilter);
      const query = params.toString();
      const endpoint = query ? `/api/admin/audit/export?${query}` : "/api/admin/audit/export";
      const response = await fetchWithAuth(endpoint, {
        headers: { Accept: "text/csv" },
      });
      let payload = null;
      if (!response.ok) {
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }
        const message = payload?.error || response.statusText || `HTTP ${response.status}`;
        throw new Error(message);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit-log-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Đang tải file nhật ký...");
    } catch (err) {
      toast.error(err?.message || "Không thể tải file nhật ký.");
    }
  }, [fromDate, toDate, typeFilter]);

  const handleBackupNow = useCallback(
    async (event) => {
      event.preventDefault();
      if (!canManageBackups) return;
      setRunningBackup(true);
      try {
        const response = await fetchWithAuth("/api/admin/backups/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "manual-ui", note: backupNote.trim() || null }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok === false) {
          const message = payload?.error || response.statusText || `HTTP ${response.status}`;
          throw new Error(message);
        }
        toast.success("Đã khởi chạy sao lưu thủ công.");
        setBackupNote("");
        await loadSummary();
        await fetchBackupFiles();
        refreshLogs();
      } catch (err) {
        toast.error(err?.message || "Không thể sao lưu ngay.");
      } finally {
        setRunningBackup(false);
      }
    },
    [backupNote, canManageBackups, fetchBackupFiles, loadSummary, refreshLogs]
  );

  const handleRestoreSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!canManageBackups) return;
      if (!selectedBackup) {
        toast.error("Vui lòng chọn file sao lưu cần khôi phục.");
        return;
      }
      if (
        !window.confirm(
          "Khôi phục CSDL sẽ ghi đè dữ liệu hiện tại. Bạn có chắc chắn muốn tiếp tục?"
        )
      ) {
        return;
      }
      setRestoring(true);
      try {
        const response = await fetchWithAuth("/api/admin/backups/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: selectedBackup, note: restoreNote.trim() || null }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok === false) {
          const message = payload?.error || response.statusText || `HTTP ${response.status}`;
          throw new Error(message);
        }
        toast.success("Khôi phục CSDL thành công. Vui lòng tải lại trang để đồng bộ dữ liệu.");
        setRestoreNote("");
        await loadSummary();
        await fetchBackupFiles();
        refreshLogs();
      } catch (err) {
        toast.error(err?.message || "Không thể khôi phục CSDL.");
      } finally {
        setRestoring(false);
      }
    },
    [canManageBackups, fetchBackupFiles, loadSummary, refreshLogs, restoreNote, selectedBackup]
  );

  const lastSuccess = summary?.lastSuccess;
  const lastFailure = summary?.lastFailure;
  const reasons = Array.isArray(schedule?.reasons) ? schedule.reasons : [];
  const lastSuccessMeta = lastSuccess?.meta || {};
  const lastFailureMeta = lastFailure?.meta || {};
  const successExtras = [
    lastSuccessMeta.bytes ? formatBytes(lastSuccessMeta.bytes) : "",
    lastSuccessMeta.reason ? `nguồn: ${lastSuccessMeta.reason}` : "",
  ]
    .filter(Boolean)
    .join(" • ");
  const failureExtras = [
    lastFailureMeta.reason ? translateBackupFailure(lastFailureMeta.reason) : "",
    lastFailureMeta.error && lastFailureMeta.reason !== lastFailureMeta.error
      ? lastFailureMeta.error
      : "",
  ]
    .filter(Boolean)
    .join(" • ");

  const retentionLabel = (() => {
    if (!schedule) return "";
    if (schedule.retentionCopies === null || schedule.retentionCopies === undefined) {
      return "Không giới hạn";
    }
    if (schedule.retentionCopies === 0) {
      return "Không giới hạn";
    }
    return `${schedule.retentionCopies} bản sao lưu`;
  })();

  return (
    <div className="space-y-6">
      <section className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold uppercase text-[color:var(--ds-text-muted)]">Lịch sao lưu CSDL</div>
            {schedule?.refreshedAt && (
              <div className="text-xs text-[color:var(--ds-text-muted)]">
                Cập nhật: {formatTime(schedule.refreshedAt)}
              </div>
            )}
          </div>
          <div>
            {schedule?.active ? (
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
                Tự động: đang bật
              </span>
            ) : (
              <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400">
                Tự động: đang tắt
              </span>
            )}
          </div>
        </div>

        {summaryError ? (
          <div className="mt-3 rounded border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-300">
            Không thể tải thông tin sao lưu: {summaryError}
          </div>
        ) : summaryLoading && !summary ? (
          <div className="mt-3 text-sm text-[color:var(--ds-text-muted)]">Đang tải thông tin sao lưu...</div>
        ) : summary ? (
          <div className="mt-4 space-y-4 text-sm text-[color:var(--ds-text-secondary)]">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs uppercase text-[color:var(--ds-text-muted)]">Biểu thức cron</div>
                <div className="font-mono text-sm text-[color:var(--ds-text-primary)]">
                  {schedule?.cron || "Chưa cấu hình"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-[color:var(--ds-text-muted)]">Mô tả lịch</div>
                <div className="text-sm text-[color:var(--ds-text-primary)]">
                  {schedule?.cronDescription || "Không xác định"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-[color:var(--ds-text-muted)]">Lần chạy kế tiếp</div>
                {schedule?.active ? (
                  <div className="space-y-1 text-sm text-[color:var(--ds-text-primary)]">
                    <div>{schedule?.nextRunHuman || (schedule?.nextRun ? formatTime(schedule.nextRun) : "Không xác định")}</div>
                    {schedule?.nextRunHuman && schedule?.nextRun && (
                      <div className="text-xs text-[color:var(--ds-text-muted)]">{formatTime(schedule.nextRun)}</div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-[color:var(--ds-text-primary)]">Đang tắt tự động</div>
                )}
              </div>
              <div>
                <div className="text-xs uppercase text-[color:var(--ds-text-muted)]">Giữ lại</div>
                <div className="text-sm text-[color:var(--ds-text-primary)]">{retentionLabel}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-[color:var(--ds-text-muted)]">Thư mục đích</div>
                <div className="truncate text-sm text-[color:var(--ds-text-primary)]" title={schedule?.directory || ""}>
                  {schedule?.directory || "Chưa cấu hình"}
                </div>
              </div>
            </div>

            {!schedule?.active && reasons.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-xs text-amber-300">
                {reasons.map((code) => (
                  <li key={code}>{BACKUP_REASON_LABELS[code] || code}</li>
                ))}
              </ul>
            )}

            {canManageBackups && (
              <form className="space-y-3 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-3" onSubmit={handleCronSubmit}>
                <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-medium text-[color:var(--ds-text-secondary)]" htmlFor="backup-cron-input">
                      Cập nhật biểu thức cron
                    </label>
                    <input
                      id="backup-cron-input"
                      className={`${CONTROL_CLASS_COMPACT} font-mono`}
                      value={cronDraft}
                      onChange={(event) => setCronDraft(event.target.value)}
                      placeholder="0 3 * * *"
                      disabled={savingCron}
                    />
                    <div className="text-xs text-[color:var(--ds-text-muted)]">Nhập "never" để tắt tự động sao lưu.</div>
                    {cronError && <div className="text-xs text-red-400">{cronError}</div>}
                  </div>
                  <div className="flex w-full flex-col gap-1 md:w-44">
                    <label className="text-xs font-medium text-[color:var(--ds-text-secondary)]" htmlFor="backup-retention-input">
                      Số bản sao lưu giữ lại
                    </label>
                    <input
                      id="backup-retention-input"
                      className={CONTROL_CLASS_COMPACT}
                      type="number"
                      min="0"
                      step="1"
                      value={retentionDraft}
                      onChange={(event) => {
                        setRetentionDraft(event.target.value);
                        setRetentionError("");
                      }}
                      placeholder="14"
                      disabled={savingCron}
                    />
                    <div className="text-xs text-[color:var(--ds-text-muted)]">Để trống hoặc nhập 0 để không giới hạn.</div>
                    {retentionError && <div className="text-xs text-red-400">{retentionError}</div>}
                  </div>
                  <button
                    type="submit"
                    className="rounded bg-[color:var(--ds-text-primary)] px-4 py-2 text-sm font-semibold text-[color:var(--ds-text-inverse)] transition hover:bg-[color:var(--ds-text-primary)]/80 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={savingCron}
                  >
                    {savingCron ? "Đang lưu..." : "Lưu biểu thức"}
                  </button>
                </div>
              </form>
            )}

            {canManageBackups && (
              <div className="space-y-3 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-3">
                <div className="text-xs uppercase text-[color:var(--ds-text-muted)]">Thao tác thủ công</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <form onSubmit={handleBackupNow} className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-[color:var(--ds-text-secondary)]" htmlFor="backup-note-input">
                      Ghi chú khi sao lưu
                    </label>
                    <textarea
                      id="backup-note-input"
                      className={`${CONTROL_CLASS_COMPACT} h-20 resize-none`}
                      placeholder="Ví dụ: Sao lưu trước khi nâng cấp phiên bản"
                      value={backupNote}
                      onChange={(event) => setBackupNote(event.target.value)}
                      disabled={runningBackup || restoring}
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded bg-emerald-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500/90 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={runningBackup || restoring}
                    >
                      {runningBackup ? "Đang sao lưu..." : "Sao lưu ngay"}
                    </button>
                  </form>
                  <form onSubmit={handleRestoreSubmit} className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-[color:var(--ds-text-secondary)]" htmlFor="backup-file-select">
                      Chọn bản sao lưu để khôi phục
                    </label>
                    <select
                      id="backup-file-select"
                      className={CONTROL_CLASS_COMPACT}
                      value={selectedBackup}
                      onChange={(event) => setSelectedBackup(event.target.value)}
                      disabled={loadingBackups || restoring || runningBackup || backupFiles.length === 0}
                    >
                      {loadingBackups ? (
                        <option>Đang tải danh sách...</option>
                      ) : backupFiles.length === 0 ? (
                        <option>Chưa có bản sao lưu</option>
                      ) : (
                        backupFiles.map((file) => (
                          <option key={file.filename} value={file.filename}>
                            {file.filename} {file.modifiedAt ? `(${formatTime(file.modifiedAt)})` : ""}
                          </option>
                        ))
                      )}
                    </select>
                    <textarea
                      className={`${CONTROL_CLASS_COMPACT} h-20 resize-none`}
                      placeholder="Ghi chú cho lần khôi phục (tuỳ chọn)"
                      value={restoreNote}
                      onChange={(event) => setRestoreNote(event.target.value)}
                      disabled={loadingBackups || restoring || runningBackup || backupFiles.length === 0}
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded bg-amber-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500/90 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={restoring || runningBackup || loadingBackups || backupFiles.length === 0}
                    >
                      {restoring ? "Đang khôi phục..." : "Khôi phục bản sao"}
                    </button>
                    <p className="text-xs text-[color:var(--ds-text-muted)]">
                      Hệ thống sẽ ghi đè dữ liệu hiện tại và ghi nhật ký đầy đủ về thao tác khôi phục.
                    </p>
                  </form>
                </div>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs uppercase text-[color:var(--ds-text-muted)]">Lần sao lưu thành công gần nhất</div>
                <div className="text-sm text-[color:var(--ds-text-primary)]">
                  {lastSuccess?.ts
                    ? [formatTime(lastSuccess.ts), lastSuccess.actor || "system", successExtras].filter(Boolean).join(" • ")
                    : "Chưa ghi nhận bản sao lưu thành công."}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-[color:var(--ds-text-muted)]">Lần sao lưu lỗi gần nhất</div>
                <div className="text-sm text-[color:var(--ds-text-primary)]">
                  {lastFailure?.ts
                    ? [formatTime(lastFailure.ts), lastFailure.actor || "system", failureExtras].filter(Boolean).join(" • ")
                    : "Chưa ghi nhận lỗi sao lưu."}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-[color:var(--ds-text-muted)]">Không có dữ liệu sao lưu.</div>
        )}
      </section>

      <section className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4 shadow-sm space-y-4">
        <div className="flex w-full flex-wrap items-center gap-3">
          <input
            className={`w-full max-w-xs ${CONTROL_CLASS}`}
            placeholder="Tìm theo người thực hiện, hành động hoặc ghi chú"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select
            className={`${CONTROL_CLASS} w-full max-w-[10rem]`}
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            {availableCategories.map((category) => (
              <option key={category} value={category}>
                {category === "all" ? "Tất cả loại" : category}
              </option>
            ))}
          </select>
          <input
            type="date"
            className={`${CONTROL_CLASS} w-full max-w-[10rem]`}
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
          <input
            type="date"
            className={`${CONTROL_CLASS} w-full max-w-[10rem]`}
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
          <button
            type="button"
            onClick={handleDownload}
            className="rounded border border-[color:var(--ds-border-subtle)] px-3 py-2 text-sm font-medium text-[color:var(--ds-text-primary)] shadow-sm transition hover:bg-[color:var(--ds-surface-muted)]"
          >
            Tải CSV
          </button>
          <button
            type="button"
            onClick={handleResetFilters}
            className="rounded border border-[color:var(--ds-border-subtle)] px-3 py-2 text-sm text-[color:var(--ds-text-secondary)] shadow-sm transition hover:bg-[color:var(--ds-surface-muted)]"
          >
            Xóa bộ lọc
          </button>
          <span className="flex-1" />
          <button
            type="button"
            onClick={refresh}
            className="rounded border border-[color:var(--ds-border-subtle)] px-3 py-2 text-sm text-[color:var(--ds-text-secondary)] shadow-sm transition hover:bg-[color:var(--ds-surface-muted)]"
          >
            Tải lại
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded border border-red-400 px-3 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/10"
          >
            Xóa nhật ký
          </button>
        </div>

        <div className="overflow-x-auto rounded border border-[color:var(--ds-border-subtle)]">
          <table className="min-w-full divide-y divide-[color:var(--ds-border-subtle)] text-sm text-[color:var(--ds-text-primary)]">
            <thead className="bg-[color:var(--ds-surface-muted)] text-left text-xs font-semibold uppercase text-[color:var(--ds-text-secondary)]">
              <tr>
                <th className="px-3 py-2">Thời gian</th>
                <th className="px-3 py-2">Loại</th>
                <th className="px-3 py-2">Hành động</th>
                <th className="px-3 py-2">Người thực hiện</th>
                <th className="px-3 py-2">Kết quả</th>
                <th className="px-3 py-2">Nội dung</th>
                <th className="px-3 py-2">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--ds-border-subtle)]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-[color:var(--ds-text-muted)]" colSpan={7}>
                    Không có bản ghi phù hợp.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((entry, index) => (
                  <tr
                    key={`${entry.ts}-${index}`}
                    className={index % 2 === 0 ? "bg-[color:var(--ds-surface-card)]" : "bg-[color:var(--ds-surface-muted)]"}
                  >
                    <td className="px-3 py-2 whitespace-nowrap align-top">{formatTime(entry.ts)}</td>
                    <td className="px-3 py-2 whitespace-nowrap align-top">{(entry.category || inferCategoryFromAction(entry.action)).toUpperCase()}</td>
                    <td className="px-3 py-2 align-top font-medium text-[color:var(--ds-text-primary)]">{entry.action}</td>
                    <td className="px-3 py-2 align-top">{entry.actor || "system"}</td>
                    <td className="px-3 py-2 align-top">
                      {entry.result ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            entry.result === 'success'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : entry.result === 'failure'
                              ? 'bg-red-500/15 text-red-300'
                              : 'bg-slate-500/20 text-slate-200'
                          }`}
                        >
                          {entry.result}
                        </span>
                      ) : (
                        <span className="text-[color:var(--ds-text-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-pre-wrap align-top text-[color:var(--ds-text-secondary)]">
                      <div className="space-y-1">
                        <div>{entry.detail || "—"}</div>
                        {entry.meta && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-[color:var(--ds-text-muted)]">Metadata</summary>
                            <pre className="max-h-40 overflow-auto rounded bg-[color:var(--ds-surface-muted)] p-2 text-[color:var(--ds-text-muted)]">
                              {JSON.stringify(entry.meta, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-[color:var(--ds-text-secondary)]">{normalizeNote(entry.note) || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
