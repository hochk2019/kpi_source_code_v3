import { useCallback } from "react";

import { loadXlsx } from "@/lib/loadXlsx.js";

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
  xlsx = null,
  xlsxLoader = loadXlsx,
}) {
  const exportRowsToExcel = useCallback(
    async (scope = "filtered") => {
      const source = scope === "all" ? rows : filteredRows;

      if (!source.length) {
        alertFn("Không có dữ liệu để xuất Excel.");
        return;
      }

      try {
        const activeXlsx = xlsx ?? (await xlsxLoader());
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

        const worksheet = activeXlsx.utils.json_to_sheet(data);
        const workbook = activeXlsx.utils.book_new();
        activeXlsx.utils.book_append_sheet(workbook, worksheet, "Gan MST");

        const suffix = scope === "all" ? "toan-bo" : "loc";
        const timestamp = createExportTimestamp(nowFn());

        activeXlsx.writeFile(workbook, `gan-mst-${suffix}-${timestamp}.xlsx`);
      } catch (error) {
        console.error(error);
        alertFn("Không thể xuất Excel lúc này.");
      }
    },
    [alertFn, computeStatusDisplay, filteredRows, nowFn, rows, xlsx, xlsxLoader]
  );

  return {
    exportRowsToExcel,
  };
}
