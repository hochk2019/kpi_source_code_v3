import React from 'react';
import { ArrowRight, Info, RefreshCw, AlertCircle, FileBarChart } from 'lucide-react';

import { AppShellEmptyState, AppShellLoadingState } from '@/components/appShell/AppShellAsyncStates.jsx';
import { buildAppDashboardSummaryState } from '@/components/appShell/appDashboardSummary.js';
import { useDashboardKpiOverview } from '@/hooks/useDashboardKpiOverview.js';
import { useChartPalette } from '@/designSystem/hooks.js';
import { ReportingExecutiveSummaryPanel } from '@/components/reporting/ReportingExecutiveSummaryPanel.jsx';
import { SummaryCard, TeamPieWidget, TrendLineChart } from '@/components/reporting/ReportingOverviewWidgets.jsx';
import { formatInt, formatDecimal } from '@/components/reporting/reportingDetailUtils.js';

function DashboardQuickAction({ label, detail, onClick, icon = ArrowRight }) {
  const ActionIcon = icon;

  return (
    <button type="button" className="ds-dashboard__quick-action" onClick={onClick}>
      <span className="ds-dashboard__quick-action-icon" aria-hidden="true">
        <ActionIcon size={16} strokeWidth={1.75} />
      </span>
      <span className="ds-dashboard__quick-action-copy">
        <span className="ds-dashboard__quick-action-label">{label}</span>
        <span className="ds-dashboard__quick-action-detail">{detail}</span>
      </span>
      <span className="ds-dashboard__quick-action-arrow" aria-hidden="true">
        <ArrowRight size={16} strokeWidth={1.75} />
      </span>
    </button>
  );
}

export default function AppDashboardLanding({
  currentUser,
  sections = [],
  onNavigate,
  onOpenCommandCenter,
  canUseAi = false,
  canViewAudit = false,
  canViewDataHealth = false,
}) {
  const {
    isGuest,
    operatorName,
    quickActions,
  } = buildAppDashboardSummaryState({
    currentUser,
    sections,
    onNavigate,
    onOpenCommandCenter,
    canUseAi,
    canViewAudit,
    canViewDataHealth,
  });

  const {
    loading,
    error,
    reload,
    summary,
    trendSeries,
    trendComparison,
    adjustmentsReport,
    teamPieData,
    teamDeclPieData,
    topStaffByKpi,
    dateRange
  } = useDashboardKpiOverview();

  const chartPalette = useChartPalette();

  const handleGoToReports = () => {
    // Attempt to navigate to the detailed report section
    // Fallback to checking how module tags navigate
    onNavigate?.("reports") || onNavigate?.("performance_reports");
  };

  const summaryCards = [
    {
      title: "Tổng tờ khai",
      value: formatInt(summary?.decls || 0),
      subtitle: `Nhập: ${formatInt(summary?.import || 0)} • Xuất: ${formatInt(summary?.export || 0)}`,
    },
    {
      title: "Tổng điểm KPI",
      value: formatDecimal(summary?.kpi || 0),
      subtitle: "Bao gồm điểm loại hình và giấy phép",
    },
    {
      title: "Điểm KPI +/- bổ sung",
      value: formatDecimal(adjustmentsReport?.totalPoints || 0),
      subtitle: `Đã duyệt: ${formatInt(adjustmentsReport?.approvedCount || 0)} • Chờ duyệt: ${formatInt(
        adjustmentsReport?.pendingCount || 0,
      )}`,
    },
    {
      title: "Số công ty quản lý",
      value: formatInt(summary?.companyCount || 0),
      subtitle: "Trong phân bổ tổ đội/nhân viên hiện tại",
    },
  ];

  return (
    <section
      id="app-workflow-dashboard-landing"
      tabIndex={-1}
      className="ds-dashboard w-full"
      aria-label="Dashboard tổng quan KPI"
    >
      <div className="ds-dashboard__hero flex flex-wrap items-center justify-between pb-6 mb-6 border-b border-gray-100">
        <div className="ds-dashboard__hero-copy">
          <p className="ds-dashboard__eyebrow text-amber-600 font-medium tracking-wide text-xs uppercase mb-1">
            Tổng quan KPI
          </p>
          <div className="flex items-center gap-2">
            <h3 className="ds-dashboard__title text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              {isGuest ? 'Chế độ khách' : `${operatorName || 'Operator'}`}
            </h3>
            <button
              className="text-gray-400 hover:text-amber-500 mt-1 transition-colors"
              title="Điểm vào ưu tiên để kiểm tra sức khỏe vận hành."
            >
              <Info size={20} />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Kỳ hiện tại: {dateRange.from} — {dateRange.to}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={reload}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-gray-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-start gap-3">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm">Lỗi dữ liệu KPI</h4>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {loading && !summary?.kpi ? (
          <div className="min-h-[400px]">
            <AppShellLoadingState title="Đang tải dữ liệu KPI..." />
          </div>
        ) : (
          <>
            <ReportingExecutiveSummaryPanel
              summary={summary || {}}
              adjustmentsReport={adjustmentsReport || {}}
              trendComparison={trendComparison}
              topStaffByKpi={topStaffByKpi || []}
              teamPieData={teamPieData || []}
              formatInt={formatInt}
              formatDecimal={formatDecimal}
            />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => (
                <SummaryCard
                  key={card.title}
                  title={card.title}
                  value={card.value}
                  subtitle={card.subtitle}
                />
              ))}
            </div>

            <TrendLineChart
              data={trendSeries || []}
              comparison={trendComparison}
              palette={chartPalette}
            />

            {teamPieData?.length > 0 ? (
              <TeamPieWidget
                kpiData={teamPieData}
                declData={teamDeclPieData}
                palette={chartPalette}
                formatInt={formatInt}
                formatDecimal={formatDecimal}
              />
            ) : (
              <AppShellEmptyState
                title="Chưa có dữ liệu phân quyền / tổ đội"
                description="Không tìm thấy đủ dữ liệu tờ khai để vẽ biểu đồ phân bổ tổ đội."
              />
            )}

            <div className="mt-8 pt-6 border-t border-gray-100">
              <h4 className="font-semibold text-slate-800 mb-4 text-lg">
                Hành động nhanh
              </h4>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {quickActions.map((action) => (
                  <div key={action.label} className="bg-white rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-slate-100/60 overflow-hidden hover:border-slate-300 transition-colors">
                    <DashboardQuickAction {...action} />
                  </div>
                ))}

                <div className="bg-white rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-slate-100/60 overflow-hidden hover:border-slate-300 transition-colors">
                  <DashboardQuickAction
                    label="Mở báo cáo KPI"
                    detail="Xem insight chi tiết, nhân viên, tổ đội và lịch xuất báo cáo"
                    onClick={handleGoToReports}
                    icon={FileBarChart}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
