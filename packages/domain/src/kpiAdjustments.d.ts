export interface AdjustmentCategoryEntry {
  label: string;
  type: 'quantity' | 'hybrid' | 'grade';
  defaultUnit?: number;
  defaultMode?: string;
  groupKey: string;
  groupLabel: string;
  color?: string;
  requiresLicenseCode?: boolean;
  licensePoints?: Record<string, number>;
  licenseOptions?: readonly { value: string; label: string }[];
  modes?: readonly {
    value: string;
    label: string;
    description: string;
    compute: string;
    defaultUnit: number;
  }[];
  grades?: readonly { value: number; label: string }[];
  extraPointConfig?: {
    quantityLabel: string;
    unitLabel: string;
    defaultUnit: number;
  };
}

export const KPI_ADJUSTMENT_CATEGORY_CONFIG: Readonly<Record<string, AdjustmentCategoryEntry>>;

export interface AdjustmentGroupMeta {
  key: string;
  label: string;
  order: number;
}

export interface AdjustmentTotalEntry {
  key: string;
  label: string;
  order: number;
  points: number;
  quantity: number;
}

export function normalizeAdjustmentCategoryKey(value: unknown): string;
export function resolveAdjustmentGroup(category: unknown): AdjustmentGroupMeta | null;
export function createAdjustmentTotals(): Record<string, AdjustmentTotalEntry>;
export function cloneAdjustmentTotals(
  source?: Record<string, AdjustmentTotalEntry>,
): Record<string, AdjustmentTotalEntry>;
export function addAdjustmentTotals(
  targetTotals: Record<string, AdjustmentTotalEntry>,
  category: unknown,
  points: number,
  quantity: number,
): AdjustmentTotalEntry | null;

export interface ToAdjustmentTotalsArrayOptions {
  sortBy?: 'order' | 'points';
  filterZero?: boolean;
}

export function toAdjustmentTotalsArray(
  totals: Record<string, AdjustmentTotalEntry> | null | undefined,
  options?: ToAdjustmentTotalsArrayOptions,
): AdjustmentTotalEntry[];

export function listRegisteredAdjustmentGroups(): AdjustmentGroupMeta[];
