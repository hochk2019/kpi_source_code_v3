import { useCallback } from "react";

import { loadXlsx } from "@/lib/loadXlsx.js";
import { buildMSTAssignmentExportRows } from "@/components/mst-assignment/model/exportDataset.js";

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

function normalizeExportScope(scope) {
  return scope === "all" ? "all" : "filtered";
}

function normalizeExportFormat(format) {
  return format === "csv" ? "csv" : "xlsx";
}

export default function useMSTAssignmentExportWorkspace({
  rows,
  filteredRows,
  computeStatusDisplay,
  historyEntries = [],
  alertFn = defaultAlert,
  nowFn = () => new Date(),
  xlsx = null,
  xlsxLoader = loadXlsx,
}) {
  const exportRows = useCallback(
    async ({ scope = "filtered", format = "xlsx" } = {}) => {
      const normalizedScope = normalizeExportScope(scope);
      const normalizedFormat = normalizeExportFormat(format);
      const source = normalizedScope === "all" ? rows : filteredRows;

      if (!source.length) {
        alertFn("Không có dữ liệu để xuất báo cáo.");
        return;
      }

      try {
        const activeXlsx = xlsx ?? (await xlsxLoader());
        const data = buildMSTAssignmentExportRows({
          rows: source,
          computeStatusDisplay,
          historyEntries,
        });

        const worksheet = activeXlsx.utils.json_to_sheet(data);
        const workbook = activeXlsx.utils.book_new();
        activeXlsx.utils.book_append_sheet(workbook, worksheet, "Gan MST");

        const suffix = normalizedScope === "all" ? "toan-bo" : "loc";
        const timestamp = createExportTimestamp(nowFn());
        const fileName = `gan-mst-${suffix}-${timestamp}.${normalizedFormat}`;

        if (normalizedFormat === "csv") {
          activeXlsx.writeFile(workbook, fileName, { bookType: "csv" });
          return;
        }

        activeXlsx.writeFile(workbook, fileName);
      } catch (error) {
        console.error(error);
        alertFn("Không thể xuất báo cáo lúc này.");
      }
    },
    [alertFn, computeStatusDisplay, filteredRows, historyEntries, nowFn, rows, xlsx, xlsxLoader]
  );

  const exportRowsToExcel = useCallback(
    async (scope = "filtered") => exportRows({ scope, format: "xlsx" }),
    [exportRows]
  );

  const exportRowsToCsv = useCallback(
    async (scope = "filtered") => exportRows({ scope, format: "csv" }),
    [exportRows]
  );

  return {
    exportRows,
    exportRowsToCsv,
    exportRowsToExcel,
  };
}
