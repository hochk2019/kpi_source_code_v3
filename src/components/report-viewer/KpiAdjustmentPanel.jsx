import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.jsx";
import { Button } from "@/components/ui/button.jsx";
import { cn } from "@/lib/utils.js";

const AdjustmentDetail = lazy(() => import("./KpiAdjustmentDetail.jsx"));

const PANEL_VISIBILITY_STORAGE_KEY = "kpi-report.adjustment-panel.expanded";

function resolveInitialExpanded(defaultExpanded) {
  if (typeof window === "undefined" || !window.localStorage) {
    return defaultExpanded;
  }
  try {
    const stored = window.localStorage.getItem(PANEL_VISIBILITY_STORAGE_KEY);
    if (stored === "0") return false;
    if (stored === "1") return true;
  } catch (error) {
    console.warn("Không thể đọc trạng thái thu gọn Điểm KPI +/-", error);
  }
  return defaultExpanded;
}

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

function StatPill({ label, value, tone = "text-[color:var(--ds-text-primary)]" }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm">
      <span className="text-[color:var(--ds-text-secondary)]">{label}</span>
      <span className={`font-semibold ${tone}`}>{value}</span>
    </div>
  );
}

export default function KpiAdjustmentPanel({
  adjustmentsReport,
  paginatedAppliedAdjustments,
  pendingAdjustments,
  rejectedAdjustments,
  adjustmentTotals,
  adjustmentStatusStats,
  adjustmentPageSize,
  onAdjustmentPageSizeChange,
  onAdjustmentPrev,
  onAdjustmentNext,
  currentAdjustmentPage,
  totalAdjustmentPages,
  defaultExpanded = false,
  onModeChange,
  formatDecimal,
  formatInt,
  formatOptionalDecimal,
  formatOptionalInt,
}) {
  const initialTab = defaultExpanded ? "detail" : "overview";
  const [tabValue, setTabValue] = useState(initialTab);
  const [isExpanded, setIsExpanded] = useState(() => resolveInitialExpanded(true));

  useEffect(() => {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.setItem(PANEL_VISIBILITY_STORAGE_KEY, isExpanded ? "1" : "0");
    } catch (error) {
      console.warn("Không thể lưu trạng thái thu gọn Điểm KPI +/-", error);
    }
  }, [isExpanded]);

  const overviewTotals = useMemo(
    () => [
      {
        label: "Điểm đã áp dụng",
        value: formatDecimal(adjustmentsReport.totalPoints || 0),
        tone: Number(adjustmentsReport.totalPoints || 0) >= 0 ? "text-emerald-600" : "text-rose-500",
      },
      {
        label: "Lượt đã duyệt",
        value: formatInt(adjustmentsReport.approvedCount || adjustmentsReport.appliedCount || 0),
      },
      {
        label: "Đang chờ",
        value: formatInt(adjustmentsReport.pendingCount || 0),
        tone: "text-amber-600",
      },
      {
        label: "Đã từ chối",
        value: formatInt(adjustmentsReport.rejectedCount || 0),
        tone: "text-rose-500",
      },
    ],
    [
      adjustmentsReport.approvedCount,
      adjustmentsReport.appliedCount,
      adjustmentsReport.pendingCount,
      adjustmentsReport.rejectedCount,
      adjustmentsReport.totalPoints,
      formatDecimal,
      formatInt,
    ],
  );

  const topCategories = useMemo(() => {
    const [first, second, third] = adjustmentTotals;
    return [first, second, third].filter(Boolean);
  }, [adjustmentTotals]);

  const handleTabChange = (value) => {
    setTabValue(value);
    if (typeof onModeChange === "function") {
      onModeChange(value === "detail");
    }
  };

  const toggleLabel = isExpanded ? "Thu gọn" : "Mở rộng";

  return (
    <section className="ds-card space-y-4 p-4">
      <Tabs value={tabValue} onValueChange={handleTabChange} className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-[color:var(--ds-text-primary)]">Điểm KPI +/- bổ sung</h3>
            <p className="text-sm text-[color:var(--ds-text-muted)]">
              Theo dõi điểm cộng/trừ đã áp dụng cho nhân viên và tổ đội. Chuyển sang tab Chi tiết để xem bảng dữ liệu đầy đủ.
            </p>
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:flex-none">
            <TabsList className={cn("ds-tab-list w-full justify-start gap-2 sm:w-auto", !isExpanded && "hidden")}
            >
              <TabsTrigger value="overview">Tổng quan</TabsTrigger>
              <TabsTrigger value="detail">Chi tiết</TabsTrigger>
            </TabsList>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded((prev) => !prev)}
              aria-pressed={isExpanded}
            >
              {toggleLabel}
            </Button>
          </div>
        </div>
        {isExpanded ? (
          <>
            <TabsContent value="overview" className="space-y-4 focus:outline-none">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {overviewTotals.map((item) => (
                  <StatPill key={item.label} label={item.label} value={item.value} tone={item.tone} />
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <section className="space-y-3 rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-4">
                  <header className="space-y-1">
                    <h4 className="text-sm font-semibold text-[color:var(--ds-text-primary)]">Phân bổ theo trạng thái</h4>
                    <p className="text-xs text-[color:var(--ds-text-muted)]">
                      Kiểm tra nhanh số lượng yêu cầu điểm đang ở từng trạng thái xử lý.
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
                    <h4 className="text-sm font-semibold text-[color:var(--ds-text-primary)]">Nhóm hạng mục nổi bật</h4>
                    <p className="text-xs text-[color:var(--ds-text-muted)]">Ba nhóm phát sinh điểm nhiều nhất trong kỳ hiện tại.</p>
                  </header>
                  {topCategories.length ? (
                    <ul className="space-y-2 text-sm text-[color:var(--ds-text-secondary)]">
                      {topCategories.map((item) => {
                        const tone = ADJUSTMENT_CATEGORY_TONE_MAP[item.key] || "text-slate-600";
                        return (
                          <li
                            key={item.key}
                            className="rounded-lg border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-[color:var(--ds-text-primary)]">{item.label}</span>
                              <span className={`font-semibold ${tone}`}>{formatOptionalDecimal(item.points)}</span>
                            </div>
                            <div className="mt-1 text-xs text-[color:var(--ds-text-muted)]">
                              Số lượt: <span className="font-semibold text-[color:var(--ds-text-primary)]">{formatOptionalInt(item.quantity)}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-[color:var(--ds-text-muted)]">Chưa có dữ liệu phân bổ.</p>
                  )}
                </section>
              </div>
              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4">
                  <header className="space-y-1">
                    <h4 className="text-sm font-semibold text-[color:var(--ds-text-primary)]">Yêu cầu đang chờ duyệt</h4>
                    <p className="text-xs text-[color:var(--ds-text-muted)]">Những yêu cầu điểm bổ sung cần được duyệt trong kỳ này.</p>
                  </header>
                  {pendingAdjustments.length ? (
                    <ul className="mt-2 space-y-2 text-sm text-[color:var(--ds-text-secondary)]">
                      {pendingAdjustments.slice(0, 5).map((item) => (
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
                </div>
                <div className="rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4">
                  <header className="space-y-1">
                    <h4 className="text-sm font-semibold text-[color:var(--ds-text-primary)]">Yêu cầu bị từ chối gần đây</h4>
                    <p className="text-xs text-[color:var(--ds-text-muted)]">Theo dõi nhanh những yêu cầu không được phê duyệt để điều chỉnh quy trình.</p>
                  </header>
                  {rejectedAdjustments.length ? (
                    <ul className="mt-2 space-y-2 text-sm text-[color:var(--ds-text-secondary)]">
                      {rejectedAdjustments.slice(0, 3).map((item) => (
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
                  {rejectedAdjustments.length > 3 ? (
                    <div className="pt-1 text-xs text-[color:var(--ds-text-muted)]">
                      Còn {rejectedAdjustments.length - 3} mục khác đã bị từ chối.
                    </div>
                  ) : null}
                </div>
              </section>
            </TabsContent>
            <TabsContent value="detail" className="space-y-4 focus:outline-none">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-[color:var(--ds-border-subtle)] p-8 text-sm text-[color:var(--ds-text-muted)]">
                    Đang tải bảng chi tiết…
                  </div>
                }
              >
                <AdjustmentDetail
                  paginatedAppliedAdjustments={paginatedAppliedAdjustments}
                  currentAdjustmentPage={currentAdjustmentPage}
                  totalAdjustmentPages={totalAdjustmentPages}
                  onAdjustmentPrev={onAdjustmentPrev}
                  onAdjustmentNext={onAdjustmentNext}
                  adjustmentPageSize={adjustmentPageSize}
                  onAdjustmentPageSizeChange={onAdjustmentPageSizeChange}
                  adjustmentTotals={adjustmentTotals}
                  adjustmentStatusStats={adjustmentStatusStats}
                  pendingAdjustments={pendingAdjustments}
                  rejectedAdjustments={rejectedAdjustments}
                  formatDecimal={formatDecimal}
                  formatInt={formatInt}
                  formatOptionalDecimal={formatOptionalDecimal}
                  formatOptionalInt={formatOptionalInt}
                />
              </Suspense>
            </TabsContent>
          </>
        ) : (
          <p className="text-sm text-[color:var(--ds-text-muted)]">
            Khu vực đang được thu gọn. Chọn "Mở rộng" để xem thống kê và bảng chi tiết điểm KPI.
          </p>
        )}
      </Tabs>
    </section>
  );
}
