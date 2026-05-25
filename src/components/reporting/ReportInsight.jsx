import React from "react";
import { ReportingStaffSection } from "./ReportingStaffSection.jsx";
import { ReportingTeamSection } from "./ReportingTeamSection.jsx";
import { ReportingExecutiveSummaryPanel } from "./ReportingExecutiveSummaryPanel.jsx";
import { SectionHeader, SectionSurface } from "@/components/designSystem/shellPrimitives.tsx";

export default function ReportInsight({
  report,
  ruleComparison,
  ruleDeltaLabel,
  scope,
  staffViewMode,
  teamViewMode,
  selectedStaff,
  selectedTeam,
  staffSortKey,
  teamSortKey,
  onStaffSort,
  onTeamSort,
  onStaffViewModeChange,
  onTeamViewModeChange,
  onSelectStaff,
  onSelectTeam,
  staffOptions,
  teamOptions,
  sortedStaffList,
  sortedTeamList,
  companySummaryAllStaff,
  companySummaryAllTeams,
  chartPalette,
  formatInt,
  formatDecimal,
}) {
  return (
    <div className="space-y-6">
      {ruleComparison && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-amber-800">
                So sánh với Active Rule
              </h3>
              <p className="text-xs text-amber-600 mt-1">{ruleDeltaLabel}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-amber-700">
                {ruleComparison.kpi >= 0 ? "+" : ""}
                {formatDecimal(ruleComparison.kpi)} điểm
              </div>
              <div className="text-xs text-amber-600">
                {ruleComparison.decls >= 0 ? "+" : ""}
                {formatInt(ruleComparison.decls)} tờ khai
              </div>
            </div>
          </div>
        </div>
      )}

      <SectionSurface>
        <SectionHeader title="Phân tích Nhân viên" subtitle="Theo dõi KPI và tờ khai theo nhân viên" />
        <ReportingStaffSection
          report={report}
          scope={scope}
          viewMode={staffViewMode}
          selectedKey={selectedStaff}
          sortKey={staffSortKey}
          options={staffOptions}
          list={sortedStaffList}
          companyRows={companySummaryAllStaff}
          chartPalette={chartPalette}
          formatInt={formatInt}
          formatDecimal={formatDecimal}
          onViewModeChange={onStaffViewModeChange}
          onSort={onStaffSort}
          onSelect={onSelectStaff}
        />
      </SectionSurface>

      <SectionSurface>
        <SectionHeader title="Phân tích Tổ đội" subtitle="Theo dõi KPI và tờ khai theo tổ đội" />
        <ReportingTeamSection
          report={report}
          scope={scope}
          viewMode={teamViewMode}
          selectedKey={selectedTeam}
          sortKey={teamSortKey}
          options={teamOptions}
          list={sortedTeamList}
          companyRows={companySummaryAllTeams}
          chartPalette={chartPalette}
          formatInt={formatInt}
          formatDecimal={formatDecimal}
          onViewModeChange={onTeamViewModeChange}
          onSort={onTeamSort}
          onSelect={onSelectTeam}
        />
      </SectionSurface>

      <ReportingExecutiveSummaryPanel
        summary={report.summary}
        adjustmentsReport={report.adjustmentsReport}
        topStaffByKpi={report.topStaffByKpi}
      />
    </div>
  );
}
