import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAppDialog } from "@/hooks/useAppDialog";

import {
  ADMIN_ROLE,
  DEFAULT_ROLE,
  MANAGER_ROLE,
  TEAM_LEAD_ROLE,
  normalizeRoleKey,
} from "../../../packages/domain/src/accountRoles.js";

export default function useDataImporterEditAccess({
  currentUser,
  canEdit,
  rawRows,
  getTeamRoster,
  buildRosterTeams,
  mapMemberNamesToTeams,
  getHQAgencies,
  parseAgencyList,
  normalizeStr,
  normalizeName,
}) {
  const { alert } = useAppDialog();
  const normalizedRole = normalizeRoleKey(currentUser?.role);
  const isTeamLead = normalizedRole === TEAM_LEAD_ROLE;
  const isStaffRole = normalizedRole === DEFAULT_ROLE;
  const isAdminRole = normalizedRole === ADMIN_ROLE;
  const isManagerRole =
    normalizedRole === MANAGER_ROLE || normalizedRole === ADMIN_ROLE;
  const canAutoReconcile = isManagerRole;

  const rosterSnapshot = useMemo(() => getTeamRoster(), [getTeamRoster]);
  const rosterTeams = useMemo(
    () => buildRosterTeams(rosterSnapshot),
    [buildRosterTeams, rosterSnapshot],
  );

  const agencyOptions = useMemo(() => {
    const optionMap = new Map();
    const pushOption = (value, hint = "") => {
      const raw = normalizeStr(value);
      if (!raw) return;
      const key = normalizeName(raw);
      if (!key) return;
      const normalizedHint = normalizeStr(hint);
      const existing = optionMap.get(key);
      if (existing) {
        if (
          normalizedHint &&
          existing.hints.length < 3 &&
          !existing.hints.includes(normalizedHint)
        ) {
          existing.hints.push(normalizedHint);
        }
        return;
      }
      optionMap.set(key, {
        value: raw,
        label: raw,
        hints: normalizedHint ? [normalizedHint] : [],
      });
    };

    const hqRows = getHQAgencies();
    hqRows.forEach((row) => {
      if (!row) return;
      const hintParts = [];
      if (row.company) hintParts.push(row.company);
      if (row.mst) hintParts.push(row.mst);
      const hint = hintParts.filter(Boolean).join(" • ");
      if (Array.isArray(row.agents) && row.agents.length) {
        row.agents.forEach((agent) => pushOption(agent, hint));
      }
      if (row.agent) {
        pushOption(row.agent, hint);
      }
    });

    rawRows.forEach((row) => {
      if (!row || typeof row !== "object") return;
      const directValues = [row.agency, row.dai_ly, row.hq_agency];
      directValues.forEach((value) => pushOption(value));
      if (Array.isArray(row.agents)) {
        row.agents.forEach((value) => pushOption(value));
      }
      directValues.forEach((value) => {
        parseAgencyList(value).forEach((agent) => pushOption(agent));
      });
    });

    return Array.from(optionMap.values())
      .map((item) => ({
        value: item.value,
        label: item.label,
        hint: item.hints.slice(0, 3).join(" • "),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "vi", { sensitivity: "base" }));
  }, [getHQAgencies, normalizeName, normalizeStr, parseAgencyList, rawRows]);

  const memberTeamMap = useMemo(
    () => mapMemberNamesToTeams(rosterSnapshot),
    [mapMemberNamesToTeams, rosterSnapshot],
  );
  const staffDisplayName = normalizeStr(
    currentUser?.name || currentUser?.username || "",
  );
  const staffNameKey = normalizeName(staffDisplayName);
  const assignedTeam = staffNameKey
    ? memberTeamMap.get(staffNameKey)?.team || ""
    : "";
  const assignedTeamKey = normalizeName(assignedTeam);

  const editingRestrictionMessage = useMemo(() => {
    if (!canEdit) return "";
    if (isManagerRole) return "";
    if (isTeamLead) {
      return assignedTeam
        ? `Bạn chỉ có thể chỉnh sửa tờ khai thuộc tổ ${assignedTeam}.`
        : "Bạn chỉ có thể chỉnh sửa tờ khai thuộc tổ đội do mình phụ trách.";
    }
    if (isStaffRole) {
      if (assignedTeam) {
        return `Bạn chỉ có thể chỉnh sửa tờ khai thuộc tổ ${assignedTeam}.`;
      }
      return "Bạn chỉ có thể chỉnh sửa tờ khai đã gán cho tên của bạn.";
    }
    return "";
  }, [assignedTeam, canEdit, isManagerRole, isStaffRole, isTeamLead]);

  const teamChangeRestrictionMessage = useMemo(() => {
    if (!canEdit) return "";
    if (!isStaffRole) return "";
    if (!assignedTeam) {
      return "Bạn không thể gán tờ khai sang tổ đội khác.";
    }
    return `Bạn chỉ được gán tổ đội ${assignedTeam}.`;
  }, [assignedTeam, canEdit, isStaffRole]);

  const blockedEditNoticeRef = useRef(new Set());

  useEffect(() => {
    blockedEditNoticeRef.current.clear();
  }, [normalizedRole, assignedTeamKey, staffNameKey]);

  const isRowEditable = useCallback(
    (row) => {
      if (!canEdit) return false;
      if (!row || typeof row !== "object") return false;
      if (row.deleted_at) return false;
      if (row.reviewed && !isAdminRole) return false;
      if (isManagerRole) return true;

      const rowTeamKey = normalizeName(row.team);
      const rowStaffKey = normalizeName(row.nhan_vien);

      if (isTeamLead) {
        if (!assignedTeamKey) return false;
        if (rowTeamKey && rowTeamKey === assignedTeamKey) {
          return true;
        }
        if (rowStaffKey) {
          const rosterEntry = memberTeamMap.get(rowStaffKey);
          if (
            rosterEntry &&
            normalizeName(rosterEntry.team) === assignedTeamKey
          ) {
            return true;
          }
        }
        return false;
      }

      if (isStaffRole) {
        if (!assignedTeamKey) {
          return rowStaffKey && rowStaffKey === staffNameKey;
        }
        if (!rowTeamKey) {
          if (!rowStaffKey) return true;
          return rowStaffKey === staffNameKey;
        }
        return rowTeamKey === assignedTeamKey;
      }

      return true;
    },
    [
      assignedTeamKey,
      canEdit,
      isAdminRole,
      isManagerRole,
      isStaffRole,
      isTeamLead,
      memberTeamMap,
      normalizeName,
      staffNameKey,
    ],
  );

  const sanitizeRowUpdates = useCallback(
    async (_row, updates) => {
      if (!updates || typeof updates !== "object") return updates;
      if (!isStaffRole) return updates;
      if (!Object.prototype.hasOwnProperty.call(updates, "team")) {
        return updates;
      }

      const nextTeamRaw = updates.team ?? "";
      const nextTeamKey = normalizeName(nextTeamRaw);
      if (!assignedTeamKey) {
        return updates;
      }
      if (nextTeamKey && nextTeamKey !== assignedTeamKey) {
        if (teamChangeRestrictionMessage) {
          await alert(teamChangeRestrictionMessage);
        }
        return null;
      }
      return updates;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assignedTeamKey, isStaffRole, normalizeName, teamChangeRestrictionMessage],
  );

  return {
    agencyOptions,
    blockedEditNoticeRef,
    canAutoReconcile,
    editingRestrictionMessage,
    isAdminRole,
    isRowEditable,
    memberTeamMap,
    rosterTeams,
    sanitizeRowUpdates,
  };
}
