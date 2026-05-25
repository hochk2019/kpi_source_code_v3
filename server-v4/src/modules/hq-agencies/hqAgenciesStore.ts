import { normalizeMst, normalizeStr } from '../../legacy/legacy-normalizers.js';
import type { AuthPermissionMap } from '../auth/authTypes.js';

const AGENCY_SPLIT_REGEX = /[,;|\n]+/;

export const HQ_AGENCIES_STORAGE_KEY = 'hq_agencies_v1';
export const HQ_HISTORY_STORAGE_KEY = 'hq_history_v1';
export const HQ_HISTORY_LIMIT = 500;

export type HqAgencyBindingDocument = {
  mst: string;
  company: string;
  agents: string[];
  agent: string;
  updatedAt: string;
  updatedBy: string;
};

export type HqAgencyHistoryMutationEntry = {
  id?: string;
  mst: string;
  field: string;
  from: string;
  to: string;
  actor: string;
  timestamp: string;
  type: string;
};

export type HqAgencyActor = {
  username: string;
  role: string;
  name: string;
  permissions: AuthPermissionMap;
  memberId: string | null;
  memberName: string | null;
  teamId: string | null;
  teamName: string | null;
};

export interface HqAgenciesStore {
  upsertBinding(
    binding: HqAgencyBindingDocument,
    historyEntries: readonly HqAgencyHistoryMutationEntry[],
  ): Promise<HqAgencyBindingDocument>;
  deleteBinding(mst: string, historyEntries: readonly HqAgencyHistoryMutationEntry[]): Promise<void>;
}

export function buildHqBindingDocument(value: Record<string, unknown>): HqAgencyBindingDocument | null {
  const mst = normalizeMst(value.mst ?? value.taxCode ?? value.tax_code);
  if (!mst) {
    return null;
  }

  const company = normalizeStr(value.company ?? value.companyName ?? value.company_name ?? value.cong_ty);
  const agents = normalizeHqAgentList(
    value.agents ??
      value.agent ??
      value.agency ??
      value.dai_ly ??
      value.dai_ly_hq ??
      value['Đại lý HQ'] ??
      value['Dai ly HQ'],
  );
  const updatedAt = normalizeTimestamp(value.updatedAt ?? value.updated_at) ?? new Date().toISOString();
  const updatedBy = normalizeStr(value.updatedBy ?? value.updated_by) || 'system';

  return {
    mst,
    company,
    agents,
    agent: agents.join(', '),
    updatedAt,
    updatedBy,
  };
}

export function normalizeHqAgentList(value: unknown): string[] {
  const rawValues = Array.isArray(value)
    ? value
    : (() => {
        const text = normalizeStr(value);
        if (!text) {
          return [];
        }

        if (text.includes(',') || text.includes(';') || text.includes('|') || text.includes('\n')) {
          return text.split(AGENCY_SPLIT_REGEX);
        }

        return [text];
      })();

  const seen = new Set<string>();
  const agents: string[] = [];

  for (const entry of rawValues) {
    const normalized = normalizeStr(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    agents.push(normalized);
  }

  return agents;
}

export function normalizeHqHistoryMutationEntry(value: unknown): HqAgencyHistoryMutationEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const mst = normalizeMst(record.mst ?? record.taxCode ?? record.tax_code);
  if (!mst) {
    return null;
  }

  const field = normalizeStr(record.field ?? record.fieldName ?? record.field_name) || 'field';

  return {
    id: normalizeStr(record.id) || undefined,
    mst,
    field,
    from: normalizeHistoryValue(field, record.from ?? record.fromValue ?? record.from_value),
    to: normalizeHistoryValue(field, record.to ?? record.toValue ?? record.to_value),
    actor: normalizeStr(record.actor ?? record.actorUsername ?? record.actor_username) || 'system',
    timestamp: normalizeTimestamp(record.timestamp ?? record.occurredAt ?? record.occurred_at) ?? new Date().toISOString(),
    type: normalizeStr(record.type ?? record.eventType ?? record.event_type) || 'update',
  };
}

export function cloneHqBindingDocument(binding: HqAgencyBindingDocument): HqAgencyBindingDocument {
  return {
    ...binding,
    agents: binding.agents.slice(),
  };
}

export function cloneHqHistoryMutationEntries(
  entries: readonly HqAgencyHistoryMutationEntry[],
): HqAgencyHistoryMutationEntry[] {
  return entries.map((entry) => ({ ...entry }));
}

function normalizeHistoryValue(field: string, value: unknown): string {
  if (field === 'agents') {
    return normalizeHqAgentList(value).join(', ');
  }

  return normalizeStr(value);
}

function normalizeTimestamp(value: unknown): string | null {
  const raw = normalizeStr(value);
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
