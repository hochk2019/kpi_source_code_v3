import React from "react";

const SYNC_PROGRESS_STATUS_META = {
  pending: {
    badgeClass:
      "border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-muted)]",
    label: "Chưa chạy",
    markerClass: "bg-[color:var(--ds-border-subtle)]",
  },
  active: {
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-700",
    label: "Đang chạy",
    markerClass: "bg-emerald-500",
  },
  done: {
    badgeClass: "border border-sky-200 bg-sky-50 text-sky-700",
    label: "Hoàn tất",
    markerClass: "bg-sky-500",
  },
  error: {
    badgeClass: "border border-red-200 bg-red-50 text-red-700",
    label: "Gặp lỗi",
    markerClass: "bg-red-500",
  },
};

const PREFLIGHT_STATUS_META = {
  pass: {
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-700",
    label: "Đạt",
  },
  warn: {
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-700",
    label: "Lưu ý",
  },
  fail: {
    badgeClass: "border border-red-200 bg-red-50 text-red-700",
    label: "Chặn chạy",
  },
};

const ACTIVITY_LOG_LEVEL_META = {
  info: "text-gray-700",
  warn: "text-amber-700",
  error: "text-red-700",
};

const SYNC_HISTORY_STATUS_META = {
  completed: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border border-red-200 bg-red-50 text-red-700",
  resume_required: "border border-amber-200 bg-amber-50 text-amber-700",
  default:
    "border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-muted)]",
};

function renderSyncHistoryStatus(status) {
  if (status === "completed") {
    return "Hoàn tất";
  }
  if (status === "failed") {
    return "Thất bại";
  }
  if (status === "resume_required") {
    return "Cần tiếp tục";
  }
  return "Đã lưu";
}

function formatSyncHistoryWindow(entry) {
  if (entry?.from && entry?.to) {
    return `${entry.from} → ${entry.to}`;
  }
  return "Dùng RangeDays mặc định";
}

function renderPreviewStatus(status) {
  if (status === "existing") {
    return <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700">Đã có</span>;
  }

  return <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Mới</span>;
}

export default function DataImporterSyncPreviewPanel({
  rangePresets = [],
  manualRange = { from: "", to: "" },
  onApplyRangePreset,
  onManualRangeChange,
  syncRunning = false,
  previewLoading = false,
  onPreview,
  onRunSync,
  mstFilterNotice = "",
  showPreviewRange = false,
  previewRangeLabel = "",
  previewLimited = false,
  previewError = "",
  previewRows = [],
  previewConflictSummary = null,
  previewConflictWarningActive = false,
  syncRecoveryHints = [],
  syncPreflightChecks = [],
  syncPreflightSummary = null,
  syncActivityLog = [],
  syncHistory = [],
  syncResumeJob = null,
  syncResumeLabel = "",
  showPreviewTableInline = true,
  formatDate = (value) => value,
  syncProgressSteps = [],
  syncMessage = "",
  syncError = "",
  onResumeSync,
}) {
  const hasSyncProgress = syncProgressSteps.some(
    (step) => step?.status && step.status !== "pending",
  );
  const hasPreflightChecks = syncPreflightChecks.length > 0;
  const hasActivityLog = syncActivityLog.length > 0;
  const hasSyncHistory = Array.isArray(syncHistory) && syncHistory.length > 0;
  const hasRecoveryHints = Array.isArray(syncRecoveryHints) && syncRecoveryHints.length > 0;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-gray-700">Khoảng thời gian chạy tay</span>
        <div className="flex flex-wrap items-center gap-1">
          {rangePresets.map((preset) => (
            <button
              key={preset.days}
              type="button"
              className="rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
              onClick={() => onApplyRangePreset?.(preset.days)}
              disabled={syncRunning}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-700">hoặc chọn ngày cụ thể</span>
        <input
          type="date"
          aria-label="Ngày bắt đầu chạy tay ECUS"
          className="rounded border px-2 py-1 text-sm"
          value={manualRange.from || ""}
          onChange={(event) => onManualRangeChange?.("from", event.target.value)}
          disabled={syncRunning}
        />
        <span className="text-xs text-gray-700">đến</span>
        <input
          type="date"
          aria-label="Ngày kết thúc chạy tay ECUS"
          className="rounded border px-2 py-1 text-sm"
          value={manualRange.to || ""}
          onChange={(event) => onManualRangeChange?.("to", event.target.value)}
          disabled={syncRunning}
        />
        <button
          type="button"
          onClick={onPreview}
          disabled={previewLoading || syncRunning}
          className="rounded border border-emerald-600 px-3 py-1 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
        >
          {previewLoading ? "Đang xem trước..." : "Xem trước dữ liệu"}
        </button>
        <button
          type="button"
          onClick={onRunSync}
          disabled={syncRunning}
          className="rounded bg-emerald-700 px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          {syncRunning ? "Đang đồng bộ..." : "Đồng bộ ngay"}
        </button>
        {syncResumeJob ? (
          <button
            type="button"
            onClick={onResumeSync}
            disabled={syncRunning}
            className="rounded border border-sky-600 px-3 py-1 text-sm text-sky-700 hover:bg-sky-50 disabled:opacity-50"
          >
            Tiếp tục job dang dở
          </button>
        ) : null}
      </div>

      {syncResumeLabel ? (
        <div className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
          {syncResumeLabel}
        </div>
      ) : null}

      {hasPreflightChecks ? (
        <div className="space-y-2 rounded border border-[color:var(--ds-border-subtle)] bg-white/80 px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-700">
              Checklist trước khi chạy
            </div>
            {syncPreflightSummary ? (
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  syncPreflightSummary.ready
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {syncPreflightSummary.ready
                  ? "Sẵn sàng chạy"
                  : `Còn ${syncPreflightSummary.blockingCount} mục cần xử lý`}
              </span>
            ) : null}
          </div>
          <ul className="space-y-2" aria-label="Checklist trước khi chạy đồng bộ ECUS">
            {syncPreflightChecks.map((check) => {
              const meta = PREFLIGHT_STATUS_META[check?.status] || PREFLIGHT_STATUS_META.warn;
              return (
                <li key={check?.key || check?.label} className="rounded border border-[color:var(--ds-border-subtle)] px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-gray-800">{check?.label || "Mục kiểm tra"}</span>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${meta.badgeClass}`}>
                      {meta.label}
                    </span>
                  </div>
                  {check?.detail ? (
                    <div className="mt-1 text-xs text-gray-600">{check.detail}</div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {mstFilterNotice ? (
        <div className="text-xs text-amber-600">
          Đang bật bộ lọc MST: {mstFilterNotice}.
        </div>
      ) : null}

      {showPreviewRange ? (
        <div className="text-xs text-gray-700">
          Khoảng xem trước: {previewRangeLabel || "..."}
          {previewLimited ? " (giới hạn 100 dòng đầu tiên)" : ""}
        </div>
      ) : null}

      {previewError || syncError || hasRecoveryHints ? (
        <div className="space-y-2">
          {previewError ? <div className="text-xs text-red-600">{previewError}</div> : null}
          {syncError ? <div className="text-sm text-red-600">{syncError}</div> : null}
          {hasRecoveryHints ? (
            <div className="space-y-2 rounded border border-amber-200 bg-amber-50 px-3 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-amber-800">
                Gợi ý khắc phục
              </div>
              <ul className="space-y-2" aria-label="Gợi ý khắc phục khi đồng bộ ECUS thất bại">
                {syncRecoveryHints.map((hint) => (
                  <li
                    key={hint?.key || hint?.title}
                    className="rounded border border-white/70 bg-white/70 px-3 py-2"
                  >
                    <div className="text-sm font-medium text-amber-900">
                      {hint?.title || "Thao tác đề xuất"}
                    </div>
                    {hint?.detail ? (
                      <div className="mt-1 text-xs text-amber-800">{hint.detail}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {previewConflictWarningActive && previewConflictSummary ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <div className="font-medium">Cảnh báo overwrite trước khi đồng bộ</div>
          <div className="mt-1">
            {previewConflictSummary.overwriteCount.toLocaleString("vi-VN")} tờ khai đã tồn tại sẽ bị
            cập nhật nếu bạn bấm Đồng bộ ngay.
          </div>
          {previewConflictSummary.lockedCount > 0 ? (
            <div className="mt-1">
              {previewConflictSummary.lockedCount.toLocaleString("vi-VN")} tờ khai đang khóa rà soát sẽ
              bị bỏ qua.
            </div>
          ) : null}
          {previewConflictSummary.unchangedCount > 0 ? (
            <div className="mt-1">
              {previewConflictSummary.unchangedCount.toLocaleString("vi-VN")} tờ khai trùng nhưng không
              có thay đổi sẽ được bỏ qua.
            </div>
          ) : null}
        </div>
      ) : null}

      {hasSyncProgress ? (
        <div
          className="space-y-2 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] px-3 py-3"
          role="status"
          aria-live="polite"
        >
          <div className="text-xs font-medium uppercase tracking-wide text-gray-700">
            Tiến trình đồng bộ
          </div>
          <ol className="space-y-2" aria-label="Tiến trình đồng bộ ECUS">
            {syncProgressSteps.map((step) => {
              const meta = SYNC_PROGRESS_STATUS_META[step?.status] || SYNC_PROGRESS_STATUS_META.pending;
              return (
                <li key={step?.key || step?.label} className="rounded border border-white/70 bg-white/80 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm text-gray-800">
                      <span className={`h-2.5 w-2.5 rounded-full ${meta.markerClass}`} aria-hidden="true" />
                      <span>{step?.label || "Bước đồng bộ"}</span>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${meta.badgeClass}`}>
                      {meta.label}
                    </span>
                  </div>
                  {step?.detail ? (
                    <div className="mt-1 pl-4 text-xs text-gray-600">{step.detail}</div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {hasActivityLog ? (
        <div className="space-y-2 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] px-3 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-700">
            Nhật ký queue và retry
          </div>
          <ol className="space-y-1" aria-label="Nhật ký queue và retry của đồng bộ ECUS">
            {syncActivityLog.map((entry) => (
              <li
                key={entry?.id || `${entry?.at || ""}-${entry?.message || ""}`}
                className={`text-xs ${ACTIVITY_LOG_LEVEL_META[entry?.level] || ACTIVITY_LOG_LEVEL_META.info}`}
              >
                <span className="font-medium">
                  {entry?.at ? new Date(entry.at).toLocaleTimeString("vi-VN") : "--:--:--"}
                </span>{" "}
                {entry?.message || ""}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {hasSyncHistory ? (
        <div className="space-y-2 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] px-3 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-700">
            Lịch sử đồng bộ gần đây
          </div>
          <ol className="space-y-2" aria-label="Lịch sử đồng bộ ECUS gần đây">
            {syncHistory.map((entry) => {
              const statusClass =
                SYNC_HISTORY_STATUS_META[entry?.status] || SYNC_HISTORY_STATUS_META.default;
              const summary = entry?.resultSummary || null;
              return (
                <li
                  key={entry?.id || `${entry?.finishedAt || entry?.updatedAt || ""}-${entry?.actor || ""}`}
                  className="rounded border border-white/70 bg-white/80 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-gray-800">
                      {entry?.actor || "system"} ·{" "}
                      {entry?.finishedAt || entry?.updatedAt || entry?.createdAt
                        ? new Date(entry.finishedAt || entry.updatedAt || entry.createdAt).toLocaleString("vi-VN")
                        : "Không rõ thời điểm"}
                    </div>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass}`}>
                      {renderSyncHistoryStatus(entry?.status)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    Khoảng chạy: {formatSyncHistoryWindow(entry)}
                  </div>
                  {summary ? (
                    <div className="mt-1 text-xs text-gray-600">
                      Tác động {summary.affectedRows.toLocaleString("vi-VN")} bản ghi
                      {" "}({summary.imported.toLocaleString("vi-VN")} mới, {summary.updated.toLocaleString("vi-VN")} cập nhật, {summary.skipped.toLocaleString("vi-VN")} bỏ qua, {summary.reviewLocked.toLocaleString("vi-VN")} khóa).
                    </div>
                  ) : null}
                  {entry?.mstFilterNotice ? (
                    <div className="mt-1 text-xs text-gray-600">{entry.mstFilterNotice}</div>
                  ) : null}
                  {entry?.lastError ? (
                    <div className="mt-1 text-xs text-red-700">{entry.lastError}</div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {previewRows.length > 0 && showPreviewTableInline ? (
        <div className="space-y-2">
          <div className="text-xs text-gray-700">
            Xem trước {previewRows.length.toLocaleString("vi-VN")} dòng đầu tiên sẽ nhập vào hệ thống.
          </div>
          <div className="max-h-64 overflow-auto rounded border">
            <table
              className="min-w-full text-xs"
              aria-label="Bảng xem trước dữ liệu đồng bộ ECUS"
            >
              <thead className="bg-emerald-50 text-emerald-800">
                <tr>
                  <th className="px-2 py-1 text-left">Số tờ khai</th>
                  <th className="px-2 py-1 text-left">Ngày</th>
                  <th className="px-2 py-1 text-left">MST</th>
                  <th className="px-2 py-1 text-left">Công ty</th>
                  <th className="px-2 py-1 text-left">Nhân viên</th>
                  <th className="px-2 py-1 text-left">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr
                    key={`${row.so_tk}_${row.nhanh || ""}`}
                    className="odd:bg-[color:var(--ds-surface-card)] even:bg-[color:var(--ds-surface-muted)]"
                  >
                    <td className="px-2 py-1">{row.so_tk}</td>
                    <td className="px-2 py-1">{formatDate(row.date)}</td>
                    <td className="px-2 py-1">{row.mst}</td>
                    <td className="px-2 py-1">{row.cong_ty}</td>
                    <td className="px-2 py-1">
                      {row.nhan_vien || <span className="italic text-gray-600">(chưa gán)</span>}
                    </td>
                    <td className="px-2 py-1">{renderPreviewStatus(row.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {previewRows.length > 0 && !showPreviewTableInline ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Dữ liệu xem trước đã được chuyển sang bước 2 để rà soát trước khi đồng bộ.
        </div>
      ) : null}

      {syncMessage ? <div className="text-sm text-emerald-700">{syncMessage}</div> : null}
    </>
  );
}
