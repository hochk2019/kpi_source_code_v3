import React, { Suspense } from "react";
import {
  AppShellEmptyState,
  AppShellLoadingState,
} from "@/components/appShell/AppShellAsyncStates.jsx";
import {
  APP_SHELL_WORKFLOW_TARGETS,
} from "@/components/appShell/appShellWorkflowState.js";
import { Info, Download } from "lucide-react";

const ReportViewer = React.lazy(() => import("@/components/ReportViewer.jsx"));
const ExportAuditReport = React.lazy(() => import("@/components/ExportAuditReport.jsx"));

function ReportSurfaceFallback({ label }) {
  return (
    <div className="flex items-center justify-center h-48 bg-white/40 backdrop-blur-md rounded-2xl border border-gray-100">
      <AppShellLoadingState
        title={`Đang tải ${label}`}
        description="Report center đang chuẩn bị dashboard hoặc export surface cho workflow hiện tại."
      />
    </div>
  );
}

export default function ReportCenterPanel({
  canExport = true,
  canViewAudit = false,
  currentUser = null,
  onNavigate,
}) {
  return (
    <div className="space-y-6">

      {/* Lumina Ivory Master Header */}
      <div className="flex items-center justify-between p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-gray-200/50 shadow-sm relative overflow-hidden" id={APP_SHELL_WORKFLOW_TARGETS.reports.scope} tabIndex={-1}>
        <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -ml-20 -mt-20 pointer-events-none"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Report Center</h1>
            <div title="Trung tâm phân tích, đối chiếu điều chỉnh và trích xuất báo cáo động." className="text-gray-400 hover:text-indigo-600 transition-colors cursor-help">
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
              className="px-4 py-2 flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-medium text-white transition-all shadow-sm shadow-indigo-500/20"
            >
              <Download size={14} /> Audit Trail
            </button>
          )}
        </div>
      </div>

      {/* Report Viewer Embed */}
      <div id={APP_SHELL_WORKFLOW_TARGETS.reports.dashboard} tabIndex={-1} className="rounded-2xl bg-white/40 ring-1 ring-gray-200/50 p-2 shadow-sm">
        <Suspense fallback={<ReportSurfaceFallback label="report center" />}>
          <ReportViewer canExport={canExport} currentUser={currentUser} />
        </Suspense>
      </div>

      {/* Export & Access Embed */}
      <div id={APP_SHELL_WORKFLOW_TARGETS.reports.export} tabIndex={-1}>
        {canViewAudit ? (
          <div className="grid gap-6 xl:grid-cols-[2fr,1fr] rounded-2xl bg-white/60 backdrop-blur-md border border-gray-200/50 p-6 shadow-sm">
            <Suspense fallback={<ReportSurfaceFallback label="audit export" />}>
              <ExportAuditReport currentUser={currentUser} />
            </Suspense>
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-5 text-sm text-gray-500 flex flex-col justify-center">
              <Info className="w-6 h-6 text-indigo-400 mb-3" />
              <p>Hệ thống Export Center cấp tốc giúp trích xuất audit và lịch gửi mà không can thiệp vào drill-down hiện tại.</p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/50 backdrop-blur-md border border-gray-200/50 p-6 shadow-sm">
            <AppShellEmptyState
              title="Audit trail chưa khả dụng"
              description="Export và lịch gửi nằm trên dashboard chính. Chức năng Audit chỉ hiển thị cho tài khoản có quyền."
            />
          </div>
        )}
      </div>

    </div>
  );
}
