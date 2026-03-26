import { useCallback, useState } from "react";

export default function useMSTAssignmentViewControlsWorkspace({
  goToFirstPage,
  initialApplyFrom = "",
  initialGroupByMST = true,
  initialSearch = "",
}) {
  const [groupByMST, setGroupByMST] = useState(initialGroupByMST);
  const [search, setSearch] = useState(initialSearch);
  const [applyFrom, setApplyFrom] = useState(initialApplyFrom);

  const handleGroupByMSTChange = useCallback(
    (nextValue) => {
      setGroupByMST(Boolean(nextValue));
      goToFirstPage?.();
    },
    [goToFirstPage]
  );

  const handleSearchChange = useCallback(
    (nextValue) => {
      setSearch(nextValue || "");
      goToFirstPage?.();
    },
    [goToFirstPage]
  );

  const handleClearSearch = useCallback(() => {
    setSearch("");
    goToFirstPage?.();
  }, [goToFirstPage]);

  const handleApplyFromChange = useCallback((nextValue) => {
    setApplyFrom(nextValue || "");
  }, []);

  return {
    applyFrom,
    groupByMST,
    handleApplyFromChange,
    handleClearSearch,
    handleGroupByMSTChange,
    handleSearchChange,
    search,
  };
}
