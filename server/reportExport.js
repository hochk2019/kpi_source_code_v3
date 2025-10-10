import ExcelJS from 'exceljs';
import { Buffer } from 'node:buffer';
import { applyWorkbookWatermark } from './reportWatermark.js';
import {
  cloneAdjustmentTotals,
  createAdjustmentTotals,
  toAdjustmentTotalsArray,
} from '../shared/kpiAdjustments.js';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút
const MAX_CACHE_ENTRIES = 20;

const HEADER_LAST_COLUMN = 'N';
const HEADER_START_ROW = 5;

const reportCache = new Map();

const BRAND_PRIMARY = 'FF1D4ED8';
const BRAND_PRIMARY_DARK = 'FF0F172A';
const BRAND_PRIMARY_LIGHT = 'FFEFF4FF';
const BRAND_BORDER = 'FFCBD5F5';
const BRAND_TEXT_MUTED = 'FF475569';

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
    signature: result.signature || null,
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
    signature: entry.signature || null,
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

const DEFAULT_COLUMN_VISIBILITY = Object.freeze({
  items: true,
  licenses: true,
  co: true,
  coLines: true,
  licenseCodes: true,
});

function sanitizeColumnVisibility(columns = {}) {
  const result = { ...DEFAULT_COLUMN_VISIBILITY };
  if (!columns || typeof columns !== 'object') {
    return result;
  }
  for (const key of Object.keys(DEFAULT_COLUMN_VISIBILITY)) {
    if (columns[key] === false) {
      result[key] = false;
    }
  }
  return result;
}

function buildCompanyHeaders({ includeStaff = false, includeTeam = false, visibleColumns = {} } = {}) {
  const columns = sanitizeColumnVisibility(visibleColumns);
  const headers = ['STT', 'Công ty', 'MST'];
  if (includeTeam) {
    headers.push('Tổ đội');
  }
  if (includeStaff) {
    headers.push('Nhân viên');
  }
  headers.push('Loại hình');
  headers.push('Nhập/Xuất');
  headers.push('Tờ khai');
  headers.push('Điểm KPI');
  if (columns.items) {
    headers.push('Mục hàng');
  }
  if (columns.licenses) {
    headers.push('Số GP');
  }
  if (columns.co) {
    headers.push('Tờ khai C/O');
  }
  if (columns.coLines) {
    headers.push('Dòng C/O');
  }
  if (columns.licenseCodes) {
    headers.push('Mã giấy phép');
  }
  return headers;
}

function buildDetailHeaders({ includeStaff = false, includeTeam = false, visibleColumns = {} } = {}) {
  const columns = sanitizeColumnVisibility(visibleColumns);
  const headers = ['STT', 'Ngày', 'Số tờ khai'];
  if (includeTeam) {
    headers.push('Tổ đội');
  }
  if (includeStaff) {
    headers.push('Nhân viên');
  }
  headers.push('Loại hình');
  headers.push('Nhập/Xuất');
  if (columns.items) {
    headers.push('Mục hàng');
  }
  if (columns.licenses) {
    headers.push('Số GP');
  }
  if (columns.co) {
    headers.push('C/O');
  }
  if (columns.coLines) {
    headers.push('Dòng C/O');
  }
  if (columns.licenseCodes) {
    headers.push('Mã giấy phép');
  }
  headers.push('Điểm KPI');
  headers.push('MST');
  headers.push('Công ty');
  return headers;
}

function formatAdjustmentPoints(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || Math.abs(num) < 0.05) {
    return '';
  }
  return Math.round(num * 10) / 10;
}

function formatAdjustmentQuantity(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) {
    return '';
  }
  return num;
}

function buildSummaryEntry(index, label, value, quantity = '') {
  return [
    String(index),
    label,
    value === undefined ? '' : value,
    quantity === undefined ? '' : quantity,
    '',
    '',
    '',
    '',
    '',
  ];
}

function ensureStaffAdjustmentSummary(map, key, name, teamName) {
  if (!key) {
    return null;
  }
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

function ensureTeamAdjustmentSummary(map, key, name) {
  if (!key) {
    return null;
  }
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

function finalizeStaffAdjustmentEntry(entry) {
  if (!entry) {
    return {
      key: '',
      name: 'Chưa gán',
      teams: [],
      totals: createAdjustmentTotals(),
    };
  }
  return {
    key: entry.key,
    name: entry.name,
    teams: Array.from(entry.teamNames || []),
    totals: cloneAdjustmentTotals(entry.totals),
  };
}

function finalizeTeamAdjustmentEntry(entry) {
  if (!entry) {
    return {
      key: '',
      name: 'Chưa gán tổ đội',
      totals: createAdjustmentTotals(),
    };
  }
  return {
    key: entry.key,
    name: entry.name,
    totals: cloneAdjustmentTotals(entry.totals),
  };
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
      entry.modes.add('Xuất');
    } else if (row.isExport === false) {
      entry.modes.add('Nhập');
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
      const excludedCodes = Array.isArray(row.licenseExcludedCodes) ? row.licenseExcludedCodes : [];
      for (const code of excludedCodes) {
        const normalized = normalizeStr(code).toUpperCase();
        if (normalized) {
          entry.licenseExcluded.add(normalized);
        }
      }
    }
  }

  return Array.from(map.values())
    .map((entry) => {
      const licenseCodes = Array.from(entry.licenseCodes || []);
      const licenseExcluded = Array.from(entry.licenseExcluded || []);
      const licenseSummary = licenseCodes.join(', ');
      const excludedSummary = licenseExcluded.join(', ');
      const tooltipParts = [];
      if (licenseSummary) {
        tooltipParts.push(`Áp dụng: ${licenseSummary}`);
      }
      if (excludedSummary) {
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
        loai_hinh: Array.from(entry.loai_hinh).join(', ') || '—',
        modes: Array.from(entry.modes).join(', ') || '—',
        co: entry.co,
        coLines: entry.coLines,
        licenseSummary: licenseSummary || '—',
        licenseCodes,
        licenseExcluded,
        licenseTooltip: tooltipParts.join('\n') || '—',
      };
    })
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
    { key: 'colL', width: 16 },
    { key: 'colM', width: 18 },
    { key: 'colN', width: 22 },
  ];
  for (let rowIndex = 1; rowIndex < HEADER_START_ROW; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    if (!row.height || row.height < 24) {
      row.height = 24;
    }
  }
}

function applyHeader(sheet, title, subtitleLines = []) {
  const titleRow = HEADER_START_ROW;
  sheet.mergeCells(`A${titleRow}:${HEADER_LAST_COLUMN}${titleRow}`);
  const cell = sheet.getCell(titleRow, 1);
  cell.value = title;
  cell.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: BRAND_PRIMARY_DARK },
  };

  const titleRowRef = sheet.getRow(titleRow);
  titleRowRef.height = 30;

  subtitleLines.forEach((text, idx) => {
    const rowIndex = titleRow + idx + 1;
    sheet.mergeCells(`A${rowIndex}:${HEADER_LAST_COLUMN}${rowIndex}`);
    const subtitleCell = sheet.getCell(rowIndex, 1);
    subtitleCell.value = text;
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    subtitleCell.font = { size: 12, color: { argb: BRAND_TEXT_MUTED } };
    subtitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: BRAND_PRIMARY_LIGHT },
    };
    const subtitleRowRef = sheet.getRow(rowIndex);
    subtitleRowRef.height = 22;
  });

  return titleRow + subtitleLines.length + 2;
}

function addSectionTitle(sheet, rowIndex, title) {
  sheet.mergeCells(`A${rowIndex}:${HEADER_LAST_COLUMN}${rowIndex}`);
  const cell = sheet.getCell(rowIndex, 1);
  cell.value = title;
  cell.font = { bold: true, size: 12, color: { argb: BRAND_PRIMARY_DARK } };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: BRAND_PRIMARY_LIGHT },
  };
  cell.border = {
    bottom: { style: 'thin', color: { argb: BRAND_BORDER } },
  };
}

function addTableHeader(sheet, startRow, headers) {
  const row = sheet.getRow(startRow);
  headers.forEach((text, idx) => {
    const cell = row.getCell(idx + 1);
    cell.value = text;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: BRAND_PRIMARY },
    };
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
      const numericValue = typeof value === 'number' && Number.isFinite(value);
      cell.value = value;
      cell.alignment = {
        vertical: 'middle',
        horizontal: idx === 0 ? 'center' : numericValue ? 'right' : 'left',
        wrapText: true,
      };
      if (current % 2 === 0) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFF' },
        };
      }
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

function buildSummaryRows(statsInput, adjustmentTotalsInput) {
  const stats = statsInput || {};
  const licenseCodes = Array.isArray(stats?.licenseCodes) ? stats.licenseCodes : [];
  const licenseCount = Number.isFinite(stats?.licenseCount)
    ? stats.licenseCount
    : licenseCodes.length;

  const rows = [
    buildSummaryEntry('1', 'Tổng số tờ khai', stats?.decls || 0),
    buildSummaryEntry('2', 'Tổng điểm KPI', stats?.kpi || 0),
    buildSummaryEntry('3', 'Tờ khai nhập', stats?.import || 0),
    buildSummaryEntry('4', 'Tờ khai xuất', stats?.export || 0),
    buildSummaryEntry('5', 'Tổng mục hàng', stats?.items || 0),
    buildSummaryEntry('6', 'Số giấy phép hợp lệ', stats?.licenses || 0),
    buildSummaryEntry('7', 'Tờ khai có C/O', stats?.co || 0),
    buildSummaryEntry('8', 'Tổng dòng áp C/O', stats?.coLines || 0),
    buildSummaryEntry('9', 'Mã giấy phép (khác nhau)', licenseCount || 0),
  ];

  const totalsSource = adjustmentTotalsInput || stats.adjustmentTotals || {};
  const totals = cloneAdjustmentTotals(totalsSource);
  const totalsList = toAdjustmentTotalsArray(totals);
  let indexCounter = 10;
  for (const entry of totalsList) {
    rows.push(
      buildSummaryEntry(
        String(indexCounter),
        `Điều chỉnh KPI – ${entry.label}`,
        formatAdjustmentPoints(entry.points),
        formatAdjustmentQuantity(entry.quantity),
      ),
    );
    indexCounter += 1;
  }

  return rows;
}

function buildCompanyRows(rows, options = {}) {
  const { includeStaff = false, includeTeam = false, visibleColumns = {} } = options;
  const columns = sanitizeColumnVisibility(visibleColumns);
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
    if (columns.items) {
      base.push(item.items);
    }
    if (columns.licenses) {
      base.push(item.licenses);
    }
    if (columns.co) {
      base.push(item.co || 0);
    }
    if (columns.coLines) {
      base.push(item.coLines || 0);
    }
    if (columns.licenseCodes) {
      base.push(item.licenseSummary || '—');
    }

    return base;
  });
}

function buildDetailRows(rows, options = {}) {
  const { includeStaff = false, includeTeam = false, visibleColumns = {} } = options;
  const columns = sanitizeColumnVisibility(visibleColumns);
  return (Array.isArray(rows) ? rows : []).map((row, idx) => {
    const base = [idx + 1, row?.date || '', row?.so_tk || ''];

    if (includeTeam) {
      base.push(row?.team || '');
    }
    if (includeStaff) {
      base.push(row?.nhan_vien || '');
    }

    base.push(row?.loai_hinh || '');
    let modeLabel = '—';
    if (row?.isExport === true) {
      modeLabel = 'Xuất';
    } else if (row?.isExport === false) {
      modeLabel = 'Nhập';
    }
    base.push(modeLabel);

    if (columns.items) {
      base.push(Number(row?.num_items || 0));
    }
    if (columns.licenses) {
      base.push(Number(row?.licenses || 0));
    }

    let coLabel = '—';
    if (typeof row?.coLabel === 'string' && row.coLabel.trim()) {
      coLabel = row.coLabel;
    } else if (row?.hasCO === true) {
      coLabel = 'Có';
    } else if (row?.hasCO === false) {
      coLabel = 'Không';
    }
    if (columns.co) {
      base.push(coLabel);
    }

    if (columns.coLines) {
      const coLines = Number(row?.coLineCount || row?.co_line_count || 0);
      base.push(Number.isFinite(coLines) ? coLines : 0);
    }

    if (columns.licenseCodes) {
      const licenseCodes = Array.isArray(row?.licenseCodes) ? row.licenseCodes : [];
      const normalizedCodes = licenseCodes
        .map((code) => normalizeStr(code).toUpperCase())
        .filter(Boolean);
      base.push(normalizedCodes.join(', ') || '—');
    }
    base.push(Number(row?.kpi || 0));
    base.push(row?.mst || '');
    base.push(row?.cong_ty || '');

    return base;
  });
}

async function finalizeWorkbook(workbook, options = {}) {
  const watermarkOptions = options?.watermark;
  const watermark = watermarkOptions ? applyWorkbookWatermark(workbook, watermarkOptions) : null;
  const buffer = await workbook.xlsx.writeBuffer();
  const normalizedBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return {
    buffer: normalizedBuffer,
    watermark,
    signature: watermark?.signature || null,
  };
}

export async function generateStaffReport(payload = {}, options = {}) {
  const { staff = {}, range = {}, rules = {}, columns = {} } = payload;
  const columnVisibility = sanitizeColumnVisibility(columns);
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
  const nextRow = applyHeader(sheet, 'BÁO CÁO KPI – NHÂN VIÊN', subtitles);

  let currentRow = nextRow;
  addSectionTitle(sheet, currentRow, '1. Báo cáo tổng quát');
  currentRow += 1;
  addTableHeader(sheet, currentRow, ['STT', 'Chỉ tiêu', 'Giá trị', 'Số lượt', '', '', '', '', '']);
  currentRow = addDataRows(sheet, currentRow + 1, buildSummaryRows(staff.stats, staff.adjustmentSummary));

  currentRow += 1;
  addSectionTitle(sheet, currentRow, '2. Báo cáo tổng hợp theo Công ty');
  currentRow += 1;
  const companyHeaders = buildCompanyHeaders({
    includeStaff: false,
    includeTeam: false,
    visibleColumns: columnVisibility,
  });
  addTableHeader(sheet, currentRow, companyHeaders);
  const companyRows = buildCompanyRows(staff.rows, {
    includeStaff: false,
    includeTeam: false,
    visibleColumns: columnVisibility,
  });
  const companyData = companyRows.length
    ? companyRows
    : [companyHeaders.map((_, index) => (index === 1 ? 'Không có dữ liệu' : ''))];
  currentRow = addDataRows(sheet, currentRow + 1, companyData);

  currentRow += 1;
  addSectionTitle(sheet, currentRow, '3. Báo cáo chi tiết theo Tờ khai');
  currentRow += 1;
  const detailHeaders = buildDetailHeaders({
    includeStaff: false,
    includeTeam: false,
    visibleColumns: columnVisibility,
  });
  addTableHeader(sheet, currentRow, detailHeaders);
  const detailRows = buildDetailRows(staff.rows, {
    includeStaff: false,
    includeTeam: false,
    visibleColumns: columnVisibility,
  });
  const detailData = detailRows.length
    ? detailRows
    : [detailHeaders.map(() => '')];
  addDataRows(sheet, currentRow + 1, detailData);

  const filename = `bao-cao-kpi-nhan-vien-${slugify(staff.name || 'chua-gan')}.xlsx`;
  const { buffer, watermark, signature } = await finalizeWorkbook(workbook, options);
  return { buffer, filename, watermark, signature };
}

export async function generateTeamReport(payload = {}, options = {}) {
  const { team = {}, range = {}, rules = {}, columns = {} } = payload;
  const columnVisibility = sanitizeColumnVisibility(columns);
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
  const nextRow = applyHeader(sheet, 'BÁO CÁO KPI – TỔ ĐỘI', subtitles);

  let currentRow = nextRow;
  addSectionTitle(sheet, currentRow, '1. Báo cáo tổng quát');
  currentRow += 1;
  addTableHeader(sheet, currentRow, ['STT', 'Chỉ tiêu', 'Giá trị', 'Số lượt', '', '', '', '', '']);
  currentRow = addDataRows(sheet, currentRow + 1, buildSummaryRows(team.stats, team.adjustmentSummary));

  currentRow += 1;
  addSectionTitle(sheet, currentRow, '2. Báo cáo tổng hợp theo Công ty');
  currentRow += 1;
  const teamCompanyHeaders = buildCompanyHeaders({
    includeStaff: true,
    includeTeam: false,
    visibleColumns: columnVisibility,
  });
  addTableHeader(sheet, currentRow, teamCompanyHeaders);
  const companyRows = buildCompanyRows(team.rows, {
    includeStaff: true,
    includeTeam: false,
    visibleColumns: columnVisibility,
  });
  const teamCompanyData = companyRows.length
    ? companyRows
    : [teamCompanyHeaders.map((_, index) => (index === 1 ? 'Không có dữ liệu' : ''))];
  currentRow = addDataRows(sheet, currentRow + 1, teamCompanyData);

  currentRow += 1;
  addSectionTitle(sheet, currentRow, '3. Báo cáo chi tiết theo Tờ khai');
  currentRow += 1;
  const teamDetailHeaders = buildDetailHeaders({
    includeStaff: true,
    includeTeam: false,
    visibleColumns: columnVisibility,
  });
  addTableHeader(sheet, currentRow, teamDetailHeaders);
  const teamDetailRows = buildDetailRows(team.rows, {
    includeStaff: true,
    includeTeam: false,
    visibleColumns: columnVisibility,
  });
  const teamDetailData = teamDetailRows.length
    ? teamDetailRows
    : [teamDetailHeaders.map(() => '')];
  addDataRows(sheet, currentRow + 1, teamDetailData);

  const filename = `bao-cao-kpi-to-doi-${slugify(team.name || 'chua-gan')}.xlsx`;
  const { buffer, watermark, signature } = await finalizeWorkbook(workbook, options);
  return { buffer, filename, watermark, signature };
}

export async function generateAllStaffReport(payload = {}, options = {}) {
  const { staffList = [], summary = {}, range = {}, rules = {}, columns = {} } = payload;
  const columnVisibility = sanitizeColumnVisibility(columns);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Tong hop NV');
  configureSheet(sheet);

  const subtitles = [
    `Khoảng thời gian: ${formatRangeLabel(range)}`,
    `Quy tắc KPI: ${rules?.name || 'Chưa đặt tên'}`,
    rules?.applyFrom ? `Áp dụng từ ${rules.applyFrom}` : 'Áp dụng ngay',
  ];
  const nextRow = applyHeader(sheet, 'BÁO CÁO KPI – TỔNG HỢP NHÂN VIÊN', subtitles);

  let currentRow = nextRow;
  addSectionTitle(sheet, currentRow, '1. Tổng quan KPI');
  currentRow += 1;
  addTableHeader(sheet, currentRow, ['STT', 'Chỉ tiêu', 'Giá trị', 'Số lượt', '', '', '', '', '']);
  currentRow = addDataRows(sheet, currentRow + 1, buildSummaryRows(summary, summary.adjustmentTotals));

  currentRow += 1;
  addSectionTitle(sheet, currentRow, '2. Thống kê theo Nhân viên');
  currentRow += 1;
  const staffHeaders = [
    'STT',
    'Nhân viên',
    'Tổ đội',
    'Tờ khai',
    'Điểm KPI',
    'Nhập',
    'Xuất',
  ];
  if (columnVisibility.items) {
    staffHeaders.push('Mục hàng');
  }
  if (columnVisibility.licenses) {
    staffHeaders.push('Số GP');
  }
  if (columnVisibility.co) {
    staffHeaders.push('Tờ khai C/O');
  }
  if (columnVisibility.coLines) {
    staffHeaders.push('Dòng C/O');
  }
  if (columnVisibility.licenseCodes) {
    staffHeaders.push('Mã giấy phép');
  }
  addTableHeader(sheet, currentRow, staffHeaders);
  const staffRows = staffList.map((item, idx) => {
    const row = [
      idx + 1,
      item.name,
      item.teamLabel,
      item.stats?.decls || 0,
      item.stats?.kpi || 0,
      item.stats?.import || 0,
      item.stats?.export || 0,
    ];
    if (columnVisibility.items) {
      row.push(item.stats?.items || 0);
    }
    if (columnVisibility.licenses) {
      row.push(item.stats?.licenses || 0);
    }
    if (columnVisibility.co) {
      row.push(item.stats?.co || 0);
    }
    if (columnVisibility.coLines) {
      row.push(item.stats?.coLines || 0);
    }
    if (columnVisibility.licenseCodes) {
      row.push((item.stats?.licenseCodes || []).join(', ') || '—');
    }
    return row;
  });
  const staffData = staffRows.length
    ? staffRows
    : [staffHeaders.map((_, index) => (index === 1 ? 'Không có dữ liệu' : ''))];
  currentRow = addDataRows(sheet, currentRow + 1, staffData);

  currentRow += 1;
  addSectionTitle(sheet, currentRow, '3. Tổng hợp theo Công ty');
  currentRow += 1;
  const allStaffCompanyHeaders = buildCompanyHeaders({
    includeStaff: true,
    includeTeam: false,
    visibleColumns: columnVisibility,
  });
  addTableHeader(sheet, currentRow, allStaffCompanyHeaders);
  const companyRows = buildCompanyRows(
    staffList.flatMap((item) => item.rows || []),
    { includeStaff: true, includeTeam: false, visibleColumns: columnVisibility }
  );
  const allStaffCompanyData = companyRows.length
    ? companyRows
    : [allStaffCompanyHeaders.map((_, index) => (index === 1 ? 'Không có dữ liệu' : ''))];
  addDataRows(sheet, currentRow + 1, allStaffCompanyData);

  const { buffer, watermark, signature } = await finalizeWorkbook(workbook, options);
  return { buffer, filename: 'bao-cao-kpi-nhan-vien-tong-hop.xlsx', watermark, signature };
}

export async function generateAllTeamReport(payload = {}, options = {}) {
  const { teamList = [], summary = {}, range = {}, rules = {}, columns = {} } = payload;
  const columnVisibility = sanitizeColumnVisibility(columns);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Tong hop to doi');
  configureSheet(sheet);

  const subtitles = [
    `Khoảng thời gian: ${formatRangeLabel(range)}`,
    `Quy tắc KPI: ${rules?.name || 'Chưa đặt tên'}`,
    rules?.applyFrom ? `Áp dụng từ ${rules.applyFrom}` : 'Áp dụng ngay',
  ];
  const nextRow = applyHeader(sheet, 'BÁO CÁO KPI – TỔNG HỢP TỔ ĐỘI', subtitles);

  let currentRow = nextRow;
  addSectionTitle(sheet, currentRow, '1. Tổng quan KPI');
  currentRow += 1;
  addTableHeader(sheet, currentRow, ['STT', 'Chỉ tiêu', 'Giá trị', 'Số lượt', '', '', '', '', '']);
  currentRow = addDataRows(sheet, currentRow + 1, buildSummaryRows(summary, summary.adjustmentTotals));

  currentRow += 1;
  addSectionTitle(sheet, currentRow, '2. Thống kê theo Tổ đội');
  currentRow += 1;
  const teamHeaders = [
    'STT',
    'Tổ đội',
    'Thành viên',
    'Tờ khai',
    'Điểm KPI',
    'Nhập',
    'Xuất',
  ];
  if (columnVisibility.items) {
    teamHeaders.push('Mục hàng');
  }
  if (columnVisibility.licenses) {
    teamHeaders.push('Số GP');
  }
  if (columnVisibility.co) {
    teamHeaders.push('Tờ khai C/O');
  }
  if (columnVisibility.coLines) {
    teamHeaders.push('Dòng C/O');
  }
  if (columnVisibility.licenseCodes) {
    teamHeaders.push('Mã giấy phép');
  }
  addTableHeader(sheet, currentRow, teamHeaders);
  const teamRows = teamList.map((item, idx) => {
    const row = [
      idx + 1,
      item.name,
      item.memberNames?.join(', ') || '',
      item.stats?.decls || 0,
      item.stats?.kpi || 0,
      item.stats?.import || 0,
      item.stats?.export || 0,
    ];
    if (columnVisibility.items) {
      row.push(item.stats?.items || 0);
    }
    if (columnVisibility.licenses) {
      row.push(item.stats?.licenses || 0);
    }
    if (columnVisibility.co) {
      row.push(item.stats?.co || 0);
    }
    if (columnVisibility.coLines) {
      row.push(item.stats?.coLines || 0);
    }
    if (columnVisibility.licenseCodes) {
      row.push((item.stats?.licenseCodes || []).join(', ') || '—');
    }
    return row;
  });
  const teamData = teamRows.length
    ? teamRows
    : [teamHeaders.map((_, index) => (index === 1 ? 'Không có dữ liệu' : ''))];
  currentRow = addDataRows(sheet, currentRow + 1, teamData);

  currentRow += 1;
  addSectionTitle(sheet, currentRow, '3. Tổng hợp theo Công ty');
  currentRow += 1;
  const allTeamCompanyHeaders = buildCompanyHeaders({
    includeStaff: true,
    includeTeam: true,
    visibleColumns: columnVisibility,
  });
  addTableHeader(sheet, currentRow, allTeamCompanyHeaders);
  const companyRows = buildCompanyRows(
    teamList.flatMap((item) => item.rows || []),
    { includeStaff: true, includeTeam: true, visibleColumns: columnVisibility }
  );
  const allTeamCompanyData = companyRows.length
    ? companyRows
    : [allTeamCompanyHeaders.map((_, index) => (index === 1 ? 'Không có dữ liệu' : ''))];
  addDataRows(sheet, currentRow + 1, allTeamCompanyData);

  const { buffer, watermark, signature } = await finalizeWorkbook(workbook, options);
  return { buffer, filename: 'bao-cao-kpi-to-doi-tong-hop.xlsx', watermark, signature };
}

const REPORT_GENERATORS = {
  staff: generateStaffReport,
  team: generateTeamReport,
  allStaff: generateAllStaffReport,
  allTeam: generateAllTeamReport,
};

export async function generateReport(kind, payload, options = {}) {
  const generator = REPORT_GENERATORS[kind];
  if (!generator) {
    throw new Error('Loại báo cáo không hợp lệ');
  }

  const shouldUseCache = !options?.watermark;
  if (!shouldUseCache) {
    return generator(payload, options);
  }

  const cacheKey = buildCacheKey(kind, payload);
  const now = Date.now();
  purgeExpiredEntries(now);

  const cached = readCacheEntry(cacheKey, now);
  if (cached) {
    return cached;
  }

  const result = await generator(payload, options);
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

