import React from "react";

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
  showPreviewTableInline = true,
  formatDate = (value) => value,
  syncMessage = "",
  syncError = "",
}) {
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
      </div>

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

      {previewError ? <div className="text-xs text-red-600">{previewError}</div> : null}

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
      {syncError ? <div className="text-sm text-red-600">{syncError}</div> : null}
    </>
  );
}
