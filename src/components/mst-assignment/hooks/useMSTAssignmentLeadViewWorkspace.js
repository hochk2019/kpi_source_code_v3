import { useCallback, useMemo, useState } from "react";

export const LEAD_VIEW_STATUSES = Object.freeze({
  ALL: "all",
  ASSIGNED: "assigned",
  PENDING: "pending",
});

const DEFAULT_LEAD_VIEW_FILTER = Object.freeze({
  enabled: false,
  status: LEAD_VIEW_STATUSES.ALL,
  team: "",
});

export function normalizeLeadViewStatus(value) {
  if (value === LEAD_VIEW_STATUSES.ASSIGNED || value === LEAD_VIEW_STATUSES.PENDING) {
    return value;
  }

  return LEAD_VIEW_STATUSES.ALL;
}

export function createLeadViewFilterState(initialFilter = {}) {
  return {
    enabled: Boolean(initialFilter?.enabled),
    status: normalizeLeadViewStatus(initialFilter?.status),
    team: (initialFilter?.team || "").toString().trim(),
  };
}

export default function useMSTAssignmentLeadViewWorkspace({
  goToFirstPage,
  initialFilter = DEFAULT_LEAD_VIEW_FILTER,
}) {
  const [leadViewFilter, setLeadViewFilter] = useState(() =>
    createLeadViewFilterState(initialFilter),
  );

  const updateLeadViewFilter = useCallback(
    (updater) => {
      setLeadViewFilter((previous) => {
        const nextValue =
          typeof updater === "function" ? updater(previous) : updater;
        return createLeadViewFilterState(nextValue);
      });
      goToFirstPage?.();
    },
    [goToFirstPage],
  );

  const handleLeadViewEnabledChange = useCallback(
    (enabled) => {
      if (!enabled) {
        updateLeadViewFilter(DEFAULT_LEAD_VIEW_FILTER);
        return;
      }

      updateLeadViewFilter((previous) => ({
        ...previous,
        enabled: true,
      }));
    },
    [updateLeadViewFilter],
  );

  const handleLeadViewStatusChange = useCallback(
    (status) => {
      updateLeadViewFilter((previous) => ({
        ...previous,
        enabled: true,
        status: normalizeLeadViewStatus(status),
      }));
    },
    [updateLeadViewFilter],
  );

  const handleLeadViewTeamChange = useCallback(
    (team) => {
      updateLeadViewFilter((previous) => ({
        ...previous,
        enabled: true,
        team: (team || "").toString().trim(),
      }));
    },
    [updateLeadViewFilter],
  );

  const resetLeadView = useCallback(() => {
    updateLeadViewFilter(DEFAULT_LEAD_VIEW_FILTER);
  }, [updateLeadViewFilter]);

  const isLeadViewActive = useMemo(
    () =>
      leadViewFilter.enabled &&
      (leadViewFilter.status !== LEAD_VIEW_STATUSES.ALL || Boolean(leadViewFilter.team)),
    [leadViewFilter],
  );

  return {
    handleLeadViewEnabledChange,
    handleLeadViewStatusChange,
    handleLeadViewTeamChange,
    isLeadViewActive,
    leadViewEnabled: leadViewFilter.enabled,
    leadViewFilter,
    leadViewStatus: leadViewFilter.status,
    leadViewTeam: leadViewFilter.team,
    resetLeadView,
  };
}
