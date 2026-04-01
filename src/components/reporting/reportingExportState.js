const PERMISSION_DENIED_MESSAGE = "Tài khoản hiện tại không có quyền xuất báo cáo.";
const LOADING_MESSAGE = "Đang tải dữ liệu báo cáo KPI, vui lòng thử lại sau.";
const ERROR_PREFIX = "Không thể xuất báo cáo khi dữ liệu đang lỗi tải";
const EMPTY_MESSAGE = "Không có dữ liệu tờ khai để xuất báo cáo.";
const EXPORTING_MESSAGE = "Báo cáo đang được tạo, vui lòng chờ hoàn tất.";

function normalizeErrorMessage(error) {
  const normalized = String(error || "").trim();
  return normalized ? `${ERROR_PREFIX}: ${normalized}` : `${ERROR_PREFIX}.`;
}

export function resolveReportingExportState({
  canExport = true,
  exporting = false,
  reportLoading = false,
  reportError = "",
  summary = {},
} = {}) {
  const hasSummaryDecls = Number(summary?.decls || 0) > 0;

  if (!canExport) {
    return { canExport: false, disabledReason: PERMISSION_DENIED_MESSAGE };
  }

  if (reportLoading && !hasSummaryDecls) {
    return { canExport: false, disabledReason: LOADING_MESSAGE };
  }

  if (reportError) {
    return { canExport: false, disabledReason: normalizeErrorMessage(reportError) };
  }

  if (!hasSummaryDecls) {
    return { canExport: false, disabledReason: EMPTY_MESSAGE };
  }

  if (exporting) {
    return { canExport: false, disabledReason: EXPORTING_MESSAGE };
  }

  return { canExport: true, disabledReason: "" };
}

export function validateReportExportPermissionState(params = {}) {
  return resolveReportingExportState(params).disabledReason || "";
}

