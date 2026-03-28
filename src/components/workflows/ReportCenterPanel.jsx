import React, { Suspense } from "react";

import {
  APP_SHELL_WORKFLOW_TARGETS,
} from "@/components/appShell/appShellWorkflowState.js";
import { SectionHeader, SectionSurface } from "@/components/designSystem/shellPrimitives.jsx";

const ReportViewer = React.lazy(() => import("@/components/ReportViewer.jsx"));
const ExportAuditReport = React.lazy(() => import("@/components/ExportAuditReport.jsx"));

function ReportSurfaceFallback({ label }) {
  return (
    <div className="rounded-xl border border-dashed border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)]/40 p-4 text-sm text-[color:var(--ds-text-secondary)]">
      Đang tải {label}...
    </div>
  );
}

function WorkflowLinkButton({ children, onClick }) {
  if (typeof onClick !== "function") {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-[color:var(--ds-border-subtle)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ds-text-secondary)] transition hover:bg-[color:var(--ds-surface-muted)]"
    >
      {children}
    </button>
  );
}

export default function ReportCenterPanel({
  canExport = true,
  canViewAudit = false,
  currentUser = null,
  onNavigate,
}) {
  return (
    <div className="space-y-4">
      <SectionSurface id={APP_SHELL_WORKFLOW_TARGETS.reports.scope} tabIndex={-1}>
        <SectionHeader
          title="1. Chốt phạm vi báo cáo"
          description="Khóa kỳ, domain cần đọc và nhu cầu phát hành trước khi mở dashboard hoặc export trail."
          actions={<WorkflowLinkButton onClick={() => onNavigate?.("adjustments", "publish")}>Đối chiếu adjustment</WorkflowLinkButton>}
        />
        <p className="text-sm text-[color:var(--ds-text-secondary)]">
          Report center tách rõ phần đọc dashboard khỏi phần export và truy vết để người vận hành
          không còn phải nhớ các bề mặt phụ nằm ở tab quản trị.
        </p>
      </SectionSurface>

      <SectionSurface id={APP_SHELL_WORKFLOW_TARGETS.reports.dashboard} tabIndex={-1}>
        <SectionHeader
          title="2. Insight, drill-down và lịch gửi"
          description="Report center ưu tiên đọc insight trước, sau đó mở drill-down và chỉ chạm tới lịch gửi khi đã xong phần phân tích."
        />
        <Suspense fallback={<ReportSurfaceFallback label="report center" />}>
          <ReportViewer canExport={canExport} currentUser={currentUser} />
        </Suspense>
      </SectionSurface>

      <SectionSurface id={APP_SHELL_WORKFLOW_TARGETS.reports.export} tabIndex={-1}>
        <SectionHeader
          title="3. Export và truy vết"
          description="Khu phát hành báo cáo được tách riêng để xử lý export trail và đối chiếu audit rõ ràng hơn."
          actions={
            canViewAudit ? (
              <WorkflowLinkButton onClick={() => onNavigate?.("audit")}>Mở audit trail</WorkflowLinkButton>
            ) : null
          }
        />
        {canViewAudit ? (
          <div className="grid gap-4 xl:grid-cols-[5fr,3fr]">
            <div className="rounded-xl border border-dashed border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)]/40 p-4 text-sm text-[color:var(--ds-text-secondary)]">
              Audit trail vẫn giữ tab quản trị riêng để phù hợp quyền hạn, nhưng report center giờ
              có điểm vào export chuyên biệt để người vận hành phát hành báo cáo mà không bị lẫn vào
              dashboard phân tích.
            </div>
            <Suspense fallback={<ReportSurfaceFallback label="audit export" />}>
              <ExportAuditReport currentUser={currentUser} />
            </Suspense>
          </div>
        ) : (
          <p className="text-sm text-[color:var(--ds-text-secondary)]">
            Bạn chưa có quyền audit trail. Export và lịch gửi vẫn khả dụng trong dashboard KPI phía
            trên; audit chỉ xuất hiện khi tài khoản được cấp quyền truy vết.
          </p>
        )}
      </SectionSurface>
    </div>
  );
}
