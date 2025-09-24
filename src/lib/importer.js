import {
  normalizeStr,
  normalizeMST,
  toISODate,
  getMSTFor,
  isExportDecl,
  normalizeName,
} from "@/lib/store.js";
import { loadRules, countLicenseTypesFromRowObj } from "@/lib/rules.js";
} from "@/lib/store.js";

const NAME_MAP = {
  so_tk: ["Số TK", "Số tờ khai", "So TK", "So to khai", "Số tờ khai TM", "Số tờ khai TM "],
  nhanh: ["Nhánh", "Nhanh", "branch"],
  date: ["date", "ngày", "Ngay", "Ngày"],
  ma_hq: ["Mã HQ", "Ma HQ", "Mã hq", "ma_hq"],
  loai_hinh: ["Loại hình", "Loai hinh", "Loại hình", "loai_hinh"],
  so_hoa_don: ["Số hóa đơn TM", "So hoa don TM", "Số hoá đơn TM"],
  van_don: ["Vận đơn", "Van don", "Vận đơn "],
  phuong_thuc_vc: ["Phương thức vận chuyển", "Phuong thuc van chuyen"],
  so_luong_kien: ["Số lượng kiện", "So luong kien"],
  gross: ["Tổng trọng lượng hàng (Gross)", "Tong trong luong hang (Gross)"],
  so_luong: ["Số lượng", "So luong"],
  phan_luong: ["Phân luồng", "Phan luong"],
  muc_hang: ["Mục hàng", "Muc hang", "num_items"],
  mst: ["MST", "mst"],
  cong_ty: ["Công ty", "Cong ty", "customer"],
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
export function mapRow(row, opts) {
  const so_tk = normalizeStr(pick(row, NAME_MAP.so_tk));
  const nhanh = normalizeStr(pick(row, NAME_MAP.nhanh));
  const dateISO = toISODate(pick(row, NAME_MAP.date));
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
  const cong_ty = normalizeStr(pick(row, NAME_MAP.cong_ty));

  let nhan_vien = normalizeStr(row["nhan_vien"] || row["Nhân viên"] || "");
  let team = normalizeStr(row["team"] || row["Tổ đội"] || "");
  const autoAssignStaff = opts.autoAssignStaff !== false;

  const licenseExcludes = Array.isArray(opts.licenseExcludes)
    ? opts.licenseExcludes
    : (opts.rules?.license?.excludeCodes
        || loadRules()?.license?.excludeCodes
        || []);
  const licenses = countLicenseTypesFromRowObj(row, licenseExcludes);

  if (autoAssignStaff) {

  if (opts.autoAssignStaff) {
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

  return {
    date: dateISO,
    raw_date: normalizeStr(rawDate),
  return {
    date: dateISO,
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
    licenses,
    so_luong_gp: licenses,
  };
}
