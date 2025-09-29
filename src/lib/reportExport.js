import { aggregateByCompany } from "@/lib/reports.js";

let excelJsPromise;
async function loadExcelJs() {
  if (!excelJsPromise) {
    excelJsPromise = import("exceljs");
  }
  const module = await excelJsPromise;
  return module?.default ?? module;
}

function ensureWindow() {
  if (typeof window === "undefined") {
    throw new Error("Excel export chỉ khả dụng trong trình duyệt.");
  }
}

function formatRangeLabel(range) {
  if (!range || (!range.from && !range.to)) {
    return "Tất cả dữ liệu";
  }
  if (range.from && range.to) {
    return `${range.from} → ${range.to}`;
  }
  if (range.from) return `Từ ${range.from}`;
  if (range.to) return `Đến ${range.to}`;
  return "Tất cả dữ liệu";
}

async function downloadWorkbook(workbook, filename) {
  ensureWindow();
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function applyHeader(sheet, title, subtitleLines = []) {
  sheet.mergeCells("A1", "K1");
  const cell = sheet.getCell("A1");
  cell.value = title;
  cell.font = { bold: true, size: 16 };
  cell.alignment = { vertical: "middle", horizontal: "center" };

  subtitleLines.forEach((text, idx) => {
    const rowIndex = 2 + idx;
    sheet.mergeCells(`A${rowIndex}:K${rowIndex}`);
    const subtitleCell = sheet.getCell(rowIndex, 1);
    subtitleCell.value = text;
    subtitleCell.alignment = { vertical: "middle", horizontal: "center" };
    subtitleCell.font = { size: 12 };
  });
}

function configureSheet(sheet) {
  sheet.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
  sheet.columns = [
    { key: "colA", width: 6 },
    { key: "colB", width: 28 },
    { key: "colC", width: 16 },
    { key: "colD", width: 16 },
    { key: "colE", width: 16 },
    { key: "colF", width: 16 },
    { key: "colG", width: 16 },
    { key: "colH", width: 16 },
    { key: "colI", width: 16 },
    { key: "colJ", width: 16 },
    { key: "colK", width: 16 },
  ];
}

function addTableHeader(sheet, startRow, headers) {
  const row = sheet.getRow(startRow);
  headers.forEach((text, idx) => {
    const cell = row.getCell(idx + 1);
    cell.value = text;
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  row.height = 24;
}

function addDataRows(sheet, startRow, rows) {
  let current = startRow;
  rows.forEach((values) => {
    const row = sheet.getRow(current);
    values.forEach((value, idx) => {
      const cell = row.getCell(idx + 1);
      cell.value = value;
      cell.alignment = { vertical: "middle", horizontal: idx === 0 ? "center" : "left", wrapText: true };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
    row.commit();
    current += 1;
  });
  return current;
}

function buildSummaryRows(stats) {
  return [
    ["1", "Tổng số tờ khai", stats.decls || 0, "", "", "", "", "", ""],
    ["2", "Tổng điểm KPI", stats.kpi || 0, "", "", "", "", "", ""],
    ["3", "Tờ khai nhập", stats.import || 0, "", "", "", "", "", ""],
    ["4", "Tờ khai xuất", stats.export || 0, "", "", "", "", "", ""],
    ["5", "Tổng mục hàng", stats.items || 0, "", "", "", "", "", ""],
    ["6", "Số giấy phép hợp lệ", stats.licenses || 0, "", "", "", "", "", ""],
  ];
}

function buildCompanyRows(rows, options = {}) {
  const { includeStaff = false, includeTeam = false } = options;
  const aggregated = aggregateByCompany(rows, { includeStaff, includeTeam });
  return aggregated.map((item, idx) => {
    const base = [
      idx + 1,
      item.cong_ty || "", // cột B
      item.mst || "",
    ];

    if (includeTeam) {
      base.push(item.team || "");
    }
    if (includeStaff) {
      base.push(item.staff || "");
    }

    base.push(item.loai_hinh);
    base.push(item.modes);
    base.push(item.decls);
    base.push(item.kpi);
    base.push(item.items);
    base.push(item.licenses);

    return base;
  });
}

function buildDetailRows(rows, options = {}) {
  const { includeStaff = false, includeTeam = false } = options;
  return rows.map((row, idx) => {
    const base = [
      idx + 1,
      row.date || "",
      row.so_tk || "",
    ];

    if (includeTeam) {
      base.push(row.team || "");
    }
    if (includeStaff) {
      base.push(row.nhan_vien || "");
    }

    base.push(row.loai_hinh || "");
    base.push(row.isExport ? "Xuất" : "Nhập");
    base.push(row.mst || "");
    base.push(row.cong_ty || "");
    base.push(row.num_items || 0);
    base.push(row.licenses || 0);
    base.push(row.kpi || 0);

    return base;
  });
}

function addSectionTitle(sheet, rowIndex, title) {
  sheet.mergeCells(`A${rowIndex}:K${rowIndex}`);
  const cell = sheet.getCell(rowIndex, 1);
  cell.value = title;
  cell.font = { bold: true, size: 12 };
  cell.alignment = { vertical: "middle", horizontal: "left" };
}

export async function exportStaffReport({ staff, range, rules }) {
  ensureWindow();
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Nhan vien");
  configureSheet(sheet);

  const subtitles = [
    `Nhân viên: ${staff.name || "Chưa gán"}`,
    `Tổ đội: ${staff.teamLabel || "Chưa gán tổ đội"}`,
    `Khoảng thời gian: ${formatRangeLabel(range)}`,
    `Quy tắc KPI: ${rules?.name || "Chưa đặt tên"}`,
    rules?.applyFrom ? `Áp dụng từ ${rules.applyFrom}` : "Áp dụng ngay",
  ];
  applyHeader(sheet, "BÁO CÁO KPI – NHÂN VIÊN", subtitles);

  let currentRow = subtitles.length + 3;
  addSectionTitle(sheet, currentRow, "1. Báo cáo tổng quát");
  currentRow += 1;
  addTableHeader(sheet, currentRow, ["STT", "Chỉ tiêu", "Giá trị", "", "", "", "", "", ""]);
  currentRow = addDataRows(sheet, currentRow + 1, buildSummaryRows(staff.stats));

  currentRow += 1;
  addSectionTitle(sheet, currentRow, "2. Báo cáo tổng hợp theo Công ty");
  currentRow += 1;
  addTableHeader(sheet, currentRow, [
    "STT",
    "Công ty",
    "MST",
    "Loại hình",
    "Nhập/Xuất",
    "Tờ khai",
    "Điểm KPI",
    "Mục hàng",
    "Số GP",
  ]);
  const companyRows = buildCompanyRows(staff.rows, { includeStaff: false, includeTeam: false });
  currentRow = addDataRows(sheet, currentRow + 1, companyRows.length ? companyRows : [["", "Không có dữ liệu", "", "", "", "", "", "", ""]]);

  currentRow += 1;
  addSectionTitle(sheet, currentRow, "3. Báo cáo chi tiết theo Tờ khai");
  currentRow += 1;
  addTableHeader(sheet, currentRow, [
    "STT",
    "Ngày",
    "Số tờ khai",
    "Loại hình",
    "Nhập/Xuất",
    "MST",
    "Công ty",
    "Mục hàng",
    "Số GP",
    "Điểm KPI",
  ]);
  const detailRows = buildDetailRows(staff.rows, { includeStaff: false, includeTeam: false }).map((row) => {
    const [stt, date, soTk, loaiHinh, mode, mst, company, items, licenses, kpi] = row;
    return [stt, date, soTk, loaiHinh, mode, mst, company, items, licenses, kpi];
  });
  addDataRows(sheet, currentRow + 1, detailRows.length ? detailRows : [["", "", "", "", "", "", "", "", "", ""]]);

  const filename = `bao-cao-kpi-nhan-vien-${(staff.name || "chua-gan").replace(/\s+/g, "-")}.xlsx`;
  await downloadWorkbook(workbook, filename.toLowerCase());
}

export async function exportTeamReport({ team, range, rules }) {
  ensureWindow();
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("To doi");
  configureSheet(sheet);

  const subtitles = [
    `Tổ đội: ${team.name || "Chưa gán tổ đội"}`,
    `Thành viên: ${team.memberNames?.length ? team.memberNames.join(", ") : "Chưa có"}`,
    `Khoảng thời gian: ${formatRangeLabel(range)}`,
    `Quy tắc KPI: ${rules?.name || "Chưa đặt tên"}`,
    rules?.applyFrom ? `Áp dụng từ ${rules.applyFrom}` : "Áp dụng ngay",
  ];
  applyHeader(sheet, "BÁO CÁO KPI – TỔ ĐỘI", subtitles);

  let currentRow = subtitles.length + 3;
  addSectionTitle(sheet, currentRow, "1. Báo cáo tổng quát");
  currentRow += 1;
  addTableHeader(sheet, currentRow, ["STT", "Chỉ tiêu", "Giá trị", "", "", "", "", "", ""]);
  currentRow = addDataRows(sheet, currentRow + 1, buildSummaryRows(team.stats));

  currentRow += 1;
  addSectionTitle(sheet, currentRow, "2. Báo cáo tổng hợp theo Công ty");
  currentRow += 1;
  addTableHeader(sheet, currentRow, [
    "STT",
    "Công ty",
    "MST",
    "Nhân viên",
    "Loại hình",
    "Nhập/Xuất",
    "Tờ khai",
    "Điểm KPI",
    "Mục hàng",
    "Số GP",
  ]);
  const companyRows = buildCompanyRows(team.rows, { includeStaff: true, includeTeam: false });
  currentRow = addDataRows(sheet, currentRow + 1, companyRows.length ? companyRows : [["", "Không có dữ liệu", "", "", "", "", "", "", "", ""]]);

  currentRow += 1;
  addSectionTitle(sheet, currentRow, "3. Báo cáo chi tiết theo Tờ khai");
  currentRow += 1;
  addTableHeader(sheet, currentRow, [
    "STT",
    "Ngày",
    "Số tờ khai",
    "Nhân viên",
    "Loại hình",
    "Nhập/Xuất",
    "MST",
    "Công ty",
    "Mục hàng",
    "Số GP",
    "Điểm KPI",
  ]);
  const detailRows = buildDetailRows(team.rows, { includeStaff: true, includeTeam: false }).map((row) => {
    const [stt, date, soTk, staffName, loaiHinh, mode, mst, company, items, licenses, kpi] = row;
    return [stt, date, soTk, staffName, loaiHinh, mode, mst, company, items, licenses, kpi];
  });
  addDataRows(sheet, currentRow + 1, detailRows.length ? detailRows : [["", "", "", "", "", "", "", "", "", "", ""]]);

  const filename = `bao-cao-kpi-to-doi-${(team.name || "chua-gan").replace(/\s+/g, "-")}.xlsx`;
  await downloadWorkbook(workbook, filename.toLowerCase());
}

export async function exportAllStaffReport({ staffList, summary, range, rules }) {
  ensureWindow();
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Tong hop NV");
  configureSheet(sheet);

  const subtitles = [
    `Khoảng thời gian: ${formatRangeLabel(range)}`,
    `Quy tắc KPI: ${rules?.name || "Chưa đặt tên"}`,
    rules?.applyFrom ? `Áp dụng từ ${rules.applyFrom}` : "Áp dụng ngay",
  ];
  applyHeader(sheet, "BÁO CÁO KPI – TỔNG HỢP NHÂN VIÊN", subtitles);

  let currentRow = subtitles.length + 3;
  addSectionTitle(sheet, currentRow, "1. Tổng quan KPI");
  currentRow += 1;
  addTableHeader(sheet, currentRow, ["STT", "Chỉ tiêu", "Giá trị", "", "", "", "", "", ""]);
  currentRow = addDataRows(sheet, currentRow + 1, buildSummaryRows(summary));

  currentRow += 1;
  addSectionTitle(sheet, currentRow, "2. Thống kê theo Nhân viên");
  currentRow += 1;
  addTableHeader(sheet, currentRow, [
    "STT",
    "Nhân viên",
    "Tổ đội",
    "Tờ khai",
    "Điểm KPI",
    "Nhập",
    "Xuất",
    "Mục hàng",
    "Số GP",
  ]);
  const staffRows = staffList.map((item, idx) => [
    idx + 1,
    item.name,
    item.teamLabel,
    item.stats.decls,
    item.stats.kpi,
    item.stats.import,
    item.stats.export,
    item.stats.items,
    item.stats.licenses,
  ]);
  currentRow = addDataRows(sheet, currentRow + 1, staffRows.length ? staffRows : [["", "Không có dữ liệu", "", "", "", "", "", "", ""]]);

  currentRow += 1;
  addSectionTitle(sheet, currentRow, "3. Tổng hợp theo Công ty");
  currentRow += 1;
  addTableHeader(sheet, currentRow, [
    "STT",
    "Công ty",
    "MST",
    "Nhân viên",
    "Loại hình",
    "Nhập/Xuất",
    "Tờ khai",
    "Điểm KPI",
    "Mục hàng",
    "Số GP",
  ]);
  const companyRows = buildCompanyRows(
    staffList.flatMap((item) => item.rows),
    { includeStaff: true, includeTeam: false },
  );
  addDataRows(sheet, currentRow + 1, companyRows.length ? companyRows : [["", "Không có dữ liệu", "", "", "", "", "", "", "", ""]]);

  await downloadWorkbook(workbook, "bao-cao-kpi-nhan-vien-tong-hop.xlsx");
}

export async function exportAllTeamReport({ teamList, summary, range, rules }) {
  ensureWindow();
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Tong hop to doi");
  configureSheet(sheet);

  const subtitles = [
    `Khoảng thời gian: ${formatRangeLabel(range)}`,
    `Quy tắc KPI: ${rules?.name || "Chưa đặt tên"}`,
    rules?.applyFrom ? `Áp dụng từ ${rules.applyFrom}` : "Áp dụng ngay",
  ];
  applyHeader(sheet, "BÁO CÁO KPI – TỔNG HỢP TỔ ĐỘI", subtitles);

  let currentRow = subtitles.length + 3;
  addSectionTitle(sheet, currentRow, "1. Tổng quan KPI");
  currentRow += 1;
  addTableHeader(sheet, currentRow, ["STT", "Chỉ tiêu", "Giá trị", "", "", "", "", "", ""]);
  currentRow = addDataRows(sheet, currentRow + 1, buildSummaryRows(summary));

  currentRow += 1;
  addSectionTitle(sheet, currentRow, "2. Thống kê theo Tổ đội");
  currentRow += 1;
  addTableHeader(sheet, currentRow, [
    "STT",
    "Tổ đội",
    "Thành viên",
    "Tờ khai",
    "Điểm KPI",
    "Nhập",
    "Xuất",
    "Mục hàng",
    "Số GP",
  ]);
  const teamRows = teamList.map((item, idx) => [
    idx + 1,
    item.name,
    item.memberNames?.join(", ") || "",
    item.stats.decls,
    item.stats.kpi,
    item.stats.import,
    item.stats.export,
    item.stats.items,
    item.stats.licenses,
  ]);
  currentRow = addDataRows(sheet, currentRow + 1, teamRows.length ? teamRows : [["", "Không có dữ liệu", "", "", "", "", "", "", ""]]);

  currentRow += 1;
  addSectionTitle(sheet, currentRow, "3. Tổng hợp theo Công ty");
  currentRow += 1;
  addTableHeader(sheet, currentRow, [
    "STT",
    "Công ty",
    "MST",
    "Tổ đội",
    "Nhân viên",
    "Loại hình",
    "Nhập/Xuất",
    "Tờ khai",
    "Điểm KPI",
    "Mục hàng",
    "Số GP",
  ]);
  const companyRows = buildCompanyRows(
    teamList.flatMap((item) => item.rows),
    { includeStaff: true, includeTeam: true },
  );
  addDataRows(sheet, currentRow + 1, companyRows.length ? companyRows : [["", "Không có dữ liệu", "", "", "", "", "", "", "", "", ""]]);

  await downloadWorkbook(workbook, "bao-cao-kpi-to-doi-tong-hop.xlsx");
}
