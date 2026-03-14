export function getWorkflowCurrentStep({ mode, hasRows }) {
  if (mode === "preview") {
    return 2;
  }
  if (hasRows) {
    return 3;
  }
  return 1;
}

function buildWorkflowHeadline({
  currentStep,
  canManageSync,
  canUploadFiles,
  previewRowCount,
  previewSource,
  syncPreviewRowCount,
  hasUnsaved,
}) {
  if (currentStep === 1) {
    if (canManageSync && syncPreviewRowCount > 0) {
      return `${syncPreviewRowCount.toLocaleString("vi-VN")} dòng ECUS đã sẵn sàng để đồng bộ vào workspace.`;
    }
    if (canManageSync) {
      return "Chọn file XLSX hoặc chạy đồng bộ ECUS để bắt đầu.";
    }
    if (canUploadFiles) {
      return "Chọn file XLSX để bắt đầu rà soát dữ liệu.";
    }
    return "Cần quyền tải file hoặc đồng bộ để bắt đầu.";
  }

  if (currentStep === 2) {
    if (previewSource === "sync") {
      return `${previewRowCount.toLocaleString("vi-VN")} dòng ECUS đang chờ rà soát trước khi đồng bộ.`;
    }
    return `${previewRowCount.toLocaleString("vi-VN")} dòng đang chờ rà soát trước khi lưu.`;
  }

  if (hasUnsaved) {
    return "Bạn còn thay đổi chưa lưu trước khi chốt dữ liệu.";
  }

  return "Dữ liệu đã vào vùng làm việc. Tiếp tục rà cảnh báo, gán xử lý, rồi lưu.";
}

export function getWorkflowStageStatus(stepNumber, currentStep) {
  if (stepNumber < currentStep) {
    return {
      label: "Đã xong",
      badgeClass:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200",
      cardClass:
        "border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10",
    };
  }

  if (stepNumber === currentStep) {
    return {
      label: "Đang xử lý",
      badgeClass:
        "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200",
      cardClass: "border-blue-200/80 bg-blue-50/70 dark:border-blue-500/30 dark:bg-blue-500/10",
    };
  }

  return {
    label: "Đang chờ",
    badgeClass:
      "border-slate-200 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300",
    cardClass: "border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-950/40",
  };
}

function buildWorkflowActions({
  currentStep,
  canEdit,
  canUploadFiles,
  canImport,
  canSave,
  canManageSync,
  previewSource,
  syncPreviewRowCount,
  previewLoading,
  syncRunning,
  hasUnsaved,
  onOpenFilePicker,
  onImport,
  onLoadSavedRows,
  onSaveAll,
  onPreviewSync,
  onRunSync,
}) {
  if (currentStep === 1) {
    return [
      canManageSync &&
      typeof onPreviewSync === "function" &&
      syncPreviewRowCount <= 0 && {
        label: "Xem trước ECUS",
        onClick: onPreviewSync,
        disabled: previewLoading || syncRunning,
        variant: "primary",
      },
      canManageSync &&
      typeof onRunSync === "function" &&
      syncPreviewRowCount > 0 && {
        label: "Đồng bộ ngay",
        onClick: onRunSync,
        disabled: syncRunning,
        variant: "primary",
      },
      canManageSync &&
      typeof onPreviewSync === "function" &&
      syncPreviewRowCount > 0 && {
        label: "Làm mới xem trước ECUS",
        onClick: onPreviewSync,
        disabled: previewLoading || syncRunning,
        variant: "secondary",
      },
      canEdit &&
      canUploadFiles &&
      typeof onOpenFilePicker === "function" && {
        label: "Chọn file XLSX",
        onClick: onOpenFilePicker,
        variant: canManageSync ? "secondary" : "primary",
      },
      typeof onLoadSavedRows === "function" && {
        label: "Hiển thị dữ liệu đã lưu",
        onClick: onLoadSavedRows,
        variant: "secondary",
      },
    ].filter(Boolean);
  }

  if (currentStep === 2) {
    if (previewSource === "sync") {
      return [
        canManageSync &&
        typeof onRunSync === "function" && {
          label: "Đồng bộ ngay",
          onClick: onRunSync,
          disabled: syncRunning,
          variant: "primary",
        },
        canManageSync &&
        typeof onPreviewSync === "function" && {
          label: "Làm mới xem trước ECUS",
          onClick: onPreviewSync,
          disabled: previewLoading || syncRunning,
          variant: "secondary",
        },
        canEdit &&
        canUploadFiles &&
        typeof onOpenFilePicker === "function" && {
          label: "Chọn file XLSX",
          onClick: onOpenFilePicker,
          variant: "secondary",
        },
        typeof onLoadSavedRows === "function" && {
          label: "Hiển thị dữ liệu đã lưu",
          onClick: onLoadSavedRows,
          variant: "secondary",
        },
      ].filter(Boolean);
    }

    return [
      canEdit &&
      typeof onImport === "function" && {
        label: "Import XLSX",
        onClick: onImport,
        disabled: !canImport,
        variant: "primary",
      },
      canEdit &&
      canUploadFiles &&
      typeof onOpenFilePicker === "function" && {
        label: "Chọn file khác",
        onClick: onOpenFilePicker,
        variant: "secondary",
      },
    ].filter(Boolean);
  }

  return [
    hasUnsaved &&
    canSave &&
    typeof onSaveAll === "function" && {
      label: "Lưu dữ liệu",
      onClick: onSaveAll,
      variant: "primary",
    },
    typeof onLoadSavedRows === "function" && {
      label: "Hiển thị dữ liệu đã lưu",
      onClick: onLoadSavedRows,
      variant: "secondary",
    },
  ].filter(Boolean);
}

export const WORKFLOW_STAGE_IDS = Object.freeze({
  1: "data-importer-stage-1",
  2: "data-importer-stage-2",
  3: "data-importer-stage-3",
});

export function buildWorkflowGuideState(props = {}) {
  const {
    mode = "saved",
    canEdit = false,
    canImport = false,
    canSave = false,
    canUploadFiles = false,
    canManageSync = false,
    selectedFile = "",
    previewRowCount = 0,
    previewSource = null,
    syncPreviewRowCount = 0,
    previewLoading = false,
    syncRunning = false,
    hasRows = false,
    hasUnsaved = false,
    onOpenFilePicker,
    onImport,
    onLoadSavedRows,
    onSaveAll,
    onPreviewSync,
    onRunSync,
  } = props;

  const currentStep = getWorkflowCurrentStep({ mode, hasRows });
  const headline = buildWorkflowHeadline({
    currentStep,
    canManageSync,
    canUploadFiles,
    previewRowCount,
    previewSource,
    syncPreviewRowCount,
    hasUnsaved,
  });

  return {
    currentStep,
    headline,
    actions: buildWorkflowActions({
      currentStep,
      canEdit,
      canUploadFiles,
      canImport,
      canSave,
      canManageSync,
      previewSource,
      syncPreviewRowCount,
      previewLoading,
      syncRunning,
      hasUnsaved,
      onOpenFilePicker,
      onImport,
      onLoadSavedRows,
      onSaveAll,
      onPreviewSync,
      onRunSync,
    }),
    steps: [
      {
        number: 1,
        targetId: WORKFLOW_STAGE_IDS[1],
        title: "1. Chọn nguồn",
        detail:
          canManageSync && syncPreviewRowCount > 0
            ? `Đã xem trước ${syncPreviewRowCount.toLocaleString("vi-VN")} dòng ECUS; có thể đồng bộ ngay hoặc chuyển sang file XLSX.`
            : canManageSync
              ? "Bắt đầu bằng file XLSX hoặc đồng bộ tự động từ ECUS."
              : "Bắt đầu bằng file XLSX để tạo vùng dữ liệu làm việc.",
      },
      {
        number: 2,
        targetId: WORKFLOW_STAGE_IDS[2],
        title: "2. Rà soát dữ liệu",
        detail:
          previewSource === "sync" && previewRowCount > 0
            ? `Đang kiểm tra ${previewRowCount.toLocaleString("vi-VN")} dòng xem trước từ ECUS trước khi đồng bộ vào workspace.`
            : selectedFile && previewRowCount > 0
            ? `Đang kiểm tra file ${selectedFile} với ${previewRowCount.toLocaleString("vi-VN")} dòng xem trước.`
            : "Kiểm tra dữ liệu xem trước, xử lý dòng trùng và gán người phụ trách.",
      },
      {
        number: 3,
        targetId: WORKFLOW_STAGE_IDS[3],
        title: "3. Lưu và theo dõi",
        detail: hasUnsaved
          ? "Có thay đổi chưa lưu cần chốt trước khi rời màn hình."
          : "Lưu dữ liệu, theo dõi cảnh báo thiếu thông tin, và rà soát đồng bộ định kỳ.",
      },
    ],
  };
}
