import { randomUUID as nodeRandomUUID } from 'node:crypto';

import type { Request, Response } from 'express';

import { normalizeRoleKey } from '../../../../packages/domain/src/accountRoles.js';
// @ts-expect-error -- Legacy JS module is not typed in this TS project.
import { generateReport } from '../../../../server/reportExport.js';
// @ts-expect-error -- Legacy JS module is not typed in this TS project.
import { buildCompactReportExportPayload } from '../../../../server/reportExportPayloads.js';
import type { AuthStore } from '../auth/authStore.js';
import type { AuthAccountRecord } from '../auth/authTypes.js';
import { readSessionAccount, readSessionTokenFromRequest } from '../auth/authSessionContext.js';
import type { ReportingProjectionPersistence } from '../../persistence/reportingProjectionPersistence.js';
import type { ReportingRepositoryReaders } from './ReportingRepository.js';
import type { ReportingRuntime } from './reportingRoutes.js';

const EXPORT_AUDIT_PROJECTION_KEY = 'kpi_reporting_export_audit_v1';
const REPORT_SCHEDULE_STORAGE_KEY = 'kpi_report_schedule_v1';
const EXPORT_AUDIT_DEFAULT_LIMIT = 50;
const EXPORT_AUDIT_MAX_LIMIT = 200;
const EXPORT_AUDIT_MAX_RANGE_DAYS = 60;
const EXPORT_AUDIT_MAX_ENTRIES = 5000;
const EXPORT_AUDIT_MAX_VIEWS = 2000;
const EXPORT_AUDIT_RECENT_VIEWS_LIMIT = 10;

type ExportAuditEntry = {
  id: string;
  createdAt: string;
  issuedAt: string;
  username: string;
  displayName: string | null;
  role: string | null;
  reportKind: string;
  filename: string | null;
  signature: string | null;
  shortSignature: string | null;
  filterSummary: string | null;
  filters: Record<string, unknown> | null;
  ipAddress: string | null;
  requestId: string | null;
  userAgent: string | null;
};

type ExportAuditView = {
  id: string;
  viewedAt: string;
  username: string;
  displayName: string | null;
  role: string | null;
  ipAddress: string | null;
  clientHost: string | null;
  userAgent: string | null;
  filters: Record<string, unknown> | null;
  query: string;
};

type ExportAuditState = {
  version: 1;
  entries: ExportAuditEntry[];
  views: ExportAuditView[];
};

export type StandaloneReportingRuntimeDependencies = {
  authStore: AuthStore;
  projections: ReportingProjectionPersistence;
  readers: ReportingRepositoryReaders;
};

type StandaloneReportingRuntimeOptions = {
  exportGenerator?: typeof generateReport;
  now?: () => Date;
  randomUUID?: () => string;
};

type SessionContext = {
  account: AuthAccountRecord;
};

type AuditFilters = {
  fromIso: string | null;
  toIso: string | null;
  kind: string;
  rawSearch: string;
  search: string;
  limit: number;
  page: number;
  offset: number;
};

type ClientNetworkMeta = {
  ipAddress: string | null;
  clientHost: string | null;
  userAgent: string;
};

type ReportingSourceSnapshot = {
  rows: Record<string, unknown>[];
  roster: Record<string, unknown>;
  rules: Record<string, unknown>;
  adjustments: Record<string, unknown>[];
  schedules: Record<string, unknown>[];
};

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function createStandaloneReportingRuntime(
  dependencies: StandaloneReportingRuntimeDependencies,
  options: StandaloneReportingRuntimeOptions = {},
): ReportingRuntime {
  const exportGenerator = options.exportGenerator ?? generateReport;
  const now = options.now ?? (() => new Date());
  const randomUUID = options.randomUUID ?? nodeRandomUUID;
  const { authStore, projections, readers } = dependencies;

  return {
    exportReport: async (req, res) => {
      const context = await requireReportExportContext(req, res, authStore);
      if (!context) {
        return;
      }

      const kind = normalizeText(req.body?.kind);
      if (!kind) {
        res.status(400).json({ ok: false, error: 'Thiếu loại báo cáo cần xuất' });
        return;
      }

      const requestedPayload = isRecord(req.body?.payload) ? req.body.payload : {};

      try {
        const sourceSnapshot = await readReportingSourceSnapshot(readers, projections);
        const compactPayload = buildCompactReportExportPayload(kind, requestedPayload, sourceSnapshot);
        const exportPayload = compactPayload?.exportPayload ?? requestedPayload;
        const auditPayload = compactPayload?.auditPayload ?? requestedPayload;
        const networkMeta = resolveClientNetworkMeta(req);
        const requestId = randomUUID();
        const result = await exportGenerator(kind, exportPayload, {
          watermark: {
            actor: context.account.username,
            actorName: context.account.name,
            kind,
            filters: auditPayload,
            ipAddress: networkMeta.ipAddress,
            requestId,
          },
        });

        if (result.signature) {
          res.setHeader('X-KPI-Export-Signature', result.signature);
        }
        if (result.watermark?.shortSignature) {
          res.setHeader('X-KPI-Export-Code', result.watermark.shortSignature);
        }
        if (result.watermark?.formattedIssuedAt) {
          res.setHeader('X-KPI-Export-Issued-At', result.watermark.formattedIssuedAt);
        }
        if (result.watermark?.requestId) {
          res.setHeader('X-KPI-Export-Request', result.watermark.requestId);
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        setAttachmentHeaders(res, result.filename);
        res.send(result.buffer);

        const issuedAtIso = resolveIssuedAtIso(result.watermark?.issuedAt, now());
        const entry: ExportAuditEntry = {
          id: randomUUID(),
          createdAt: now().toISOString(),
          issuedAt: issuedAtIso,
          username: context.account.username || 'unknown',
          displayName: normalizeNullableText(context.account.name, 256),
          role: normalizeNullableText(context.account.role, 64),
          reportKind: normalizeNullableText(kind, 128) || 'unknown',
          filename: normalizeNullableText(result.filename, 512),
          signature: normalizeNullableText(result.signature, 128),
          shortSignature: normalizeNullableText(result.watermark?.shortSignature, 64),
          filterSummary: normalizeNullableText(result.watermark?.filterSummary, 1024, false),
          filters: normalizeRecord(auditPayload),
          ipAddress: normalizeNullableText(networkMeta.ipAddress, 128),
          requestId: normalizeNullableText(result.watermark?.requestId || requestId, 128),
          userAgent: normalizeNullableText(networkMeta.userAgent, 512, false),
        };

        const state = await readExportAuditState(projections);
        const nextEntries = [entry, ...state.entries]
          .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
          .slice(0, EXPORT_AUDIT_MAX_ENTRIES);
        await writeExportAuditState(projections, {
          ...state,
          entries: nextEntries,
        });
      } catch (error) {
        const statusCode = Number((error as { statusCode?: number })?.statusCode ?? 0);
        const status =
          Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500
            ? statusCode
            : /không hợp lệ|khong hop le/i.test(`${(error as Error)?.message ?? ''}`)
              ? 400
              : 500;

        if (status >= 500) {
          console.error('Không thể xuất báo cáo', error);
        }

        res.status(status).json({
          ok: false,
          error: (error as Error)?.message || 'Không thể xuất báo cáo',
        });
      }
    },
    listExportAudit: async (req, res) => {
      const context = await requireExportAuditViewContext(req, res, authStore);
      if (!context) {
        return;
      }

      const filters = buildAuditFilters(req, res);
      if (!filters) {
        return;
      }

      try {
        const state = await readExportAuditState(projections);
        const networkMeta = resolveClientNetworkMeta(req);
        const viewEntry: ExportAuditView = {
          id: randomUUID(),
          viewedAt: now().toISOString(),
          username: context.account.username || 'unknown',
          displayName: normalizeNullableText(context.account.name, 256),
          role: normalizeNullableText(context.account.role, 64),
          ipAddress: normalizeNullableText(networkMeta.ipAddress, 128),
          clientHost: normalizeNullableText(networkMeta.clientHost, 256),
          userAgent: normalizeNullableText(networkMeta.userAgent, 512, false),
          filters: {
            from: filters.fromIso || null,
            to: filters.toIso || null,
            kind: filters.kind || 'all',
            search: filters.rawSearch || '',
            limit: filters.limit,
            page: filters.page,
          },
          query: resolveQueryString(req),
        };

        const nextViews = [viewEntry, ...state.views]
          .sort((left, right) => Date.parse(right.viewedAt) - Date.parse(left.viewedAt))
          .slice(0, EXPORT_AUDIT_MAX_VIEWS);

        await writeExportAuditState(projections, {
          ...state,
          views: nextViews,
        });

        const sortedEntries = [...state.entries].sort(
          (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
        );
        const filteredEntries = sortedEntries.filter((entry) => matchesAuditFilters(entry, filters));
        const total = filteredEntries.length;
        const pageEntries = filteredEntries.slice(filters.offset, filters.offset + filters.limit);
        const pageCount = Math.max(1, Math.ceil(total / filters.limit));
        const latestCreatedAt = filteredEntries.length > 0 ? filteredEntries[0].createdAt : null;
        const byKind = summarizeEntriesByKind(filteredEntries);
        const topUsers = summarizeTopUsers(filteredEntries);
        const availableKinds = summarizeAvailableKinds(state.entries);
        const recentViews = nextViews.slice(0, EXPORT_AUDIT_RECENT_VIEWS_LIMIT);
        const latestView = recentViews.length > 0 ? recentViews[0] : null;

        res.json({
          ok: true,
          entries: pageEntries,
          total,
          page: filters.page,
          pageSize: filters.limit,
          pageCount,
          summary: {
            total,
            latestCreatedAt,
            byKind,
            topUsers,
            latestView,
            recentViews,
            totalViews: nextViews.length,
          },
          filters: {
            from: filters.fromIso ? filters.fromIso.slice(0, 10) : '',
            to: filters.toIso ? filters.toIso.slice(0, 10) : '',
            kind: filters.kind || 'all',
            search: filters.rawSearch || '',
          },
          availableKinds,
        });
      } catch (error) {
        console.error('Không thể tải lịch sử export', error);
        res.status(500).json({
          ok: false,
          error: (error as Error)?.message || 'Không thể tải lịch sử export',
        });
      }
    },
    exportAdminAudit: async (req, res) => {
      const context = await requireExportAuditViewContext(req, res, authStore);
      if (!context) {
        return;
      }

      const filters = buildAuditFilters(req, res, {
        fallbackLimit: EXPORT_AUDIT_MAX_ENTRIES,
        maxLimit: EXPORT_AUDIT_MAX_ENTRIES,
      });
      if (!filters) {
        return;
      }

      try {
        const state = await readExportAuditState(projections);
        const rows = [...state.entries]
          .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
          .filter((entry) => matchesAuditFilters(entry, filters));
        const csvRows = [
          [
            'Thời gian',
            'Phát hành',
            'Loại báo cáo',
            'Người tải',
            'Tên hiển thị',
            'Vai trò',
            'Tên tệp',
            'Mã ngắn',
            'Mã xác thực',
            'Request ID',
            'IP',
            'Bộ lọc',
          ],
          ...rows.map((entry) => [
            entry.createdAt || '',
            entry.issuedAt || '',
            entry.reportKind || '',
            entry.username || '',
            entry.displayName || '',
            entry.role || '',
            entry.filename || '',
            entry.shortSignature || '',
            entry.signature || '',
            entry.requestId || '',
            entry.ipAddress || '',
            entry.filters ? JSON.stringify(entry.filters) : '',
          ]),
        ];

        const csv = csvRows.map((row) => row.map((cell) => formatCsvValue(cell)).join(',')).join('\r\n');
        const stamp = now().toISOString().slice(0, 19).replace(/[:T]/g, '-');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="report-export-audit-${stamp}.csv"`);
        res.send(`\ufeff${csv}`);
      } catch (error) {
        console.error('Không thể xuất lịch sử export', error);
        res.status(500).json({
          ok: false,
          error: (error as Error)?.message || 'Không thể xuất lịch sử export',
        });
      }
    },
  };
}

async function requireReportExportContext(
  req: Request,
  res: Response,
  authStore: AuthStore,
): Promise<SessionContext | null> {
  const context = await resolveSessionContext(req, authStore);
  if (!context) {
    res.status(401).json({ ok: false, error: 'Bạn cần đăng nhập để xuất báo cáo' });
    return null;
  }

  if (context.account.permissions?.reportsExport === false) {
    res.status(403).json({ ok: false, error: 'Tài khoản hiện không được phép xuất báo cáo' });
    return null;
  }

  return context;
}

async function requireExportAuditViewContext(
  req: Request,
  res: Response,
  authStore: AuthStore,
): Promise<SessionContext | null> {
  const context = await resolveSessionContext(req, authStore);
  if (!context) {
    res.status(401).json({ ok: false, error: 'Bạn cần đăng nhập để xem lịch sử export.' });
    return null;
  }

  if (!(context.account.permissions?.auditView || context.account.permissions?.accountManage)) {
    res.status(403).json({ ok: false, error: 'Tài khoản hiện không có quyền xem lịch sử export.' });
    return null;
  }

  return context;
}

async function resolveSessionContext(req: Request, authStore: AuthStore): Promise<SessionContext | null> {
  const token = readSessionTokenFromRequest(req);
  if (!token) {
    return null;
  }

  const account = await readSessionAccount(authStore, token);
  if (!account) {
    return null;
  }

  return { account };
}

async function readReportingSourceSnapshot(
  readers: ReportingRepositoryReaders,
  projections: ReportingProjectionPersistence,
): Promise<ReportingSourceSnapshot> {
  const [rows, roster, rules, adjustments, schedules] = await Promise.all([
    readers.declarationsReader.readDeclarationRows(),
    readers.teamsReader.readTeamRoster(),
    readers.kpiRulesReader.readRuleCollection(),
    readers.adjustmentsReader.readAdjustmentRows(),
    projections.readScheduleEntries(REPORT_SCHEDULE_STORAGE_KEY),
  ]);

  return {
    rows: Array.isArray(rows) ? rows.filter(isRecord) : [],
    roster: normalizeRecord(roster) ?? { version: 1, teams: [] },
    rules: normalizeRecord(rules) ?? { version: 2, activeId: '', sets: [] },
    adjustments: Array.isArray(adjustments) ? adjustments.filter(isRecord) : [],
    schedules: Array.isArray(schedules) ? schedules.filter(isRecord) : [],
  };
}

function buildAuditFilters(
  req: Request,
  res: Response,
  options: { fallbackLimit?: number; maxLimit?: number } = {},
): AuditFilters | null {
  const rawFrom = getSingleQueryValue(req.query.from);
  const rawTo = getSingleQueryValue(req.query.to);
  const fromIso = parseDateFilterParam(rawFrom);
  const toIso = parseDateFilterParam(rawTo, { endOfDay: true });

  if (fromIso && toIso) {
    const fromDate = new Date(fromIso);
    const toDate = new Date(toIso);
    if (toDate.getTime() < fromDate.getTime()) {
      res.status(400).json({
        ok: false,
        error: 'Khoảng thời gian không hợp lệ: Ngày bắt đầu lớn hơn ngày kết thúc.',
      });
      return null;
    }

    const diffMs = toDate.getTime() - fromDate.getTime();
    const maxRangeMs = EXPORT_AUDIT_MAX_RANGE_DAYS * 24 * 60 * 60 * 1000;
    if (diffMs > maxRangeMs) {
      res.status(400).json({
        ok: false,
        error: `Vui lòng giới hạn khoảng thời gian tra cứu trong ${EXPORT_AUDIT_MAX_RANGE_DAYS} ngày.`,
      });
      return null;
    }
  }

  const limit = clampPositiveInt(getSingleQueryValue(req.query.limit), {
    min: 10,
    max: options.maxLimit ?? EXPORT_AUDIT_MAX_LIMIT,
    fallback: options.fallbackLimit ?? EXPORT_AUDIT_DEFAULT_LIMIT,
  });
  const page = clampPositiveInt(getSingleQueryValue(req.query.page), {
    min: 1,
    max: 1000,
    fallback: 1,
  });
  const rawKind = normalizeText(getSingleQueryValue(req.query.kind)).toLowerCase();
  const kind = rawKind && rawKind !== 'all' ? rawKind : '';
  const rawSearch = normalizeText(getSingleQueryValue(req.query.search));
  const search = rawSearch.toLowerCase();

  return {
    fromIso,
    toIso,
    kind,
    rawSearch,
    search,
    limit,
    page,
    offset: (page - 1) * limit,
  };
}

function matchesAuditFilters(entry: ExportAuditEntry, filters: AuditFilters): boolean {
  const createdAtMs = Date.parse(entry.createdAt);
  if (filters.fromIso && Number.isFinite(createdAtMs) && createdAtMs < Date.parse(filters.fromIso)) {
    return false;
  }
  if (filters.toIso && Number.isFinite(createdAtMs) && createdAtMs > Date.parse(filters.toIso)) {
    return false;
  }
  if (filters.kind && normalizeText(entry.reportKind).toLowerCase() !== filters.kind) {
    return false;
  }
  if (!filters.search) {
    return true;
  }

  const parts = [
    entry.username,
    entry.displayName,
    entry.reportKind,
    entry.signature,
    entry.shortSignature,
    entry.ipAddress,
    entry.requestId,
  ];

  return parts.some((value) => normalizeText(value).toLowerCase().includes(filters.search));
}

function summarizeEntriesByKind(entries: ExportAuditEntry[]): Array<{ kind: string; total: number }> {
  const counter = new Map<string, number>();
  for (const entry of entries) {
    const key = normalizeText(entry.reportKind) || 'unknown';
    counter.set(key, (counter.get(key) ?? 0) + 1);
  }
  return Array.from(counter.entries())
    .map(([kind, total]) => ({ kind, total }))
    .sort((left, right) => right.total - left.total || left.kind.localeCompare(right.kind, 'vi'));
}

function summarizeTopUsers(
  entries: ExportAuditEntry[],
): Array<{ username: string; displayName: string | null; role: string | null; total: number }> {
  const grouped = new Map<string, { username: string; displayName: string | null; role: string | null; total: number }>();
  for (const entry of entries) {
    const username = normalizeText(entry.username) || 'unknown';
    const displayName = normalizeNullableText(entry.displayName, 256);
    const role = normalizeNullableText(entry.role, 64);
    const key = `${username}|${displayName ?? ''}|${role ?? ''}`;
    const previous = grouped.get(key);
    if (previous) {
      previous.total += 1;
      continue;
    }

    grouped.set(key, {
      username,
      displayName,
      role,
      total: 1,
    });
  }

  return Array.from(grouped.values())
    .sort((left, right) => right.total - left.total || left.username.localeCompare(right.username, 'vi'))
    .slice(0, 5);
}

function summarizeAvailableKinds(entries: ExportAuditEntry[]): string[] {
  const kinds = new Set<string>();
  for (const entry of entries) {
    const kind = normalizeText(entry.reportKind);
    if (kind) {
      kinds.add(kind);
    }
  }
  return Array.from(kinds).sort((left, right) => left.localeCompare(right, 'vi'));
}

async function readExportAuditState(projections: ReportingProjectionPersistence): Promise<ExportAuditState> {
  const payload = await projections.readValue(EXPORT_AUDIT_PROJECTION_KEY);
  if (!isRecord(payload)) {
    return { version: 1, entries: [], views: [] };
  }

  const entries = Array.isArray(payload.entries)
    ? payload.entries.map(normalizeAuditEntry).filter(isPresent)
    : [];
  const views = Array.isArray(payload.views)
    ? payload.views.map(normalizeAuditView).filter(isPresent)
    : [];

  return {
    version: 1,
    entries,
    views,
  };
}

async function writeExportAuditState(
  projections: ReportingProjectionPersistence,
  state: ExportAuditState,
): Promise<void> {
  await projections.writeValue(EXPORT_AUDIT_PROJECTION_KEY, {
    version: 1,
    entries: state.entries,
    views: state.views,
  });
}

function normalizeAuditEntry(value: unknown): ExportAuditEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const createdAt = normalizeDateTime(value.createdAt);
  const reportKind = normalizeText(value.reportKind);
  const username = normalizeText(value.username) || 'unknown';

  if (!createdAt || !reportKind) {
    return null;
  }

  return {
    id: normalizeText(value.id) || nodeRandomUUID(),
    createdAt,
    issuedAt: normalizeDateTime(value.issuedAt) || createdAt,
    username,
    displayName: normalizeNullableText(value.displayName, 256),
    role: normalizeNullableText(normalizeRoleKey(value.role), 64),
    reportKind,
    filename: normalizeNullableText(value.filename, 512),
    signature: normalizeNullableText(value.signature, 128),
    shortSignature: normalizeNullableText(value.shortSignature, 64),
    filterSummary: normalizeNullableText(value.filterSummary, 1024, false),
    filters: normalizeRecord(value.filters),
    ipAddress: normalizeNullableText(value.ipAddress, 128),
    requestId: normalizeNullableText(value.requestId, 128),
    userAgent: normalizeNullableText(value.userAgent, 512, false),
  };
}

function normalizeAuditView(value: unknown): ExportAuditView | null {
  if (!isRecord(value)) {
    return null;
  }

  const viewedAt = normalizeDateTime(value.viewedAt);
  const username = normalizeText(value.username) || 'unknown';
  if (!viewedAt) {
    return null;
  }

  return {
    id: normalizeText(value.id) || nodeRandomUUID(),
    viewedAt,
    username,
    displayName: normalizeNullableText(value.displayName, 256),
    role: normalizeNullableText(normalizeRoleKey(value.role), 64),
    ipAddress: normalizeNullableText(value.ipAddress, 128),
    clientHost: normalizeNullableText(value.clientHost, 256),
    userAgent: normalizeNullableText(value.userAgent, 512, false),
    filters: normalizeRecord(value.filters),
    query: normalizeText(value.query),
  };
}

function normalizeDateTime(value: unknown): string {
  const text = normalizeText(value);
  if (!text) {
    return '';
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return parsed.toISOString();
}

function resolveClientNetworkMeta(req: Request): ClientNetworkMeta {
  const forwardedFor = getSingleHeaderValue(req, 'x-forwarded-for');
  const realIp = getSingleHeaderValue(req, 'x-real-ip');
  const ipSources = [forwardedFor, realIp, req.ip, req.socket?.remoteAddress];

  let ipAddress: string | null = null;
  for (const source of ipSources) {
    const candidate = normalizeClientIpAddress(source);
    if (candidate) {
      ipAddress = candidate;
      break;
    }
  }

  const clientHostHeader =
    getSingleHeaderValue(req, 'x-client-hostname') ||
    getSingleHeaderValue(req, 'x-forwarded-host') ||
    '';
  const clientHost = normalizeText(clientHostHeader).split(',')[0].replace(/:\d+$/, '') || null;
  const userAgent = getSingleHeaderValue(req, 'user-agent') || '';

  return {
    ipAddress,
    clientHost,
    userAgent,
  };
}

function normalizeClientIpAddress(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }
  const first = text.split(',')[0].trim();
  if (!first) {
    return null;
  }
  return first.replace(/^::ffff:/i, '') || null;
}

function setAttachmentHeaders(res: Response, filename: string): void {
  const original = normalizeText(filename) || 'bao-cao-kpi.xlsx';
  const fallback = original.replace(/[^a-zA-Z0-9_.-]/g, '_') || 'bao-cao-kpi.xlsx';
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(original)}`,
  );
}

function resolveIssuedAtIso(value: unknown, fallbackDate: Date): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  const text = normalizeText(value);
  if (!text) {
    return fallbackDate.toISOString();
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackDate.toISOString();
  }
  return parsed.toISOString();
}

function parseDateFilterParam(value: unknown, options: { endOfDay?: boolean } = {}): string | null {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  const isoDate = resolveDateInput(text);
  if (!isoDate) {
    return null;
  }

  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (options.endOfDay) {
    date.setHours(23, 59, 59, 999);
  }

  return date.toISOString();
}

function resolveDateInput(input: string): string | null {
  const directIso = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  if (directIso) {
    const year = Number.parseInt(directIso[1], 10);
    const month = Number.parseInt(directIso[2], 10);
    const day = Number.parseInt(directIso[3], 10);
    if (isValidDateParts(year, month, day)) {
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return null;
  }

  const slashDate = input.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:[ T].*)?$/);
  if (slashDate) {
    const first = Number.parseInt(slashDate[1], 10);
    const second = Number.parseInt(slashDate[2], 10);
    const yearRaw = Number.parseInt(slashDate[3], 10);
    const year = slashDate[3].length === 2 ? (yearRaw >= 70 ? 1900 + yearRaw : 2000 + yearRaw) : yearRaw;
    const month = first > 12 && second <= 12 ? second : first;
    const day = first > 12 && second <= 12 ? first : second;
    if (isValidDateParts(year, month, day)) {
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return null;
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return false;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function clampPositiveInt(
  value: unknown,
  options: { min?: number; max?: number; fallback?: number } = {},
): number {
  const min = Number.isFinite(options.min) ? Number(options.min) : 1;
  const max = Number.isFinite(options.max) ? Number(options.max) : Number.MAX_SAFE_INTEGER;
  const fallback = Number.isFinite(options.fallback) ? Number(options.fallback) : min;
  const numeric = Number.parseInt(`${value ?? ''}`, 10);
  if (!Number.isFinite(numeric) || Number.isNaN(numeric)) {
    return fallback;
  }
  if (numeric < min) {
    return min;
  }
  if (numeric > max) {
    return max;
  }
  return numeric;
}

function resolveQueryString(req: Request): string {
  if (typeof req.originalUrl === 'string' && req.originalUrl.includes('?')) {
    return req.originalUrl.slice(req.originalUrl.indexOf('?') + 1);
  }
  return '';
}

function formatCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const text = `${value}`.replace(/"/g, '""');
  return `"${text}"`;
}

function getSingleHeaderValue(req: Request, key: string): string {
  const raw = req.headers?.[key as keyof typeof req.headers];
  if (Array.isArray(raw)) {
    return normalizeText(raw[0]);
  }
  return normalizeText(raw);
}

function getSingleQueryValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function normalizeNullableText(value: unknown, maxLength = 255, trim = true): string | null {
  const raw = trim ? normalizeText(value) : `${value ?? ''}`;
  if (!raw) {
    return null;
  }
  return raw.slice(0, maxLength);
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : `${value ?? ''}`.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
