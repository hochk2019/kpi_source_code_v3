export const WAVE1_V4_MODULE_IDS: readonly string[];
export const WAVE2_V4_MODULE_IDS: readonly string[];
export const LEGACY_V4_MODULE_IDS: readonly string[];

export interface V4ModuleSelection {
  selectedModules: Record<string, unknown>[];
  missingModuleIds: string[];
}

export function selectV4Modules(
  moduleCatalog: { id: string; [key: string]: unknown }[],
  moduleIds: Iterable<string>,
): V4ModuleSelection;

export function selectWave1V4Modules(
  moduleCatalog: { id: string; [key: string]: unknown }[],
  moduleIds?: Iterable<string>,
): V4ModuleSelection;

export function selectLegacyV4Modules(
  moduleCatalog: { id: string; [key: string]: unknown }[],
  moduleIds?: Iterable<string>,
): V4ModuleSelection;
