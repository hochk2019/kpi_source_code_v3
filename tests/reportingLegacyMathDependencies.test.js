import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/store.js', () => {
  throw new Error('legacy store import should not happen');
});

vi.mock('../src/lib/rules.js', () => {
  throw new Error('legacy rules import should not happen');
});

describe('shared/reportingLegacyMath dependency boundary', () => {
  it('loads without importing legacy store or rules modules', async () => {
    const module = await import('../shared/reportingLegacyMath.js');

    expect(typeof module.buildReportData).toBe('function');
  });
});
