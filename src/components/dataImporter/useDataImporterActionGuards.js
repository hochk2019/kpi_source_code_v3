import { useCallback } from "react";

export default function useDataImporterActionGuards({
  rawRows,
  keyOfRow,
  isRowEditable,
  isRowReviewLocked,
  editingRestrictionMessage,
  reviewLockMessage,
  showAlert,
}) {
  const notify = useCallback(
    (message) => {
      if (!message) return;
      if (typeof showAlert === "function") {
        showAlert(message);
        return;
      }
      if (typeof globalThis !== "undefined" && typeof globalThis.alert === "function") {
        globalThis.alert(message);
      }
    },
    [showAlert],
  );

  const filterEditableKeys = useCallback(
    (keys) => {
      if (!Array.isArray(keys) || keys.length === 0) {
        return { allowed: [], blocked: 0, reviewLocked: 0, reviewLockedKeys: [] };
      }

      const target = new Set(keys);
      const allowed = [];
      let blocked = 0;
      let reviewLocked = 0;
      const reviewLockedKeys = [];

      for (const row of rawRows) {
        const key = keyOfRow(row);
        if (!target.has(key)) continue;

        if (isRowEditable(row)) {
          allowed.push(key);
        } else {
          blocked += 1;
          if (isRowReviewLocked(row)) {
            reviewLocked += 1;
            reviewLockedKeys.push(key);
          }
        }
      }

      return { allowed, blocked, reviewLocked, reviewLockedKeys };
    },
    [isRowEditable, isRowReviewLocked, keyOfRow, rawRows],
  );

  const canHardDeleteRow = useCallback(
    (row) => {
      if (!row || typeof row !== "object") return false;
      if (!row.deleted_at) {
        return isRowEditable(row);
      }
      const restoredLike = { ...row };
      delete restoredLike.deleted_at;
      delete restoredLike.deleted_by;
      return isRowEditable(restoredLike);
    },
    [isRowEditable],
  );

  const filterHardDeleteKeys = useCallback(
    (keys) => {
      if (!Array.isArray(keys) || keys.length === 0) {
        return { allowed: [], blocked: 0, reviewLocked: 0, reviewLockedKeys: [] };
      }

      const target = new Set(keys);
      const allowed = [];
      let blocked = 0;
      let reviewLocked = 0;
      const reviewLockedKeys = [];

      for (const row of rawRows) {
        const key = keyOfRow(row);
        if (!target.has(key)) continue;

        if (canHardDeleteRow(row)) {
          allowed.push(key);
        } else {
          blocked += 1;
          if (isRowReviewLocked(row)) {
            reviewLocked += 1;
            reviewLockedKeys.push(key);
          }
        }
      }

      return { allowed, blocked, reviewLocked, reviewLockedKeys };
    },
    [canHardDeleteRow, isRowReviewLocked, keyOfRow, rawRows],
  );

  const ensureEditableKeys = useCallback(
    (keys, actionLabel = "thao tac") => {
      const { allowed, blocked, reviewLocked } = filterEditableKeys(keys);

      if (!allowed.length) {
        if (reviewLocked > 0) {
          notify(
            `Khong the ${actionLabel} ${reviewLocked.toLocaleString("vi-VN")} to khai da duoc ra soat. ${reviewLockMessage}`,
          );
        } else if (blocked > 0 && editingRestrictionMessage) {
          notify(editingRestrictionMessage);
        } else if (keys?.length) {
          notify("Khong tim thay to khai phu hop de xu ly.");
        }
        return null;
      }

      if (reviewLocked > 0) {
        notify(
          `Da bo qua ${reviewLocked.toLocaleString("vi-VN")} to khai da duoc ra soat (khong the ${actionLabel}).`,
        );
      } else if (blocked > 0 && editingRestrictionMessage) {
        notify(`Da bo qua ${blocked} to khai khong thuoc pham vi cua ban khi ${actionLabel}.`);
      }

      return allowed;
    },
    [editingRestrictionMessage, filterEditableKeys, notify, reviewLockMessage],
  );

  const ensureHardDeleteKeys = useCallback(
    (keys, actionLabel = "xoa vinh vien") => {
      const { allowed, blocked, reviewLocked } = filterHardDeleteKeys(keys);

      if (!allowed.length) {
        if (reviewLocked > 0) {
          notify(
            `Khong the ${actionLabel} ${reviewLocked.toLocaleString("vi-VN")} to khai da duoc ra soat. ${reviewLockMessage}`,
          );
        } else if (blocked > 0 && editingRestrictionMessage) {
          notify(editingRestrictionMessage);
        } else if (keys?.length) {
          notify("Khong tim thay to khai phu hop de xu ly.");
        }
        return null;
      }

      if (reviewLocked > 0) {
        notify(
          `Da bo qua ${reviewLocked.toLocaleString("vi-VN")} to khai da duoc ra soat (khong the ${actionLabel}).`,
        );
      } else if (blocked > 0 && editingRestrictionMessage) {
        notify(`Da bo qua ${blocked} to khai khong thuoc pham vi cua ban khi ${actionLabel}.`);
      }

      return allowed;
    },
    [editingRestrictionMessage, filterHardDeleteKeys, notify, reviewLockMessage],
  );

  return {
    filterEditableKeys,
    canHardDeleteRow,
    filterHardDeleteKeys,
    ensureEditableKeys,
    ensureHardDeleteKeys,
  };
}
