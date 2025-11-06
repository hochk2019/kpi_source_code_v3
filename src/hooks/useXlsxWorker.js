import { useCallback, useEffect, useRef } from "react";

const WORKER_URL = new URL("../workers/xlsxWorker.js", import.meta.url);

const WORKER_SUPPORTED = typeof Worker !== "undefined";

export default function useXlsxWorker() {
  const workerRef = useRef(null);
  const requestIdRef = useRef(0);
  const pendingRef = useRef(new Map());

  useEffect(() => {
    if (!WORKER_SUPPORTED) {
      return undefined;
    }

    const worker = new Worker(WORKER_URL, { type: "module" });
    workerRef.current = worker;

    const handleMessage = (event) => {
      const { requestId, success, error, payload } = event.data || {};
      if (!requestId) {
        return;
      }
      const pending = pendingRef.current.get(requestId);
      if (!pending) {
        return;
      }
      pendingRef.current.delete(requestId);
      if (success) {
        pending.resolve(payload);
      } else {
        const message = typeof error === "string" && error.trim() ? error : "XLSX worker gặp lỗi không xác định";
        pending.reject(new Error(message));
      }
    };

    const handleError = (event) => {
      const error = event?.message || "XLSX worker gặp lỗi";
      for (const pending of pendingRef.current.values()) {
        pending.reject(new Error(error));
      }
      pendingRef.current.clear();
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);

    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      worker.terminate();
      for (const pending of pendingRef.current.values()) {
        pending.reject(new Error("XLSX worker đã bị hủy"));
      }
      pendingRef.current.clear();
      workerRef.current = null;
    };
  }, []);

  const postToWorker = useCallback((type, payload, transferables = []) => {
    const worker = workerRef.current;
    if (!worker) {
      return Promise.reject(new Error("Worker XLSX chưa sẵn sàng"));
    }
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    return new Promise((resolve, reject) => {
      pendingRef.current.set(requestId, { resolve, reject });
      try {
        worker.postMessage({ type, payload, requestId }, transferables);
      } catch (error) {
        pendingRef.current.delete(requestId);
        reject(error);
      }
    });
  }, []);

  const readWorkbook = useCallback(
    async (arrayBuffer, options = {}) => {
      if (!(arrayBuffer instanceof ArrayBuffer)) {
        throw new Error("readWorkbook yêu cầu ArrayBuffer hợp lệ");
      }
      if (!WORKER_SUPPORTED || !workerRef.current) {
        const XLSX = await import("xlsx");
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
        return { rows, sheetName, sheetNames: workbook.SheetNames };
      }
      return postToWorker(
        "read",
        { arrayBuffer, options },
        [arrayBuffer]
      );
    },
    [postToWorker]
  );

  const writeWorkbook = useCallback(
    async (rows, options = {}) => {
      if (!Array.isArray(rows)) {
        throw new Error("writeWorkbook yêu cầu dữ liệu dạng mảng");
      }
      if (!WORKER_SUPPORTED || !workerRef.current) {
        const XLSX = await import("xlsx");
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
        return {
          arrayBuffer,
          fileName: options.fileName || "export.xlsx",
          mimeType:
            options.mimeType ||
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        };
      }
      return postToWorker("write", { rows, options });
    },
    [postToWorker]
  );

  return { readWorkbook, writeWorkbook };
}
