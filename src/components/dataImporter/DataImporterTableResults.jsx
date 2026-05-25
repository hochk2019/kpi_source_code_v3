import React from "react";

import DataImporterTableBody from "@/components/dataImporter/DataImporterTableBody.jsx";
import DataImporterTableHeader from "@/components/dataImporter/DataImporterTableHeader.jsx";

export default function DataImporterTableResults({
  hiddenColumns,
  selectionEnabled,
  historyEnabled,
  updateEnabled,
  deleteEnabled,
  frozenOffsets,
  frozenHeaderClass,
  renderResizeHandle,
  registerHeaderRef,
  getFrozenStyle,
  getColumnStyle,
  columnLabels,
  pageRows,
  totalColumns,
  selectedKeys,
  updatedKeySet,
  coMismatchKeySet,
  duplicate11KeeperSet,
  duplicate11DuplicatesSet,
  rosterTeams,
  agencyOptions,
  frozenCellClass,
  historyIndent,
  buildRowState,
  onToggleSelect,
  onSelectStaff,
  onSelectTeam,
  onSelectAgency,
  onChangeLicenseCount,
  onToggleHistory,
  onSaveRowChanges,
  onRestoreSingle,
  onHardDeleteSingle,
  onDeleteSingle,
  getCoDisplay,
  getKpiDisplay,
  formatDisplayDate,
  formatHistoryTimestamp,
  humanizeDiffKey,
  declHistoryFieldLabels,
  StaffComboboxComponent,
  TeamComboboxComponent,
  AgencyComboboxComponent,
  DeclarationStatusDisplayComponent,
}) {
  return (
    <div
      className="relative overflow-x-auto overflow-y-hidden rounded border bg-white dark:border-slate-700 dark:bg-slate-900/40"
      tabIndex={0}
      aria-label="Vùng cuộn ngang của bảng danh sách tờ khai import"
    >
      <table className="relative w-full min-w-[1200px] table-auto text-sm" aria-label="Danh sách tờ khai import">
        <caption className="sr-only">Danh sách tờ khai import</caption>
        <DataImporterTableHeader
          hiddenColumns={hiddenColumns}
          selectionEnabled={selectionEnabled}
          historyEnabled={historyEnabled}
          updateEnabled={updateEnabled}
          deleteEnabled={deleteEnabled}
          frozenOffsets={frozenOffsets}
          frozenHeaderClass={frozenHeaderClass}
          renderResizeHandle={renderResizeHandle}
          registerHeaderRef={registerHeaderRef}
          getFrozenStyle={getFrozenStyle}
          getColumnStyle={getColumnStyle}
          columnLabels={columnLabels}
        />
        <DataImporterTableBody
          pageRows={pageRows}
          totalColumns={totalColumns}
          hiddenColumns={hiddenColumns}
          selectionEnabled={selectionEnabled}
          selectedKeys={selectedKeys}
          updatedKeySet={updatedKeySet}
          coMismatchKeySet={coMismatchKeySet}
          duplicate11KeeperSet={duplicate11KeeperSet}
          duplicate11DuplicatesSet={duplicate11DuplicatesSet}
          rosterTeams={rosterTeams}
          agencyOptions={agencyOptions}
          historyEnabled={historyEnabled}
          updateEnabled={updateEnabled}
          deleteEnabled={deleteEnabled}
          frozenOffsets={frozenOffsets}
          frozenCellClass={frozenCellClass}
          historyIndent={historyIndent}
          buildRowState={buildRowState}
          onToggleSelect={onToggleSelect}
          onSelectStaff={onSelectStaff}
          onSelectTeam={onSelectTeam}
          onSelectAgency={onSelectAgency}
          onChangeLicenseCount={onChangeLicenseCount}
          onToggleHistory={onToggleHistory}
          onSaveRowChanges={onSaveRowChanges}
          onRestoreSingle={onRestoreSingle}
          onHardDeleteSingle={onHardDeleteSingle}
          onDeleteSingle={onDeleteSingle}
          getCoDisplay={getCoDisplay}
          getKpiDisplay={getKpiDisplay}
          getFrozenStyle={getFrozenStyle}
          getColumnStyle={getColumnStyle}
          formatDisplayDate={formatDisplayDate}
          formatHistoryTimestamp={formatHistoryTimestamp}
          humanizeDiffKey={humanizeDiffKey}
          declHistoryFieldLabels={declHistoryFieldLabels}
          StaffComboboxComponent={StaffComboboxComponent}
          TeamComboboxComponent={TeamComboboxComponent}
          AgencyComboboxComponent={AgencyComboboxComponent}
          DeclarationStatusDisplayComponent={DeclarationStatusDisplayComponent}
        />
      </table>
    </div>
  );
}
