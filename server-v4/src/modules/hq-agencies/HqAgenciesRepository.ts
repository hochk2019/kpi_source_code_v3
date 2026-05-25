import { normalizeMst, normalizeStr, stripDiacritics } from '../../legacy/legacy-normalizers.js';
import type { HqAgenciesAsyncReader } from './hqAgenciesAsyncReader.js';

export type HqAgencyBindingFilters = {
  mst?: string;
  company?: string;
  agent?: string;
};

export type HqAgencyBindingRecord = {
  mst: string;
  company: string;
  agent: string;
  agents: string[];
};

export type HqAgencyHistoryFilters = {
  mst?: string;
};

export type HqAgencyHistoryRecord = {
  id: string;
  mst: string;
  field: string;
  from: string;
  to: string;
  actor: string;
  timestamp: string;
  type: string;
};

const AGENCY_SPLIT_REGEX = /[,;|\n]+/;

export class HqAgenciesRepository {
  constructor(private readonly reader: HqAgenciesAsyncReader) {}

  async listBindings(filters: HqAgencyBindingFilters = {}): Promise<HqAgencyBindingRecord[]> {
    const raw = await this.reader.readBindings();
    const sanitized = Array.isArray(raw)
      ? raw
          .map((entry) => sanitizeBinding(entry))
          .filter((entry): entry is HqAgencyBindingRecord => Boolean(entry))
      : [];

    return applyBindingFilters(sortBindings(sanitized), filters);
  }

  async listHistoryEntries(filters: HqAgencyHistoryFilters = {}): Promise<HqAgencyHistoryRecord[]> {
    const raw = await this.reader.readHistoryEntries();
    const sanitized = Array.isArray(raw)
      ? raw
          .map((entry, index) => sanitizeHistoryEntry(entry, index))
          .filter((entry): entry is HqAgencyHistoryRecord => Boolean(entry))
      : [];

    return applyHistoryFilters(sortHistoryEntries(sanitized), filters);
  }
}

function sanitizeBinding(input: unknown): HqAgencyBindingRecord | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const row = input as Record<string, unknown>;
  const mst = normalizeMst(row.mst ?? row.taxCode ?? row.tax_code);
  if (!mst) {
    return null;
  }

  const company = normalizeStr(row.company ?? row.companyName ?? row.company_name ?? row.cong_ty);
  const agents = normalizeAgentList(
    row.agents ??
      row.agentNames ??
      row.agent_names ??
      row.agent ??
      row.agency ??
      row.dai_ly ??
      row.dai_ly_hq,
  );

  return {
    mst,
    company,
    agent: agents.join(', '),
    agents,
  };
}

function sanitizeHistoryEntry(input: unknown, index: number): HqAgencyHistoryRecord | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const row = input as Record<string, unknown>;
  const mst = normalizeMst(row.mst ?? row.taxCode ?? row.tax_code);
  if (!mst) {
    return null;
  }

  return {
    id:
      normalizeStr(row.id) ||
      `hq-${mst}-${normalizeStr(row.field ?? row.fieldName ?? row.field_name) || 'update'}-${index + 1}`,
    mst,
    field: normalizeStr(row.field ?? row.fieldName ?? row.field_name),
    from: normalizeHistoryValue(row.from ?? row.fromValue ?? row.from_value),
    to: normalizeHistoryValue(row.to ?? row.toValue ?? row.to_value),
    actor: normalizeStr(row.actor ?? row.actorUsername ?? row.actor_username) || 'system',
    timestamp: normalizeTimestamp(row.timestamp ?? row.occurredAt ?? row.occurred_at),
    type: normalizeStr(row.type ?? row.eventType ?? row.event_type) || 'update',
  };
}

function applyBindingFilters(
  rows: HqAgencyBindingRecord[],
  filters: HqAgencyBindingFilters,
): HqAgencyBindingRecord[] {
  const mst = normalizeMst(filters.mst);
  const company = normalizeSearchText(filters.company);
  const agent = normalizeSearchText(filters.agent);

  return rows.filter((row) => {
    if (mst && row.mst !== mst) {
      return false;
    }

    if (company && !normalizeSearchText(row.company).includes(company)) {
      return false;
    }

    if (agent && !normalizeSearchText(row.agent).includes(agent)) {
      return false;
    }

    return true;
  });
}

function applyHistoryFilters(
  rows: HqAgencyHistoryRecord[],
  filters: HqAgencyHistoryFilters,
): HqAgencyHistoryRecord[] {
  const mst = normalizeMst(filters.mst);

  return rows.filter((row) => {
    if (mst && row.mst !== mst) {
      return false;
    }

    return true;
  });
}

function sortBindings(rows: HqAgencyBindingRecord[]): HqAgencyBindingRecord[] {
  return rows.slice().sort((left, right) => {
    const companyCompare = left.company.localeCompare(right.company, 'vi', { sensitivity: 'base' });
    if (companyCompare !== 0) {
      return companyCompare;
    }

    return left.mst.localeCompare(right.mst);
  });
}

function sortHistoryEntries(rows: HqAgencyHistoryRecord[]): HqAgencyHistoryRecord[] {
  return rows.slice().sort((left, right) => {
    const timestampCompare = parseTimestamp(right.timestamp) - parseTimestamp(left.timestamp);
    if (timestampCompare !== 0) {
      return timestampCompare;
    }

    return right.id.localeCompare(left.id, undefined, { sensitivity: 'base' });
  });
}

function normalizeAgentList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((entry) => normalizeStr(entry))
          .filter(Boolean),
      ),
    );
  }

  const text = normalizeStr(value);
  if (!text) {
    return [];
  }

  const parts = text.includes(',') || text.includes(';') || text.includes('|') || text.includes('\n')
    ? text.split(AGENCY_SPLIT_REGEX)
    : [text];

  return Array.from(
    new Set(
      parts
        .map((entry) => normalizeStr(entry))
        .filter(Boolean),
    ),
  );
}

function normalizeHistoryValue(value: unknown): string {
  if (Array.isArray(value)) {
    return normalizeAgentList(value).join(', ');
  }

  return normalizeStr(value);
}

function normalizeTimestamp(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  return normalizeStr(value);
}

function parseTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeSearchText(value: unknown): string {
  return stripDiacritics(normalizeStr(value)).toLowerCase();
}
