import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import useDataImporterRowPresentation from "@/components/dataImporter/useDataImporterRowPresentation.js";

function createHook(overrides = {}) {
  return renderHook(() =>
    useDataImporterRowPresentation({
      isReadOnlyForEdits: false,
      editingRestrictionMessage: "",
      reviewLockMessage: "Khoá review",
      isRowEditable: vi.fn(() => true),
      isRowReviewLocked: vi.fn(() => false),
      keyOfRow: vi.fn((row) => row.rowKey),
      normalizeStr: vi.fn((value) => String(value || "").trim()),
      rowDiffMap: new Map(),
      rowSaveStatus: {},
      rowHistoryEntries: {},
      rowHistoryExpanded: {},
      applyEdit: vi.fn(),
      coLineCount: vi.fn(() => 0),
      coLabel: vi.fn(() => ""),
      computeKPI: vi.fn(() => 8.5),
      rules: {},
      ...overrides,
    })
  );
}

describe("useDataImporterRowPresentation", () => {
  it("builds row state with deleted, diff, save, and history metadata", () => {
    const row = {
      rowKey: "row-1",
      deleted_at: "2026-03-11T09:00:00.000Z",
      deleted_by: "  Admin  ",
    };

    const { result } = createHook({
      isRowEditable: vi.fn(() => false),
      rowDiffMap: new Map([["row-1", { mst: "0101" }]]),
      rowSaveStatus: { "row-1": { saving: true, error: "Lỗi" } },
      rowHistoryEntries: { "row-1": [{ id: 1 }] },
      rowHistoryExpanded: { "row-1": true },
    });

    expect(result.current.buildRowState(row, 3)).toEqual(
      expect.objectContaining({
        index: 3,
        row,
        rowKey: "row-1",
        rowEditable: false,
        rowReadOnly: true,
        rowDeleted: true,
        rowDeletedAt: "2026-03-11T09:00:00.000Z",
        rowDeletedBy: "Admin",
        rowReadOnlyReason: "Đã xóa bởi Admin",
        rowDiff: { mst: "0101" },
        hasPendingDiff: true,
        canSaveRow: false,
        rowSaving: true,
        rowError: "Lỗi",
        historyList: [{ id: 1 }],
        historyExpanded: true,
        historyCount: 1,
      })
    );
  });

  it("normalizes manual license count edits before forwarding to applyEdit", () => {
    const applyEdit = vi.fn();
    const { result } = createHook({ applyEdit });

    result.current.handleCardLicenseCountChange("row-1", "");
    result.current.handleCardLicenseCountChange("row-1", "4.8");
    result.current.handleCardLicenseCountChange("row-1", "bad");

    expect(applyEdit).toHaveBeenCalledTimes(2);
    expect(applyEdit.mock.calls[0][0]).toBe("row-1");
    expect(applyEdit.mock.calls[0][1]({})).toEqual({
      licenses: "",
      so_luong_gp: "",
      licenseManualCount: null,
    });
    expect(applyEdit.mock.calls[1][0]).toBe("row-1");
    expect(applyEdit.mock.calls[1][1]({})).toEqual({
      licenses: 5,
      so_luong_gp: 5,
      licenseManualCount: 5,
    });
  });

  it("formats C/O and KPI values for card display", () => {
    const { result } = createHook({
      coLineCount: vi.fn(() => 2),
      coLabel: vi.fn(() => "Thiếu C/O"),
      computeKPI: vi.fn(() => Number.NaN),
    });

    expect(result.current.getCardCoDisplay({})).toBe("2");
    expect(result.current.getCardKpiDisplay({})).toBe("-");

    const second = createHook({
      coLineCount: vi.fn(() => 0),
      coLabel: vi.fn(() => "Thiếu C/O"),
      computeKPI: vi.fn(() => 9.16),
    });

    expect(second.result.current.getCardCoDisplay({})).toBe("Thiếu C/O");
    expect(second.result.current.getCardKpiDisplay({})).toBe("9.2");
  });
});
