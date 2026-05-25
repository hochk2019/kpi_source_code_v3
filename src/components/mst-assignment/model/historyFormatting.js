export const HISTORY_FIELD_LABELS = {
  person_import: "Người phụ trách Nhập",
  person_export: "Người phụ trách Xuất",
  effective_from: "Áp dụng từ ngày",
  effective_to: "Đến hết ngày",
};

export const formatHistoryTime = (value) => {
  if (!value) return "";

  try {
    return new Date(value).toLocaleString("vi-VN", { hour12: false });
  } catch (err) {
    console.warn("formatHistoryTime error", err);
    return value;
  }
};
