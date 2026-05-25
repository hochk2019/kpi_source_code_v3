import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useKpiAdjustmentSelection } from "@/components/kpi-adjustments/hooks/useKpiAdjustmentSelection.js";

describe("useKpiAdjustmentSelection", () => {
  it("toggles row selection and select-all for visible items", () => {
    const visibleItems = [
      { id: "adj-1", status: "pending" },
      { id: "adj-2", status: "pending" },
    ];

    const { result } = renderHook(() =>
      useKpiAdjustmentSelection({
        canSelect: true,
        visibleItems,
      })
    );

    act(() => {
      result.current.toggleSelection("adj-1", true);
    });

    expect(result.current.selectedIds).toEqual(["adj-1"]);
    expect(result.current.selectedCount).toBe(1);
    expect(result.current.allVisibleSelected).toBe(false);

    act(() => {
      result.current.toggleVisibleSelection(true);
    });

    expect(result.current.selectedIds).toEqual(expect.arrayContaining(["adj-1", "adj-2"]));
    expect(result.current.selectedCount).toBe(2);
    expect(result.current.allVisibleSelected).toBe(true);

    act(() => {
      result.current.toggleVisibleSelection(false);
    });

    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.selectedCount).toBe(0);
  });

  it("drops selections that are no longer visible after page changes", () => {
    const { result, rerender } = renderHook(
      ({ visibleItems }) =>
        useKpiAdjustmentSelection({
          canSelect: true,
          visibleItems,
        }),
      {
        initialProps: {
          visibleItems: [
            { id: "adj-1", status: "pending" },
            { id: "adj-2", status: "pending" },
          ],
        },
      }
    );

    act(() => {
      result.current.toggleVisibleSelection(true);
    });

    expect(result.current.selectedIds).toEqual(expect.arrayContaining(["adj-1", "adj-2"]));

    rerender({
      visibleItems: [{ id: "adj-2", status: "pending" }],
    });

    expect(result.current.selectedIds).toEqual(["adj-2"]);
    expect(result.current.selectedCount).toBe(1);

    rerender({
      visibleItems: [],
    });

    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.selectedCount).toBe(0);
  });
});
