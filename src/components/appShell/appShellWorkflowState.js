import { WORKFLOW_STAGE_IDS as DATA_IMPORTER_STAGE_IDS } from "@/components/dataImporter/dataImporterWorkflowGuideState.js";

export const APP_TAB_ROOT_ID_PREFIX = "app-tab-root-";

export const APP_SHELL_WORKFLOW_TARGETS = Object.freeze({
  mst: Object.freeze({
    queue: "app-workflow-mst-queue",
    review: "app-workflow-mst-review",
    history: "app-workflow-mst-history",
  }),
  import: Object.freeze({
    source: DATA_IMPORTER_STAGE_IDS[1],
    review: DATA_IMPORTER_STAGE_IDS[2],
    save: DATA_IMPORTER_STAGE_IDS[3],
  }),
  adjustments: Object.freeze({
    scope: "app-workflow-adjustments-scope",
    review: "app-workflow-adjustments-review",
    publish: "app-workflow-adjustments-publish",
  }),
  reports: Object.freeze({
    scope: "app-workflow-reports-scope",
    dashboard: "app-workflow-reports-dashboard",
    export: "app-workflow-reports-export",
  }),
  health: Object.freeze({
    sync: "app-workflow-health-sync",
    triage: "app-workflow-health-triage",
    alerts: "app-workflow-health-alerts",
  }),
});

function createAction(label, onClick, variant = "secondary") {
  if (typeof onClick !== "function") {
    return null;
  }
  return { label, onClick, variant };
}

function createStep(number, title, detail, targetId) {
  return { number, title, detail, targetId };
}

export function getAppTabRootId(tabId = "") {
  return `${APP_TAB_ROOT_ID_PREFIX}${tabId || "workspace"}`;
}

export function resolveAppShellFocusTarget(tabId, focus) {
  const normalizedTab = String(tabId || "").trim();
  if (!normalizedTab) {
    return null;
  }

  const normalizedFocus = String(focus || "").trim().toLowerCase();
  const targets = APP_SHELL_WORKFLOW_TARGETS[normalizedTab];

  if (targets && normalizedFocus && targets[normalizedFocus]) {
    return targets[normalizedFocus];
  }

  if (targets && normalizedFocus === "favorites" && normalizedTab === "import") {
    return targets.review;
  }

  if (targets && normalizedFocus === "export" && normalizedTab === "reports") {
    return targets.export;
  }

  if (targets && normalizedFocus === "sync" && normalizedTab === "health") {
    return targets.sync;
  }

  if (targets && !normalizedFocus) {
    const firstTarget = Object.values(targets)[0];
    if (firstTarget) {
      return firstTarget;
    }
  }

  return getAppTabRootId(normalizedTab);
}

function buildMstWorkflowState({ onNavigate, onOpenCommandCenter }) {
  return {
    eyebrow: "MST queue workflow",
    headline: "Chuẩn hóa hàng chờ MST, gán người phụ trách, rồi khóa lịch sử thay đổi trong một bề mặt duy nhất.",
    actions: [
      createAction("Đi tới hàng chờ MST", () => onNavigate?.("mst", "queue"), "primary"),
      createAction("Rà soát gán xử lý", () => onNavigate?.("mst", "review")),
      createAction("Mở Command Center", onOpenCommandCenter),
    ].filter(Boolean),
    steps: [
      createStep(
        1,
        "1. Chuẩn bị hàng chờ",
        "Xác định doanh nghiệp mới hoặc pending để đẩy vào hàng chờ gán MST trước khi chỉnh sửa sâu.",
        APP_SHELL_WORKFLOW_TARGETS.mst.queue,
      ),
      createStep(
        2,
        "2. Gán người phụ trách",
        "Xử lý workspace gán MST, người phụ trách và tổ đội trong cùng màn hình vận hành.",
        APP_SHELL_WORKFLOW_TARGETS.mst.review,
      ),
      createStep(
        3,
        "3. Khóa lịch sử",
        "Sau khi chốt gán, chuyển sang lịch sử thay đổi để truy vết và phối hợp với audit khi cần.",
        APP_SHELL_WORKFLOW_TARGETS.mst.history,
      ),
    ],
  };
}

function buildImportWorkflowState({ onNavigate, onOpenCommandCenter }) {
  return {
    eyebrow: "Import workflow",
    headline: "Luồng import đã được chia stage; shell cấp cao giờ chỉ cần nhảy đúng bước thay vì gửi người dùng vào màn hình phẳng.",
    actions: [
      createAction("Chọn nguồn dữ liệu", () => onNavigate?.("import", "source"), "primary"),
      createAction("Rà soát workspace", () => onNavigate?.("import", "review")),
      createAction("Mở Command Center", onOpenCommandCenter),
    ].filter(Boolean),
    steps: [
      createStep(
        1,
        "1. Nạp nguồn",
        "Bắt đầu bằng file XLSX hoặc ECUS preview để tạo nguồn dữ liệu vào workflow importer.",
        APP_SHELL_WORKFLOW_TARGETS.import.source,
      ),
      createStep(
        2,
        "2. Rà soát dữ liệu",
        "Áp bộ lọc, xử lý duplicate và kiểm tra cảnh báo trước khi chốt.",
        APP_SHELL_WORKFLOW_TARGETS.import.review,
      ),
      createStep(
        3,
        "3. Lưu và theo dõi",
        "Lưu workspace rồi theo dõi cảnh báo, sync status và các hàng cần hậu kiểm.",
        APP_SHELL_WORKFLOW_TARGETS.import.save,
      ),
    ],
  };
}

function buildAdjustmentWorkflowState({ onNavigate }) {
  return {
    eyebrow: "Adjustment workflow",
    headline: "Điều chỉnh KPI không còn là một bảng đơn lẻ; shell hướng người vận hành đi từ chọn kỳ tới đối chiếu báo cáo.",
    actions: [
      createAction("Chọn kỳ điều chỉnh", () => onNavigate?.("adjustments", "scope"), "primary"),
      createAction("Mở danh sách điều chỉnh", () => onNavigate?.("adjustments", "review")),
      createAction("Đối chiếu trên báo cáo KPI", () => onNavigate?.("reports", "dashboard")),
    ].filter(Boolean),
    steps: [
      createStep(
        1,
        "1. Chọn kỳ và phạm vi",
        "Xác định kỳ, đội và nguồn dữ liệu cần điều chỉnh trước khi mở bảng xử lý chi tiết.",
        APP_SHELL_WORKFLOW_TARGETS.adjustments.scope,
      ),
      createStep(
        2,
        "2. Rà soát điều chỉnh",
        "Xử lý declaration, công ty và MST ngay trong workspace adjustment.",
        APP_SHELL_WORKFLOW_TARGETS.adjustments.review,
      ),
      createStep(
        3,
        "3. Xuất bản tác động",
        "Sau khi chốt điều chỉnh, chuyển sang report center để kiểm tra tác động lên dashboard và export.",
        APP_SHELL_WORKFLOW_TARGETS.adjustments.publish,
      ),
    ],
  };
}

function buildReportWorkflowState({ onNavigate, onOpenCommandCenter, canViewAudit }) {
  return {
    eyebrow: "Report center",
    headline: "Report center giờ có hierarchy rõ hơn: chốt phạm vi, đọc insight, drill-down theo lát cắt phù hợp, rồi mới phát hành hoặc truy vết lịch sử.",
    actions: [
      createAction("Mở dashboard KPI", () => onNavigate?.("reports", "dashboard"), "primary"),
      createAction("Tới khu export", () => onNavigate?.("reports", "export")),
      canViewAudit
        ? createAction("Mở audit trail", () => onNavigate?.("audit"))
        : createAction("Mở Command Center", onOpenCommandCenter),
    ].filter(Boolean),
    steps: [
      createStep(
        1,
        "1. Chốt phạm vi báo cáo",
        "Xác định kỳ và nhu cầu đọc báo cáo trước khi mở dashboard hoặc lịch gửi.",
        APP_SHELL_WORKFLOW_TARGETS.reports.scope,
      ),
      createStep(
        2,
        "2. Insight & drill-down",
        "Đọc dashboard KPI và mở lát cắt chi tiết theo nhân viên hoặc tổ đội trước khi phát hành.",
        APP_SHELL_WORKFLOW_TARGETS.reports.dashboard,
      ),
      createStep(
        3,
        "3. Lịch gửi, export và truy vết",
        "Đưa lịch gửi và khu export / audit xuống sau phần phân tích để mobile không phải lướt qua form phát hành quá sớm.",
        APP_SHELL_WORKFLOW_TARGETS.reports.export,
      ),
    ],
  };
}

function buildHealthWorkflowState({ onNavigate, onOpenCommandCenter }) {
  return {
    eyebrow: "Health & sync",
    headline: "Điểm vào cho vận hành sync và cảnh báo dữ liệu được gom thành một workflow triage thay vì chỉ là màn hình theo dõi.",
    actions: [
      createAction("Kiểm tra sync", () => onNavigate?.("health", "sync"), "primary"),
      createAction("Rà soát cảnh báo", () => onNavigate?.("health", "alerts")),
      createAction("Mở Command Center", onOpenCommandCenter),
    ].filter(Boolean),
    steps: [
      createStep(
        1,
        "1. Kiểm tra đồng bộ",
        "Xác nhận backend sync, timeout và backlog trước khi can thiệp dữ liệu.",
        APP_SHELL_WORKFLOW_TARGETS.health.sync,
      ),
      createStep(
        2,
        "2. Triage lỗi",
        "Đọc nhanh nhóm lỗi hoặc duplicate nổi bật để xác định domain nào cần xử lý tiếp.",
        APP_SHELL_WORKFLOW_TARGETS.health.triage,
      ),
      createStep(
        3,
        "3. Điều phối hành động",
        "Chuyển sang import, MST hoặc report center từ cùng shell khi đã rõ bước kế tiếp.",
        APP_SHELL_WORKFLOW_TARGETS.health.alerts,
      ),
    ],
  };
}

function buildGenericWorkflowState({ currentTab, onNavigate, onOpenCommandCenter }) {
  return {
    eyebrow: "Operator workflow",
    headline: `${currentTab?.label || "Module"} đang chạy trong shell mới; dùng workflow guide và Command Center để điều phối thay vì tìm tab thủ công.`,
    actions: [
      createAction(
        `Đi tới ${currentTab?.label || "module"}`,
        () => onNavigate?.(currentTab?.id),
        "primary",
      ),
      createAction("Mở báo cáo KPI", () => onNavigate?.("reports", "dashboard")),
      createAction("Mở Command Center", onOpenCommandCenter),
    ].filter(Boolean),
    steps: [
      createStep(
        1,
        "1. Vào workspace",
        "Mở đúng module và chốt ngữ cảnh xử lý trước khi thay đổi dữ liệu.",
        getAppTabRootId(currentTab?.id),
      ),
      createStep(
        2,
        "2. Rà soát domain",
        "Hoàn tất thao tác chính trong workspace hiện tại, sau đó mới chuyển qua module liên quan.",
        getAppTabRootId(currentTab?.id),
      ),
      createStep(
        3,
        "3. Đối chiếu tác động",
        "Quay về report center hoặc audit trail để xác nhận tác động sau thao tác.",
        getAppTabRootId("reports"),
      ),
    ],
  };
}

export function buildAppShellWorkflowState({
  currentTab,
  onNavigate,
  onOpenCommandCenter,
  canViewAudit = false,
} = {}) {
  if (!currentTab?.id) {
    return null;
  }

  switch (currentTab.id) {
    case "mst":
      return buildMstWorkflowState({ onNavigate, onOpenCommandCenter });
    case "import":
      return buildImportWorkflowState({ onNavigate, onOpenCommandCenter });
    case "adjustments":
      return buildAdjustmentWorkflowState({ onNavigate, onOpenCommandCenter });
    case "reports":
      return buildReportWorkflowState({ onNavigate, onOpenCommandCenter, canViewAudit });
    case "health":
      return buildHealthWorkflowState({ onNavigate, onOpenCommandCenter });
    default:
      return buildGenericWorkflowState({ currentTab, onNavigate, onOpenCommandCenter });
  }
}
