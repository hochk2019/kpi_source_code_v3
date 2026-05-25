import { useCallback, useEffect, useMemo, useState } from "react";

function normalizeVisibleIds(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => item?.id).filter(Boolean);
}

export function useKpiAdjustmentSelection({ canSelect, visibleItems }) {
  const visibleIds = useMemo(() => normalizeVisibleIds(visibleItems), [visibleItems]);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => visibleIds.includes(id)));
  }, [visibleIds]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedItems = useMemo(() => {
    if (!Array.isArray(visibleItems) || visibleItems.length === 0) {
      return [];
    }

    return visibleItems.filter((item) => item?.id && selectedIdSet.has(item.id));
  }, [selectedIdSet, visibleItems]);

  const allVisibleSelected =
    canSelect === true &&
    visibleIds.length > 0 &&
    visibleIds.every((id) => selectedIdSet.has(id));

  const toggleSelection = useCallback(
    (id, nextChecked) => {
      if (!canSelect || !id) {
        return;
      }

      setSelectedIds((current) => {
        const next = new Set(current);
        const shouldSelect = typeof nextChecked === "boolean" ? nextChecked : !next.has(id);

        if (shouldSelect) {
          next.add(id);
        } else {
          next.delete(id);
        }

        return Array.from(next);
      });
    },
    [canSelect]
  );

  const toggleVisibleSelection = useCallback(
    (nextChecked) => {
      if (!canSelect || visibleIds.length === 0) {
        return;
      }

      setSelectedIds((current) => {
        const next = new Set(current);
        const shouldSelect = typeof nextChecked === "boolean" ? nextChecked : !allVisibleSelected;

        for (const id of visibleIds) {
          if (shouldSelect) {
            next.add(id);
          } else {
            next.delete(id);
          }
        }

        return Array.from(next);
      });
    },
    [allVisibleSelected, canSelect, visibleIds]
  );

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  return {
    selectedIds,
    selectedIdSet,
    selectedItems,
    selectedCount: selectedItems.length,
    allVisibleSelected,
    toggleSelection,
    toggleVisibleSelection,
    clearSelection,
  };
}

export default useKpiAdjustmentSelection;
