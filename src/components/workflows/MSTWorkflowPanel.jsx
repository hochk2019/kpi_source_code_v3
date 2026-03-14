import React from "react";

import MSTAssignment from "@/components/MSTAssignment.jsx";
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

export default function MSTWorkflowPanel({ canEdit = true, currentUser = null, onNavigate }) {
  return (
    <div id={getAppTabRootId("mst")} className="space-y-4">
      <SectionSurface id={APP_SHELL_WORKFLOW_TARGETS.mst.queue} tabIndex={-1}>
        <SectionHeader
          title="1. Hàng chờ MST"
          description="Chuẩn hóa hàng chờ và backlog doanh nghiệp trước khi chỉnh sửa chi tiết trong workspace gán MST."
          actions={<WorkflowLinkButton onClick={() => onNavigate?.("reports", "dashboard")}>Đối chiếu báo cáo</WorkflowLinkButton>}
        />
        <p className="text-sm text-[color:var(--ds-text-secondary)]">
          Shell cấp cao giờ coi MST là một queue workflow: xác định backlog, gán người phụ trách,
          rồi khóa lịch sử thay đổi để các domain khác đọc cùng một trạng thái vận hành.
        </p>
      </SectionSurface>

      <SectionSurface id={APP_SHELL_WORKFLOW_TARGETS.mst.review} tabIndex={-1}>
        <SectionHeader
          title="2. Workspace gán MST"
          description="Xử lý doanh nghiệp, người phụ trách và tổ đội trong cùng bề mặt thao tác."
        />
        <MSTAssignment canEdit={canEdit} currentUser={currentUser} />
      </SectionSurface>

      <SectionSurface id={APP_SHELL_WORKFLOW_TARGETS.mst.history} tabIndex={-1}>
        <SectionHeader
          title="3. Lịch sử và truy vết"
          description="Sau khi chốt gán, dùng lịch sử thay đổi trong màn hình này hoặc chuyển sang audit trail để truy vết liên domain."
          actions={<WorkflowLinkButton onClick={() => onNavigate?.("audit")}>Mở audit trail</WorkflowLinkButton>}
        />
        <p className="text-sm text-[color:var(--ds-text-secondary)]">
          Lịch sử gán MST vẫn nằm trong workspace hiện tại để người vận hành khóa quyết định ngay
          tại chỗ, thay vì phải tự nhớ chuyển sang tab quản trị.
        </p>
      </SectionSurface>
    </div>
  );
}
