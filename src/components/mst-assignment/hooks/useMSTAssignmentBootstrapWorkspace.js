import { useEffect, useMemo, useState } from "react";

import {
  getMSTMap,
  getTeamRoster,
  subscribeTeamRoster,
} from "@/lib/store.js";
import { buildStaffComboboxTeams } from "@/components/shared/staffComboboxOptions.js";
import { sortMSTRows } from "@/components/mst-assignment/model/displaySelectors.js";

export default function useMSTAssignmentBootstrapWorkspace({
  createRowState,
  makeRowKey,
  setRows,
  setOriginalRows,
  deps = {},
}) {
  const {
    buildRosterTeams = buildStaffComboboxTeams,
    loadMstMap = getMSTMap,
    loadTeamRoster = getTeamRoster,
    logError = (...args) => console.error(...args),
    sortRows = sortMSTRows,
    subscribeRoster = subscribeTeamRoster,
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
