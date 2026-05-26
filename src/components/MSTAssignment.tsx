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
} from "@/components/designSystem/shellPrimitives.tsx";

import {
  Command,
  CommandEmpty,
  CommandItem,
} from "@/components/ui/command.tsx";
import type { AuthAccountView } from '@/types';
import { t } from '@/lib/i18n.js';
import { useAppDialog } from '@/hooks/useAppDialog.tsx';

interface MSTAssignmentProps {
  canEdit?: boolean;
  currentUser?: AuthAccountView | null;
}

export default function MSTAssignment({ canEdit = true, currentUser = null }: MSTAssignmentProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [originalRows, setOriginalRows] = useState<Record<string, unknown>[]>([]);
  const { alert: appAlert } = useAppDialog();
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

  const rootRef = useRef<HTMLDivElement>(null);
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

  const [recentlyImportedKeys, setRecentlyImportedKeys] = useState(() => new Set<string>());

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
    alertFn: appAlert,
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
    alertFn: undefined,
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

  const uniqueAgencies = Array.from(
    new Set(
      rows.flatMap((r: Record<string, unknown>) => [r.agency, ...(Array.isArray(r.agents) ? r.agents : [])]).filter(Boolean)
    )
  );

  return (
    <div ref={rootRef} className="p-6 max-w-6xl mx-auto">
      {isReadOnly && (
        <div className="mb-4 rounded border border-ds-warning/30 bg-ds-warning/10 p-3 text-sm text-ds-warning">
          {t('mst.readonlyWarning')}
        </div>
      )}

      <div className="mb-4 bg-ds-surface-card/40 backdrop-blur-md rounded-xl p-4 shadow-ds-soft border border-ds-border-subtle">
        <div className="flex items-center gap-3 mb-4">
          {leadViewEnabled ? <span className="bg-ds-accent/10 text-ds-accent text-xs font-semibold px-2 py-1 rounded-md">{t('mst.leadViewBadge')}</span> : null}
          <span className="bg-ds-surface-muted text-ds-text-secondary text-xs font-bold px-2 py-1 rounded-md">{t('mst.recordCount', { count: filtered.length })}</span>
          {selectedFileName ? <span className="bg-ds-warning/10 text-ds-warning text-xs font-bold px-2 py-1 rounded-md max-w-[200px] truncate">{t('mst.fileLabel', { name: selectedFileName })}</span> : null}
        </div>
        <SectionToolbar
          className="items-start"
          mainClassName="items-end"
          actionsClassName="items-end"
          actions={
            <>
              <label className="inline-flex items-center gap-2 text-sm text-ds-text-primary">
                <input
                  type="checkbox"
                  checked={effectiveGroupByMST}
                  disabled={leadViewEnabled}
                  onChange={(e) => handleGroupByMSTChange(e.target.checked)}
                />
                {leadViewEnabled ? t('mst.groupByMstLocked') : t('mst.groupByMst')}
              </label>
              <SearchField
                label={t('mst.quickSearchLabel')}
                hideLabel
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearchChange(e.target.value)}
                onClear={handleClearSearch}
                placeholder={t('mst.quickSearchPlaceholder')}
                className="w-full sm:w-72"
                data-tooltip="Tìm nhanh theo mã số thuế hoặc tên công ty"
              />
              <button
                type="button"
                onClick={() => exportRowsToExcel("filtered")}
                className="px-3 py-1 rounded border bg-ds-surface-card hover:bg-ds-surface-muted"
                data-tooltip="Xuất XLSX các dòng đang hiển thị kèm metadata người gán và mốc cập nhật gần nhất"
              >
                {t('mst.export.xlsxFiltered')}
              </button>
              <button
                type="button"
                onClick={() => exportRowsToCsv("filtered")}
                className="px-3 py-1 rounded border bg-ds-surface-card hover:bg-ds-surface-muted"
                data-tooltip="Xuất CSV các dòng đang hiển thị kèm metadata người gán và mốc cập nhật gần nhất"
              >
                {t('mst.export.csvFiltered')}
              </button>
              <button
                type="button"
                onClick={() => exportRowsToExcel("all")}
                className="px-3 py-1 rounded border bg-ds-surface-card hover:bg-ds-surface-muted"
                data-tooltip="Xuất XLSX toàn bộ danh sách đang quản lý kèm metadata người gán và mốc cập nhật gần nhất"
              >
                {t('mst.export.xlsxAll')}
              </button>
              <button
                type="button"
                onClick={() => exportRowsToCsv("all")}
                className="px-3 py-1 rounded border bg-ds-surface-card hover:bg-ds-surface-muted"
                data-tooltip="Xuất CSV toàn bộ danh sách đang quản lý kèm metadata người gán và mốc cập nhật gần nhất"
              >
                {t('mst.export.csvAll')}
              </button>
              {canEdit ? (
                <button
                  onClick={onSave}
                  className="px-3 py-1 rounded bg-ds-success text-ds-text-inverse"
                  data-tooltip="Lưu danh sách đang hiển thị vào hệ thống"
                >
                  {t('mst.save')}
                </button>
              ) : null}
            </>
          }
        >
          {canEdit ? (
            <>
              <input
                ref={fileRef as React.RefObject<HTMLInputElement>}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={isReadOnly}
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => (fileRef as React.RefObject<HTMLInputElement>).current?.click()}
                className="px-3 py-1 rounded border bg-ds-surface-card hover:bg-ds-surface-muted"
                data-tooltip="Chọn file Excel chứa dữ liệu gán MST"
              >
                {t('mst.chooseFile')}
              </button>
              <button
                onClick={onImportXLSX}
                className="px-3 py-1 rounded bg-ds-text-primary text-ds-text-inverse"
                type="button"
                data-tooltip="Đọc file Excel và đổ vào danh sách tạm"
              >
                {t('mst.importXlsx')}
              </button>
              <button
                type="button"
                onClick={toggleAddForm}
                className="px-3 py-1 rounded border bg-ds-surface-card hover:bg-ds-surface-muted"
                data-tooltip="Thêm thủ công một dòng gán MST"
              >
                {showAddForm ? t('mst.closeAddForm') : t('mst.addNew')}
              </button>
              <label className="flex flex-col gap-1 text-sm text-ds-text-primary">
                <span className="font-medium">{t('mst.applyFromDate')}</span>
                <input
                  type="date"
                  value={applyFrom}
                  onChange={(e) => handleApplyFromChange(e.target.value)}
                  className="border border-ds-border-subtle rounded px-2 py-1 bg-ds-surface-base"
                  placeholder={t('mst.applyFromDate')}
                  data-tooltip="Áp dụng từ ngày (ghi vào trường trống khi import)"
                />
              </label>
            </>
          ) : (
            <p className="text-sm text-ds-text-secondary">{t('mst.readonlyDescription')}</p>
          )}
        </SectionToolbar>
        {canEdit ? (
          <p className="text-[11px] text-ds-text-muted font-medium italic mt-2">
            {t('mst.applyFromHint')}
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
        onMstChange={(row: Record<string, unknown>, nextMst: string) => updateRow(row, { mst: tidyMST(nextMst) })}
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
        {uniqueAgencies.map((ag: string) => (
          <option key={ag} value={ag} />
        ))}
      </datalist>
    </div>
  );
}
