import { randomUUID } from 'node:crypto';

import {
  KpiAdjustmentsRepository,
  sanitizeAdjustment,
  summarizeAdjustments,
  type KpiAdjustmentFilters,
  type KpiAdjustmentRecord,
  type KpiAdjustmentSummary,
  type KpiAdjustmentStatus,
} from './KpiAdjustmentsRepository.js';
import {
  cloneAdjustmentSettings,
  type KpiAdjustmentActor,
  type KpiAdjustmentSettingsDocument,
  type KpiAdjustmentStoredRecord,
  type KpiAdjustmentsStore,
} from './kpiAdjustmentsStore.js';

export type KpiAdjustmentsListQuery = KpiAdjustmentFilters & {
  limit?: number;
};

export type KpiAdjustmentsListResponse = {
  total: number;
  items: KpiAdjustmentRecord[];
  summary: KpiAdjustmentSummary;
};

export class KpiAdjustmentsHttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'KpiAdjustmentsHttpError';
  }
}

export class KpiAdjustmentsService {
  constructor(
    private readonly repository: KpiAdjustmentsRepository,
    private readonly store: KpiAdjustmentsStore,
  ) {}

  async listAdjustments(query: KpiAdjustmentsListQuery = {}): Promise<KpiAdjustmentsListResponse> {
    const matches = await this.repository.listAdjustments(query);
    const limit = Number.isFinite(query.limit) && query.limit && query.limit > 0 ? Math.floor(query.limit) : null;

    return {
      total: matches.length,
      items: limit ? matches.slice(0, limit) : matches,
      summary: summarizeAdjustments(matches),
    };
  }

  async readSettings(actor: KpiAdjustmentActor): Promise<KpiAdjustmentSettingsDocument> {
    this.requireSubmitter(actor);
    return this.store.readSettings();
  }

  async updateSettings(
    actor: KpiAdjustmentActor,
    patch: Record<string, unknown>,
  ): Promise<KpiAdjustmentSettingsDocument> {
    this.requireApprover(actor);
    const current = await this.store.readSettings();
    const next = mergeSettingsPatch(current, patch, actor.username);
    return this.store.writeSettings(next);
  }

  async createAdjustment(
    actor: KpiAdjustmentActor,
    payload: Record<string, unknown>,
  ): Promise<KpiAdjustmentRecord> {
    this.requireSubmitter(actor);
    const settings = await this.store.readSettings();
    const now = new Date();
    const record = buildStoredRecord({
      input: payload,
      current: null,
      settings,
      actor,
      now,
    });

    const stored = await this.store.createAdjustment(record);
    return toOutputRecord(stored);
  }

  async updateAdjustment(
    actor: KpiAdjustmentActor,
    adjustmentId: string,
    payload: Record<string, unknown>,
  ): Promise<KpiAdjustmentRecord> {
    this.requireSubmitter(actor);
    const normalizedId = `${adjustmentId ?? ''}`.trim();
    if (!normalizedId) {
      throw new KpiAdjustmentsHttpError(400, 'invalid_request', 'Thiếu mã điểm KPI bổ sung cần cập nhật.');
    }

    const current = await this.store.readAdjustmentById(normalizedId);
    if (!current) {
      throw new KpiAdjustmentsHttpError(404, 'not_found', 'Không tìm thấy điểm KPI bổ sung.');
    }

    const settings = await this.store.readSettings();
    const now = new Date();
    const record = buildStoredRecord({
      input: payload,
      current,
      settings,
      actor,
      now,
    });

    const stored = await this.store.updateAdjustment(record);
    return toOutputRecord(stored);
  }

  private requireSubmitter(actor: KpiAdjustmentActor): void {
    if (!actor.permissions.adjustSubmit && !actor.permissions.adjustApprove) {
      throw new KpiAdjustmentsHttpError(403, 'forbidden', 'Bạn không có quyền thao tác điểm KPI bổ sung.');
    }
  }

  private requireApprover(actor: KpiAdjustmentActor): void {
    if (!actor.permissions.adjustApprove) {
      throw new KpiAdjustmentsHttpError(403, 'forbidden', 'Bạn không có quyền cấu hình hoặc duyệt điểm KPI bổ sung.');
    }
  }
}

function buildStoredRecord(input: {
  input: Record<string, unknown>;
  current: KpiAdjustmentStoredRecord | null;
  settings: KpiAdjustmentSettingsDocument;
  actor: KpiAdjustmentActor;
  now: Date;
}): KpiAdjustmentStoredRecord {
  const { current, settings, actor, now } = input;
  const payload = input.input ?? {};
  const category = normalizeText(payload.category ?? current?.category);
  if (!category) {
    throw new KpiAdjustmentsHttpError(400, 'invalid_request', 'Thiếu loại điểm KPI bổ sung.');
  }

  const month = normalizeMonth(payload.month ?? payload.period ?? current?.month);
  if (!month) {
    throw new KpiAdjustmentsHttpError(400, 'invalid_request', 'Tháng KPI bổ sung phải theo định dạng YYYY-MM.');
  }

  const nowIso = now.toISOString();
  const status = resolveNextStatus({
    requestedStatus: payload.status,
    currentStatus: current?.status ?? 'pending',
    actor,
    settings,
    isCreate: !current,
  });
  const quantity = normalizeNumber(payload.quantity ?? current?.quantity ?? 1);
  const unitPoints = normalizeNumber(payload.unitPoints ?? current?.unitPoints ?? 0);
  const extraQuantity = normalizeOptionalNumber(payload.extraQuantity ?? current?.extraQuantity);
  const extraUnitPoints = normalizeOptionalNumber(payload.extraUnitPoints ?? current?.extraUnitPoints);
  const computedTotal = roundPoints(
    quantity * unitPoints + (extraQuantity ?? 0) * (extraUnitPoints ?? 0),
  );
  const requestedTotal = normalizeOptionalNumber(payload.totalPoints);
  const totalPoints =
    requestedTotal !== undefined && actor.permissions.adjustOverridePoints ? roundPoints(requestedTotal) : computedTotal;
  const createdAt = current?.createdAt || nowIso;
  const statusChanged = current ? current.status !== status.status : true;
  const nextHistory = Array.isArray(current?.history) ? current!.history.slice() : [];
  const nextApprovedAt =
    status.status === 'approved'
      ? (status.approvedAt ?? current?.approvedAt)
      : undefined;
  const nextApprovedBy =
    status.status === 'approved'
      ? (status.approvedBy ?? current?.approvedBy)
      : undefined;
  const nextRejectedAt =
    status.status === 'rejected'
      ? (status.rejectedAt ?? current?.rejectedAt)
      : undefined;
  const nextRejectedBy =
    status.status === 'rejected'
      ? (status.rejectedBy ?? current?.rejectedBy)
      : undefined;

  nextHistory.push(
    createHistoryEntry({
      action: current ? 'update' : 'create',
      actor: actor.username,
      detail: normalizeText(payload.note ?? current?.note),
    }),
  );

  if (status.status === 'approved' && statusChanged) {
    nextHistory.push(
      createHistoryEntry({
        action: 'status.approved',
        actor: status.statusActor,
        detail: status.statusDetail,
      }),
    );
  }

  if (status.status === 'rejected' && statusChanged) {
    nextHistory.push(
      createHistoryEntry({
        action: 'status.rejected',
        actor: status.statusActor,
        detail: status.statusDetail,
      }),
    );
  }

  return {
    ...(current ?? {}),
    id: current?.id ?? randomUUID(),
    category,
    month,
    status: status.status,
    staffName: normalizeText(payload.staffName ?? payload.staff ?? current?.staffName ?? actor.memberName ?? actor.name),
    teamName: normalizeText(payload.teamName ?? payload.team ?? current?.teamName ?? actor.teamName),
    quantity,
    unitPoints,
    totalPoints,
    references: normalizeStringArray(payload.references ?? current?.references),
    note: normalizeText(payload.note ?? current?.note),
    createdAt,
    updatedAt: nowIso,
    history: nextHistory,
    mode: normalizeOptionalText(payload.mode ?? current?.mode),
    licenseCode: normalizeOptionalText(payload.licenseCode ?? payload.license_code ?? current?.licenseCode),
    companyName: normalizeOptionalText(payload.companyName ?? payload.company_name ?? current?.companyName),
    taxCode: normalizeOptionalText(payload.taxCode ?? payload.tax_code ?? current?.taxCode),
    extraQuantity,
    extraUnitPoints,
    createdBy: current?.createdBy ?? actor.username,
    updatedBy: actor.username,
    approvedAt: nextApprovedAt,
    approvedBy: nextApprovedBy,
    rejectedAt: nextRejectedAt,
    rejectedBy: nextRejectedBy,
  };
}

function resolveNextStatus(input: {
  requestedStatus: unknown;
  currentStatus: KpiAdjustmentStatus;
  actor: KpiAdjustmentActor;
  settings: KpiAdjustmentSettingsDocument;
  isCreate: boolean;
}) {
  const requested = normalizeStatus(input.requestedStatus) ?? input.currentStatus;
  const autoApproveEnabled = input.settings.autoApprove.enabled === true;
  const statusChanged = requested !== input.currentStatus;

  if ((requested === 'approved' || requested === 'rejected') && !input.actor.permissions.adjustApprove) {
    throw new KpiAdjustmentsHttpError(403, 'forbidden', 'Bạn không có quyền duyệt điểm KPI bổ sung.');
  }

  if (input.isCreate && requested === 'pending' && autoApproveEnabled && !input.actor.permissions.adjustApprove) {
    const approvedBy = input.settings.autoApprove.updatedBy || 'auto-approve';
    return {
      status: 'approved' as const,
      approvedAt: new Date().toISOString(),
      approvedBy,
      rejectedAt: undefined,
      rejectedBy: undefined,
      statusActor: approvedBy,
      statusDetail: input.settings.autoApprove.note
        ? `Duyệt tự động: ${input.settings.autoApprove.note}`
        : 'Duyệt tự động',
    };
  }

  if (requested === 'approved') {
    const approvedBy = input.actor.username;
    return {
      status: requested,
      approvedAt: statusChanged ? new Date().toISOString() : undefined,
      approvedBy: statusChanged ? approvedBy : undefined,
      rejectedAt: undefined,
      rejectedBy: undefined,
      statusActor: approvedBy,
      statusDetail: '',
    };
  }

  if (requested === 'rejected') {
    const rejectedBy = input.actor.username;
    return {
      status: requested,
      approvedAt: undefined,
      approvedBy: undefined,
      rejectedAt: statusChanged ? new Date().toISOString() : undefined,
      rejectedBy: statusChanged ? rejectedBy : undefined,
      statusActor: rejectedBy,
      statusDetail: '',
    };
  }

  return {
    status: requested,
    approvedAt: undefined,
    approvedBy: undefined,
    rejectedAt: undefined,
    rejectedBy: undefined,
    statusActor: input.actor.username,
    statusDetail: '',
  };
}

function mergeSettingsPatch(
  current: KpiAdjustmentSettingsDocument,
  patch: Record<string, unknown>,
  actor: string,
): KpiAdjustmentSettingsDocument {
  const next = cloneAdjustmentSettings(current);
  const timestamp = new Date().toISOString();
  const patchCategories =
    patch.categories && typeof patch.categories === 'object' && !Array.isArray(patch.categories)
      ? (patch.categories as Record<string, unknown>)
      : {};

  for (const [category, value] of Object.entries(patchCategories)) {
    const categoryKey = normalizeText(category);
    if (!categoryKey || !value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }

    const currentCategory = next.categories[categoryKey] ? { ...next.categories[categoryKey] } : {};
    applyObjectPatch(currentCategory, value as Record<string, unknown>);

    if (Object.keys(currentCategory).length > 0) {
      next.categories[categoryKey] = currentCategory;
    } else {
      delete next.categories[categoryKey];
    }
  }

  if (patch.autoApprove && typeof patch.autoApprove === 'object' && !Array.isArray(patch.autoApprove)) {
    const autoPatch = patch.autoApprove as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(autoPatch, 'enabled')) {
      next.autoApprove.enabled = autoPatch.enabled === true;
      next.autoApprove.updatedAt = timestamp;
      next.autoApprove.updatedBy = actor;
    }
    if (Object.prototype.hasOwnProperty.call(autoPatch, 'note')) {
      next.autoApprove.note = normalizeNullableText(autoPatch.note);
      next.autoApprove.updatedAt = timestamp;
      next.autoApprove.updatedBy = actor;
    }
  }

  next.updatedAt = timestamp;
  next.updatedBy = actor;
  return next;
}

function applyObjectPatch(target: Record<string, unknown>, patch: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(patch)) {
    const field = normalizeText(key);
    if (!field) {
      continue;
    }

    if (value === null) {
      delete target[field];
      continue;
    }

    if (Array.isArray(value)) {
      target[field] = value.slice();
      continue;
    }

    if (value && typeof value === 'object') {
      const nested = target[field] && typeof target[field] === 'object' && !Array.isArray(target[field])
        ? { ...(target[field] as Record<string, unknown>) }
        : {};
      applyObjectPatch(nested, value as Record<string, unknown>);
      if (Object.keys(nested).length > 0) {
        target[field] = nested;
      } else {
        delete target[field];
      }
      continue;
    }

    target[field] = value;
  }
}

function createHistoryEntry(input: { action: string; actor: string; detail?: string }) {
  return {
    action: input.action,
    actor: input.actor,
    detail: input.detail ? input.detail : '',
    timestamp: new Date().toISOString(),
  };
}

function toOutputRecord(record: KpiAdjustmentStoredRecord): KpiAdjustmentRecord {
  const sanitized = sanitizeAdjustment(record, 0);
  if (!sanitized) {
    throw new KpiAdjustmentsHttpError(500, 'internal_error', 'Không thể chuẩn hoá điểm KPI bổ sung.');
  }
  return sanitized;
}

function normalizeText(value: unknown): string {
  return `${value ?? ''}`.trim();
}

function normalizeOptionalText(value: unknown): string | undefined {
  const normalized = normalizeText(value);
  return normalized || undefined;
}

function normalizeNullableText(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeNumber(value: unknown): number {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : undefined;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => normalizeText(entry)).filter(Boolean);
}

function normalizeMonth(value: unknown): string {
  const raw = normalizeText(value);
  if (/^\d{4}-\d{2}$/.test(raw)) {
    return raw;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw.slice(0, 7);
  }
  return '';
}

function normalizeStatus(value: unknown): KpiAdjustmentStatus | null {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'pending' || normalized === 'approved' || normalized === 'rejected') {
    return normalized;
  }
  return null;
}

function roundPoints(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}
