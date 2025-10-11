import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { fetchWithAuth } from '@/auth/localAuth.js';

const KIND_OPTIONS = [
  { value: 'all', label: 'Tất cả hành động' },
  { value: 'account', label: 'Quản trị tài khoản' },
  { value: 'data', label: 'Dữ liệu & sao lưu' },
  { value: 'import', label: 'Import & đồng bộ' },
  { value: 'security', label: 'Bảo mật & phân quyền' },
];

function toDateInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  const copy = new Date(date.getTime());
  copy.setHours(0, 0, 0, 0);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

function subtractDays(date, days) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return new Date();
  }
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() - days);
  return copy;
}

function formatDateTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('vi-VN', { hour12: false });
  } catch {
    return value;
  }
}

function buildQuery(filters, page, pageSize) {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.kind && filters.kind !== 'all') params.set('kind', filters.kind);
  if (filters.search) params.set('search', filters.search.trim());
  if (page && page > 1) params.set('page', String(page));
  if (pageSize && pageSize > 0) params.set('pageSize', String(pageSize));
  return params.toString();
}

function normalizeSummary(summary) {
  if (!summary || typeof summary !== 'object') {
    return null;
  }
  const topUsers = Array.isArray(summary.topUsers)
    ? summary.topUsers
        .map((entry) => ({
          actor: entry?.actor || 'system',
          count: Number.isFinite(entry?.count) ? entry.count : 0,
        }))
        .filter((entry) => entry.actor)
    : [];
  const byKind = Array.isArray(summary.byKind)
    ? summary.byKind
        .map((entry) => ({
          kind: entry?.kind || 'khác',
          count: Number.isFinite(entry?.count) ? entry.count : 0,
        }))
        .filter((entry) => entry.kind)
    : [];
  const total = Number.isFinite(summary.total) ? summary.total : null;
  return { total, topUsers, byKind };
}

export default function ExportAuditReport({ pageSize = 20 } = {}) {
  const defaultRange = useMemo(() => {
    const now = new Date();
    return {
      from: toDateInputValue(subtractDays(now, 6)),
      to: toDateInputValue(now),
    };
  }, []);

  const [draft, setDraft] = useState(() => ({
    from: defaultRange.from,
    to: defaultRange.to,
    kind: 'all',
    search: '',
  }));
  const [filters, setFilters] = useState(() => ({ ...draft }));
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState({ page: 1, total: 0, pageSize, hasNext: false, hasPrev: false, pageCount: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft((prev) => ({ ...prev, ...filters }));
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;

    const load = async () => {
      setLoading(true);
      setError('');
      const query = buildQuery(filters, page, pageSize);
      const url = `/api/admin/audit/report${query ? `?${query}` : ''}`;
      try {
        const response = await fetchWithAuth(url, { cache: 'no-store', signal: controller?.signal });
        if (!response.ok) {
          throw new Error(response.statusText || `HTTP ${response.status}`);
        }
        const payload = await response.json();
        if (payload?.ok === false) {
          throw new Error(payload.error || 'Không thể tải báo cáo audit.');
        }
        if (cancelled) return;
        setEntries(Array.isArray(payload?.entries) ? payload.entries : []);
        setSummary(normalizeSummary(payload?.summary));
        const metaInfo = payload?.meta || {};
        setMeta({
          page: Number.isFinite(metaInfo.page) ? metaInfo.page : page,
          total: Number.isFinite(metaInfo.total) ? metaInfo.total : (payload?.entries?.length ?? 0),
          pageSize: Number.isFinite(metaInfo.pageSize) ? metaInfo.pageSize : pageSize,
          hasNext: Boolean(metaInfo.hasNext),
          hasPrev: Boolean(metaInfo.hasPrev),
          pageCount: Number.isFinite(metaInfo.pageCount) ? metaInfo.pageCount : null,
        });
      } catch (err) {
        if (cancelled) return;
        const message = err?.message || 'Không thể tải báo cáo audit.';
        setError(message);
        toast.error(message);
        setEntries([]);
        setSummary(null);
        setMeta((prev) => ({ ...prev, page }));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      controller?.abort();
    };
  }, [filters, page, pageSize]);

  const totalPages = useMemo(() => {
    if (meta.pageCount && meta.pageCount > 0) {
      return meta.pageCount;
    }
    const size = Number.isFinite(meta.pageSize) && meta.pageSize > 0 ? meta.pageSize : pageSize;
    if (!size || size <= 0) return null;
    if (meta.total && meta.total > 0) {
      return Math.max(1, Math.ceil(meta.total / size));
    }
    if (entries.length > 0 && !meta.total) {
      return meta.page;
    }
    return null;
  }, [entries.length, meta.page, meta.pageCount, meta.pageSize, meta.total, pageSize]);

  const handleSubmit = (event) => {
    event.preventDefault();
    setFilters({
      from: draft.from || '',
      to: draft.to || '',
      kind: draft.kind || 'all',
      search: draft.search?.trim() || '',
    });
    setPage(1);
  };

  const handleReset = () => {
    const next = { from: defaultRange.from, to: defaultRange.to, kind: 'all', search: '' };
    setDraft(next);
    setFilters(next);
    setPage(1);
  };

  const handlePageChange = (direction) => {
    setPage((current) => {
      if (direction === 'prev') {
        return current > 1 ? current - 1 : 1;
      }
      if (direction === 'next') {
        return current + 1;
      }
      if (Number.isFinite(direction) && direction > 0) {
        return direction;
      }
      return current;
    });
  };

  const effectiveTotal = meta.total ?? entries.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Báo cáo nhật ký hệ thống</h2>
          <p className="text-sm text-gray-500">
            Xuất thống kê thao tác theo khoảng thời gian, loại hành động và từ khóa tìm kiếm.
          </p>
        </div>
        <div className="text-sm text-gray-600">
          Tổng số bản ghi:{' '}
          <span className="font-semibold text-gray-900" data-testid="audit-total-count">
            {effectiveTotal.toLocaleString('vi-VN')}
          </span>
        </div>
      </div>

      <form
        className="flex flex-wrap items-end gap-4 rounded border border-gray-200 bg-white p-4 shadow-sm"
        onSubmit={handleSubmit}
        aria-label="Bộ lọc báo cáo audit"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-gray-500" htmlFor="audit-from">
            Từ ngày
          </label>
          <input
            id="audit-from"
            name="from"
            type="date"
            className="w-44 rounded border px-3 py-2 text-sm"
            value={draft.from}
            onChange={(event) => setDraft((prev) => ({ ...prev, from: event.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-gray-500" htmlFor="audit-to">
            Đến ngày
          </label>
          <input
            id="audit-to"
            name="to"
            type="date"
            className="w-44 rounded border px-3 py-2 text-sm"
            value={draft.to}
            onChange={(event) => setDraft((prev) => ({ ...prev, to: event.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase text-gray-500" htmlFor="audit-kind">
            Nhóm hành động
          </label>
          <select
            id="audit-kind"
            name="kind"
            className="w-48 rounded border px-3 py-2 text-sm"
            value={draft.kind}
            onChange={(event) => setDraft((prev) => ({ ...prev, kind: event.target.value }))}
          >
            {KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1 min-w-[12rem]">
          <label className="text-xs font-semibold uppercase text-gray-500" htmlFor="audit-search">
            Từ khóa
          </label>
          <input
            id="audit-search"
            name="search"
            type="search"
            placeholder="Nhập người dùng, hành động hoặc chi tiết"
            className="rounded border px-3 py-2 text-sm"
            value={draft.search}
            onChange={(event) => setDraft((prev) => ({ ...prev, search: event.target.value }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="rounded bg-black px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800"
          >
            Áp dụng
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Mặc định 7 ngày
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          Không thể tải dữ liệu: {error}
        </div>
      )}

      <div className="space-y-4" aria-live="polite">
        {loading && (
          <div className="text-sm text-gray-500" data-testid="audit-loading">
            Đang tải dữ liệu báo cáo...
          </div>
        )}

        {!loading && entries.length === 0 && !error && (
          <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
            Không có bản ghi phù hợp với bộ lọc hiện tại.
          </div>
        )}

        {summary && (
          <div className="grid gap-4 md:grid-cols-2" aria-label="Tóm tắt báo cáo audit">
            <section className="rounded border bg-white p-4 shadow-sm" aria-label="Top người dùng">
              <h3 className="text-sm font-semibold text-gray-700">Top người dùng</h3>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                {summary.topUsers.length === 0 && <li>Chưa có thống kê.</li>}
                {summary.topUsers.map((entry) => (
                  <li key={entry.actor} className="flex items-center justify-between">
                    <span className="font-medium text-gray-800">{entry.actor}</span>
                    <span>{entry.count.toLocaleString('vi-VN')} thao tác</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded border bg-white p-4 shadow-sm" aria-label="Thống kê theo nhóm hành động">
              <h3 className="text-sm font-semibold text-gray-700">Thống kê theo nhóm hành động</h3>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                {summary.byKind.length === 0 && <li>Chưa có thống kê.</li>}
                {summary.byKind.map((entry) => (
                  <li key={entry.kind} className="flex items-center justify-between">
                    <span className="font-medium text-gray-800">{entry.kind}</span>
                    <span>{entry.count.toLocaleString('vi-VN')} lần</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {entries.length > 0 && (
          <div className="overflow-x-auto rounded border bg-white shadow-sm">
            <table className="min-w-full divide-y text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Thời gian</th>
                  <th className="px-3 py-2">Người dùng</th>
                  <th className="px-3 py-2">Hành động</th>
                  <th className="px-3 py-2">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((entry) => (
                  <tr key={entry.id || `${entry.ts}-${entry.actor}-${entry.action}`} className="odd:bg-white even:bg-gray-50">
                    <td className="whitespace-nowrap px-3 py-2">{formatDateTime(entry.ts)}</td>
                    <td className="px-3 py-2">{entry.actor || 'system'}</td>
                    <td className="px-3 py-2">{entry.action || 'unknown'}</td>
                    <td className="px-3 py-2 whitespace-pre-wrap text-gray-700">{entry.detail || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
          <div>
            Trang <span className="font-semibold text-gray-800">{meta.page}</span>
            {totalPages ? (
              <span>
                {' '}của <span className="font-semibold text-gray-800">{totalPages}</span>
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange('prev')}
              disabled={loading || meta.page <= 1 || !meta.hasPrev}
              className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 disabled:opacity-50"
            >
              Trang trước
            </button>
            <button
              type="button"
              onClick={() => handlePageChange('next')}
              disabled={loading || (!meta.hasNext && (!totalPages || meta.page >= totalPages))}
              className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 disabled:opacity-50"
            >
              Trang tiếp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
