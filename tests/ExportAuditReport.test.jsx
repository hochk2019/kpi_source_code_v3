import React from 'react';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { render, screen, waitFor, cleanup } from '@testing-library/react';



vi.mock('@/auth/localAuth.js', async () => {

  const actual = await vi.importActual('@/auth/localAuth.js');

  return {

    ...actual,

    fetchWithAuth: vi.fn(),

  };

});



import ExportAuditReport from '@/components/ExportAuditReport.jsx';

import { fetchWithAuth } from '@/auth/localAuth.js';

import { toast } from '@/shared/toast.js';



const BASE_ENTRY = {

  id: 'entry-1',

  createdAt: '2024-09-10T02:15:00.000Z',

  issuedAt: '2024-09-10T02:14:45.000Z',

  username: 'admin',

  displayName: 'Admin Tester',

  role: 'admin',

  reportKind: 'report.monthly',

  filename: 'kpi-2024-09.xlsx',

  signature: 'abc123456789',

  shortSignature: 'abc1234',

  filterSummary: 'Tháng 9/2024',

  filters: { from: '2024-09-01', to: '2024-09-10' },

  ipAddress: '192.168.1.10',

  requestId: 'req-123',

  userAgent: 'Mozilla/5.0',

};



const BASE_ACCESS_VIEW = {
  id: 'access-1',
  viewedAt: '2024-09-10T03:15:00.000Z',
  username: 'admin',
  displayName: 'Admin Tester',
  role: 'admin',
  ipAddress: '192.168.1.11',
  clientHost: 'DESKTOP-01',
  filters: { from: '2024-09-01', to: '2024-09-10', kind: 'all', search: '', limit: 50, page: 1 },
};

const BASE_SUMMARY = {
  total: 1,
  latestCreatedAt: BASE_ENTRY.createdAt,
  byKind: [{ kind: 'report.monthly', total: 1 }],
  topUsers: [{ username: 'admin', displayName: 'Admin Tester', role: 'admin', total: 1 }],
  latestView: { ...BASE_ACCESS_VIEW },
  recentViews: [BASE_ACCESS_VIEW],
  totalViews: 3,
};



const BASE_AVAILABLE_KINDS = ['all', 'report.monthly', 'report.audit', 'report.team'];



function computeDefaultRange() {

  const today = new Date();

  const from = new Date(today);

  from.setDate(from.getDate() - 6);

  const toString = (date) => date.toISOString().slice(0, 10);

  return {

    from: toString(from),

    to: toString(today),

  };

}



function buildPayload(overrides = {}) {

  const defaults = {

    ok: true,

    entries: [BASE_ENTRY],

    total: 1,

    page: 1,

    pageSize: 50,

    pageCount: 1,

    summary: { ...BASE_SUMMARY },

    filters: { ...computeDefaultRange(), kind: 'all', search: '' },

    availableKinds: BASE_AVAILABLE_KINDS,

  };

  const summaryOverrides = overrides.summary ?? {};
  return {
    ...defaults,
    ...overrides,
    entries: overrides.entries ?? defaults.entries,
    summary: {
      ...defaults.summary,
      ...summaryOverrides,
      latestView: summaryOverrides.latestView ?? defaults.summary.latestView,
      recentViews: summaryOverrides.recentViews ?? defaults.summary.recentViews,
      totalViews: summaryOverrides.totalViews ?? defaults.summary.totalViews,
    },
    filters: { ...defaults.filters, ...overrides.filters },
    availableKinds: overrides.availableKinds ?? defaults.availableKinds,
  };

}



const resolveResponse = (overrides) =>

  Promise.resolve({

    ok: true,

    json: async () => buildPayload(overrides),

  });



describe('ExportAuditReport', () => {

  let toastSpy;



  beforeEach(() => {

    fetchWithAuth.mockReset();

    fetchWithAuth.mockImplementation(() => resolveResponse());

    toastSpy = vi.spyOn(toast, 'error').mockImplementation(() => {});

  });



  afterEach(() => {

    cleanup();

    toastSpy.mockRestore();

    fetchWithAuth.mockReset();

  });



  it('gọi API với bộ lọc mặc định khi render', async () => {

    render(<ExportAuditReport />);



    await waitFor(() => expect(fetchWithAuth).toHaveBeenCalled());



    const [requestedUrl] = fetchWithAuth.mock.calls.at(-1);

    const url = new URL(requestedUrl, 'https://example.com');

    const { from, to } = computeDefaultRange();



    expect(url.pathname).toBe('/api/v4/reporting/exports/audit');

    expect(url.searchParams.get('limit')).toBe('50');

    expect(url.searchParams.get('page')).toBe('1');

    expect(url.searchParams.get('from')).toBe(from);

    expect(url.searchParams.get('to')).toBe(to);

    expect(url.searchParams.get('kind')).toBeNull();

    expect(url.searchParams.get('search')).toBeNull();

  });



  it('thông báo lỗi khi tải dữ liệu thất bại', async () => {

    fetchWithAuth.mockImplementationOnce(() => Promise.reject(new Error('Network down')));



    render(<ExportAuditReport />);



    await waitFor(() => expect(toastSpy).toHaveBeenCalledTimes(1));



    expect(toastSpy.mock.calls[0][0]).toContain('Network down');

  });

  it('hiển thị nhật ký truy cập gần nhất', async () => {
    const emptySummary = {
      ...BASE_SUMMARY,
      latestView: null,
      recentViews: [],
      totalViews: 0,
    };

    fetchWithAuth.mockImplementationOnce(() => resolveResponse({ summary: emptySummary }));

    render(<ExportAuditReport />);

    await waitFor(() => expect(fetchWithAuth).toHaveBeenCalled());

    expect(screen.getByText('Lượt truy cập tab')).toBeInTheDocument();
    expect(screen.getByText('Lượt truy cập gần đây')).toBeInTheDocument();

    expect(await screen.findByText('Chưa ghi nhận lượt truy cập nào.')).toBeInTheDocument();
  });




});
