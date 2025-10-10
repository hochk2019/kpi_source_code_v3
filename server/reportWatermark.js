import crypto from 'node:crypto';

function pad(value) {
  return value.toString().padStart(2, '0');
}

function clampString(value, max = 160) {
  if (typeof value !== 'string') {
    return value;
  }
  const normalized = value.normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max - 1)}…`;
}

function sanitizeText(value, fallback = '') {
  if (value === null || value === undefined) {
    return fallback;
  }
  return clampString(String(value), 120);
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return value;
}

function normalizeFilters(value, depth = 3, breadth = 10) {
  if (depth <= 0) {
    return '…';
  }
  if (Array.isArray(value)) {
    const output = value.slice(0, breadth).map((item) => normalizeFilters(item, depth - 1, breadth));
    if (value.length > breadth) {
      output.push('…');
    }
    return output;
  }
  if (value && typeof value === 'object') {
    const output = {};
    const entries = Object.entries(value)
      .filter(([key]) => typeof key === 'string')
      .slice(0, breadth);
    for (const [key, entryValue] of entries) {
      output[clampString(key, 60)] = normalizeFilters(entryValue, depth - 1, breadth);
    }
    return output;
  }
  if (typeof value === 'string') {
    return clampString(value, 160);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number(value);
  }
  return normalizeBoolean(value);
}

function buildFilterSummary(filters) {
  const normalized = normalizeFilters(filters);
  try {
    const summary = JSON.stringify(normalized, null, 0);
    return {
      normalized,
      summary: summary.length > 600 ? `${summary.slice(0, 599)}…` : summary,
    };
  } catch {
    return { normalized: {}, summary: '{}' };
  }
}

function formatTimestampVi(date) {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short',
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(date);
  } catch {
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(
      date.getMinutes()
    )}`;
  }
}

function resolveSecret(providedSecret) {
  if (providedSecret) {
    return providedSecret;
  }
  if (process.env.KPI_EXPORT_SIGNATURE_SECRET) {
    return process.env.KPI_EXPORT_SIGNATURE_SECRET;
  }
  if (process.env.KPI_SESSION_SECRET) {
    return process.env.KPI_SESSION_SECRET;
  }
  return 'kpi-export-signature-secret';
}

function computeSignatureSeed({ actor, kind, issuedAt, filtersSummary, requestId }) {
  return [actor, kind, issuedAt.toISOString(), filtersSummary, requestId].join('|');
}

export function computeWatermarkSignature(metadata = {}) {
  const issuedAt = metadata.issuedAt instanceof Date && !Number.isNaN(metadata.issuedAt)
    ? metadata.issuedAt
    : new Date();
  const actor = sanitizeText(metadata.actor, 'system');
  const kind = sanitizeText(metadata.kind, 'bao-cao');
  const filtersSummary = sanitizeText(metadata.filtersSummary || '{}', '{}');
  const requestIdSeed = metadata.requestId || crypto.randomUUID();
  const requestId = sanitizeText(requestIdSeed, requestIdSeed);
  const secret = resolveSecret(metadata.secret);
  const seed = computeSignatureSeed({ actor, kind, issuedAt, filtersSummary, requestId });
  return crypto.createHash('sha256').update(`${seed}|${secret}`, 'utf8').digest('hex');
}

export function applyWorkbookWatermark(workbook, metadata = {}) {
  if (!workbook) {
    return { signature: '', shortSignature: '', filters: {}, filterSummary: '{}' };
  }

  const issuedAt = metadata.issuedAt instanceof Date && !Number.isNaN(metadata.issuedAt)
    ? metadata.issuedAt
    : new Date();
  const actor = sanitizeText(metadata.actor, 'system');
  const actorName = sanitizeText(metadata.actorName);
  const displayName = actorName ? `${actorName} (${actor})` : actor;
  const kind = sanitizeText(metadata.kind, 'bao-cao');
  const ipAddress = sanitizeText(metadata.ipAddress);
  const { normalized: normalizedFilters, summary: filterSummary } = buildFilterSummary(metadata.filters || {});
  const requestSeed = metadata.requestId || crypto.randomUUID();
  const requestId = sanitizeText(requestSeed, requestSeed);
  const signature = computeWatermarkSignature({
    actor,
    kind,
    issuedAt,
    filtersSummary: filterSummary,
    requestId,
    secret: metadata.secret,
  });
  const shortSignature = signature.slice(0, 16).toUpperCase();
  const formattedIssuedAt = formatTimestampVi(issuedAt);

  workbook.creator = 'Hệ thống KPI';
  workbook.lastModifiedBy = displayName;
  workbook.created = issuedAt;
  workbook.modified = issuedAt;
  workbook.subject = `Báo cáo KPI – ${kind}`;
  workbook.company = 'KPI nội bộ';
  workbook.description = `Watermark: ${shortSignature}`;
  workbook.keywords = 'KPI;Bao cao;Noi bo;Watermark';

  const headerLines = [
    `&C&H"Arial,Bold"SỬ DỤNG NỘI BỘ – KPI`,
    `&C&"Arial"Xuất bởi: ${displayName}`,
    `&C&"Arial"Thời gian: ${formattedIssuedAt}`,
  ].join('\n');

  const footerLines = [
    `&L&"Arial"Loại: ${kind}`,
    `&C&H"Arial"Mã xác thực: ${shortSignature}`,
    ipAddress ? `&R&"Arial"IP: ${ipAddress}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  for (const sheet of workbook.worksheets) {
    sheet.headerFooter = {
      oddHeader: headerLines,
      evenHeader: headerLines,
      oddFooter: footerLines,
      evenFooter: footerLines,
    };
  }

  const metaSheetName = metadata.sheetName || 'ChungThuc';
  let metaSheet = workbook.getWorksheet(metaSheetName);
  if (!metaSheet) {
    metaSheet = workbook.addWorksheet(metaSheetName);
  }
  metaSheet.state = 'veryHidden';
  metaSheet.properties.outlineProperties = { summaryBelow: false, summaryRight: false };
  metaSheet.getColumn(1).width = 26;
  metaSheet.getColumn(2).width = 80;

  const rows = [
    ['CHỨNG THỰC WATERMARK', 'Dữ liệu Excel chỉ phục vụ nội bộ doanh nghiệp.'],
    ['Người xuất', displayName],
    ['Tài khoản', actor],
    ['Loại báo cáo', kind],
    ['Thời gian', formattedIssuedAt],
    ['Mã xác thực', signature],
  ];

  if (ipAddress) {
    rows.push(['Địa chỉ IP', ipAddress]);
  }

  if (filterSummary && filterSummary !== '{}') {
    rows.push(['Bộ lọc', filterSummary]);
  }

  rows.push(['Request ID', requestId]);
  rows.push(['Ghi chú', 'Không xoá sheet này. Khi điều tra, đối chiếu mã xác thực với nhật ký tải.']);

  metaSheet.spliceRows(1, metaSheet.rowCount, ...rows);
  const titleRow = metaSheet.getRow(1);
  titleRow.font = { bold: true, size: 12 };
  titleRow.alignment = { vertical: 'middle' };

  for (let idx = 2; idx <= rows.length; idx += 1) {
    const row = metaSheet.getRow(idx);
    row.getCell(1).font = { bold: true };
    row.alignment = { vertical: 'top', wrapText: true };
  }

  return {
    signature,
    shortSignature,
    issuedAt,
    formattedIssuedAt,
    filterSummary,
    filters: normalizedFilters,
    actor,
    actorName,
    displayName,
    kind,
    ipAddress,
    requestId,
  };
}

export function sanitizeExportFilters(filters) {
  return normalizeFilters(filters || {});
}

