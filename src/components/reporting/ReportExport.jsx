import React from "react";
import { ReportingSchedulePanel } from "./ReportingPanels.jsx";
import { ReportingAdjustmentsPanel } from "./ReportingAdjustmentsPanel.jsx";

export default function ReportExport({
  canExport,
  exporting,
  scheduleDraft,
  editingScheduleId,
  scheduleReadModel,
  nextScheduleRun,
  displayReportSchedules,
  scheduleAggregateStatus,
  onFieldChange,
  onToggleFormat,
  onToggleDeliveryChannel,
  onSaveSchedule,
  onEditSchedule,
  onDeleteSchedule,
  onResetScheduleForm,
  onExportStaffAll,
  onExportStaffDetail,
  onExportTeamAll,
  onExportTeamDetail,
  adjustmentsPanelProps,
  exportColumns,
  reportRange,
  rules,
  activeRule,
  onRuleCollectionChange,
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Lịch gửi báo cáo tự động
        </h3>
        <ReportingSchedulePanel
          draft={scheduleDraft}
          editingId={editingScheduleId}
          schedules={displayReportSchedules}
          nextRun={nextScheduleRun}
          aggregateStatus={scheduleAggregateStatus}
          canEdit={true}
          onFieldChange={onFieldChange}
          onToggleFormat={onToggleFormat}
          onToggleDeliveryChannel={onToggleDeliveryChannel}
          onSave={onSaveSchedule}
          onEdit={onEditSchedule}
          onDelete={onDeleteSchedule}
          onReset={onResetScheduleForm}
        />
      </div>

      {canExport && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Xuất báo cáo</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onExportStaffAll}
              disabled={exporting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {exporting ? "Đang xuất…" : "Xuất tất cả nhân viên"}
            </button>
            <button
              onClick={onExportTeamAll}
              disabled={exporting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {exporting ? "Đang xuất…" : "Xuất tất cả tổ đội"}
            </button>
          </div>
        </div>
      )}

      {adjustmentsPanelProps && (
        <ReportingAdjustmentsPanel {...adjustmentsPanelProps} />
      )}
    </div>
  );
}
