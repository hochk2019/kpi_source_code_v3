export const WAVE1_V4_MODULE_IDS = Object.freeze([
  'reporting',
  'teams',
  'mst-assignments',
  'hq-agencies',
]);

export function selectWave1V4Modules(moduleCatalog, moduleIds = WAVE1_V4_MODULE_IDS) {
  const requestedIds = Array.from(moduleIds);
  const selectedModules = moduleCatalog.filter((moduleItem) => requestedIds.includes(moduleItem.id));
  const selectedIds = new Set(selectedModules.map((moduleItem) => moduleItem.id));
  const missingModuleIds = requestedIds.filter((moduleId) => !selectedIds.has(moduleId));

  return {
    selectedModules,
    missingModuleIds,
  };
}

