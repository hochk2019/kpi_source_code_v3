import React from "react";

function getHistoryRow(entry, index) {
  const rowId = entry.id || entry.snapshot?.id || `${entry.updatedAt || ""}-${index}`;
  const basePoints = Number(entry.snapshot?.points?.base);
  const baseLabel = Number.isFinite(basePoints) ? basePoints.toFixed(1) : "—";
  const versionValue = Number.isFinite(Number(entry.snapshot?.version))
    ? Number(entry.snapshot.version)
    : Number.isFinite(Number(entry.version))
      ? Number(entry.version)
      : null;

  return {
    rowId,
    baseLabel,
    versionLabel: versionValue !== null ? versionValue : "—",
  };
}

export default function RulesHistoryPanel({
  entries = [],
  loading = false,
  error = "",
  collapsed = true,
  expandedId = null,
  isReadOnly = false,
  restoringId = "",
  onToggleCollapsed,
  onRefresh,
  onToggleExpanded,
  onRestoreEntry,
  formatTimestamp,
}) {
  return (
    <div className="space-y-2 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-700">Lịch sử cập nhật điểm KPI</h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="rounded border border-[color:var(--ds-border-subtle)] px-3 py-1 text-xs font-medium text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)]"
          >
            {collapsed ? "Mở rộng" : "Thu gọn"}
          </button>
          {error && !loading ? <span className="text-xs text-red-500">{error}</span> : null}
          {loading ? <span className="text-xs text-[color:var(--ds-text-muted)]">Đang tải…</span> : null}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="rounded border border-[color:var(--ds-border-subtle)] px-3 py-1 text-xs text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Đang tải…" : "Làm mới"}
          </button>
        </div>
      </div>
      {collapsed ? (
        <p className="text-xs text-[color:var(--ds-text-muted)]">Đã thu gọn lịch sử. Nhấn “Mở rộng” để xem chi tiết.</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-[color:var(--ds-text-muted)]">Chưa có ghi nhận lịch sử nào.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500">
                <th className="px-2 py-2">Cập nhật</th>
                <th className="px-2 py-2">Áp dụng từ</th>
                <th className="px-2 py-2">Tên bộ quy tắc</th>
                <th className="px-2 py-2 text-right">Phiên bản</th>
                <th className="px-2 py-2 text-right">Điểm cơ bản</th>
                <th className="px-2 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const { rowId, baseLabel, versionLabel } = getHistoryRow(entry, index);
                const isExpanded = expandedId === rowId;

                return (
                  <React.Fragment key={rowId}>
                    <tr className="border-t border-gray-100">
                      <td className="px-2 py-2 text-xs text-gray-600">{formatTimestamp(entry.updatedAt)}</td>
                      <td className="px-2 py-2 text-xs text-gray-600">{entry.applyFrom || "Áp dụng ngay"}</td>
                      <td className="px-2 py-2 text-sm text-gray-700">{entry.name || entry.snapshot?.name || rowId}</td>
                      <td className="px-2 py-2 text-right text-sm text-gray-700">{versionLabel}</td>
                      <td className="px-2 py-2 text-right text-sm font-medium text-gray-800">{baseLabel}</td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onToggleExpanded(isExpanded ? null : rowId)}
                            className="text-xs font-medium text-amber-600 hover:underline"
                          >
                            {isExpanded ? "Thu gọn" : "Xem"}
                          </button>
                          {!isReadOnly ? (
                            <button
                              type="button"
                              onClick={() => onRestoreEntry(entry)}
                              disabled={restoringId === rowId}
                              className="text-xs font-medium text-blue-600 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {restoringId === rowId ? "Đang khôi phục…" : "Khôi phục"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr>
                        <td colSpan={6} className="px-2 pb-4 pt-1">
                          <div className="rounded bg-slate-900 p-3 text-xs text-slate-100">
                            <div className="mb-2 font-semibold">Chi tiết điểm & cấu hình</div>
                            <pre className="max-h-52 overflow-auto whitespace-pre-wrap text-xs">
                              {JSON.stringify(entry.snapshot?.points, null, 2)}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
