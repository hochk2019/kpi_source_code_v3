import { saveDeclRows, sortDeclRows } from "../lib/store.js";
import { computeKPI, loadRules } from "../lib/rules.js";

function pad(number, length = 2) {
  return String(number).padStart(length, "0");
}

function formatISODate(date) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
}

function rotate(array, index) {
  if (!Array.isArray(array) || !array.length) return undefined;
  return array[index % array.length];
}

function computeEffectiveLicenses(codes, globalExclude) {
  if (!Array.isArray(codes) || !codes.length) return 0;
  const exclude = new Set(globalExclude.map((code) => String(code || "").trim().toUpperCase()));
  const unique = Array.from(
    new Set(
      codes.map((code) => String(code || "").trim().toUpperCase()).filter(Boolean)
    )
  );
  return unique.filter((code) => !exclude.has(code)).length;
}

export function generateSampleDeclarations({
  count = 100,
  startYear = 2024,
  startMonth = 7, // Tháng 8 (0-index)
  rules: inputRules = null,
} = {}) {
  const rules = inputRules || loadRules();
  const rows = [];

  const groupDefinitions = [
    {
      key: "group1",
      types: rules?.groups?.group1?.codes || ["E11", "E15"],
      baseSoTk: "10",
      staff: ["Lan", "Minh"],
      team: ["Nhập 1", "Nhập 2"],
    },
    {
      key: "group2",
      types: rules?.groups?.group2?.codes || ["E41", "B13"],
      baseSoTk: "30",
      staff: ["Phúc", "Hoa"],
      team: ["Kiểm hóa", "Hỗ trợ"],
    },
    {
      key: "group3",
      types: rules?.groups?.group3?.codes || ["A11", "H11"],
      baseSoTk: "10",
      staff: ["Tùng", "Trang"],
      team: ["Thuế", "Tư vấn"],
    },
  ];

  const licenseCombos = [
    ["ZB02"],
    ["ZB03"],
    ["ZB02", "ZB03"],
    ["ZC01"],
    ["ZB02", "ZC01"],
    ["ZB99"],
    ["ZN02"], // mã bị loại trừ toàn cục
    ["HDGC"],
    [],
  ];

  const agencyOptions = ["", "G&B", "JNB", "FWD", "LOGI"].map((name) => name || "");
  const companies = ["Công ty Ánh Dương", "Công ty Bình Minh", "Công ty Delta", "Công ty Sao Mai"];
  const msts = ["0101234567", "0107654321", "0201112222", "0203334444"]; // sẽ xoay vòng

  const globalExclude = rules?.license?.exclude?.codes || [];

  for (let index = 0; index < count; index += 1) {
    const group = groupDefinitions[index % groupDefinitions.length];
    const type = rotate(group.types, index) || rotate(groupDefinitions[0].types, index) || "E11";
    const baseDate = new Date(startYear, startMonth + Math.floor(index / Math.ceil(count / 2)), 1);
    const date = new Date(baseDate);
    date.setDate((index % 30) + 1);
    const isoDate = formatISODate(date);

    const soTkPrefix = group.baseSoTk === "30" && index % 2 === 0 ? "30" : "10";
    const soTk = `${soTkPrefix}${pad(index + 1, 9)}`;

    const numItems = 1 + (index % 12);
    const agency = rotate(agencyOptions, index) || "";
    const staff = rotate(group.staff, index) || "Nhân viên";
    const team = rotate(group.team, index) || "Tổ đội";
    const company = rotate(companies, index) || companies[0];
    const mst = rotate(msts, index) || msts[0];

    const licenseChoice = rotate(licenseCombos, index);
    let licenseCodes = Array.isArray(licenseChoice)
      ? licenseChoice.map((code) => String(code || "").trim().toUpperCase()).filter(Boolean)
      : [];

    let licenses = computeEffectiveLicenses(licenseCodes, globalExclude);

    if (index % 10 === 0) {
      // Một vài dòng chỉ lưu số giấy phép (không có mã)
      licenseCodes = [];
      licenses = (index % 3) + 1;
    }

    const hasCO = index % 3 === 0;
    const coLabel = hasCO ? "Có" : "";
    const coLines = hasCO ? (index % 5) + 1 : 0;

    const row = {
      date: isoDate,
      raw_date: isoDate.split("-").reverse().join("/"),
      so_tk: soTk,
      soToKhai: soTk,
      loai_hinh: type,
      loaiHinh: type,
      num_items: numItems,
      muc_hang: numItems,
      mst,
      cong_ty: company,
      customer: company,
      agency,
      dai_ly: agency,
      nhan_vien: staff,
      team,
      licenses,
      so_luong_gp: licenses,
      licenseCodes,
      has_co: hasCO,
      co: coLabel,
      co_line_count: coLines,
    };

    row.kpi = computeKPI(row, rules);
    row.updatedAt = new Date().toISOString();

    rows.push(row);
  }

  return sortDeclRows(rows);
}

export function seedSampleDeclarations({ actor = "system", count = 100, rules = null } = {}) {
  const generated = generateSampleDeclarations({ count, rules });
  saveDeclRows(generated, {
    overwrite: true,
    actor,
    detail: `Sinh ${generated.length} tờ khai mẫu (tháng 8-9)`,
  });
  return generated;
}
