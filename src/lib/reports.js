import {
  normalizeName,
  normalizeStr,
  toISODate,
  mapMemberNamesToTeams,
  isExportDecl,
} from "@/lib/store.js";
import { computeKPI, DEFAULT_RULES } from "@/lib/rules.js";

const UNASSIGNED_STAFF_KEY = "__unassigned_staff__";
const UNASSIGNED_TEAM_KEY = "__unassigned_team__";

function cloneDate(date) {
  return new Date(date.getTime());
}

function formatISO(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeek(date) {
  const base = cloneDate(date);
  const day = base.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  base.setDate(base.getDate() + diff);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate());
}

function endOfWeek(date) {
  const start = startOfWeek(date);
  start.setDate(start.getDate() + 6);
  return start;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getQuarter(date) {
  return Math.floor(date.getMonth() / 3);
}

function startOfQuarter(date) {
  const quarter = getQuarter(date);
  return new Date(date.getFullYear(), quarter * 3, 1);
}

function endOfQuarter(date) {
  const quarter = getQuarter(date);
  return new Date(date.getFullYear(), quarter * 3 + 3, 0);
}

function startOfYear(date) {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(date) {
  return new Date(date.getFullYear(), 12, 0);
}

export const QUICK_RANGE_OPTIONS = [
  { value: "this_week", label: "Tuần này" },
  { value: "last_week", label: "Tuần trước" },
  { value: "this_month", label: "Tháng này" },
  { value: "last_month", label: "Tháng trước" },
  { value: "this_quarter", label: "Quý này" },
  { value: "last_quarter", label: "Quý trước" },
  { value: "this_year", label: "Năm nay" },
  { value: "last_year", label: "Năm trước" },
  { value: "all_time", label: "Tất cả" },
  { value: "custom", label: "Tùy chỉnh" },
];

export function computeQuickRange(option, base = new Date()) {
  const today = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  switch (option) {
    case "this_week": {
      const start = startOfWeek(today);
      const end = endOfWeek(today);
      return { from: formatISO(start), to: formatISO(end) };
    }
    case "last_week": {
      const start = startOfWeek(today);
      start.setDate(start.getDate() - 7);
      const end = endOfWeek(start);
      return { from: formatISO(start), to: formatISO(end) };
    }
    case "this_month": {
      const start = startOfMonth(today);
      const end = endOfMonth(today);
      return { from: formatISO(start), to: formatISO(end) };
    }
    case "last_month": {
      const start = startOfMonth(today);
      start.setMonth(start.getMonth() - 1);
      const end = endOfMonth(start);
      return { from: formatISO(start), to: formatISO(end) };
    }
    case "this_quarter": {
      const start = startOfQuarter(today);
      const end = endOfQuarter(today);
      return { from: formatISO(start), to: formatISO(end) };
    }
    case "last_quarter": {
      const start = startOfQuarter(today);
      start.setMonth(start.getMonth() - 3);
      const end = endOfQuarter(start);
      return { from: formatISO(start), to: formatISO(end) };
    }
    case "this_year": {
      const start = startOfYear(today);
      const end = endOfYear(today);
      return { from: formatISO(start), to: formatISO(end) };
    }
    case "last_year": {
      const start = startOfYear(today);
      start.setFullYear(start.getFullYear() - 1);
      const end = endOfYear(start);
      return { from: formatISO(start), to: formatISO(end) };
    }
    case "all_time":
      return { from: "", to: "" };
    default:
      return { from: "", to: "" };
  }
}

function createStats() {
  return {
    decls: 0,
    import: 0,
    export: 0,
    items: 0,
    licenses: 0,
    kpi: 0,
  };
}

function accumulate(stats, row) {
  stats.decls += 1;
  stats.items += row.num_items;
  stats.licenses += row.licenses;
  stats.kpi += row.kpi;
  if (row.isExport) {
    stats.export += 1;
  } else {
    stats.import += 1;
  }
}

function finalizeStats(stats) {
  return {
    ...stats,
    kpi: Math.round(stats.kpi * 10) / 10,
  };
}

function resolveDate(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  return toISODate(value);
}

function sanitizeRow(row) {
  if (!row || typeof row !== "object") return null;
  const date = resolveDate(row.date || row.ngay || row.ngay_dang_ky || row.date_created);
  const so_tk = normalizeStr(row.so_tk || row.soToKhai || row.so_tk_tm || "");
  if (!date || !so_tk) return null;

  const loai_hinh = normalizeStr(row.loai_hinh || row.loaiHinh || row.loai_hinh_tm || "");
  const mst = normalizeStr(row.mst || row.ma_so_thue || "");
  const cong_ty = normalizeStr(row.cong_ty || row.congTy || row.customer || row.ten_cong_ty || "");
  const nhan_vien = normalizeStr(row.nhan_vien || row.nhanVien || row.nhanvien || row.staff || "");
  const team = normalizeStr(row.team || row.to_doi || row.toDoi || "");
  const num_items = Number(row.num_items ?? row.muc_hang ?? row.mucHang ?? 0) || 0;
  const licenses = Number(row.licenses ?? row.so_luong_gp ?? row.soLuongGiayPhep ?? 0) || 0;
  const kpiInput = {
    ...row,
    loaiHinh: row.loaiHinh || loai_hinh,
    loai_hinh,
    num_items,
    muc_hang: num_items,
    licenses,
    so_luong_gp: licenses,
  };

  return {
    ...kpiInput,
    date,
    so_tk,
    loai_hinh,
    mst,
    cong_ty,
    nhan_vien,
    team,
    num_items,
    licenses,
  };
}

export function buildReportData(rowsInput, { roster, rules, from, to } = {}) {
  const rows = Array.isArray(rowsInput) ? rowsInput : [];
  const effectiveRules = rules && rules.groups ? rules : DEFAULT_RULES;

  const sanitizedRoster = roster && roster.teams ? roster : { version: 1, teams: [] };
  const memberTeamMap = mapMemberNamesToTeams(sanitizedRoster);

  let start = from ? from.trim() : "";
  let end = to ? to.trim() : "";
  if (start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) start = toISODate(start);
  if (end && !/^\d{4}-\d{2}-\d{2}$/.test(end)) end = toISODate(end);
  if (start && end && start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  const summaryStats = createStats();
  const staffMap = new Map();
  const teamMap = new Map();

  function ensureStaff(key, name) {
    const finalKey = key || UNASSIGNED_STAFF_KEY;
    if (!staffMap.has(finalKey)) {
      const label = name || "Chưa gán";
      staffMap.set(finalKey, {
        key: finalKey,
        name: label,
        teams: new Set(),
        stats: createStats(),
        rows: [],
      });
    }
    return staffMap.get(finalKey);
  }

  function ensureTeam(name) {
    const normalized = normalizeName(name);
    const key = normalized || UNASSIGNED_TEAM_KEY;
    if (!teamMap.has(key)) {
      const label = name || "Chưa gán tổ đội";
      teamMap.set(key, {
        key,
        name: label,
        stats: createStats(),
        rows: [],
        members: new Map(),
        rosterMembers: new Set(),
      });
    }
    return teamMap.get(key);
  }

  function ensureTeamMember(teamEntry, staffKey, staffName) {
    const key = staffKey || UNASSIGNED_STAFF_KEY;
    if (!teamEntry.members.has(key)) {
      teamEntry.members.set(key, {
        key,
        name: staffName || "Chưa gán",
        stats: createStats(),
        rows: [],
      });
    }
    return teamEntry.members.get(key);
  }

  const preparedRows = [];

  for (const raw of rows) {
    const sanitized = sanitizeRow(raw);
    if (!sanitized) continue;

    const { date } = sanitized;
    if (start && date < start) continue;
    if (end && date > end) continue;

    const staffKey = normalizeName(sanitized.nhan_vien);
    const staffName = sanitized.nhan_vien || "Chưa gán";
    let teamName = sanitized.team;
    if (!teamName && staffKey && memberTeamMap.has(staffKey)) {
      teamName = memberTeamMap.get(staffKey);
    }
    const teamEntry = ensureTeam(teamName);

    const kpiValue = Number.isFinite(Number(sanitized.kpi))
      ? Number(sanitized.kpi)
      : computeKPI(sanitized, effectiveRules);

    const detailRow = {
      date,
      so_tk: sanitized.so_tk,
      mst: sanitized.mst,
      cong_ty: sanitized.cong_ty,
      loai_hinh: sanitized.loai_hinh,
      num_items: sanitized.num_items,
      licenses: sanitized.licenses,
      nhan_vien: staffName,
      team: teamEntry.name,
      isExport: isExportDecl(sanitized.so_tk, sanitized.loai_hinh),
      kpi: Math.round(kpiValue * 10) / 10,
    };

    preparedRows.push(detailRow);

    const staffEntry = ensureStaff(staffKey, staffName);
    staffEntry.teams.add(teamEntry.name);
    staffEntry.rows.push(detailRow);
    accumulate(staffEntry.stats, detailRow);

    teamEntry.rows.push(detailRow);
    accumulate(teamEntry.stats, detailRow);

    const memberEntry = ensureTeamMember(teamEntry, staffEntry.key, staffEntry.name);
    memberEntry.rows.push(detailRow);
    accumulate(memberEntry.stats, detailRow);

    accumulate(summaryStats, detailRow);
  }

  // Seed roster information (members & teams without dữ liệu)
  if (Array.isArray(sanitizedRoster.teams)) {
    for (const team of sanitizedRoster.teams) {
      const teamEntry = ensureTeam(team?.name);
      if (Array.isArray(team?.members)) {
        for (const member of team.members) {
          const memberName = normalizeStr(member?.name);
          const memberKey = normalizeName(memberName);
          const staffEntry = ensureStaff(memberKey, memberName);
          staffEntry.teams.add(teamEntry.name);
          ensureTeamMember(teamEntry, staffEntry.key, staffEntry.name);
        }
      }
    }
  }

  const sortedRows = preparedRows.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.so_tk.localeCompare(b.so_tk, undefined, { numeric: true, sensitivity: "base" });
  });

  const staffList = Array.from(staffMap.values()).map((entry) => {
    const sorted = entry.rows.slice().sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return a.so_tk.localeCompare(b.so_tk, undefined, { numeric: true, sensitivity: "base" });
    });
    return {
      key: entry.key,
      name: entry.name,
      teamNames: Array.from(entry.teams).filter(Boolean),
      teamLabel: entry.teams.size
        ? Array.from(entry.teams).filter(Boolean).join(", ")
        : "Chưa gán tổ đội",
      stats: finalizeStats(entry.stats),
      rows: sorted,
    };
  }).sort((a, b) => {
    const teamA = a.teamLabel || "";
    const teamB = b.teamLabel || "";
    const cmpTeam = teamA.localeCompare(teamB, "vi", { sensitivity: "base" });
    if (cmpTeam !== 0) return cmpTeam;
    return a.name.localeCompare(b.name, "vi", { sensitivity: "base" });
  });

  const staffKeys = staffList.map((s) => s.key).join("|");

  const teamList = Array.from(teamMap.values()).map((entry) => {
    const sortedRows = entry.rows.slice().sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return a.so_tk.localeCompare(b.so_tk, undefined, { numeric: true, sensitivity: "base" });
    });
    const members = Array.from(entry.members.values()).map((member) => ({
      key: member.key,
      name: member.name,
      stats: finalizeStats(member.stats),
      rows: member.rows.slice().sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return a.so_tk.localeCompare(b.so_tk, undefined, { numeric: true, sensitivity: "base" });
      }),
    })).sort((a, b) => {
      if (a.stats.decls !== b.stats.decls) return b.stats.decls - a.stats.decls;
      return a.name.localeCompare(b.name, "vi", { sensitivity: "base" });
    });

    return {
      key: entry.key,
      name: entry.name,
      stats: finalizeStats(entry.stats),
      rows: sortedRows,
      members,
      memberNames: members.map((m) => m.name),
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "vi", { sensitivity: "base" }));

  const teamKeys = teamList.map((t) => t.key).join("|");

  return {
    rows: sortedRows,
    summary: finalizeStats(summaryStats),
    staff: {
      list: staffList,
      byKey: new Map(staffList.map((item) => [item.key, item])),
      keysHash: staffKeys,
    },
    teams: {
      list: teamList,
      byKey: new Map(teamList.map((item) => [item.key, item])),
      keysHash: teamKeys,
    },
    range: { from: start || "", to: end || "" },
    rules: effectiveRules,
  };
}

export default {
  QUICK_RANGE_OPTIONS,
  computeQuickRange,
  buildReportData,
};
