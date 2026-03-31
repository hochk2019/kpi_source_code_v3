/* @vitest-environment jsdom */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/auth/localAuth.js', () => ({
  fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from '@/auth/localAuth.js';
import {
  exportAllTeamReport,
  exportAllStaffReport,
  exportStaffReport,
  exportTeamReport,
} from '@/lib/reportExport.js';

describe('reportExport client', () => {
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let anchorClickSpy;

  beforeEach(() => {
    fetchWithAuth.mockReset();
    fetchWithAuth.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['mock-excel']),
      headers: {
        get(name) {
          if (String(name).toLowerCase() === 'content-disposition') {
            return 'attachment; filename=bao-cao-kpi.xlsx';
          }
          return null;
        },
      },
    });

    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock-export');
    URL.revokeObjectURL = vi.fn();
    anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    anchorClickSpy.mockRestore();
    fetchWithAuth.mockReset();
  });

  it('gửi compact payload khi xuất tổng hợp nhân viên', async () => {
    await exportAllStaffReport({
      range: { from: '2026-01-01', to: '2026-02-28' },
      rules: { id: 'legacy-kpi', name: 'Legacy KPI' },
      columns: { items: true, licenses: false },
      staffList: [{ key: 'lan' }],
      summary: { decls: 99 },
    });

    const [requestedUrl, requestInit] = fetchWithAuth.mock.calls[0];
    const body = JSON.parse(requestInit.body);
    expect(new URL(requestedUrl, 'https://example.com').pathname).toBe('/api/v4/reporting/exports');

    expect(body).toEqual({
      kind: 'allStaff',
      payload: {
        source: 'reporting-v4',
        query: {
          from: '2026-01-01',
          to: '2026-02-28',
        },
        ruleId: 'legacy-kpi',
        columns: {
          items: true,
          licenses: false,
        },
      },
    });
  });

  it('gửi staffKey thay cho blob staff detail', async () => {
    await exportStaffReport({
      staff: {
        key: 'lan',
        name: 'Lan',
        rows: [{ so_tk: 'TK1' }],
      },
      range: { from: '2026-02-01', to: '2026-02-28' },
      rules: { id: 'legacy-kpi', name: 'Legacy KPI' },
      columns: { items: true },
    });

    const [, requestInit] = fetchWithAuth.mock.calls[0];
    const body = JSON.parse(requestInit.body);

    expect(body).toEqual({
      kind: 'staff',
      payload: {
        source: 'reporting-v4',
        query: {
          from: '2026-02-01',
          to: '2026-02-28',
        },
        ruleId: 'legacy-kpi',
        staffKey: 'lan',
        columns: {
          items: true,
        },
      },
    });
  });

  it('gửi compact payload khi xuất tổng hợp tổ đội', async () => {
    await exportAllTeamReport({
      range: { from: '2026-03-01', to: '2026-03-31' },
      rules: { id: 'legacy-kpi', name: 'Legacy KPI' },
      columns: { licenses: true },
    });

    const [, requestInit] = fetchWithAuth.mock.calls[0];
    const body = JSON.parse(requestInit.body);

    expect(body).toEqual({
      kind: 'allTeam',
      payload: {
        source: 'reporting-v4',
        query: {
          from: '2026-03-01',
          to: '2026-03-31',
        },
        ruleId: 'legacy-kpi',
        columns: {
          licenses: true,
        },
      },
    });
  });

  it('gửi teamKey thay cho blob team detail', async () => {
    await exportTeamReport({
      team: {
        key: 'team-1',
        name: 'Team 1',
        rows: [{ so_tk: 'TK9' }],
      },
      range: { from: '2026-03-01', to: '2026-03-31' },
      rules: { id: 'legacy-kpi', name: 'Legacy KPI' },
      columns: { co: true },
    });

    const [, requestInit] = fetchWithAuth.mock.calls[0];
    const body = JSON.parse(requestInit.body);

    expect(body).toEqual({
      kind: 'team',
      payload: {
        source: 'reporting-v4',
        query: {
          from: '2026-03-01',
          to: '2026-03-31',
        },
        ruleId: 'legacy-kpi',
        teamKey: 'team-1',
        columns: {
          co: true,
        },
      },
    });
  });
});
