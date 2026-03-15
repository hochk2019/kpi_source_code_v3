import React, { useEffect } from "react";

const ADJUSTMENT_CATEGORY_TONE_MAP = {
  support: "text-emerald-600",
  cancel: "text-rose-500",
  correction: "text-amber-600",
  tax: "text-sky-600",
  teamwork: "text-indigo-600",
  coworker_attitude: "text-purple-600",
  customer_attitude: "text-fuchsia-600",
  discipline: "text-amber-700",
};

const ADJUSTMENT_PAGE_SIZE_OPTIONS = [5, 10, 20];

function buildAdjustmentStatusStats(adjustmentsReport) {
  return [
    {
      label: "Đã duyệt",
      value: Number(adjustmentsReport?.approvedCount || 0),
      tone: "text-emerald-600",
    },
    {
      label: "Chờ duyệt",
      value: Number(adjustmentsReport?.pendingCount || 0),
      tone: "text-amber-600",
    },
    {
      label: "Đã từ chối",
      value: Number(adjustmentsReport?.rejectedCount || 0),
      tone: "text-rose-500",
    },
  ];
}

function formatOptionalDecimalValue(value, formatDecimal) {
  const num = Number(value);

  if (!Number.isFinite(num) || Math.abs(num) < 0.0001) {
    return "—";
  }

  return formatDecimal(num);
}

function formatOptionalIntValue(value, formatInt) {
  const num = Number(value);

  if (!Number.isFinite(num) || num === 0) {
    return "—";
  }

  return formatInt(num);
}

export function ReportingAdjustmentsPanel({
  adjustmentsReport,
  adjustmentPage,
  adjustmentPageSize,
  onAdjustmentPageChange,
  onAdjustmentPageSizeChange,
  formatInt,
  formatDecimal,
}) {
  const appliedAdjustments = Array.isArray(adjustmentsReport?.applied) ? adjustmentsReport.applied : [];
  const allAdjustments = Array.isArray(adjustmentsReport?.list) ? adjustmentsReport.list : [];
  const adjustmentTotals = Array.isArray(adjustmentsReport?.totalsList)
    ? adjustmentsReport.totalsList
    : [];
  const safePageSize = ADJUSTMENT_PAGE_SIZE_OPTIONS.includes(Number(adjustmentPageSize))
    ? Number(adjustmentPageSize)
    : 10;
  const totalAdjustmentPages = Math.max(
    1,
    Math.ceil(appliedAdjustments.length / Math.max(safePageSize, 1)),
  );
  const desiredPage = Number(adjustmentPage);
  const currentAdjustmentPage = Number.isFinite(desiredPage)
    ? Math.min(Math.max(desiredPage, 0), totalAdjustmentPages - 1)
    : 0;
  const start = currentAdjustmentPage * safePageSize;
  const paginatedAppliedAdjustments = appliedAdjustments.slice(start, start + safePageSize);
  const pendingAdjustments = allAdjustments.filter((item) => item?.status === "pending");
  const rejectedAdjustments = allAdjustments.filter((item) => item?.status === "rejected");
  const adjustmentStatusStats = buildAdjustmentStatusStats(adjustmentsReport);

  useEffect(() => {
    onAdjustmentPageChange?.(0);
  }, [safePageSize, appliedAdjustments.length, onAdjustmentPageChange]);

  const goToAdjustmentPage = (target) => {
    const desired = Number(target);

    if (!Number.isFinite(desired)) {
      onAdjustmentPageChange?.(0);
      return;
    }

    onAdjustmentPageChange?.(Math.min(Math.max(desired, 0), totalAdjustmentPages - 1));
  };

  return (
    <div className="xl:col-span-2">
      <div className="ds-card space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-[color:var(--ds-text-primary)]">
              Điểm KPI +/- bổ sung
            </h3>

            <p className="mt-1 text-sm text-[color:var(--ds-text-muted)]">
              Điểm cộng/trừ được duyệt sẽ được cộng trực tiếp vào KPI tháng tương ứng trong báo
              cáo.
            </p>
          </div>

          <div className="text-sm text-right text-[color:var(--ds-text-secondary)]">
            <div>Đã duyệt: {formatInt(adjustmentsReport?.approvedCount || 0)} mục</div>

            <div>Chờ duyệt: {formatInt(adjustmentsReport?.pendingCount || 0)} mục</div>

            {adjustmentsReport?.rejectedCount ? (
              <div>Đã từ chối: {formatInt(adjustmentsReport.rejectedCount || 0)} mục</div>
            ) : null}

            <div className="mt-1 font-semibold text-emerald-600">
              Điểm đã áp dụng: {formatDecimal(adjustmentsReport?.totalPoints || 0)}
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h4 className="mb-3 text-sm font-semibold text-[color:var(--ds-text-primary)]">
              Chi tiết điểm đã áp dụng
            </h4>

            <div className="overflow-auto rounded border border-[color:var(--ds-border-subtle)]">
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
                      const scoreClass = item.kpi >= 0 ? "text-emerald-600" : "text-rose-600";

                      return (
                        <tr
                          key={item.key}
                          className="border-b border-[color:var(--ds-border-subtle)] odd:bg-[color:var(--ds-surface-card)] even:bg-[color:var(--ds-surface-muted)] last:border-b-0"
                        >
                          <td className="px-3 py-2">
                            {item.displayDate || (item.date ? item.date.slice(0, 7) : "—")}
                          </td>

                          <td className="px-3 py-2">{item.label || "—"}</td>

                          <td className="px-3 py-2">{item.staffName || "Chưa gán"}</td>

                          <td className="px-3 py-2">{item.teamName || "Chưa gán tổ đội"}</td>

                          <td className="px-3 py-2 text-right">
                            {item.quantity !== null ? formatDecimal(item.quantity) : "—"}

                            {item.unitPoints !== null ? (
                              <span className="ml-1 text-xs text-[color:var(--ds-text-muted)]">
                                × {formatDecimal(item.unitPoints)}
                              </span>
                            ) : null}
                          </td>

                          <td className={`px-3 py-2 text-right font-semibold ${scoreClass}`}>
                            {formatDecimal(item.kpi)}
                          </td>

                          <td className="px-3 py-2">{item.referencesText || "—"}</td>

                          <td className="px-3 py-2">{item.note || "—"}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        className="px-3 py-4 text-center text-[color:var(--ds-text-muted)]"
                        colSpan={8}
                      >
                        Chưa có điểm bổ sung nào được duyệt trong khoảng thời gian này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[color:var(--ds-text-secondary)]">
              <div className="flex items-center gap-2">
                <label
                  className="text-[color:var(--ds-text-muted)]"
                  htmlFor="adjustment-page-size"
                >
                  Số mục mỗi trang
                </label>

                <select
                  id="adjustment-page-size"
                  value={safePageSize}
                  onChange={(event) => onAdjustmentPageSizeChange?.(event.target.value)}
                  className="rounded border border-[color:var(--ds-border-subtle)] bg-white px-2 py-1 text-sm focus:border-[color:var(--ds-border-strong)] focus:outline-none"
                >
                  {ADJUSTMENT_PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span>
                  Trang {currentAdjustmentPage + 1}/{totalAdjustmentPages}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToAdjustmentPage(currentAdjustmentPage - 1)}
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
                    onClick={() => goToAdjustmentPage(currentAdjustmentPage + 1)}
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
          </div>

          <div className="space-y-6">
            <section className="space-y-3 rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-4">
              <div className="text-xs uppercase tracking-wide text-[color:var(--ds-text-secondary)]">
                Điểm đã áp dụng
              </div>

              <div className="text-3xl font-semibold text-emerald-600">
                {formatDecimal(adjustmentsReport?.totalPoints || 0)}
              </div>

              <div className="text-xs text-[color:var(--ds-text-secondary)]">
                Từ {formatInt(adjustmentsReport?.approvedCount || adjustmentsReport?.appliedCount || 0)}{" "}
                lượt xử lý thành công
              </div>

              <ul className="space-y-1 pt-2 text-sm text-[color:var(--ds-text-secondary)]">
                {adjustmentStatusStats.map((item) => (
                  <li key={item.label} className="flex items-center justify-between">
                    <span>{item.label}</span>

                    <span className={`font-semibold ${item.tone}`}>{formatInt(item.value)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h4 className="text-sm font-semibold text-[color:var(--ds-text-primary)]">
                Phân bổ theo hạng mục
              </h4>

              {adjustmentTotals.length ? (
                <ul className="mt-2 space-y-2 text-sm text-[color:var(--ds-text-secondary)]">
                  {adjustmentTotals.map((item) => {
                    const tone = ADJUSTMENT_CATEGORY_TONE_MAP[item.key] || "text-slate-600";

                    return (
                      <li
                        key={item.key}
                        className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-[color:var(--ds-text-primary)]">
                            {item.label}
                          </span>

                          <span className={`font-semibold ${tone}`}>
                            {formatOptionalDecimalValue(item.points, formatDecimal)}
                          </span>
                        </div>

                        <div className="mt-1 text-xs text-[color:var(--ds-text-muted)]">
                          Số lượt:{" "}
                          <span className="font-semibold text-[color:var(--ds-text-primary)]">
                            {formatOptionalIntValue(item.quantity, formatInt)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-[color:var(--ds-text-muted)]">
                  Chưa có dữ liệu phân bổ.
                </p>
              )}
            </section>

            <section className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-[color:var(--ds-text-primary)]">
                  Chờ duyệt
                </h4>

                {pendingAdjustments.length ? (
                  <ul className="mt-2 space-y-2 text-sm text-[color:var(--ds-text-secondary)]">
                    {pendingAdjustments.map((item) => (
                      <li
                        key={item.id}
                        className="rounded border border-dashed border-amber-400 bg-amber-500/10 px-3 py-2"
                      >
                        <div className="font-medium text-[color:var(--ds-text-primary)]">
                          {item.label || item.category}
                        </div>

                        <div>
                          {item.staffName || "Chưa gán"} - {item.month}
                        </div>

                        <div>Điểm đề xuất: {formatDecimal(item.totalPoints || 0)}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-[color:var(--ds-text-muted)]">
                    Không có yêu cầu đang chờ.
                  </p>
                )}
              </div>

              {rejectedAdjustments.length ? (
                <div>
                  <h4 className="text-sm font-semibold text-[color:var(--ds-text-primary)]">
                    Đã từ chối gần đây
                  </h4>

                  <ul className="mt-2 space-y-2 text-sm text-[color:var(--ds-text-secondary)]">
                    {rejectedAdjustments.slice(0, 3).map((item) => (
                      <li
                        key={item.id}
                        className="rounded border border-rose-400/60 bg-rose-500/10 px-3 py-2"
                      >
                        <div className="font-medium text-[color:var(--ds-text-primary)]">
                          {item.label || item.category}
                        </div>

                        <div>
                          {item.staffName || "Chưa gán"} - {item.month}
                        </div>

                        <div>Điểm: {formatDecimal(item.totalPoints || 0)}</div>
                      </li>
                    ))}
                  </ul>

                  {rejectedAdjustments.length > 3 ? (
                    <div className="pt-1 text-xs text-[color:var(--ds-text-muted)]">
                      Còn {rejectedAdjustments.length - 3} mục khác đã bị từ chối.
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
