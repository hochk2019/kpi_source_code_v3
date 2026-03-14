import type { AuthPermissionMap } from '../auth/authTypes.js';

export type KpiAdjustmentStatus = 'pending' | 'approved' | 'rejected';

export type KpiAdjustmentStoredRecord = Record<string, unknown> & {
  id: string;
  category: string;
  month: string;
  status: KpiAdjustmentStatus;
  staffName: string;
  teamName: string;
  quantity: number;
  unitPoints: number;
  totalPoints: number;
  references: string[];
  note: string;
  createdAt: string;
  updatedAt: string;
  history: unknown[];
  mode?: string;
  licenseCode?: string;
  companyName?: string;
  taxCode?: string;
  extraQuantity?: number;
  extraUnitPoints?: number;
  createdBy?: string;
  updatedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
};

export type KpiAdjustmentSettingsDocument = {
  categories: Record<string, Record<string, unknown>>;
  updatedAt: string | null;
  updatedBy: string | null;
  autoApprove: {
    enabled: boolean;
    note: string | null;
    updatedAt: string | null;
    updatedBy: string | null;
  };
};

export type KpiAdjustmentActor = {
  username: string;
  role: string;
  name: string;
  permissions: AuthPermissionMap;
  memberId: string | null;
  memberName: string | null;
  teamId: string | null;
  teamName: string | null;
};

export interface KpiAdjustmentsStore {
  readAdjustmentById(id: string): Promise<KpiAdjustmentStoredRecord | null>;
  createAdjustment(record: KpiAdjustmentStoredRecord): Promise<KpiAdjustmentStoredRecord>;
  updateAdjustment(record: KpiAdjustmentStoredRecord): Promise<KpiAdjustmentStoredRecord>;
  readSettings(): Promise<KpiAdjustmentSettingsDocument>;
  writeSettings(settings: KpiAdjustmentSettingsDocument): Promise<KpiAdjustmentSettingsDocument>;
}

export function createDefaultAdjustmentSettings(): KpiAdjustmentSettingsDocument {
  return {
    categories: {},
    updatedAt: null,
    updatedBy: null,
    autoApprove: {
      enabled: false,
      note: null,
      updatedAt: null,
      updatedBy: null,
    },
  };
}

export function cloneAdjustmentSettings(
  settings: KpiAdjustmentSettingsDocument | null | undefined,
): KpiAdjustmentSettingsDocument {
  return normalizeAdjustmentSettings(settings);
}

export function normalizeAdjustmentSettings(value: unknown): KpiAdjustmentSettingsDocument {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const categories =
    source.categories && typeof source.categories === 'object' && !Array.isArray(source.categories)
      ? normalizeCategorySettings(source.categories as Record<string, unknown>)
      : {};
  const autoApproveSource =
    source.autoApprove && typeof source.autoApprove === 'object' && !Array.isArray(source.autoApprove)
      ? (source.autoApprove as Record<string, unknown>)
      : {};

  return {
    categories,
    updatedAt: normalizeNullableText(source.updatedAt),
    updatedBy: normalizeNullableText(source.updatedBy),
    autoApprove: {
      enabled: autoApproveSource.enabled === true,
      note: normalizeNullableText(autoApproveSource.note),
      updatedAt: normalizeNullableText(autoApproveSource.updatedAt),
      updatedBy: normalizeNullableText(autoApproveSource.updatedBy),
    },
  };
}

function normalizeCategorySettings(
  input: Record<string, unknown>,
): Record<string, Record<string, unknown>> {
  const normalized: Record<string, Record<string, unknown>> = {};

  for (const [key, value] of Object.entries(input)) {
    const categoryKey = `${key ?? ''}`.trim();
    if (!categoryKey || !value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }

    normalized[categoryKey] = clonePlainObject(value as Record<string, unknown>);
  }

  return normalized;
}

function clonePlainObject(input: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (!`${key ?? ''}`.trim()) {
      continue;
    }

    if (Array.isArray(value)) {
      next[key] = value.slice();
      continue;
    }

    if (value && typeof value === 'object') {
      next[key] = clonePlainObject(value as Record<string, unknown>);
      continue;
    }

    next[key] = value;
  }

  return next;
}

function normalizeNullableText(value: unknown): string | null {
  const normalized = `${value ?? ''}`.trim();
  return normalized ? normalized : null;
}
