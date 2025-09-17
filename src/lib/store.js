// src/lib/store.js

// ===== Keys in localStorage =====
export const DECL_KEY  = "decl_rows_v1";   // dữ liệu tờ khai
export const MST_KEY   = "mst_rows_v2";    // gán MST -> nhân viên/team/effective_from
export const RULES_KEY = "kpi_rules_v2";   // quy tắc KPI
export const TEAM_KEY  = "team_roster_v1"; // danh sách tổ đội & thành viên

// ===== Helpers =====
function safeParse(json, fallback) {
  try { const v = JSON.parse(json); return v ?? fallback; } catch { return fallback; }
}

// Chuẩn hoá chuỗi (trim + bỏ khoảng trắng thừa)
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

// MST: giữ dạng chuỗi số, bỏ mọi ký tự không phải số
export function normalizeMST(mst) {
  return (mst ?? "").toString().replace(/\D/g, "");
}

// dd/mm/yyyy -> yyyy-mm-dd ; nếu đã yyyy-mm-dd thì giữ nguyên
export function toISODate(d) {
  const s = normalizeStr(d);
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!m) return "";
  let [_, dd, mm, yyyy] = m;
  if (yyyy.length === 2) yyyy = "20" + yyyy;
  return `${yyyy.padStart(4,"0")}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
}

// ===== Quy tắc xác định Nhập/Xuất =====
// 30xxxxxxxxxxx -> xuất; 10xxxxxxxxxxx -> nhập
export function isExportByNumber(soTk) {
  const s = (soTk ?? "").toString().replace(/\D/g,"");
  return /^30\d{10}$/.test(s);
}
export function isImportByNumber(soTk) {
  const s = (soTk ?? "").toString().replace(/\D/g,"");
  return /^10\d{10}$/.test(s);
}
// fallback theo loại hình
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
  return false; // không rõ thì coi là nhập
}

// ===== MST map (gán nhân viên theo ngày hiệu lực) =====
export function getMSTRowsRaw() {
  return safeParse(localStorage.getItem(MST_KEY), []);
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

/** Lấy toàn bộ bảng gán MST, đã chuẩn hoá + sắp xếp */
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

/** Ghi đè/bổ sung bảng gán MST (đã chuẩn hoá dữ liệu đầu vào) */
export function upsertMSTRows(rows) {
  const sanitized = Array.isArray(rows)
    ? rows.map(sanitizeMSTRow).filter(Boolean)
    : [];
  sanitized.sort((a, b) => {
    const byMST = a.mst.localeCompare(b.mst);
    if (byMST !== 0) return byMST;
    return (a.effective_from || "").localeCompare(b.effective_from || "");
  });
  localStorage.setItem(MST_KEY, JSON.stringify(sanitized));
  return sanitized.length;
}

/** Lấy người phụ trách theo MST & ngày hiệu lực gần nhất (<= ngày tờ khai) */
export function getMSTFor(mst, isoDate) {
  const rows = getMSTMap().filter(r => normalizeMST(r.mst) === normalizeMST(mst));
  if (rows.length === 0) return null;

  const dateVal = isoDate ? new Date(isoDate).getTime() : Number.POSITIVE_INFINITY;

  // Xếp theo hiệu lực gần nhất với ngày TK
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

// ===== DECL rows (tờ khai) =====
export function getDeclRows() {
  return safeParse(localStorage.getItem(DECL_KEY), []);
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
      if (a.ts !== b.ts) return b.ts - a.ts; // mới nhất trước

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

      return b.idx - a.idx; // giữ thứ tự chèn gần nhất
    })
    .map(item => item.row);
}

export function getRecentDeclRows(limit = 20) {
  const sorted = sortDeclRows(getDeclRows());
  if (!Number.isFinite(limit) || limit <= 0) return sorted;
  return sorted.slice(0, limit);
}

// ===== Team roster (tổ đội) =====

const DEFAULT_ROSTER = Object.freeze({
  version: 1,
  teams: [
    {
      id: "team-1",
      name: "Team 1",
      members: [
        { id: "team-1-phuong", name: "Phương" },
        { id: "team-1-hanh", name: "Hạnh" },
        { id: "team-1-bao", name: "Bảo" },
        { id: "team-1-ha-be", name: "Hà Bé" },
        { id: "team-1-huong", name: "Hương" },
      ],
    },
    {
      id: "team-2",
      name: "Team 2",
      members: [
        { id: "team-2-tuan", name: "Tuấn" },
        { id: "team-2-hoa", name: "Hòa" },
        { id: "team-2-thu", name: "Thu" },
        { id: "team-2-hang", name: "Hằng" },
        { id: "team-2-huyen", name: "Huyền" },
      ],
    },
    {
      id: "team-3",
      name: "Team 3",
      members: [
        { id: "team-3-hoc", name: "Học" },
        { id: "team-3-thanh", name: "Thanh" },
        { id: "team-3-huy", name: "Huy" },
        { id: "team-3-linh", name: "Linh" },
        { id: "team-3-thao", name: "Thảo" },
        { id: "team-3-hung", name: "Hưng" },
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
  const raw = safeParse(localStorage.getItem(TEAM_KEY), null);
  const sanitized = sanitizeRoster(raw);
  if (!raw || !raw.teams) {
    localStorage.setItem(TEAM_KEY, JSON.stringify(sanitized));
  }
  return sanitized;
}

export function setTeamRoster(next) {
  const normalizedInput = Array.isArray(next?.teams) || Array.isArray(next)
    ? next
    : deepCloneRoster(DEFAULT_ROSTER);

  const sanitized = sanitizeRoster(
    Array.isArray(normalizedInput)
      ? { version: 1, teams: normalizedInput }
      : normalizedInput
  );
  localStorage.setItem(TEAM_KEY, JSON.stringify(sanitized));
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
      const key = normalizeName(member?.name);
      if (!key) continue;
      map.set(key, teamName);
    }
  }
  return map;
}

export function applyTeamRosterToMST(rosterLike, rows) {
  const memberMap = mapMemberNamesToTeams(rosterLike);
  const sanitizedRows = Array.isArray(rows)
    ? rows.map(sanitizeMSTRow).filter(Boolean)
    : [];

  let changed = false;
  const updated = sanitizedRows.map((row) => {
    const importKey = normalizeName(row.person_import);
    const exportKey = normalizeName(row.person_export);
    const targetTeam = memberMap.get(importKey) || memberMap.get(exportKey);
    if (targetTeam && normalizeName(row.team) !== normalizeName(targetTeam)) {
      changed = true;
      return { ...row, team: targetTeam };
    }
    return row;
  });

  return { rows: updated, changed };
}

/** Lưu tờ khai:
 * - overwrite=true: ghi đè toàn bộ
 * - overwrite=false: merge theo key "so_tk + '_' + (nhanh||'')"
 */
export function saveDeclRows(newRows, { overwrite = false } = {}) {
  const cleaned = Array.isArray(newRows) ? newRows : [];
  if (overwrite) {
    localStorage.setItem(DECL_KEY, JSON.stringify(cleaned));
    return cleaned.length;
  }
  const cur = getDeclRows();
  const map = new Map();
  const keyOf = (r) => `${(r.so_tk ?? "").toString()}_${normalizeStr(r.nhanh)}`;

  for (const r of cur) map.set(keyOf(r), r);
  for (const r of cleaned) map.set(keyOf(r), r);

  const merged = Array.from(map.values());
  localStorage.setItem(DECL_KEY, JSON.stringify(merged));
  return merged.length;
}

// ===== Compat layer cho các file khác =====
export function getData() {           // RulesEditor.jsx đang import
  return getDeclRows();
}
export function setData(rows, opts) { // rules.js/RulesEditor.jsx có thể gọi
  return saveDeclRows(rows, { overwrite: true, ...(opts || {}) });
}

// Nhật ký import
export function pushImportLog(msg) {
  const LOG_KEY = "import_logs_v1";
  const a = safeParse(localStorage.getItem(LOG_KEY), []);
  a.unshift({ ts: new Date().toISOString(), msg });
  localStorage.setItem(LOG_KEY, JSON.stringify(a.slice(0,50)));
}

// ===== K_RULES (để RulesEditor không lỗi khi chưa có dữ liệu) =====
export const K_RULES = safeParse(localStorage.getItem(RULES_KEY), {
  version: 1,
  points: { base: 1 },
});
export function getRules() {
  return safeParse(localStorage.getItem(RULES_KEY), K_RULES);
}
export function setRules(v) {
  localStorage.setItem(RULES_KEY, JSON.stringify(v));
}

// ===== Default export (tuỳ nơi dùng)
export default {
  DECL_KEY, MST_KEY, RULES_KEY, TEAM_KEY,
  normalizeStr, normalizeMST, toISODate, normalizeName,
  isExportDecl, isExportByNumber, isImportByNumber, isExportByType, isImportByType,
  getMSTRowsRaw, getMSTMap, getMSTFor, upsertMSTRows,
  getDeclRows, saveDeclRows, sortDeclRows, getRecentDeclRows,
  getTeamRoster, setTeamRoster, mapMemberNamesToTeams, applyTeamRosterToMST,
  getData, setData,
  getRules, setRules, K_RULES,
  pushImportLog,
};
