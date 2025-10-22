import React, { useEffect, useMemo, useState } from 'react';

import useAsyncRequest from '@/hooks/useAsyncRequest.js';

import { fetchWithAuth } from '@/auth/localAuth.js';

import { toast } from '@/shared/toast.js';

import { formatDateTime } from '@/shared/format.js';

import { ROLE_LABELS, normalizeRoleKey } from '@/shared/accountRoles.js';



const DEFAULT_RANGE_DAYS = 7;

const DEFAULT_PAGE_SIZE = 50;

const PAGE_SIZE_OPTIONS = [25, 50, 100];



const EMPTY_RESPONSE = Object.freeze({

  entries: [],

  total: 0,

  page: 1,

  pageSize: DEFAULT_PAGE_SIZE,

  pageCount: 1,

  summary: { total: 0, latestCreatedAt: null, byKind: [], topUsers: [] },

  filters: { from: '', to: '', kind: 'all', search: '' },

  availableKinds: [],

});



function toDateInputString(date) {

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {

    return '';

  }

  return date.toISOString().slice(0, 10);

}



function buildDefaultRange() {

  const today = new Date();

  const fromDate = new Date(today);

  fromDate.setDate(fromDate.getDate() - (DEFAULT_RANGE_DAYS - 1));

  return {

    from: toDateInputString(fromDate),

    to: toDateInputString(today),

  };

}



function resolveRoleLabel(role) {

  const key = normalizeRoleKey(role);

  return ROLE_LABELS[key] || role || '—';

}



function formatFilters(filters) {

  if (!filters || typeof filters !== 'object') {

    return '';

  }

  try {

    return JSON.stringify(filters, null, 2);

  } catch {

    return '';

  }

}



export default function ExportAuditReport() {

  const defaultRange = useMemo(() => buildDefaultRange(), []);

  const [formState, setFormState] = useState(() => ({ ...defaultRange, search: '', kind: 'all' }));

  const [filters, setFilters] = useState(() => ({ ...defaultRange, search: '', kind: 'all' }));

  const [page, setPage] = useState(1);

  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);



  const { data, loading, error, execute } = useAsyncRequest(

    async ({ signal }, params) => {

      const query = new URLSearchParams();

      query.set('limit', params.limit);

      query.set('page', params.page);

      if (params.from) query.set('from', params.from);

      if (params.to) query.set('to', params.to);

      if (params.kind && params.kind !== 'all') query.set('kind', params.kind);

      if (params.search) query.set('search', params.search);



      const response = await fetchWithAuth(`/api/reports/export/audit?${query.toString()}`, { signal });

      let payload = null;

      try {

        payload = await response.json();

      } catch {

        payload = null;

      }

      if (!response.ok || !payload || payload.ok === false) {

        const message = payload?.error || `Không thể tải lịch sử export (HTTP ${response.status}).`;

        throw new Error(message);

      }

      return payload;

    },

    {

      initialData: EMPTY_RESPONSE,

      onError: (err) => {

        toast.error(err?.message || 'Không thể tải lịch sử export.');

      },

    }

  );



  const auditData = data || EMPTY_RESPONSE;

  const entries = Array.isArray(auditData.entries) ? auditData.entries : [];

  const summary = auditData.summary || EMPTY_RESPONSE.summary;

  const availableKinds = useMemo(() => {

    const kindSet = new Set(['all']);

    if (Array.isArray(auditData.availableKinds)) {

      for (const kind of auditData.availableKinds) {

        if (kind) kindSet.add(kind);

      }

    }

    if (filters.kind && filters.kind !== 'all') {

      kindSet.add(filters.kind);

    }

    return Array.from(kindSet);

  }, [auditData.availableKinds, filters.kind]);



  const totalPages = auditData.pageCount || Math.max(1, Math.ceil((auditData.total || 0) / pageSize));



  useEffect(() => {

    execute({

      limit: pageSize,

      page,

      from: filters.from,

      to: filters.to,

      kind: filters.kind,

      search: filters.search,

    });

  }, [execute, filters.from, filters.to, filters.kind, filters.search, page, pageSize]);



  useEffect(() => {

    if (!loading && totalPages > 0 && page > totalPages) {

      setPage(totalPages);

    }

  }, [loading, page, totalPages]);



  const handleFormChange = (field) => (event) => {

    const value = event?.target?.value ?? '';

    setFormState((prev) => ({ ...prev, [field]: value }));

  };



  const handleSubmit = (event) => {

    event.preventDefault();

    setFilters({ ...formState });

    setPage(1);

  };



  const handleReset = () => {

    const nextRange = buildDefaultRange();

    const next = { ...nextRange, search: '', kind: 'all' };

    setFormState(next);

    setFilters(next);

    setPage(1);

  };



  const handlePrevious = () => {

    setPage((prev) => Math.max(1, prev - 1));

  };



  const handleNext = () => {

    setPage((prev) => Math.min(totalPages, prev + 1));

  };



  const renderSummaryList = (items, emptyLabel) => {

    if (!Array.isArray(items) || items.length === 0) {

      return <p className="text-sm text-gray-500 dark:text-gray-400">{emptyLabel}</p>;

    }

    return (

      <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">

        {items.map((item) => (

          <li key={`${item.kind || item.username}`} className="flex items-center justify-between">

            <span className="truncate pr-2">{item.kind || item.displayName || item.username}</span>

            <span className="font-semibold text-amber-600 dark:text-amber-300">{item.total.toLocaleString('vi-VN')}</span>

          </li>

        ))}

      </ul>

    );

  };



  return (

    <div className="space-y-6">

      <section className="rounded-lg border border-amber-200 bg-white p-4 shadow-sm dark:border-amber-500/40 dark:bg-slate-900">

        <header className="mb-4">

          <h2 className="text-lg font-semibold text-amber-700 dark:text-amber-300">Tra cứu lịch sử export</h2>

          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">

            Lọc theo khoảng ngày, loại báo cáo hoặc từ khóa (tài khoản, mã xác thực, địa chỉ IP) để hỗ trợ tra soát việc tải file Excel có watermark.

          </p>

        </header>

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-5">

          <div className="flex flex-col">

            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Từ ngày</label>

            <input

              type="date"

              value={formState.from}

              onChange={handleFormChange('from')}

              className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"

            />

          </div>

          <div className="flex flex-col">

            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Đến ngày</label>

            <input

              type="date"

              value={formState.to}

              onChange={handleFormChange('to')}

              className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"

            />

          </div>

          <div className="flex flex-col">

            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Loại báo cáo</label>

            <select

              value={formState.kind}

              onChange={handleFormChange('kind')}

              className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"

            >

              {availableKinds.map((kind) => (

                <option key={kind} value={kind}>

                  {kind === 'all' ? 'Tất cả' : kind}

                </option>

              ))}

            </select>

          </div>

          <div className="flex flex-col md:col-span-2">

            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Từ khóa</label>

            <input

              type="text"

              placeholder="Tài khoản, mã xác thực, IP..."

              value={formState.search}

              onChange={handleFormChange('search')}

              className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"

            />

          </div>

          <div className="flex flex-wrap items-end gap-2 md:col-span-5">

            <button

              type="submit"

              className="rounded bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-amber-300"

              disabled={loading}

            >

              Áp dụng bộ lọc

            </button>

            <button

              type="button"

              onClick={handleReset}

              className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"

            >

              Đặt lại mặc định

            </button>

            {error && (

              <span className="text-sm text-red-600 dark:text-red-400">{error}</span>

            )}

          </div>

        </form>

      </section>



      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">

        <div className="grid gap-4 md:grid-cols-3">

          <div>

            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tổng lượt tải</h3>

            <p className="mt-1 text-2xl font-semibold text-amber-600 dark:text-amber-300">

              {summary.total.toLocaleString('vi-VN')}

            </p>

            <p className="text-sm text-gray-600 dark:text-gray-400">

              Mới nhất: {summary.latestCreatedAt ? formatDateTime(summary.latestCreatedAt, { withSeconds: true }) : '—'}

            </p>

          </div>

          <div>

            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Theo loại báo cáo</h3>

            {renderSummaryList(summary.byKind, 'Chưa có dữ liệu trong khoảng đã chọn.')}

          </div>

          <div>

            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Top tài khoản tải</h3>

            {renderSummaryList(

              (summary.topUsers || []).map((item) => ({

                kind: `${item.displayName || item.username} (${resolveRoleLabel(item.role)})`,

                total: item.total,

              })),

              'Chưa ghi nhận tài khoản nào trong khoảng đã chọn.'

            )}

          </div>

        </div>

      </section>



      <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">

        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">

          <div>

            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">Danh sách lịch sử export</h3>

            <p className="text-sm text-gray-500 dark:text-gray-400">

              Hiển thị {entries.length.toLocaleString('vi-VN')} / {auditData.total.toLocaleString('vi-VN')} lượt tải.

            </p>

          </div>

          {loading && <span className="text-sm text-amber-600 dark:text-amber-300">Đang tải dữ liệu...</span>}

        </div>

        <div className="overflow-x-auto">

          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">

            <thead className="bg-slate-50 dark:bg-slate-800">

              <tr>

                <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Thời gian tải</th>

                <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Báo cáo</th>

                <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Người tải</th>

                <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Mã xác thực</th>

                <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">IP & thiết bị</th>

                <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Bộ lọc</th>

              </tr>

            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">

              {entries.length === 0 ? (

                <tr>

                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">

                    Không có bản ghi nào trong khoảng thời gian đã chọn.

                  </td>

                </tr>

              ) : (

                entries.map((entry) => (

                  <tr key={`${entry.id}-${entry.requestId || entry.signature}`} className="bg-white odd:bg-slate-50 dark:bg-slate-900 dark:odd:bg-slate-800/70">

                    <td className="align-top px-4 py-3">

                      <div className="font-medium text-gray-800 dark:text-gray-100">

                        {formatDateTime(entry.createdAt, { withSeconds: true }) || '—'}

                      </div>

                      <div className="text-xs text-gray-500 dark:text-gray-400">

                        Phát hành: {formatDateTime(entry.issuedAt, { withSeconds: true }) || '—'}

                      </div>

                    </td>

                    <td className="align-top px-4 py-3">

                      <div className="font-medium text-gray-800 dark:text-gray-100">{entry.reportKind || '—'}</div>

                      <div className="text-xs text-gray-500 dark:text-gray-400">{entry.filename || 'Không rõ tên file'}</div>

                    </td>

                    <td className="align-top px-4 py-3">

                      <div className="font-medium text-gray-800 dark:text-gray-100">{entry.displayName || entry.username || 'Không rõ'}</div>

                      <div className="text-xs text-gray-500 dark:text-gray-400">

                        {entry.username || '—'} • {resolveRoleLabel(entry.role)}

                      </div>

                    </td>

                    <td className="align-top px-4 py-3">

                      <div className="font-mono text-sm text-amber-600 dark:text-amber-300">{entry.shortSignature || '—'}</div>

                      <div className="text-xs text-gray-500 dark:text-gray-400 break-all">{entry.signature || '—'}</div>

                      <div className="text-xs text-gray-500 dark:text-gray-400">Yêu cầu: {entry.requestId || '—'}</div>

                    </td>

                    <td className="align-top px-4 py-3">

                      <div className="text-sm text-gray-700 dark:text-gray-200">{entry.ipAddress || '—'}</div>

                      <div className="text-xs text-gray-500 dark:text-gray-400 break-all">{entry.userAgent || '—'}</div>

                    </td>

                    <td className="align-top px-4 py-3">

                      <div className="text-sm text-gray-700 dark:text-gray-200">{entry.filterSummary || '—'}</div>

                      {entry.filters ? (

                        <details className="mt-2 text-xs text-amber-600 dark:text-amber-300">

                          <summary className="cursor-pointer select-none font-medium">Xem chi tiết</summary>

                          <pre className="mt-1 max-h-48 overflow-auto rounded bg-slate-900/90 p-2 text-[11px] leading-relaxed text-amber-100">

                            {formatFilters(entry.filters)}

                          </pre>

                        </details>

                      ) : null}

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-700">

          <div className="text-gray-600 dark:text-gray-300">

            Trang {page.toLocaleString('vi-VN')} / {totalPages.toLocaleString('vi-VN')}

          </div>

          <div className="flex flex-wrap items-center gap-3">

            <label className="flex items-center gap-2 text-gray-600 dark:text-gray-300">

              <span>Hiển thị</span>

              <select

                value={pageSize}

                onChange={(event) => {

                  const value = Number(event.target.value) || DEFAULT_PAGE_SIZE;

                  setPageSize(value);

                  setPage(1);

                }}

                className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"

              >

                {PAGE_SIZE_OPTIONS.map((size) => (

                  <option key={size} value={size}>

                    {size} / trang

                  </option>

                ))}

              </select>

            </label>

            <div className="flex items-center gap-2">

              <button

                type="button"

                onClick={handlePrevious}

                disabled={page <= 1}

                className="rounded border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"

              >

                Trang trước

              </button>

              <button

                type="button"

                onClick={handleNext}

                disabled={page >= totalPages}

                className="rounded border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"

              >

                Trang tiếp

              </button>

            </div>

          </div>

        </footer>

      </section>

    </div>

  );

}

