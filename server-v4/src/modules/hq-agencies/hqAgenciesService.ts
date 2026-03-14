import {
  HqAgenciesRepository,
  type HqAgencyBindingFilters,
  type HqAgencyBindingRecord,
  type HqAgencyHistoryFilters,
  type HqAgencyHistoryRecord,
} from './HqAgenciesRepository.js';
import {
  buildHqBindingDocument,
  cloneHqBindingDocument,
  type HqAgencyActor,
  type HqAgencyBindingDocument,
  type HqAgencyHistoryMutationEntry,
  type HqAgenciesStore,
} from './hqAgenciesStore.js';

export type HqAgenciesBindingsQuery = HqAgencyBindingFilters & {
  limit?: number;
};

export type HqAgenciesHistoryQuery = HqAgencyHistoryFilters & {
  limit?: number;
};

export type HqAgenciesBindingsResponse = {
  total: number;
  items: HqAgencyBindingRecord[];
};

export type HqAgenciesHistoryResponse = {
  total: number;
  items: HqAgencyHistoryRecord[];
};

export type HqAgenciesUpsertResponse = {
  operation: 'create' | 'update';
  historyCount: number;
  binding: HqAgencyBindingRecord;
};

export type HqAgenciesDeleteResponse = {
  deleted: true;
  mst: string;
  historyCount: number;
};

export class HqAgenciesHttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HqAgenciesHttpError';
  }
}

export class HqAgenciesService {
  constructor(
    private readonly repository: HqAgenciesRepository,
    private readonly store: HqAgenciesStore,
  ) {}

  async listBindings(query: HqAgenciesBindingsQuery = {}): Promise<HqAgenciesBindingsResponse> {
    const matches = await this.repository.listBindings(query);
    const limit = normalizeLimit(query.limit);

    return {
      total: matches.length,
      items: limit ? matches.slice(0, limit) : matches,
    };
  }

  async listHistory(query: HqAgenciesHistoryQuery = {}): Promise<HqAgenciesHistoryResponse> {
    const matches = await this.repository.listHistoryEntries(query);
    const limit = normalizeLimit(query.limit);

    return {
      total: matches.length,
      items: limit ? matches.slice(0, limit) : matches,
    };
  }

  async upsertBinding(
    actor: HqAgencyActor,
    payload: Record<string, unknown>,
  ): Promise<HqAgenciesUpsertResponse> {
    this.requireManage(actor);

    const binding = buildHqBindingDocument({
      ...payload,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.username,
    });
    if (!binding) {
      throw new HqAgenciesHttpError(400, 'invalid_request', 'Mã số thuế Đại lý HQ không hợp lệ.');
    }

    const current = await this.readBindingByMst(binding.mst);
    const historyEntries = current
      ? buildUpdateHistoryEntries(current, binding, actor.username)
      : buildCreateHistoryEntries(binding, actor.username);
    const stored = await this.store.upsertBinding(binding, historyEntries);

    return {
      operation: current ? 'update' : 'create',
      historyCount: historyEntries.length,
      binding: toBindingRecord(stored),
    };
  }

  async deleteBinding(actor: HqAgencyActor, mst: string): Promise<HqAgenciesDeleteResponse> {
    this.requireManage(actor);

    const normalizedMst = `${mst ?? ''}`.trim().replace(/\D/g, '');
    if (!normalizedMst) {
      throw new HqAgenciesHttpError(400, 'invalid_request', 'Thiếu mã số thuế Đại lý HQ cần xoá.');
    }

    const current = await this.readBindingByMst(normalizedMst);
    if (!current) {
      throw new HqAgenciesHttpError(404, 'not_found', 'Không tìm thấy Đại lý HQ cần xoá.');
    }

    const historyEntries = buildDeleteHistoryEntries(current, actor.username);
    await this.store.deleteBinding(normalizedMst, historyEntries);

    return {
      deleted: true,
      mst: normalizedMst,
      historyCount: historyEntries.length,
    };
  }

  private async readBindingByMst(mst: string): Promise<HqAgencyBindingRecord | null> {
    const matches = await this.repository.listBindings({ mst });
    return matches[0] ?? null;
  }

  private requireManage(actor: HqAgencyActor): void {
    if (!actor.permissions.mstEdit && !actor.permissions.accountManage) {
      throw new HqAgenciesHttpError(403, 'forbidden', 'Bạn không có quyền quản lý Đại lý HQ.');
    }
  }
}

function normalizeLimit(value: unknown): number | null {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? Math.floor(normalized) : null;
}

function buildCreateHistoryEntries(
  binding: HqAgencyBindingDocument,
  actor: string,
): HqAgencyHistoryMutationEntry[] {
  const entries: HqAgencyHistoryMutationEntry[] = [];
  const timestamp = binding.updatedAt;

  if (binding.company) {
    entries.push({
      mst: binding.mst,
      field: 'company',
      from: '',
      to: binding.company,
      actor,
      timestamp,
      type: 'create',
    });
  }

  if (binding.agent) {
    entries.push({
      mst: binding.mst,
      field: 'agents',
      from: '',
      to: binding.agent,
      actor,
      timestamp,
      type: 'create',
    });
  }

  return entries;
}

function buildUpdateHistoryEntries(
  current: HqAgencyBindingRecord,
  next: HqAgencyBindingDocument,
  actor: string,
): HqAgencyHistoryMutationEntry[] {
  const entries: HqAgencyHistoryMutationEntry[] = [];
  const timestamp = next.updatedAt;

  if (current.company !== next.company) {
    entries.push({
      mst: next.mst,
      field: 'company',
      from: current.company,
      to: next.company,
      actor,
      timestamp,
      type: 'update',
    });
  }

  if (current.agent !== next.agent) {
    entries.push({
      mst: next.mst,
      field: 'agents',
      from: current.agent,
      to: next.agent,
      actor,
      timestamp,
      type: 'update',
    });
  }

  return entries;
}

function buildDeleteHistoryEntries(
  current: HqAgencyBindingRecord,
  actor: string,
): HqAgencyHistoryMutationEntry[] {
  const timestamp = new Date().toISOString();
  const entries: HqAgencyHistoryMutationEntry[] = [];

  if (current.company) {
    entries.push({
      mst: current.mst,
      field: 'company',
      from: current.company,
      to: '',
      actor,
      timestamp,
      type: 'delete',
    });
  }

  if (current.agent) {
    entries.push({
      mst: current.mst,
      field: 'agents',
      from: current.agent,
      to: '',
      actor,
      timestamp,
      type: 'delete',
    });
  }

  return entries;
}

function toBindingRecord(binding: HqAgencyBindingDocument): HqAgencyBindingRecord {
  const normalized = cloneHqBindingDocument(binding);
  return {
    mst: normalized.mst,
    company: normalized.company,
    agent: normalized.agent,
    agents: normalized.agents,
  };
}
