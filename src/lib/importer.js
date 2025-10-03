import {
  normalizeStr,
  normalizeMST,
  toISODate,
  getMSTFor,
  isExportDecl,
  normalizeName,
} from "@/lib/store.js";
import { loadRules, countLicenseTypesFromRowObj, extractLicenseCodesFromRowObj } from "@/lib/rules.js";
import { deriveCOStatus, parseCoLineCount } from "@/shared/co.js";

const NAME_MAP = {
  so_tk: [
    "Số TK",
    "Số tờ khai",
    "So TK",
    "So to khai",
    "Số tờ khai TM",
    "Số tờ khai TM ",
    "Số tờ khai xuất nhập khẩu",
  ],
  nhanh: ["Nhánh", "Nhanh", "branch"],
  date: ["date", "ngày", "Ngay", "Ngày", "Ngày đăng ký", "Ngay dang ky"],
  ma_hq: ["Mã HQ", "Ma HQ", "Mã hq", "ma_hq"],
  loai_hinh: [
    "Loại hình",
    "Loai hinh",
    "Loại hình",
    "loai_hinh",
    "Mã loại hình",
    "Ma loai hinh",
    "MA_LH",
    "ma_lh",
  ],
  so_hoa_don: ["Số hóa đơn TM", "So hoa don TM", "Số hoá đơn TM"],
  van_don: ["Vận đơn", "Van don", "Vận đơn "],
  phuong_thuc_vc: ["Phương thức vận chuyển", "Phuong thuc van chuyen"],
  so_luong_kien: ["Số lượng kiện", "So luong kien"],
  gross: ["Tổng trọng lượng hàng (Gross)", "Tong trong luong hang (Gross)"],
  so_luong: ["Số lượng", "So luong"],
  phan_luong: ["Phân luồng", "Phan luong"],
  muc_hang: [
    "Mục hàng",
    "Muc hang",
    "num_items",
    "Số mục hàng",
    "So muc hang",
    "TotalItems",
    "totalitems",
  ],
  mst: ["MST", "mst", "Mã số thuế", "Ma so thue"],
  cong_ty: ["Công ty", "Cong ty", "customer", "Tên doanh nghiệp", "Ten doanh nghiep"],
  agency: ["Đại lý", "Đại lý HQ", "Dai ly", "Dai ly HQ", "Agency"],
  co_line_count: [
    "Dòng hàng áp C/O",
    "Dong hang ap C/O",
    "Dòng hàng áp CO",
    "Dong hang ap CO",
    "Dòng C/O",
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
    "Số dòng C/O",
    "So dong C/O",
    "Số dòng áp C/O",
    "So dong ap C/O",
  ],
};

function pick(row, keys) {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(row, k)) return row[k];
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
  const so_tk = normalizeStr(pick(row, NAME_MAP.so_tk));
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

  let nhan_vien = normalizeStr(row["nhan_vien"] || row["Nhân viên"] || "");
  let team = normalizeStr(row["team"] || row["Tổ đội"] || "");
  const autoAssignStaff = opts.autoAssignStaff !== false;
  const agencyMap = opts.agencyMap instanceof Map ? opts.agencyMap : null;
  const licenseExcludeRaw = Array.isArray(opts.licenseExcludes)
    ? opts.licenseExcludes
    : (opts.rules?.license?.exclude?.codes
        || loadRules()?.license?.exclude?.codes
        || []);
  const excludeSet = new Set(
    licenseExcludeRaw
      .map((code) => String(code || '').trim().toUpperCase())
      .filter(Boolean)
  );
  const rawLicenseCodes = extractLicenseCodesFromRowObj(row)
    .map((code) => String(code || '').trim().toUpperCase())
    .filter(Boolean);
  const uniqueCodes = Array.from(new Set(rawLicenseCodes));
  const licenses = uniqueCodes.length
    ? uniqueCodes.filter((code) => !excludeSet.has(code)).length
    : countLicenseTypesFromRowObj(row, Array.from(excludeSet));

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

  const base = {
    date: dateISO,
    raw_date: normalizeStr(rawDate),
    so_tk,
    soToKhai: so_tk,
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
    licenseCodes: uniqueCodes,
    co_line_count,
  };
  return deriveCOStatus(row, base);
}
