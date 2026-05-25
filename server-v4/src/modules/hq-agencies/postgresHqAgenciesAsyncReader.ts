import type { Pool } from 'pg';

import type { BusinessSnapshotSourceKind } from '../../persistence/businessSnapshotReader.js';
import type { HqAgenciesAsyncReader } from './hqAgenciesAsyncReader.js';

type PoolLike = Pick<Pool, 'query'>;

type BindingRow = {
  tax_code?: unknown;
  company_name?: unknown;
  agent_name?: unknown;
};

type EventRow = {
  id?: unknown;
  tax_code?: unknown;
  event_type?: unknown;
  payload?: unknown;
  actor_username?: unknown;
  occurred_at?: unknown;
};

type HistoryEntry = {
  id: string;
  mst: string;
  field: string;
  from: string;
  to: string;
  actor: string;
  timestamp: string;
  type: string;
};

const READ_BINDINGS_SQL =
  'SELECT ' +
  'b.tax_code, ' +
  "COALESCE(b.company_name, '') AS company_name, " +
  'a.agent_name ' +
  'FROM tax_code_agency_bindings b ' +
  'LEFT JOIN tax_code_agency_binding_agents a ON a.binding_id = b.id ' +
  'ORDER BY b.company_name ASC, b.tax_code ASC, a.agent_order ASC, a.agent_name ASC';

const READ_HISTORY_SQL =
  'SELECT ' +
  'id::text AS id, ' +
  'tax_code, ' +
  "COALESCE(event_type, '') AS event_type, " +
  'payload, ' +
  "COALESCE(actor_username, '') AS actor_username, " +
  'occurred_at ' +
  'FROM tax_code_agency_binding_events ' +
  'ORDER BY occurred_at DESC, id DESC';

export class PostgresHqAgenciesAsyncReader implements HqAgenciesAsyncReader {
  private readonly legacyDbFile: string | null;
  private readonly sourceKind: Extract<BusinessSnapshotSourceKind, 'dual-write' | 'relational-store'>;

  constructor(
    private readonly fallbackReader: HqAgenciesAsyncReader,
    private readonly pool: PoolLike,
    options: {
      legacyDbFile?: string | null;
      sourceKind?: Extract<BusinessSnapshotSourceKind, 'dual-write' | 'relational-store'>;
    } = {},
  ) {
    this.legacyDbFile = options.legacyDbFile ?? null;
    this.sourceKind = options.sourceKind ?? 'dual-write';
  }

  getSourceKind() {
    return this.sourceKind;
  }

  getHotPathKeys() {
    return this.fallbackReader.getHotPathKeys();
  }

  getLegacyDbFile(): string | null {
    return this.legacyDbFile;
  }

  async readBindings(): Promise<unknown[]> {
    try {
      const result = await this.pool.query<BindingRow>(READ_BINDINGS_SQL);
      const bindings = buildBindings(result.rows);
      if (bindings.length > 0) {
        return bindings;
      }
    } catch {
      // Fall back to SQLite compatibility while Postgres HQ bindings are incomplete.
    }

    return this.fallbackReader.readBindings();
  }

  async readHistoryEntries(): Promise<unknown[]> {
    try {
      const result = await this.pool.query<EventRow>(READ_HISTORY_SQL);
      const historyEntries = buildHistoryEntries(result.rows);
      if (historyEntries.length > 0) {
        return historyEntries;
      }
    } catch {
      // Fall back to SQLite compatibility while Postgres HQ history is incomplete.
    }

    return this.fallbackReader.readHistoryEntries();
  }
}

function buildBindings(rows: BindingRow[]): Array<Record<string, unknown>> {
  const grouped = new Map<string, { mst: string; company: string; agents: string[] }>();

  for (const row of Array.isArray(rows) ? rows : []) {
    const mst = normalizeText(row?.tax_code);
    if (!mst) {
      continue;
    }

    const binding = grouped.get(mst) ?? {
      mst,
      company: normalizeText(row?.company_name),
      agents: [],
    };

    if (!binding.company) {
      binding.company = normalizeText(row?.company_name);
    }

    const agentName = normalizeText(row?.agent_name);
    if (agentName && !binding.agents.includes(agentName)) {
      binding.agents.push(agentName);
    }

    grouped.set(mst, binding);
  }

  return Array.from(grouped.values()).map((entry) => ({
    mst: entry.mst,
    company: entry.company,
    agent: entry.agents.join(', '),
    agents: entry.agents.slice(),
  }));
}

function buildHistoryEntries(rows: EventRow[]): HistoryEntry[] {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const mst = normalizeText(row?.tax_code);
      if (!mst) {
        return null;
      }

      const payload = parsePayload(row?.payload);
      return {
        id:
          normalizeText(row?.id) ||
          `hq-${mst}-${normalizeText(row?.event_type) || 'update'}-${normalizeTimestamp(row?.occurred_at)}`,
        mst,
        field: normalizeText(payload.field ?? payload.fieldName ?? payload.field_name),
        from: normalizeHistoryValue(payload.from ?? payload.fromValue ?? payload.from_value),
        to: normalizeHistoryValue(payload.to ?? payload.toValue ?? payload.to_value),
        actor:
          normalizeText(row?.actor_username) ||
          normalizeText(payload.actor ?? payload.actorUsername ?? payload.actor_username) ||
          'system',
        timestamp: normalizeTimestamp(row?.occurred_at) || normalizeTimestamp(payload.timestamp),
        type: normalizeText(row?.event_type) || normalizeText(payload.type) || 'update',
      };
    })
    .filter((entry): entry is HistoryEntry => entry !== null);
}

function parsePayload(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function normalizeHistoryValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean)
      .join(', ');
  }

  return normalizeText(value);
}

function normalizeTimestamp(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  return normalizeText(value);
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
