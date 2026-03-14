import { normalizeStr, slugify } from '../../legacy/legacy-normalizers.js';

export type TeamMember = {
  id: string;
  name: string;
  notes?: string;
};

export type TeamRecord = {
  id: string;
  name: string;
  members: TeamMember[];
};

export type TeamRoster = {
  version: 1;
  teams: TeamRecord[];
};

const EMPTY_ROSTER: TeamRoster = Object.freeze({
  version: 1,
  teams: [],
});

export function createEmptyTeamRoster(): TeamRoster {
  return structuredClone(EMPTY_ROSTER);
}

export function cloneTeamRoster(roster: TeamRoster): TeamRoster {
  return structuredClone(roster);
}

export function normalizeTeamRoster(input: unknown): TeamRoster {
  if (!input || typeof input !== 'object') {
    return createEmptyTeamRoster();
  }

  const teamsInput = Array.isArray((input as { teams?: unknown[] }).teams)
    ? (input as { teams: unknown[] }).teams
    : Array.isArray(input)
      ? input
      : [];

  if (!teamsInput.length) {
    return createEmptyTeamRoster();
  }

  const usedTeamIds = new Set<string>();
  const teams = teamsInput
    .map((team, index) => normalizeTeamRecord(team, usedTeamIds, index))
    .filter((team): team is TeamRecord => Boolean(team));

  return {
    version: 1,
    teams,
  };
}

function normalizeTeamRecord(
  input: unknown,
  usedTeamIds: Set<string>,
  index: number,
): TeamRecord | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const rawTeam = input as { id?: unknown; name?: unknown; members?: unknown[] };
  const name = normalizeStr(rawTeam.name) || `Team ${index + 1}`;
  const teamId = dedupeId(normalizeTeamId(rawTeam.id, name, index), usedTeamIds);
  const usedMemberIds = new Set<string>();
  const membersInput = Array.isArray(rawTeam.members) ? rawTeam.members : [];
  const members = membersInput
    .map((member, memberIndex) => normalizeTeamMember(member, teamId, usedMemberIds, memberIndex))
    .filter((member): member is TeamMember => Boolean(member))
    .sort((left, right) => left.name.localeCompare(right.name, 'vi', { sensitivity: 'base' }));

  return {
    id: teamId,
    name,
    members,
  };
}

function normalizeTeamMember(
  input: unknown,
  teamId: string,
  usedMemberIds: Set<string>,
  index: number,
): TeamMember | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const rawMember = input as { id?: unknown; name?: unknown; notes?: unknown };
  const name = normalizeStr(rawMember.name);
  if (!name) {
    return null;
  }

  const id = dedupeId(normalizeMemberId(rawMember.id, teamId, name, index), usedMemberIds);
  const notes = normalizeStr(rawMember.notes);

  if (notes) {
    return { id, name, notes };
  }

  return { id, name };
}

function normalizeTeamId(rawId: unknown, name: string, index: number): string {
  const source = normalizeStr(rawId) || `team-${slugify(name, String(index + 1))}`;
  const slug = slugify(source, `team-${index + 1}`);
  return slug.startsWith('team-') ? slug : `team-${slug}`;
}

function normalizeMemberId(rawId: unknown, teamId: string, name: string, index: number): string {
  const source = normalizeStr(rawId) || `${teamId}-${slugify(name, `member-${index + 1}`)}`;
  return slugify(source, `${teamId}-member-${index + 1}`);
}

function dedupeId(candidate: string, usedIds: Set<string>): string {
  let nextId = candidate;
  let suffix = 1;

  while (usedIds.has(nextId)) {
    nextId = `${candidate}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(nextId);
  return nextId;
}
