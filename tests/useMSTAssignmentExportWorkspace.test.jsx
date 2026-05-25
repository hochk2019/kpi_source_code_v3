import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import useMSTAssignmentExportWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentExportWorkspace.js";

function createXlsxDouble() {
  return {
    utils: {
      json_to_sheet: vi.fn(() => ({ worksheet: true })),
      book_new: vi.fn(() => ({ workbook: true })),
      book_append_sheet: vi.fn(),
    },
    writeFile: vi.fn(),
  };
}

describe("useMSTAssignmentExportWorkspace", () => {
  it("alerts and skips export when the selected scope has no rows", async () => {
    const alertFn = vi.fn();
    const xlsx = createXlsxDouble();

    const { result } = renderHook(() =>
      useMSTAssignmentExportWorkspace({
        rows: [],
        filteredRows: [],
        computeStatusDisplay: vi.fn(),
        alertFn,
        xlsx,
      })
    );

    await act(async () => {
      await result.current.exportRowsToExcel("filtered");
    });

    expect(alertFn).toHaveBeenCalledWith("Không có dữ liệu để xuất báo cáo.");
    expect(xlsx.utils.json_to_sheet).not.toHaveBeenCalled();
    expect(xlsx.writeFile).not.toHaveBeenCalled();
  });

  it("exports the filtered rows by default with normalized column data", async () => {
    const xlsx = createXlsxDouble();
    const computeStatusDisplay = vi.fn((item) => (item.mst === "0312345678" ? "Đang gán" : ""));

    const filteredRows = [
      {
        mst: "0312345678",
        company: "Công ty A",
        person_import: "An",
        person_export: "Bình",
        team: "Alpha",
        effective_from: "2025-03-01",
        effective_to: "",
        status: "assigned",
      },
    ];
    const historyEntries = [
      {
        rowKey: "0312345678__2025-03-01__",
        field: "person_import",
        actor: "lead.alpha",
        timestamp: "2026-03-26T07:00:00.000Z",
        type: "update",
      },
    ];

    const { result } = renderHook(() =>
      useMSTAssignmentExportWorkspace({
        rows: [...filteredRows, { mst: "0999999999", status: "pending" }],
        filteredRows,
        computeStatusDisplay,
        historyEntries,
        nowFn: () => new Date(2026, 2, 26, 15, 9),
        xlsx,
      })
    );

    await act(async () => {
      await result.current.exportRowsToExcel();
    });

    expect(xlsx.utils.json_to_sheet).toHaveBeenCalledWith([
      {
        STT: 1,
        MST: "0312345678",
        "Công ty": "Công ty A",
        "Người phụ trách Nhập": "An",
        "Người phụ trách Xuất": "Bình",
        "Tổ đội": "Alpha",
        "Áp dụng từ ngày": "2025-03-01",
        "Đến hết ngày": "",
        "Trạng thái": "Đang gán",
        "Người gán gần nhất": "lead.alpha",
        "Cập nhật gần nhất": "2026-03-26T07:00:00.000Z",
      },
    ]);
    expect(xlsx.utils.book_append_sheet).toHaveBeenCalledWith(
      { workbook: true },
      { worksheet: true },
      "Gan MST"
    );
    expect(xlsx.writeFile).toHaveBeenCalledWith({ workbook: true }, "gan-mst-loc-20260326_1509.xlsx");
  });

  it("exports the full rows collection when scope is all", async () => {
    const xlsx = createXlsxDouble();
    const rows = [
      { mst: "0312345678", company: "Công ty A", status: "assigned" },
      { mst: "0999999999", company: "Công ty B", status: "pending" },
    ];

    const { result } = renderHook(() =>
      useMSTAssignmentExportWorkspace({
        rows,
        filteredRows: [rows[0]],
        computeStatusDisplay: vi.fn(() => ""),
        nowFn: () => new Date(2026, 2, 26, 15, 10),
        xlsx,
      })
    );

    await act(async () => {
      await result.current.exportRowsToExcel("all");
    });

    expect(xlsx.utils.json_to_sheet).toHaveBeenCalledWith([
      {
        STT: 1,
        MST: "0312345678",
        "Công ty": "Công ty A",
        "Người phụ trách Nhập": "",
        "Người phụ trách Xuất": "",
        "Tổ đội": "",
        "Áp dụng từ ngày": "",
        "Đến hết ngày": "",
        "Trạng thái": "assigned",
        "Người gán gần nhất": "",
        "Cập nhật gần nhất": "",
      },
      {
        STT: 2,
        MST: "0999999999",
        "Công ty": "Công ty B",
        "Người phụ trách Nhập": "",
        "Người phụ trách Xuất": "",
        "Tổ đội": "",
        "Áp dụng từ ngày": "",
        "Đến hết ngày": "",
        "Trạng thái": "pending",
        "Người gán gần nhất": "",
        "Cập nhật gần nhất": "",
      },
    ]);
    expect(xlsx.writeFile).toHaveBeenCalledWith(
      { workbook: true },
      "gan-mst-toan-bo-20260326_1510.xlsx"
    );
  });

  it("exports csv with the same metadata-rich dataset", async () => {
    const xlsx = createXlsxDouble();
    const rows = [
      {
        mst: "0312345678",
        company: "Công ty A",
        person_import: "An",
        effective_from: "2025-03-01",
        status: "assigned",
      },
    ];
    const historyEntries = [
      {
        rowKey: "0312345678__2025-03-01__",
        field: "effective_from",
        actor: "ops.supervisor",
        timestamp: "2026-03-26T09:00:00.000Z",
        type: "update",
      },
    ];

    const { result } = renderHook(() =>
      useMSTAssignmentExportWorkspace({
        rows,
        filteredRows: rows,
        historyEntries,
        computeStatusDisplay: vi.fn(() => "Đã gán"),
        nowFn: () => new Date(2026, 2, 26, 15, 11),
        xlsx,
      })
    );

    await act(async () => {
      await result.current.exportRowsToCsv("filtered");
    });

    expect(xlsx.utils.json_to_sheet).toHaveBeenCalledWith([
      {
        STT: 1,
        MST: "0312345678",
        "Công ty": "Công ty A",
        "Người phụ trách Nhập": "An",
        "Người phụ trách Xuất": "",
        "Tổ đội": "",
        "Áp dụng từ ngày": "2025-03-01",
        "Đến hết ngày": "",
        "Trạng thái": "Đã gán",
        "Người gán gần nhất": "ops.supervisor",
        "Cập nhật gần nhất": "2026-03-26T09:00:00.000Z",
      },
    ]);
    expect(xlsx.writeFile).toHaveBeenCalledWith(
      { workbook: true },
      "gan-mst-loc-20260326_1511.csv",
      { bookType: "csv" }
    );
  });
});
