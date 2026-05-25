import {
  DEFERRED_BOOTSTRAP_STORAGE_KEYS,
  LIGHT_BOOTSTRAP_STORAGE_KEYS,
  SHARED_LIGHT_BOOTSTRAP_MODE,
} from '../../../../packages/domain/src/bootstrapStorageKeys.js';
import type { RuntimePersistence } from '../../persistence/runtimePersistence.js';
import { createDefaultKpiRuleCollection } from '../../modules/kpi-rules/kpiRuleDefaults.js';
import { createEmptyTeamRoster, normalizeTeamRoster } from '../../modules/teams/teamRosterDocument.js';
import type { AuthAccountView } from '../../modules/auth/authTypes.js';
import { sanitizeAuthAccount } from '../../modules/auth/authShared.js';

const AUTH_ACCOUNTS_STORAGE_KEY = 'kpi_users_v1';
const DECLARATION_ROWS_STORAGE_KEY = 'decl_rows_v1';
const MST_ASSIGNMENTS_STORAGE_KEY = 'mst_rows_v2';
const MST_HISTORY_STORAGE_KEY = 'mst_history_v1';
const DECLARATION_HISTORY_STORAGE_KEY = 'decl_history_v1';
const KPI_RULES_STORAGE_KEY = 'kpi_rules_v2';
const TEAM_ROSTER_STORAGE_KEY = 'team_roster_v1';
const AUDIT_LOGS_STORAGE_KEY = 'audit_logs_v1';
const IMPORT_LOGS_STORAGE_KEY = 'import_logs_v1';
const HQ_AGENCIES_STORAGE_KEY = 'hq_agencies_v1';
const HQ_HISTORY_STORAGE_KEY = 'hq_history_v1';
const KPI_ADJUSTMENTS_STORAGE_KEY = 'kpi_adjustments_v1';
const KPI_ADJUSTMENT_SETTINGS_STORAGE_KEY = 'kpi_adjustment_settings_v1';
const KPI_REPORT_SCHEDULE_STORAGE_KEY = 'kpi_report_schedule_v1';
const COMMAND_CENTER_PINS_STORAGE_KEY = 'kpi_command_center_pins_v1';
const UI_LAYOUT_STORAGE_KEY = 'ui_layout_config_v1';

const EMPTY_OBJECT = Object.freeze({});
const EMPTY_ARRAY = Object.freeze([]);

export type SharedSyncBootstrapResponse = {
  data: Record<string, string | null>;
  deferredKeys: string[];
  mode: string;
  meta: {
    generatedAt: string;
    sourceKind: string;
    rowCounts: Record<string, number>;
  };
};

export async function buildSharedSyncBootstrapResponse(
  persistence: RuntimePersistence,
  mode: string | null | undefined,
): Promise<SharedSyncBootstrapResponse> {
  const normalizedMode =
    typeof mode === 'string' && mode.trim() ? mode.trim() : SHARED_LIGHT_BOOTSTRAP_MODE;
  const selectedMode =
    normalizedMode === SHARED_LIGHT_BOOTSTRAP_MODE ? SHARED_LIGHT_BOOTSTRAP_MODE : normalizedMode;
  const bootstrapKeys =
    selectedMode === SHARED_LIGHT_BOOTSTRAP_MODE
      ? LIGHT_BOOTSTRAP_STORAGE_KEYS
      : [...LIGHT_BOOTSTRAP_STORAGE_KEYS, ...DEFERRED_BOOTSTRAP_STORAGE_KEYS];

  const data: Record<string, string | null> = {};
  const rowCounts: Record<string, number> = {};
  for (const key of bootstrapKeys) {
    const value = await readSharedSyncValue(persistence, key);
    if (value !== undefined) {
      data[key] = normalizeSharedSyncRawValue(value);
      rowCounts[key] = countSharedSyncRows(value);
    }
  }

  return {
    data,
    deferredKeys:
      selectedMode === SHARED_LIGHT_BOOTSTRAP_MODE ? [...DEFERRED_BOOTSTRAP_STORAGE_KEYS] : [],
    mode: selectedMode,
    meta: {
      generatedAt: new Date().toISOString(),
      sourceKind: `${persistence.sourceKind}`,
      rowCounts,
    },
  };
}

export async function readSharedSyncValue(
  persistence: RuntimePersistence,
  key: string,
): Promise<unknown | undefined> {
  switch (`${key}`.trim()) {
    case AUTH_ACCOUNTS_STORAGE_KEY:
      return listSanitizedAccounts(persistence);
    case DECLARATION_ROWS_STORAGE_KEY:
      return persistence.declarationsReader.readDeclarationRows();
    case MST_ASSIGNMENTS_STORAGE_KEY:
      return persistence.mstAssignmentsReader.readMstAssignmentRows();
    case MST_HISTORY_STORAGE_KEY:
      return [];
    case DECLARATION_HISTORY_STORAGE_KEY:
      return { rows: {} };
    case KPI_RULES_STORAGE_KEY:
      return (await persistence.kpiRulesReader.readRuleCollection()) || createDefaultKpiRuleCollection();
    case TEAM_ROSTER_STORAGE_KEY:
      return (await persistence.teamsReader.readTeamRoster()) || createEmptyTeamRoster();
    case AUDIT_LOGS_STORAGE_KEY:
      return [];
    case IMPORT_LOGS_STORAGE_KEY:
      return [];
    case HQ_AGENCIES_STORAGE_KEY:
      return persistence.hqAgenciesReader.readBindings();
    case HQ_HISTORY_STORAGE_KEY:
      return persistence.hqAgenciesReader.readHistoryEntries();
    case KPI_ADJUSTMENTS_STORAGE_KEY:
      return persistence.adjustmentsReader.readAdjustmentRows();
    case KPI_ADJUSTMENT_SETTINGS_STORAGE_KEY:
      return persistence.adjustmentsStore.readSettings();
    case KPI_REPORT_SCHEDULE_STORAGE_KEY:
      return [];
    case COMMAND_CENTER_PINS_STORAGE_KEY: {
      const stored = await persistence.projections.readValue(COMMAND_CENTER_PINS_STORAGE_KEY);
      if (Array.isArray(stored)) {
        return stored.filter(isNonEmptyString);
      }
      if (stored && typeof stored === 'object' && Array.isArray((stored as { pins?: unknown }).pins)) {
        return (stored as { pins: unknown[] }).pins.filter(isNonEmptyString);
      }
      return [];
    }
    case UI_LAYOUT_STORAGE_KEY:
      return {};
    default:
      return undefined;
  }
}

export async function writeSharedSyncValue(
  persistence: RuntimePersistence,
  key: string,
  value: unknown,
): Promise<unknown | undefined> {
  switch (`${key}`.trim()) {
    case TEAM_ROSTER_STORAGE_KEY: {
      const nextRoster = normalizeTeamRoster(normalizeSharedSyncPayload(value));
      return persistence.teamsStore.writeRoster(nextRoster);
    }
    case COMMAND_CENTER_PINS_STORAGE_KEY: {
      const nextPins = Array.isArray(value)
        ? value.filter((entry) => typeof entry === 'string' && entry.trim())
        : [];
      await persistence.projections.writeValue(COMMAND_CENTER_PINS_STORAGE_KEY, {
        pins: nextPins,
      });
      return nextPins;
    }
    default:
      return undefined;
  }
}

export function normalizeSharedSyncPayload(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export function normalizeSharedSyncRawValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function countSharedSyncRows(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (value && typeof value === 'object') {
    if (Array.isArray((value as { rows?: unknown }).rows)) {
      return ((value as { rows: unknown[] }).rows || EMPTY_ARRAY).length;
    }
    if (value && typeof (value as { rows?: unknown }).rows === 'object') {
      return Object.keys(((value as { rows: Record<string, unknown> }).rows || EMPTY_OBJECT) as object).length;
    }
    return Object.keys(value as object).length;
  }
  return value === null || value === undefined ? 0 : 1;
}

async function listSanitizedAccounts(persistence: RuntimePersistence): Promise<AuthAccountView[]> {
  const accounts = await persistence.authStore.listAccounts();
  return accounts.map((entry) => sanitizeAuthAccount(entry)!).filter(Boolean);
}

function isNonEmptyString(entry: unknown): entry is string {
  return typeof entry === 'string' && entry.trim().length > 0;
}
