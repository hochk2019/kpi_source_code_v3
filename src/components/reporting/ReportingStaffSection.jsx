import React from "react";

import { CompanySummaryTable } from "@/components/reporting/CompanySummaryTable.jsx";
import { StaffDetailCard } from "@/components/reporting/StaffDetailCard.jsx";
import {
  DETAIL_PAGE_SIZE_OPTIONS,
  METRIC_SORT_OPTIONS,
  getSegmentedButtonClass,
} from "@/components/reporting/reportingDetailUtils.js";

export function ReportingStaffSection({
  reportLoading,
  reportError,
  summary,
  selectedStaff,
  staffViewMode,
  setStaffViewMode,
  staffSortKey,
  setStaffSortKey,
  staffDetailPage,
  setStaffDetailPage,
  filteredStaffList,
  filteredCompanySummaryStaff,
  activeStaff,
  canExport,
  exporting,
  handleExportStaffAll,
  handleExportStaffDetail,
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

  if (selectedStaff === "all") {
    const totalStaffRows = filteredStaffList.length;
    const staffSliceStart = staffDetailPage * detailPageSize;
    const staffPageItems = filteredStaffList.slice(
      staffSliceStart,
      staffSliceStart + detailPageSize,
    );
    const staffPageStart = totalStaffRows === 0 ? 0 : staffSliceStart + 1;
    const staffPageEnd =
      totalStaffRows === 0 ? 0 : Math.min(totalStaffRows, staffSliceStart + staffPageItems.length);
    const staffDetailColumnCount =
      6 +
      (columnVisibility.items !== false ? 1 : 0) +
      (columnVisibility.licenses !== false ? 1 : 0) +
      (columnVisibility.co !== false ? 1 : 0) +
      (columnVisibility.coLines !== false ? 1 : 0) +
      (columnVisibility.licenseCodes !== false ? 1 : 0);
    const totalStaffPages = totalStaffRows === 0 ? 1 : Math.ceil(totalStaffRows / detailPageSize);
    const isFirstStaffPage = staffDetailPage === 0;
    const isLastStaffPage = staffDetailPage >= totalStaffPages - 1;
    const staffRangeLabel = totalStaffRows
      ? `${formatInt(staffPageStart)}–${formatInt(staffPageEnd)} / ${formatInt(totalStaffRows)}`
      : "0 / 0";

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 rounded-full bg-[color:var(--ds-surface-muted)] px-2 py-1">
            <button
              type="button"
              onClick={() => setStaffViewMode("summary")}
              className={getSegmentedButtonClass(staffViewMode === "summary")}
            >
              Tổng quan
            </button>

            <button
              type="button"
              onClick={() => setStaffViewMode("detail")}
              className={getSegmentedButtonClass(staffViewMode === "detail")}
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
                  onClick={() => setStaffSortKey(option.value)}
                  className={getSegmentedButtonClass(staffSortKey === option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ml-auto flex flex-col gap-1 text-right">
            <button
              type="button"
              onClick={handleExportStaffAll}
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

        {staffViewMode === "summary" ? (
          <CompanySummaryTable
            rows={filteredCompanySummaryStaff}
            includeStaff
            visibleColumns={columnVisibility}
            sortKey={staffSortKey}
            formatInt={formatInt}
            formatDecimal={formatDecimal}
          />
        ) : (
          <>
            <div className="overflow-auto rounded border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Nhân viên</th>
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
                  {totalStaffRows ? (
                    staffPageItems.map((item, idx) => (
                      <tr key={item.key} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-3 py-1.5">{item.name}</td>
                        <td className="px-3 py-1.5">{item.teamLabel}</td>
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
                        colSpan={staffDetailColumnCount}
                        className="px-3 py-4 text-center text-sm text-[color:var(--ds-text-muted)]"
                      >
                        Không có nhân viên phù hợp với điều kiện lọc hiện tại.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalStaffRows ? (
              <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-[color:var(--ds-text-secondary)]">
                <div className="flex items-center gap-2">
                  <span>Hiển thị</span>

                  <select
                    value={detailPageSizeMode === "custom" ? "custom" : String(detailPageSize)}
                    onChange={handleDetailPageSizeChange}
                    className="rounded border px-2 py-1 text-xs text-[color:var(--ds-text-primary)] focus:border-[color:var(--ds-border-strong)] focus:outline-none"
                  >
                    {DETAIL_PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}

                    <option value="custom">Tùy chỉnh...</option>
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
                  <span>{staffRangeLabel}</span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setStaffDetailPage((prev) => Math.max(prev - 1, 0))}
                      disabled={isFirstStaffPage}
                      className={`rounded border px-2 py-1 font-semibold transition-colors ${
                        isFirstStaffPage
                          ? "cursor-not-allowed border-[color:var(--ds-border-subtle)] text-[color:var(--ds-text-disabled)]"
                          : "border-[color:var(--ds-border-strong)] text-[color:var(--ds-text-primary)] hover:bg-[color:var(--ds-surface-muted)]"
                      }`}
                    >
                      Trước
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setStaffDetailPage((prev) => Math.min(prev + 1, totalStaffPages - 1))
                      }
                      disabled={isLastStaffPage}
                      className={`rounded border px-2 py-1 font-semibold transition-colors ${
                        isLastStaffPage
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

            {totalStaffRows ? (
              <div className="space-y-6">
                {staffPageItems.map((item) => (
                  <StaffDetailCard
                    key={item.key}
                    staff={item}
                    canExport={canExport}
                    onExport={() => handleExportStaffDetail(item)}
                    exporting={exporting}
                    visibleColumns={columnVisibility}
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
                Không có nhân viên nào khớp tìm kiếm.
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (!activeStaff) {
    return null;
  }

  return (
    <StaffDetailCard
      staff={activeStaff}
      canExport={canExport}
      onExport={() => handleExportStaffDetail(activeStaff)}
      exporting={exporting}
      visibleColumns={columnVisibility}
      detailPageSize={detailPageSize}
      detailPageSizeMode={detailPageSizeMode}
      detailPageSizeCustomInput={detailPageSizeCustomInput}
      onDetailPageSizeChange={handleDetailPageSizeChange}
      onDetailPageSizeCustomInputChange={handleDetailPageSizeCustomInputChange}
    />
  );
}
