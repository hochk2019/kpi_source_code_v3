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

    expect(alertFn).toHaveBeenCalledWith("Không có dữ liệu để xuất Excel.");
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

    const { result } = renderHook(() =>
      useMSTAssignmentExportWorkspace({
        rows: [...filteredRows, { mst: "0999999999", status: "pending" }],
        filteredRows,
        computeStatusDisplay,
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
      },
    ]);
    expect(xlsx.writeFile).toHaveBeenCalledWith(
      { workbook: true },
      "gan-mst-toan-bo-20260326_1510.xlsx"
    );
  });
});
