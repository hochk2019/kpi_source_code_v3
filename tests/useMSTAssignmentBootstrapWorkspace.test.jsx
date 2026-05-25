import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import useMSTAssignmentBootstrapWorkspace from "@/components/mst-assignment/hooks/useMSTAssignmentBootstrapWorkspace.js";

describe("useMSTAssignmentBootstrapWorkspace", () => {
  it("hydrates rows and original rows from the stored MST map", () => {
    const setRows = vi.fn();
    const setOriginalRows = vi.fn();
    const createRowState = vi.fn((row, meta) => ({
      ...row,
      __originalKey: meta.originalKey,
      __isNew: meta.isNew,
    }));
    const makeRowKey = vi.fn((row) => `${row.mst}::${row.company}`);
    const rows = [
      { mst: "02", company: "B" },
      { mst: "01", company: "A" },
    ];
    const sortedRows = [rows[1], rows[0]];

    renderHook(() =>
      useMSTAssignmentBootstrapWorkspace({
        createRowState,
        makeRowKey,
        setRows,
        setOriginalRows,
        deps: {
          buildRosterTeams: vi.fn(() => []),
          loadMstMap: () => rows,
          loadTeamRoster: () => [],
          sortRows: vi.fn(() => sortedRows),
          subscribeRoster: vi.fn(() => () => {}),
        },
      })
    );

    expect(createRowState).toHaveBeenNthCalledWith(1, sortedRows[0], {
      originalKey: "01::A",
      isNew: false,
    });
    expect(createRowState).toHaveBeenNthCalledWith(2, sortedRows[1], {
      originalKey: "02::B",
      isNew: false,
    });

    const preparedRows = [
      { mst: "01", company: "A", __originalKey: "01::A", __isNew: false },
      { mst: "02", company: "B", __originalKey: "02::B", __isNew: false },
    ];

    expect(setRows).toHaveBeenCalledWith(preparedRows);
    expect(setOriginalRows).toHaveBeenCalledWith(preparedRows);
  });

  it("subscribes to roster updates, derives roster teams, and cleans up on unmount", () => {
    const unsubscribe = vi.fn();
    const subscribeRoster = vi.fn((listener) => {
      listener([
        { team: "Alpha", staff: ["A"] },
        { team: "Beta", staff: ["B"] },
      ]);
      return unsubscribe;
    });
    const buildRosterTeams = vi.fn((snapshot) => snapshot.map((item) => item.team));

    const { result, unmount } = renderHook(() =>
      useMSTAssignmentBootstrapWorkspace({
        createRowState: vi.fn((row) => row),
        makeRowKey: vi.fn(() => "key"),
        setRows: vi.fn(),
        setOriginalRows: vi.fn(),
        deps: {
          buildRosterTeams,
          loadMstMap: () => [],
          loadTeamRoster: () => [{ team: "Seed", staff: [] }],
          subscribeRoster,
          sortRows: vi.fn((items) => items),
        },
      })
    );

    expect(result.current.rosterSnapshot).toEqual([
      { team: "Alpha", staff: ["A"] },
      { team: "Beta", staff: ["B"] },
    ]);
    expect(result.current.rosterTeams).toEqual(["Alpha", "Beta"]);
    expect(buildRosterTeams).toHaveBeenLastCalledWith([
      { team: "Alpha", staff: ["A"] },
      { team: "Beta", staff: ["B"] },
    ]);

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("logs hydrate failures instead of throwing", () => {
    const logError = vi.fn();

    renderHook(() =>
      useMSTAssignmentBootstrapWorkspace({
        createRowState: vi.fn(),
        makeRowKey: vi.fn(),
        setRows: vi.fn(),
        setOriginalRows: vi.fn(),
        deps: {
          buildRosterTeams: vi.fn(() => []),
          loadMstMap: () => {
            throw new Error("boom");
          },
          loadTeamRoster: () => [],
          logError,
          sortRows: vi.fn((items) => items),
          subscribeRoster: vi.fn(() => () => {}),
        },
      })
    );

    expect(logError).toHaveBeenCalled();
    expect(String(logError.mock.calls[0][0])).toContain("getMSTMap error:");
  });
});
