import {
  normalizeStr,
  normalizeMST,
  normalizeDeclarationNumber,
  toISODate,
  getMSTFor,
  isExportDecl,
  normalizeName,
} from "@/lib/store.js";
import { loadRules, countLicenseTypesFromRowObj, extractLicenseCodesFromRowObj } from "@/lib/rules.js";
import { deriveCOStatus, parseCoLineCount } from "@/shared/co.js";

const normalizeCodeValue = (value) => String(value ?? "").trim().toUpperCase();
const normalizeLookupKey = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[\s]+/g, " ")
    .trim();

const NAME_MAP = {
  so_tk: [
    "Sá»‘ TK",
    "Sá»‘ tá» khai",
    "So TK",
    "So to khai",
    "Sá»‘ tá» khai TM",
    "Sá»‘ tá» khai TM ",
    "Sá»‘ tá» khai xuáº¥t nháº­p kháº©u",
  ],nhanh: ["NhÃ¡nh", "Nhanh", "branch"],
  date: ["date", "ngÃ y", "Ngay", "NgÃ y", "NgÃ y Ä‘Äƒng kÃ½", "Ngay dang ky"],
  ma_hq: ["MÃ£ HQ", "Ma HQ", "MÃ£ hq", "ma_hq"],
  loai_hinh: [
    "Loáº¡i hÃ¬nh",
    "Loai hinh",
    "Loáº¡i hÃ¬nh",
    "loai_hinh",
    "MÃ£ loáº¡i hÃ¬nh",
    "Ma loai hinh",
    "MA_LH",
    "ma_lh",
  ],
  so_hoa_don: ["Sá»‘ hÃ³a Ä‘Æ¡n TM", "So hoa don TM", "Sá»‘ hoÃ¡ Ä‘Æ¡n TM"],
  van_don: ["Váº­n Ä‘Æ¡n", "Van don", "Váº­n Ä‘Æ¡n "],
  phuong_thuc_vc: ["PhÆ°Æ¡ng thá»©c váº­n chuyá»ƒn", "Phuong thuc van chuyen"],
  so_luong_kien: ["Sá»‘ lÆ°á»£ng kiá»‡n", "So luong kien"],
  gross: ["Tá»•ng trá»ng lÆ°á»£ng hÃ ng (Gross)", "Tong trong luong hang (Gross)"],
  so_luong: ["Sá»‘ lÆ°á»£ng", "So luong"],
  phan_luong: ["PhÃ¢n luá»“ng", "Phan luong"],
  muc_hang: [
    "Má»¥c hÃ ng",
    "Muc hang",
    "num_items",
    "Sá»‘ má»¥c hÃ ng",
    "So muc hang",
    "TotalItems",
    "totalitems",
  ],
  mst: ["MST", "mst", "MÃ£ sá»‘ thuáº¿", "Ma so thue"],
  cong_ty: ["CÃ´ng ty", "Cong ty", "customer", "TÃªn doanh nghiá»‡p", "Ten doanh nghiep"],
  agency: ["Äáº¡i lÃ½", "Äáº¡i lÃ½ HQ", "Dai ly", "Dai ly HQ", "Agency"],
  co_line_count: [
    "DÃ²ng hÃ ng Ã¡p C/O",
    "Dong hang ap C/O",
    "DÃ²ng hÃ ng Ã¡p CO",
    "Dong hang ap CO",
    "DÃ²ng C/O",
    "Dong CO",
    "CO Lines",
    "CO Line Count",
    "co_line_count",
    "coLineCount",
    "co_lines",
    "coLines",
    "co_line",
    "CO_Count",
    "COCount",
    "Sá»‘ dÃ²ng C/O",
    "So dong C/O",
    "Sá»‘ dÃ²ng Ã¡p C/O",
    "So dong ap C/O",
  ],
};

function pick(row, keys) {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(row, k)) return row[k];
  }
  if (!row || typeof row !== "object") return "";
  const lookup = new Map();
  for (const actualKey of Object.keys(row)) {
    const normalized = normalizeLookupKey(actualKey);
    if (!normalized || lookup.has(normalized)) continue;
    lookup.set(normalized, actualKey);
  }
  for (const candidate of keys) {
    const normalizedCandidate = normalizeLookupKey(candidate);
    const actual = lookup.get(normalizedCandidate);
    if (actual !== undefined) {
      return row[actual];
    }
  }
  return "";
}

export function detectDateOrder(rows) {
  let monthFirst = 0;
  let dayFirst = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== "object") continue;
    const raw = normalizeStr(pick(row, NAME_MAP.date));
    if (!raw) continue;

    const isoLike = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
    if (isoLike) {
      const monthVal = Number.parseInt(isoLike[2], 10);
      const dayVal = Number.parseInt(isoLike[3], 10);
      if (monthVal > 12 && dayVal >= 1 && dayVal <= 12) {
        dayFirst += 1;
      } else if (dayVal > 12 && monthVal >= 1 && monthVal <= 12) {
        monthFirst += 1;
      } else if (dayVal > 12 && monthVal > 12) {
        monthFirst += 1;
      }
      continue;
    }

    const slashLike = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:[ T].*)?$/);
    if (!slashLike) continue;
    const first = Number.parseInt(slashLike[1], 10);
    const second = Number.parseInt(slashLike[2], 10);
    if (first > 12 && second <= 12) {
      dayFirst += 1;
    } else if (second > 12 && first <= 12) {
      monthFirst += 1;
    }
  }

  if (monthFirst > dayFirst) return "mdy";
  if (dayFirst > monthFirst) return "dmy";
  return "dmy";
}

export function mapRow(row, opts = {}) {

  const so_tk_full = normalizeStr(pick(row, NAME_MAP.so_tk));
  const so_tk = normalizeDeclarationNumber(so_tk_full);
  const nhanh = normalizeStr(pick(row, NAME_MAP.nhanh));
  const rawDate = pick(row, NAME_MAP.date);
  const dateISO = toISODate(rawDate, { preferMonthFirst: opts.preferMonthFirst });
  const ma_hq = normalizeStr(pick(row, NAME_MAP.ma_hq));
  const loai_hinh = normalizeStr(pick(row, NAME_MAP.loai_hinh));
  const so_hoa_don = normalizeStr(pick(row, NAME_MAP.so_hoa_don));
  const van_don = normalizeStr(pick(row, NAME_MAP.van_don));
  const phuong_thuc_vc = normalizeStr(pick(row, NAME_MAP.phuong_thuc_vc));
  const so_luong_kien = Number(pick(row, NAME_MAP.so_luong_kien)) || 0;
  const gross = Number(String(pick(row, NAME_MAP.gross)).replaceAll(",", "")) || 0;
  const so_luong = Number(pick(row, NAME_MAP.so_luong)) || 0;
  const phan_luong = normalizeStr(pick(row, NAME_MAP.phan_luong));
  const muc_hang = Number(pick(row, NAME_MAP.muc_hang)) || 0;
  const mst = normalizeMST(pick(row, NAME_MAP.mst));
  let cong_ty = normalizeStr(pick(row, NAME_MAP.cong_ty));
  let agency = normalizeStr(pick(row, NAME_MAP.agency));

  let nhan_vien = normalizeStr(row["nhan_vien"] || row["NhÃ¢n viÃªn"] || "");
  let team = normalizeStr(row["team"] || row["Tá»• Ä‘á»™i"] || "");
  const autoAssignStaff = opts.autoAssignStaff !== false;
  const agencyMap = opts.agencyMap instanceof Map ? opts.agencyMap : null;
  const ruleLicenseConfig = opts.rules?.license || null;
  const licenseExcludeRaw = Array.isArray(opts.licenseExcludes)
    ? opts.licenseExcludes
    : (ruleLicenseConfig?.exclude?.codes
        || loadRules()?.license?.exclude?.codes
        || []);
  const excludeSet = new Set(
    licenseExcludeRaw
      .map(normalizeCodeValue)
      .filter(Boolean)
  );
  const agencyExcludeMap = new Map();
  const ruleAgencyExclude = Array.isArray(ruleLicenseConfig?.exclude?.agencies)
    ? ruleLicenseConfig.exclude.agencies
    : [];
  for (const entry of ruleAgencyExclude) {
    if (!entry) continue;
    const agencyKey = normalizeCodeValue(entry.agency);
    if (!agencyKey) continue;
    const codes = (Array.isArray(entry.codes) ? entry.codes : [])
      .map(normalizeCodeValue)
      .filter(Boolean);
    if (!codes.length) continue;
    agencyExcludeMap.set(agencyKey, new Set(codes));
  }
  const rawLicenseCodes = extractLicenseCodesFromRowObj(row)
    .map((code) => String(code || '').trim().toUpperCase())
    .filter(Boolean);
  const uniqueCodes = Array.from(new Set(rawLicenseCodes));
  const coLineCandidates = [
    NAME_MAP.co_line_count ? pick(row, NAME_MAP.co_line_count) : "",
    row.co_line_count,
    row.coLineCount,
    row.co_lines,
    row.coLines,
  ];
  let co_line_count = 0;
  for (const candidate of coLineCandidates) {
    const parsed = parseCoLineCount(candidate);
    if (parsed > 0) {
      co_line_count = parsed;
      break;
    }
  }

  if (autoAssignStaff) {
    const isExport = isExportDecl(so_tk, loai_hinh);
    const m = getMSTFor(mst, dateISO) || {};
    if (!nhan_vien) nhan_vien = isExport ? m.person_export || "" : m.person_import || "";
    if (!team) team = m.team || "";
  }

  if (nhan_vien && opts.memberMap instanceof Map) {
    const info = opts.memberMap.get(normalizeName(nhan_vien));
    if (info?.team) {
      if (!team || normalizeName(team) !== normalizeName(info.team)) {
        team = info.team;
      }
    }
  }

  if (agencyMap && mst) {
    const info = agencyMap.get(mst);
    if (info) {
      if (!agency) {
        agency = info.agent || "";
      }
      if (info.company && normalizeStr(cong_ty) !== info.company) {
        cong_ty = info.company;
      }
    }
  }

  if (!so_tk || !dateISO) {
    return null;
  }

  const agencyKeyNormalized = normalizeCodeValue(agency);
  const combinedExcludeSet = agencyKeyNormalized && agencyExcludeMap.has(agencyKeyNormalized)
    ? new Set([...excludeSet, ...agencyExcludeMap.get(agencyKeyNormalized)])
    : excludeSet;

  const excludedCodes = uniqueCodes.filter((code) => combinedExcludeSet.has(code));
  const effectiveCodes = uniqueCodes.filter((code) => !combinedExcludeSet.has(code));

  const licenses = uniqueCodes.length
    ? effectiveCodes.length
    : countLicenseTypesFromRowObj(row, Array.from(combinedExcludeSet));

  const base = {
    date: dateISO,
    raw_date: normalizeStr(rawDate),
    so_tk,
    so_tk_full,
    so_tk_suffix: so_tk_full.slice(so_tk.length),
    soToKhai: so_tk_full || so_tk,
    nhanh,
    ma_hq,
    loai_hinh,
    loaiHinh: loai_hinh,
    so_hoa_don,
    van_don,
    phuong_thuc_vc,
    so_luong_kien,
    gross,
    so_luong,
    phan_luong,
    muc_hang,
    num_items: muc_hang,
    mst,
    cong_ty,
    customer: cong_ty,
    nhan_vien,
    team,
    agency,
    dai_ly: agency,
    licenses,
    so_luong_gp: licenses,
    licenseCodes: effectiveCodes,
    licenseSourceCodes: uniqueCodes,
    licenseExcludedCodes: excludedCodes,
    co_line_count,
  };
  return deriveCOStatus(row, base);
}
