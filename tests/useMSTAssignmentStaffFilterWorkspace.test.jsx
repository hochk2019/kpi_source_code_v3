import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import useMSTAssignmentStaffFilterWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentStaffFilterWorkspace.js";

describe("useMSTAssignmentStaffFilterWorkspace", () => {
  it("updates the selected staff filter and resets pagination for select, clear, and favorites", () => {
    const goToFirstPage = vi.fn();

    const { result } = renderHook(() =>
      useMSTAssignmentStaffFilterWorkspace({
        addQuickFavorite: vi.fn(() => ({ ok: true })),
        goToFirstPage,
      })
    );

    act(() => {
      result.current.handleStaffFilterSelect({ staffName: "Nguyen Van A" });
    });

    expect(result.current.staffFilter).toBe("Nguyen Van A");

    act(() => {
      result.current.applyStaffFavorite("Tran Thi B");
    });

    expect(result.current.staffFilter).toBe("Tran Thi B");

    act(() => {
      result.current.clearStaffFilter();
    });

    expect(result.current.staffFilter).toBe("");
    expect(goToFirstPage).toHaveBeenCalledTimes(3);
  });

  it("alerts when saving an empty staff filter", () => {
    const alertFn = vi.fn();
    const addQuickFavorite = vi.fn();

    const { result } = renderHook(() =>
      useMSTAssignmentStaffFilterWorkspace({
        addQuickFavorite,
        alertFn,
        goToFirstPage: vi.fn(),
      })
    );

    act(() => {
      result.current.handleSaveStaffFavorite();
    });

    expect(alertFn).toHaveBeenCalledWith("Nhập hoặc chọn nhân viên trước khi lưu bộ lọc.");
    expect(addQuickFavorite).not.toHaveBeenCalled();
  });

  it("saves staff favorites with duplicate and success messaging", () => {
    const alertFn = vi.fn();
    const addQuickFavorite = vi
      .fn()
      .mockReturnValueOnce({ ok: false, reason: "duplicate" })
      .mockReturnValueOnce({ ok: true });

    const { result } = renderHook(() =>
      useMSTAssignmentStaffFilterWorkspace({
        addQuickFavorite,
        alertFn,
        goToFirstPage: vi.fn(),
        initialStaffFilter: "Le Thi C",
      })
    );

    act(() => {
      result.current.handleSaveStaffFavorite();
    });

    expect(addQuickFavorite).toHaveBeenNthCalledWith(1, "staff", "Le Thi C");
    expect(alertFn).toHaveBeenCalledWith("Bộ lọc này đã nằm trong danh sách ưa thích.");

    act(() => {
      result.current.handleSaveStaffFavorite();
    });

    expect(addQuickFavorite).toHaveBeenNthCalledWith(2, "staff", "Le Thi C");
    expect(alertFn).toHaveBeenCalledWith("Đã lưu bộ lọc nhân viên.");
  });
});
