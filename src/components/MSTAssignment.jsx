import React, { useCallback, useEffect, useRef, useState } from "react";

import clsx from "clsx";

import {
  MST_ASSIGNMENT_STATUS,

  normalizeStr,

  normalizeName,

} from "@/lib/store.js";

import useTooltipTitles from "@/hooks/useTooltipTitles.js";

import usePagination from "@/hooks/usePagination.js";

import useMSTQuickFilters from "@/hooks/useMSTQuickFilters.js";
import SharedStaffCombobox from "@/components/shared/StaffCombobox.jsx";
import MstAssignmentAddFormPanel from "@/components/mst-assignment/forms/MstAssignmentAddFormPanel.jsx";
import MstAssignmentHistoryFilterPanel from "@/components/mst-assignment/filters/MstAssignmentHistoryFilterPanel.jsx";
import MstAssignmentStaffFilterPanel from "@/components/mst-assignment/filters/MstAssignmentStaffFilterPanel.jsx";
import { useMSTAssignmentColumnLayout } from "@/components/mst-assignment/hooks/useMSTAssignmentColumnLayout.js";
import useMSTAssignmentPageSize, {
  MIN_PAGE_SIZE,
} from "@/components/mst-assignment/hooks/useMSTAssignmentPageSize.js";
import useMSTAssignmentAddFormWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentAddFormWorkspace.js";
import useMSTAssignmentBootstrapWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentBootstrapWorkspace.js";
import useMSTAssignmentExportWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentExportWorkspace.js";
import useMSTAssignmentHistoryWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentHistoryWorkspace.js";
import useMSTAssignmentImportSaveWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentImportSaveWorkspace.js";
import useMSTAssignmentPageResetWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentPageResetWorkspace.js";
import useMSTAssignmentRowCommitWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentRowCommitWorkspace.js";
import useMSTAssignmentRowMutations from "@/components/mst-assignment/hooks/useMSTAssignmentRowMutations.js";
import useMSTAssignmentStaffFilterWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentStaffFilterWorkspace.js";
import useMSTAssignmentTimelineWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentTimelineWorkspace.js";
import useMSTAssignmentViewControlsWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentViewControlsWorkspace.js";
import useMSTAssignmentDerivedRowsWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentDerivedRowsWorkspace.js";
import {
  COMPANY_NAME_WRAP_THRESHOLD,
  sanitizeCompanyNameInput,
  shouldWrapCompanyName,
} from "@/components/mst-assignment/model/companyName.js";
import {
  findCell,
  toISO,
} from "@/components/mst-assignment/model/importSheet.js";
import {
  formatHistoryTime,
  HISTORY_FIELD_LABELS,
} from "@/components/mst-assignment/model/historyFormatting.js";
import { createRowState } from "@/components/mst-assignment/model/createRowState.js";
import {
  makeRowKey,
  tidyMST,
} from "@/components/mst-assignment/model/rowIdentity.js";
import {
  computeStatusDisplay,
  computeStoredStatus,
  formatISODate,
  normalizeStatusLabel,
} from "@/components/mst-assignment/model/statusDate.js";
import { buildStatusViewModel } from "@/components/mst-assignment/model/statusViewModel.js";
import HistoryDetails from "@/components/mst-assignment/timeline/HistoryDetails.jsx";
import MstAssignmentTimelinePanel from "@/components/mst-assignment/timeline/MstAssignmentTimelinePanel.jsx";
import MstAssignmentDataTablePanel from "@/components/mst-assignment/table/MstAssignmentDataTablePanel.jsx";
import PageSizeControl from "@/components/mst-assignment/table/PageSizeControl.jsx";
import PersonColumnHeader from "@/components/mst-assignment/table/PersonColumnHeader.jsx";
export { default as PageSizeControl } from "@/components/mst-assignment/table/PageSizeControl.jsx";
export { default as PersonColumnHeader } from "@/components/mst-assignment/table/PersonColumnHeader.jsx";

import {
  SearchField,
  SectionHeader,
  SectionSurface,
  SectionToolbar,
} from "@/components/designSystem/shellPrimitives.jsx";

import {

  Command,

  CommandEmpty,

  CommandItem,

} from "@/components/ui/command.jsx";

/** Utils */




const StaffCombobox = (props) => (
  <SharedStaffCombobox
    {...props}
    allowCustom
    preserveTeamOnCustom
    preserveTeamOnClear
  />
);






export function CompanyNameCell({ value, isReadOnly, onChange, placeholder = "Tên công ty" }) {
  const safeValue = value == null ? "" : value.toString();
  const trimmedValue = safeValue.trim();
  const shouldWrap = shouldWrapCompanyName(safeValue);
  const textareaRef = useRef(null);

  const adjustTextareaHeight = useCallback(
    (element, nextValue) => {
      const target = element || textareaRef.current;
      if (!target) {
        return;
      }

      const measuredValue = nextValue ?? safeValue;
      const wrapCandidate = shouldWrapCompanyName(measuredValue);
      const baseMinHeight = wrapCandidate ? 40 : 36;

      target.style.minHeight = `${baseMinHeight}px`;
      target.style.height = "auto";
      const nextHeight = Math.max(target.scrollHeight, baseMinHeight);
      target.style.height = `${nextHeight}px`;
    },
    [safeValue]
  );

  useEffect(() => {
    adjustTextareaHeight();
  }, [safeValue, adjustTextareaHeight]);

  if (isReadOnly) {
    if (!trimmedValue) {
      return (
        <span className="italic text-gray-400" data-company-wrap="empty">
          (Không tên)
        </span>
      );
    }

    return (
      <span
        className={clsx(
          'block whitespace-normal break-words text-gray-900',
          shouldWrap ? 'leading-snug' : 'leading-normal'
        )}
        title={safeValue}
        data-company-wrap={shouldWrap ? 'wrapped' : 'single'}
        style={{ wordBreak: 'break-word' }}
      >
        {safeValue}
      </span>
    );
  }

  const handleChange = (event) => {
    const sanitizedValue = sanitizeCompanyNameInput(event.target.value);
    adjustTextareaHeight(event.target, sanitizedValue);
    if (!onChange) {
      return;
    }

    if (sanitizedValue !== safeValue || event.target.value !== safeValue) {
      onChange(sanitizedValue);
    }
  };

  return (
    <textarea
      ref={textareaRef}
      value={safeValue}
      onChange={handleChange}
      className={clsx(
        'border rounded px-2 py-1 w-full resize-y whitespace-normal break-words',
        shouldWrap ? 'leading-snug min-h-[2.5rem]' : 'leading-normal min-h-[2.25rem]'
      )}
      placeholder={placeholder}
      title={trimmedValue ? safeValue : undefined}
      spellCheck={false}
      data-company-wrap={shouldWrap ? 'wrapped' : 'single'}
      style={{ wordBreak: 'break-word' }}
    />
  );
}

export function AssigneeCell({
  value = "",
  placeholder,
  isReadOnly,
  teams = [],
  teamValue = "",
  onSelect,
  historyEntries = [],
  historyLabel,
  showTeamHint = false,
}) {
  const safeValue = value == null ? "" : value.toString();
  const trimmedValue = safeValue.trim();
  const normalizedTeam = teamValue == null ? "" : teamValue.toString().trim();
  const hasTeamHint = showTeamHint && normalizedTeam;

  const displayNode = isReadOnly ? (
    trimmedValue ? (
      <span
        className="whitespace-normal break-words text-gray-900 leading-snug"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
        title={trimmedValue}
        data-assignee-state="filled"
      >
        {trimmedValue}
      </span>
    ) : (
      <span className="italic text-gray-400" data-assignee-state="empty">
        (Chưa chọn)
      </span>
    )
  ) : (
    <StaffCombobox
      value={safeValue}
      teamValue={teamValue || ""}
      teams={teams}
      placeholder={placeholder}
      onSelect={onSelect}
    />
  );

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-1">
        {displayNode}
        {hasTeamHint ? (
          <span
            className="text-xs text-gray-500"
            title={`Tổ phụ trách: ${normalizedTeam}`}
            data-team-hint="true"
          >
            Tổ: {normalizedTeam}
          </span>
        ) : null}
      </div>
      <HistoryDetails
        entries={historyEntries}
        label={historyLabel}
        formatTimestamp={formatHistoryTime}
      />
    </div>
  );
}

export default function MSTAssignment({ canEdit = true, currentUser = null }) {

  const [rows, setRows] = useState([]); // toàn bộ (bao gồm metadata)

  const [originalRows, setOriginalRows] = useState([]);
  const actor = currentUser?.username || "guest";
  const { initialPageSize, persistPageSize } = useMSTAssignmentPageSize();
  const {
    columnMenuOpen,
    columnStyleMap,
    handleColumnResizeStart,
    handleResetColumnWidths,
    isColumnVisible,
    setColumnMenuOpen,
    toggleColumnVisibility,
    visibleColumnKeys,
  } = useMSTAssignmentColumnLayout({ actor });

  const rootRef = useRef(null);
  const { bindPageSetter, goToFirstPage } = useMSTAssignmentPageResetWorkspace();
  const {
    applyFrom,
    groupByMST,
    handleApplyFromChange,
    handleClearSearch,
    handleGroupByMSTChange,
    handleSearchChange,
    search,
  } = useMSTAssignmentViewControlsWorkspace({
    goToFirstPage,
  });

  const [recentlyImportedKeys, setRecentlyImportedKeys] = useState(() => new Set());

  const isReadOnly = !canEdit;

  const {

    favorites: quickFavorites,

    addFavorite: addQuickFavorite,

    removeFavorite: removeQuickFavorite,

    clearType: _clearQuickFavorite,

  } = useMSTQuickFilters();

  const {
    activeStatusFilter,
    applyActionFavorite,
    filteredHistoryCount,
    handleSaveActionFavorite,
    historyFilter,
    historyFilteredRowKeys,
    historyIndex,
    isHistoryFilterActive,
    refreshHistory,
    resetHistoryFilter,
    totalHistoryCount,
    updateHistoryFilter,
  } = useMSTAssignmentHistoryWorkspace({
    addQuickFavorite,
    goToFirstPage,
  });

  const { rosterTeams } = useMSTAssignmentBootstrapWorkspace({
    createRowState,
    makeRowKey,
    setRows,
    setOriginalRows,
  });
  const { rowHasChanges, commitRow } = useMSTAssignmentRowCommitWorkspace({
    actor,
    createRowState,
    isReadOnly,
    makeRowKey,
    normalizeStatusLabel,
    normalizeStr,
    originalRows,
    refreshHistory,
    setOriginalRows,
    setRecentlyImportedKeys,
    setRows,
    tidyMST,
  });
  const {
    applyStaffFavorite,
    clearStaffFilter,
    handleSaveStaffFavorite,
    handleStaffFilterSelect,
    staffFilter,
  } = useMSTAssignmentStaffFilterWorkspace({
    addQuickFavorite,
    goToFirstPage,
  });
  /** Filter + phân trang */
  const { displayList, filtered, groupedStages } = useMSTAssignmentDerivedRowsWorkspace({
    activeStatusFilter,
    groupByMST,
    historyFilteredRowKeys,
    makeRowKey,
    normalizeStr,
    recentlyImportedKeys,
    rows,
    search,
    staffFilter,
  });
  const { exportRowsToExcel } = useMSTAssignmentExportWorkspace({
    rows,
    filteredRows: filtered,
    computeStatusDisplay,
  });

  const {
    page,
    pageSize,
    pageCount: totalPages,
    currentPageItems: pageRows,
    setPage,
    setPageSize,
    nextPage,
    previousPage,
  } = usePagination(displayList, {
    initialPage: 1,
    initialPageSize,
    minPageSize: MIN_PAGE_SIZE,
  });
  const {
    handleOpenAllTimelines,
    handleOpenTimelineGroup,
    handleTimelineDialogOpenChange,
    timelineDialogState,
    timelineGroupsByMST,
  } = useMSTAssignmentTimelineWorkspace({
    groupedStages,
  });
  useEffect(() => {
    bindPageSetter(setPage);
  }, [bindPageSetter, setPage]);


  useEffect(() => {

    persistPageSize(pageSize);

  }, [pageSize, persistPageSize]);



  const recentlyImportedCount = recentlyImportedKeys.size;

  const {
    fileRef,
    selectedFileName,
    handleFileChange,
    markRecentlyImported,
    onImportXLSX,
    onSave,
  } = useMSTAssignmentImportSaveWorkspace({
    actor,
    applyFrom,
    helpers: {
      createRowState,
      findCell,
      makeRowKey,
      normalizeStatusLabel,
      tidyMST,
      toISO,
    },
    isReadOnly,
    refreshHistory,
    rows,
    setOriginalRows,
    setRecentlyImportedKeys,
    setRows,
    goToFirstPage,
  });

  const {
    updateRow,
    handleRowImportSelect,
    handleRowExportSelect,
    removeRow,
  } = useMSTAssignmentRowMutations({
    computeStoredStatus,
    helpers: {
      makeRowKey,
      normalizeName,
      normalizeStr,
      tidyMST,
    },
    isReadOnly,
    setRecentlyImportedKeys,
    setRows,
  });

  const {
    showAddForm,
    draft,
    addError,
    toggleAddForm,
    startNewStageFromRow,
    handleDraftChange,
    handleDraftImportSelect,
    handleDraftExportSelect,
    handleCloseAddForm,
    handleAddSubmit,
  } = useMSTAssignmentAddFormWorkspace({
    applyFrom,
    computeStoredStatus,
    createRowState,
    goToFirstPage,
    isReadOnly,
    makeRowKey,
    markRecentlyImported,
    normalizeName,
    normalizeStr,
    rows,
    scrollToTopFn: () =>
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    setRows,
    tidyMST,
  });

  useTooltipTitles(rootRef, [
    rows,
    search,
    staffFilter,
    applyFrom,
    page,
    pageSize,
    showAddForm,
    selectedFileName,
    historyFilter,
  ]);



  /** UI */

  return (

    <div ref={rootRef} className="p-6 max-w-6xl mx-auto">

      {isReadOnly && (

        <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">

          Bạn đang xem bảng gán MST ở chế độ chỉ xem. Đăng nhập bằng tài khoản quản trị hoặc được cấp quyền để import, chỉnh sửa và lưu thay đổi.

        </div>

      )}

      <SectionSurface className="mb-4">
        <SectionHeader
          title="Danh sách gán MST"
          description="Quản lý mapping MST, tìm nhanh theo công ty, rồi xuất hoặc lưu working set hiện tại."
          meta={
            <>
              <span className="ds-pill">{filtered.length} dòng đang hiển thị</span>
              {selectedFileName ? <span className="ds-pill">Đã chọn: {selectedFileName}</span> : null}
            </>
          }
        />
        <SectionToolbar
          className="items-start"
          mainClassName="items-end"
          actionsClassName="items-end"
          actions={
            <>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={groupByMST}
                  onChange={(e) => handleGroupByMSTChange(e.target.checked)}
                />
                Gom theo MST
              </label>
              <SearchField
                label="Tìm nhanh MST hoặc công ty"
                hideLabel
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onClear={handleClearSearch}
                placeholder="Tìm nhanh (MST / Công ty)"
                className="w-full sm:w-72"
                data-tooltip="Tìm nhanh theo mã số thuế hoặc tên công ty"
              />
              <button
                type="button"
                onClick={() => exportRowsToExcel("filtered")}
                className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
                data-tooltip="Xuất ra Excel các dòng đang hiển thị theo bộ lọc hiện tại"
              >
                Export (lọc)
              </button>
              <button
                type="button"
                onClick={() => exportRowsToExcel("all")}
                className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
                data-tooltip="Xuất ra Excel toàn bộ danh sách đang quản lý"
              >
                Export (tất cả)
              </button>
              {canEdit ? (
                <button
                  onClick={onSave}
                  className="px-3 py-1 rounded bg-emerald-600 text-white"
                  data-tooltip="Lưu danh sách đang hiển thị vào hệ thống"
                >
                  Lưu
                </button>
              ) : null}
            </>
          }
        >
          {canEdit ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={isReadOnly}
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
                data-tooltip="Chọn file Excel chứa dữ liệu gán MST"
              >
                Chọn file XLSX
              </button>
              <button
                onClick={onImportXLSX}
                className="px-3 py-1 rounded bg-black text-white"
                type="button"
                data-tooltip="Đọc file Excel và đổ vào danh sách tạm"
              >
                Import XLSX
              </button>
              <button
                type="button"
                onClick={toggleAddForm}
                className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
                data-tooltip="Thêm thủ công một dòng gán MST"
              >
                {showAddForm ? "Đóng thêm mới" : "Thêm mới"}
              </button>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                <span className="font-medium">Áp dụng từ ngày</span>
                <input
                  type="date"
                  value={applyFrom}
                  onChange={(e) => handleApplyFromChange(e.target.value)}
                  className="border rounded px-2 py-1"
                  placeholder="Áp dụng từ ngày"
                  data-tooltip="Áp dụng từ ngày (ghi vào trường trống khi import)"
                />
              </label>
            </>
          ) : (
            <p className="text-sm text-gray-600">Xem nhanh danh sách MST, tìm kiếm, gom theo MST và xuất dữ liệu hiện tại.</p>
          )}
        </SectionToolbar>
        {canEdit ? (
          <p className="text-xs text-gray-500">
            * Khi lưu, quy tắc mới chỉ áp dụng cho tờ khai có ngày khai báo từ ngày này trở đi.
          </p>
        ) : null}
      </SectionSurface>

      <MstAssignmentStaffFilterPanel
        quickFavorites={quickFavorites}
        staffFilter={staffFilter}
        rosterTeams={rosterTeams}
        onClearStaffFilter={clearStaffFilter}
        onSaveStaffFavorite={handleSaveStaffFavorite}
        onStaffFilterSelect={handleStaffFilterSelect}
        onApplyStaffFavorite={applyStaffFavorite}
        onRemoveQuickFavorite={removeQuickFavorite}
      />

      <MstAssignmentHistoryFilterPanel
        filteredHistoryCount={filteredHistoryCount}
        totalHistoryCount={totalHistoryCount}
        isHistoryFilterActive={isHistoryFilterActive}
        historyFilter={historyFilter}
        quickFavorites={quickFavorites}
        onResetHistoryFilter={resetHistoryFilter}
        onSaveActionFavorite={handleSaveActionFavorite}
        onHistoryFilterChange={updateHistoryFilter}
        onApplyActionFavorite={applyActionFavorite}
        onRemoveQuickFavorite={removeQuickFavorite}
      />



      {showAddForm ? (
        <MstAssignmentAddFormPanel
          StaffComboboxComponent={StaffCombobox}
          draft={draft}
          addError={addError}
          rosterTeams={rosterTeams}
          onSubmit={handleAddSubmit}
          onMstChange={handleDraftChange("mst", tidyMST)}
          onCompanyChange={handleDraftChange("company")}
          onImportSelect={handleDraftImportSelect}
          onExportSelect={handleDraftExportSelect}
          onTeamChange={handleDraftChange("team")}
          onEffectiveFromChange={handleDraftChange("effective_from")}
          onEffectiveToChange={handleDraftChange("effective_to")}
          onCancel={handleCloseAddForm}
        />
      ) : null}

      <MstAssignmentDataTablePanel
        pageRows={pageRows}
        filteredCount={filtered.length}
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        recentlyImportedCount={recentlyImportedCount}
        recentlyImportedKeys={recentlyImportedKeys}
        canEdit={canEdit}
        isReadOnly={isReadOnly}
        rosterTeams={rosterTeams}
        historyIndex={historyIndex}
        timelineGroupsByMST={timelineGroupsByMST}
        visibleColumnKeys={visibleColumnKeys}
        columnMenuOpen={columnMenuOpen}
        setColumnMenuOpen={setColumnMenuOpen}
        isColumnVisible={isColumnVisible}
        toggleColumnVisibility={toggleColumnVisibility}
        handleResetColumnWidths={handleResetColumnWidths}
        columnStyleMap={columnStyleMap}
        handleColumnResizeStart={handleColumnResizeStart}
        rowHasChanges={rowHasChanges}
        onRowChange={updateRow}
        onPageSizeChange={setPageSize}
        onPreviousPage={previousPage}
        onNextPage={nextPage}
        onMstChange={(row, nextMst) => updateRow(row, { mst: tidyMST(nextMst) })}
        onImportAssigneeSelect={handleRowImportSelect}
        onExportAssigneeSelect={handleRowExportSelect}
        onStartNewStage={startNewStageFromRow}
        onCommitRow={commitRow}
        onRemoveRow={removeRow}
        onOpenTimelineGroup={handleOpenTimelineGroup}
        makeRowKey={makeRowKey}
        formatISODate={formatISODate}
        formatHistoryTime={formatHistoryTime}
        buildStatusViewModel={buildStatusViewModel}
        historyFieldLabels={HISTORY_FIELD_LABELS}
        PageSizeControlComponent={PageSizeControl}
        CompanyNameCellComponent={CompanyNameCell}
        AssigneeCellComponent={AssigneeCell}
        PersonColumnHeaderComponent={PersonColumnHeader}
      >
        <MstAssignmentTimelinePanel
          groupedStages={groupedStages}
          onOpenAllTimelines={handleOpenAllTimelines}
          timelineDialogState={timelineDialogState}
          onTimelineDialogOpenChange={handleTimelineDialogOpenChange}
          formatDate={formatISODate}
          getStageKey={makeRowKey}
        />
      </MstAssignmentDataTablePanel>

    </div>

  );

}



