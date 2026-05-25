export interface StorageRouteRuntimeOptions {
  getValue: (key: string) => string | null | undefined;
  upsertValue: (key: string, value: string, options?: { actor?: string; source?: string }) => void;
  deleteValue: (key: string, options?: { actor?: string; source?: string }) => void;
  safeParse: (value: unknown, fallback: unknown) => unknown;
  evaluateDeclarationAlerts: (options?: { actor?: string; reason?: string }) => void;
  refreshEcusSchedule: () => void;
  applyCoCodeConfig: (config: unknown) => void;
  getCoCodeConfig: () => unknown;
  refreshCoDiscrepancySchedule: () => void;
  defaultCoCodeConfig: unknown;
}

export interface StorageRouteRuntime {
  putStorageValue(
    key: string,
    value: unknown,
    options?: { actor?: string; source?: string },
  ): { ok: true };
  patchDeclarationRows(
    updates: unknown[],
    options?: { actor?: string; source?: string },
  ): { ok: boolean; invalidCurrentData?: boolean; updated?: number; totalStored?: number };
  deleteStorageValue(
    key: string,
    options?: { actor?: string; source?: string },
  ): { ok: true };
}

export function createStorageRouteRuntime(options: StorageRouteRuntimeOptions): StorageRouteRuntime;
