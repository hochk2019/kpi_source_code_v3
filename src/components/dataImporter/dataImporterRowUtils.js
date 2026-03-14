import { normalizeName, normalizeStr } from "@/lib/store.js";

const EDITABLE_FIELD_KEYS = [
  "nhan_vien",
  "team",
  "agency",
  "dai_ly",
  "licenses",
  "so_luong_gp",
  "licenseManualCount",
  "licenseCodes",
  "licenseSourceCodes",
  "licenseExcludedCodes",
];

function normalizeComparableValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return normalizeStr(value);
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : "";
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return JSON.stringify(value);
}

export function collectEditableDiff(baseline, current) {
  if (!baseline || typeof baseline !== "object") return null;
  if (!current || typeof current !== "object") return null;

  const diff = {};

  for (const field of EDITABLE_FIELD_KEYS) {
    const baseValue = Object.prototype.hasOwnProperty.call(baseline, field)
      ? baseline[field]
      : null;
    const currentHasField = Object.prototype.hasOwnProperty.call(current, field);
    const currentValue = currentHasField ? current[field] : null;

    if (normalizeComparableValue(baseValue) === normalizeComparableValue(currentValue)) {
      continue;
    }

    diff[field] = currentHasField ? currentValue : null;
  }

  return Object.keys(diff).length ? diff : null;
}

export function buildRosterTeams(rosterSnapshot) {
  const rawTeams = Array.isArray(rosterSnapshot?.teams) ? rosterSnapshot.teams : [];
  const teams = [];

  rawTeams.forEach((team, teamIndex) => {
    const name = normalizeStr(team?.name);
    const normalized = normalizeName(name);

    if (!name || !normalized) {
      return;
    }

    const members = Array.isArray(team?.members) ? team.members : [];
    const normalizedMembers = members
      .map((member, memberIndex) => {
        const memberName = normalizeStr(member?.name);
        const memberNormalized = normalizeName(memberName);

        if (!memberName || !memberNormalized) {
          return null;
        }

        return {
          id: member?.id || `${teamIndex}-${memberIndex}`,
          name: memberName,
          normalized: memberNormalized,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name, "vi", { sensitivity: "base" }));

    teams.push({
      id: team?.id || `${teamIndex}`,
      name,
      normalized,
      members: normalizedMembers,
    });
  });

  return teams.sort((a, b) => a.name.localeCompare(b.name, "vi", { sensitivity: "base" }));
}
