import { useCallback, useMemo } from "react";

import { saveMSTRow } from "@/lib/store.js";
import { sortMSTRows } from "@/components/mst-assignment/model/displaySelectors.js";

const MST_ROW_FIELDS = [
  "mst",
  "company",
  "person_import",
  "person_export",
  "team",
  "effective_from",
  "effective_to",
  "status",
];

const NOOP_ALERT = () => {};

export default function useMSTAssignmentRowCommitWorkspace({
  actor,
  createRowState,
  isReadOnly,
  makeRowKey,
  normalizeStatusLabel,
  normalizeStr,
  originalRows,
  refreshHistory,
  setOriginalRows,
  setRecentlyImportedKeys,
  setRows,
  tidyMST,
  alertFn = typeof window !== "undefined" && typeof window.alert === "function"
    ? window.alert.bind(window)
    : NOOP_ALERT,
}) {
  const originalMap = useMemo(() => {
    const map = new Map();

    (Array.isArray(originalRows) ? originalRows : []).forEach((row) => {
      if (!row) return;

      const key = row.__originalKey || makeRowKey(row);
      if (key) {
        map.set(key, row);
      }
    });

    return map;
  }, [makeRowKey, originalRows]);

  const getRowDiff = useCallback(
    (row) => {
      if (!row) {
        return { changed: false, sanitized: createRowState({}, { isNew: true }) };
      }

      const baseKey = row.__originalKey || "";
      const sanitized = createRowState(row, {
        originalKey: baseKey || undefined,
        isNew: row.__isNew,
      });
      const nextKey = makeRowKey(sanitized);
      const baseline = baseKey ? originalMap.get(baseKey) : null;

      if (!baseline) {
        const patch = {};

        MST_ROW_FIELDS.forEach((field) => {
          patch[field] = sanitized[field] || "";
        });

        return { changed: true, isNew: true, sanitized, patch, keyChanged: true };
      }

      const patch = {};

      MST_ROW_FIELDS.forEach((field) => {
        const nextValue = sanitized[field] || "";
        const prevValue = baseline[field] || "";

        if (field === "effective_from" || field === "effective_to") {
          if (nextValue !== prevValue) {
            patch[field] = nextValue;
          }
          return;
        }

        if (field === "status") {
          if (normalizeStatusLabel(nextValue) !== normalizeStatusLabel(prevValue)) {
            patch[field] = normalizeStatusLabel(nextValue);
          }
          return;
        }

        if (field === "mst") {
          if (tidyMST(nextValue) !== tidyMST(prevValue)) {
            patch[field] = tidyMST(nextValue);
          }
          return;
        }

        if (normalizeStr(nextValue) !== normalizeStr(prevValue)) {
          patch[field] = nextValue;
        }
      });

      const keyChanged = nextKey !== (baseKey || nextKey);
      const changed = keyChanged || Object.keys(patch).length > 0;

      return { changed, isNew: false, sanitized, patch, keyChanged, baseline };
    },
    [
      createRowState,
      makeRowKey,
      normalizeStatusLabel,
      normalizeStr,
      originalMap,
      tidyMST,
    ]
  );

  const rowHasChanges = useCallback((row) => getRowDiff(row).changed, [getRowDiff]);

  const commitRow = useCallback(
    (row) => {
      if (isReadOnly) {
        alertFn("Bạn không có quyền cập nhật dòng này.");
        return;
      }

      const diff = getRowDiff(row);
      if (!diff.changed) {
        alertFn("Không có thay đổi mới để lưu.");
        return;
      }

      const payload = { ...diff.sanitized };
      delete payload.__originalKey;
      delete payload.__isNew;

      try {
        const result = saveMSTRow(payload, {
          originalKey: row.__originalKey || null,
          actor,
          detail: "Cập nhật gán MST từ tab Gán MST",
        });

        if (!result?.ok) {
          switch (result?.reason) {
            case "conflict":
              alertFn(
                "MST và ngày áp dụng trùng với dòng khác. Vui lòng đổi ngày áp dụng hoặc kiểm tra dữ liệu hiện có."
              );
              break;
            case "invalid":
              alertFn("Dữ liệu chưa hợp lệ, vui lòng kiểm tra lại.");
              break;
            case "not-found":
              alertFn("Không tìm thấy bản ghi gốc. Hãy tải lại trang trước khi cập nhật.");
              break;
            case "no-change":
              alertFn("Không có thay đổi mới để lưu.");
              break;
            default:
              alertFn("Không thể lưu dòng này. Vui lòng thử lại sau.");
          }
          return;
        }

        const savedRow = createRowState(result.row, {
          originalKey: result.key,
          isNew: false,
        });

        setRows((prev) => {
          const current = Array.isArray(prev) ? prev : [];
          const replaced = current.map((item) => (item === row ? savedRow : item));
          return sortMSTRows(replaced);
        });

        setOriginalRows((prev) => {
          const baseKey = result.previousKey || row.__originalKey || "";
          const filtered = (Array.isArray(prev) ? prev : []).filter((item) => {
            const itemKey = item.__originalKey || makeRowKey(item);
            return itemKey !== baseKey;
          });

          return sortMSTRows([...filtered, savedRow]);
        });

        setRecentlyImportedKeys((prev) => {
          const next = new Set(prev);
          const currentKey = makeRowKey(row);

          if (currentKey && next.has(currentKey)) {
            next.delete(currentKey);
          }

          if (row.__originalKey && next.has(row.__originalKey)) {
            next.delete(row.__originalKey);
          }

          next.add(result.key);
          return next;
        });

        refreshHistory?.();
        alertFn("Đã lưu thay đổi cho dòng này.");
      } catch (error) {
        console.error("saveMSTRow error", error);
        alertFn("Không thể lưu dòng này. Vui lòng thử lại sau.");
      }
    },
    [
      actor,
      alertFn,
      createRowState,
      getRowDiff,
      isReadOnly,
      makeRowKey,
      refreshHistory,
      setOriginalRows,
      setRecentlyImportedKeys,
      setRows,
    ]
  );

  return {
    commitRow,
    rowHasChanges,
  };
}
