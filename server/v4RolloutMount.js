export const WAVE1_V4_MODULE_IDS = Object.freeze([
  'reporting',
  'teams',
  'mst-assignments',
  'hq-agencies',
]);

export const WAVE2_V4_MODULE_IDS = Object.freeze([
  'kpi-rules',
  'kpi-adjustments',
  'alerts',
  'backup',
  'data-health',
  'duplicate-policy',
  'feedback-training',
  'filter-presets',
]);

export const LEGACY_V4_MODULE_IDS = Object.freeze([
  ...WAVE1_V4_MODULE_IDS,
  ...WAVE2_V4_MODULE_IDS,
]);

export function selectV4Modules(moduleCatalog, moduleIds) {
  const requestedIds = Array.from(moduleIds);
  const selectedModules = moduleCatalog.filter((moduleItem) => requestedIds.includes(moduleItem.id));
  const selectedIds = new Set(selectedModules.map((moduleItem) => moduleItem.id));
  const missingModuleIds = requestedIds.filter((moduleId) => !selectedIds.has(moduleId));

  return {
    selectedModules,
    missingModuleIds,
  };
}

export function selectWave1V4Modules(moduleCatalog, moduleIds = WAVE1_V4_MODULE_IDS) {
  return selectV4Modules(moduleCatalog, moduleIds);
}

export function selectLegacyV4Modules(moduleCatalog, moduleIds = LEGACY_V4_MODULE_IDS) {
  return selectV4Modules(moduleCatalog, moduleIds);
}
