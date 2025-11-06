import * as XLSX from "xlsx";

const workerContext = self;

function handleRead(requestId, payload = {}) {
  try {
    const { arrayBuffer, options = {} } = payload;
    if (!(arrayBuffer instanceof ArrayBuffer)) {
      throw new Error("Thiếu dữ liệu file Excel hợp lệ");
    }
    const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
    const sheetName = options.sheetName || workbook.SheetNames?.[0];
    if (!sheetName) {
      throw new Error("File Excel không có sheet dữ liệu");
    }
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error(`Không tìm thấy sheet "${sheetName}" trong file Excel`);
    }
    const sheetOptions = {
      raw: false,
      defval: "",
      ...options.sheetToJson,
    };
    const rows = XLSX.utils.sheet_to_json(sheet, sheetOptions);
    workerContext.postMessage({
      requestId,
      success: true,
      payload: {
        rows,
        sheetName,
        sheetNames: workbook.SheetNames,
      },
    });
  } catch (error) {
    workerContext.postMessage({
      requestId,
      success: false,
      error: error?.message || "Không thể đọc file Excel",
    });
  }
}

function handleWrite(requestId, payload = {}) {
  try {
    const { rows = [], options = {} } = payload;
    if (!Array.isArray(rows)) {
      throw new Error("Dữ liệu xuất phải là mảng");
    }
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    const sheetName = options.sheetName || "Sheet1";
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    const writeOptions = {
      bookType: "xlsx",
      type: "array",
      ...options.write,
    };
    const arrayBuffer = XLSX.write(workbook, writeOptions);
    workerContext.postMessage({
      requestId,
      success: true,
      payload: {
        arrayBuffer,
        fileName: options.fileName || "export.xlsx",
        mimeType:
          options.mimeType ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    }, [arrayBuffer]);
  } catch (error) {
    workerContext.postMessage({
      requestId,
      success: false,
      error: error?.message || "Không thể ghi file Excel",
    });
  }
}

workerContext.addEventListener("message", (event) => {
  const { type, requestId, payload } = event.data || {};
  if (!requestId || typeof type !== "string") {
    return;
  }
  if (type === "read") {
    handleRead(requestId, payload);
    return;
  }
  if (type === "write") {
    handleWrite(requestId, payload);
  }
});
