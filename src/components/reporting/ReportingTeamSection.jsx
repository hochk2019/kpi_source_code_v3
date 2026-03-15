import React from "react";

import { CompanySummaryTable } from "@/components/reporting/CompanySummaryTable.jsx";
import { TeamDetailCard } from "@/components/reporting/TeamDetailCard.jsx";
import {
  DETAIL_PAGE_SIZE_OPTIONS,
  METRIC_SORT_OPTIONS,
  getSegmentedButtonClass,
} from "@/components/reporting/reportingDetailUtils.js";

export function ReportingTeamSection({
  reportLoading,
  reportError,
  summary,
  selectedTeam,
  teamViewMode,
  setTeamViewMode,
  teamSortKey,
  setTeamSortKey,
  teamDetailPage,
  setTeamDetailPage,
  filteredTeamList,
  filteredCompanySummaryTeam,
  activeTeam,
  canExport,
  exporting,
  handleExportTeamAll,
  handleExportTeamDetail,
  columnVisibility = {},
  detailPageSize,
  detailPageSizeMode,
  detailPageSizeCustomInput,
  handleDetailPageSizeChange,
  handleDetailPageSizeCustomInputChange,
  formatInt,
  formatDecimal,
}) {
  if (reportLoading && !summary.decls) {
    return (
      <div className="rounded border bg-white p-6 text-center text-sm text-gray-500">
        Đang tải dữ liệu báo cáo KPI từ máy chủ...
      </div>
    );
  }

  if (reportError && !summary.decls) {
    return (
      <div className="rounded border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
        Không thể tải báo cáo KPI: {reportError}
      </div>
    );
  }

  if (!summary.decls) {
    return (
      <div className="rounded border bg-white p-6 text-center text-sm text-gray-500">
        Chưa có dữ liệu tờ khai trong khoảng thời gian đã chọn. Vui lòng import dữ liệu hoặc thay
        đổi bộ lọc.
      </div>
    );
  }

  if (selectedTeam === "all") {
    const totalTeamRows = filteredTeamList.length;
    const teamSliceStart = teamDetailPage * detailPageSize;
    const teamPageItems = filteredTeamList.slice(teamSliceStart, teamSliceStart + detailPageSize);
    const teamPageStart = totalTeamRows === 0 ? 0 : teamSliceStart + 1;
    const teamPageEnd =
      totalTeamRows === 0 ? 0 : Math.min(totalTeamRows, teamSliceStart + teamPageItems.length);
    const teamDetailColumnCount =
      5 +
      (columnVisibility.items !== false ? 1 : 0) +
      (columnVisibility.licenses !== false ? 1 : 0) +
      (columnVisibility.co !== false ? 1 : 0) +
      (columnVisibility.coLines !== false ? 1 : 0) +
      (columnVisibility.licenseCodes !== false ? 1 : 0);
    const totalTeamPages = totalTeamRows === 0 ? 1 : Math.ceil(totalTeamRows / detailPageSize);
    const isFirstTeamPage = teamDetailPage === 0;
    const isLastTeamPage = teamDetailPage >= totalTeamPages - 1;
    const teamRangeLabel = totalTeamRows
      ? `${formatInt(teamPageStart)}–${formatInt(teamPageEnd)} / ${formatInt(totalTeamRows)}`
      : "0 / 0";

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 rounded-full bg-[color:var(--ds-surface-muted)] px-2 py-1">
            <button
              type="button"
              onClick={() => setTeamViewMode("summary")}
              className={getSegmentedButtonClass(teamViewMode === "summary")}
            >
              Tổng quan
            </button>

            <button
              type="button"
              onClick={() => setTeamViewMode("detail")}
              className={getSegmentedButtonClass(teamViewMode === "detail")}
            >
              Chi tiết
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--ds-text-secondary)]">
            <span className="font-semibold text-[color:var(--ds-text-primary)]">Sắp xếp theo:</span>

            <div className="flex items-center gap-1">
              {METRIC_SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTeamSortKey(option.value)}
                  className={getSegmentedButtonClass(teamSortKey === option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ml-auto flex flex-col gap-1 text-right">
            <button
              type="button"
              onClick={handleExportTeamAll}
              disabled={!canExport || exporting}
              className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${
                canExport && !exporting
                  ? "border-[color:var(--ds-border-strong)] bg-[color:var(--ds-accent)] text-[color:var(--ds-text-inverse)] hover:bg-[color:var(--ds-accent-strong)]"
                  : "cursor-not-allowed border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-disabled)]"
              }`}
            >
              {exporting ? "Đang xuất..." : "Xuất Excel"}
            </button>

            <span className="text-[11px] text-[color:var(--ds-text-muted)]">
              Nhấn Ctrl+P để in nhanh toàn trang
            </span>
          </div>
        </div>

        {teamViewMode === "summary" ? (
          <CompanySummaryTable
            rows={filteredCompanySummaryTeam}
            includeStaff
            includeTeam
            visibleColumns={columnVisibility}
            sortKey={teamSortKey}
            formatInt={formatInt}
            formatDecimal={formatDecimal}
          />
        ) : (
          <>
            <div className="overflow-auto rounded border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Tổ đội</th>
                    <th className="px-3 py-2 text-right">Tờ khai</th>
                    <th className="px-3 py-2 text-right">Điểm KPI</th>
                    <th className="px-3 py-2 text-right">Nhập</th>
                    <th className="px-3 py-2 text-right">Xuất</th>

                    {columnVisibility.items !== false && (
                      <th className="px-3 py-2 text-right">Mục hàng</th>
                    )}

                    {columnVisibility.licenses !== false && (
                      <th className="px-3 py-2 text-right">Số GP</th>
                    )}

                    {columnVisibility.co !== false && (
                      <th className="px-3 py-2 text-right">Tờ khai C/O</th>
                    )}

                    {columnVisibility.coLines !== false && (
                      <th className="px-3 py-2 text-right">Dòng C/O</th>
                    )}

                    {columnVisibility.licenseCodes !== false && (
                      <th className="px-3 py-2 text-left">Mã giấy phép</th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {totalTeamRows ? (
                    teamPageItems.map((item, idx) => (
                      <tr key={item.key} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-3 py-1.5">{item.name}</td>
                        <td className="px-3 py-1.5 text-right">{formatInt(item.stats.decls)}</td>
                        <td className="px-3 py-1.5 text-right">{formatDecimal(item.stats.kpi)}</td>
                        <td className="px-3 py-1.5 text-right">{formatInt(item.stats.import)}</td>
                        <td className="px-3 py-1.5 text-right">{formatInt(item.stats.export)}</td>

                        {columnVisibility.items !== false && (
                          <td className="px-3 py-1.5 text-right">{formatInt(item.stats.items)}</td>
                        )}

                        {columnVisibility.licenses !== false && (
                          <td className="px-3 py-1.5 text-right">
                            {formatInt(item.stats.licenses)}
                          </td>
                        )}

                        {columnVisibility.co !== false && (
                          <td className="px-3 py-1.5 text-right">{formatInt(item.stats.co)}</td>
                        )}

                        {columnVisibility.coLines !== false && (
                          <td className="px-3 py-1.5 text-right">
                            {formatInt(item.stats.coLines)}
                          </td>
                        )}

                        {columnVisibility.licenseCodes !== false && (
                          <td className="px-3 py-1.5" title={item.licenseSummary || "—"}>
                            {item.licenseSummary || "—"}
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={teamDetailColumnCount}
                        className="px-3 py-4 text-center text-sm text-[color:var(--ds-text-muted)]"
                      >
                        Không có tổ đội nào phù hợp với điều kiện lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalTeamRows ? (
              <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-[color:var(--ds-text-secondary)]">
                <div className="flex items-center gap-2">
                  <span>Hiển thị</span>

                  <select
                    value={detailPageSize}
                    onChange={handleDetailPageSizeChange}
                    className="rounded border px-2 py-1 text-xs text-[color:var(--ds-text-primary)] focus:border-[color:var(--ds-border-strong)] focus:outline-none"
                  >
                    {DETAIL_PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>

                  {detailPageSizeMode === "custom" ? (
                    <input
                      type="number"
                      min="1"
                      value={detailPageSizeCustomInput}
                      onChange={handleDetailPageSizeCustomInputChange}
                      className="w-16 rounded border px-2 py-1 text-xs text-[color:var(--ds-text-primary)] focus:border-[color:var(--ds-border-strong)] focus:outline-none"
                      aria-label="Số nhân viên mỗi trang"
                    />
                  ) : null}

                  <span>dòng/trang</span>
                </div>

                <div className="flex items-center gap-2">
                  <span>{teamRangeLabel}</span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setTeamDetailPage((prev) => Math.max(prev - 1, 0))}
                      disabled={isFirstTeamPage}
                      className={`rounded border px-2 py-1 font-semibold transition-colors ${
                        isFirstTeamPage
                          ? "cursor-not-allowed border-[color:var(--ds-border-subtle)] text-[color:var(--ds-text-disabled)]"
                          : "border-[color:var(--ds-border-strong)] text-[color:var(--ds-text-primary)] hover:bg-[color:var(--ds-surface-muted)]"
                      }`}
                    >
                      Trước
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setTeamDetailPage((prev) => Math.min(prev + 1, totalTeamPages - 1))
                      }
                      disabled={isLastTeamPage}
                      className={`rounded border px-2 py-1 font-semibold transition-colors ${
                        isLastTeamPage
                          ? "cursor-not-allowed border-[color:var(--ds-border-subtle)] text-[color:var(--ds-text-disabled)]"
                          : "border-[color:var(--ds-border-strong)] text-[color:var(--ds-text-primary)] hover:bg-[color:var(--ds-surface-muted)]"
                      }`}
                    >
                      Sau
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {totalTeamRows ? (
              <div className="space-y-6">
                {teamPageItems.map((item) => (
                  <TeamDetailCard
                    key={item.key}
                    team={item}
                    canExport={canExport}
                    onExport={() => handleExportTeamDetail(item)}
                    exporting={exporting}
                    visibleColumns={columnVisibility}
                    memberSortKey={teamSortKey}
                    detailPageSize={detailPageSize}
                    detailPageSizeMode={detailPageSizeMode}
                    detailPageSizeCustomInput={detailPageSizeCustomInput}
                    onDetailPageSizeChange={handleDetailPageSizeChange}
                    onDetailPageSizeCustomInputChange={handleDetailPageSizeCustomInputChange}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded border border-dashed border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-4 text-center text-sm text-[color:var(--ds-text-secondary)]">
                Không có tổ đội nào khớp tìm kiếm.
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (!activeTeam) {
    return null;
  }

  return (
    <TeamDetailCard
      team={activeTeam}
      canExport={canExport}
      onExport={() => handleExportTeamDetail(activeTeam)}
      exporting={exporting}
      visibleColumns={columnVisibility}
      memberSortKey={teamSortKey}
      detailPageSize={detailPageSize}
      detailPageSizeMode={detailPageSizeMode}
      detailPageSizeCustomInput={detailPageSizeCustomInput}
      onDetailPageSizeChange={handleDetailPageSizeChange}
      onDetailPageSizeCustomInputChange={handleDetailPageSizeCustomInputChange}
    />
  );
}
