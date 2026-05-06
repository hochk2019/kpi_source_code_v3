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
  RotateCcw,
  FileDown,
} from 'lucide-react';

import useAsyncRequest from '@/hooks/useAsyncRequest.js';
import { fetchWithAuth } from '@/auth/localAuth.js';
import { API_V4_ROUTES } from '@/lib/apiRoutes.js';
import { toast } from '@/shared/toast.js';
import { formatDateTime } from '../../packages/domain/src/format.js';
import { t } from '@/lib/i18n.js';
import { PageHeader } from "@/components/designSystem/PageHeader";
import { FilterBar } from "@/components/designSystem/primitives.jsx";

// ─── Types ─────────────────────────────────────────────────────────────────

interface AuditSummaryKind {
  kind: string;
  total: number;
}

interface AuditSummaryUser {
  username: string;
  displayName?: string;
  total: number;
}

interface AuditSummary {
  total: number;
  latestCreatedAt: string | null;
  byKind: AuditSummaryKind[];
  topUsers: AuditSummaryUser[];
  latestView: AuditAccessView | null;
  recentViews: AuditAccessView[];
  totalViews: number;
}

interface AuditAccessView {
  id?: string;
  username?: string;
  displayName?: string;
  viewedAt?: string;
  ipAddress?: string;
  filters?: Record<string, unknown>;
}

interface AuditEntry {
  id?: string;
  requestId?: string;
  signature?: string;
  shortSignature?: string;
  createdAt?: string;
  displayName?: string;
  username?: string;
  ipAddress?: string;
  reportKind?: string;
  filename?: string;
  filters?: Record<string, unknown>;
}

interface AuditFilters {
  from: string;
  to: string;
  kind: string;
  search: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  summary: AuditSummary;
  filters: AuditFilters;
  availableKinds: string[];
}

interface FormState extends AuditFilters {}

interface LoadParams {
  limit: number;
  page: number;
  from: string;
  to: string;
  kind: string;
  search: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const DEFAULT_RANGE_DAYS = 7;
const DEFAULT_PAGE_SIZE = 50;

const EMPTY_RESPONSE: AuditResponse = Object.freeze({
  entries: [],
  total: 0,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  pageCount: 1,
  summary: { total: 0, latestCreatedAt: null, byKind: [], topUsers: [], latestView: null, recentViews: [], totalViews: 0 },
  filters: { from: '', to: '', kind: 'all', search: '' },
  availableKinds: [],
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function toDateInputString(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function buildDefaultRange(): { from: string; to: string } {
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - (DEFAULT_RANGE_DAYS - 1));
  return {
    from: toDateInputString(fromDate),
    to: toDateInputString(today),
  };
}

function formatFilters(filters: Record<string, unknown> | undefined | null): string {
  if (!filters || typeof filters !== 'object') return '';
  try { return JSON.stringify(filters, null, 2); } catch { return ''; }
}

function formatCount(value: unknown): string {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized.toLocaleString('vi-VN') : '0';
}

function summarizeAccessFilters(filters: Record<string, unknown> | undefined | null): string {
  if (!filters || typeof filters !== 'object') return '';
  try {
    const parts: string[] = [];
    if (filters.from) parts.push(t('export.accessFilter.from', { value: filters.from }));
    if (filters.to) parts.push(t('export.accessFilter.to', { value: filters.to }));
    if (filters.kind && filters.kind !== 'all') parts.push(t('export.accessFilter.kind', { value: filters.kind }));
    if (filters.search) parts.push(t('export.accessFilter.keyword', { value: filters.search }));
    if (Number.isFinite(filters.page as number)) parts.push(t('export.accessFilter.page', { value: filters.page }));
    if (Number.isFinite(filters.limit as number)) parts.push(`Limit ${filters.limit}`);
    return parts.join(' | ');
  } catch { return ''; }
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function ExportAuditReport() {
  const defaultRange = useMemo(() => buildDefaultRange(), []);
  const [formState, setFormState] = useState<FormState>(() => ({ ...defaultRange, search: '', kind: 'all' }));
  const [filters, setFilters] = useState<FormState>(() => ({ ...defaultRange, search: '', kind: 'all' }));
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);

  const loadExportAudit = useCallback(async ({ signal }: { signal: AbortSignal }, params: LoadParams) => {
    const query = new URLSearchParams();
    query.set('limit', String(params.limit));
    query.set('page', String(params.page));
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.kind && params.kind !== 'all') query.set('kind', params.kind);
    if (params.search) query.set('search', params.search);

    const response = await fetchWithAuth(`${API_V4_ROUTES.reporting.exportsAudit}?${query.toString()}`, { signal });
    let payload: AuditResponse & { ok?: boolean; error?: string } | null = null;
    try { payload = await response.json(); } catch { payload = null; }
    if (!response.ok || !payload || payload.ok === false) {
      throw new Error(payload?.error || t('export.error.loadFailedHttp', { status: response.status }));
    }
    return payload;
  }, []);

  const handleLoadError = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message : t('export.error.loadFailed');
    toast.error(message);
  }, []);

  const { data, loading, error, execute } = useAsyncRequest(loadExportAudit, {
    initialData: EMPTY_RESPONSE,
    onError: handleLoadError,
  });

  const auditData: AuditResponse = data || EMPTY_RESPONSE;
  const entries: AuditEntry[] = Array.isArray(auditData.entries) ? auditData.entries : [];
  const summary: AuditSummary = auditData.summary || EMPTY_RESPONSE.summary;
  const latestView = summary?.latestView || null;
  const recentAccesses: AuditAccessView[] = Array.isArray(summary?.recentViews) ? summary.recentViews.slice(0, 5) : [];
  const totalViews = Number.isFinite(Number(summary?.totalViews)) ? Number(summary.totalViews) : 0;

  const availableKinds = useMemo(() => {
    const kindSet = new Set<string>(['all']);
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

  const handleFormChange = (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = event?.target?.value ?? '';
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters({ ...formState });
    setPage(1);
  };

  const handleReset = () => {
    const nextRange = buildDefaultRange();
    const next: FormState = { ...nextRange, search: '', kind: 'all' };
    setFormState(next);
    setFilters(next);
    setPage(1);
  };

  const handlePrevious = () => setPage((p) => Math.max(1, p - 1));
  const handleNext = () => setPage((p) => Math.min(totalPages, p + 1));

  const renderSummaryList = (items: AuditSummaryKind[], emptyLabel: string, icon: React.ReactNode) => {
    if (!Array.isArray(items) || items.length === 0) {
      return <p className="text-sm text-ds-text-muted italic py-2">{emptyLabel}</p>;
    }
    return (
      <ul className="space-y-2.5 mt-2">
        {items.map((item, idx) => (
          <li key={`${item.kind || 'item'}-${idx}`} className="flex items-center justify-between text-sm group">
            <span className="flex items-center text-ds-text-primary gap-2 truncate">
              {icon}
              <span className="truncate group-hover:text-ds-accent transition-colors">{item.kind || (item as unknown as { displayName?: string; username?: string }).displayName || (item as unknown as { username?: string }).username}</span>
            </span>
            <span className="font-semibold px-2 py-0.5 rounded-full bg-ds-surface-muted text-ds-text-primary border border-ds-border-subtle text-xs">
              {formatCount(item?.total)}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  const summaryStats = [
    { label: t('export.metrics.total') || "Tổng", value: formatCount(summary?.total) },
    { label: t('export.metrics.latest') || "Mới nhất", value: summary.latestCreatedAt ? formatDateTime(summary.latestCreatedAt, { withSeconds: false }) : '—' },
  ];

  return (
    <div className="p-6 space-y-4">
      {/* Page Header */}
      <PageHeader
        eyebrow="BÁO CÁO"
        title={t('export.title') || "Lịch sử Export"}
        info={t('export.description') || "Xem lịch sử xuất báo cáo và tìm kiếm theo nhiều tiêu chí"}
        meta={summaryStats.map(s => `${s.label}: ${s.value}`)}
      />

      {/* Filters */}
      <section className="rounded-xl border border-ds-border-subtle bg-ds-surface-card/70 backdrop-blur-xl p-5 shadow-sm">
        <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-5 items-end">
          <div className="flex flex-col gap-1.5 pt-2">
            <label className="text-xs font-semibold text-ds-text-secondary uppercase tracking-wider">{t('export.filter.fromDate')}</label>
            <input
              type="date"
              value={formState.from}
              onChange={handleFormChange('from')}
              className="rounded-lg border border-ds-border-subtle bg-ds-surface-base px-3 py-2 text-sm transition-all focus:border-ds-accent focus:bg-ds-surface-card focus:ring-2 focus:ring-ds-accent/20 outline-none"
            />
          </div>
          <div className="flex flex-col gap-1.5 pt-2">
            <label className="text-xs font-semibold text-ds-text-secondary uppercase tracking-wider">{t('export.filter.toDate')}</label>
            <input
              type="date"
              value={formState.to}
              onChange={handleFormChange('to')}
              className="rounded-lg border border-ds-border-subtle bg-ds-surface-base px-3 py-2 text-sm transition-all focus:border-ds-accent focus:bg-ds-surface-card focus:ring-2 focus:ring-ds-accent/20 outline-none"
            />
          </div>
          <div className="flex flex-col gap-1.5 pt-2">
            <label className="text-xs font-semibold text-ds-text-secondary uppercase tracking-wider">{t('export.filter.reportType')}</label>
            <div className="relative">
              <select
                value={formState.kind}
                onChange={handleFormChange('kind')}
                className="w-full appearance-none rounded-lg border border-ds-border-subtle bg-ds-surface-base px-3 py-2 pr-8 text-sm transition-all focus:border-ds-accent focus:bg-ds-surface-card focus:ring-2 focus:ring-ds-accent/20 outline-none"
              >
                {availableKinds.map((kind) => (
                  <option key={kind} value={kind}>{kind === 'all' ? t('export.filter.allReports') : kind}</option>
                ))}
              </select>
              <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ds-text-muted pointer-events-none" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 pt-2 md:col-span-2">
            <label className="text-xs font-semibold text-ds-text-secondary uppercase tracking-wider">{t('export.filter.advancedSearch')}</label>
            <div className="relative">
              <input
                type="text"
                placeholder={t('export.filter.searchPlaceholder')}
                value={formState.search}
                onChange={handleFormChange('search')}
                className="w-full rounded-lg border border-ds-border-subtle bg-ds-surface-base pl-9 pr-3 py-2 text-sm transition-all focus:border-ds-accent focus:bg-ds-surface-card focus:ring-2 focus:ring-ds-accent/20 outline-none"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ds-text-muted" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-4 md:col-span-5 border-t border-ds-border-subtle mt-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-ds-accent px-5 py-2 text-sm font-semibold text-ds-text-inverse shadow-sm shadow-ds-accent/20 transition-all hover:bg-ds-accent-strong hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <span className="inline-block h-4 w-4 rounded-full border-2 border-ds-text-inverse/20 border-t-ds-text-inverse animate-spin mr-1" />
              ) : <Search className="h-4 w-4" />}
              {t('export.filter.submit')}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-ds-border-subtle bg-ds-surface-card px-5 py-2 text-sm font-medium text-ds-text-secondary shadow-sm transition-all hover:bg-ds-surface-muted hover:text-ds-text-primary"
            >
              <RotateCcw className="h-4 w-4" />
              {t('export.filter.reset')}
            </button>
            {error && (
              <span className="ml-auto flex items-center gap-2 text-sm font-medium text-ds-destructive bg-ds-destructive/10 px-3 py-1.5 rounded-lg">
                <span className="h-2 w-2 rounded-full bg-ds-destructive animate-pulse" />
                {error}
              </span>
            )}
          </div>
        </form>
      </section>

      {/* Analytics Dashboard Grid */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {/* Metric Card 1 */}
        <div className="group relative overflow-hidden rounded-xl border border-ds-border-subtle bg-ds-surface-card p-5 shadow-sm transition-all hover:border-ds-accent/30 hover:shadow-md">
          <div className="absolute -right-6 -top-6 text-ds-surface-muted group-hover:text-ds-accent/10 transition-colors">
            <Download className="h-24 w-24" strokeWidth={1} />
          </div>
          <div className="relative z-10">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ds-text-muted flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" /> {t('export.metrics.downloadStats')}
            </h3>
            <p className="mt-3 text-3xl font-bold tracking-tight text-ds-text-primary">
              {formatCount(summary?.total)}
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-ds-text-muted bg-ds-surface-base px-2.5 py-1.5 rounded-md">
              <Clock className="h-3.5 w-3.5 text-ds-accent" />
              <span>{t('export.metrics.latest')} <strong className="font-semibold text-ds-text-primary">{summary.latestCreatedAt ? formatDateTime(summary.latestCreatedAt, { withSeconds: true }) : '—'}</strong></span>
            </div>
          </div>
        </div>

        {/* Metric Card 2 */}
        <div className="group relative overflow-hidden rounded-xl border border-ds-border-subtle bg-ds-surface-card p-5 shadow-sm transition-all hover:border-ds-accent/30 hover:shadow-md">
          <div className="absolute -right-6 -top-6 text-ds-surface-muted group-hover:text-ds-accent/10 transition-colors">
            <Globe className="h-24 w-24" strokeWidth={1} />
          </div>
          <div className="relative z-10">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ds-text-muted flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> {t('export.metrics.tabAccess')}
            </h3>
            <p className="mt-3 text-3xl font-bold tracking-tight text-ds-text-primary">
              {formatCount(totalViews)}
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-ds-text-muted bg-ds-surface-base px-2.5 py-1.5 rounded-md truncate">
              <User className="h-3.5 w-3.5 text-ds-accent shrink-0" />
              <span className="truncate">Active: <strong className="font-semibold text-ds-text-primary truncate">{latestView?.username || '—'}</strong></span>
            </div>
          </div>
        </div>

        {/* Metric Card 3 */}
        <div className="flex flex-col rounded-xl border border-ds-border-subtle bg-ds-surface-card p-5 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ds-text-muted flex items-center gap-1.5 mb-2">
            <FileText className="h-3.5 w-3.5" /> {t('export.metrics.reportTypes')}
          </h3>
          <div className="flex-1 min-h-[5rem]">
            {renderSummaryList(summary.byKind, t('export.metrics.noReportTypes'), <FileText className="h-4 w-4 text-ds-text-muted" />)}
          </div>
        </div>

        {/* Metric Card 4 */}
        <div className="flex flex-col rounded-xl border border-ds-border-subtle bg-ds-surface-card p-5 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ds-text-muted flex items-center gap-1.5 mb-2">
            <User className="h-3.5 w-3.5" /> {t('export.metrics.topUsers')}
          </h3>
          <div className="flex-1 min-h-[5rem]">
            {renderSummaryList(
              (summary.topUsers || []).map((item) => ({
                kind: `${item.displayName || item.username}`,
                total: item.total,
              })),
              t('export.metrics.noTopUsers'),
              <User className="h-4 w-4 text-ds-text-muted" />
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Table */}
        <section className="lg:col-span-2 rounded-xl border border-ds-border-subtle bg-ds-surface-card shadow-sm flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-ds-border-subtle bg-ds-surface-base/50 px-5 py-4">
            <div>
              <h3 className="text-base font-bold text-ds-text-primary flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-ds-success" /> {t('export.table.title')}
              </h3>
              <p className="mt-0.5 text-xs text-ds-text-muted font-medium">
                {entries.length > 0 ? t('export.table.showing', { count: entries.length, total: formatCount(auditData?.total) }) : t('export.table.empty')}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-ds-surface-base">
                <tr>
                  <th className="px-5 py-3.5 font-semibold text-ds-text-muted text-xs uppercase tracking-wider">{t('export.table.header.version')}</th>
                  <th className="px-5 py-3.5 font-semibold text-ds-text-muted text-xs uppercase tracking-wider">{t('export.table.header.account')}</th>
                  <th className="px-5 py-3.5 font-semibold text-ds-text-muted text-xs uppercase tracking-wider">{t('export.table.header.report')}</th>
                  <th className="px-5 py-3.5 font-semibold text-ds-text-muted text-xs uppercase tracking-wider text-right">{t('export.table.header.action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-border-subtle">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-sm text-ds-text-muted">
                      <FileText className="h-10 w-10 text-ds-text-muted mx-auto mb-3" />
                      {t('export.table.noResults')}
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={`${entry.id}-${entry.requestId || entry.signature}`} className="group hover:bg-ds-surface-base/70 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-md bg-ds-warning/10 p-1.5">
                            <Download className="h-4 w-4 text-ds-accent" />
                          </div>
                          <div>
                            <div className="font-semibold tracking-tight text-ds-text-primary">
                              {formatDateTime(entry.createdAt, { withSeconds: true }) || '—'}
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-xs text-ds-text-muted font-mono">
                              {entry.shortSignature || entry.signature?.substring(0, 8) || '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-ds-text-primary">
                            {entry.displayName || entry.username || 'N/A'}
                          </span>
                          <span className="text-xs text-ds-text-muted flex items-center gap-1 mt-0.5">
                            <Laptop className="h-3 w-3" /> {entry.ipAddress}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center rounded-md bg-ds-accent/10 px-2 py-1 text-xs font-medium text-ds-accent ring-1 ring-inset ring-ds-accent/10">
                            {entry.reportKind || '—'}
                          </span>
                          <span className="text-[11px] text-ds-text-muted truncate max-w-[200px]" title={entry.filename}>
                            {entry.filename || t('export.table.unknownFile')}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {entry.filters && Object.keys(entry.filters).length > 0 ? (
                          <details className="mt-1 text-xs text-ds-accent w-full text-right group-details">
                            <summary className="cursor-pointer select-none font-medium hover:underline outline-none">{t('export.table.viewParams')}</summary>
                            <div className="mt-2 text-left rounded-md bg-ds-surface-base px-3 py-2 text-[11px] leading-relaxed text-ds-text-secondary font-mono overflow-auto max-w-[250px] whitespace-pre-wrap ml-auto border border-ds-border-subtle shadow-sm">
                              {formatFilters(entry.filters)}
                            </div>
                          </details>
                        ) : (
                          <span className="text-xs text-ds-text-muted">{t('export.table.none')}</span>
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
            <div className="flex items-center justify-between border-t border-ds-border-subtle bg-ds-surface-base/50 px-5 py-3">
              <span className="text-sm font-medium text-ds-text-secondary">
                {t('export.pagination.page', { page, total: totalPages })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevious}
                  disabled={page <= 1}
                  className="inline-flex items-center justify-center rounded-md p-1.5 text-ds-text-secondary hover:bg-ds-surface-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={handleNext}
                  disabled={page >= totalPages}
                  className="inline-flex items-center justify-center rounded-md p-1.5 text-ds-text-secondary hover:bg-ds-surface-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Live Traffic Feed */}
        <aside className="rounded-xl border border-ds-border-subtle bg-ds-surface-card shadow-sm flex flex-col">
          <header className="border-b border-ds-border-subtle bg-ds-surface-base/50 px-5 py-4">
            <h3 className="text-base font-bold text-ds-text-primary flex items-center gap-2">
              <Globe className="h-5 w-5 text-ds-accent" /> {t('export.realtime.title')}
            </h3>
            <p className="mt-0.5 text-xs text-ds-text-muted font-medium">
              {t('export.realtime.desc')}
            </p>
          </header>
          <div className="p-4 flex-1 overflow-y-auto">
            {recentAccesses.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-ds-text-muted gap-2 py-8">
                <History className="h-8 w-8 opacity-50" />
                <p className="text-sm">{t('export.realtime.noTraffic')}</p>
              </div>
            ) : (
              <div className="relative pl-4 space-y-6 before:absolute before:inset-y-0 before:left-[7px] before:-ml-[1px] before:w-[2px] before:bg-ds-border-subtle">
                {recentAccesses.map((item, idxx) => (
                  <div key={`${item.id}-${item.viewedAt}-${idxx}`} className="relative">
                    <span className="absolute -left-[30px] flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ds-surface-card ring-4 ring-ds-surface-card">
                      <div className="h-2 w-2 rounded-full bg-ds-accent" />
                    </span>
                    <div className="flex flex-col gap-1">
                      <time className="text-xs font-semibold uppercase text-ds-accent">
                        {formatDateTime(item.viewedAt, { withSeconds: true }) || t('export.realtime.justNow')}
                      </time>
                      <div className="font-medium text-ds-text-primary text-sm">
                        {item.displayName || item.username || 'User'}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-ds-text-muted mt-0.5">
                        <Laptop className="h-3 w-3" /> <span className="font-mono">{item.ipAddress || 'LAN'}</span>
                      </div>
                      {item.filters && Object.keys(item.filters).length > 0 && (
                        <div className="mt-2 rounded-md bg-ds-surface-base p-2 text-xs text-ds-text-secondary border border-ds-border-subtle">
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
