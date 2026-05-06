import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppDialog } from "@/hooks/useAppDialog";

export default function useDataImporterDuplicateReview({
  actor = "system",
  mode = "source",
  isReadOnlyForEdits = false,
  isAdminRole = false,
  duplicate11Details = [],
  rawRows = [],
  editingRestrictionMessage = "",
  duplicateMergeFields = [],
  keyOfRow,
  isRowEditable,
  clearDuplicateReviewFlags,
  applyMergeField,
  sortDeclRows,
  saveDeclRows,
  pushAuditLog,
  loadSavedRows,
  fetchAlerts,
}) {
  const { alert } = useAppDialog();
  const [duplicateReviewOpen, setDuplicateReviewOpen] = useState(false);
  const [duplicateReviewConfirmed, setDuplicateReviewConfirmed] = useState(false);
  const [duplicate11Plan, setDuplicate11Plan] = useState({});

  useEffect(() => {
    if (!Array.isArray(duplicate11Details) || duplicate11Details.length === 0) {
      setDuplicate11Plan({});
      return;
    }

    setDuplicate11Plan((prev) => {
      const next = {};

      for (const group of duplicate11Details) {
        const prevEntry = prev[group.rawPrefix] || {};
        const availableKeys = new Set(group.items.map((item) => item.key));
        const fallbackKeeper = group.keeperKey || group.items[0]?.key || null;
        const keeperKey = availableKeys.has(prevEntry.keeperKey) ? prevEntry.keeperKey : fallbackKeeper;
        const merges = {};

        for (const field of duplicateMergeFields) {
          const previous = prevEntry.merges?.[field.key];
          merges[field.key] = availableKeys.has(previous) ? previous : keeperKey;
        }

        next[group.rawPrefix] = {
          keeperKey,
          merges,
          resolution: prevEntry.resolution === "review" ? "review" : "delete",
          note: prevEntry.note || "",
        };
      }

      return next;
    });
  }, [duplicate11Details, duplicateMergeFields]);

  const duplicate11PlanStats = useMemo(() => {
    if (!Array.isArray(duplicate11Details) || duplicate11Details.length === 0) {
      return { deleteGroups: 0, reviewGroups: 0, removalCount: 0 };
    }

    let deleteGroups = 0;
    let reviewGroups = 0;
    let removalCount = 0;

    for (const group of duplicate11Details) {
      const plan = duplicate11Plan[group.rawPrefix];
      const items = Array.isArray(group.items) ? group.items : [];
      if (!items.length) continue;

      if (plan?.resolution === "review") {
        reviewGroups += 1;
        continue;
      }

      deleteGroups += 1;
      const keeperKey =
        plan?.keeperKey && items.some((item) => item.key === plan.keeperKey)
          ? plan.keeperKey
          : group.keeperKey || items[0].key;
      removalCount += items.filter((item) => item.key !== keeperKey).length;
    }

    return { deleteGroups, reviewGroups, removalCount };
  }, [duplicate11Details, duplicate11Plan]);

  const {
    deleteGroups: duplicate11PlannedDeleteGroups,
    reviewGroups: duplicate11PlannedReviewGroups,
    removalCount: duplicate11PlannedRemovalCount,
  } = duplicate11PlanStats;

  const duplicate11PlanHasActions =
    duplicate11PlannedDeleteGroups > 0 || duplicate11PlannedReviewGroups > 0;

  const handleChangeDuplicateKeeper = useCallback((prefix, keeperKey) => {
    setDuplicate11Plan((prev) => {
      const current = prev[prefix] || {};
      const merges = { ...(current.merges || {}) };
      const previousKeeper = current.keeperKey;

      for (const field of duplicateMergeFields) {
        if (!merges[field.key] || merges[field.key] === previousKeeper) {
          merges[field.key] = keeperKey;
        }
      }

      return {
        ...prev,
        [prefix]: {
          ...current,
          keeperKey,
          merges,
        },
      };
    });
  }, [duplicateMergeFields]);

  const handleChangeDuplicateMerge = useCallback((prefix, field, value) => {
    setDuplicate11Plan((prev) => {
      const current = prev[prefix] || {};
      return {
        ...prev,
        [prefix]: {
          ...current,
          merges: { ...(current.merges || {}), [field]: value },
        },
      };
    });
  }, []);

  const handleChangeDuplicateResolution = useCallback((prefix, resolution) => {
    setDuplicate11Plan((prev) => {
      const current = prev[prefix] || {};
      return {
        ...prev,
        [prefix]: {
          ...current,
          resolution,
        },
      };
    });
  }, []);

  const handleChangeDuplicateNote = useCallback((prefix, note) => {
    setDuplicate11Plan((prev) => {
      const current = prev[prefix] || {};
      return {
        ...prev,
        [prefix]: {
          ...current,
          note,
        },
      };
    });
  }, []);

  const handleDeleteDuplicates11 = useCallback(async () => {
    if (isReadOnlyForEdits) {
      await alert("Bạn không có quyền đánh dấu xóa tờ khai trùng.");
      return;
    }

    if (mode !== "saved") {
      await alert("Chỉ có thể đánh dấu xóa tờ khai trùng khi đang xem dữ liệu đã lưu.");
      return;
    }

    if (!Array.isArray(duplicate11Details) || duplicate11Details.length === 0) {
      await alert("Không có nhóm tờ khai trùng để xử lý.");
      return;
    }

    setDuplicateReviewConfirmed(false);
    setDuplicateReviewOpen(true);
  }, [duplicate11Details, isReadOnlyForEdits, mode]);

  const handleCloseDuplicateReview = useCallback(() => {
    setDuplicateReviewOpen(false);
    setDuplicateReviewConfirmed(false);
  }, []);

  const handleDuplicateReviewOpenChange = useCallback((nextOpen) => {
    if (nextOpen) {
      setDuplicateReviewOpen(true);
      return;
    }

    handleCloseDuplicateReview();
  }, [handleCloseDuplicateReview]);

  const handleConfirmDuplicateRemoval = useCallback(async () => {
    if (!Array.isArray(duplicate11Details) || duplicate11Details.length === 0) {
      await alert("Không có nhóm trùng để xử lý.");
      handleCloseDuplicateReview();
      return;
    }

    const nowISO = new Date().toISOString();
    const rowMap = new Map(rawRows.map((row) => [keyOfRow(row), { ...row }]));
    const updates = new Map();
    const removalSet = new Set();
    const auditGroups = [];
    let deleteGroups = 0;
    let reviewGroups = 0;
    let blockedGroups = 0;

    for (const group of duplicate11Details) {
      const plan = duplicate11Plan[group.rawPrefix];
      const items = Array.isArray(group.items) ? group.items : [];
      if (!items.length) continue;

      const allowedItems = items.filter((item) => {
        const original = rowMap.get(item.key);
        return original && isRowEditable(original);
      });

      if (!allowedItems.length) {
        blockedGroups += 1;
        continue;
      }

      const availableKeys = new Set(allowedItems.map((item) => item.key));
      const fallbackKeeper = group.keeperKey || allowedItems[0].key;
      const keeperKey =
        plan?.keeperKey && availableKeys.has(plan.keeperKey) ? plan.keeperKey : fallbackKeeper;

      if (plan?.resolution === "review") {
        reviewGroups += 1;
        const note = (plan?.note || "").trim();

        for (const item of allowedItems) {
          const original = rowMap.get(item.key) || {};
          updates.set(item.key, {
            ...original,
            duplicate_review_pending: true,
            duplicate_review_note: note,
            duplicate_review_actor: actor,
            duplicate_review_updated_at: nowISO,
          });
        }

        auditGroups.push({
          prefix: group.rawPrefix,
          label: group.prefix,
          resolution: "review",
          note,
          keys: allowedItems.map((item) => item.key),
        });
        continue;
      }

      deleteGroups += 1;
      const keeperRow = { ...(rowMap.get(keeperKey) || {}) };
      clearDuplicateReviewFlags(keeperRow);

      const merges = plan?.merges || {};
      const mergeMeta = {};
      for (const field of duplicateMergeFields) {
        const chosen = merges[field.key];
        const sourceKey = chosen && availableKeys.has(chosen) ? chosen : keeperKey;
        const source = rowMap.get(sourceKey) || rowMap.get(keeperKey) || {};
        applyMergeField(keeperRow, source, field.key);
        mergeMeta[field.key] = sourceKey;
      }

      updates.set(keeperKey, keeperRow);

      const removedKeys = [];
      for (const item of allowedItems) {
        if (item.key === keeperKey) continue;
        removalSet.add(item.key);
        removedKeys.push(item.key);
      }

      auditGroups.push({
        prefix: group.rawPrefix,
        label: group.prefix,
        resolution: "delete",
        keeperKey,
        removedKeys,
        merges: mergeMeta,
      });
    }

    const removalCount = removalSet.size;
    if (removalCount === 0 && updates.size === 0) {
      await alert("Không có thay đổi nào được áp dụng.");
      handleCloseDuplicateReview();
      return;
    }

    if (blockedGroups > 0 && editingRestrictionMessage) {
      await alert(`Đã bỏ qua ${blockedGroups} nhóm trùng không thuộc phạm vi phụ trách của bạn.`);
    }

    const nextRows = sortDeclRows(
      rawRows
        .map((row) => {
          const key = keyOfRow(row);
          if (removalSet.has(key)) {
            return null;
          }
          if (updates.has(key)) {
            return updates.get(key);
          }
          return row;
        })
        .filter(Boolean)
    );

    const detail = `Xử lý trùng 11 số: ${deleteGroups} nhóm xóa, ${reviewGroups} nhóm đánh dấu rà soát, loại bỏ ${removalCount} bản ghi`;

    saveDeclRows(nextRows, {
      overwrite: true,
      actor,
      detail,
      allowReviewedOverride: isAdminRole,
    });

    pushAuditLog?.({
      actor,
      action: "decl.duplicate.resolve",
      detail,
      meta: {
        groups: auditGroups,
      },
    });

    await alert(
      `Đã ${deleteGroups ? `xóa ${removalCount} bản ghi trong ${deleteGroups} nhóm` : "cập nhật đánh dấu"}${
        reviewGroups ? `, ${reviewGroups} nhóm được đánh dấu cần rà soát` : ""
      }.`
    );
    handleCloseDuplicateReview();
    setDuplicateReviewConfirmed(false);
    loadSavedRows?.({ bypassConfirm: true });
    fetchAlerts?.();
  }, [
    actor,
    applyMergeField,
    clearDuplicateReviewFlags,
    duplicate11Details,
    duplicate11Plan,
    duplicateMergeFields,
    editingRestrictionMessage,
    fetchAlerts,
    handleCloseDuplicateReview,
    isAdminRole,
    isRowEditable,
    keyOfRow,
    loadSavedRows,
    pushAuditLog,
    rawRows,
    saveDeclRows,
    sortDeclRows,
  ]);

  return {
    duplicateReviewOpen,
    duplicateReviewConfirmed,
    duplicate11Plan,
    duplicate11PlanHasActions,
    duplicate11PlannedDeleteGroups,
    duplicate11PlannedReviewGroups,
    duplicate11PlannedRemovalCount,
    setDuplicateReviewConfirmed,
    handleChangeDuplicateKeeper,
    handleChangeDuplicateMerge,
    handleChangeDuplicateResolution,
    handleChangeDuplicateNote,
    handleDeleteDuplicates11,
    handleCloseDuplicateReview,
    handleDuplicateReviewOpenChange,
    handleConfirmDuplicateRemoval,
  };
}
