import React, { useEffect, useMemo, useState } from "react";
import { t } from '@/lib/i18n.js';

import "../print.css";

import {
  normalizeStr,
  KPI_ADJUSTMENTS_KEY,
  DECL_KEY,
  MST_KEY,
  RULES_KEY,
  TEAM_KEY,
} from "@/lib/store.js";

import { subscribe as subscribeStorage } from "@/lib/storageClient.js";

import { loadRules, loadRuleSets } from "@/lib/rules.js";

import {
  ReportingControlsPanel,
  ReportingSchedulePanel,
} from "@/components/reporting/ReportingPanels.tsx";
import { ArrowLeft } from "lucide-react";
import {
  formatDecimal,
  formatInt,
  sortStatsCollection,
} from "@/components/reporting/reportingDetailUtils.js";
import { ReportingScopeExplorerPanel } from "@/components/reporting/ReportingScopeExplorerPanel.jsx";
import useReportViewerActions from "@/components/reporting/useReportViewerActions.js";
import useReportViewerPreferences from "@/components/reporting/useReportViewerPreferences.js";
import useReportViewerReadModel from "@/components/reporting/useReportViewerReadModel.js";
import useReportViewerTemplates from "@/components/reporting/useReportViewerTemplates.js";
import { SectionHeader, SectionSurface } from "@/components/designSystem/shellPrimitives.tsx";
import { PageHeader } from "@/components/designSystem/PageHeader";
import { FilterBar, ExportDropdown } from "@/components/designSystem/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { isAdminRole } from "../../packages/domain/src/accountRoles.js";

import { ReportingAdjustmentsPanel } from "@/components/reporting/ReportingAdjustmentsPanel.jsx";

import type { AuthAccountView } from '@/types';
import { LayoutDashboard, Users, Calendar, FileText, ChevronLeft } from "lucide-react";

interface ReportViewerProps {
  canExport?: boolean;
  currentUser?: AuthAccountView | null;
  backTarget?: string | null;
  backLabel?: string;
  onNavigate?: (target: string) => void;
}

const REPORTING_REFRESH_KEYS = [DECL_KEY, MST_KEY, RULES_KEY, TEAM_KEY, KPI_ADJUSTMENTS_KEY];
const REPORT_VIEWER_SECTION_IDS = {
  insights: "report-viewer-insights",
  explorer: "report-viewer-explorer",
  schedule: "report-viewer-schedule",
  notes: "report-viewer-notes",
};

export default function ReportViewer({
  canExport = true,
  currentUser = null,
  backTarget = null,
  backLabel = "Quay lại",
  onNavigate,
}: ReportViewerProps) {
  const {
    storedRuleId,
    quickRange,
    setQuickRange,
    from,
    setFrom,
    to,
    setTo,
    scope,
    setScope,
    selectedStaff,
    setSelectedStaff,
    selectedTeam,
    setSelectedTeam,
    staffViewMode,
    setStaffViewMode,
    teamViewMode,
    setTeamViewMode,
    staffSortKey,
    setStaffSortKey,
    teamSortKey,
    setTeamSortKey,
    columnVisibility,
    exportColumns,
    handleToggleColumnVisibility,
    scheduleCollapsed,
    setScheduleCollapsed,
    selectedRuleId,
    setSelectedRuleId,
    adjustmentPageSize,
    adjustmentPage,
    setAdjustmentPage,
    detailPageSize,
    detailPageSizeMode,
    detailPageSizeCustomInput,
    templatePayload,
    staffDetailPage,
    setStaffDetailPage,
    teamDetailPage,
    setTeamDetailPage,
    applyTemplateFilters,
    handleQuickRangeChange,
    handleDetailPageSizeChange,
    handleDetailPageSizeCustomInputChange,
    handleAdjustmentPageSizeChange,
  } = useReportViewerPreferences();

  const {
    templates,
    selectedTemplateId,
    appliedTemplate,
    appliedTemplateUpdatedAt,
    templateBusy,
    templateSaving,
    handleSelectTemplate,
    handleApplySelectedTemplate,
    handleSaveTemplateAsNew,
    handleOverwriteSelectedTemplate,
    handleDeleteSelectedTemplate,
    handleRefreshTemplates,
  } = useReportViewerTemplates({
    templatePayload,
    onApplyTemplateFilters: applyTemplateFilters,
  });

  const isAdmin = isAdminRole(currentUser?.role);

  const [ruleCollection, setRuleCollection] = useState(() => loadRuleSets());

  const [rules, setRulesState] = useState(() =>
    loadRules(storedRuleId || undefined),
  );

  const activeRule = useMemo(() => {
    const sets = Array.isArray(ruleCollection?.sets) ? ruleCollection.sets : [];

    return sets.find((item) => item.id === ruleCollection?.activeId) || null;
  }, [ruleCollection]);

  const {
    baselineSummary,
    bumpVersion,
    handleReloadData,
    reloading,
    report,
    reportError,
    reportLoading,
    scheduleReadModel,
    version,
  } = useReportViewerReadModel({
    from,
    to,
    selectedRuleId,
    selectedRuleKey: normalizeStr(selectedRuleId),
    activeRuleId: activeRule?.id || "",
    rules,
    refreshKeys: REPORTING_REFRESH_KEYS,
  });

  useEffect(() => {
    setRuleCollection(loadRuleSets());
  }, [version]);

  useEffect(() => {
    const unsubscribeDeclarations = subscribeStorage(DECL_KEY, bumpVersion);

    const unsubscribeAdjustments = subscribeStorage(KPI_ADJUSTMENTS_KEY, bumpVersion);

    const unsubscribeRules = subscribeStorage(RULES_KEY, () => {
      setRuleCollection(loadRuleSets());

      bumpVersion();
    });

    const unsubscribeTeams = subscribeStorage(TEAM_KEY, bumpVersion);

    const unsubscribeMst = subscribeStorage(MST_KEY, bumpVersion);

    return () => {
      unsubscribeDeclarations();

      unsubscribeAdjustments();

      unsubscribeRules();

      unsubscribeTeams();

      unsubscribeMst();
    };
  }, [bumpVersion]);

  useEffect(() => {
    const sets = Array.isArray(ruleCollection?.sets) ? ruleCollection.sets : [];

    if (!sets.length) {
      setRulesState(loadRules());

      return;
    }

    const availableIds = new Set(sets.map((item) => item.id));

    let targetId = selectedRuleId && availableIds.has(selectedRuleId) ? selectedRuleId : "";

    if (!targetId) {
      if (storedRuleId && availableIds.has(storedRuleId)) {
        targetId = storedRuleId;
      }
    }

    if (!targetId) {
      const activeId = ruleCollection?.activeId;

      if (activeId && availableIds.has(activeId)) {
        targetId = activeId;
      } else {
        targetId = sets[0].id;
      }
    }

    if (targetId !== selectedRuleId) {
      setSelectedRuleId(targetId);

      return;
    }

    setRulesState(loadRules(targetId || undefined));
  }, [ruleCollection, selectedRuleId, setSelectedRuleId, storedRuleId]);

  const ruleComparison = useMemo(() => {
    if (!baselineSummary) {
      return null;
    }

    const currentSummary = report?.summary;

    const baselineStats = baselineSummary.summary;

    if (!currentSummary || !baselineStats) {
      return null;
    }

    return {
      kpi: (currentSummary.kpi || 0) - (baselineStats.kpi || 0),

      decls: (currentSummary.decls || 0) - (baselineStats.decls || 0),

      items: (Number((currentSummary as unknown as Record<string, unknown>).items) || 0) - (Number((baselineStats as unknown as Record<string, unknown>).items) || 0),
    };
  }, [baselineSummary, report]);

  const ruleOptions = useMemo(() => {
    const sets = Array.isArray(ruleCollection?.sets) ? ruleCollection.sets : [];

    return sets.map((set) => {
      const versionLabel = Number.isFinite(Number(set.version)) ? `v${Number(set.version)}` : "";

      const activeBadge = ruleCollection?.activeId === set.id ? ` • ${t('report.rule.activeBadge')}` : "";

      const name = set.name || set.id || t('report.rule.defaultName');

      return {
        value: set.id,

        label: `${name} ${versionLabel}`.trim() + activeBadge,
      };
    });
  }, [ruleCollection]);

  const selectedRuleMeta = useMemo(() => {
    const sets = Array.isArray(ruleCollection?.sets) ? ruleCollection.sets : [];

    return sets.find((set) => set.id === selectedRuleId) || null;
  }, [ruleCollection, selectedRuleId]);

  const displayReportSchedules = useMemo(() => {
    return scheduleReadModel.items;
  }, [scheduleReadModel.items]);

  const scheduleAggregateStatus = scheduleReadModel.aggregateStatus;

  const nextScheduleRun = useMemo(() => {
    const activeSchedules = (displayReportSchedules || []).filter((item) => item && item.active);

    const sorted = activeSchedules

      .slice()

      .filter((item) => item.nextRun)

      .sort((a, b) => {
        const dateA = new Date(a.nextRun || 0).getTime();

        const dateB = new Date(b.nextRun || 0).getTime();

        return dateA - dateB;
      });

    return sorted[0] || null;
  }, [displayReportSchedules]);

  const ruleDeltaLabel = useMemo(() => {
    if (!ruleComparison) {
      return "";
    }

    const kpiLabel = `${ruleComparison.kpi >= 0 ? "+" : ""}${formatDecimal(ruleComparison.kpi || 0)} ${t('report.unit.points')}`;

    const declLabel = `${ruleComparison.decls >= 0 ? "+" : ""}${formatInt(ruleComparison.decls || 0)} ${t('report.unit.declarations')}`;

    return `${kpiLabel} • ${declLabel}`;
  }, [ruleComparison]);

  useEffect(() => {
    if (scope === "staff" && selectedStaff !== "all") {
      const exists = report.staff.list.some((item) => item.key === selectedStaff);

      if (!exists) {
        setSelectedStaff("all");
      }
    }
  }, [scope, selectedStaff, report.staff.list, setSelectedStaff]);

  useEffect(() => {
    if (scope === "team" && selectedTeam !== "all") {
      const exists = report.teams.list.some((item) => item.key === selectedTeam);

      if (!exists) {
        setSelectedTeam("all");
      }
    }
  }, [scope, selectedTeam, report.teams.list, setSelectedTeam]);

  const summary = report.summary;

  const adjustmentsReport = report.adjustments;



  const staffOptions = useMemo(() => {
    const base = [{ value: "all", label: t('report.filter.allStaff', { count: report.staff.list.length }) }];

    return base.concat(
      report.staff.list.map((item) => ({
        value: item.key,

        label:
          item.teamLabel && item.teamLabel !== t('report.status.noTeamAssigned')
            ? `${item.name} — ${item.teamLabel}`
            : item.name,
      })),
    );
  }, [report.staff.list]);

  const teamOptions = useMemo(() => {
    const base = [{ value: "all", label: t('report.filter.allTeams', { count: report.teams.list.length }) }];

    return base.concat(report.teams.list.map((item) => ({ value: item.key, label: item.name })));
  }, [report.teams.list]);

  const sortedStaffList = useMemo(() => {
    return sortStatsCollection(report.staff.list, staffSortKey, (item) => item?.name || "");
  }, [report.staff.list, staffSortKey]);

  const sortedTeamList = useMemo(() => {
    return sortStatsCollection(report.teams.list, staffSortKey, (item) => item?.name || "");
  }, [report.teams.list, staffSortKey]);

  const companySummaryAllStaff = useMemo(() => {
    if (staffViewMode !== "company") {
      return [];
    }

    return sortStatsCollection((report.companies as unknown as Record<string, unknown>).rows as any[], staffSortKey, (item) => item?.name || "");
  }, [(report.companies as unknown as Record<string, unknown>).rows, staffSortKey, staffViewMode]);

  const companySummaryAllTeams = useMemo(() => {
    if (staffViewMode !== "company") {
      return [];
    }

    return sortStatsCollection((report.companies as unknown as Record<string, unknown>).groups as any[], staffSortKey, (item) => item?.name || "");
  }, [(report.companies as unknown as Record<string, unknown>).groups, staffSortKey, staffViewMode]);

  const filteredStaffList = sortedStaffList;

  const filteredTeamList = sortedTeamList;

  const filteredCompanySummaryStaff = companySummaryAllStaff;

  const filteredCompanySummaryTeam = companySummaryAllTeams;

  useEffect(() => {
    if (selectedStaff !== "all" || staffViewMode !== "detail") {
      if (staffDetailPage !== 0) {
        setStaffDetailPage(0);
      }

      return;
    }

    const totalPages = Math.max(1, Math.ceil(filteredStaffList.length / detailPageSize)) || 1;

    if (staffDetailPage > totalPages - 1) {
      setStaffDetailPage(totalPages - 1);
    }
  }, [
    detailPageSize,
    filteredStaffList.length,
    selectedStaff,
    setStaffDetailPage,
    staffDetailPage,
    staffViewMode,
  ]);

  useEffect(() => {
    if (selectedTeam !== "all" || teamViewMode !== "detail") {
      if (teamDetailPage !== 0) {
        setTeamDetailPage(0);
      }

      return;
    }

    const totalPages = Math.max(1, Math.ceil(filteredTeamList.length / detailPageSize)) || 1;

    if (teamDetailPage > totalPages - 1) {
      setTeamDetailPage(totalPages - 1);
    }
  }, [
    detailPageSize,
    filteredTeamList.length,
    selectedTeam,
    setTeamDetailPage,
    teamDetailPage,
    teamViewMode,
  ]);

  const activeStaff = selectedStaff !== "all" ? report.staff.byKey.get(selectedStaff) : null;

  const activeTeam = selectedTeam !== "all" ? report.teams.byKey.get(selectedTeam) : null;

  const {
    scheduleDraft,
    editingScheduleId,
    exporting,
    handleScheduleFieldChange,
    handleToggleScheduleFormat,
    handleToggleDeliveryChannel,
    handleEditSchedule,
    handleResetScheduleForm,
    handleSaveSchedule,
    handleDeleteSchedule,
    handleExportStaffAll,
    handleExportStaffDetail,
    handleExportTeamAll,
    handleExportTeamDetail,
  } = useReportViewerActions({
    canExport,
    summary,
    report,
    exportColumns,
    reportLoading,
    reportError,
  });

  const excludeCodes = report.rules?.licenseExcludedSummary || t('report.status.none');

  const ruleApply = (report.rules as unknown as Record<string, unknown>)?.ruleApply as string || t('report.rule.systemDefault');

  const ruleComparisonLabel = ruleComparison ? ruleDeltaLabel : "";

  const activeRuleMessage =
    ruleCollection?.activeId === (selectedRuleMeta?.id || "")
      ? t('report.rule.activeMessage')
      : `${t('report.rule.activeLabel')} ${activeRule?.name || "—"}`;

  const reportTabs = [
    { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'staff', label: 'Nhân viên', icon: Users },
    { id: 'team', label: 'Tổ đội', icon: Users },
    { id: 'schedule', label: 'Lịch gửi', icon: Calendar },
    { id: 'templates', label: 'Mẫu', icon: FileText },
  ];

  const exportItems = [
    { id: 'excel', label: 'Xuất Excel', icon: 'FileSpreadsheet' },
    { id: 'pdf', label: 'Xuất PDF', icon: 'FileText' },
  ];

  const [activeReportTab, setActiveReportTab] = useState('overview');

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="HIỆU SUẤT"
        title="Báo cáo KPI"
        info="Xem và xuất báo cáo KPI tổng hợp theo nhân viên và tổ đội"
        meta={[
          backTarget && (
            <button
              key="back"
              type="button"
              onClick={() => onNavigate?.(backTarget)}
              className="inline-flex items-center gap-1 text-sm text-ds-text-secondary hover:text-ds-accent transition-colors"
            >
              <ChevronLeft size={14} />
              {backLabel}
            </button>
          )
        ].filter(Boolean)}
        actions={
          <div className="flex items-center gap-2">
            <ExportDropdown
              items={[
                { id: 'excel', label: 'Xuất Excel', format: 'xlsx' as const },
                { id: 'pdf', label: 'Xuất PDF', format: 'pdf' as const },
                { id: 'csv', label: 'Xuất CSV', format: 'csv' as const },
              ]}
              onExport={(id) => console.log('Export:', id)}
              triggerLabel="Xuất báo cáo"
            />
          </div>
        }
      />

      {/* Reporting Controls */}
      <ReportingControlsPanel
        reloading={reloading}
        onReloadData={handleReloadData}
        quickRange={quickRange}
        onQuickRangeChange={handleQuickRangeChange}
        from={from}
        to={to}
        onFromChange={(value: string) => {
          setFrom(value);
          setQuickRange("custom");
        }}
        onToChange={(value: string) => {
          setTo(value);
          setQuickRange("custom");
        }}
        ruleOptions={ruleOptions}
        selectedRuleId={selectedRuleId}
        onRuleChange={setSelectedRuleId}
        selectedRuleVersionLabel={
          selectedRuleMeta?.version != null ? `v${selectedRuleMeta.version}` : "—"
        }
        ruleComparisonLabel={ruleComparisonLabel}
        activeRuleMessage={activeRuleMessage}
        nextScheduleRun={nextScheduleRun}
        reportRange={report.range}
        ruleApply={ruleApply}
        scheduleAggregateStatus={scheduleAggregateStatus}
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        appliedTemplate={appliedTemplate}
        appliedTemplateUpdatedAt={appliedTemplateUpdatedAt}
        templateBusy={templateBusy}
        templateSaving={templateSaving}
        onSelectTemplate={handleSelectTemplate}
        onApplySelectedTemplate={handleApplySelectedTemplate}
        onSaveTemplateAsNew={handleSaveTemplateAsNew}
        onOverwriteSelectedTemplate={handleOverwriteSelectedTemplate}
        onDeleteSelectedTemplate={handleDeleteSelectedTemplate}
        onRefreshTemplates={handleRefreshTemplates}
        summaryDeclsText={`${report.summary?.decls || 0} tờ khai`}
      />




      <SectionSurface id={REPORT_VIEWER_SECTION_IDS.explorer} aria-label={t('report.section.explorerAria')}>
        <SectionHeader
          title={t('report.section.explorerTitle')}
          titleAs="h3"
          info={t('report.section.explorerDesc')}
        />
        <ReportingScopeExplorerPanel
          scope={scope}
          onScopeChange={setScope}
          selectedStaff={selectedStaff}
          onSelectedStaffChange={setSelectedStaff}
          selectedTeam={selectedTeam}
          onSelectedTeamChange={setSelectedTeam}
          staffOptions={staffOptions}
          teamOptions={teamOptions}
          columnVisibility={columnVisibility}
          onToggleColumnVisibility={handleToggleColumnVisibility}
          reportLoading={reportLoading}
          reportError={reportError}
          summary={summary}
          staffViewMode={staffViewMode}
          setStaffViewMode={setStaffViewMode}
          staffSortKey={staffSortKey}
          setStaffSortKey={setStaffSortKey}
          staffDetailPage={staffDetailPage}
          setStaffDetailPage={setStaffDetailPage}
          filteredStaffList={filteredStaffList}
          filteredCompanySummaryStaff={filteredCompanySummaryStaff}
          activeStaff={activeStaff}
          handleExportStaffAll={handleExportStaffAll}
          handleExportStaffDetail={handleExportStaffDetail}
          teamViewMode={teamViewMode}
          setTeamViewMode={setTeamViewMode}
          teamSortKey={teamSortKey}
          setTeamSortKey={setTeamSortKey}
          teamDetailPage={teamDetailPage}
          setTeamDetailPage={setTeamDetailPage}
          filteredTeamList={filteredTeamList}
          filteredCompanySummaryTeam={filteredCompanySummaryTeam}
          activeTeam={activeTeam}
          handleExportTeamAll={handleExportTeamAll}
          handleExportTeamDetail={handleExportTeamDetail}
          canExport={canExport}
          exporting={exporting}
          detailPageSize={detailPageSize}
          detailPageSizeMode={detailPageSizeMode}
          detailPageSizeCustomInput={detailPageSizeCustomInput}
          handleDetailPageSizeChange={handleDetailPageSizeChange}
          handleDetailPageSizeCustomInputChange={handleDetailPageSizeCustomInputChange}
          formatInt={formatInt}
          formatDecimal={formatDecimal}
        />
      </SectionSurface>

      <div id="report-viewer-adjustments" className="mt-8">
        <ReportingAdjustmentsPanel
          adjustmentsReport={adjustmentsReport}
          adjustmentPageSize={adjustmentPageSize}
          adjustmentPage={adjustmentPage}
          onAdjustmentPageChange={setAdjustmentPage}
          onAdjustmentPageSizeChange={handleAdjustmentPageSizeChange}
          formatInt={formatInt}
          formatDecimal={formatDecimal}
        />
      </div>

      {isAdmin ? (
        <div id={REPORT_VIEWER_SECTION_IDS.schedule}>
          <ReportingSchedulePanel
            collapsed={scheduleCollapsed}
            onToggleCollapsed={() => setScheduleCollapsed((value) => !value)}
            nextScheduleRun={nextScheduleRun}
            scheduleAggregateStatus={scheduleAggregateStatus}
            scheduleDraft={scheduleDraft}
            editingScheduleId={editingScheduleId}
            onSubmit={handleSaveSchedule}
            onFieldChange={handleScheduleFieldChange}
            onToggleFormat={handleToggleScheduleFormat}
            onToggleDeliveryChannel={handleToggleDeliveryChannel}
            onReset={handleResetScheduleForm}
            onEdit={handleEditSchedule}
            onDelete={handleDeleteSchedule}
            schedules={displayReportSchedules}
          />
        </div>
      ) : null}

      <SectionSurface id={REPORT_VIEWER_SECTION_IDS.notes} aria-label={t('report.section.notesTitle')}>
        <SectionHeader
          title={t('report.section.notesTitle')}
          titleAs="h3"
          info={t('report.section.notesDesc')}
        />

        <div className="space-y-2 text-sm text-ds-text-secondary">
          <p>{t('report.notes.kpiCalculation')}</p>

          <p>{t('report.notes.excludedLicenses', { codes: excludeCodes })}</p>

          <p>{t('report.notes.printExport', { shortcut: 'Ctrl+P' })}</p>
        </div>
      </SectionSurface>
    </div>
  );
}
