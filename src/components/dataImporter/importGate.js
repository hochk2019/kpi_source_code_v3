function resolveImportPreviewErrorMessage(importPreview = null) {
  const rawError = importPreview?.error;
  if (!rawError) {
    return "";
  }

  if (typeof rawError === "string") {
    return rawError.trim();
  }

  if (typeof rawError?.message === "string") {
    return rawError.message.trim();
  }

  return "Không thể kiểm tra file import. Vui lòng thử lại.";
}

export default function resolveImportEligibility({
  canUploadFiles = false,
  isReadOnlyForEdits = true,
  mode = "saved",
  previewSource = null,
  effectivePreviewRows = [],
  importPreview = null,
} = {}) {
  if (!canUploadFiles) {
    return {
      canImport: false,
      reason:
        'Tài khoản của bạn chưa được cấp quyền "Import Data – tải file". Vui lòng liên hệ quản trị viên để mở quyền tải file import.',
    };
  }

  if (isReadOnlyForEdits) {
    return {
      canImport: false,
      reason: "Bạn không có quyền import dữ liệu. Đăng nhập bằng tài khoản được cấp quyền để tiếp tục.",
    };
  }

  if (previewSource === "sync") {
    return {
      canImport: false,
      reason:
        'Bạn đang xem trước dữ liệu ECUS. Hãy dùng nút "Đồng bộ ngay" để đưa dữ liệu vào workspace.',
    };
  }

  if (mode !== "preview") {
    return {
      canImport: false,
      reason: "Hãy chọn file XLSX để import.",
    };
  }

  if (!Array.isArray(effectivePreviewRows) || effectivePreviewRows.length <= 0) {
    return {
      canImport: false,
      reason: "Không có dữ liệu để import.",
    };
  }

  if (!importPreview) {
    return {
      canImport: false,
      reason: "Đang chuẩn bị kết quả kiểm tra import. Vui lòng thử lại.",
    };
  }

  const previewErrorMessage = resolveImportPreviewErrorMessage(importPreview);
  if (previewErrorMessage) {
    return {
      canImport: false,
      reason: `Không thể kiểm tra file import. ${previewErrorMessage}`,
    };
  }

  return {
    canImport: true,
    reason: "",
  };
}
