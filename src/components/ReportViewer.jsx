import React, { useEffect, useMemo, useState } from "react";

import "../print.css";

import {
  getTeamRoster,
  getMSTMap,
  normalizeName,
  normalizeStr,
  mapMemberNamesToTeams,
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
  ReportingWorkspaceGuidePanel,
  ReportingSchedulePanel,
} from "@/components/reporting/ReportingPanels.jsx";
import { ReportingDashboardOverview } from "@/components/reporting/ReportingDashboardOverview.jsx";
import {
  formatDecimal,
  formatInt,
  sortStatsCollection,
} from "@/components/reporting/reportingDetailUtils.js";
import { ReportingScopeExplorerPanel } from "@/components/reporting/ReportingScopeExplorerPanel.jsx";
import useReportViewerActions from "@/components/reporting/useReportViewerActions.js";
import useReportViewerPreferences from "@/components/reporting/useReportViewerPreferences.js";
import useReportViewerReadModel from "@/components/reporting/useReportViewerReadModel.js";
import { SectionHeader, SectionSurface } from "@/components/designSystem/shellPrimitives.jsx";

import { isAdminRole } from "../../packages/domain/src/accountRoles.js";

import { useChartPalette } from "@/designSystem/hooks.js";

const REPORTING_REFRESH_KEYS = [DECL_KEY, MST_KEY, RULES_KEY, TEAM_KEY, KPI_ADJUSTMENTS_KEY];
const REPORT_VIEWER_SECTION_IDS = {
  insights: "report-viewer-insights",
  explorer: "report-viewer-explorer",
  schedule: "report-viewer-schedule",
  notes: "report-viewer-notes",
};

export default function ReportViewer({ canExport = true, currentUser = null }) {
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
    topStaffMetric,
    setTopStaffMetric,
    staffSortKey,
    setStaffSortKey,
    teamSortKey,
    setTeamSortKey,
    topStaffVisibleCount,
    setTopStaffVisibleCount,
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
    staffDetailPage,
    setStaffDetailPage,
    teamDetailPage,
    setTeamDetailPage,
    handleQuickRangeChange,
    handleDetailPageSizeChange,
    handleDetailPageSizeCustomInputChange,
    handleAdjustmentPageSizeChange,
  } = useReportViewerPreferences();

  const isAdmin = isAdminRole(currentUser?.role);

  const [ruleCollection, setRuleCollection] = useState(() => loadRuleSets());

  const [rules, setRulesState] = useState(() =>
    loadRules(storedRuleId || undefined),
  );

  const [roster, setRoster] = useState(() => getTeamRoster());

  const [mstRows, setMstRows] = useState(() => getMSTMap());

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

    setRoster(getTeamRoster());

    setMstRows(getMSTMap());
  }, [version]);

  useEffect(() => {
    const unsubscribeDeclarations = subscribeStorage(DECL_KEY, bumpVersion);

    const unsubscribeAdjustments = subscribeStorage(KPI_ADJUSTMENTS_KEY, bumpVersion);

    const unsubscribeRules = subscribeStorage(RULES_KEY, () => {
      setRuleCollection(loadRuleSets());

      bumpVersion();
    });

    const unsubscribeTeams = subscribeStorage(TEAM_KEY, () => {
      setRoster(getTeamRoster());

      bumpVersion();
    });

    const unsubscribeMst = subscribeStorage(MST_KEY, () => {
      setMstRows(getMSTMap());
    });

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

      items: (currentSummary.items || 0) - (baselineStats.items || 0),
    };
  }, [baselineSummary, report]);

  const ruleOptions = useMemo(() => {
    const sets = Array.isArray(ruleCollection?.sets) ? ruleCollection.sets : [];

    return sets.map((set) => {
      const versionLabel = Number.isFinite(Number(set.version)) ? `v${Number(set.version)}` : "";

      const activeBadge = ruleCollection?.activeId === set.id ? " • Đang áp dụng" : "";

      const name = set.name || set.id || "Bộ quy tắc";

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

    const kpiLabel = `${ruleComparison.kpi >= 0 ? "+" : ""}${formatDecimal(ruleComparison.kpi || 0)} điểm`;

    const declLabel = `${ruleComparison.decls >= 0 ? "+" : ""}${formatInt(ruleComparison.decls || 0)} tờ khai`;

    return `${kpiLabel} • ${declLabel}`;
  }, [ruleComparison]);

  const managedCompanyCount = useMemo(() => {
    const teams = Array.isArray(roster?.teams) ? roster.teams : [];

    if (!teams.length || !Array.isArray(mstRows) || !mstRows.length) {
      return 0;
    }

    const teamKeys = new Set();

    for (const team of teams) {
      const teamName = normalizeStr(team?.name);

      const key = normalizeName(teamName);

      if (key) {
        teamKeys.add(key);
      }
    }

    if (!teamKeys.size) {
      return 0;
    }

    const memberMap = mapMemberNamesToTeams(roster);

    const seen = new Set();

    for (const row of mstRows) {
      if (!row) continue;

      let teamKey = normalizeName(normalizeStr(row.team));

      if (!teamKey) {
        const importKey = normalizeName(row.person_import);

        if (memberMap.has(importKey)) {
          teamKey = normalizeName(memberMap.get(importKey)?.team ?? "");
        }
      }

      if (!teamKey) {
        const exportKey = normalizeName(row.person_export);

        if (memberMap.has(exportKey)) {
          teamKey = normalizeName(memberMap.get(exportKey)?.team ?? "");
        }
      }

      if (!teamKey || !teamKeys.has(teamKey)) {
        continue;
      }

      const mst = normalizeStr(row.mst);

      if (mst) {
        seen.add(mst);

        continue;
      }

      const company = normalizeStr(row.company);

      if (company) {
        seen.add(`${teamKey}|${company}`);
      }
    }

    return seen.size;
  }, [mstRows, roster]);

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

  const summaryCompanyCardValue = managedCompanyCount || summary.companyCount;

  const teamCountForSubtitle = Array.isArray(roster?.teams) ? roster.teams.length : 0;

  const companyCardSubtitle = teamCountForSubtitle
    ? `Doanh nghiệp do ${teamCountForSubtitle} tổ đội quản lý`
    : "Doanh nghiệp duy nhất trong giai đoạn";

  const ruleApply = selectedRuleMeta?.applyFrom
    ? `Áp dụng từ ${selectedRuleMeta.applyFrom}`
    : report.rules?.applyFrom
      ? `Áp dụng từ ${report.rules.applyFrom}`
      : "Áp dụng ngay";

  const adjustmentsReport = report.adjustments;

  const topStaffByKpi = useMemo(() => {
    return sortStatsCollection(report.staff.list, "kpi", (item) => item.name || "");
  }, [report.staff.list]);

  const topStaffByDecls = useMemo(() => {
    return sortStatsCollection(report.staff.list, "decls", (item) => item.name || "")
      .map((item) => {
        const teamLabel =
          item.teamLabel && item.teamLabel !== "Chưa gán tổ đội"
            ? item.teamLabel
            : "Chưa gán tổ đội";

        return {
          key: item.key,

          name: item.name,

          decls: Number(item?.stats?.decls || 0),

          team: teamLabel,
        };
      })

      .filter((item) => item.decls > 0);
  }, [report.staff.list]);

  const teamPieData = useMemo(() => {
    return report.teams.list.map((item) => ({
      name: item.name,

      value: Math.round((item.stats.kpi || 0) * 10) / 10,
    }));
  }, [report.teams.list]);

  const teamDeclPieData = useMemo(() => {
    return report.teams.list.map((item) => ({
      name: item.name,

      value: Number(item.stats.decls || 0),
    }));
  }, [report.teams.list]);

  const chartPalette = useChartPalette();

  const sortedStaffList = useMemo(() => {
    return sortStatsCollection(
      report.staff.list,

      staffSortKey,

      (item) => {
        const team =
          item.teamLabel && item.teamLabel !== "Chưa gán tổ đội" ? ` — ${item.teamLabel}` : "";

        return `${item.name || ""}${team}`;
      },
    );
  }, [report.staff.list, staffSortKey]);

  const sortedTeamList = useMemo(() => {
    return sortStatsCollection(report.teams.list, teamSortKey, (item) => item.name || "");
  }, [report.teams.list, teamSortKey]);

  const trend = report.trend || {};

  const trendSeries = trend.series || [];

  const trendComparison = trend.comparison || null;

  const companySummaryAllStaff = Array.isArray(report?.companies?.staff)
    ? report.companies.staff
    : [];

  const companySummaryAllTeams = Array.isArray(report?.companies?.teams)
    ? report.companies.teams
    : [];

  const staffOptions = useMemo(() => {
    const base = [{ value: "all", label: `Tất cả nhân viên (${report.staff.list.length})` }];

    return base.concat(
      report.staff.list.map((item) => ({
        value: item.key,

        label:
          item.teamLabel && item.teamLabel !== "Chưa gán tổ đội"
            ? `${item.name} — ${item.teamLabel}`
            : item.name,
      })),
    );
  }, [report.staff.list]);

  const teamOptions = useMemo(() => {
    const base = [{ value: "all", label: `Tất cả tổ đội (${report.teams.list.length})` }];

    return base.concat(report.teams.list.map((item) => ({ value: item.key, label: item.name })));
  }, [report.teams.list]);

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
  });

  const excludeCodes = report.rules?.licenseExcludedSummary || "Không có";

  const ruleComparisonLabel = ruleComparison ? ruleDeltaLabel : "";

  const activeRuleMessage =
    ruleCollection?.activeId === (selectedRuleMeta?.id || "")
      ? "Đang xem đúng bộ quy tắc đang áp dụng."
      : `Bộ đang áp dụng: ${activeRule?.name || "—"}`;

  return (
    <div className="space-y-6">
      <ReportingControlsPanel
        summaryDeclsText={`${formatInt(summary.decls)} tờ khai hợp lệ`}
        selectedRuleName={selectedRuleMeta?.name || ""}
        reloading={reloading}
        onReloadData={handleReloadData}
        quickRange={quickRange}
        onQuickRangeChange={handleQuickRangeChange}
        from={from}
        to={to}
        onFromChange={(value) => {
          setFrom(value);
          setQuickRange("custom");
        }}
        onToChange={(value) => {
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
      />

      <ReportingWorkspaceGuidePanel canManageSchedule={isAdmin} />

      <SectionSurface id={REPORT_VIEWER_SECTION_IDS.insights} aria-label="Dashboard insight KPI">
        <SectionHeader
          title="Dashboard insight KPI"
          titleAs="h3"
          description="Bắt đầu ở dashboard để nắm nhịp KPI, xu hướng và phân bổ trước khi drill-down theo nhân viên hoặc tổ đội."
        />
        <ReportingDashboardOverview
          summary={summary}
          adjustmentsReport={adjustmentsReport}
          summaryCompanyCardValue={summaryCompanyCardValue}
          companyCardSubtitle={companyCardSubtitle}
          trendSeries={trendSeries}
          trendComparison={trendComparison}
          chartPalette={chartPalette}
          teamPieData={teamPieData}
          teamDeclPieData={teamDeclPieData}
          topStaffMetric={topStaffMetric}
          onTopStaffMetricChange={setTopStaffMetric}
          topStaffByKpi={topStaffByKpi}
          topStaffByDecls={topStaffByDecls}
          topStaffVisibleCount={topStaffVisibleCount}
          onTopStaffVisibleCountChange={setTopStaffVisibleCount}
          adjustmentPage={adjustmentPage}
          adjustmentPageSize={adjustmentPageSize}
          onAdjustmentPageChange={setAdjustmentPage}
          onAdjustmentPageSizeChange={handleAdjustmentPageSizeChange}
          formatInt={formatInt}
          formatDecimal={formatDecimal}
        />
      </SectionSurface>

      <SectionSurface id={REPORT_VIEWER_SECTION_IDS.explorer} aria-label="Khám phá phạm vi báo cáo KPI">
        <SectionHeader
          title="Khám phá phạm vi báo cáo"
          titleAs="h3"
          description="Đổi lát cắt theo nhân viên hoặc tổ đội, tinh chỉnh cột hiển thị và xuất đúng phần dữ liệu đang cần kiểm tra."
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

      <SectionSurface id={REPORT_VIEWER_SECTION_IDS.notes} aria-label="Ghi chú báo cáo KPI">
        <SectionHeader
          title="Ghi chú báo cáo KPI"
          titleAs="h3"
          description="Giữ lại các quy tắc tính điểm và lưu ý export ở cuối workspace để phần đọc insight không bị chìm giữa nội dung vận hành."
        />

        <div className="space-y-2 text-sm text-gray-600">
          <p>
            Điểm KPI được tính tự động dựa trên quy tắc trong mục “Quy tắc KPI”. Khi bạn import tờ
            khai hợp lệ từ Excel, hệ thống sẽ áp dụng quy tắc hiện hành để tính điểm cho từng bản
            ghi và cộng dồn theo nhân viên, tổ đội.
          </p>

          <p>
            Các loại giấy phép bị loại trừ khỏi việc tính điểm: <strong>{excludeCodes}</strong>.
            Bạn có thể điều chỉnh danh sách này trong phần cấu hình quy tắc.
          </p>

          <p>
            Để in báo cáo, hãy chọn phạm vi thời gian và chế độ xem mong muốn, sau đó sử dụng tổ
            hợp phím
            <strong> Ctrl+P</strong> (hoặc Command+P trên macOS). Khi cần lưu trữ hoặc chia sẻ, sử
            dụng nút “Xuất Excel” để tải file theo template chứa bảng tổng hợp và bảng chi tiết
            tương ứng.
          </p>
        </div>
      </SectionSurface>
    </div>
  );
}
