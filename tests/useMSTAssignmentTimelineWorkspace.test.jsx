import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import useMSTAssignmentTimelineWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentTimelineWorkspace.js";

function createGroupedStages() {
  return [
    {
      mst: "0312345678",
      company: "Công ty A",
      stages: [{ effective_from: "2025-03-01", effective_to: "", row: { mst: "0312345678" } }],
    },
    {
      mst: "",
      company: "Không rõ",
      stages: [{ effective_from: "2025-03-05", effective_to: "", row: { mst: "" } }],
    },
  ];
}

describe("useMSTAssignmentTimelineWorkspace", () => {
  it("builds timeline map and opens a focused dialog for a single group", () => {
    const groupedStages = createGroupedStages();

    const { result } = renderHook(() =>
      useMSTAssignmentTimelineWorkspace({
        groupedStages,
      })
    );

    expect(result.current.timelineGroupsByMST.get("0312345678")).toEqual(groupedStages[0]);
    expect(result.current.timelineGroupsByMST.get("__unknown")).toEqual(groupedStages[1]);

    act(() => {
      result.current.handleOpenTimelineGroup(groupedStages[0]);
    });

    expect(result.current.timelineDialogState).toMatchObject({
      open: true,
      title: "Dòng thời gian — 0312345678",
      subtitle: "Công ty: Công ty A",
      groups: [groupedStages[0]],
    });
  });

  it("opens and closes the aggregate timeline dialog", () => {
    const groupedStages = createGroupedStages();

    const { result } = renderHook(() =>
      useMSTAssignmentTimelineWorkspace({
        groupedStages,
      })
    );

    act(() => {
      result.current.handleOpenAllTimelines();
    });

    expect(result.current.timelineDialogState).toMatchObject({
      open: true,
      title: "Dòng thời gian giai đoạn",
      subtitle: "2 MST khớp bộ lọc hiện tại",
      groups: groupedStages,
    });

    act(() => {
      result.current.handleTimelineDialogOpenChange(false);
    });

    expect(result.current.timelineDialogState.open).toBe(false);
  });

  it("ignores empty aggregate opens and closes when dialog receives no valid group", () => {
    const { result } = renderHook(() =>
      useMSTAssignmentTimelineWorkspace({
        groupedStages: [],
      })
    );

    act(() => {
      result.current.handleOpenAllTimelines();
    });

    expect(result.current.timelineDialogState.open).toBe(false);

    act(() => {
      result.current.handleOpenTimelineGroup(null);
    });

    expect(result.current.timelineDialogState.open).toBe(false);
  });
});
