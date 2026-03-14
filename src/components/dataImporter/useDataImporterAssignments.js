import { useCallback } from "react";

export default function useDataImporterAssignments({
  applyEdit,
  memberTeamMap,
  normalizeStr,
  normalizeName,
}) {
  const handleSelectStaff = useCallback(
    (rowKey, selection) => {
      if (!selection) return;
      const staffName = normalizeStr(selection.staffName);
      const normalizedStaffKey = normalizeName(staffName);
      const providedTeam = selection.teamName;

      applyEdit(rowKey, (row) => {
        const updates = {};
        const currentStaff = normalizeStr(row.nhan_vien);
        if (staffName !== currentStaff) {
          updates.nhan_vien = staffName;
        }

        let nextTeam = providedTeam !== undefined ? normalizeStr(providedTeam) : undefined;
        if (nextTeam === undefined && normalizedStaffKey) {
          const mapped = memberTeamMap.get(normalizedStaffKey);
          if (mapped?.team !== undefined) {
            nextTeam = normalizeStr(mapped.team);
          }
        }

        if (nextTeam !== undefined) {
          const currentTeam = normalizeStr(row.team);
          if (nextTeam !== currentTeam) {
            updates.team = nextTeam;
          }
        }

        return Object.keys(updates).length ? updates : null;
      });
    },
    [applyEdit, memberTeamMap, normalizeName, normalizeStr]
  );

  const handleSelectTeam = useCallback(
    (rowKey, teamName) => {
      const safeTeam = normalizeStr(teamName);
      applyEdit(rowKey, (row) => {
        const currentTeam = normalizeStr(row.team);
        if (safeTeam === currentTeam) {
          return null;
        }

        const updates = { team: safeTeam };
        const currentStaffInfo = row.nhan_vien ? memberTeamMap.get(normalizeName(row.nhan_vien)) : null;
        if (
          row.nhan_vien &&
          currentStaffInfo &&
          normalizeName(currentStaffInfo.team) !== normalizeName(safeTeam)
        ) {
          updates.nhan_vien = "";
        }

        return updates;
      });
    },
    [applyEdit, memberTeamMap, normalizeName, normalizeStr]
  );

  const handleSelectAgency = useCallback(
    (rowKey, agencyValue) => {
      const safeValue = normalizeStr(agencyValue);
      applyEdit(rowKey, (row) => {
        const updates = {};
        const currentAgency = normalizeStr(row.agency);
        const currentNote = normalizeStr(row.dai_ly);
        if (currentAgency !== safeValue || row.agency !== safeValue) {
          updates.agency = safeValue;
        }
        if (currentNote !== safeValue || row.dai_ly !== safeValue) {
          updates.dai_ly = safeValue;
        }
        return Object.keys(updates).length ? updates : null;
      });
    },
    [applyEdit, normalizeStr]
  );

  return {
    handleSelectStaff,
    handleSelectTeam,
    handleSelectAgency,
  };
}
