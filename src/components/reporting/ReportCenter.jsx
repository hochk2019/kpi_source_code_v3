import React from "react";
import { Info } from "lucide-react";
import {
  APP_SHELL_WORKFLOW_TARGETS,
} from "@/components/appShell/appShellWorkflowState.js";

export default function ReportCenter({ children, onNavigate, canViewAudit }) {
  return (
    <div className="space-y-6">
      <div
        className="flex items-center justify-between p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-gray-200/50 shadow-sm relative overflow-hidden"
        id={APP_SHELL_WORKFLOW_TARGETS.reports.scope}
        tabIndex={-1}
      >
        <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -ml-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
              Report Center
            </h1>
            <div
              title="Trung tâm phân tích, đối chiếu điều chỉnh và trích xuất báo cáo động."
              className="text-gray-400 hover:text-indigo-600 transition-colors cursor-help"
            >
              <Info size={18} />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Theo dõi Drill-down, Insights và quản lý lịch gửi báo cáo.
          </p>
        </div>

        <div className="flex gap-3 relative z-10">
          <button
            type="button"
            onClick={() => onNavigate?.("adjustments", "publish")}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white/80 hover:bg-indigo-50 text-sm font-medium text-gray-700 transition-all shadow-sm"
          >
            Đối chiếu Điều chỉnh
          </button>
          {canViewAudit && (
            <button
              type="button"
              onClick={() => onNavigate?.("audit")}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-all shadow-md flex items-center gap-2"
            >
              Lịch sử Export
            </button>
          )}
        </div>
      </div>

      {children}
    </div>
  );
}
