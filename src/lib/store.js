// src/lib/store.js

import { createDefaultRuleCollection } from '@/shared/defaultRules.js';
import { getItem, setItem } from './storageClient.js';

// ===== Keys trong kho chia sáº» =====
export const DECL_KEY  = "decl_rows_v1";      // dá»¯ liá»‡u tá» khai
export const MST_KEY   = "mst_rows_v2";       // gÃ¡n MST -> nhÃ¢n viÃªn/team/effective_from
export const RULES_KEY = "kpi_rules_v2";      // quy táº¯c KPI
export const TEAM_KEY  = "team_roster_v1";    // danh sÃ¡ch tá»• Ä‘á»™i & thÃ nh viÃªn
export const AUDIT_KEY = "audit_logs_v1";     // nháº­t kÃ½ hÃ nh Ä‘á»™ng quáº£n trá»‹
export const HQ_KEY    = "hq_agencies_v1";    // cáº¥u hÃ¬nh Äáº¡i lÃ½ háº£i quan theo MST

// ===== Helpers =====
function safeParse(json, fallback) {
  try { const v = JSON.parse(json); return v ?? fallback; } catch { return fallback; }
}

function shallowClone(obj) {
  return JSON.parse(JSON.stringify(obj ?? null));
}

// Chuáº©n hoÃ¡ chuá»—i (trim + bá» khoáº£ng tráº¯ng thá»«a)
export function normalizeStr(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}

function stripDiacritics(input) {
  return normalizeStr(input)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function normalizeName(name) {
  return stripDiacritics(name).toLowerCase();
}

// MST: giá»¯ dáº¡ng chuá»—i sá»‘, bá» má»i kÃ½ tá»± khÃ´ng pháº£i sá»‘
export function normalizeMST(mst) {
  return (mst ?? "").toString().replace(/\D/g, "");
}

export function normalizeDeclarationNumber(input, length = 11) {
  const raw = (input ?? "").toString();
  if (!raw.trim()) return "";
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  const maxLength = Number.isFinite(length) && length > 0 ? length : 11;
  if (digits.length >= maxLength) {
    return digits.slice(0, maxLength);
  }
  return digits.padStart(maxLength, "0");
}

function normalizeDeclarationRow(row) {
  if (!row || typeof row !== "object") return null;
  const clone = { ...row };
  const sourceNumber = (row.so_tk_full ?? row.so_tk ?? "").toString();
  const normalized = normalizeDeclarationNumber(sourceNumber || row.so_tk);
  clone.so_tk = normalized;
  if (sourceNumber) {
    clone.so_tk_full = sourceNumber;
    const suffix = normalized ? sourceNumber.slice(normalized.length) : sourceNumber;
    clone.so_tk_suffix = suffix || "";
  }
  if (!clone.nhanh && clone.branch) {
    clone.nhanh = clone.branch;
  }
  return clone;
}

function getDeclarationKey(row) {
  if (!row || typeof row !== "object") return "";
  const soTk = normalizeDeclarationNumber(row.so_tk ?? row.so_tk_full ?? "");
  if (!soTk) return "";
  const branch = normalizeStr(row.nhanh || row.branch || "");
  return `${soTk}_${branch}`;
}

function mergeDeclarationRowClient(existing, incoming) {
  if (!existing) return incoming;
  const merged = { ...existing };
  const skipFields = new Set(['nhan_vien', 'team', 'agency', 'dai_ly', 'licenses', 'so_luong_gp', 'reviewed', 'reviewed_at']);
  for (const [key, value] of Object.entries(incoming)) {
    if (skipFields.has(key)) continue;
    if (key === 'co_line_count') {
      const parsed = Number(value);
      merged[key] = Number.isFinite(parsed) ? parsed : merged[key];
      continue;
    }
    if (key === 'co') {
      merged[key] = normalizeStr(value || '');
      continue;
    }
    if (key === 'has_co') {
      merged[key] = !!value;
      continue;
    }
    if (key === 'co_codes' || key === 'licenseCodes') {
      merged[key] = Array.isArray(value) ? value.map((item) => normalizeStr(item)).filter(Boolean) : [];
      continue;
    }
    merged[key] = value;
  }
  const fillIfBlank = (field) => {
    const current = normalizeStr(merged[field] || '');
    const incomingValue = normalizeStr(incoming[field] || '');
    if (!current && incomingValue) {
      merged[field] = incoming[field];
    }
  };
  fillIfBlank('nhan_vien');
  fillIfBlank('team');
  fillIfBlank('agency');
  fillIfBlank('dai_ly');

  const fillNumeric = (field) => {
    if (!Object.prototype.hasOwnProperty.call(incoming, field)) return;
    const parsed = Number(incoming[field]);
    if (Number.isFinite(parsed)) {
      merged[field] = parsed;
    }
  };
  fillNumeric('licenses');
  fillNumeric('so_luong_gp');
  return merged;
}

// dd/mm/yyyy -> yyyy-mm-dd ; náº¿u Ä‘Ã£ yyyy-mm-dd thÃ¬ giá»¯ nguyÃªn
export function toISODate(d, options = {}) {
  const { preferMonthFirst = false } = options;
  const s = normalizeStr(d);
  if (!s) return "";

  const pad = (value) => String(value).padStart(2, "0");
  const normalizeYear = (value) => {
    const num = Number.parseInt(value, 10);
    if (!Number.isFinite(num)) return "";
    if (value.length === 2) {
      return String(num >= 70 ? 1900 + num : 2000 + num);
    }
    return String(num).padStart(4, "0");
  };

  const tryFromParts = ({ year, month, day }) => {
    if (!year || !month || !day) return "";
    const y = normalizeYear(year);
    const m = Number.parseInt(month, 10);
    const dNum = Number.parseInt(day, 10);
    if (!y || !Number.isFinite(m) || !Number.isFinite(dNum)) return "";
    if (m < 1 || m > 12) return "";
    if (dNum < 1 || dNum > 31) return "";
    return `${y}-${pad(m)}-${pad(dNum)}`;
  };

  const isoLike = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  if (isoLike) {
    let [, y, m, dNum] = isoLike;
    const monthVal = Number.parseInt(m, 10);
    const dayVal = Number.parseInt(dNum, 10);
    if (monthVal > 12 && dayVal >= 1 && dayVal <= 12) {
      return tryFromParts({ year: y, month: dNum, day: m });
    }
    return tryFromParts({ year: y, month: m, day: dNum });
  }

  const slashLike = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:[ T].*)?$/);
  if (!slashLike) return "";

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

// ===== Quy táº¯c xÃ¡c Ä‘á»‹nh Nháº­p/Xuáº¥t =====
// 30xxxxxxxxxxx -> xuáº¥t; 10xxxxxxxxxxx -> nháº­p
export function isExportByNumber(soTk) {
  const s = (soTk ?? "").toString().replace(/\D/g,"");
  return /^30\\d{9,10}$/.test(s);
}
export function isImportByNumber(soTk) {
  const s = (soTk ?? "").toString().replace(/\D/g,"");
  return /^10\\d{9,10}$/.test(s);
}
// fallback theo loáº¡i hÃ¬nh
const EXPORT_TYPES = new Set(["B11","B12","B13","E42","E52","E62","E82","G22","G23","G24","G61","H21"]);
const IMPORT_TYPES = new Set(["E11","E13","E15","E21","E31","E41","A11","A12","A41","A42","G13","G12","G51","H11"]);
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
  return false; // khÃ´ng rÃµ thÃ¬ coi lÃ  nháº­p
}

// ===== MST map (gÃ¡n nhÃ¢n viÃªn theo ngÃ y hiá»‡u lá»±c) =====
export function getMSTRowsRaw() {
  return safeParse(getItem(MST_KEY), []);
}

function sanitizeMSTRow(row) {
  const mst = normalizeMST(row?.mst);
  if (!mst) return null;

  return {
    mst,
    company: normalizeStr(row?.company ?? ""),
    person_import: normalizeStr(row?.person_import ?? ""),
    person_export: normalizeStr(row?.person_export ?? ""),
    team: normalizeStr(row?.team ?? ""),
    effective_from: toISODate(row?.effective_from) || "",
  };
}

/** Láº¥y toÃ n bá»™ báº£ng gÃ¡n MST, Ä‘Ã£ chuáº©n hoÃ¡ + sáº¯p xáº¿p */
export function getMSTMap() {
  const raw = getMSTRowsRaw();
  const rows = Array.isArray(raw) ? raw : [];
  return rows
    .map(sanitizeMSTRow)
    .filter(Boolean)
    .sort((a, b) => {
      const byMST = a.mst.localeCompare(b.mst);
      if (byMST !== 0) return byMST;
      return (a.effective_from || "").localeCompare(b.effective_from || "");
    });
}

/** Ghi Ä‘Ã¨/bá»• sung báº£ng gÃ¡n MST (Ä‘Ã£ chuáº©n hoÃ¡ dá»¯ liá»‡u Ä‘áº§u vÃ o) */
export function upsertMSTRows(rows, { actor = "system", detail = "" } = {}) {
  const sanitized = Array.isArray(rows)
    ? rows.map(sanitizeMSTRow).filter(Boolean)
    : [];
  sanitized.sort((a, b) => {
    const byMST = a.mst.localeCompare(b.mst);
    if (byMST !== 0) return byMST;
    return (a.effective_from || "").localeCompare(b.effective_from || "");
  });
  setItem(MST_KEY, JSON.stringify(sanitized));
  pushAuditLog({
    actor,
    action: "mst.save",
    detail: detail || `Cáº­p nháº­t ${sanitized.length} dÃ²ng gÃ¡n MST`,
  });
  return sanitized.length;
}

/** Láº¥y ngÆ°á»i phá»¥ trÃ¡ch theo MST & ngÃ y hiá»‡u lá»±c gáº§n nháº¥t (<= ngÃ y tá» khai) */
export function getMSTFor(mst, isoDate) {
  const rows = getMSTMap().filter(r => normalizeMST(r.mst) === normalizeMST(mst));
  if (rows.length === 0) return null;

  const dateVal = isoDate ? new Date(isoDate).getTime() : Number.POSITIVE_INFINITY;

  // Xáº¿p theo hiá»‡u lá»±c gáº§n nháº¥t vá»›i ngÃ y TK
  const picked = rows
    .map(r => {
      const ef = r.effective_from || "0001-01-01";
      const ts = new Date(ef).getTime();
      const rank = ts <= dateVal ? (dateVal - ts) : Number.POSITIVE_INFINITY - ts;
      return { r, rank };
    })
    .sort((a,b) => a.rank - b.rank)[0];

  return picked?.r ?? rows[0];
}

// ===== DECL rows (tá» khai) =====
function normalizeDeclRows(rows) {
  const input = Array.isArray(rows) ? rows : [];
  const map = new Map();
  const extras = [];
  for (const entry of input) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const normalized = normalizeDeclarationRow(entry) || entry;
    const key = getDeclarationKey(normalized);
    if (!key) {
      extras.push(normalized);
      continue;
    }
    const existing = map.get(key);
    if (!existing) {
      map.set(key, normalized);
    } else {
      map.set(key, mergeDeclarationRowClient(existing, normalized));
    }
  }
  return extras.concat(Array.from(map.values()));
}

function getDeclRowsRaw() {
  const stored = safeParse(getItem(DECL_KEY), []);
  const normalized = normalizeDeclRows(stored);
  setItem(DECL_KEY, JSON.stringify(normalized));
  return normalized;
}

function writeDeclRows(rows) {
  const normalized = normalizeDeclRows(rows);
  setItem(DECL_KEY, JSON.stringify(normalized));
  return normalized;
}

export function getDeclRows() {
  const rows = getDeclRowsRaw();
  return applyAgenciesToDeclRows(rows);
}

export function sortDeclRows(rows) {
  const arr = Array.isArray(rows) ? rows : [];
  const parseTime = (value) => {
    if (!value) return 0;
    const ts = Date.parse(value);
    return Number.isFinite(ts) ? ts : 0;
  };

  return arr
    .map((row, idx) => ({ row, idx, ts: parseTime(row?.date) }))
    .sort((a, b) => {
      if (a.ts !== b.ts) return b.ts - a.ts; // má»›i nháº¥t trÆ°á»›c

      const soA = (a.row?.so_tk ?? "").toString();
      const soB = (b.row?.so_tk ?? "").toString();
      if (soA !== soB) {
        const cmp = soB.localeCompare(soA, undefined, { numeric: true, sensitivity: "base" });
        if (cmp !== 0) return cmp;
      }

      const nhanhA = (a.row?.nhanh ?? "").toString();
      const nhanhB = (b.row?.nhanh ?? "").toString();
      if (nhanhA !== nhanhB) {
        const cmpNhanh = nhanhB.localeCompare(nhanhA, undefined, { numeric: true, sensitivity: "base" });
        if (cmpNhanh !== 0) return cmpNhanh;
      }

      return b.idx - a.idx; // giá»¯ thá»© tá»± chÃ¨n gáº§n nháº¥t
    })
    .map(item => item.row);
}

export function getRecentDeclRows(limit = 20) {
  const sorted = sortDeclRows(getDeclRows());
  if (!Number.isFinite(limit) || limit <= 0) return sorted;
  return sorted.slice(0, limit);
}

// ===== Team roster (tá»• Ä‘á»™i) =====

const DEFAULT_ROSTER = Object.freeze({
  version: 1,
  teams: [
    {
      id: "team-1",
      name: "Team 1",
      members: [
        { id: "team-1-phuong", name: "PhÆ°Æ¡ng" },
        { id: "team-1-hanh", name: "Háº¡nh" },
        { id: "team-1-bao", name: "Báº£o" },
        { id: "team-1-ha-be", name: "HÃ  BÃ©" },
        { id: "team-1-huong", name: "HÆ°Æ¡ng" },
      ],
    },
    {
      id: "team-2",
      name: "Team 2",
      members: [
        { id: "team-2-tuan", name: "Tuáº¥n" },
        { id: "team-2-hoa", name: "HÃ²a" },
        { id: "team-2-thu", name: "Thu" },
        { id: "team-2-hang", name: "Háº±ng" },
        { id: "team-2-huyen", name: "Huyá»n" },
      ],
    },
    {
      id: "team-3",
      name: "Team 3",
      members: [
        { id: "team-3-hoc", name: "Há»c" },
        { id: "team-3-thanh", name: "Thanh" },
        { id: "team-3-huy", name: "Huy" },
        { id: "team-3-linh", name: "Linh" },
        { id: "team-3-thao", name: "Tháº£o" },
        { id: "team-3-hung", name: "HÆ°ng" },
      ],
    },
  ],
});

function deepCloneRoster(roster) {
  return {
    version: roster?.version ?? 1,
    teams: Array.isArray(roster?.teams)
      ? roster.teams.map((team) => ({
          id: team.id,
          name: team.name,
          members: Array.isArray(team.members)
            ? team.members.map((m) => ({ id: m.id, name: m.name, notes: m.notes ?? "" }))
            : [],
        }))
      : [],
  };
}

function slugify(value, fallback = "") {
  const base = stripDiacritics(value) || fallback;
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback || "item";
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

  return notes
    ? { id: finalId, name, notes }
    : { id: finalId, name };
}

function sanitizeTeam(team, fallbackName, usedTeamIds, index) {
  const name = normalizeStr(team?.name) || fallbackName || `Team ${index + 1}`;

  let candidateId = normalizeStr(team?.id);
  if (!candidateId) {
    candidateId = `team-${slugify(name, String(index + 1))}`;
  }
  candidateId = slugify(candidateId, `team-${index + 1}`);
  if (!candidateId.startsWith("team-")) {
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
    .map((m, idx) => sanitizeMember(m, finalId, usedMemberIds, idx))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, "vi", { sensitivity: "base" }));

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
    .map((team, idx) => sanitizeTeam(team, team?.name, usedTeamIds, idx))
    .filter(Boolean);

  if (!teams.length) {
    return deepCloneRoster(DEFAULT_ROSTER);
  }

  return { version: 1, teams };
}

export function getTeamRoster() {
  const raw = safeParse(getItem(TEAM_KEY), null);
  const sanitized = sanitizeRoster(raw);
  if (!raw || !raw.teams) {
    setItem(TEAM_KEY, JSON.stringify(sanitized));
  }
  return sanitized;
}

export function setTeamRoster(next, { actor = "system", detail = "" } = {}) {
  const normalizedInput = Array.isArray(next?.teams) || Array.isArray(next)
    ? next
    : deepCloneRoster(DEFAULT_ROSTER);

  const sanitized = sanitizeRoster(
    Array.isArray(normalizedInput)
      ? { version: 1, teams: normalizedInput }
      : normalizedInput
  );
  setItem(TEAM_KEY, JSON.stringify(sanitized));
  pushAuditLog({
    actor,
    action: "team.save",
    detail: detail || `Cáº­p nháº­t ${sanitized.teams.length} tá»• Ä‘á»™i`,
  });
  return sanitized;
}

export function mapMemberNamesToTeams(source) {
  const roster = sanitizeRoster(
    Array.isArray(source?.teams) || Array.isArray(source)
      ? source
      : deepCloneRoster(DEFAULT_ROSTER)
  );

  const map = new Map();
  for (const team of roster.teams) {
    const teamName = normalizeStr(team?.name);
    if (!teamName) continue;
    for (const member of team.members || []) {
      const memberName = normalizeStr(member?.name);
      const key = normalizeName(memberName);
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, {
          team: teamName,
          name: memberName,
        });
      }
    }
  }
  return map;
}

export function applyTeamRosterToMST(rosterLike, rows, options = {}) {
  const sanitizedRoster = sanitizeRoster(
    Array.isArray(rosterLike?.teams) || Array.isArray(rosterLike)
      ? rosterLike
      : deepCloneRoster(DEFAULT_ROSTER)
  );
  const memberMap = mapMemberNamesToTeams(sanitizedRoster);

  const previousRoster = options?.previousRoster
    ? sanitizeRoster(options.previousRoster)
    : null;

  if (previousRoster) {
    const prevById = new Map();
    for (const team of previousRoster.teams) {
      const prevTeamName = normalizeStr(team?.name);
      for (const member of team.members || []) {
        prevById.set(member.id, {
          name: normalizeStr(member?.name),
          team: prevTeamName,
        });
      }
    }

    for (const team of sanitizedRoster.teams) {
      const teamName = normalizeStr(team?.name);
      for (const member of team.members || []) {
        const info = {
          team: teamName,
          name: normalizeStr(member?.name),
        };
        const prev = prevById.get(member.id);
        if (prev) {
          const prevKey = normalizeName(prev.name);
          if (prevKey) {
            memberMap.set(prevKey, info);
          }
        }
      }
    }
  }

  const sanitizedRows = Array.isArray(rows)
    ? rows.map(sanitizeMSTRow).filter(Boolean)
    : [];

  let changed = false;
  const updated = sanitizedRows.map((row) => {
    const importKey = normalizeName(row.person_import);
    const exportKey = normalizeName(row.person_export);
    const importInfo = importKey ? memberMap.get(importKey) : null;
    const exportInfo = exportKey ? memberMap.get(exportKey) : null;
    const preferredInfo = importInfo || exportInfo;

    let next = row;
    const applyChanges = (updates) => {
      if (next === row) {
        next = { ...row };
      }
      Object.assign(next, updates);
      changed = true;
    };

    if (importInfo?.name && importInfo.name !== row.person_import) {
      applyChanges({ person_import: importInfo.name });
    }
    if (exportInfo?.name && exportInfo.name !== row.person_export) {
      applyChanges({ person_export: exportInfo.name });
    }

    const targetTeam = preferredInfo?.team;
    if (targetTeam && normalizeName(row.team) !== normalizeName(targetTeam)) {
      applyChanges({ team: targetTeam });
    }

    return next;
  });

  return { rows: updated, changed };
}

// ===== Äáº¡i lÃ½ Háº£i quan (MST -> tÃªn cÃ´ng ty & Ä‘áº¡i lÃ½) =====

export function getHQAgenciesRaw() {
  return safeParse(getItem(HQ_KEY), []);
}

function sanitizeAgencyRow(row) {
  const mst = normalizeMST(row?.mst);
  if (!mst) return null;
  const company = normalizeStr(row?.company ?? row?.cong_ty ?? row?.customer ?? "");
  const agent = normalizeStr(
    row?.agent ?? row?.agency ?? row?.dai_ly ?? row?.dai_ly_hq ?? row?.['Äáº¡i lÃ½ HQ'] ?? row?.['Dai ly HQ'] ?? ""
  );
  return { mst, company, agent };
}

export function getHQAgencies() {
  const raw = getHQAgenciesRaw();
  const rows = Array.isArray(raw) ? raw : [];
  const sanitized = rows.map(sanitizeAgencyRow).filter(Boolean);
  sanitized.sort((a, b) => {
    const cmpCompany = a.company.localeCompare(b.company, 'vi', { sensitivity: 'base' });
    if (cmpCompany !== 0) return cmpCompany;
    return a.mst.localeCompare(b.mst);
  });
  return sanitized;
}

export function mapHQAgenciesByMST() {
  const map = new Map();
  for (const row of getHQAgencies()) {
    if (!row) continue;
    map.set(row.mst, row);
  }
  return map;
}

export function upsertHQAgencies(rows, { actor = "system", detail = "" } = {}) {
  const sanitized = Array.isArray(rows) ? rows.map(sanitizeAgencyRow).filter(Boolean) : [];
  const dedup = new Map();
  for (const row of sanitized) {
    const prev = dedup.get(row.mst) || {};
    dedup.set(row.mst, {
      mst: row.mst,
      company: row.company || prev.company || "",
      agent: row.agent || prev.agent || "",
    });
  }
  const finalRows = Array.from(dedup.values());
  finalRows.sort((a, b) => {
    const cmpCompany = a.company.localeCompare(b.company, 'vi', { sensitivity: 'base' });
    if (cmpCompany !== 0) return cmpCompany;
    return a.mst.localeCompare(b.mst);
  });
  setItem(HQ_KEY, JSON.stringify(finalRows));
  pushAuditLog({
    actor,
    action: "hq.save",
    detail: detail || `Cáº­p nháº­t ${finalRows.length} cáº¥u hÃ¬nh Äáº¡i lÃ½ HQ`,
  });

  const finalByMst = new Map(finalRows.map((row) => [row.mst, row]));
  const mstRows = getMSTMap();
  let mstChanged = false;
  const syncedMst = mstRows.map((row) => {
    const info = finalByMst.get(row.mst);
    if (!info || !info.company) return row;
    if (normalizeStr(row.company) === info.company) return row;
    mstChanged = true;
    return { ...row, company: info.company };
  });
  if (mstChanged) {
    upsertMSTRows(syncedMst, { actor, detail: 'Äá»“ng bá»™ tÃªn cÃ´ng ty theo Äáº¡i lÃ½ HQ' });
  }

  const existingDecls = getDeclRows();
  const reannotatedDecls = applyAgenciesToDeclRows(existingDecls, finalByMst);
  const declChanged = reannotatedDecls.some((row, idx) => row !== existingDecls[idx]);
  if (declChanged) {
    saveDeclRows(reannotatedDecls, {
      overwrite: true,
      actor,
      detail: 'Äá»“ng bá»™ Äáº¡i lÃ½ HQ vá»›i dá»¯ liá»‡u tá» khai',
    });
  }

  return finalRows;
}

export function applyAgenciesToDeclRows(rows, agencyMapParam = null) {
  const list = Array.isArray(rows) ? rows : [];
  const agencyMap = agencyMapParam instanceof Map ? agencyMapParam : mapHQAgenciesByMST();
  if (!agencyMap || agencyMap.size === 0) return list;

  return list.map((row) => {
    const mst = normalizeMST(row?.mst);
    if (!mst) return row;
    const info = agencyMap.get(mst);
    if (!info) return row;

    const desiredCompany = info.company || "";
    const desiredAgent = info.agent || "";

    let next = row;
    if (desiredAgent && normalizeStr(row?.agency || row?.dai_ly || "") !== desiredAgent) {
      if (next === row) next = { ...row };
      next.agency = desiredAgent;
      next.dai_ly = desiredAgent;
    }

    if (desiredCompany && normalizeStr(row?.cong_ty) !== desiredCompany) {
      if (next === row) next = { ...row };
      next.cong_ty = desiredCompany;
      next.customer = desiredCompany;
    }

    return next;
  });
}

/** LÆ°u tá» khai:
 * - overwrite=true: ghi Ä‘Ã¨ toÃ n bá»™
 * - overwrite=false: merge theo key "so_tk + '_' + (nhanh||'')"
 */
export function saveDeclRows(newRows, { overwrite = false, actor = "system", detail = "" } = {}) {
  const cleaned = Array.isArray(newRows)
    ? newRows.map((row) => normalizeDeclarationRow(row)).filter((row) => row && typeof row === 'object')
    : [];
  if (overwrite) {
    const stored = writeDeclRows(cleaned);
    pushAuditLog({
      actor,
      action: "decl.overwrite",
      detail: detail || `Ghi de ${stored.length} to khai`,
    });
    return stored.length;
  }
  const current = getDeclRowsRaw();
  const merged = normalizeDeclRows(current.concat(cleaned));
  setItem(DECL_KEY, JSON.stringify(merged));
  pushAuditLog({
    actor,
    action: "decl.merge",
    detail: detail || `Hop nhat ${cleaned.length} to khai (tong ${merged.length})`,
  });
  return merged.length;
}


export function markDeclRowsReviewed(keys, { actor = "system" } = {}) {
  if (!Array.isArray(keys) || keys.length === 0) return 0;
  const keySet = new Set(keys);
  let updated = 0;
  const next = getDeclRows().map((row) => {
    const key = getDeclarationKey(row);
    if (!keySet.has(key)) return row;
    if (row?.reviewed) return row;
    updated += 1;
    return {
      ...row,
      reviewed: true,
      reviewed_at: new Date().toISOString(),
    };
  });
  if (updated > 0) {
    setItem(DECL_KEY, JSON.stringify(next));
    pushAuditLog({
      actor,
      action: "decl.review",
      detail: `ÄÃ¡nh dáº¥u Ä‘Ã£ rÃ  soÃ¡t ${updated} tá» khai`,
      meta: { keys: Array.from(keySet) },
    });
  }
  return updated;
}

// ===== Compat layer cho cÃ¡c file khÃ¡c =====
export function getData() {           // RulesEditor.jsx Ä‘ang import
  return getDeclRows();
}
export function setData(rows, opts) { // rules.js/RulesEditor.jsx cÃ³ thá»ƒ gá»i
  return saveDeclRows(rows, { overwrite: true, ...(opts || {}) });
}

// Nháº­t kÃ½ import
function normalizeLogDeclarationList(list, limit = 200) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const normalized = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const full = (entry.so_tk_full ?? entry.so_tk ?? entry.number ?? '').toString();
    const soTk = normalizeDeclarationNumber(full || entry.so_tk);
    if (!soTk) continue;
    const branch = normalizeStr(entry.nhanh || entry.branch || '');
    const fields = Array.isArray(entry.fields) ? Array.from(new Set(entry.fields.map((f) => String(f || '').trim()).filter(Boolean))) : undefined;
    normalized.push({
      so_tk: soTk,
      so_tk_full: full || undefined,
      nhanh: branch,
      branch,
      fields: fields && fields.length ? fields : undefined,
    });
    if (normalized.length >= limit) break;
  }
  return normalized;
}

export function pushImportLog(entry, extraMeta = null) {
  const LOG_KEY = 'import_logs_v1';
  const logs = safeParse(getItem(LOG_KEY), []);
  const timestamp = new Date().toISOString();
  let record;
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    const {
      msg,
      message,
      kind = 'info',
      actor = 'system',
      summary = null,
      meta = null,
      updatedDeclarations = [],
      insertedDeclarations = [],
    } = entry;
    record = {
      ts: timestamp,
      kind,
      actor,
      msg: String(message ?? msg ?? ''),
      summary: summary && typeof summary === 'object' ? { ...summary } : summary ?? null,
      meta: meta && typeof meta === 'object' ? { ...meta } : meta ?? null,
      updatedDeclarations: normalizeLogDeclarationList(updatedDeclarations),
      insertedDeclarations: normalizeLogDeclarationList(insertedDeclarations),
    };
  } else {
    const meta = extraMeta && typeof extraMeta === 'object' ? { ...extraMeta } : null;
    record = {
      ts: timestamp,
      kind: 'info',
      actor: 'system',
      msg: entry == null ? '' : String(entry),
      meta,
    };
  }
  const cleaned = Object.fromEntries(Object.entries(record).filter(([, value]) => Array.isArray(value) ? value.length > 0 : value !== undefined));
  logs.unshift(cleaned);
  setItem(LOG_KEY, JSON.stringify(logs.slice(0, 50)));
}

// ===== K_RULES (Ä‘á»ƒ RulesEditor khÃ´ng lá»—i khi chÆ°a cÃ³ dá»¯ liá»‡u) =====
export const K_RULES = (() => {
  return safeParse(getItem(RULES_KEY), createDefaultRuleCollection());
})();
export function getRules() {
  return safeParse(getItem(RULES_KEY), createDefaultRuleCollection());
}
export function setRules(v) {
  setItem(RULES_KEY, JSON.stringify(v));
}

// ===== Nháº­t kÃ½ há»‡ thá»‘ng =====

export function pushAuditLog({ actor = "system", action = "unknown", detail = "", meta = null } = {}) {
  const entry = {
    ts: new Date().toISOString(),
    actor,
    action,
    detail,
    meta: meta == null ? null : shallowClone(meta),
  };
  const logs = safeParse(getItem(AUDIT_KEY), []);
  logs.unshift(entry);
  const limited = logs.slice(0, 200);
  setItem(AUDIT_KEY, JSON.stringify(limited));
  return entry;
}

export function getAuditLogs(limit = 100) {
  const logs = safeParse(getItem(AUDIT_KEY), []);
  if (!Number.isFinite(limit) || limit <= 0) return logs;
  return logs.slice(0, limit);
}

export function clearAuditLogs({ actor = "system", note = "XÃ³a toÃ n bá»™ nháº­t kÃ½" } = {}) {
  const entry = {
    ts: new Date().toISOString(),
    actor,
    action: "audit.clear",
    detail: note,
    meta: null,
  };
  setItem(AUDIT_KEY, JSON.stringify([entry]));
  return entry;
}

// ===== Default export (tuá»³ nÆ¡i dÃ¹ng)
export default {
  DECL_KEY, MST_KEY, RULES_KEY, TEAM_KEY, AUDIT_KEY, HQ_KEY,
  normalizeStr, normalizeMST, normalizeDeclarationNumber, toISODate, normalizeName,
  isExportDecl, isExportByNumber, isImportByNumber, isExportByType, isImportByType,
  getMSTRowsRaw, getMSTMap, getMSTFor, upsertMSTRows,
  getDeclRows, saveDeclRows, sortDeclRows, getRecentDeclRows,
  getHQAgencies, mapHQAgenciesByMST, upsertHQAgencies, applyAgenciesToDeclRows,
  getTeamRoster, setTeamRoster, mapMemberNamesToTeams, applyTeamRosterToMST,
  getData, setData,
  getRules, setRules, K_RULES,
  pushImportLog,
  pushAuditLog, getAuditLogs, clearAuditLogs,
};
