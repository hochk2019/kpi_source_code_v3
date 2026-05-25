import { KPI_ADJUSTMENT_CATEGORY_CONFIG } from './kpiAdjustments.js';

const ADJUSTMENT_POINT_PRECISION = 2;
const ADJUSTMENT_POINT_FACTOR = 10 ** ADJUSTMENT_POINT_PRECISION;

const EXPORT_TYPES = new Set(['B11', 'B12', 'B13', 'E42', 'E52', 'E62', 'E82', 'G22', 'G23', 'G24', 'G61', 'H21']);
const IMPORT_TYPES = new Set(['E11', 'E13', 'E15', 'E21', 'E31', 'E41', 'A11', 'A12', 'A41', 'A42', 'G13', 'G12', 'G51', 'H11']);

const DEFAULT_ROSTER = Object.freeze({
  version: 1,
  teams: [
    {
      id: 'team-1',
      name: 'Team 1',
      members: [
        { id: 'team-1-phuong', name: 'Phương' },
        { id: 'team-1-hanh', name: 'Hạnh' },
        { id: 'team-1-bao', name: 'Bảo' },
        { id: 'team-1-ha-be', name: 'Hà Bé' },
        { id: 'team-1-huong', name: 'Hương' },
      ],
    },
    {
      id: 'team-2',
      name: 'Team 2',
      members: [
        { id: 'team-2-tuan', name: 'Tuấn' },
        { id: 'team-2-hoa', name: 'Hòa' },
        { id: 'team-2-thu', name: 'Thu' },
        { id: 'team-2-hang', name: 'Hằng' },
        { id: 'team-2-huyen', name: 'Huyền' },
      ],
    },
    {
      id: 'team-3',
      name: 'Team 3',
      members: [
        { id: 'team-3-hoc', name: 'Học' },
        { id: 'team-3-thanh', name: 'Thanh' },
        { id: 'team-3-huy', name: 'Huy' },
        { id: 'team-3-linh', name: 'Linh' },
        { id: 'team-3-thao', name: 'Thảo' },
        { id: 'team-3-hung', name: 'Hưng' },
      ],
    },
  ],
});

export { KPI_ADJUSTMENT_CATEGORY_CONFIG };

export function roundAdjustmentPoint(value, precision = ADJUSTMENT_POINT_PRECISION) {
  if (!Number.isFinite(value)) return value;
  const factor = precision === ADJUSTMENT_POINT_PRECISION ? ADJUSTMENT_POINT_FACTOR : 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function normalizeStr(s) {
  return (s ?? '').toString().replace(/\s+/g, ' ').trim();
}

function stripDiacritics(input) {
  return normalizeStr(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function normalizeName(name) {
  return stripDiacritics(name).toLowerCase();
}

export function toISODate(d, options = {}) {
  const { preferMonthFirst = false } = options;
  const s = normalizeStr(d);
  if (!s) return '';

  const pad = (value) => String(value).padStart(2, '0');
  const normalizeYear = (value) => {
    const num = Number.parseInt(value, 10);
    if (!Number.isFinite(num)) return '';
    if (value.length === 2) {
      return String(num >= 70 ? 1900 + num : 2000 + num);
    }
    return String(num).padStart(4, '0');
  };

  const tryFromParts = ({ year, month, day }) => {
    if (!year || !month || !day) return '';
    const y = normalizeYear(year);
    const m = Number.parseInt(month, 10);
    const dayNum = Number.parseInt(day, 10);
    if (!y || !Number.isFinite(m) || !Number.isFinite(dayNum)) return '';
    if (m < 1 || m > 12) return '';
    if (dayNum < 1 || dayNum > 31) return '';
    return `${y}-${pad(m)}-${pad(dayNum)}`;
  };

  const isoLike = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  if (isoLike) {
    const [, year, month, day] = isoLike;
    const monthVal = Number.parseInt(month, 10);
    const dayVal = Number.parseInt(day, 10);
    if (monthVal > 12 && dayVal >= 1 && dayVal <= 12) {
      return tryFromParts({ year, month: day, day: month });
    }
    return tryFromParts({ year, month, day });
  }

  const slashLike = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:[ T].*)?$/);
  if (!slashLike) return '';

  const [, first, second, year] = slashLike;
  const a = Number.parseInt(first, 10);
  const b = Number.parseInt(second, 10);
  const pickMonthDay = () => {
    if (a > 12 && b <= 12) {
      return { month: second, day: first };
    }
    if (b > 12 && a <= 12) {
      return { month: first, day: second };
    }
    if (preferMonthFirst) {
      return { month: first, day: second };
    }
    return { month: second, day: first };
  };

  const { month, day } = pickMonthDay();
  return tryFromParts({ year, month, day });
}

export function isExportByNumber(soTk) {
  const s = (soTk ?? '').toString().replace(/\D/g, '');
  return /^30\d{9,10}$/.test(s);
}

export function isImportByNumber(soTk) {
  const s = (soTk ?? '').toString().replace(/\D/g, '');
  return /^10\d{9,10}$/.test(s);
}

export function isExportByType(loaiHinh) {
  const t = normalizeStr(loaiHinh).toUpperCase();
  return EXPORT_TYPES.has(t);
}

export function isImportByType(loaiHinh) {
  const t = normalizeStr(loaiHinh).toUpperCase();
  return IMPORT_TYPES.has(t);
}

export function isExportDecl(soTk, loaiHinh) {
  if (isExportByNumber(soTk)) return true;
  if (isImportByNumber(soTk)) return false;
  if (isExportByType(loaiHinh)) return true;
  if (isImportByType(loaiHinh)) return false;
  return false;
}

function deepCloneRoster(roster) {
  return {
    version: roster?.version ?? 1,
    teams: Array.isArray(roster?.teams)
      ? roster.teams.map((team) => ({
          id: team.id,
          name: team.name,
          members: Array.isArray(team.members)
            ? team.members.map((member) => ({ id: member.id, name: member.name, notes: member.notes ?? '' }))
            : [],
        }))
      : [],
  };
}

function slugify(value, fallback = '') {
  const base = stripDiacritics(value) || fallback;
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback || 'item';
}

function sanitizeMember(member, teamId, usedMemberIds, index) {
  const name = normalizeStr(member?.name);
  if (!name) return null;

  let candidateId = normalizeStr(member?.id);
  const memberFallback = `nv-${index + 1}`;
  if (!candidateId) {
    candidateId = `${teamId}-${slugify(name, memberFallback)}`;
  }
  candidateId = slugify(candidateId, `${teamId}-nv-${index + 1}`);

  let suffix = 1;
  let finalId = candidateId;
  while (usedMemberIds.has(finalId)) {
    finalId = `${candidateId}-${suffix++}`;
  }
  usedMemberIds.add(finalId);

  const notes = normalizeStr(member?.notes);
  return notes ? { id: finalId, name, notes } : { id: finalId, name };
}

function sanitizeTeam(team, fallbackName, usedTeamIds, index) {
  const name = normalizeStr(team?.name) || fallbackName || `Team ${index + 1}`;

  let candidateId = normalizeStr(team?.id);
  if (!candidateId) {
    candidateId = `team-${slugify(name, String(index + 1))}`;
  }
  candidateId = slugify(candidateId, `team-${index + 1}`);
  if (!candidateId.startsWith('team-')) {
    candidateId = `team-${candidateId}`;
  }

  let suffix = 1;
  let finalId = candidateId;
  while (usedTeamIds.has(finalId)) {
    finalId = `${candidateId}-${suffix++}`;
  }
  usedTeamIds.add(finalId);

  const rawMembers = Array.isArray(team?.members) ? team.members : [];
  const usedMemberIds = new Set();
  const members = rawMembers
    .map((member, memberIndex) => sanitizeMember(member, finalId, usedMemberIds, memberIndex))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }));

  return { id: finalId, name, members };
}

function sanitizeRoster(data) {
  if (!data) {
    return deepCloneRoster(DEFAULT_ROSTER);
  }

  const teamsInput = Array.isArray(data.teams)
    ? data.teams
    : Array.isArray(data)
    ? data
    : [];

  if (!teamsInput.length) {
    return deepCloneRoster(DEFAULT_ROSTER);
  }

  const usedTeamIds = new Set();
  const teams = teamsInput
    .map((team, index) => sanitizeTeam(team, team?.name, usedTeamIds, index))
    .filter(Boolean);

  if (!teams.length) {
    return deepCloneRoster(DEFAULT_ROSTER);
  }

  return { version: 1, teams };
}

export function mapMemberNamesToTeams(source) {
  const roster = sanitizeRoster(
    Array.isArray(source?.teams) || Array.isArray(source)
      ? source
      : deepCloneRoster(DEFAULT_ROSTER),
  );

  const map = new Map();
  for (const team of roster.teams) {
    const teamName = normalizeStr(team?.name);
    if (!teamName) continue;
    for (const member of team.members || []) {
      const memberName = normalizeStr(member?.name);
      const key = normalizeName(memberName);
      if (!key || map.has(key)) continue;
      map.set(key, {
        team: teamName,
        name: memberName,
      });
    }
  }
  return map;
}
