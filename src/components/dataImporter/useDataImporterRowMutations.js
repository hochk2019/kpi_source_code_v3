import { useCallback } from "react";

export default function useDataImporterRowMutations({
  actor = "system",
  mode = "source",
  isReadOnlyForEdits = false,
  selectedKeys = [],
  editingRestrictionMessage = "",
  reviewLockMessage = "",
  ensureEditableKeys,
  ensureHardDeleteKeys,
  filterEditableKeys,
  filterHardDeleteKeys,
  isRowEditable,
  keyOfRow,
  softDeleteDeclRows,
  hardDeleteDeclRows,
  restoreDeclRows,
  pushAuditLog,
  setHasUnsaved,
  setSelectedKeys,
  loadSavedRows,
  fetchAlerts,
}) {
  const deleteRowsByKeys = useCallback((keys, { alreadyFiltered = false } = {}) => {
    if (!Array.isArray(keys) || keys.length === 0) return;

    let allowedKeys = keys;
    if (!alreadyFiltered) {
      const { allowed, blocked, reviewLocked, reviewLockedKeys } = filterEditableKeys(keys);

      if (!allowed.length) {
        if (reviewLocked > 0) {
          alert(
            `Không thể đánh dấu xóa ${reviewLocked.toLocaleString("vi-VN")} tờ khai đã được rà soát. ${reviewLockMessage}`
          );
          pushAuditLog?.({
            actor,
            action: "decl.delete.blocked",
            detail: `Chặn đánh dấu xóa ${reviewLocked.toLocaleString("vi-VN")} tờ khai do review lock`,
            meta: { keys: reviewLockedKeys, reason: "review lock" },
          });
        } else if (blocked > 0 && editingRestrictionMessage) {
          alert(editingRestrictionMessage);
        }
        return;
      }

      if (reviewLocked > 0) {
        alert(
          `Đã bỏ qua ${reviewLocked.toLocaleString("vi-VN")} tờ khai đã được rà soát (không thể đánh dấu xóa).`
        );
        pushAuditLog?.({
          actor,
          action: "decl.delete.partial-blocked",
          detail: `Bỏ qua ${reviewLocked.toLocaleString("vi-VN")} tờ khai khi đánh dấu xóa do review lock`,
          meta: { keys: reviewLockedKeys, reason: "review lock" },
        });
      } else if (blocked > 0 && editingRestrictionMessage) {
        alert(`Đã bỏ qua ${blocked} tờ khai không thuộc phạm vi của bạn khi đánh dấu xóa.`);
      }

      allowedKeys = allowed;
    }

    const result = softDeleteDeclRows(allowedKeys, { actor });
    const parts = [];

    if (result.deleted > 0) {
      parts.push(`Đã đánh dấu xóa ${result.deleted.toLocaleString("vi-VN")} tờ khai.`);
    }
    if (result.alreadyDeleted > 0) {
      parts.push(`Bỏ qua ${result.alreadyDeleted.toLocaleString("vi-VN")} tờ khai đã bị xóa trước đó.`);
    }
    if (result.missing > 0) {
      parts.push(`Không tìm thấy ${result.missing.toLocaleString("vi-VN")} tờ khai trong dữ liệu hiện tại.`);
    }

    if (parts.length > 0) {
      alert(parts.join("\n"));
    }

    if (result.deleted > 0) {
      setHasUnsaved(false);
      loadSavedRows?.();
      fetchAlerts?.();
    }
  }, [
    actor,
    editingRestrictionMessage,
    fetchAlerts,
    filterEditableKeys,
    loadSavedRows,
    pushAuditLog,
    reviewLockMessage,
    setHasUnsaved,
    softDeleteDeclRows,
  ]);

  const hardDeleteRowsByKeys = useCallback((keys, { alreadyFiltered = false } = {}) => {
    if (!Array.isArray(keys) || keys.length === 0) return;

    let allowedKeys = keys;
    if (!alreadyFiltered) {
      const { allowed, blocked, reviewLocked, reviewLockedKeys } = filterHardDeleteKeys(keys);

      if (!allowed.length) {
        if (reviewLocked > 0) {
          alert(
            `Không thể xóa vĩnh viễn ${reviewLocked.toLocaleString("vi-VN")} tờ khai đã được rà soát. ${reviewLockMessage}`
          );
          pushAuditLog?.({
            actor,
            action: "decl.delete.hard.blocked",
            detail: `Chặn xóa vĩnh viễn ${reviewLocked.toLocaleString("vi-VN")} tờ khai do review lock`,
            meta: { keys: reviewLockedKeys, reason: "review lock" },
          });
        } else if (blocked > 0 && editingRestrictionMessage) {
          alert(editingRestrictionMessage);
        }
        return;
      }

      if (reviewLocked > 0) {
        alert(
          `Đã bỏ qua ${reviewLocked.toLocaleString("vi-VN")} tờ khai đã được rà soát (không thể xóa vĩnh viễn).`
        );
        pushAuditLog?.({
          actor,
          action: "decl.delete.hard.partial-blocked",
          detail: `Bỏ qua ${reviewLocked.toLocaleString("vi-VN")} tờ khai khi xóa vĩnh viễn do review lock`,
          meta: { keys: reviewLockedKeys, reason: "review lock" },
        });
      } else if (blocked > 0 && editingRestrictionMessage) {
        alert(`Đã bỏ qua ${blocked} tờ khai không thuộc phạm vi của bạn khi xóa vĩnh viễn.`);
      }

      allowedKeys = allowed;
    }

    const result = hardDeleteDeclRows(allowedKeys, { actor });
    const parts = [];

    if (result.removed > 0) {
      parts.push(`Đã xóa vĩnh viễn ${result.removed.toLocaleString("vi-VN")} tờ khai.`);
    }
    if (result.missing > 0) {
      parts.push(`Không tìm thấy ${result.missing.toLocaleString("vi-VN")} tờ khai trong dữ liệu hiện tại.`);
    }

    if (parts.length > 0) {
      alert(parts.join("\n"));
    }

    if (result.removed > 0) {
      const removedSet = new Set(result.keys);
      setHasUnsaved(false);
      setSelectedKeys((prev) => prev.filter((key) => !removedSet.has(key)));
      loadSavedRows?.();
      fetchAlerts?.();
    }
  }, [
    actor,
    editingRestrictionMessage,
    fetchAlerts,
    filterHardDeleteKeys,
    hardDeleteDeclRows,
    loadSavedRows,
    pushAuditLog,
    reviewLockMessage,
    setHasUnsaved,
    setSelectedKeys,
  ]);

  const handleDeleteSelected = useCallback(() => {
    if (isReadOnlyForEdits) {
      alert("Bạn không có quyền đánh dấu xóa tờ khai.");
      return;
    }

    if (mode !== "saved") {
      alert("Chỉ có thể đánh dấu xóa khi đang xem dữ liệu đã lưu.");
      return;
    }

    if (selectedKeys.length === 0) {
      alert("Chưa chọn tờ khai để đánh dấu xóa.");
      return;
    }

    const allowedKeys = ensureEditableKeys(selectedKeys, "đánh dấu xóa");
    if (!allowedKeys) {
      return;
    }

    if (!window.confirm(`Bạn chắc chắn muốn đánh dấu xóa ${allowedKeys.length} tờ khai đã chọn?`)) {
      return;
    }

    deleteRowsByKeys(allowedKeys, { alreadyFiltered: true });
  }, [
    deleteRowsByKeys,
    ensureEditableKeys,
    isReadOnlyForEdits,
    mode,
    selectedKeys,
  ]);

  const handleHardDeleteSelected = useCallback(() => {
    if (isReadOnlyForEdits) {
      alert("Bạn không có quyền xóa vĩnh viễn tờ khai.");
      return;
    }

    if (mode !== "saved") {
      alert("Chỉ có thể xóa vĩnh viễn khi đang xem dữ liệu đã lưu.");
      return;
    }

    if (selectedKeys.length === 0) {
      alert("Chưa chọn tờ khai để xóa vĩnh viễn.");
      return;
    }

    const allowedKeys = ensureHardDeleteKeys(selectedKeys, "xóa vĩnh viễn");
    if (!allowedKeys) {
      return;
    }

    if (
      !window.confirm(
        `Bạn chắc chắn muốn xóa vĩnh viễn ${allowedKeys.length.toLocaleString("vi-VN")} tờ khai đã chọn? Hành động không thể khôi phục.`
      )
    ) {
      return;
    }

    hardDeleteRowsByKeys(allowedKeys, { alreadyFiltered: true });
  }, [
    ensureHardDeleteKeys,
    hardDeleteRowsByKeys,
    isReadOnlyForEdits,
    mode,
    selectedKeys,
  ]);

  const handleDeleteSingle = useCallback((row) => {
    if (isReadOnlyForEdits) {
      alert("Bạn không có quyền đánh dấu xóa tờ khai.");
      return;
    }

    if (mode !== "saved") {
      alert("Chỉ có thể đánh dấu xóa khi đang xem dữ liệu đã lưu.");
      return;
    }

    if (!isRowEditable(row)) {
      if (editingRestrictionMessage) {
        alert(editingRestrictionMessage);
      }
      return;
    }

    if (!window.confirm("Đánh dấu xóa tờ khai này?")) return;
    deleteRowsByKeys([keyOfRow(row)], { alreadyFiltered: true });
  }, [
    deleteRowsByKeys,
    editingRestrictionMessage,
    isReadOnlyForEdits,
    isRowEditable,
    keyOfRow,
    mode,
  ]);

  const handleHardDeleteSingle = useCallback((row) => {
    if (isReadOnlyForEdits) {
      alert("Bạn không có quyền xóa vĩnh viễn tờ khai.");
      return;
    }

    if (mode !== "saved") {
      alert("Chỉ có thể xóa vĩnh viễn khi đang xem dữ liệu đã lưu.");
      return;
    }

    if (!row) {
      return;
    }

    const allowedKeys = ensureHardDeleteKeys([keyOfRow(row)], "xóa vĩnh viễn");
    if (!allowedKeys) {
      return;
    }

    if (!window.confirm("Bạn chắc chắn muốn xóa vĩnh viễn tờ khai này? Hành động không thể khôi phục.")) {
      return;
    }

    hardDeleteRowsByKeys(allowedKeys, { alreadyFiltered: true });
  }, [
    ensureHardDeleteKeys,
    hardDeleteRowsByKeys,
    isReadOnlyForEdits,
    keyOfRow,
    mode,
  ]);

  const handleRestoreSingle = useCallback((row) => {
    if (isReadOnlyForEdits) {
      alert("Bạn không có quyền khôi phục tờ khai.");
      return;
    }

    if (mode !== "saved") {
      alert("Chỉ có thể khôi phục khi đang xem dữ liệu đã lưu.");
      return;
    }

    if (!row) {
      return;
    }

    const key = keyOfRow(row);
    const result = restoreDeclRows([key], {
      actor,
      detail: "Khôi phục tờ khai bị xóa mềm từ giao diện Import Data",
    });

    if (result.restored > 0) {
      alert("Đã khôi phục 1 tờ khai.");
      setHasUnsaved(false);
      loadSavedRows?.();
      fetchAlerts?.();
      return;
    }

    if (result.skipped > 0) {
      alert("Tờ khai đã ở trạng thái hoạt động.");
      return;
    }

    if (Array.isArray(result.failedKeys) && result.failedKeys.length > 0) {
      const reason = result.failedKeys[0]?.reason;
      if (reason === "review-locked") {
        alert(`Không thể khôi phục tờ khai do đã bị khóa rà soát. ${reviewLockMessage}`);
      } else {
        alert("Không thể khôi phục tờ khai. Vui lòng thử lại.");
      }
    }
  }, [
    actor,
    fetchAlerts,
    isReadOnlyForEdits,
    keyOfRow,
    loadSavedRows,
    mode,
    restoreDeclRows,
    reviewLockMessage,
    setHasUnsaved,
  ]);

  return {
    deleteRowsByKeys,
    hardDeleteRowsByKeys,
    handleDeleteSelected,
    handleHardDeleteSelected,
    handleDeleteSingle,
    handleHardDeleteSingle,
    handleRestoreSingle,
  };
}
