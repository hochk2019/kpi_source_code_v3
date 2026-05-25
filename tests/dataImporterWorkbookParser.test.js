import { describe, expect, it, vi } from "vitest";

import {
  createDataImporterWorkbookParser,
  parseDataImporterWorkbookSync,
} from "@/components/dataImporter/dataImporterWorkbookParser.js";

describe("dataImporterWorkbookParser", () => {
  it("parses workbook rows through a worker when available", async () => {
    const terminate = vi.fn();
    const postMessage = vi.fn(function postMessage() {
      setTimeout(() => {
        this.onmessage?.({
          data: {
            ok: true,
            sheetName: "ToKhai",
            rows: [{ so_tk: "TK-001", date: "2025-02-01" }],
          },
        });
      }, 0);
    });

    const WorkerCtor = vi.fn(function MockWorker() {
      this.onmessage = null;
      this.onerror = null;
      this.postMessage = postMessage;
      this.terminate = terminate;
    });

    const parseWorkbook = createDataImporterWorkbookParser({
      WorkerCtor,
      workerUrl: "mock-worker-url",
      xlsx: null,
    });

    await expect(parseWorkbook("array-buffer")).resolves.toEqual({
      sheetName: "ToKhai",
      rows: [{ so_tk: "TK-001", date: "2025-02-01" }],
    });

    expect(WorkerCtor).toHaveBeenCalledWith("mock-worker-url", { type: "module" });
    expect(postMessage).toHaveBeenCalledWith({ buffer: "array-buffer" });
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it("falls back to sync parsing when worker support is unavailable", async () => {
    const xlsx = {
      read: vi.fn(() => ({
        SheetNames: ["Sheet1"],
        Sheets: { Sheet1: { name: "mock" } },
      })),
      utils: {
        sheet_to_json: vi.fn(() => [{ so_tk: "TK-002", date: "2025-02-02" }]),
      },
    };

    const parseWorkbook = createDataImporterWorkbookParser({
      WorkerCtor: undefined,
      xlsx,
    });

    await expect(parseWorkbook("array-buffer")).resolves.toEqual({
      sheetName: "Sheet1",
      rows: [{ so_tk: "TK-002", date: "2025-02-02" }],
    });
    expect(xlsx.read).toHaveBeenCalledWith("array-buffer", { type: "array" });
  });

  it("falls back to sync parsing when the worker errors", async () => {
    const terminate = vi.fn();
    const xlsx = {
      read: vi.fn(() => ({
        SheetNames: ["SheetFallback"],
        Sheets: { SheetFallback: { name: "fallback" } },
      })),
      utils: {
        sheet_to_json: vi.fn(() => [{ so_tk: "TK-003", date: "2025-02-03" }]),
      },
    };

    const WorkerCtor = vi.fn(function MockWorker() {
      this.onmessage = null;
      this.onerror = null;
      this.postMessage = vi.fn(() => {
        setTimeout(() => {
          this.onerror?.(new Error("worker-failed"));
        }, 0);
      });
      this.terminate = terminate;
    });

    const parseWorkbook = createDataImporterWorkbookParser({
      WorkerCtor,
      workerUrl: "mock-worker-url",
      xlsx,
    });

    await expect(parseWorkbook("array-buffer")).resolves.toEqual({
      sheetName: "SheetFallback",
      rows: [{ so_tk: "TK-003", date: "2025-02-03" }],
    });
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(xlsx.read).toHaveBeenCalledTimes(1);
  });

  it("parses sync workbook rows and returns the first sheet name", () => {
    const xlsx = {
      read: vi.fn(() => ({
        SheetNames: ["Main"],
        Sheets: { Main: { name: "main" } },
      })),
      utils: {
        sheet_to_json: vi.fn(() => [{ so_tk: "TK-004", date: "2025-02-04" }]),
      },
    };

    expect(parseDataImporterWorkbookSync("array-buffer", { xlsx })).toEqual({
      sheetName: "Main",
      rows: [{ so_tk: "TK-004", date: "2025-02-04" }],
    });
  });
});
