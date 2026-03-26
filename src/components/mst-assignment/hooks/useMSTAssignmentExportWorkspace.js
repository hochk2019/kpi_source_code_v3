import { useCallback } from "react";
import * as XLSX from "xlsx";

function createExportTimestamp(now) {
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(
    2,
    "0"
  )}`;
}

function defaultAlert(message) {
  globalThis.alert?.(message);
}

export default function useMSTAssignmentExportWorkspace({
  rows,
  filteredRows,
  computeStatusDisplay,
  alertFn = defaultAlert,
  nowFn = () => new Date(),
  xlsx = XLSX,
}) {
  const exportRowsToExcel = useCallback(
    (scope = "filtered") => {
      const source = scope === "all" ? rows : filteredRows;

      if (!source.length) {
        alertFn("Không có dữ liệu để xuất Excel.");
        return;
      }

      const data = source.map((item, index) => ({
        STT: index + 1,
        MST: item.mst,
        "Công ty": item.company || "",
        "Người phụ trách Nhập": item.person_import || "",
        "Người phụ trách Xuất": item.person_export || "",
        "Tổ đội": item.team || "",
        "Áp dụng từ ngày": item.effective_from || "",
        "Đến hết ngày": item.effective_to || "",
        "Trạng thái": computeStatusDisplay(item) || item.status || "",
      }));

      const worksheet = xlsx.utils.json_to_sheet(data);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, "Gan MST");

      const suffix = scope === "all" ? "toan-bo" : "loc";
      const timestamp = createExportTimestamp(nowFn());

      xlsx.writeFile(workbook, `gan-mst-${suffix}-${timestamp}.xlsx`);
    },
    [alertFn, computeStatusDisplay, filteredRows, nowFn, rows, xlsx]
  );

  return {
    exportRowsToExcel,
  };
}
