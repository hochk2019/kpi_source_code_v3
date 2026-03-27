export const MST_HISTORY_FIELD_LABELS = {
  person_import: "Người phụ trách Nhập",
  person_export: "Người phụ trách Xuất",
  effective_from: "Áp dụng từ ngày",
};

export const formatTeamManagerHistoryTimestamp = (value) => {
  if (!value) return "";

  try {
    return new Date(value).toLocaleString("vi-VN", { hour12: false });
  } catch (error) {
    console.warn("formatTeamManagerHistoryTimestamp", error);
    return value;
  }
};
