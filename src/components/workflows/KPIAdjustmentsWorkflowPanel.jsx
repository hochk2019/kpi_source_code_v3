import React from "react";
import KPIAdjustments from "@/components/KPIAdjustments.jsx";
import {
  APP_SHELL_WORKFLOW_TARGETS,
  getAppTabRootId,
} from "@/components/appShell/appShellWorkflowState.js";
import { Info } from "lucide-react";

export default function KPIAdjustmentsWorkflowPanel({ currentUser = null, onNavigate }) {
  return (
    <div id={getAppTabRootId("adjustments")} className="space-y-6">

      {/* Lumina Ivory Master Header */}
      <div className="flex items-center justify-between p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-gray-200/50 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Điều chỉnh KPI</h1>
            <div title="Rà soát declaration, MST và hiệu chỉnh điểm trước khi đối chiếu báo cáo cuối." className="text-gray-400 hover:text-teal-600 transition-colors cursor-help">
              <Info size={18} />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý, điều chỉnh và xét duyệt KPIs cộng trừ ngoài hệ thống.
          </p>
        </div>

        <div className="flex gap-3 relative z-10">
          <button
            type="button"
            onClick={() => onNavigate?.("reports", "dashboard")}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white/80 hover:bg-teal-50 text-sm font-medium text-gray-700 transition-all shadow-sm"
          >
            Tác động KPI
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.("reports", "export")}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-sm font-medium text-white transition-all shadow-sm shadow-teal-500/20"
          >
            Mở Report Center
          </button>
        </div>
      </div>

      {/* Main Workspace Frame */}
      <div id={APP_SHELL_WORKFLOW_TARGETS.adjustments.review} tabIndex={-1} className="rounded-2xl bg-white/40 ring-1 ring-gray-200/50 p-2 shadow-sm">
        <KPIAdjustments currentUser={currentUser} />
      </div>

    </div>
  );
}
