export default function buildDataImporterSessionControllerResult({
  identity,
  rowHistory,
  access,
  columnConfig,
  filters,
  preview,
  listPreferences,
  actionGuards,
  presets,
  license,
  sync,
  queryFilters,
}) {
  return {
    ...identity,
    ...rowHistory,
    ...access,
    ...columnConfig,
    ...filters,
    ...preview,
    ...listPreferences,
    ...actionGuards,
    ...presets,
    ...license,
    ...sync,
    ...queryFilters,
  };
}
