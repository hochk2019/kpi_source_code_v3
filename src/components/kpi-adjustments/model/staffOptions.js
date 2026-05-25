import { normalizeStr } from "@/lib/storeCoreHelpers.js";

export function buildStaffOptions(roster) {
  const options = [];

  if (!roster || !Array.isArray(roster.teams)) {
    return options;
  }

  for (const team of roster.teams) {
    if (!team?.name || !Array.isArray(team.members)) continue;

    for (const member of team.members) {
      const name = normalizeStr(member?.name);
      if (!name) continue;

      options.push({
        team: team.name,
        name,
      });
    }
  }

  return options;
}
