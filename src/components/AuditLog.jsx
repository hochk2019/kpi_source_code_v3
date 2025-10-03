import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getAuditLogs, clearAuditLogs } from "@/lib/store.js";

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

const BACKUP_REASON_LABELS = {
  cron_disabled_env: "Cron tự động đang bị tắt bởi KPI_DISABLE_CRON.",
  cron_disabled_config: "Biểu thức cron chưa được cấu hình hoặc đặt ở trạng thái 'never'.",
  memory_db: "CSDL đang chạy ở chế độ :memory: nên không thể sao lưu tự động.",
  memory_backup_dir: "Thư mục sao lưu hiện không hợp lệ (:memory:).",
  invalid_cron_expression: "Biểu thức cron sao lưu không hợp lệ.",
  schedule_error: "Không thể khởi tạo lịch sao lưu tự động, vui lòng kiểm tra log máy chủ.",
};

const BACKUP_FAILURE_LABELS = {
  memory_db: "Không thể sao lưu vì CSDL đang chạy ở chế độ bộ nhớ.",
  invalid_backup_dir: "Thư mục đích sao lưu không hợp lệ.",
  in_progress: "Đang có phiên sao lưu khác diễn ra.",
  missing_source: "Không tìm thấy file CSDL nguồn để sao lưu.",
  error: "Lỗi hệ thống khi thực hiện sao lưu.",
};

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

function translateFailure(reason) {
  if (!reason) return "";
  return BACKUP_FAILURE_LABELS[reason] || reason;
}

export default function AuditLog({ currentUser }) {
  const [logs, setLogs] = useState(() => getAuditLogs(200));
  const [filter, setFilter] = useState("");
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [cronDraft, setCronDraft] = useState("");
  const [cronError, setCronError] = useState("");
  const [savingCron, setSavingCron] = useState(false);

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
      const response = await fetch("/api/admin/backups/summary", {
        credentials: "include",
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

  const refresh = useCallback(() => {
    refreshLogs();
    void loadSummary();
  }, [refreshLogs, loadSummary]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const schedule = summary?.schedule;
  useEffect(() => {
    if (schedule && typeof schedule.cron === "string") {
      setCronDraft(schedule.cron);
    }
  }, [schedule]);

  const filteredLogs = useMemo(() => {
    const keyword = filter.trim().toLowerCase();
    if (!keyword) return logs;
    return logs.filter((entry) =>
      [entry.actor, entry.action, entry.detail]
        .filter(Boolean)
        .some((text) => text.toLowerCase().includes(keyword))
    );
  }, [logs, filter]);

  const canManageBackups = Boolean(
    currentUser?.role === "admin" && currentUser?.permissions?.accountManage
  );

  const handleCronSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!canManageBackups) return;
      const value = cronDraft.trim();
      if (!value) {
        setCronError("Vui lòng nhập biểu thức cron.");
        return;
      }
      setSavingCron(true);
      setCronError("");
      try {
        const response = await fetch("/api/admin/backups/schedule", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cron: value }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok === false) {
          const message = payload?.error || response.statusText || `HTTP ${response.status}`;
          setCronError(message);
          toast.error(message || "Không thể cập nhật lịch sao lưu.");
          return;
        }
        if (typeof payload?.config?.cron === "string") {
          setCronDraft(payload.config.cron);
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
    [canManageBackups, cronDraft, loadSummary]
  );

  const handleClear = () => {
    if (!window.confirm("Xóa toàn bộ nhật ký và ghi lại thao tác này?")) return;
    clearAuditLogs({ actor: currentUser?.username || "system", note: "Xóa nhật ký thủ công" });
    refresh();
  };

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
    lastFailureMeta.reason ? translateFailure(lastFailureMeta.reason) : "",
    lastFailureMeta.error && lastFailureMeta.reason !== lastFailureMeta.error
      ? lastFailureMeta.error
      : "",
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <div className="space-y-4">
      <div className="rounded border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold uppercase text-gray-600">Lịch sao lưu CSDL</div>
            {schedule?.refreshedAt && (
              <div className="text-xs text-gray-500">
                Cập nhật: {formatTime(schedule.refreshedAt)}
              </div>
            )}
          </div>
          <div>
            {schedule?.active ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Tự động: đang bật
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                Tự động: đang tắt
              </span>
            )}
          </div>
        </div>

        {summaryError ? (
          <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Không thể tải thông tin sao lưu: {summaryError}
          </div>
        ) : summaryLoading && !summary ? (
          <div className="mt-3 text-sm text-gray-500">Đang tải thông tin sao lưu...</div>
        ) : summary ? (
          <div className="mt-3 space-y-3 text-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs uppercase text-gray-500">Biểu thức cron</div>
                <div className="font-mono text-sm">{schedule?.cron || "Chưa cấu hình"}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-gray-500">Mô tả lịch</div>
                <div className="text-sm">{schedule?.cronDescription || "Không xác định"}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-gray-500">Lần chạy kế tiếp</div>
                {schedule?.active ? (
                  <div className="space-y-1 text-sm">
                    <div>{schedule?.nextRunHuman || (schedule?.nextRun ? formatTime(schedule.nextRun) : "Không xác định")}</div>
                    {schedule?.nextRunHuman && schedule?.nextRun && (
                      <div className="text-xs text-gray-500">{formatTime(schedule.nextRun)}</div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm">Đang tắt tự động</div>
                )}
              </div>
              <div>
                <div className="text-xs uppercase text-gray-500">Giữ lại</div>
                <div className="text-sm">
                  {schedule?.retentionDays ? `${schedule.retentionDays} bản sao lưu` : "Không giới hạn"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-gray-500">Thư mục đích</div>
                <div className="truncate text-sm" title={schedule?.directory || ""}>
                  {schedule?.directory || "Chưa cấu hình"}
                </div>
              </div>
            </div>

            {!schedule?.active && reasons.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-xs text-amber-700">
                {reasons.map((code) => (
                  <li key={code}>{BACKUP_REASON_LABELS[code] || code}</li>
                ))}
              </ul>
            )}

            {canManageBackups && (
              <form
                className="space-y-2 rounded border border-gray-200 bg-gray-50 p-3"
                onSubmit={handleCronSubmit}
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-medium text-gray-600" htmlFor="backup-cron-input">
                      Cập nhật biểu thức cron
                    </label>
                    <input
                      id="backup-cron-input"
                      className="w-full rounded border px-2 py-1 text-sm font-mono"
                      value={cronDraft}
                      onChange={(event) => setCronDraft(event.target.value)}
                      placeholder="0 3 * * *"
                      disabled={savingCron}
                    />
                    <div className="text-xs text-gray-500">
                      Nhập "never" để tắt tự động sao lưu.
                    </div>
                    {cronError && <div className="text-xs text-red-600">{cronError}</div>}
                  </div>
                  <button
                    type="submit"
                    className="rounded bg-black px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    disabled={savingCron}
                  >
                    {savingCron ? "Đang lưu..." : "Lưu biểu thức"}
                  </button>
                </div>
              </form>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs uppercase text-gray-500">Lần sao lưu thành công gần nhất</div>
                <div className="text-sm">
                  {lastSuccess?.ts
                    ? [
                        formatTime(lastSuccess.ts),
                        lastSuccess.actor || "system",
                        successExtras,
                      ]
                        .filter(Boolean)
                        .join(" • ")
                    : "Chưa ghi nhận bản sao lưu thành công."}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-gray-500">Lần sao lưu lỗi gần nhất</div>
                <div className="text-sm">
                  {lastFailure?.ts
                    ? [
                        formatTime(lastFailure.ts),
                        lastFailure.actor || "system",
                        failureExtras,
                      ]
                        .filter(Boolean)
                        .join(" • ")
                    : "Chưa ghi nhận lỗi sao lưu."}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-gray-500">Không có dữ liệu sao lưu.</div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="w-64 rounded border px-3 py-2 text-sm"
          placeholder="Lọc theo người thực hiện hoặc hành động"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          type="button"
          onClick={refresh}
          className="rounded border px-3 py-2 text-sm shadow-sm hover:bg-gray-50"
        >
          Tải lại
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="rounded border border-red-500 px-3 py-2 text-sm text-red-600"
        >
          Xóa nhật ký
        </button>
      </div>

      <div className="overflow-x-auto rounded border bg-white shadow-sm">
        <table className="min-w-full divide-y text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Thời gian</th>
              <th className="px-3 py-2">Người thực hiện</th>
              <th className="px-3 py-2">Hành động</th>
              <th className="px-3 py-2">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredLogs.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-center text-gray-500" colSpan={4}>
                  Không có bản ghi phù hợp.
                </td>
              </tr>
            ) : (
              filteredLogs.map((entry, index) => (
                <tr key={`${entry.ts}-${index}`} className="odd:bg-white even:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">{formatTime(entry.ts)}</td>
                  <td className="px-3 py-2">{entry.actor || "system"}</td>
                  <td className="px-3 py-2">{entry.action}</td>
                  <td className="px-3 py-2 whitespace-pre-wrap">{entry.detail}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
