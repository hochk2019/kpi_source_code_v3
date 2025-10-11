import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import ExcelJS from 'exceljs';
import { applyWorkbookWatermark, computeWatermarkSignature } from '../server/reportWatermark.js';
import { generateReport, clearReportCache } from '../server/reportExport.js';

const ORIGINAL_SECRET = process.env.KPI_EXPORT_SIGNATURE_SECRET;

function buildBasePayload() {
  return {
    staff: {
      name: 'Người kiểm thử',
      teamLabel: 'QA',
      stats: { decls: 0 },
      adjustmentSummary: {},
      rows: [],
    },
    range: {},
    rules: {},
    columns: {},
  };
}

beforeEach(() => {
  process.env.KPI_EXPORT_SIGNATURE_SECRET = 'unit-test-secret';
  clearReportCache();
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.KPI_EXPORT_SIGNATURE_SECRET;
  } else {
    process.env.KPI_EXPORT_SIGNATURE_SECRET = ORIGINAL_SECRET;
  }
  clearReportCache();
});

describe('applyWorkbookWatermark', () => {
  it('tạo header/footer và sheet chứng thực với chữ ký xác định', () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('BaoCao');
    const issuedAt = new Date('2024-02-12T03:15:00Z');
    const watermark = applyWorkbookWatermark(workbook, {
      actor: 'alice',
      actorName: 'Chị A',
      kind: 'staff',
      filters: { range: { from: '2024-01-01', to: '2024-01-31' } },
      ipAddress: '10.10.0.8',
      issuedAt,
      requestId: 'req-watermark-1',
    });

    const expectedSignature = computeWatermarkSignature({
      actor: 'alice',
      kind: 'staff',
      issuedAt,
      filtersSummary: watermark.filterSummary,
      requestId: 'req-watermark-1',
      secret: 'unit-test-secret',
    });
    expect(watermark.signature).toBe(expectedSignature);
    expect(watermark.shortSignature).toHaveLength(16);

    const [sheet] = workbook.worksheets;
    expect(sheet.headerFooter.oddHeader).toContain('SỬ DỤNG NỘI BỘ – KPI');
    expect(sheet.headerFooter.oddFooter).toContain('Mã xác thực');

    const metaSheet = workbook.getWorksheet('ChungThuc');
    expect(metaSheet).toBeTruthy();
    expect(metaSheet?.state).toBe('veryHidden');
    expect(metaSheet?.getRow(2).getCell(2).value).toContain('Chị A');
    expect(metaSheet?.getRow(6).getCell(2).value).toBe(watermark.signature);
  });
});

describe('generateReport watermark integration', () => {
  it('bỏ qua cache khi gắn watermark để mỗi người dùng có chữ ký riêng', async () => {
    const payload = buildBasePayload();
    const issuedAt = new Date('2024-03-01T01:00:00Z');

    const first = await generateReport('staff', payload, {
      watermark: {
        actor: 'alice',
        actorName: 'Chị A',
        kind: 'staff',
        filters: payload,
        issuedAt,
        requestId: 'req-a',
      },
    });

    const second = await generateReport('staff', payload, {
      watermark: {
        actor: 'bob',
        actorName: 'Anh B',
        kind: 'staff',
        filters: payload,
        issuedAt,
        requestId: 'req-b',
      },
    });

    expect(first.signature).toBeDefined();
    expect(second.signature).toBeDefined();
    expect(first.signature).not.toBe(second.signature);
  });

  it('tận dụng cache khi không yêu cầu watermark', async () => {
    const payload = buildBasePayload();

    const first = await generateReport('staff', payload);
    const second = await generateReport('staff', payload);

    expect(first.signature).toBeNull();
    expect(second.signature).toBeNull();
    expect(first.buffer.equals(second.buffer)).toBe(true);
  });
});

