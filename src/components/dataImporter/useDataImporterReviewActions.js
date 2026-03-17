import { useCallback } from "react";

const ALERTS_REVIEW_ROUTE = "/api/v4/declarations/imports/alerts/review";
const ALERTS_UNREVIEW_ROUTE = "/api/v4/declarations/imports/alerts/unreview";

export default function useDataImporterReviewActions({
  actor = "system",
  canReviewAlerts = false,
  mode = "source",
  selectedKeys = [],
  rawRows = [],
  ensureEditableKeys,
  keyOfRow,
  markDeclRowsReviewed,
  unmarkDeclRowsReviewed,
  fetchWithAuth,
  setSelectedKeys,
  setHasUnsaved,
  loadSavedRows,
  fetchAlerts,
}) {
  const handleRefreshAlerts = useCallback(() => {
    fetchAlerts?.();
  }, [fetchAlerts]);

  const handleMarkReviewed = useCallback(async () => {
    if (!canReviewAlerts) {
      alert("Bạn không có quyền đánh dấu đã rà soát các tờ khai.");
      return;
    }

    if (mode !== "saved") {
      alert("Chỉ đánh dấu rà soát khi đang xem dữ liệu đã lưu.");
      return;
    }

    if (selectedKeys.length === 0) {
      alert("Chưa chọn tờ khai để đánh dấu.");
      return;
    }

    const allowedKeys = ensureEditableKeys?.(selectedKeys, "đánh dấu rà soát");
    if (!allowedKeys) {
      return;
    }

    const updated = markDeclRowsReviewed?.(allowedKeys, { actor }) ?? 0;
    if (updated === 0) {
      alert("Các tờ khai đã được đánh dấu hoặc không tìm thấy.");
    }

    try {
      await fetchWithAuth?.(ALERTS_REVIEW_ROUTE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: allowedKeys, actor }),
        credentials: "include",
      });
    } catch (err) {
      console.warn("Không thể đồng bộ trạng thái rà soát với máy chủ", err);
    }

    setSelectedKeys?.([]);
    setHasUnsaved?.(false);
    loadSavedRows?.({ bypassConfirm: true });
    fetchAlerts?.();
  }, [
    actor,
    canReviewAlerts,
    ensureEditableKeys,
    fetchAlerts,
    fetchWithAuth,
    loadSavedRows,
    markDeclRowsReviewed,
    mode,
    selectedKeys,
    setHasUnsaved,
    setSelectedKeys,
  ]);

  const handleUnmarkReviewed = useCallback(async () => {
    if (!canReviewAlerts) {
      alert("Bạn không có quyền bỏ đánh dấu rà soát các tờ khai.");
      return;
    }

    if (mode !== "saved") {
      alert("Chỉ bỏ đánh dấu rà soát khi đang xem dữ liệu đã lưu.");
      return;
    }

    if (selectedKeys.length === 0) {
      alert("Chưa chọn tờ khai để bỏ đánh dấu.");
      return;
    }

    const allowedKeys = ensureEditableKeys?.(selectedKeys, "bỏ đánh dấu rà soát");
    if (!allowedKeys) {
      return;
    }

    const keySet = new Set(allowedKeys);
    const reviewedKeys = rawRows
      .filter((row) => row && keySet.has(keyOfRow?.(row)) && row.reviewed)
      .map((row) => keyOfRow?.(row));

    if (reviewedKeys.length === 0) {
      alert("Các tờ khai đã chọn chưa được đánh dấu rà soát.");
      return;
    }

    const updated = unmarkDeclRowsReviewed?.(reviewedKeys, { actor }) ?? 0;
    if (updated === 0) {
      alert("Không tìm thấy tờ khai nào để bỏ đánh dấu.");
    }

    try {
      await fetchWithAuth?.(ALERTS_UNREVIEW_ROUTE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: reviewedKeys, actor }),
        credentials: "include",
      });
    } catch (err) {
      console.warn("Không thể đồng bộ trạng thái bỏ rà soát với máy chủ", err);
    }

    setSelectedKeys?.([]);
    setHasUnsaved?.(false);
    loadSavedRows?.({ bypassConfirm: true });
    fetchAlerts?.();
  }, [
    actor,
    canReviewAlerts,
    ensureEditableKeys,
    fetchAlerts,
    fetchWithAuth,
    keyOfRow,
    loadSavedRows,
    mode,
    rawRows,
    selectedKeys,
    setHasUnsaved,
    setSelectedKeys,
    unmarkDeclRowsReviewed,
  ]);

  return {
    handleRefreshAlerts,
    handleMarkReviewed,
    handleUnmarkReviewed,
  };
}
