import React from "react";

import CollapsibleCard from "@/components/CollapsibleCard.jsx";

const CARD_SURFACE_CLASS =
  "rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] shadow-sm";

export default function DataImporterMonitoringPanel({
  coDiscrepancy,
  alerts,
  formatDeclarationLabel,
  formatDisplayDate,
}) {
  const {
    canManageSync,
    range,
    onRangeChange,
    onRun,
    onRefresh,
    running,
    loading,
    error,
    message,
    statusLabel,
    lastRunLabel,
    mismatchCount,
    checkedCount,
    form,
    onFormChange,
    saving,
    onSaveConfig,
    onResetForm,
    rangeLabel,
    mismatchLimited,
    mismatchPreview,
    mismatchKeyCount,
    onSelectMismatches,
  } = coDiscrepancy;
  const {
    lastEvaluated,
    summary,
    onRefresh: onRefreshAlerts,
    loading: alertLoading,
    outstandingAlerts,
  } = alerts;

  const handleRangeFieldChange = (field, value) => {
    onRangeChange({
      ...range,
      [field]: value,
    });
  };

  const handleFormFieldChange = (field, value) => {
    onFormChange({
      ...form,
      [field]: value,
    });
  };

  return (
    <>
      <CollapsibleCard
        id="co-discrepancy"
        title="Đối soát C/O"
        description="Theo dõi chênh lệch giữa dữ liệu hệ thống và ECUS để xử lý kịp thời."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              className="rounded border px-2 py-1 text-xs"
              value={range.from}
              onChange={(event) => handleRangeFieldChange("from", event.target.value)}
              data-tooltip="Ngày bắt đầu đối soát"
            />
            <span className="text-xs text-gray-500">→</span>
            <input
              type="date"
              className="rounded border px-2 py-1 text-xs"
              value={range.to}
              onChange={(event) => handleRangeFieldChange("to", event.target.value)}
              data-tooltip="Ngày kết thúc đối soát"
            />
            <button
              type="button"
              onClick={onRun}
              className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
              disabled={running || loading || !canManageSync}
              data-tooltip="Chạy đối chiếu C/O với dữ liệu ECUS"
            >
              {running ? "Đang chạy..." : "Chạy kiểm tra"}
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="rounded border px-3 py-1 text-xs"
              disabled={loading}
              data-tooltip="Làm mới kết quả đối soát"
            >
              {loading ? "Đang tải..." : "Làm mới"}
            </button>
          </div>
        }
        bodyClassName="space-y-3"
      >
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        {message ? <div className="text-sm text-emerald-600">{message}</div> : null}

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border bg-gray-50 px-3 py-2">
            <div className="text-xs uppercase text-gray-500">Trạng thái</div>
            <div className="text-sm font-semibold text-gray-900">{statusLabel}</div>
          </div>
          <div className="rounded border bg-gray-50 px-3 py-2">
            <div className="text-xs uppercase text-gray-500">Lần chạy gần nhất</div>
            <div className="text-sm font-semibold text-gray-900">{lastRunLabel}</div>
          </div>
          <div className="rounded border bg-gray-50 px-3 py-2">
            <div className="text-xs uppercase text-gray-500">Chênh lệch</div>
            <div className="text-sm font-semibold text-gray-900">{mismatchCount.toLocaleString("vi-VN")}</div>
          </div>
          <div className="rounded border bg-gray-50 px-3 py-2">
            <div className="text-xs uppercase text-gray-500">Tổng đã kiểm</div>
            <div className="text-sm font-semibold text-gray-900">{checkedCount.toLocaleString("vi-VN")}</div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => handleFormFieldChange("enabled", event.target.checked)}
                disabled={!canManageSync}
              />
              <span>Bật đối soát tự động</span>
            </label>

            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-xs font-medium text-gray-600">
                Cron tự động
                <input
                  className="mt-1 w-full rounded border px-2 py-1 text-sm"
                  value={form.cron}
                  onChange={(event) => handleFormFieldChange("cron", event.target.value)}
                  disabled={!canManageSync}
                  placeholder="30 4 * * *"
                />
              </label>
              <label className="text-xs font-medium text-gray-600">
                Số ngày lấy mẫu
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded border px-2 py-1 text-sm"
                  value={form.rangeDays}
                  onChange={(event) => handleFormFieldChange("rangeDays", event.target.value)}
                  disabled={!canManageSync}
                />
              </label>
              <label className="text-xs font-medium text-gray-600">
                Ngưỡng cảnh báo
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded border px-2 py-1 text-sm"
                  value={form.threshold}
                  onChange={(event) => handleFormFieldChange("threshold", event.target.value)}
                  disabled={!canManageSync}
                />
              </label>
              <label className="text-xs font-medium text-gray-600">
                Giới hạn mẫu
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded border px-2 py-1 text-sm"
                  value={form.sampleLimit}
                  onChange={(event) => handleFormFieldChange("sampleLimit", event.target.value)}
                  disabled={!canManageSync}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSaveConfig}
                className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                disabled={saving || !canManageSync}
              >
                {saving ? "Đang lưu..." : "Lưu cấu hình"}
              </button>
              <button
                type="button"
                onClick={onResetForm}
                className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                disabled={saving}
              >
                Khôi phục
              </button>
            </div>

            <div className="text-xs text-gray-500">
              {rangeLabel ? `Khoảng lần chạy gần nhất: ${rangeLabel}` : "Chưa có kết quả đối soát."}
              {mismatchLimited ? " (Đã cắt bớt danh sách do vượt giới hạn mẫu)" : ""}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span>
                Chênh lệch gợi ý ({mismatchPreview.length} / {mismatchCount.toLocaleString("vi-VN")})
              </span>
              <button
                type="button"
                onClick={onSelectMismatches}
                className="rounded border px-2 py-0.5 text-[11px] text-amber-700 hover:bg-amber-50"
                disabled={!mismatchKeyCount}
              >
                Chọn trên bảng
              </button>
            </div>

            <div className="overflow-auto rounded border">
              {mismatchPreview.length ? (
                <table className="min-w-full text-xs">
                  <thead className="bg-amber-50 text-amber-800">
                    <tr>
                      <th className="px-2 py-1 text-left">Tờ khai</th>
                      <th className="px-2 py-1 text-center">C/O lưu trữ</th>
                      <th className="px-2 py-1 text-center">C/O ECUS</th>
                      <th className="px-2 py-1 text-center">Dòng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mismatchPreview.map((item) => (
                      <tr
                        key={item.key}
                        className="odd:bg-[color:var(--ds-surface-card)] even:bg-[color:var(--ds-surface-muted)]"
                      >
                        <td className="px-2 py-1">{formatDeclarationLabel(item)}</td>
                        <td className="px-2 py-1 text-center">
                          {item.stored?.has_co ? "Có" : "Không"} ({item.stored?.co_line_count ?? 0})
                        </td>
                        <td className="px-2 py-1 text-center">
                          {item.remote?.has_co ? "Có" : "Không"} ({item.remote?.co_line_count ?? 0})
                        </td>
                        <td className="px-2 py-1 text-center">{item.remote?.co_codes?.length ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-4 text-center text-xs text-gray-500">Chưa phát hiện chênh lệch nào.</div>
              )}
            </div>
          </div>
        </div>
      </CollapsibleCard>

      <section className={`${CARD_SURFACE_CLASS} p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Cảnh báo tờ khai thiếu thông tin</h2>
            <p className="text-xs text-gray-500">
              Lần rà soát: {lastEvaluated} • Tổng theo dõi: {summary.totalTracked || 0}
            </p>
          </div>
          <button
            type="button"
            onClick={onRefreshAlerts}
            className="rounded border px-3 py-1 text-sm"
            disabled={alertLoading}
          >
            Làm mới danh sách
          </button>
        </div>

        {alertLoading ? (
          <p className="mt-3 text-sm text-gray-500">Đang tải danh sách cảnh báo...</p>
        ) : outstandingAlerts.length ? (
          <div className="mt-3 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-1 text-left">Số tờ khai</th>
                  <th className="px-2 py-1 text-left">MST</th>
                  <th className="px-2 py-1 text-left">Công ty</th>
                  <th className="px-2 py-1 text-left">Thiếu thông tin</th>
                  <th className="px-2 py-1 text-left">Ngày tờ khai</th>
                  <th className="px-2 py-1 text-left">Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {outstandingAlerts.map((alert) => (
                  <tr
                    key={alert.key}
                    className="odd:bg-[color:var(--ds-surface-card)] even:bg-[color:var(--ds-surface-muted)]"
                  >
                    <td className="px-2 py-1">{alert.so_tk}</td>
                    <td className="px-2 py-1">{alert.mst}</td>
                    <td className="px-2 py-1">{alert.company}</td>
                    <td className="px-2 py-1 text-amber-600">{(alert.missing || []).join(", ")}</td>
                    <td className="px-2 py-1">{formatDisplayDate(alert.date)}</td>
                    <td className="px-2 py-1">
                      {alert.lastUpdated ? new Date(alert.lastUpdated).toLocaleString("vi-VN") : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500">Không có cảnh báo nào đang chờ xử lý.</p>
        )}
      </section>
    </>
  );
}
