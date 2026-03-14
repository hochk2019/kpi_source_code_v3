export function buildDataImporterCoFilterSummary({
  rawRows = [],
  coFilterMode = "all",
  coThreshold = 0,
  getCoLineCount = () => 0,
}) {
  const coFilterActive = coFilterMode === "has" || (coFilterMode === "min" && coThreshold > 0);

  const coFilterMatches = coFilterActive
    ? rawRows.reduce((count, row) => {
        const lines = getCoLineCount(row);
        if (coFilterMode === "has") {
          return count + (lines > 0 ? 1 : 0);
        }

        if (coFilterMode === "min") {
          return count + (lines >= coThreshold ? 1 : 0);
        }

        return count;
      }, 0)
    : rawRows.length;

  return {
    coFilterActive,
    coFilterMatches,
  };
}
