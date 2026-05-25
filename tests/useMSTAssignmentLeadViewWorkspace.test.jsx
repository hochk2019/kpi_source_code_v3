import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import useMSTAssignmentLeadViewWorkspace, {
  LEAD_VIEW_STATUSES,
} from "@/components/mst-assignment/hooks/useMSTAssignmentLeadViewWorkspace.js";

describe("useMSTAssignmentLeadViewWorkspace", () => {
  it("starts disabled and promotes status or team changes into active lead-view filters", () => {
    const goToFirstPage = vi.fn();
    const { result } = renderHook(() =>
      useMSTAssignmentLeadViewWorkspace({
        goToFirstPage,
      }),
    );

    expect(result.current.leadViewEnabled).toBe(false);
    expect(result.current.leadViewStatus).toBe(LEAD_VIEW_STATUSES.ALL);
    expect(result.current.leadViewTeam).toBe("");
    expect(result.current.isLeadViewActive).toBe(false);

    act(() => {
      result.current.handleLeadViewStatusChange(LEAD_VIEW_STATUSES.PENDING);
    });

    expect(result.current.leadViewEnabled).toBe(true);
    expect(result.current.leadViewStatus).toBe(LEAD_VIEW_STATUSES.PENDING);
    expect(result.current.isLeadViewActive).toBe(true);

    act(() => {
      result.current.handleLeadViewTeamChange("Alpha");
    });

    expect(result.current.leadViewTeam).toBe("Alpha");
    expect(goToFirstPage).toHaveBeenCalledTimes(2);
  });

  it("resets compact filters when lead-view is turned off or cleared", () => {
    const { result } = renderHook(() =>
      useMSTAssignmentLeadViewWorkspace({
        initialFilter: {
          enabled: true,
          status: LEAD_VIEW_STATUSES.ASSIGNED,
          team: "Alpha",
        },
      }),
    );

    act(() => {
      result.current.handleLeadViewEnabledChange(false);
    });

    expect(result.current.leadViewFilter).toEqual({
      enabled: false,
      status: LEAD_VIEW_STATUSES.ALL,
      team: "",
    });

    act(() => {
      result.current.handleLeadViewEnabledChange(true);
      result.current.handleLeadViewTeamChange("Beta");
      result.current.resetLeadView();
    });

    expect(result.current.leadViewFilter).toEqual({
      enabled: false,
      status: LEAD_VIEW_STATUSES.ALL,
      team: "",
    });
  });
});
