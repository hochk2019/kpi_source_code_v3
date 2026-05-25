import { useCallback } from "react";

import { sortMSTRows } from "@/components/mst-assignment/model/displaySelectors.js";

export function migrateImportedKey(prev, currentKey, nextKey) {
  if (!prev.has(currentKey) || !nextKey || nextKey === currentKey) {
    return prev;
  }

  const next = new Set(prev);
  next.delete(currentKey);
  next.add(nextKey);
  return next;
}

export function removeImportedKey(prev, targetKey) {
  if (!prev.has(targetKey)) {
    return prev;
  }

  const next = new Set(prev);
  next.delete(targetKey);
  return next;
}

export function buildAssigneePatch(row, assignment, field, { normalizeName, normalizeStr }) {
  const { staffName, teamName, isCustom } = assignment || {};
  const patch = { [field]: staffName || "" };

  if (staffName && teamName && !isCustom) {
    const prevTeamKey = normalizeName(normalizeStr(row?.team || ""));
    const nextTeamKey = normalizeName(normalizeStr(teamName));
    if (!prevTeamKey || prevTeamKey === nextTeamKey) {
      patch.team = teamName;
    }
  }

  return patch;
}

const NOOP_ALERT = () => {};
const NOOP_CONFIRM = () => true;

export default function useMSTAssignmentRowMutations({
  computeStoredStatus,
  helpers,
  isReadOnly,
  setRecentlyImportedKeys,
  setRows,
  alertFn = typeof window !== "undefined" && typeof window.alert === "function"
    ? window.alert.bind(window)
    : NOOP_ALERT,
  confirmFn = typeof window !== "undefined" && typeof window.confirm === "function"
    ? window.confirm.bind(window)
    : NOOP_CONFIRM,
}) {
  const updateRow = useCallback(
    (originalRow, patch) => {
      if (isReadOnly) return;

      const nextFrom = Object.prototype.hasOwnProperty.call(patch || {}, "effective_from")
        ? patch.effective_from || ""
        : originalRow.effective_from || "";
      const nextTo = Object.prototype.hasOwnProperty.call(patch || {}, "effective_to")
        ? patch.effective_to || ""
        : originalRow.effective_to || "";

      if (nextFrom && nextTo && nextTo < nextFrom) {
        alertFn("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");
        return;
      }

      const targetKey = helpers.makeRowKey(originalRow);
      let updatedKey = "";
      let didUpdate = false;

      setRows((prev) =>
        sortMSTRows(
          prev.map((row) => {
            if (helpers.makeRowKey(row) !== targetKey) return row;

            const next = { ...row, ...patch };
            next.__originalKey = row.__originalKey ?? null;
            next.__isNew = row.__isNew;

            if (patch && Object.prototype.hasOwnProperty.call(patch, "mst")) {
              next.mst = helpers.tidyMST(next.mst);
            }

            if (patch && Object.prototype.hasOwnProperty.call(patch, "effective_from")) {
              next.effective_from = patch.effective_from || "";
            }

            if (patch && Object.prototype.hasOwnProperty.call(patch, "effective_to")) {
              next.effective_to = patch.effective_to || "";
            }

            next.status = computeStoredStatus(next);
            updatedKey = helpers.makeRowKey(next);
            didUpdate = true;
            return next;
          })
        )
      );

      if (didUpdate && updatedKey && updatedKey !== targetKey) {
        setRecentlyImportedKeys((prev) => migrateImportedKey(prev, targetKey, updatedKey));
      }
    },
    [alertFn, computeStoredStatus, helpers, isReadOnly, setRecentlyImportedKeys, setRows]
  );

  const handleRowImportSelect = useCallback(
    (row, assignment) => {
      updateRow(
        row,
        buildAssigneePatch(row, assignment, "person_import", {
          normalizeName: helpers.normalizeName,
          normalizeStr: helpers.normalizeStr,
        })
      );
    },
    [helpers.normalizeName, helpers.normalizeStr, updateRow]
  );

  const handleRowExportSelect = useCallback(
    (row, assignment) => {
      updateRow(
        row,
        buildAssigneePatch(row, assignment, "person_export", {
          normalizeName: helpers.normalizeName,
          normalizeStr: helpers.normalizeStr,
        })
      );
    },
    [helpers.normalizeName, helpers.normalizeStr, updateRow]
  );

  const removeRow = useCallback(
    (row) => {
      if (isReadOnly) return;

      const key = helpers.makeRowKey(row);
      const fromLabel = row.effective_from || "";
      const toLabel = row.effective_to || "";
      const rangeLabel = fromLabel || toLabel ? `(${fromLabel || "…"} → ${toLabel || "…"})` : "";
      const label = `${row.mst}${rangeLabel ? ` ${rangeLabel}` : ""}`;

      if (!confirmFn(`Xóa dòng ${label}?`)) return;

      setRows((prev) => prev.filter((item) => helpers.makeRowKey(item) !== key));
      setRecentlyImportedKeys((prev) => removeImportedKey(prev, key));
    },
    [confirmFn, helpers, isReadOnly, setRecentlyImportedKeys, setRows]
  );

  return {
    updateRow,
    handleRowImportSelect,
    handleRowExportSelect,
    removeRow,
  };
}
