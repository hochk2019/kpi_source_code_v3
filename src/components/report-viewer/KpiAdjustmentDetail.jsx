import React from "react";

export default function KpiAdjustmentDetail({
  paginatedAppliedAdjustments,
  currentAdjustmentPage,
  totalAdjustmentPages,
  onAdjustmentPrev,
  onAdjustmentNext,
  adjustmentPageSize,
  onAdjustmentPageSizeChange,
  adjustmentTotals,
  adjustmentStatusStats,
  pendingAdjustments,
  rejectedAdjustments,
  formatDecimal,
  formatInt,
  formatOptionalDecimal,
  formatOptionalInt,
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-[color:var(--ds-text-primary)]">Chi tiết điểm đã áp dụng</h4>
            <p className="text-xs text-[color:var(--ds-text-muted)]">
              Danh sách điểm cộng/trừ đã được phê duyệt trong khoảng thời gian hiện tại.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-[color:var(--ds-text-secondary)]">
            <span>
              Trang {totalAdjustmentPages ? currentAdjustmentPage + 1 : 0}/{totalAdjustmentPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onAdjustmentPrev}
                disabled={currentAdjustmentPage === 0}
                className={`rounded border px-2 py-1 font-semibold transition-colors ${
                  currentAdjustmentPage === 0
                    ? "cursor-not-allowed border-[color:var(--ds-border-subtle)] text-[color:var(--ds-text-disabled)]"
                    : "border-[color:var(--ds-border-subtle)] text-[color:var(--ds-text-secondary)] hover:border-[color:var(--ds-border-strong)] hover:text-[color:var(--ds-text-primary)]"
                }`}
              >
                Trước
              </button>
              <button
                type="button"
                onClick={onAdjustmentNext}
                disabled={currentAdjustmentPage >= totalAdjustmentPages - 1}
                className={`rounded border px-2 py-1 font-semibold transition-colors ${
                  currentAdjustmentPage >= totalAdjustmentPages - 1
                    ? "cursor-not-allowed border-[color:var(--ds-border-subtle)] text-[color:var(--ds-text-disabled)]"
                    : "border-[color:var(--ds-border-subtle)] text-[color:var(--ds-text-secondary)] hover:border-[color:var(--ds-border-strong)] hover:text-[color:var(--ds-text-primary)]"
                }`}
              >
                Sau
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 overflow-auto rounded border border-[color:var(--ds-border-subtle)]">
          <table className="min-w-full text-sm text-[color:var(--ds-text-primary)]">
            <thead className="bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-secondary)]">
              <tr className="text-left text-xs uppercase">
                <th className="px-3 py-2">Tháng</th>
                <th className="px-3 py-2">Hạng mục</th>
                <th className="px-3 py-2">Nhân viên</th>
                <th className="px-3 py-2">Tổ đội</th>
                <th className="px-3 py-2 text-right">Số lượng × Hệ số</th>
                <th className="px-3 py-2 text-right">Điểm</th>
                <th className="px-3 py-2">Tham chiếu</th>
                <th className="px-3 py-2">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {paginatedAppliedAdjustments.length ? (
                paginatedAppliedAdjustments.map((item) => {
                  const key = item.adjustment?.id || `${item.date}-${item.nhan_vien || ""}`;
                  const quantity = Number.isFinite(Number(item.adjustment?.quantity))
                    ? Number(item.adjustment.quantity)
                    : null;
                  const unitPoints = Number.isFinite(Number(item.adjustment?.unitPoints))
                    ? Number(item.adjustment.unitPoints)
                    : null;
                  const references = Array.isArray(item.adjustment?.references)
                    ? item.adjustment.references.filter(Boolean).join(", ")
                    : "";
                  const note = item.adjustment?.note || "";
                  const scoreClass = item.kpi >= 0 ? "text-emerald-600" : "text-rose-600";
                  return (
                    <tr
                      key={key}
                      className="border-b border-[color:var(--ds-border-subtle)] odd:bg-[color:var(--ds-surface-card)] even:bg-[color:var(--ds-surface-muted)] last:border-b-0"
                    >
                      <td className="px-3 py-2">{item.displayDate || (item.date ? item.date.slice(0, 7) : "—")}</td>
                      <td className="px-3 py-2">{item.adjustment?.label || item.loai_hinh}</td>
                      <td className="px-3 py-2">{item.nhan_vien || "Chưa gán"}</td>
                      <td className="px-3 py-2">{item.team || "Chưa gán tổ đội"}</td>
                      <td className="px-3 py-2 text-right">
                        {quantity !== null ? formatDecimal(quantity) : "—"}
                        {unitPoints !== null ? (
                          <span className="ml-1 text-xs text-[color:var(--ds-text-muted)]">× {formatDecimal(unitPoints)}</span>
                        ) : null}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${scoreClass}`}>
                        {formatDecimal(item.kpi)}
                      </td>
                      <td className="px-3 py-2">{references || "—"}</td>
                      <td className="px-3 py-2">{note || "—"}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-3 py-4 text-center text-[color:var(--ds-text-muted)]" colSpan={8}>
                    Chưa có điểm bổ sung nào được duyệt trong khoảng thời gian này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-[color:var(--ds-text-secondary)]">
          <label className="flex items-center gap-2" htmlFor="adjustment-page-size">
            Trang hiển thị
            <select
              id="adjustment-page-size"
              value={adjustmentPageSize}
              onChange={(event) => onAdjustmentPageSizeChange(event.target.value)}
              className="rounded border border-[color:var(--ds-border-subtle)] bg-transparent px-2 py-1 text-sm"
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="space-y-3 rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-4">
          <header className="space-y-1">
            <h4 className="text-sm font-semibold text-[color:var(--ds-text-primary)]">Tổng quan trạng thái</h4>
            <p className="text-xs text-[color:var(--ds-text-muted)]">
              Số lượt điểm đã duyệt, đang chờ và bị từ chối trong kỳ.
            </p>
          </header>
          <ul className="space-y-1 text-sm text-[color:var(--ds-text-secondary)]">
            {adjustmentStatusStats.map((item) => (
              <li key={item.label} className="flex items-center justify-between">
                <span>{item.label}</span>
                <span className={`font-semibold ${item.tone}`}>{formatInt(item.value)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-3 rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4">
          <header className="space-y-1">
            <h4 className="text-sm font-semibold text-[color:var(--ds-text-primary)]">Phân bổ theo hạng mục</h4>
            <p className="text-xs text-[color:var(--ds-text-muted)]">
              Tổng điểm và số lượt ghi nhận ở từng hạng mục cộng/trừ.
            </p>
          </header>
          {adjustmentTotals.length ? (
            <ul className="space-y-2 text-sm text-[color:var(--ds-text-secondary)]">
              {adjustmentTotals.map((item) => (
                <li
                  key={item.key}
                  className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] px-3 py-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-[color:var(--ds-text-primary)]">{item.label}</span>
                    <span className="font-semibold text-[color:var(--ds-text-primary)]">
                      {formatOptionalDecimal(item.points)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--ds-text-muted)]">
                    Số lượt: <span className="font-semibold text-[color:var(--ds-text-primary)]">{formatOptionalInt(item.quantity)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[color:var(--ds-text-muted)]">Chưa có dữ liệu phân bổ.</p>
          )}
        </section>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4">
          <header className="space-y-1">
            <h4 className="text-sm font-semibold text-[color:var(--ds-text-primary)]">Yêu cầu đang chờ duyệt</h4>
            <p className="text-xs text-[color:var(--ds-text-muted)]">
              Danh sách đầy đủ các yêu cầu đang chờ xử lý.
            </p>
          </header>
          {pendingAdjustments.length ? (
            <ul className="mt-2 space-y-2 text-sm text-[color:var(--ds-text-secondary)]">
              {pendingAdjustments.map((item) => (
                <li key={item.id} className="rounded border border-dashed border-amber-400 bg-amber-500/10 px-3 py-2">
                  <div className="font-medium text-[color:var(--ds-text-primary)]">{item.label || item.category}</div>
                  <div>{item.staffName || "Chưa gán"} — {item.month}</div>
                  <div>Điểm đề xuất: {formatDecimal(item.totalPoints || 0)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-[color:var(--ds-text-muted)]">Không có yêu cầu đang chờ.</p>
          )}
        </section>
        <section className="rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4">
          <header className="space-y-1">
            <h4 className="text-sm font-semibold text-[color:var(--ds-text-primary)]">Yêu cầu bị từ chối</h4>
            <p className="text-xs text-[color:var(--ds-text-muted)]">
              Toàn bộ yêu cầu đã bị từ chối trong khoảng thời gian lọc.
            </p>
          </header>
          {rejectedAdjustments.length ? (
            <ul className="mt-2 space-y-2 text-sm text-[color:var(--ds-text-secondary)]">
              {rejectedAdjustments.map((item) => (
                <li key={item.id} className="rounded border border-rose-400/60 bg-rose-500/10 px-3 py-2">
                  <div className="font-medium text-[color:var(--ds-text-primary)]">{item.label || item.category}</div>
                  <div>{item.staffName || "Chưa gán"} — {item.month}</div>
                  <div>Điểm: {formatDecimal(item.totalPoints || 0)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-[color:var(--ds-text-muted)]">Không có yêu cầu bị từ chối.</p>
          )}
        </section>
      </div>
    </div>
  );
}
