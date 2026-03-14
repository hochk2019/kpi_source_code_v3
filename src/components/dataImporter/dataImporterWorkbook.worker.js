import * as XLSX from "xlsx";

import { parseDataImporterWorkbookSync } from "./dataImporterWorkbookParser.js";

self.onmessage = (event) => {
  try {
    const result = parseDataImporterWorkbookSync(event?.data?.buffer, { xlsx: XLSX });
    self.postMessage({
      ok: true,
      ...result,
    });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error?.message || "Không thể đọc workbook trong worker.",
    });
  }
};
