import { useEffect, useMemo, useState } from "react";

import {
  getMSTMap,
  getTeamRoster,
  subscribeTeamRoster,
} from "@/lib/store.js";
import { buildStaffComboboxTeams } from "@/components/shared/staffComboboxOptions.js";
import { sortMSTRows } from "@/components/mst-assignment/model/displaySelectors.js";

// Stable fallback functions defined at module scope to prevent new references on every render.
const _defaultLogError = (...args) => console.error(...args);
const _defaultBuildRosterTeams = buildStaffComboboxTeams;
const _defaultLoadMstMap = getMSTMap;
const _defaultLoadTeamRoster = getTeamRoster;
const _defaultSortRows = sortMSTRows;
const _defaultSubscribeRoster = subscribeTeamRoster;

export default function useMSTAssignmentBootstrapWorkspace({
  createRowState,
  makeRowKey,
  setRows,
  setOriginalRows,
  deps = {},
}) {
  const {
    buildRosterTeams = _defaultBuildRosterTeams,
    loadMstMap = _defaultLoadMstMap,
    loadTeamRoster = _defaultLoadTeamRoster,
    logError = _defaultLogError,
    sortRows = _defaultSortRows,
    subscribeRoster = _defaultSubscribeRoster,
  } = deps;

  const [rosterSnapshot, setRosterSnapshot] = useState(() => loadTeamRoster());

  const rosterTeams = useMemo(() => buildRosterTeams(rosterSnapshot), [buildRosterTeams, rosterSnapshot]);

  useEffect(() => {
    const unsubscribe = subscribeRoster((next) => {
      setRosterSnapshot(next);
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [subscribeRoster]);

  useEffect(() => {
    try {
      const currentRows = loadMstMap() || [];
      const prepared = sortRows(currentRows).map((row) =>
        createRowState(row, { originalKey: makeRowKey(row), isNew: false })
      );

      setRows(prepared);
      setOriginalRows(prepared);
    } catch (error) {
      logError("getMSTMap error:", error);
    }
  }, [createRowState, loadMstMap, logError, makeRowKey, setOriginalRows, setRows, sortRows]);


  return {
    rosterSnapshot,
    rosterTeams,
  };
}
