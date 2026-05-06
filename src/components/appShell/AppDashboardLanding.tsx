import React from 'react';
import { ArrowRight, Info, RefreshCw, AlertCircle, FileBarChart, type LucideIcon } from 'lucide-react';

import { AppShellEmptyState, AppShellLoadingState } from '@/components/appShell/AppShellAsyncStates.jsx';
import { buildAppDashboardSummaryState } from '@/components/appShell/appDashboardSummary.js';
import { useDashboardKpiOverview } from '@/hooks/useDashboardKpiOverview.js';
import { useChartPalette } from '@/designSystem/hooks.js';
import { ReportingExecutiveSummaryPanel } from '@/components/reporting/ReportingExecutiveSummaryPanel.jsx';
import { SummaryCard, TeamPieWidget, TopStaffWidget, TrendLineChart } from '@/components/reporting/ReportingOverviewWidgets.jsx';
import { formatInt, formatDecimal } from '@/components/reporting/reportingDetailUtils.js';
import { t } from '@/lib/i18n.js';
import type { AuthAccountView } from '@/types';

interface SectionTab {
  id: string;
  label: string;
}

interface Section {
  id: string;
  label: string;
  tabs: SectionTab[];
}

interface QuickAction {
  label: string;
  detail: string;
  icon: LucideIcon;
  onClick: () => void;
}

interface DashboardQuickActionProps {
  label: string;
  detail: string;
  onClick: () => void;
  icon?: LucideIcon;
}

function DashboardQuickAction({ label, detail, onClick, icon = ArrowRight }: DashboardQuickActionProps) {
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

interface AppDashboardLandingProps {
  currentUser: AuthAccountView | null;
  sections?: Section[];
  onNavigate?: (module: string, tab?: string) => void;
  onOpenCommandCenter?: () => void;
  canUseAi?: boolean;
  canViewAudit?: boolean;
  canViewDataHealth?: boolean;
}

export default function AppDashboardLanding({
  currentUser,
  sections = [],
  onNavigate,
  onOpenCommandCenter,
  canUseAi = false,
  canViewAudit = false,
  canViewDataHealth = false,
}: AppDashboardLandingProps) {
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
    topStaffByDecls,
    dateRange
  } = useDashboardKpiOverview();

  const chartPalette = useChartPalette();

  const handleGoToReports = () => {
    onNavigate?.("reports");
  };

  const summaryCards = [
    {
      title: t('dashboard.summary.totalDeclarations'),
      value: formatInt(summary?.decls || 0),
      subtitle: t('dashboard.summary.importExport', { importCount: formatInt(summary?.import || 0), exportCount: formatInt(summary?.export || 0) }),
    },
    {
      title: t('dashboard.summary.totalKpiPoints'),
      value: formatDecimal(summary?.kpi || 0),
      subtitle: t('dashboard.summary.includeTypeLicense'),
    },
    {
      title: t('dashboard.summary.adjustmentPoints'),
      value: formatDecimal(adjustmentsReport?.totalPoints || 0),
      subtitle: t('dashboard.summary.approvedPending', { approved: formatInt(adjustmentsReport?.approvedCount || 0), pending: formatInt(adjustmentsReport?.pendingCount || 0) }),
    },
    {
      title: t('dashboard.summary.companyCount'),
      value: formatInt(summary?.companyCount || 0),
      subtitle: t('dashboard.summary.currentAllocation'),
    },
  ];

  return (
    <section
      id="app-workflow-dashboard-landing"
      tabIndex={-1}
      className="ds-dashboard w-full"
      aria-label={t('dashboard.ariaLabel')}
    >
      <div className="ds-dashboard__hero flex flex-wrap items-center justify-between pb-6 mb-6 border-b border-ds-border-subtle">
        <div className="ds-dashboard__hero-copy">
          <p className="ds-dashboard__eyebrow text-ds-accent font-medium tracking-wide text-xs uppercase mb-1">
            {t('dashboard.overview')}
          </p>
          <div className="flex items-center gap-2">
            <h3 className="ds-dashboard__title text-3xl font-bold text-ds-text-primary">
              {isGuest ? t('dashboard.guestMode') : `${operatorName || 'Operator'}`}
            </h3>
            <button
              className="text-ds-text-muted hover:text-ds-accent mt-1 transition-colors"
              title={t('dashboard.infoTooltip')}
            >
              <Info size={20} />
            </button>
          </div>
          <p className="text-sm text-ds-text-secondary mt-1">
            {t('dashboard.currentPeriod', { from: dateRange.from, to: dateRange.to })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={reload}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-ds-text-primary bg-ds-surface-card border border-ds-border-subtle rounded-lg hover:bg-ds-surface-muted disabled:opacity-50 transition-all shadow-sm"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {t('dashboard.refresh')}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {error && (
          <div className="p-4 bg-ds-destructive/10 text-ds-destructive rounded-xl border border-ds-destructive/20 flex items-start gap-3">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm">{t('dashboard.error.title')}</h4>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {loading && !summary?.kpi ? (
          <div className="min-h-[400px]">
            <AppShellLoadingState title={t('dashboard.loading')} />
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
                title={t('dashboard.empty.teamData.title')}
                description={t('dashboard.empty.teamData.description')}
              />
            )}

            {(topStaffByKpi?.length > 0 || topStaffByDecls?.length > 0) && (
              <TopStaffWidget
                kpiData={topStaffByKpi || []}
                declData={topStaffByDecls || []}
                palette={chartPalette}
                formatInt={formatInt}
                formatDecimal={formatDecimal}
                onMetricChange={() => {}}
                onVisibleCountPreferenceChange={() => {}}
              />
            )}

            <div className="mt-8 pt-6 border-t border-ds-border-subtle">
              <h4 className="font-semibold text-ds-text-primary mb-4 text-lg">
                {t('dashboard.quickActions')}
              </h4>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {quickActions.map((action: QuickAction) => (
                  <div key={action.label} className="bg-ds-surface-card rounded-xl shadow-ds-soft border border-ds-border-subtle overflow-hidden hover:border-ds-border-strong transition-colors">
                    <DashboardQuickAction {...action} />
                  </div>
                ))}

                <div className="bg-ds-surface-card rounded-xl shadow-ds-soft border border-ds-border-subtle overflow-hidden hover:border-ds-border-strong transition-colors">
                  <DashboardQuickAction
                    label={t('dashboard.quickAction.openReport')}
                    detail={t('dashboard.quickAction.openReportDetail')}
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
