import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import useMSTAssignmentPageResetWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentPageResetWorkspace.js";

describe("useMSTAssignmentPageResetWorkspace", () => {
  it("routes resets to the currently bound page setter", () => {
    const firstSetter = vi.fn();
    const secondSetter = vi.fn();

    const { result } = renderHook(() => useMSTAssignmentPageResetWorkspace());

    act(() => {
      result.current.bindPageSetter(firstSetter);
      result.current.goToFirstPage();
      result.current.bindPageSetter(secondSetter);
      result.current.goToFirstPage();
    });

    expect(firstSetter).toHaveBeenCalledTimes(1);
    expect(firstSetter).toHaveBeenCalledWith(1);
    expect(secondSetter).toHaveBeenCalledTimes(1);
    expect(secondSetter).toHaveBeenCalledWith(1);
  });

  it("ignores resets until a page setter is bound", () => {
    const { result } = renderHook(() => useMSTAssignmentPageResetWorkspace());

    expect(() => {
      act(() => {
        result.current.goToFirstPage();
      });
    }).not.toThrow();
  });
});
