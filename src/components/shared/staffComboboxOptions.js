import { normalizeName, normalizeStr } from "@/lib/storeCoreHelpers.js";

const collator = new Intl.Collator("vi", { sensitivity: "base" });

function sortByName(a, b) {
  return collator.compare(a.name, b.name);
}

export function buildStaffComboboxTeams(source) {
  const rawTeams = Array.isArray(source) ? source : Array.isArray(source?.teams) ? source.teams : [];
  const teams = [];

  rawTeams.forEach((team, teamIndex) => {
    const name = normalizeStr(team?.name ?? "");
    const normalized = normalizeName(name);
    if (!name || !normalized) {
      return;
    }

    const members = Array.isArray(team?.members) ? team.members : [];
    const normalizedMembers = members
      .map((member, memberIndex) => {
        const memberName = normalizeStr(member?.name ?? "");
        const memberNormalized = normalizeName(memberName);
        if (!memberName || !memberNormalized) {
          return null;
        }

        const memberId = normalizeStr(member?.id ?? "") || `${teamIndex}-${memberIndex}`;
        return {
          id: memberId,
          name: memberName,
          normalized: memberNormalized,
        };
      })
      .filter(Boolean)
      .sort(sortByName);

    teams.push({
      id: normalizeStr(team?.id ?? "") || `${teamIndex}`,
      name,
      normalized,
      members: normalizedMembers,
    });
  });

  return teams.sort(sortByName);
}

export function flattenStaffComboboxMembers(teams) {
  return buildStaffComboboxTeams(teams).flatMap((team) =>
    team.members.map((member) => ({
      id: member.id,
      name: member.name,
      teamId: team.id || null,
      teamName: team.name || null,
      normalizedName: member.normalized,
      normalizedTeam: team.normalized,
    })),
  );
}
