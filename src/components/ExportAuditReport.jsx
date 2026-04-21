import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  History,
  User,
  Clock,
  Search,
  FileText,
  Filter,
  Globe,
  Laptop,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RotateCcw
} from 'lucide-react';

import useAsyncRequest from '@/hooks/useAsyncRequest.js';
import { fetchWithAuth } from '@/auth/localAuth.js';
import { API_V4_ROUTES } from '@/lib/apiRoutes.js';
import { toast } from '@/shared/toast.js';
import { formatDateTime } from '../../packages/domain/src/format.js';
import { ROLE_LABELS, normalizeRoleKey } from '../../packages/domain/src/accountRoles.js';

const DEFAULT_RANGE_DAYS = 7;
const DEFAULT_PAGE_SIZE = 50;

const EMPTY_RESPONSE = Object.freeze({
  entries: [],
  total: 0,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  pageCount: 1,
  summary: { total: 0, latestCreatedAt: null, byKind: [], topUsers: [], latestView: null, recentViews: [], totalViews: 0 },
  filters: { from: '', to: '', kind: 'all', search: '' },
  availableKinds: [],
});

function toDateInputString(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
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
  if (!filters || typeof filters !== 'object') return '';
  try { return JSON.stringify(filters, null, 2); } catch { return ''; }
}

function formatCount(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized.toLocaleString('vi-VN') : '0';
}

function summarizeAccessFilters(filters) {
  if (!filters || typeof filters !== 'object') return '';
  try {
    const parts = [];
    if (filters.from) parts.push(`Từ ${filters.from}`);
    if (filters.to) parts.push(`Đến ${filters.to}`);
    if (filters.kind && filters.kind !== 'all') parts.push(`Loại: ${filters.kind}`);
    if (filters.search) parts.push(`Từ khóa: ${filters.search}`);
    if (Number.isFinite(filters.page)) parts.push(`Trang ${filters.page}`);
    if (Number.isFinite(filters.limit)) parts.push(`Limit ${filters.limit}`);
    return parts.join(' | ');
  } catch { return ''; }
}

export default function ExportAuditReport() {
  const defaultRange = useMemo(() => buildDefaultRange(), []);
  const [formState, setFormState] = useState(() => ({ ...defaultRange, search: '', kind: 'all' }));
  const [filters, setFilters] = useState(() => ({ ...defaultRange, search: '', kind: 'all' }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const loadExportAudit = useCallback(async ({ signal }, params) => {
    const query = new URLSearchParams();
    query.set('limit', params.limit);
    query.set('page', params.page);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.kind && params.kind !== 'all') query.set('kind', params.kind);
    if (params.search) query.set('search', params.search);

    const response = await fetchWithAuth(`${API_V4_ROUTES.reporting.exportsAudit}?${query.toString()}`, { signal });
    let payload = null;
    try { payload = await response.json(); } catch { payload = null; }
    if (!response.ok || !payload || payload.ok === false) {
      throw new Error(payload?.error || `Không thể tải lịch sử export (HTTP ${response.status}).`);
    }
    return payload;
  }, []);

  const handleLoadError = useCallback((err) => {
    toast.error(err?.message || 'Không thể tải lịch sử export.');
  }, []);

  const { data, loading, error, execute } = useAsyncRequest(loadExportAudit, {
    initialData: EMPTY_RESPONSE,
    onError: handleLoadError,
  });

  const auditData = data || EMPTY_RESPONSE;
  const entries = Array.isArray(auditData.entries) ? auditData.entries : [];
  const summary = auditData.summary || EMPTY_RESPONSE.summary;
  const latestView = summary?.latestView || null;
  const recentAccesses = Array.isArray(summary?.recentViews) ? summary.recentViews.slice(0, 5) : [];
  const totalViews = Number.isFinite(Number(summary?.totalViews)) ? Number(summary.totalViews) : 0;

  const availableKinds = useMemo(() => {
    const kindSet = new Set(['all']);
    if (Array.isArray(auditData.availableKinds)) {
      for (const kind of auditData.availableKinds) if (kind) kindSet.add(kind);
    }
    if (filters.kind && filters.kind !== 'all') kindSet.add(filters.kind);
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

  const handlePrevious = () => setPage((p) => Math.max(1, p - 1));
  const handleNext = () => setPage((p) => Math.min(totalPages, p + 1));

  const renderSummaryList = (items, emptyLabel, icon) => {
    if (!Array.isArray(items) || items.length === 0) {
      return <p className="text-sm text-slate-500 italic py-2">{emptyLabel}</p>;
    }
    return (
      <ul className="space-y-2.5 mt-2">
        {items.map((item, idx) => (
          <li key={`${item.kind || item.username}-${idx}`} className="flex items-center justify-between text-sm group">
            <span className="flex items-center text-slate-700 dark:text-slate-300 gap-2 truncate">
              {icon}
              <span className="truncate group-hover:text-amber-600 transition-colors">{item.kind || item.displayName || item.username}</span>
            </span>
            <span className="font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 text-xs">
              {formatCount(item?.total)}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header & Filters */}
      <section className="rounded-xl border border-slate-200/60 bg-white/70 backdrop-blur-xl p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
        <header className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-amber-600 to-amber-500 bg-clip-text text-transparent flex items-center gap-2">
              <History className="h-6 w-6 text-amber-500" />
              Lịch Sử Xuất Dữ Liệu
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Kiểm soát quy trình tải file, xuất dữ liệu và theo dõi truy cập hệ thống báo cáo.
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-5 items-end">
          <div className="flex flex-col gap-1.5 pt-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Từ ngày</label>
            <input
              type="date"
              value={formState.from}
              onChange={handleFormChange('from')}
              className="rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 text-sm transition-all focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 outline-none dark:border-slate-700 dark:bg-slate-800/50 dark:focus:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-col gap-1.5 pt-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Đến ngày</label>
            <input
              type="date"
              value={formState.to}
              onChange={handleFormChange('to')}
              className="rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 text-sm transition-all focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 outline-none dark:border-slate-700 dark:bg-slate-800/50 dark:focus:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-col gap-1.5 pt-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Loại báo cáo</label>
            <div className="relative">
              <select
                value={formState.kind}
                onChange={handleFormChange('kind')}
                className="w-full appearance-none rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 pr-8 text-sm transition-all focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 outline-none dark:border-slate-700 dark:bg-slate-800/50 dark:focus:bg-slate-800 dark:text-slate-100"
              >
                {availableKinds.map((kind) => (
                  <option key={kind} value={kind}>{kind === 'all' ? 'Tất cả báo cáo' : kind}</option>
                ))}
              </select>
              <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 pt-2 md:col-span-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Tìm kiếm nâng cao</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Tra cứu tài khoản, IP, hoặc mã yêu cầu..."
                value={formState.search}
                onChange={handleFormChange('search')}
                className="w-full rounded-lg border border-slate-200/80 bg-slate-50 pl-9 pr-3 py-2 text-sm transition-all focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 outline-none dark:border-slate-700 dark:bg-slate-800/50 dark:focus:bg-slate-800 dark:text-slate-100"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-4 md:col-span-5 border-t border-slate-100 dark:border-slate-800/80 mt-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-amber-500/20 transition-all hover:bg-amber-600 hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <span className="inline-block h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin mr-1" />
              ) : <Search className="h-4 w-4" />}
              Lọc Dữ Liệu
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 border-slate-200/60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <RotateCcw className="h-4 w-4" />
              Mặc định
            </button>
            {error && (
              <span className="ml-auto flex items-center gap-2 text-sm font-medium text-red-500 bg-red-50 dark:bg-red-500/10 dark:text-red-400 px-3 py-1.5 rounded-lg">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                {error}
              </span>
            )}
          </div>
        </form>
      </section>

      {/* Analytics Dashboard Grid */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {/* Metric Card 1 */}
        <div className="group relative overflow-hidden rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm transition-all hover:border-amber-500/30 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-amber-500/30">
          <div className="absolute -right-6 -top-6 text-slate-50 dark:text-slate-800/50 group-hover:text-amber-50 dark:group-hover:text-amber-900/10 transition-colors">
            <Download className="h-24 w-24" strokeWidth={1} />
          </div>
          <div className="relative z-10">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" /> Thống kê tải file
            </h3>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {formatCount(summary?.total)}
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5 rounded-md">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span>Mới nhất: <strong className="font-semibold text-slate-700 dark:text-slate-300">{summary.latestCreatedAt ? formatDateTime(summary.latestCreatedAt, { withSeconds: true }) : '—'}</strong></span>
            </div>
          </div>
        </div>

        {/* Metric Card 2 */}
        <div className="group relative overflow-hidden rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm transition-all hover:border-blue-500/30 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/30">
          <div className="absolute -right-6 -top-6 text-slate-50 dark:text-slate-800/50 group-hover:text-blue-50 dark:group-hover:text-blue-900/10 transition-colors">
            <Globe className="h-24 w-24" strokeWidth={1} />
          </div>
          <div className="relative z-10">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Tab truy cập
            </h3>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {formatCount(totalViews)}
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5 rounded-md truncate">
              <User className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span className="truncate">Active: <strong className="font-semibold text-slate-700 dark:text-slate-300 truncate">{latestView?.username || '—'}</strong></span>
            </div>
          </div>
        </div>

        {/* Metric Card 3 */}
        <div className="flex flex-col rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-2">
            <FileText className="h-3.5 w-3.5" /> Loại Báo Cáo
          </h3>
          <div className="flex-1 min-h-[5rem]">
            {renderSummaryList(summary.byKind, 'Chưa có phân loại mẫu.', <FileText className="h-4 w-4 text-slate-400" />)}
          </div>
        </div>

        {/* Metric Card 4 */}
        <div className="flex flex-col rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-2">
            <User className="h-3.5 w-3.5" /> User Tích Cực
          </h3>
          <div className="flex-1 min-h-[5rem]">
            {renderSummaryList(
              (summary.topUsers || []).map((item) => ({
                kind: `${item.displayName || item.username}`,
                total: item.total,
              })),
              'Chưa có dữ liệu account.',
              <User className="h-4 w-4 text-slate-400" />
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Table */}
        <section className="lg:col-span-2 rounded-xl border border-slate-200/60 bg-white shadow-sm flex flex-col dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4 dark:border-slate-800/80 dark:bg-slate-900/50">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Bản Ghi Giao Dịch
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                {entries.length > 0 ? `Hiển thị ${entries.length} / ${formatCount(auditData?.total)} bản ghi mới nhất.` : 'Danh sách trống'}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Phiên bản / Yêu cầu</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Tài khoản thao tác</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Báo cáo</th>
                  <th className="px-5 py-3.5 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-sm text-slate-500">
                      <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      Chưa tìm thấy lịch sử nào ở bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={`${entry.id}-${entry.requestId || entry.signature}`} className="group hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-md bg-amber-50 p-1.5 dark:bg-amber-500/10">
                            <Download className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                          </div>
                          <div>
                            <div className="font-semibold tracking-tight text-slate-800 dark:text-slate-200">
                              {formatDateTime(entry.createdAt, { withSeconds: true }) || '—'}
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                              {entry.shortSignature || entry.signature?.substring(0, 8) || '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {entry.displayName || entry.username || 'N/A'}
                          </span>
                          <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Laptop className="h-3 w-3" /> {entry.ipAddress}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/20">
                            {entry.reportKind || '—'}
                          </span>
                          <span className="text-[11px] text-slate-500 truncate max-w-[200px]" title={entry.filename}>
                            {entry.filename || 'Không rõ tên'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {entry.filters && Object.keys(entry.filters).length > 0 ? (
                          <details className="mt-1 text-xs text-amber-600 dark:text-amber-400 w-full text-right group-details">
                            <summary className="cursor-pointer select-none font-medium hover:underline outline-none">Xem tham số</summary>
                            <div className="mt-2 text-left rounded-md bg-slate-900 px-3 py-2 text-[11px] leading-relaxed text-slate-300 font-mono overflow-auto max-w-[250px] whitespace-pre-wrap ml-auto border border-slate-700/50 shadow-sm">
                              {formatFilters(entry.filters)}
                            </div>
                          </details>
                        ) : (
                          <span className="text-xs text-slate-400">Không có</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3 dark:border-slate-800/80 dark:bg-slate-900/50">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Trang {page} / {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevious}
                  disabled={page <= 1}
                  className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={handleNext}
                  disabled={page >= totalPages}
                  className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Live Traffic Feed */}
        <aside className="rounded-xl border border-slate-200/60 bg-white shadow-sm flex flex-col dark:border-slate-800 dark:bg-slate-900">
          <header className="border-b border-slate-100 bg-slate-50/50 px-5 py-4 dark:border-slate-800/80 dark:bg-slate-900/50">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Globe className="h-5 w-5 text-indigo-500" /> Truy cập Real-time
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
              Log xem tab gần nhất
            </p>
          </header>
          <div className="p-4 flex-1 overflow-y-auto">
            {recentAccesses.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 py-8">
                <History className="h-8 w-8 opacity-50" />
                <p className="text-sm">Chưa có traffic.</p>
              </div>
            ) : (
              <div className="relative pl-4 space-y-6 before:absolute before:inset-y-0 before:left-[7px] before:-ml-[1px] before:w-[2px] before:bg-slate-100 dark:before:bg-slate-800/80">
                {recentAccesses.map((item, idxx) => (
                  <div key={`${item.id}-${item.viewedAt}-${idxx}`} className="relative">
                    <span className="absolute -left-[30px] flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white ring-4 ring-white dark:bg-slate-900 dark:ring-slate-900">
                      <div className="h-2 w-2 rounded-full bg-indigo-500" />
                    </span>
                    <div className="flex flex-col gap-1">
                      <time className="text-xs font-semibold uppercase text-indigo-600 dark:text-indigo-400">
                        {formatDateTime(item.viewedAt, { withSeconds: true }) || 'Vừa xong'}
                      </time>
                      <div className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                        {item.displayName || item.username || 'User'}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <Laptop className="h-3 w-3" /> <span className="font-mono">{item.ipAddress || 'LAN'}</span>
                      </div>
                      {item.filters && Object.keys(item.filters).length > 0 && (
                        <div className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-800/40 dark:text-slate-400 border border-slate-100 dark:border-slate-800/80">
                          {summarizeAccessFilters(item.filters)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

    </div>
  );
}
