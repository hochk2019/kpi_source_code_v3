import { describe, expect, it, vi, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

import useDataImporterSelectionBulkActions from "@/components/dataImporter/useDataImporterSelectionBulkActions.js";

function createProps(overrides = {}) {
  return {
    deleteEnabled: true,
    selectionEnabled: true,
    selectedKeys: ["row-1"],
    selectedReviewedCount: 1,
    canReviewAlerts: true,
    rawRows: [
      {
        id: "row-1",
        date: "2026-03-11",
        so_tk_full: "102030",
        mst: "0101",
        cong_ty: "ACME",
        loai_hinh: "KD",
        nhan_vien: "Bình",
        team: "Team A",
        agency: "Đại lý A",
      },
    ],
    filteredKeys: ["row-1", "row-2"],
    filteredSelected: false,
    shouldUseServerSearch: false,
    canEdit: true,
    keyOfRow: (row) => row?.id ?? "",
    summarizeLicenseSnapshot: vi.fn(() => ({
      sourceCount: 2,
      includedCount: 1,
      includedCodes: ["A1"],
      excludedCodes: ["B2"],
    })),
    formatDisplayDate: vi.fn((value) => `fmt:${value}`),
    coLabel: vi.fn(() => "Có C/O"),
    coLineCount: vi.fn(() => 3),
    xlsx: {
      utils: {
        json_to_sheet: vi.fn(() => ({ name: "sheet" })),
        book_new: vi.fn(() => ({ sheets: [] })),
        book_append_sheet: vi.fn(),
      },
      writeFile: vi.fn(),
    },
    handleSelectFiltered: vi.fn(),
    handleMarkReviewed: vi.fn(),
    handleUnmarkReviewed: vi.fn(),
    handleDeleteSelected: vi.fn(),
    handleHardDeleteSelected: vi.fn(),
    handleApplyLicenseExclusion: vi.fn(),
    handleClearSelection: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useDataImporterSelectionBulkActions", () => {
  it("derives bulk-action capability flags from the current selection state", () => {
    const { result } = renderHook(() => useDataImporterSelectionBulkActions(createProps()));

    expect(result.current.canDelete).toBe(true);
    expect(result.current.canReview).toBe(true);
    expect(result.current.canUnreview).toBe(true);
    expect(result.current.selectionActionsProps.selectedCount).toBe(1);
    expect(result.current.selectionActionsProps.filteredKeysLength).toBe(2);
  });

  it("alerts instead of exporting when nothing is selected", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const props = createProps({ selectedKeys: [] });
    const { result } = renderHook(() => useDataImporterSelectionBulkActions(props));

    await act(async () => {
      await result.current.handleExportSelected();
    });

    expect(alertSpy).toHaveBeenCalledWith("Hãy chọn tờ khai trước khi xuất Excel.");
    expect(props.xlsx.writeFile).not.toHaveBeenCalled();
  });

  it("exports the selected rows through XLSX with normalized license and C/O fields", async () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterSelectionBulkActions(props));

    await act(async () => {
      await result.current.handleExportSelected();
    });

    expect(props.summarizeLicenseSnapshot).toHaveBeenCalledWith(props.rawRows[0]);
    expect(props.formatDisplayDate).toHaveBeenCalledWith("2026-03-11");
    expect(props.coLabel).toHaveBeenCalledWith(props.rawRows[0]);
    expect(props.coLineCount).toHaveBeenCalledWith(props.rawRows[0]);
    expect(props.xlsx.utils.json_to_sheet).toHaveBeenCalledWith([
      expect.objectContaining({
        "Ngày": "fmt:2026-03-11",
        "Số tờ khai": "102030",
        MST: "0101",
        "Công ty": "ACME",
        "Nhân viên": "Bình",
        "Tổ đội": "Team A",
        "Đại lý": "Đại lý A",
        "Số lượng GP gốc": 2,
        "Số lượng GP (sau loại trừ)": 1,
        "Mã giấy phép hợp lệ": "A1",
        "Mã giấy phép bị loại trừ": "B2",
        "C/O": "Có C/O",
        "Dòng C/O": 3,
      }),
    ]);
    expect(props.xlsx.utils.book_append_sheet).toHaveBeenCalled();
    expect(props.xlsx.writeFile).toHaveBeenCalledWith(expect.any(Object), expect.stringMatching(/^tokhai_da_chon_\d{4}-\d{2}-\d{2}\.xlsx$/));
  });
});
