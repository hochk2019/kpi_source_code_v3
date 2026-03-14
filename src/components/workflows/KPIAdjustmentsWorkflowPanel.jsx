import React from "react";

import KPIAdjustments from "@/components/KPIAdjustments.jsx";
import {
  APP_SHELL_WORKFLOW_TARGETS,
  getAppTabRootId,
} from "@/components/appShell/appShellWorkflowState.js";
import { SectionHeader, SectionSurface } from "@/components/designSystem/shellPrimitives.jsx";

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

export default function KPIAdjustmentsWorkflowPanel({ currentUser = null, onNavigate }) {
  return (
    <div id={getAppTabRootId("adjustments")} className="space-y-4">
      <SectionSurface id={APP_SHELL_WORKFLOW_TARGETS.adjustments.scope} tabIndex={-1}>
        <SectionHeader
          title="1. Chọn kỳ điều chỉnh"
          description="Khóa kỳ, phạm vi doanh nghiệp và mục tiêu rà soát trước khi mở bảng điều chỉnh sâu."
          actions={<WorkflowLinkButton onClick={() => onNavigate?.("reports", "dashboard")}>Xem tác động KPI</WorkflowLinkButton>}
        />
        <p className="text-sm text-[color:var(--ds-text-secondary)]">
          Điều chỉnh KPI được neo vào workflow ba bước: chọn kỳ, rà soát declaration, rồi xác nhận
          tác động trên report center thay vì xử lý như một bảng standalone.
        </p>
      </SectionSurface>

      <SectionSurface id={APP_SHELL_WORKFLOW_TARGETS.adjustments.review} tabIndex={-1}>
        <SectionHeader
          title="2. Workspace điều chỉnh"
          description="Rà soát declaration, MST và lý do cộng trừ trong cùng workspace điều chỉnh."
        />
        <KPIAdjustments currentUser={currentUser} />
      </SectionSurface>

      <SectionSurface id={APP_SHELL_WORKFLOW_TARGETS.adjustments.publish} tabIndex={-1}>
        <SectionHeader
          title="3. Xuất bản tác động"
          description="Sau khi chốt adjustment, đối chiếu lại dashboard KPI hoặc chuyển sang report center để export."
          actions={<WorkflowLinkButton onClick={() => onNavigate?.("reports", "export")}>Mở report center</WorkflowLinkButton>}
        />
        <p className="text-sm text-[color:var(--ds-text-secondary)]">
          Bước publish được tách rõ ở shell để điều chỉnh KPI luôn có điểm kết thúc rõ ràng: kiểm
          chứng số liệu trên báo cáo trước khi kết thúc ca vận hành.
        </p>
      </SectionSurface>
    </div>
  );
}
