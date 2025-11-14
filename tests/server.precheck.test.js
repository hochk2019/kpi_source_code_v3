import process from 'node:process';

import { describe, it, expect } from 'vitest';

import { evaluateDiskHealth } from '../server/index.js';

process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.KPI_SKIP_LISTEN = '1';

describe('evaluateDiskHealth', () => {
  it('cảnh báo khi CSDL chạy ở chế độ memory', () => {
    const result = evaluateDiskHealth({
      database: { warningCode: 'memory_db' },
    });

    expect(result.severity).toBe('warning');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'database_memory_mode',
          severity: 'warning',
        }),
      ]),
    );
  });

  it('nâng mức nghiêm trọng lên critical khi ổ đĩa sử dụng trên 95%', () => {
    const result = evaluateDiskHealth({
      disk: { usedPercent: 96.2 },
    });

    expect(result.severity).toBe('critical');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'disk_usage_critical',
          severity: 'critical',
        }),
      ]),
    );
  });

  it('cảnh báo khi dung lượng trống còn dưới 2GB', () => {
    const result = evaluateDiskHealth({
      disk: {
        usedPercent: 70,
        freeBytes: 1.5 * 1024 * 1024 * 1024,
      },
    });

    expect(result.severity).toBe('warning');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'disk_free_low',
          severity: 'warning',
        }),
      ]),
    );
  });
});
