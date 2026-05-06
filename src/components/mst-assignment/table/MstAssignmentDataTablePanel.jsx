import React from "react";

import {
  COLUMN_OPTIONS,
  getColumnLabel,
} from "@/components/mst-assignment/hooks/useMSTAssignmentColumnLayout.js";
import ColumnResizeHandle from "@/components/mst-assignment/table/ColumnResizeHandle.jsx";
import HistoryDetails from "@/components/mst-assignment/timeline/HistoryDetails.jsx";
import StageTimelinePreview from "@/components/mst-assignment/timeline/StageTimelinePreview.jsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { ChevronsUpDown } from "lucide-react";

export default function MstAssignmentDataTablePanel({
  children = null,
  pageRows = [],
  filteredCount = 0,
  page = 1,
  totalPages = 1,
  pageSize = 10,
  recentlyImportedCount = 0,
  recentlyImportedKeys = new Set(),
  canEdit = true,
  isReadOnly = false,
  rosterTeams = [],
  historyIndex = new Map(),
  timelineGroupsByMST = new Map(),
  visibleColumnKeys = [],
  columnMenuOpen = false,
  setColumnMenuOpen,
  isColumnVisible,
  toggleColumnVisibility,
  handleResetColumnWidths,
  columnStyleMap,
  handleColumnResizeStart,
  rowHasChanges,
  onRowChange,
  onImportAssigneeSelect,
  onExportAssigneeSelect,
  onStartNewStage,
  onCommitRow,
  onRemoveRow,
  onOpenTimelineGroup,
  onPageSizeChange,
  onPreviousPage,
  onNextPage,
  onMstChange,
  makeRowKey,
  formatISODate,
  formatHistoryTime,
  buildStatusViewModel,
  historyFieldLabels,
  PageSizeControlComponent,
  CompanyNameCellComponent,
  AssigneeCellComponent,
  PersonColumnHeaderComponent,
}) {
  const PageSizeControl = PageSizeControlComponent;
  const CompanyNameCell = CompanyNameCellComponent;
  const AssigneeCell = AssigneeCellComponent;
  const PersonColumnHeader = PersonColumnHeaderComponent;

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">
        <div className="flex flex-wrap items-center gap-2">
          <span>
            {filteredCount} dòng — Trang {page}/{totalPages}
          </span>
          {recentlyImportedCount ? (
            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-amber-700">
              <span className="text-xs font-semibold uppercase">Ưu tiên</span>
              <span>{recentlyImportedCount} dòng mới import đang hiển thị đầu danh sách</span>
            </span>
          ) : null}
        </div>
        <Popover open={columnMenuOpen} onOpenChange={setColumnMenuOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-2">
              <ChevronsUpDown className="size-4" />
              Cột hiển thị ({visibleColumnKeys.length})
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="end">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Tùy chọn hiển thị
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {COLUMN_OPTIONS.map((option) => {
                const checked = isColumnVisible(option.key);

                return (
                  <label key={option.key} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={checked}
                      disabled={option.required}
                      onChange={() => toggleColumnVisibility(option.key)}
                    />
                    <span className="flex-1 truncate">{option.label}</span>
                    {option.required ? (
                      <span className="text-xs text-gray-400">Bắt buộc</span>
                    ) : null}
                  </label>
                );
              })}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3 justify-start text-amber-700 hover:text-amber-800"
              onClick={handleResetColumnWidths}
            >
              Đặt lại chiều rộng
            </Button>

            <p className="mt-3 text-xs text-gray-500">
              * Kéo tay cầm bên phải tiêu đề cột để điều chỉnh chiều rộng. Nếu nội dung vượt màn hình, hãy cuộn ngang
              bảng.
            </p>
          </PopoverContent>
        </Popover>
      </div>

      <div
        className="border rounded overflow-x-auto"
        tabIndex={0}
        aria-label="Vùng cuộn ngang của bảng gán MST"
      >
        <table className="min-w-max table-auto text-sm" aria-label="Danh sách gán MST">
          <caption className="sr-only">
            Danh sách gán MST sau khi áp dụng bộ lọc nhanh, bộ lọc nhân viên và bộ lọc lịch sử.
          </caption>

          <thead className="bg-gray-50">
            <tr>
              {isColumnVisible("mst") ? (
                <th
                  className="group relative p-2 text-left whitespace-nowrap align-bottom"
                  data-column-key="mst"
                  style={columnStyleMap.mst}
                  scope="col"
                >
                  <div className="pr-4 font-semibold">MST</div>
                  <ColumnResizeHandle
                    columnKey="mst"
                    label={getColumnLabel("mst")}
                    onResizeStart={handleColumnResizeStart}
                  />
                </th>
              ) : null}

              {isColumnVisible("company") ? (
                <th
                  className="group relative p-2 text-left align-bottom"
                  data-column-key="company"
                  style={columnStyleMap.company}
                  scope="col"
                >
                  <div className="pr-4 font-semibold">Công ty</div>
                  <ColumnResizeHandle
                    columnKey="company"
                    label={getColumnLabel("company")}
                    onResizeStart={handleColumnResizeStart}
                  />
                </th>
              ) : null}

              {isColumnVisible("person_import") ? (
                <th
                  className="group relative p-2 text-left align-bottom"
                  data-column-key="person_import"
                  style={columnStyleMap.person_import}
                  scope="col"
                >
                  <div className="pr-4">
                    <PersonColumnHeader columnKey="person_import" />
                  </div>
                  <ColumnResizeHandle
                    columnKey="person_import"
                    label={getColumnLabel("person_import")}
                    onResizeStart={handleColumnResizeStart}
                  />
                </th>
              ) : null}

              {isColumnVisible("person_export") ? (
                <th
                  className="group relative p-2 text-left align-bottom"
                  data-column-key="person_export"
                  style={columnStyleMap.person_export}
                  scope="col"
                >
                  <div className="pr-4">
                    <PersonColumnHeader columnKey="person_export" />
                  </div>
                  <ColumnResizeHandle
                    columnKey="person_export"
                    label={getColumnLabel("person_export")}
                    onResizeStart={handleColumnResizeStart}
                  />
                </th>
              ) : null}

              {isColumnVisible("agency") ? (
                <th
                  className="group relative p-2 text-left align-bottom"
                  data-column-key="agency"
                  style={columnStyleMap.agency}
                  scope="col"
                >
                  <div className="pr-4 font-semibold">Đại lý HQ</div>
                  <ColumnResizeHandle
                    columnKey="agency"
                    label={getColumnLabel("agency")}
                    onResizeStart={handleColumnResizeStart}
                  />
                </th>
              ) : null}

              {isColumnVisible("status") ? (
                <th
                  className="group relative p-2 text-left whitespace-nowrap align-bottom"
                  data-column-key="status"
                  style={columnStyleMap.status}
                  scope="col"
                >
                  <div className="pr-4 font-semibold">Trạng thái</div>
                  <ColumnResizeHandle
                    columnKey="status"
                    label={getColumnLabel("status")}
                    onResizeStart={handleColumnResizeStart}
                  />
                </th>
              ) : null}

              {isColumnVisible("effective_from") ? (
                <th
                  className="group relative p-2 text-left whitespace-nowrap align-bottom"
                  data-column-key="effective_from"
                  style={columnStyleMap.effective_from}
                  scope="col"
                >
                  <div className="pr-4 font-semibold">Áp dụng từ ngày</div>
                  <ColumnResizeHandle
                    columnKey="effective_from"
                    label={getColumnLabel("effective_from")}
                    onResizeStart={handleColumnResizeStart}
                  />
                </th>
              ) : null}

              {isColumnVisible("effective_to") ? (
                <th
                  className="group relative p-2 text-left whitespace-nowrap align-bottom"
                  data-column-key="effective_to"
                  style={columnStyleMap.effective_to}
                  scope="col"
                >
                  <div className="pr-4 font-semibold">Đến hết ngày</div>
                  <ColumnResizeHandle
                    columnKey="effective_to"
                    label={getColumnLabel("effective_to")}
                    onResizeStart={handleColumnResizeStart}
                  />
                </th>
              ) : null}

              {isColumnVisible("actions") ? (
                <th
                  className="group relative p-2 text-center whitespace-nowrap align-bottom"
                  data-column-key="actions"
                  style={columnStyleMap.actions}
                  scope="col"
                >
                  <div className="pr-4 font-semibold text-center">Hành động</div>
                  <ColumnResizeHandle
                    columnKey="actions"
                    label={getColumnLabel("actions")}
                    onResizeStart={handleColumnResizeStart}
                  />
                </th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td className="p-3 text-center text-gray-500" colSpan={visibleColumnKeys.length}>
                  Chưa có dữ liệu
                </td>
              </tr>
            ) : (
              pageRows.map((row, index) => {
                const rowKey = makeRowKey(row);
                const rowHistory = historyIndex.get(rowKey) || {};
                const importHistory = rowHistory.person_import || [];
                const exportHistory = rowHistory.person_export || [];
                const effectiveHistory = rowHistory.effective_from || [];
                const effectiveToHistory = rowHistory.effective_to || [];
                const {
                  statusValue,
                  statusDisplay,
                  isStatusAssigned,
                  isStatusPending,
                  isStatusWarning,
                } = buildStatusViewModel(row);
                const rowIsNewlyImported = Boolean(rowKey && recentlyImportedKeys?.has?.(rowKey));
                const isDirty = rowHasChanges(row);
                const isGroupRow = Boolean(row.__group);
                const rowIsReadOnly = isReadOnly || isGroupRow;
                const updateDisabled = !canEdit || !isDirty || isGroupRow;
                const updateLabel = row.__originalKey ? "Cập nhật" : "Lưu mới";
                const timelineGroup = timelineGroupsByMST.get(row.mst || "__unknown");
                const timelineStages = Array.isArray(timelineGroup?.stages) ? timelineGroup.stages : [];
                const timelineCompany = timelineGroup?.company || row.company || "";
                const timelineMST = timelineGroup?.mst || row.mst || "";
                const conflictSummary = timelineGroup?.conflictSummary || null;
                const hasConflictSummary = Boolean(conflictSummary?.hasConflict);
                const timelineGroupWithFallback = timelineGroup || {
                  mst: timelineMST,
                  company: timelineCompany,
                  stages: timelineStages,
                };
                const actionsColumnVisible = isColumnVisible("actions");
                const statusColumnVisible = isColumnVisible("status");
                const showTimelineInStatus = statusColumnVisible && !actionsColumnVisible;

                return (
                  <tr
                    key={rowKey || row.mst || `mst-assignment-row-${index}`}
                    className={`border-t ${rowIsNewlyImported ? "bg-amber-50" : ""}`}
                  >
                    {isColumnVisible("mst") ? (
                      <td
                        className="p-2 align-top whitespace-nowrap"
                        style={columnStyleMap.mst}
                        data-column-key="mst"
                      >
                        {rowIsReadOnly ? (
                          <span>{row.mst}</span>
                        ) : (
                          <input
                            value={row.mst}
                            onChange={(event) => onMstChange(row, event.target.value)}
                            className="border rounded px-2 py-1 w-full"
                          />
                        )}
                        {rowIsNewlyImported ? (
                          <span className="ml-2 inline-flex items-center rounded bg-amber-500/10 px-2 py-0.5 text-xs font-semibold uppercase text-amber-700">
                            Mới import
                          </span>
                        ) : null}
                        {isDirty ? (
                          <span className="ml-2 inline-flex items-center rounded bg-blue-500/10 px-2 py-0.5 text-xs font-semibold uppercase text-blue-700">
                            Đã chỉnh sửa
                          </span>
                        ) : null}
                        {hasConflictSummary ? (
                          <div className="mt-2">
                            <span className="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase text-amber-800">
                              Trùng gán
                            </span>
                          </div>
                        ) : null}
                      </td>
                    ) : null}

                    {isColumnVisible("company") ? (
                      <td className="p-2 align-top" style={columnStyleMap.company} data-column-key="company">
                        <CompanyNameCell
                          value={row.company || ""}
                          isReadOnly={rowIsReadOnly}
                          onChange={(nextValue) => onRowChange(row, { company: nextValue })}
                        />
                      </td>
                    ) : null}

                    {isColumnVisible("person_import") ? (
                      <td
                        className="p-2 align-top"
                        style={columnStyleMap.person_import}
                        data-column-key="person_import"
                      >
                        <AssigneeCell
                          value={row.person_import || ""}
                          placeholder="Chọn nhân viên nhập"
                          isReadOnly={rowIsReadOnly}
                          teams={rosterTeams}
                          teamValue={row.team || ""}
                          onSelect={(payload) => onImportAssigneeSelect(row, payload)}
                          historyEntries={importHistory}
                          historyLabel={historyFieldLabels.person_import}
                          showTeamHint
                        />
                      </td>
                    ) : null}

                    {isColumnVisible("person_export") ? (
                      <td
                        className="p-2 align-top"
                        style={columnStyleMap.person_export}
                        data-column-key="person_export"
                      >
                        <AssigneeCell
                          value={row.person_export || ""}
                          placeholder="Chọn nhân viên xuất"
                          isReadOnly={rowIsReadOnly}
                          teams={rosterTeams}
                          teamValue={row.team || ""}
                          onSelect={(payload) => onExportAssigneeSelect(row, payload)}
                          historyEntries={exportHistory}
                          historyLabel={historyFieldLabels.person_export}
                        />
                      </td>
                    ) : null}

                    {isColumnVisible("agency") ? (
                      <td className="p-2 align-top" style={columnStyleMap.agency} data-column-key="agency">
                        {rowIsReadOnly ? (
                          <span>{row.agency || "—"}</span>
                        ) : (
                          <input
                            list="hq-agency-list"
                            value={row.agency || ""}
                            onChange={(event) => onRowChange(row, { agency: event.target.value })}
                            className="border rounded px-2 py-1 w-full"
                            placeholder="Nhập tên đại lý..."
                          />
                        )}
                      </td>
                    ) : null}

                    {isColumnVisible("status") ? (
                      <td
                        className="p-2 align-top whitespace-nowrap"
                        style={columnStyleMap.status}
                        data-column-key="status"
                      >
                        {statusDisplay ? (
                          <span
                            className={`inline-flex items-center rounded px-2 py-1 text-xs font-semibold ${isStatusAssigned
                              ? "bg-emerald-50 text-emerald-700"
                              : isStatusWarning
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100 text-slate-700"
                              }`}
                          >
                            {statusDisplay}
                          </span>
                        ) : (
                          <span className="italic text-gray-400">Chưa thiết lập</span>
                        )}
                        {!isStatusAssigned && !isStatusWarning && !isStatusPending ? (
                          <div className="mt-1 text-xs text-gray-500">{statusValue}</div>
                        ) : null}
                        {hasConflictSummary ? (
                          <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                            <div className="font-semibold">
                              {conflictSummary.activeStageCount} giai đoạn đang cùng hiệu lực
                            </div>
                            <div className="mt-1">
                              {isGroupRow
                                ? "Gợi ý xử lý nhanh:"
                                : "MST này đang có trùng gán hiện hành. Mở timeline để rà soát chi tiết."}
                            </div>
                            {isGroupRow ? (
                              <ul className="mt-1 list-disc space-y-1 pl-4">
                                {conflictSummary.suggestions.map((suggestion) => (
                                  <li key={suggestion}>{suggestion}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ) : null}
                        {showTimelineInStatus ? (
                          <StageTimelinePreview
                            stages={timelineStages}
                            formatDate={formatISODate}
                            getStageKey={makeRowKey}
                            onViewFull={
                              timelineStages.length
                                ? () => onOpenTimelineGroup(timelineGroupWithFallback)
                                : undefined
                            }
                          />
                        ) : null}
                      </td>
                    ) : null}

                    {isColumnVisible("effective_from") ? (
                      <td
                        className="p-2 align-top whitespace-nowrap"
                        style={columnStyleMap.effective_from}
                        data-column-key="effective_from"
                      >
                        {rowIsReadOnly ? (
                          <span>{row.effective_from || "—"}</span>
                        ) : (
                          <input
                            type="date"
                            value={row.effective_from || ""}
                            onChange={(event) => onRowChange(row, { effective_from: event.target.value })}
                            className="border rounded px-2 py-1 w-full"
                          />
                        )}

                        <HistoryDetails
                          entries={effectiveHistory}
                          label={historyFieldLabels.effective_from}
                          formatTimestamp={formatHistoryTime}
                        />
                      </td>
                    ) : null}

                    {isColumnVisible("effective_to") ? (
                      <td
                        className="p-2 align-top whitespace-nowrap"
                        style={columnStyleMap.effective_to}
                        data-column-key="effective_to"
                      >
                        {rowIsReadOnly ? (
                          <span>{row.effective_to || "Hiện tại"}</span>
                        ) : (
                          <input
                            type="date"
                            value={row.effective_to || ""}
                            onChange={(event) => onRowChange(row, { effective_to: event.target.value })}
                            className="border rounded px-2 py-1 w-full"
                          />
                        )}

                        <HistoryDetails
                          entries={effectiveToHistory}
                          label={historyFieldLabels.effective_to}
                          formatTimestamp={formatHistoryTime}
                        />
                      </td>
                    ) : null}

                    {isColumnVisible("actions") ? (
                      <td
                        className="p-2 align-top text-center whitespace-nowrap"
                        style={columnStyleMap.actions}
                        data-column-key="actions"
                      >
                        <div className="flex flex-col gap-3">
                          {canEdit && !row.__group ? (
                            <div className="flex flex-col gap-2">
                              <button
                                type="button"
                                onClick={() => onStartNewStage(row)}
                                className="px-2 py-1 rounded border bg-white text-gray-700 hover:bg-gray-50"
                                data-tooltip="Sao chép thông tin hiện tại để thêm giai đoạn kế tiếp"
                              >
                                Giai đoạn mới
                              </button>
                              <button
                                type="button"
                                onClick={() => onCommitRow(row)}
                                disabled={updateDisabled}
                                className={`px-2 py-1 rounded text-white ${updateDisabled
                                  ? "bg-gray-400 cursor-not-allowed"
                                  : "bg-emerald-600 hover:bg-emerald-700"
                                  }`}
                                data-tooltip={
                                  updateDisabled ? "Không có thay đổi mới" : "Lưu các thay đổi vừa chỉnh"
                                }
                              >
                                {updateLabel}
                              </button>
                              <button
                                type="button"
                                onClick={() => onRemoveRow(row)}
                                className="px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600"
                                data-tooltip="Xóa dòng"
                              >
                                Xóa
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                          <StageTimelinePreview
                            stages={timelineStages}
                            formatDate={formatISODate}
                            getStageKey={makeRowKey}
                            onViewFull={
                              timelineStages.length
                                ? () => onOpenTimelineGroup(timelineGroupWithFallback)
                                : undefined
                            }
                          />
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {children}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <PageSizeControl value={pageSize} onChange={onPageSizeChange} />

        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={onPreviousPage}
            className={`px-3 py-1 rounded border ${page <= 1 ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            ← Trước
          </button>
          <span className="text-sm">
            Trang {page}/{totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={onNextPage}
            className={`px-3 py-1 rounded border ${page >= totalPages ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            Sau →
          </button>
        </div>
      </div>
    </>
  );
}
