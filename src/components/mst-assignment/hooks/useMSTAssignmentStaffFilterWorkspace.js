import { useCallback, useState } from "react";

const NOOP_ALERT = () => {};

export default function useMSTAssignmentStaffFilterWorkspace({
  addQuickFavorite,
  goToFirstPage,
  alertFn = typeof window !== "undefined" && typeof window.alert === "function"
    ? window.alert.bind(window)
    : NOOP_ALERT,
  initialStaffFilter = "",
}) {
  const [staffFilter, setStaffFilter] = useState(initialStaffFilter);

  const handleStaffFilterSelect = useCallback(
    ({ staffName }) => {
      setStaffFilter(staffName || "");
      goToFirstPage?.();
    },
    [goToFirstPage]
  );

  const clearStaffFilter = useCallback(() => {
    setStaffFilter("");
    goToFirstPage?.();
  }, [goToFirstPage]);

  const applyStaffFavorite = useCallback(
    (value) => {
      setStaffFilter(value || "");
      goToFirstPage?.();
    },
    [goToFirstPage]
  );

  const handleSaveStaffFavorite = useCallback(() => {
    if (!staffFilter.trim()) {
      alertFn("Nhập hoặc chọn nhân viên trước khi lưu bộ lọc.");
      return;
    }

    const result = addQuickFavorite("staff", staffFilter);
    if (!result?.ok) {
      if (result.reason === "duplicate") {
        alertFn("Bộ lọc này đã nằm trong danh sách ưa thích.");
      }
      return;
    }

    alertFn("Đã lưu bộ lọc nhân viên.");
  }, [addQuickFavorite, alertFn, staffFilter]);

  return {
    applyStaffFavorite,
    clearStaffFilter,
    handleSaveStaffFavorite,
    handleStaffFilterSelect,
    staffFilter,
  };
}
