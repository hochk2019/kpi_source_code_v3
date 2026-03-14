import { useCallback } from "react";

export default function useDataImporterSelectionBulkActions({
  deleteEnabled,
  selectionEnabled,
  selectedKeys,
  selectedReviewedCount,
  canReviewAlerts,
  rawRows,
  filteredKeys,
  filteredSelected,
  shouldUseServerSearch,
  canEdit,
  keyOfRow,
  summarizeLicenseSnapshot,
  formatDisplayDate,
  coLabel,
  coLineCount,
  xlsx,
  handleSelectFiltered,
  handleMarkReviewed,
  handleUnmarkReviewed,
  handleDeleteSelected,
  handleHardDeleteSelected,
  handleApplyLicenseExclusion,
  handleClearSelection,
}) {
  const canDelete = deleteEnabled && selectedKeys.length > 0;
  const canReview = selectionEnabled && selectedKeys.length > 0 && canReviewAlerts;
  const canUnreview = selectionEnabled && selectedReviewedCount > 0 && canReviewAlerts;

  const handleExportSelected = useCallback(() => {
    if (selectedKeys.length === 0) {
      alert("Hãy chọn tờ khai trước khi xuất Excel.");
      return;
    }

    const keySet = new Set(selectedKeys);
    const rows = rawRows.filter((row) => keySet.has(keyOfRow(row)));
    if (rows.length === 0) {
      alert("Không tìm thấy tờ khai tương ứng để xuất.");
      return;
    }

    const data = rows.map((row) => {
      const licenseInfo = summarizeLicenseSnapshot(row);
      return {
        "Ngày": formatDisplayDate(row.date || row.raw_date || ""),
        "Số tờ khai": row.so_tk_full || row.so_tk || "",
        MST: row.mst || "",
        "Công ty": row.cong_ty || "",
        "Loại hình": row.loai_hinh || "",
        "Nhân viên": row.nhan_vien || "",
        "Tổ đội": row.team || "",
        "Đại lý": row.agency || row.dai_ly || "",
        "Số lượng GP gốc": licenseInfo.sourceCount,
        "Số lượng GP (sau loại trừ)": licenseInfo.includedCount,
        "Mã giấy phép hợp lệ": licenseInfo.includedCodes.join(", "),
        "Mã giấy phép bị loại trừ": licenseInfo.excludedCodes.join(", "),
        "C/O": coLabel(row),
        "Dòng C/O": coLineCount(row),
      };
    });

    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "ToKhai");
    const timestamp = new Date().toISOString().slice(0, 10);
    xlsx.writeFile(workbook, `tokhai_da_chon_${timestamp}.xlsx`);
  }, [
    coLabel,
    coLineCount,
    formatDisplayDate,
    keyOfRow,
    rawRows,
    selectedKeys,
    summarizeLicenseSnapshot,
    xlsx,
  ]);

  const selectionActionsProps = {
    selectedCount: selectedKeys.length,
    filteredKeysLength: filteredKeys.length,
    filteredSelected,
    shouldUseServerSearch,
    canReview,
    canUnreview,
    canEdit,
    canDelete,
    onSelectFiltered: handleSelectFiltered,
    onMarkReviewed: handleMarkReviewed,
    onUnmarkReviewed: handleUnmarkReviewed,
    onDeleteSelected: handleDeleteSelected,
    onHardDeleteSelected: handleHardDeleteSelected,
    onApplyLicenseExclusion: handleApplyLicenseExclusion,
    onExportSelected: handleExportSelected,
    onClearSelection: handleClearSelection,
  };

  return {
    canDelete,
    canReview,
    canUnreview,
    handleExportSelected,
    selectionActionsProps,
  };
}
