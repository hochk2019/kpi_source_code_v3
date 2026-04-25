import React, { useEffect, useRef, useState } from "react";

import {
  normalizeStr,

  normalizeName,

} from "@/lib/store.js";

import useTooltipTitles from "@/hooks/useTooltipTitles.js";

import usePagination from "@/hooks/usePagination.js";

import useMSTQuickFilters from "@/hooks/useMSTQuickFilters.js";
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
import useMSTAssignmentLeadViewWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentLeadViewWorkspace.js";
import useMSTAssignmentPageResetWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentPageResetWorkspace.js";
import useMSTAssignmentRowCommitWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentRowCommitWorkspace.js";
import useMSTAssignmentRowMutations from "@/components/mst-assignment/hooks/useMSTAssignmentRowMutations.js";
import useMSTAssignmentStaffFilterWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentStaffFilterWorkspace.js";
import useMSTAssignmentTimelineWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentTimelineWorkspace.js";
import useMSTAssignmentViewControlsWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentViewControlsWorkspace.js";
import useMSTAssignmentDerivedRowsWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentDerivedRowsWorkspace.js";
import {
  COMPANY_NAME_WRAP_THRESHOLD,
} from "@/components/mst-assignment/model/companyName.js";
import MstAssignmentStaffCombobox from "@/components/mst-assignment/shared/MstAssignmentStaffCombobox.jsx";
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
import AssigneeCell from "@/components/mst-assignment/table/AssigneeCell.jsx";
import CompanyNameCell from "@/components/mst-assignment/table/CompanyNameCell.jsx";
import MstAssignmentDataTablePanel from "@/components/mst-assignment/table/MstAssignmentDataTablePanel.jsx";
import PageSizeControl from "@/components/mst-assignment/table/PageSizeControl.jsx";
import PersonColumnHeader from "@/components/mst-assignment/table/PersonColumnHeader.jsx";
export { default as AssigneeCell } from "@/components/mst-assignment/table/AssigneeCell.jsx";
export { default as CompanyNameCell } from "@/components/mst-assignment/table/CompanyNameCell.jsx";
export { default as MstAssignmentStaffCombobox } from "@/components/mst-assignment/shared/MstAssignmentStaffCombobox.jsx";
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
    historyEntries,
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
  const {
    handleLeadViewEnabledChange,
    handleLeadViewStatusChange,
    handleLeadViewTeamChange,
    leadViewEnabled,
    leadViewFilter,
    leadViewStatus,
    leadViewTeam,
    resetLeadView,
  } = useMSTAssignmentLeadViewWorkspace({
    goToFirstPage,
  });
  const effectiveGroupByMST = groupByMST || leadViewEnabled;
  /** Filter + phân trang */
  const { displayList, filtered, groupedStages } = useMSTAssignmentDerivedRowsWorkspace({
    activeStatusFilter,
    groupByMST: effectiveGroupByMST,
    leadViewFilter,
    historyFilteredRowKeys,
    makeRowKey,
    normalizeStr,
    recentlyImportedKeys,
    rows,
    search,
    staffFilter,
  });
  const { exportRowsToCsv, exportRowsToExcel } = useMSTAssignmentExportWorkspace({
    rows,
    filteredRows: filtered,
    computeStatusDisplay,
    historyEntries,
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
  const uniqueAgencies = Array.from(
    new Set(
      rows.flatMap((r) => [r.agency, ...(Array.isArray(r.agents) ? r.agents : [])]).filter(Boolean)
    )
  );

  return (

    <div ref={rootRef} className="p-6 max-w-6xl mx-auto">

      {isReadOnly && (

        <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">

          Bạn đang xem bảng gán MST ở chế độ chỉ xem. Đăng nhập bằng tài khoản quản trị hoặc được cấp quyền để import, chỉnh sửa và lưu thay đổi.

        </div>

      )}

      <div className="mb-4 bg-white/40 backdrop-blur-md rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          {leadViewEnabled ? <span className="bg-teal-100 text-teal-800 text-xs font-semibold px-2 py-1 rounded-md">Chế độ Lead-view</span> : null}
          <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-md">{filtered.length} bản ghi</span>
          {selectedFileName ? <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded-md max-w-[200px] truncate">File: {selectedFileName}</span> : null}
        </div>
        <SectionToolbar
          className="items-start"

          mainClassName="items-end"
          actionsClassName="items-end"
          actions={
            <>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={effectiveGroupByMST}
                  disabled={leadViewEnabled}
                  onChange={(e) => handleGroupByMSTChange(e.target.checked)}
                />
                {leadViewEnabled ? "Gom theo MST (khóa bởi lead-view)" : "Gom theo MST"}
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
                data-tooltip="Xuất XLSX các dòng đang hiển thị kèm metadata người gán và mốc cập nhật gần nhất"
              >
                XLSX (lọc)
              </button>
              <button
                type="button"
                onClick={() => exportRowsToCsv("filtered")}
                className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
                data-tooltip="Xuất CSV các dòng đang hiển thị kèm metadata người gán và mốc cập nhật gần nhất"
              >
                CSV (lọc)
              </button>
              <button
                type="button"
                onClick={() => exportRowsToExcel("all")}
                className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
                data-tooltip="Xuất XLSX toàn bộ danh sách đang quản lý kèm metadata người gán và mốc cập nhật gần nhất"
              >
                XLSX (tất cả)
              </button>
              <button
                type="button"
                onClick={() => exportRowsToCsv("all")}
                className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
                data-tooltip="Xuất CSV toàn bộ danh sách đang quản lý kèm metadata người gán và mốc cập nhật gần nhất"
              >
                CSV (tất cả)
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
          <p className="text-[11px] text-gray-400 font-medium italic mt-2">
            * Thời gian "Áp dụng từ ngày" chỉ tác động vào tờ khai mới kể từ mốc này.
          </p>
        ) : null}
      </div>

      <MstAssignmentStaffFilterPanel
        quickFavorites={quickFavorites}
        leadViewEnabled={leadViewEnabled}
        leadViewStatus={leadViewStatus}
        leadViewTeam={leadViewTeam}
        staffFilter={staffFilter}
        rosterTeams={rosterTeams}
        onLeadViewEnabledChange={handleLeadViewEnabledChange}
        onLeadViewStatusChange={handleLeadViewStatusChange}
        onLeadViewTeamChange={handleLeadViewTeamChange}
        onResetLeadView={resetLeadView}
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
          StaffComboboxComponent={MstAssignmentStaffCombobox}
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

      <datalist id="hq-agency-list">
        {uniqueAgencies.map((ag) => (
          <option key={ag} value={ag} />
        ))}
      </datalist>
    </div>

  );

}



