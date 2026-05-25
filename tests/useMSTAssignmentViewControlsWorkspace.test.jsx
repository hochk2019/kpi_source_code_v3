import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import useMSTAssignmentViewControlsWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentViewControlsWorkspace.js";

describe("useMSTAssignmentViewControlsWorkspace", () => {
  it("updates and clears the search query while resetting pagination", () => {
    const goToFirstPage = vi.fn();

    const { result } = renderHook(() =>
      useMSTAssignmentViewControlsWorkspace({
        goToFirstPage,
      })
    );

    act(() => {
      result.current.handleSearchChange("0312345678");
    });

    expect(result.current.search).toBe("0312345678");

    act(() => {
      result.current.handleClearSearch();
    });

    expect(result.current.search).toBe("");
    expect(goToFirstPage).toHaveBeenCalledTimes(2);
  });

  it("toggles group-by-MST mode and resets pagination", () => {
    const goToFirstPage = vi.fn();

    const { result } = renderHook(() =>
      useMSTAssignmentViewControlsWorkspace({
        goToFirstPage,
        initialGroupByMST: true,
      })
    );

    act(() => {
      result.current.handleGroupByMSTChange(false);
    });

    expect(result.current.groupByMST).toBe(false);
    expect(goToFirstPage).toHaveBeenCalledTimes(1);
  });

  it("tracks apply-from date without forcing a page reset", () => {
    const goToFirstPage = vi.fn();

    const { result } = renderHook(() =>
      useMSTAssignmentViewControlsWorkspace({
        goToFirstPage,
        initialApplyFrom: "2026-03-01",
      })
    );

    act(() => {
      result.current.handleApplyFromChange("2026-04-15");
    });

    expect(result.current.applyFrom).toBe("2026-04-15");
    expect(goToFirstPage).not.toHaveBeenCalled();
  });
});
