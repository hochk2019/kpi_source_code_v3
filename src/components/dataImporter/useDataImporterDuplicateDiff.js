import { useCallback, useEffect, useMemo, useState } from "react";

const CLOSED_DUPLICATE_DIFF_STATE = {
  open: false,
  group: null,
  baseKey: null,
  compareKey: null,
};

export default function useDataImporterDuplicateDiff({
  duplicate11Details = [],
  createDuplicateDiffGroups,
  prepareRowForDiff,
  formatDeclarationLabel,
}) {
  const [duplicateDiffState, setDuplicateDiffState] = useState(CLOSED_DUPLICATE_DIFF_STATE);

  useEffect(() => {
    setDuplicateDiffState((prev) => {
      if (!prev.open) {
        return prev;
      }

      const group = duplicate11Details.find((entry) => entry.rawPrefix === prev.group);
      if (!group) {
        return CLOSED_DUPLICATE_DIFF_STATE;
      }

      const availableKeys = group.items.map((item) => item.key);
      const fallbackBase = availableKeys.includes(group.keeperKey)
        ? group.keeperKey
        : availableKeys[0] || null;
      const baseKey = availableKeys.includes(prev.baseKey) ? prev.baseKey : fallbackBase;

      let compareKey = availableKeys.includes(prev.compareKey) ? prev.compareKey : null;
      if (!compareKey || compareKey === baseKey) {
        compareKey = group.items.find((item) => item.key !== baseKey)?.key || null;
      }

      if (baseKey === prev.baseKey && compareKey === prev.compareKey) {
        return prev;
      }

      return { ...prev, baseKey, compareKey };
    });
  }, [duplicate11Details]);

  const duplicateDiffGroup = useMemo(() => {
    if (!duplicateDiffState.open || !duplicateDiffState.group) return null;
    return duplicate11Details.find((group) => group.rawPrefix === duplicateDiffState.group) || null;
  }, [duplicate11Details, duplicateDiffState.group, duplicateDiffState.open]);

  const duplicateDiffBaseItem = useMemo(() => {
    if (!duplicateDiffGroup) return null;

    const baseKey =
      duplicateDiffState.baseKey || duplicateDiffGroup.keeperKey || duplicateDiffGroup.items[0]?.key || null;
    if (!baseKey) return null;

    return duplicateDiffGroup.items.find((item) => item.key === baseKey) || null;
  }, [duplicateDiffGroup, duplicateDiffState.baseKey]);

  const duplicateDiffCompareItem = useMemo(() => {
    if (!duplicateDiffGroup) return null;

    const compareKey = duplicateDiffState.compareKey;
    if (!compareKey) {
      return duplicateDiffGroup.items.find(
        (item) => item.key !== (duplicateDiffState.baseKey || duplicateDiffGroup.keeperKey)
      );
    }

    return duplicateDiffGroup.items.find((item) => item.key === compareKey) || null;
  }, [duplicateDiffGroup, duplicateDiffState.baseKey, duplicateDiffState.compareKey]);

  const duplicateDiffGroups = useMemo(() => {
    if (!duplicateDiffGroup || !duplicateDiffBaseItem || !duplicateDiffCompareItem) return [];

    return createDuplicateDiffGroups(
      prepareRowForDiff(duplicateDiffBaseItem.row),
      prepareRowForDiff(duplicateDiffCompareItem.row)
    );
  }, [
    createDuplicateDiffGroups,
    duplicateDiffBaseItem,
    duplicateDiffCompareItem,
    duplicateDiffGroup,
    prepareRowForDiff,
  ]);

  const duplicateDiffChangedCount = useMemo(() => {
    if (!Array.isArray(duplicateDiffGroups)) return 0;

    return duplicateDiffGroups.reduce((total, group) => {
      if (!group || !Array.isArray(group.rows)) return total;
      return total + group.rows.filter((row) => row.changed).length;
    }, 0);
  }, [duplicateDiffGroups]);

  const duplicateDiffGroupLabel = duplicateDiffGroup?.prefix || duplicateDiffGroup?.rawPrefix || "";
  const duplicateDiffBaseLabel =
    duplicateDiffBaseItem?.label || formatDeclarationLabel(duplicateDiffBaseItem?.row || {});
  const duplicateDiffCompareLabel =
    duplicateDiffCompareItem?.label || formatDeclarationLabel(duplicateDiffCompareItem?.row || {});

  const handleOpenDuplicateDiff = useCallback((groupPrefix, baseKey, compareKey) => {
    setDuplicateDiffState({
      open: true,
      group: groupPrefix,
      baseKey: baseKey || null,
      compareKey: compareKey || null,
    });
  }, []);

  const handleCloseDuplicateDiff = useCallback(() => {
    setDuplicateDiffState(CLOSED_DUPLICATE_DIFF_STATE);
  }, []);

  const handleChangeDuplicateDiffBase = useCallback((nextKey) => {
    setDuplicateDiffState((prev) => {
      if (!prev.open) return prev;

      const baseKey = nextKey || null;
      let compareKey = prev.compareKey;
      if (compareKey && compareKey === baseKey) {
        compareKey = null;
      }

      return { ...prev, baseKey, compareKey };
    });
  }, []);

  const handleChangeDuplicateDiffCompare = useCallback((nextKey) => {
    setDuplicateDiffState((prev) => {
      if (!prev.open) return prev;
      return { ...prev, compareKey: nextKey || null };
    });
  }, []);

  const handleSwapDuplicateDiff = useCallback(() => {
    setDuplicateDiffState((prev) => {
      if (!prev.open) return prev;
      if (!prev.baseKey || !prev.compareKey) {
        return prev;
      }

      return { ...prev, baseKey: prev.compareKey, compareKey: prev.baseKey };
    });
  }, []);

  const handleDuplicateDiffOpenChange = useCallback((nextOpen) => {
    if (nextOpen) {
      if (!duplicateDiffState.group && duplicate11Details[0]?.rawPrefix) {
        const firstGroup = duplicate11Details[0];
        const firstBaseKey = firstGroup.keeperKey || firstGroup.items?.[0]?.key || null;
        const firstCompareKey =
          firstGroup.items?.find((item) => item.key !== firstBaseKey)?.key || null;

        handleOpenDuplicateDiff(firstGroup.rawPrefix, firstBaseKey, firstCompareKey);
        return;
      }

      setDuplicateDiffState((prev) => ({ ...prev, open: true }));
      return;
    }

    handleCloseDuplicateDiff();
  }, [duplicate11Details, duplicateDiffState.group, handleCloseDuplicateDiff, handleOpenDuplicateDiff]);

  return {
    duplicateDiffState,
    duplicateDiffGroup,
    duplicateDiffBaseItem,
    duplicateDiffCompareItem,
    duplicateDiffGroups,
    duplicateDiffChangedCount,
    duplicateDiffGroupLabel,
    duplicateDiffBaseLabel,
    duplicateDiffCompareLabel,
    handleOpenDuplicateDiff,
    handleCloseDuplicateDiff,
    handleChangeDuplicateDiffBase,
    handleChangeDuplicateDiffCompare,
    handleSwapDuplicateDiff,
    handleDuplicateDiffOpenChange,
  };
}
