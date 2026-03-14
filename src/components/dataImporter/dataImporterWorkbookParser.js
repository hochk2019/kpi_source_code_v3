import * as XLSX from "xlsx";

function normalizeWorkerResult(data) {
  return {
    sheetName: data?.sheetName || "",
    rows: Array.isArray(data?.rows) ? data.rows : [],
  };
}

export function parseDataImporterWorkbookSync(buffer, { xlsx = XLSX } = {}) {
  const workbook = xlsx.read(buffer, { type: "array" });
  const sheetName = workbook?.SheetNames?.[0] || "";
  const sheet = sheetName ? workbook?.Sheets?.[sheetName] : null;
  const rows = sheet ? xlsx.utils.sheet_to_json(sheet, { raw: false, defval: "" }) : [];
  return {
    sheetName,
    rows: Array.isArray(rows) ? rows : [],
  };
}

function parseDataImporterWorkbookInWorker(buffer, { WorkerCtor, workerUrl }) {
  return new Promise((resolve, reject) => {
    const worker = new WorkerCtor(workerUrl, { type: "module" });
    let settled = false;

    const cleanup = () => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate?.();
    };

    worker.onmessage = (event) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();

      const data = event?.data;
      if (data?.ok === false) {
        reject(new Error(data.error || "Không thể đọc workbook trong worker."));
        return;
      }

      resolve(normalizeWorkerResult(data));
    };

    worker.onerror = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error("Workbook worker failed."));
    };

    try {
      worker.postMessage({ buffer });
    } catch (error) {
      if (!settled) {
        settled = true;
        cleanup();
        reject(error);
      }
    }
  });
}

export function createDataImporterWorkbookParser({
  WorkerCtor = typeof Worker === "function" ? Worker : undefined,
  workerUrl = new URL("./dataImporterWorkbook.worker.js", import.meta.url),
  xlsx = XLSX,
} = {}) {
  const parseSync = (buffer) => Promise.resolve(parseDataImporterWorkbookSync(buffer, { xlsx }));

  if (typeof WorkerCtor !== "function") {
    return parseSync;
  }

  return async function parseDataImporterWorkbook(buffer) {
    try {
      return await parseDataImporterWorkbookInWorker(buffer, { WorkerCtor, workerUrl });
    } catch {
      return parseSync(buffer);
    }
  };
}

export function parseDataImporterWorkbook(buffer, options = {}) {
  return createDataImporterWorkbookParser(options)(buffer);
}
