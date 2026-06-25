import React from 'react';
import { ArrowRight, RefreshCw, AlertCircle, FileBarChart, type LucideIcon } from 'lucide-react';

import { AppShellLoadingState } from '@/components/appShell/AppShellAsyncStates.jsx';
import { buildAppDashboardSummaryState } from '@/components/appShell/appDashboardSummary.js';
import { useDashboardKpiOverview } from '@/hooks/useDashboardKpiOverview.js';
import { useChartPalette } from '@/designSystem/hooks.js';
import { SummaryCard, TeamPieWidget, TopStaffWidget, TrendLineChart } from '@/components/reporting/ReportingOverviewWidgets.jsx';
import { formatInt, formatDecimal } from '@/components/reporting/reportingDetailUtils.js';
import { PageHeader } from '@/components/designSystem/PageHeader';
import { PageLayout } from '@/components/layout/PageLayout';
import { EmptyState } from '@/components/designSystem/primitives';
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
  detail?: string;
  onClick: () => void;
  icon?: LucideIcon;
}

function DashboardQuickAction({ label, onClick, icon = ArrowRight }: DashboardQuickActionProps) {
  const ActionIcon = icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 text-sm text-ds-text-secondary hover:text-ds-accent transition-colors"
    >
      <ActionIcon size={14} strokeWidth={1.75} />
      <span>{label}</span>
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
    <PageLayout title={t('dashboard.title') || "Dashboard"}>
    <section
      id="app-workflow-dashboard-landing"
      tabIndex={-1}
      className="ds-dashboard w-full space-y-4"
      aria-label={t('dashboard.ariaLabel')}
    >
      <PageHeader
        eyebrow={t('dashboard.overview')}
        title={isGuest ? t('dashboard.guestMode') : `${operatorName || 'Operator'}`}
        info={t('dashboard.infoTooltip')}
        meta={[
          <span key="period">{t('dashboard.currentPeriod', { from: dateRange.from, to: dateRange.to })}</span>,
        ]}
        actions={
          <button
            onClick={reload}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-ds-text-primary bg-ds-surface-card border border-ds-border-subtle rounded-md hover:bg-ds-surface-muted disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {t('dashboard.refresh')}
          </button>
        }
      />

      {error && (
        <div className="p-3 bg-ds-destructive/10 text-ds-destructive rounded-lg border border-ds-destructive/20 flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-sm">{t('dashboard.error.title')}</h4>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {loading && !summary?.kpi ? (
        <div className="min-h-[300px]">
          <AppShellLoadingState title={t('dashboard.loading')} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Metric Cards Grid */}
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

          {/* Trend Chart */}
          <TrendLineChart
            data={trendSeries || []}
            comparison={trendComparison}
            palette={chartPalette}
          />

          {/* Team Distribution */}
          {teamPieData?.length > 0 ? (
            <TeamPieWidget
              kpiData={teamPieData}
              declData={teamDeclPieData}
              palette={chartPalette}
              formatInt={formatInt}
              formatDecimal={formatDecimal}
            />
          ) : (
            <EmptyState
              size="compact"
              title={t('dashboard.empty.teamData.title')}
              description={t('dashboard.empty.teamData.description')}
              actions={[
                { label: 'Mở Import →', onClick: () => onNavigate?.('import'), variant: 'secondary' }
              ]}
            />
          )}

          {/* Top Staff */}
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

          {/* Quick Actions - Compact List */}
          <div className="pt-4 border-t border-ds-border-subtle">
            <h4 className="font-medium text-ds-text-primary mb-2 text-sm">
              {t('dashboard.quickActions')}
            </h4>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {quickActions.map((action: QuickAction) => (
                <DashboardQuickAction key={action.label} {...action} />
              ))}
              <DashboardQuickAction
                label={t('dashboard.quickAction.openReport')}
                onClick={handleGoToReports}
                icon={FileBarChart}
              />
            </div>
          </div>
        </div>
      )}
    </section>
    </PageLayout>
  );
}
