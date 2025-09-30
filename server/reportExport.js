import ExcelJS from 'exceljs';
import { Buffer } from 'node:buffer';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút
const MAX_CACHE_ENTRIES = 20;

const reportCache = new Map();

function normalizeCacheValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeCacheValue(item));
  }
  if (typeof value === 'object') {
    const normalized = {};
    const keys = Object.keys(value).sort();
    for (const key of keys) {
      normalized[key] = normalizeCacheValue(value[key]);
    }
    return normalized;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number(value);
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return value.toString();
}

function buildCacheKey(kind, payload) {
  const normalizedPayload = normalizeCacheValue(payload || {});
  return JSON.stringify({ kind, payload: normalizedPayload });
}

function purgeExpiredEntries(now = Date.now()) {
  for (const [key, entry] of reportCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      reportCache.delete(key);
    }
  }
}

function rememberCacheEntry(key, result, timestamp) {
  if (!result || !Buffer.isBuffer(result.buffer) || !result.filename) {
    return;
  }
  if (reportCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = reportCache.keys().next().value;
    if (oldestKey) {
      reportCache.delete(oldestKey);
    }
  }
  reportCache.set(key, {
    buffer: Buffer.from(result.buffer),
    filename: result.filename,
    timestamp,
  });
}

function readCacheEntry(key, now = Date.now()) {
  const entry = reportCache.get(key);
  if (!entry) {
    return null;
  }
  if (now - entry.timestamp > CACHE_TTL_MS) {
    reportCache.delete(key);
    return null;
  }
  return {
    buffer: Buffer.from(entry.buffer),
    filename: entry.filename,
  };
}

export function clearReportCache() {
  reportCache.clear();
}

function normalizeStr(value) {
  return (value ?? '')
    .toString()
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value, fallback = 'bao-cao') {
  const normalized = normalizeStr(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return normalized || fallback;
}

function aggregateByCompany(rows, options = {}) {
  const { includeStaff = false, includeTeam = false } = options;
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const map = new Map();

  for (const row of rows) {
    if (!row) continue;
    const mst = normalizeStr(row.mst) || '';
    const company = normalizeStr(row.cong_ty) || '';
    const staffName = includeStaff ? normalizeStr(row.nhan_vien) || 'Chưa gán' : '';
    const teamName = includeTeam ? normalizeStr(row.team) || 'Chưa gán tổ đội' : '';

    const keyParts = [mst, company];
    if (includeTeam) keyParts.push(teamName);
    if (includeStaff) keyParts.push(staffName);
    const key = keyParts.join('|#|');

    if (!map.has(key)) {
      map.set(key, {
        mst: mst || row.mst || '',
        cong_ty: company || row.cong_ty || '',
        staff: includeStaff ? row.nhan_vien || 'Chưa gán' : undefined,
        team: includeTeam ? row.team || 'Chưa gán tổ đội' : undefined,
        decls: 0,
        items: 0,
        licenses: 0,
        kpi: 0,
        loai_hinh: new Set(),
        modes: new Set(),
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
      entry.modes.add('Xuất');
    } else if (row.isExport === false) {
      entry.modes.add('Nhập');
    }
  }

  return Array.from(map.values())
    .map((entry) => ({
      mst: entry.mst,
      cong_ty: entry.cong_ty,
      staff: entry.staff,
      team: entry.team,
      decls: entry.decls,
      items: entry.items,
      licenses: entry.licenses,
      kpi: Math.round(entry.kpi * 10) / 10,
      loai_hinh: Array.from(entry.loai_hinh).join(', ') || '—',
      modes: Array.from(entry.modes).join(', ') || '—',
    }))
    .sort((a, b) => {
      if (b.kpi !== a.kpi) return b.kpi - a.kpi;
      if (b.decls !== a.decls) return b.decls - a.decls;
      return (a.cong_ty || '').localeCompare(b.cong_ty || '', 'vi', { sensitivity: 'base' });
    });
}

function formatRangeLabel(range) {
  if (!range || (!range.from && !range.to)) {
    return 'Tất cả dữ liệu';
  }
  if (range.from && range.to) {
    return `${range.from} → ${range.to}`;
  }
  if (range.from) return `Từ ${range.from}`;
  if (range.to) return `Đến ${range.to}`;
  return 'Tất cả dữ liệu';
}

function configureSheet(sheet) {
  sheet.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
  sheet.columns = [
    { key: 'colA', width: 6 },
    { key: 'colB', width: 28 },
    { key: 'colC', width: 16 },
    { key: 'colD', width: 16 },
    { key: 'colE', width: 16 },
    { key: 'colF', width: 16 },
    { key: 'colG', width: 16 },
    { key: 'colH', width: 16 },
    { key: 'colI', width: 16 },
    { key: 'colJ', width: 16 },
    { key: 'colK', width: 16 },
  ];
}

function applyHeader(sheet, title, subtitleLines = []) {
  sheet.mergeCells('A1', 'K1');
  const cell = sheet.getCell('A1');
  cell.value = title;
  cell.font = { bold: true, size: 16 };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };

  subtitleLines.forEach((text, idx) => {
    const rowIndex = 2 + idx;
    sheet.mergeCells(`A${rowIndex}:K${rowIndex}`);
    const subtitleCell = sheet.getCell(rowIndex, 1);
    subtitleCell.value = text;
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    subtitleCell.font = { size: 12 };
  });
}

function addSectionTitle(sheet, rowIndex, title) {
  sheet.mergeCells(`A${rowIndex}:K${rowIndex}`);
  const cell = sheet.getCell(rowIndex, 1);
  cell.value = title;
  cell.font = { bold: true, size: 12 };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
}

function addTableHeader(sheet, startRow, headers) {
  const row = sheet.getRow(startRow);
  headers.forEach((text, idx) => {
    const cell = row.getCell(idx + 1);
    cell.value = text;
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
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
      cell.alignment = { vertical: 'middle', horizontal: idx === 0 ? 'center' : 'left', wrapText: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
    row.commit();
    current += 1;
  });
  return current;
}

function buildSummaryRows(stats) {
  return [
    ['1', 'Tổng số tờ khai', stats?.decls || 0, '', '', '', '', '', ''],
    ['2', 'Tổng điểm KPI', stats?.kpi || 0, '', '', '', '', '', ''],
    ['3', 'Tờ khai nhập', stats?.import || 0, '', '', '', '', '', ''],
    ['4', 'Tờ khai xuất', stats?.export || 0, '', '', '', '', '', ''],
    ['5', 'Tổng mục hàng', stats?.items || 0, '', '', '', '', '', ''],
    ['6', 'Số giấy phép hợp lệ', stats?.licenses || 0, '', '', '', '', '', ''],
  ];
}

function buildCompanyRows(rows, options = {}) {
  const { includeStaff = false, includeTeam = false } = options;
  const aggregated = aggregateByCompany(rows, { includeStaff, includeTeam });
  return aggregated.map((item, idx) => {
    const base = [
      idx + 1,
      item.cong_ty || '',
      item.mst || '',
    ];

    if (includeTeam) {
      base.push(item.team || '');
    }
    if (includeStaff) {
      base.push(item.staff || '');
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
  return (Array.isArray(rows) ? rows : []).map((row, idx) => {
    const base = [idx + 1, row?.date || '', row?.so_tk || ''];

    if (includeTeam) {
      base.push(row?.team || '');
    }
    if (includeStaff) {
      base.push(row?.nhan_vien || '');
    }

    base.push(row?.loai_hinh || '');
    base.push(row?.isExport ? 'Xuất' : 'Nhập');
    base.push(row?.mst || '');
    base.push(row?.cong_ty || '');
    base.push(row?.num_items || 0);
    base.push(row?.licenses || 0);
    base.push(row?.kpi || 0);

    return base;
  });
}

async function finalizeWorkbook(workbook) {
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}

export async function generateStaffReport(payload = {}) {
  const { staff = {}, range = {}, rules = {} } = payload;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Nhan vien');
  configureSheet(sheet);

  const subtitles = [
    `Nhân viên: ${staff.name || 'Chưa gán'}`,
    `Tổ đội: ${staff.teamLabel || 'Chưa gán tổ đội'}`,
    `Khoảng thời gian: ${formatRangeLabel(range)}`,
    `Quy tắc KPI: ${rules?.name || 'Chưa đặt tên'}`,
    rules?.applyFrom ? `Áp dụng từ ${rules.applyFrom}` : 'Áp dụng ngay',
  ];
  applyHeader(sheet, 'BÁO CÁO KPI – NHÂN VIÊN', subtitles);

  let currentRow = subtitles.length + 3;
  addSectionTitle(sheet, currentRow, '1. Báo cáo tổng quát');
  currentRow += 1;
  addTableHeader(sheet, currentRow, ['STT', 'Chỉ tiêu', 'Giá trị', '', '', '', '', '', '']);
  currentRow = addDataRows(sheet, currentRow + 1, buildSummaryRows(staff.stats));

  currentRow += 1;
  addSectionTitle(sheet, currentRow, '2. Báo cáo tổng hợp theo Công ty');
  currentRow += 1;
  addTableHeader(sheet, currentRow, [
    'STT',
    'Công ty',
    'MST',
    'Loại hình',
    'Nhập/Xuất',
    'Tờ khai',
    'Điểm KPI',
    'Mục hàng',
    'Số GP',
  ]);
  const companyRows = buildCompanyRows(staff.rows, { includeStaff: false, includeTeam: false });
  currentRow = addDataRows(
    sheet,
    currentRow + 1,
    companyRows.length ? companyRows : [['', 'Không có dữ liệu', '', '', '', '', '', '', '']]
  );

  currentRow += 1;
  addSectionTitle(sheet, currentRow, '3. Báo cáo chi tiết theo Tờ khai');
  currentRow += 1;
  addTableHeader(sheet, currentRow, [
    'STT',
    'Ngày',
    'Số tờ khai',
    'Loại hình',
    'Nhập/Xuất',
    'MST',
    'Công ty',
    'Mục hàng',
    'Số GP',
    'Điểm KPI',
  ]);
  const detailRows = buildDetailRows(staff.rows, { includeStaff: false, includeTeam: false }).map((row) => {
    const [stt, date, soTk, loaiHinh, mode, mst, company, items, licenses, kpi] = row;
    return [stt, date, soTk, loaiHinh, mode, mst, company, items, licenses, kpi];
  });
  addDataRows(sheet, currentRow + 1, detailRows.length ? detailRows : [['', '', '', '', '', '', '', '', '', '']]);

  const filename = `bao-cao-kpi-nhan-vien-${slugify(staff.name || 'chua-gan')}.xlsx`;
  const buffer = await finalizeWorkbook(workbook);
  return { buffer, filename };
}

export async function generateTeamReport(payload = {}) {
  const { team = {}, range = {}, rules = {} } = payload;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('To doi');
  configureSheet(sheet);

  const subtitles = [
    `Tổ đội: ${team.name || 'Chưa gán tổ đội'}`,
    `Thành viên: ${team.memberNames?.length ? team.memberNames.join(', ') : 'Chưa có'}`,
    `Khoảng thời gian: ${formatRangeLabel(range)}`,
    `Quy tắc KPI: ${rules?.name || 'Chưa đặt tên'}`,
    rules?.applyFrom ? `Áp dụng từ ${rules.applyFrom}` : 'Áp dụng ngay',
  ];
  applyHeader(sheet, 'BÁO CÁO KPI – TỔ ĐỘI', subtitles);

  let currentRow = subtitles.length + 3;
  addSectionTitle(sheet, currentRow, '1. Báo cáo tổng quát');
  currentRow += 1;
  addTableHeader(sheet, currentRow, ['STT', 'Chỉ tiêu', 'Giá trị', '', '', '', '', '', '']);
  currentRow = addDataRows(sheet, currentRow + 1, buildSummaryRows(team.stats));

  currentRow += 1;
  addSectionTitle(sheet, currentRow, '2. Báo cáo tổng hợp theo Công ty');
  currentRow += 1;
  addTableHeader(sheet, currentRow, [
    'STT',
    'Công ty',
    'MST',
    'Nhân viên',
    'Loại hình',
    'Nhập/Xuất',
    'Tờ khai',
    'Điểm KPI',
    'Mục hàng',
    'Số GP',
  ]);
  const companyRows = buildCompanyRows(team.rows, { includeStaff: true, includeTeam: false });
  currentRow = addDataRows(
    sheet,
    currentRow + 1,
    companyRows.length ? companyRows : [['', 'Không có dữ liệu', '', '', '', '', '', '', '', '']]
  );

  currentRow += 1;
  addSectionTitle(sheet, currentRow, '3. Báo cáo chi tiết theo Tờ khai');
  currentRow += 1;
  addTableHeader(sheet, currentRow, [
    'STT',
    'Ngày',
    'Số tờ khai',
    'Nhân viên',
    'Loại hình',
    'Nhập/Xuất',
    'MST',
    'Công ty',
    'Mục hàng',
    'Số GP',
    'Điểm KPI',
  ]);
  const detailRows = buildDetailRows(team.rows, { includeStaff: true, includeTeam: false }).map((row) => {
    const [stt, date, soTk, staffName, loaiHinh, mode, mst, company, items, licenses, kpi] = row;
    return [stt, date, soTk, staffName, loaiHinh, mode, mst, company, items, licenses, kpi];
  });
  addDataRows(sheet, currentRow + 1, detailRows.length ? detailRows : [['', '', '', '', '', '', '', '', '', '', '']]);

  const filename = `bao-cao-kpi-to-doi-${slugify(team.name || 'chua-gan')}.xlsx`;
  const buffer = await finalizeWorkbook(workbook);
  return { buffer, filename };
}

export async function generateAllStaffReport(payload = {}) {
  const { staffList = [], summary = {}, range = {}, rules = {} } = payload;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Tong hop NV');
  configureSheet(sheet);

  const subtitles = [
    `Khoảng thời gian: ${formatRangeLabel(range)}`,
    `Quy tắc KPI: ${rules?.name || 'Chưa đặt tên'}`,
    rules?.applyFrom ? `Áp dụng từ ${rules.applyFrom}` : 'Áp dụng ngay',
  ];
  applyHeader(sheet, 'BÁO CÁO KPI – TỔNG HỢP NHÂN VIÊN', subtitles);

  let currentRow = subtitles.length + 3;
  addSectionTitle(sheet, currentRow, '1. Tổng quan KPI');
  currentRow += 1;
  addTableHeader(sheet, currentRow, ['STT', 'Chỉ tiêu', 'Giá trị', '', '', '', '', '', '']);
  currentRow = addDataRows(sheet, currentRow + 1, buildSummaryRows(summary));

  currentRow += 1;
  addSectionTitle(sheet, currentRow, '2. Thống kê theo Nhân viên');
  currentRow += 1;
  addTableHeader(sheet, currentRow, [
    'STT',
    'Nhân viên',
    'Tổ đội',
    'Tờ khai',
    'Điểm KPI',
    'Nhập',
    'Xuất',
    'Mục hàng',
    'Số GP',
  ]);
  const staffRows = staffList.map((item, idx) => [
    idx + 1,
    item.name,
    item.teamLabel,
    item.stats?.decls || 0,
    item.stats?.kpi || 0,
    item.stats?.import || 0,
    item.stats?.export || 0,
    item.stats?.items || 0,
    item.stats?.licenses || 0,
  ]);
  currentRow = addDataRows(
    sheet,
    currentRow + 1,
    staffRows.length ? staffRows : [['', 'Không có dữ liệu', '', '', '', '', '', '', '']]
  );

  currentRow += 1;
  addSectionTitle(sheet, currentRow, '3. Tổng hợp theo Công ty');
  currentRow += 1;
  addTableHeader(sheet, currentRow, [
    'STT',
    'Công ty',
    'MST',
    'Nhân viên',
    'Loại hình',
    'Nhập/Xuất',
    'Tờ khai',
    'Điểm KPI',
    'Mục hàng',
    'Số GP',
  ]);
  const companyRows = buildCompanyRows(
    staffList.flatMap((item) => item.rows || []),
    { includeStaff: true, includeTeam: false }
  );
  addDataRows(
    sheet,
    currentRow + 1,
    companyRows.length ? companyRows : [['', 'Không có dữ liệu', '', '', '', '', '', '', '', '']]
  );

  const buffer = await finalizeWorkbook(workbook);
  return { buffer, filename: 'bao-cao-kpi-nhan-vien-tong-hop.xlsx' };
}

export async function generateAllTeamReport(payload = {}) {
  const { teamList = [], summary = {}, range = {}, rules = {} } = payload;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Tong hop to doi');
  configureSheet(sheet);

  const subtitles = [
    `Khoảng thời gian: ${formatRangeLabel(range)}`,
    `Quy tắc KPI: ${rules?.name || 'Chưa đặt tên'}`,
    rules?.applyFrom ? `Áp dụng từ ${rules.applyFrom}` : 'Áp dụng ngay',
  ];
  applyHeader(sheet, 'BÁO CÁO KPI – TỔNG HỢP TỔ ĐỘI', subtitles);

  let currentRow = subtitles.length + 3;
  addSectionTitle(sheet, currentRow, '1. Tổng quan KPI');
  currentRow += 1;
  addTableHeader(sheet, currentRow, ['STT', 'Chỉ tiêu', 'Giá trị', '', '', '', '', '', '']);
  currentRow = addDataRows(sheet, currentRow + 1, buildSummaryRows(summary));

  currentRow += 1;
  addSectionTitle(sheet, currentRow, '2. Thống kê theo Tổ đội');
  currentRow += 1;
  addTableHeader(sheet, currentRow, [
    'STT',
    'Tổ đội',
    'Thành viên',
    'Tờ khai',
    'Điểm KPI',
    'Nhập',
    'Xuất',
    'Mục hàng',
    'Số GP',
  ]);
  const teamRows = teamList.map((item, idx) => [
    idx + 1,
    item.name,
    item.memberNames?.join(', ') || '',
    item.stats?.decls || 0,
    item.stats?.kpi || 0,
    item.stats?.import || 0,
    item.stats?.export || 0,
    item.stats?.items || 0,
    item.stats?.licenses || 0,
  ]);
  currentRow = addDataRows(
    sheet,
    currentRow + 1,
    teamRows.length ? teamRows : [['', 'Không có dữ liệu', '', '', '', '', '', '', '']]
  );

  currentRow += 1;
  addSectionTitle(sheet, currentRow, '3. Tổng hợp theo Công ty');
  currentRow += 1;
  addTableHeader(sheet, currentRow, [
    'STT',
    'Công ty',
    'MST',
    'Tổ đội',
    'Nhân viên',
    'Loại hình',
    'Nhập/Xuất',
    'Tờ khai',
    'Điểm KPI',
    'Mục hàng',
    'Số GP',
  ]);
  const companyRows = buildCompanyRows(
    teamList.flatMap((item) => item.rows || []),
    { includeStaff: true, includeTeam: true }
  );
  addDataRows(
    sheet,
    currentRow + 1,
    companyRows.length ? companyRows : [['', 'Không có dữ liệu', '', '', '', '', '', '', '', '', '']]
  );

  const buffer = await finalizeWorkbook(workbook);
  return { buffer, filename: 'bao-cao-kpi-to-doi-tong-hop.xlsx' };
}

const REPORT_GENERATORS = {
  staff: generateStaffReport,
  team: generateTeamReport,
  allStaff: generateAllStaffReport,
  allTeam: generateAllTeamReport,
};

export async function generateReport(kind, payload) {
  const generator = REPORT_GENERATORS[kind];
  if (!generator) {
    throw new Error('Loại báo cáo không hợp lệ');
  }

  const cacheKey = buildCacheKey(kind, payload);
  const now = Date.now();
  purgeExpiredEntries(now);

  const cached = readCacheEntry(cacheKey, now);
  if (cached) {
    return cached;
  }

  const result = await generator(payload);
  rememberCacheEntry(cacheKey, result, now);
  return result;
}

export default {
  generateReport,
  generateStaffReport,
  generateTeamReport,
  generateAllStaffReport,
  generateAllTeamReport,
  clearReportCache,
};

