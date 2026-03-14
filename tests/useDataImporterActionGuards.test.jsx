import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import useDataImporterActionGuards from "@/components/dataImporter/useDataImporterActionGuards.js";

function createProps(overrides = {}) {
  return {
    rawRows: [
      { id: "editable", reviewed: false, editable: true },
      { id: "review-locked", reviewed: true, editable: false },
      { id: "blocked", reviewed: false, editable: false },
      { id: "deleted-editable", reviewed: false, editable: true, deleted_at: "2026-03-11T00:00:00.000Z" },
    ],
    keyOfRow: (row) => row?.id ?? "",
    isRowEditable: (row) => !!row?.editable,
    isRowReviewLocked: (row) => !!row?.reviewed,
    editingRestrictionMessage: "Ban khong duoc sua cac to khai nay.",
    reviewLockMessage: "Chi quan tri vien moi duoc sua hoac xoa.",
    showAlert: vi.fn(),
    ...overrides,
  };
}

describe("useDataImporterActionGuards", () => {
  it("returns allowed editable keys and warns when reviewed rows are skipped", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterActionGuards(props));

    expect(result.current.ensureEditableKeys(["editable", "review-locked", "blocked"], "cap nhat")).toEqual([
      "editable",
    ]);
    expect(props.showAlert).toHaveBeenCalledWith(
      "Da bo qua 1 to khai da duoc ra soat (khong the cap nhat)."
    );
  });

  it("returns null and shows the review-lock message when nothing can be edited", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterActionGuards(props));

    expect(result.current.ensureEditableKeys(["review-locked"], "xoa")).toBeNull();
    expect(props.showAlert).toHaveBeenCalledWith(
      "Khong the xoa 1 to khai da duoc ra soat. Chi quan tri vien moi duoc sua hoac xoa."
    );
  });

  it("allows hard delete for a soft-deleted row when the restored shape is editable", () => {
    const props = createProps();
    const { result } = renderHook(() => useDataImporterActionGuards(props));

    expect(result.current.canHardDeleteRow(props.rawRows[3])).toBe(true);
    expect(result.current.ensureHardDeleteKeys(["deleted-editable"], "xoa vinh vien")).toEqual([
      "deleted-editable",
    ]);
    expect(props.showAlert).not.toHaveBeenCalled();
  });
});
