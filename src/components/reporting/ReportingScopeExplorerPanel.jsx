import React from "react";

import { ReportingStaffSection } from "@/components/reporting/ReportingStaffSection.jsx";
import { ReportingTeamSection } from "@/components/reporting/ReportingTeamSection.jsx";

const COLUMN_VISIBILITY_OPTIONS = [
  { key: "items", label: "Mục hàng" },
  { key: "licenses", label: "Số giấy phép" },
  { key: "co", label: "Tờ khai C/O" },
  { key: "coLines", label: "Dòng C/O" },
  { key: "licenseCodes", label: "Mã giấy phép" },
];

export function ReportingScopeExplorerPanel({
  scope,
  onScopeChange,
  selectedStaff,
  onSelectedStaffChange,
  selectedTeam,
  onSelectedTeamChange,
  staffOptions,
  teamOptions,
  columnVisibility = {},
  onToggleColumnVisibility,
  reportLoading,
  reportError,
  summary,
  staffViewMode,
  setStaffViewMode,
  staffSortKey,
  setStaffSortKey,
  staffDetailPage,
  setStaffDetailPage,
  filteredStaffList,
  filteredCompanySummaryStaff,
  activeStaff,
  handleExportStaffAll,
  handleExportStaffDetail,
  teamViewMode,
  setTeamViewMode,
  teamSortKey,
  setTeamSortKey,
  teamDetailPage,
  setTeamDetailPage,
  filteredTeamList,
  filteredCompanySummaryTeam,
  activeTeam,
  handleExportTeamAll,
  handleExportTeamDetail,
  canExport,
  exporting,
  detailPageSize,
  detailPageSizeMode,
  detailPageSizeCustomInput,
  handleDetailPageSizeChange,
  handleDetailPageSizeCustomInputChange,
  formatInt,
  formatDecimal,
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 text-sm text-gray-600 md:flex-row md:flex-wrap md:items-center">
        <div className="font-semibold text-gray-900">Chế độ xem</div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onScopeChange("staff")}
            className={`rounded px-3 py-1.5 ${
              scope === "staff"
                ? "bg-[color:var(--ds-text-primary)] text-[color:var(--ds-text-inverse)]"
                : "border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)]"
            }`}
          >
            Nhân viên
          </button>

          <button
            type="button"
            onClick={() => onScopeChange("team")}
            className={`rounded px-3 py-1.5 ${
              scope === "team"
                ? "bg-[color:var(--ds-text-primary)] text-[color:var(--ds-text-inverse)]"
                : "border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)]"
            }`}
          >
            Tổ đội
          </button>
        </div>

        <div className="w-full md:ml-auto md:w-auto">
          {scope === "staff" ? (
            <select
              className="w-full rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0 md:min-w-[15rem]"
              value={selectedStaff}
              onChange={(event) => onSelectedStaffChange(event.target.value)}
            >
              {staffOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <select
              className="w-full rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0 md:min-w-[15rem]"
              value={selectedTeam}
              onChange={(event) => onSelectedTeamChange(event.target.value)}
            >
              {teamOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
        <span className="font-semibold text-gray-900">Cột báo cáo</span>

        {COLUMN_VISIBILITY_OPTIONS.map((option) => {
          const checked = columnVisibility[option.key] !== false;

          return (
            <label
              key={option.key}
              className={`flex cursor-pointer items-center gap-1 rounded border px-2 py-1 ${
                checked ? "bg-black text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <input
                type="checkbox"
                className="h-3 w-3"
                checked={checked}
                onChange={() => onToggleColumnVisibility(option.key)}
              />

              <span>{option.label}</span>
            </label>
          );
        })}

        <span className="w-full text-[11px] text-gray-400 md:ml-auto md:w-auto">
          Ẩn/hiện sẽ được áp dụng cho cả giao diện và bản in.
        </span>
      </div>

      <div>
        {scope === "staff" ? (
          <ReportingStaffSection
            reportLoading={reportLoading}
            reportError={reportError}
            summary={summary}
            selectedStaff={selectedStaff}
            staffViewMode={staffViewMode}
            setStaffViewMode={setStaffViewMode}
            staffSortKey={staffSortKey}
            setStaffSortKey={setStaffSortKey}
            staffDetailPage={staffDetailPage}
            setStaffDetailPage={setStaffDetailPage}
            filteredStaffList={filteredStaffList}
            filteredCompanySummaryStaff={filteredCompanySummaryStaff}
            activeStaff={activeStaff}
            canExport={canExport}
            exporting={exporting}
            handleExportStaffAll={handleExportStaffAll}
            handleExportStaffDetail={handleExportStaffDetail}
            columnVisibility={columnVisibility}
            detailPageSize={detailPageSize}
            detailPageSizeMode={detailPageSizeMode}
            detailPageSizeCustomInput={detailPageSizeCustomInput}
            handleDetailPageSizeChange={handleDetailPageSizeChange}
            handleDetailPageSizeCustomInputChange={handleDetailPageSizeCustomInputChange}
            formatInt={formatInt}
            formatDecimal={formatDecimal}
          />
        ) : (
          <ReportingTeamSection
            reportLoading={reportLoading}
            reportError={reportError}
            summary={summary}
            selectedTeam={selectedTeam}
            teamViewMode={teamViewMode}
            setTeamViewMode={setTeamViewMode}
            teamSortKey={teamSortKey}
            setTeamSortKey={setTeamSortKey}
            teamDetailPage={teamDetailPage}
            setTeamDetailPage={setTeamDetailPage}
            filteredTeamList={filteredTeamList}
            filteredCompanySummaryTeam={filteredCompanySummaryTeam}
            activeTeam={activeTeam}
            canExport={canExport}
            exporting={exporting}
            handleExportTeamAll={handleExportTeamAll}
            handleExportTeamDetail={handleExportTeamDetail}
            columnVisibility={columnVisibility}
            detailPageSize={detailPageSize}
            detailPageSizeMode={detailPageSizeMode}
            detailPageSizeCustomInput={detailPageSizeCustomInput}
            handleDetailPageSizeChange={handleDetailPageSizeChange}
            handleDetailPageSizeCustomInputChange={handleDetailPageSizeCustomInputChange}
            formatInt={formatInt}
            formatDecimal={formatDecimal}
          />
        )}
      </div>
    </div>
  );
}

export default ReportingScopeExplorerPanel;
