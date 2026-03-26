import * as XLSX from "xlsx";

const normalize = (value = "") =>
  value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export const headerAliases = {
  mst: ["mst", "mã số thuế", "ma so thue", "mã số thuế (mst)"],
  company: ["company", "công ty", "ten cong ty", "doanh nghiep"],
  person_import: ["person_import", "người phụ trách nhập", "nguoi phu trach nhap", "nhap"],
  person_export: ["person_export", "người phụ trách xuất", "nguoi phu trach xuat", "xuat"],
  team: ["team", "tổ đội", "to doi", "nhom", "group"],
  effective_from: [
    "effective_from",
    "áp dụng từ ngày",
    "ap dung tu ngay",
    "apply_from",
    "effective from",
  ],
  effective_to: ["effective_to", "đến hết ngày", "den het ngay", "apply_to", "effective to"],
  status: ["status", "trạng thái", "trang thai", "ghi chu trang thai", "tinh trang"],
};

export const toISO = (value) => {
  if (!value) return "";

  if (value instanceof Date && !Number.isNaN(value)) {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, "0");
    const day = `${value.getDate()}`.padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return "";

    const year = date.y;
    const month = `${date.m}`.padStart(2, "0");
    const day = `${date.d}`.padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  const raw = value.toString().trim();
  const ddMmYyyy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (ddMmYyyy) {
    const day = ddMmYyyy[1].padStart(2, "0");
    const month = ddMmYyyy[2].padStart(2, "0");
    const year = ddMmYyyy[3];

    return `${year}-${month}-${day}`;
  }

  const yyyyMmDd = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (yyyyMmDd) {
    const year = yyyyMmDd[1];
    const month = yyyyMmDd[2].padStart(2, "0");
    const day = yyyyMmDd[3].padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  return "";
};

export const findCell = (row, key) => {
  const wanted = headerAliases[key] || [key];
  const keys = Object.keys(row || {});

  for (const alias of wanted) {
    const hit = keys.find((candidate) => normalize(candidate) === normalize(alias));
    if (hit) {
      return row[hit];
    }
  }

  return "";
};
