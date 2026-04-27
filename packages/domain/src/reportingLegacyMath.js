/**
 * @deprecated Legacy reporting math — retained for backward compatibility.
 * New code should use `packages/domain/src/reporting.js` (resolveReportingRule, buildReportingReadModels).
 * Migration tracked under CQ-007/BL-005.
 */
import {

  normalizeName,

  normalizeStr,

  toISODate,

  mapMemberNamesToTeams,

  isExportDecl,

  KPI_ADJUSTMENT_CATEGORY_CONFIG,
  roundAdjustmentPoint,

} from "./reportingLegacySupport.js";

import { addAdjustmentTotals, cloneAdjustmentTotals, createAdjustmentTotals } from "./kpiAdjustments.js";

import { computeKPI, DEFAULT_RULES } from "./reportingKpiComputation.js";

import { formatDisplayDate } from "./format.js";

import { computeLicenseSnapshot } from "./licenseSummary.js";



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



function formatMonthLabel(key) {

  if (!key || typeof key !== "string" || key.length < 7) return key || "";

  const [year, month] = key.split("-");

  return `${month}/${year}`;

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

    co: 0,

    coLines: 0,

    licenseCodes: new Set(),

  };

}



function ensureStaffAdjustmentEntry(map, key, name, teamName) {

  if (!key) return null;

  if (!map.has(key)) {

    map.set(key, {

      key,

      name: name || 'Chưa gán',

      teamNames: new Set(),

      totals: createAdjustmentTotals(),

    });

  }

  const entry = map.get(key);

  if (name && !entry.name) {

    entry.name = name;

  }

  if (teamName) {

    entry.teamNames.add(teamName);

  }

  return entry;

}



function ensureTeamAdjustmentEntry(map, key, name) {

  if (!key) return null;

  if (!map.has(key)) {

    map.set(key, {

      key,

      name: name || 'Chưa gán tổ đội',

      totals: createAdjustmentTotals(),

    });

  }

  const entry = map.get(key);

  if (name && !entry.name) {

    entry.name = name;

  }

  return entry;

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



  if (row.hasCO) {

    stats.co += 1;

  }

  const coLines = Number(row.coLineCount || row.co_line_count || 0);

  if (Number.isFinite(coLines)) {

    stats.coLines += coLines;

  }



  const codes = Array.isArray(row.licenseCodes)

    ? row.licenseCodes

    : Array.isArray(row.licenseSourceCodes)

    ? row.licenseSourceCodes

    : [];

  if (stats.licenseCodes instanceof Set) {

    for (const code of codes) {

      const normalized = normalizeStr(code).toUpperCase();

      if (normalized) {

        stats.licenseCodes.add(normalized);

      }

    }

  }

}



function finalizeStats(stats) {

  const { licenseCodes: rawLicenseSet, ...rest } = stats;

  const licenseSet = rawLicenseSet instanceof Set ? rawLicenseSet : new Set();

  const licenseCodes = Array.from(licenseSet);

  return {

    ...rest,

    kpi: Math.round(rest.kpi * 10) / 10,

    co: rest.co,

    coLines: rest.coLines,

    licenseCodes,

    licenseCount: licenseCodes.length,

  };

}



function normalizeDateCandidate(value, preferMonthFirst = false) {

  if (!value) return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {

    return formatISO(value);

  }



  const str = normalizeStr(value);

  if (!str) return "";



  const strictIso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (strictIso) {

    const month = Number.parseInt(strictIso[2], 10);

    const day = Number.parseInt(strictIso[3], 10);

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {

      return `${strictIso[1]}-${strictIso[2]}-${strictIso[3]}`;

    }

    if (month > 12 && day >= 1 && day <= 12) {

      return `${strictIso[1]}-${strictIso[3]}-${strictIso[2]}`;

    }

  }



  return toISODate(str, { preferMonthFirst });

}



function resolveDate(values, preferMonthFirstHint = false) {

  const list = Array.isArray(values) ? values : [values];

  const candidates = list.filter((v) => v !== undefined && v !== null);

  const trusted = [];

  const fallback = [];

  const isoPattern = /^\d{4}-\d{2}-\d{2}$/;

  for (const candidate of candidates) {

    if (candidate instanceof Date) {

      trusted.push(candidate);

      continue;

    }

    if (typeof candidate === "string" && isoPattern.test(candidate.trim())) {

      trusted.push(candidate);

      continue;

    }

    fallback.push(candidate);

  }

  for (const candidate of trusted) {

    const normalized = normalizeDateCandidate(candidate, false);

    if (normalized) return normalized;

  }

  const orders = preferMonthFirstHint ? [true, false] : [false, true];

  for (const prefer of orders) {

    for (const candidate of fallback) {

      const normalized = normalizeDateCandidate(candidate, prefer);

      if (normalized) return normalized;

    }

  }

  return "";

}



function sanitizeRow(row, preferMonthFirst = false) {

  if (!row || typeof row !== "object") return null;

  const date = resolveDate(

    [row.date, row.raw_date, row.rawDate, row.ngay, row.ngay_dang_ky, row.date_created],

    preferMonthFirst

  );

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



function detectPreferredMonthFirst(rows) {

  let monthFirst = 0;

  let dayFirst = 0;



  const consider = (value) => {

    const str = normalizeStr(value);

    if (!str) return;



    const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);

    if (iso) {

      const month = Number.parseInt(iso[2], 10);

      const day = Number.parseInt(iso[3], 10);

      if (month > 12 && day >= 1 && day <= 12) {

        monthFirst += 1;

        return;

      }

      if (day > 12 && month > 12) {

        monthFirst += 1;

        return;

      }

      return;

    }



    const slash = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:[ T].*)?$/);

    if (slash) {

      const first = Number.parseInt(slash[1], 10);

      const second = Number.parseInt(slash[2], 10);

      if (first > 12 && second <= 12) {

        dayFirst += 1;

        return;

      }

      if (second > 12 && first <= 12) {

        monthFirst += 1;

      }

    }

  };



  for (const row of Array.isArray(rows) ? rows : []) {

    if (!row || typeof row !== "object") continue;

    consider(row.raw_date);

    consider(row.rawDate);

    consider(row.date);

    consider(row.ngay);

    consider(row.ngay_dang_ky);

    consider(row.date_created);

  }



  return monthFirst > dayFirst;

}



export function buildReportData(rowsInput, { roster, rules, from, to, adjustments = [] } = {}) {

  const rows = Array.isArray(rowsInput) ? rowsInput : [];

  const effectiveRules = rules && rules.groups ? rules : DEFAULT_RULES;



  const sanitizedRoster = roster && roster.teams ? roster : { version: 1, teams: [] };

  const memberTeamMap = mapMemberNamesToTeams(sanitizedRoster);



  const preferMonthFirst = detectPreferredMonthFirst(rows);



  let start = from ? from.trim() : "";

  let end = to ? to.trim() : "";

  if (start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) {

    start = toISODate(start, { preferMonthFirst });

  }

  if (end && !/^\d{4}-\d{2}-\d{2}$/.test(end)) {

    end = toISODate(end, { preferMonthFirst });

  }

  if (start && end && start > end) {

    const tmp = start;

    start = end;

    end = tmp;

  }



  const summaryStats = createStats();

  const companyKeys = new Set();

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

  const comparisonRows = [];

  const adjustmentMeta = {

    list: [],

    applied: [],

    totalPoints: 0,

    pendingCount: 0,

    approvedCount: 0,

    rejectedCount: 0,

    appliedCount: 0,

    totalsByCategory: createAdjustmentTotals(),

    byStaff: new Map(),

    byTeam: new Map(),

  };



  for (const raw of rows) {
    const deletedAtValues = [
      raw?.deleted_at,
      raw?.deletedAt,
      raw?.deleted_at_tm,
      raw?.deletedAtTm,
      raw?.deleted,
      raw?.deletedFlag,
      raw?.isDeleted,
    ];

    const isSoftDeleted = deletedAtValues.some((value) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return value !== 0;
      return normalizeStr(value) !== "";
    });

    if (isSoftDeleted) continue;

    const sanitized = sanitizeRow(raw, preferMonthFirst);

    if (!sanitized) continue;



    const { date } = sanitized;

    // Always recompute so the report reflects the currently selected rules.

    const baseKpi = computeKPI(sanitized, effectiveRules);

    const kpiValue = Math.round(baseKpi * 10) / 10;

    const exportFlag = isExportDecl(sanitized.so_tk, sanitized.loai_hinh);



    const licenseSnapshot = computeLicenseSnapshot(sanitized, effectiveRules);

    const normalizedLicenseCount = Number.isFinite(licenseSnapshot.includedCount)

      ? licenseSnapshot.includedCount

      : Number.isFinite(sanitized.licenses)

      ? Number(sanitized.licenses)

      : licenseSnapshot.includedCodes.length;



    comparisonRows.push({

      date,

      num_items: sanitized.num_items,

      licenses: Number.isFinite(normalizedLicenseCount) ? normalizedLicenseCount : 0,

      kpi: kpiValue,

      isExport: exportFlag,

    });



    if (start && date < start) continue;

    if (end && date > end) continue;



    const staffKey = normalizeName(sanitized.nhan_vien);

    const staffInfo = staffKey ? memberTeamMap.get(staffKey) : null;

    const staffName = staffInfo?.name || sanitized.nhan_vien || "Chưa gán";

    const rosterTeam = staffInfo?.team;

    let teamName = sanitized.team;

    if (rosterTeam && (!teamName || normalizeName(teamName) !== normalizeName(rosterTeam))) {

      teamName = rosterTeam;

    }

    const teamEntry = ensureTeam(teamName);



    const companyKey = sanitized.mst || sanitized.cong_ty;

    if (companyKey) {

      companyKeys.add(companyKey);

    }



    const hasCO = Boolean(sanitized.has_co);

    const coLineCount = Number(sanitized.co_line_count || 0) || 0;



    const detailRow = {

      date,

      displayDate: formatDisplayDate(date),

      so_tk: sanitized.so_tk,

      mst: sanitized.mst,

      cong_ty: sanitized.cong_ty,

      loai_hinh: sanitized.loai_hinh,

      num_items: sanitized.num_items,

      licenses: Number.isFinite(normalizedLicenseCount) ? normalizedLicenseCount : 0,

      nhan_vien: staffName,

      team: teamEntry.name,

      isExport: exportFlag,

      kpi: kpiValue,

      hasCO,

      coLineCount,

      coLabel: hasCO ? (coLineCount > 0 ? `${coLineCount}` : "Có") : "Không",

      licenseCodes: licenseSnapshot.includedCodes,

      licenseExcludedCodes: licenseSnapshot.excludedCodes,

      licenseSourceCodes: licenseSnapshot.sourceCodes,

      licenseManualCount: licenseSnapshot.manualCount ?? sanitized.licenseManualCount ?? null,

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



  if (Array.isArray(adjustments) && adjustments.length) {

    const startDateObj = start ? new Date(start) : null;

    const endDateObj = end ? new Date(end) : null;

    for (const adj of adjustments) {

      if (!adj) continue;

      const label = KPI_ADJUSTMENT_CATEGORY_CONFIG[adj.category]?.label || normalizeStr(adj.category) || 'Điểm bổ sung';

      const entry = { ...adj, label };

      adjustmentMeta.list.push(entry);

      if (adj.status === 'approved') {

        adjustmentMeta.approvedCount += 1;

      } else if (adj.status === 'pending') {

        adjustmentMeta.pendingCount += 1;

      } else if (adj.status === 'rejected') {

        adjustmentMeta.rejectedCount += 1;

      }

      if (adj.status !== 'approved') {

        continue;

      }

      const month = normalizeStr(adj.month);

      if (!month) continue;

      const candidateDateStr = `${month}-01`;

      const candidateDate = new Date(candidateDateStr);

      if (Number.isNaN(candidateDate.getTime())) continue;

      if (startDateObj && candidateDate < startDateObj) continue;

      if (endDateObj && candidateDate > endDateObj) continue;



      const staffNameRaw = normalizeStr(adj.staffName) || 'Chưa gán';

      const staffKey = normalizeName(staffNameRaw);

      const staffInfo = staffKey ? memberTeamMap.get(staffKey) : null;

      const staffName = staffInfo?.name || staffNameRaw;

      const rosterTeam = staffInfo?.team;

      let teamName = normalizeStr(adj.teamName) || '';

      if (!teamName && rosterTeam) {

        teamName = rosterTeam;

      }

      const teamEntry = ensureTeam(teamName);

      const staffEntry = ensureStaff(staffKey, staffName);

      staffEntry.teams.add(teamEntry.name);

      const memberEntry = ensureTeamMember(teamEntry, staffEntry.key, staffEntry.name);



      const totalPoints = Number(adj.totalPoints || 0);

      const quantityValue = Number(adj.quantity || 0);

      const extraConfig = KPI_ADJUSTMENT_CATEGORY_CONFIG[adj.category]

        ? KPI_ADJUSTMENT_CATEGORY_CONFIG[adj.category].extraPointConfig

        : null;

      const extraQuantity = extraConfig ? Number.parseFloat(adj.extraQuantity ?? 0) || 0 : 0;

      let extraUnitPoints = extraConfig ? Number.parseFloat(adj.extraUnitPoints ?? NaN) : 0;

      if (extraConfig && !Number.isFinite(extraUnitPoints)) {

        extraUnitPoints = Number.isFinite(Number.parseFloat(extraConfig.defaultUnit))

          ? Number.parseFloat(extraConfig.defaultUnit)

          : 0;

      }

      const extraPoints = extraConfig

        ? roundAdjustmentPoint((extraQuantity || 0) * (extraUnitPoints || 0))

        : 0;

      const references = Array.isArray(adj.references)

        ? adj.references.map((ref) => normalizeStr(ref)).filter(Boolean)

        : [];

      const referenceLabel = references.length ? references.join(", ") : label;

      const detailRow = {

        date: candidateDateStr,

        displayDate: `${month}`,

        so_tk: `Điểm bổ sung (${referenceLabel})`,

        mst: normalizeStr(adj.taxCode) || '',

        cong_ty: normalizeStr(adj.companyName) || '',

        loai_hinh: label,

        num_items: 0,

        licenses: 0,

        nhan_vien: staffName,

        team: teamEntry.name,

        isExport: false,

        kpi: totalPoints,

        bonusPoints: extraPoints,

        hasCO: false,

        coLineCount: 0,

        coLabel: 'Không',

        licenseCodes: [],

        licenseExcludedCodes: [],

        isAdjustment: true,

        adjustment: {

          id: adj.id,

          category: adj.category,

          label,

          quantity: adj.quantity,

          unitPoints: adj.unitPoints,

          extraQuantity,

          extraUnitPoints,

          extraPoints,

          references: Array.isArray(adj.references) ? adj.references : [],

          note: normalizeStr(adj.note),

          companyName: normalizeStr(adj.companyName),

          taxCode: normalizeStr(adj.taxCode),

        },

      };



      preparedRows.push(detailRow);



      staffEntry.rows.push(detailRow);

      teamEntry.rows.push(detailRow);

      memberEntry.rows.push(detailRow);



      staffEntry.stats.kpi += totalPoints;

      teamEntry.stats.kpi += totalPoints;

      memberEntry.stats.kpi += totalPoints;

      summaryStats.kpi += totalPoints;



      addAdjustmentTotals(adjustmentMeta.totalsByCategory, adj.category, totalPoints, quantityValue);

      const staffSummary = ensureStaffAdjustmentEntry(

        adjustmentMeta.byStaff,

        staffEntry.key,

        staffEntry.name,

        teamEntry.name

      );

      if (staffSummary) {

        addAdjustmentTotals(staffSummary.totals, adj.category, totalPoints, quantityValue);

      }

      const teamSummary = ensureTeamAdjustmentEntry(adjustmentMeta.byTeam, teamEntry.key, teamEntry.name);

      if (teamSummary) {

        addAdjustmentTotals(teamSummary.totals, adj.category, totalPoints, quantityValue);

      }



      adjustmentMeta.totalPoints += totalPoints;

      adjustmentMeta.appliedCount += 1;

      adjustmentMeta.applied.push({ ...detailRow, staffKey: staffEntry.key });

      comparisonRows.push({ date: candidateDateStr, num_items: 0, licenses: 0, kpi: totalPoints, isExport: false });

    }

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

    const adjustmentEntry = adjustmentMeta.byStaff.get(entry.key);

    return {

      key: entry.key,

      name: entry.name,

      teamNames: Array.from(entry.teams).filter(Boolean),

      teamLabel: entry.teams.size

        ? Array.from(entry.teams).filter(Boolean).join(", ")

        : "Chưa gán tổ đội",

      stats: finalizeStats(entry.stats),

      rows: sorted,

      adjustmentSummary: cloneAdjustmentTotals(adjustmentEntry?.totals),

    };

  }).sort((a, b) => {

    if ((b.stats.kpi || 0) !== (a.stats.kpi || 0)) {

      return (b.stats.kpi || 0) - (a.stats.kpi || 0);

    }

    if ((b.stats.decls || 0) !== (a.stats.decls || 0)) {

      return (b.stats.decls || 0) - (a.stats.decls || 0);

    }

    return a.name.localeCompare(b.name, "vi", { sensitivity: "base" });

  });



  const staffKeys = staffList.map((s) => s.key).join("|");



  const teamList = Array.from(teamMap.values()).map((entry) => {

    const sortedRows = entry.rows.slice().sort((a, b) => {

      if (a.date !== b.date) return b.date.localeCompare(a.date);

      return a.so_tk.localeCompare(b.so_tk, undefined, { numeric: true, sensitivity: "base" });

    });

    const adjustmentEntry = adjustmentMeta.byTeam.get(entry.key);

    const members = Array.from(entry.members.values()).map((member) => ({

      key: member.key,

      name: member.name,

      stats: finalizeStats(member.stats),

      rows: member.rows.slice().sort((a, b) => {

        if (a.date !== b.date) return b.date.localeCompare(a.date);

        return a.so_tk.localeCompare(b.so_tk, undefined, { numeric: true, sensitivity: "base" });

      }),

    })).sort((a, b) => {

      if ((b.stats.kpi || 0) !== (a.stats.kpi || 0)) {

        return (b.stats.kpi || 0) - (a.stats.kpi || 0);

      }

      if ((b.stats.decls || 0) !== (a.stats.decls || 0)) {

        return (b.stats.decls || 0) - (a.stats.decls || 0);

      }

      return a.name.localeCompare(b.name, "vi", { sensitivity: "base" });

    });



    return {

      key: entry.key,

      name: entry.name,

      stats: finalizeStats(entry.stats),

      rows: sortedRows,

      members,

      memberNames: members.map((m) => m.name),

      adjustmentSummary: cloneAdjustmentTotals(adjustmentEntry?.totals),

    };

  }).sort((a, b) => {

    if ((b.stats.kpi || 0) !== (a.stats.kpi || 0)) {

      return (b.stats.kpi || 0) - (a.stats.kpi || 0);

    }

    if ((b.stats.decls || 0) !== (a.stats.decls || 0)) {

      return (b.stats.decls || 0) - (a.stats.decls || 0);

    }

    return a.name.localeCompare(b.name, "vi", { sensitivity: "base" });

  });



  const teamKeys = teamList.map((t) => t.key).join("|");



  const summaryFinal = finalizeStats(summaryStats);

  summaryFinal.adjustmentTotals = cloneAdjustmentTotals(adjustmentMeta.totalsByCategory);

  const summaryLicenseList = summaryFinal.licenseCodes || [];

  const summaryLicenseSummary = summaryLicenseList.join(", ");



  const timelineByMonth = new Map();

  const teamTimelineByMonth = new Map();



  const registerTimeline = (row) => {

    const monthKey = row.date ? row.date.slice(0, 7) : "";

    if (!monthKey) return;

    if (!timelineByMonth.has(monthKey)) {

      timelineByMonth.set(monthKey, { key: monthKey, label: formatMonthLabel(monthKey), stats: createStats() });

    }

    accumulate(timelineByMonth.get(monthKey).stats, row);



    if (!teamTimelineByMonth.has(monthKey)) {

      teamTimelineByMonth.set(monthKey, new Map());

    }

    const monthTeamMap = teamTimelineByMonth.get(monthKey);

    const teamName = row.team || "Chưa gán tổ đội";

    if (!monthTeamMap.has(teamName)) {

      monthTeamMap.set(teamName, createStats());

    }

    accumulate(monthTeamMap.get(teamName), row);

  };



  preparedRows.forEach(registerTimeline);



  const sortedTimeline = Array.from(timelineByMonth.values()).sort((a, b) => a.key.localeCompare(b.key));

  const recentTimeline = sortedTimeline.slice(-6);

  const trendSeries = recentTimeline.map((entry) => ({

    period: entry.label,

    kpi: Math.round(entry.stats.kpi * 10) / 10,

    decls: entry.stats.decls,

    items: entry.stats.items,

    licenses: entry.stats.licenses,

  }));



  const topTeamNames = teamList.slice(0, 3).map((team) => team.name);

  const teamTrendSeries = recentTimeline.map((entry) => {

    const monthTeams = teamTimelineByMonth.get(entry.key) || new Map();

    const row = { period: entry.label };

    for (const teamName of topTeamNames) {

      const stats = monthTeams.get(teamName);

      row[teamName] = stats ? Math.round(stats.kpi * 10) / 10 : 0;

    }

    row.Tổng = Math.round(entry.stats.kpi * 10) / 10;

    return row;

  });



  const computeStatsInRange = (fromISO, toISO) => {

    const fromTs = fromISO ? new Date(fromISO).getTime() : Number.NEGATIVE_INFINITY;

    const toTs = toISO ? new Date(toISO).getTime() : Number.POSITIVE_INFINITY;

    const stats = createStats();

    for (const row of comparisonRows) {

      const ts = row.date ? new Date(row.date).getTime() : Number.NaN;

      if (Number.isNaN(ts)) continue;

      if (ts < fromTs || ts > toTs) continue;

      accumulate(stats, row);

    }

    return finalizeStats(stats);

  };



  let comparison = null;

  if (start && end) {

    const startDate = new Date(start);

    const endDate = new Date(end);

    if (!Number.isNaN(startDate) && !Number.isNaN(endDate)) {

      const rangeMs = endDate.getTime() - startDate.getTime() + 24 * 60 * 60 * 1000;

      const prevEnd = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);

      const prevStart = new Date(prevEnd.getTime() - rangeMs + 24 * 60 * 60 * 1000);

      const prevFromISO = formatISO(prevStart);

      const prevToISO = formatISO(prevEnd);

      const currentStats = finalizeStats(summaryStats);

      const previousStats = computeStatsInRange(prevFromISO, prevToISO);

      comparison = {

        current: currentStats,

        previous: previousStats,

        delta: {

          kpi: Math.round((currentStats.kpi - previousStats.kpi) * 10) / 10,

          kpiPercent:

            previousStats.kpi > 0

              ? Math.round(((currentStats.kpi - previousStats.kpi) / previousStats.kpi) * 1000) / 10

              : null,

          decls: currentStats.decls - previousStats.decls,

        },

      };

    }

  }



  const staffAdjustmentSummaries = Array.from(adjustmentMeta.byStaff.values()).map((entry) => ({

    key: entry.key,

    name: entry.name,

    teams: Array.from(entry.teamNames || []),

    totals: cloneAdjustmentTotals(entry.totals),

  }));

  const teamAdjustmentSummaries = Array.from(adjustmentMeta.byTeam.values()).map((entry) => ({

    key: entry.key,

    name: entry.name,

    totals: cloneAdjustmentTotals(entry.totals),

  }));

  adjustmentMeta.staffSummaries = staffAdjustmentSummaries;

  adjustmentMeta.teamSummaries = teamAdjustmentSummaries;

  adjustmentMeta.totalsByCategory = cloneAdjustmentTotals(adjustmentMeta.totalsByCategory);

  delete adjustmentMeta.byStaff;

  delete adjustmentMeta.byTeam;



  return {

    rows: sortedRows,

    summary: {

      ...summaryFinal,

      companyCount: companyKeys.size,

      licenseSummary: summaryLicenseSummary || "—",

    },

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

    trend: {

      series: trendSeries,

      teamSeries: teamTrendSeries,

      comparison,

      topTeams: topTeamNames,

    },

    adjustments: adjustmentMeta,

  };

}



export function aggregateByCompany(rows, options = {}) {

  const {

    includeStaff = false,

    includeTeam = false,

  } = options;



  if (!Array.isArray(rows) || rows.length === 0) {

    return [];

  }



  const map = new Map();



  for (const row of rows) {

    if (!row) continue;

    const mst = normalizeStr(row.mst) || "";

    const company = normalizeStr(row.cong_ty) || "";

    const staffName = includeStaff ? normalizeStr(row.nhan_vien) || "Chưa gán" : "";

    const teamName = includeTeam ? normalizeStr(row.team) || "Chưa gán tổ đội" : "";



    const keyParts = [mst, company];

    if (includeTeam) keyParts.push(teamName);

    if (includeStaff) keyParts.push(staffName);

    const key = keyParts.join("|#|");



    if (!map.has(key)) {

      map.set(key, {

        mst: mst || row.mst || "",

        cong_ty: company || row.cong_ty || "",

        staff: includeStaff ? (row.nhan_vien || "Chưa gán") : undefined,

        team: includeTeam ? (row.team || "Chưa gán tổ đội") : undefined,

        decls: 0,

        items: 0,

        licenses: 0,

        kpi: 0,

        loai_hinh: new Set(),

        modes: new Set(),

        co: 0,

        coLines: 0,

        licenseCodes: new Set(),

        licenseExcluded: new Set(),

      });

    }



    const entry = map.get(key);

    entry.decls += 1;

    entry.items += Number(row.num_items || 0);

    entry.licenses += Number(row.licenses || 0);

    entry.kpi += Number(row.kpi || 0);



    if (row.loai_hinh) {

      entry.loai_hinh.add(row.loai_hinh);

    }

    if (row.isExport === true) {

      entry.modes.add("Xuất");

    } else if (row.isExport === false) {

      entry.modes.add("Nhập");

    }



    if (row.hasCO) {

      entry.co += 1;

    }

    const coLines = Number(row.coLineCount || row.co_line_count || 0);

    if (Number.isFinite(coLines)) {

      entry.coLines += coLines;

    }



    if (entry.licenseCodes instanceof Set) {

      const codes = Array.isArray(row.licenseCodes) ? row.licenseCodes : [];

      for (const code of codes) {

        const normalized = normalizeStr(code).toUpperCase();

        if (normalized) {

          entry.licenseCodes.add(normalized);

        }

      }

    }



    if (entry.licenseExcluded instanceof Set) {

      const excluded = Array.isArray(row.licenseExcludedCodes) ? row.licenseExcludedCodes : [];

      for (const code of excluded) {

        const normalized = normalizeStr(code).toUpperCase();

        if (normalized) {

          entry.licenseExcluded.add(normalized);

        }

      }

    }

  }



  return Array.from(map.values()).map((entry) => {

    const licenseCodes = Array.from(entry.licenseCodes || []);

    const licenseExcluded = Array.from(entry.licenseExcluded || []);

    const licenseSummary = licenseCodes.join(", ");

    const excludedSummary = licenseExcluded.join(", ");

    const tooltipParts = [];

    if (licenseSummary) {

      tooltipParts.push(`Áp dụng: ${licenseSummary}`);

    }

    if (licenseExcluded.length) {

      tooltipParts.push(`Loại trừ: ${excludedSummary}`);

    }

    return {

      mst: entry.mst,

      cong_ty: entry.cong_ty,

      staff: entry.staff,

      team: entry.team,

      decls: entry.decls,

      items: entry.items,

      licenses: entry.licenses,

      kpi: Math.round(entry.kpi * 10) / 10,

      loai_hinh: Array.from(entry.loai_hinh).join(", ") || "—",

      modes: Array.from(entry.modes).join(", ") || "—",

      co: entry.co,

      coLines: entry.coLines,

      licenseCodes,

      licenseExcluded,

      licenseSummary: licenseSummary || "—",

      licenseTooltip: tooltipParts.join("\n") || "—",

    };

  }).sort((a, b) => {

    if (b.kpi !== a.kpi) return b.kpi - a.kpi;

    if (b.decls !== a.decls) return b.decls - a.decls;

    return (a.cong_ty || "").localeCompare(b.cong_ty || "", "vi", { sensitivity: "base" });

  });

}



export default {

  QUICK_RANGE_OPTIONS,

  computeQuickRange,

  buildReportData,

  aggregateByCompany,

};



