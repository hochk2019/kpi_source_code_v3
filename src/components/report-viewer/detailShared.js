export const DETAIL_PAGE_SIZE_OPTIONS = [20, 50, 100, 200, 300];

export const DEFAULT_DETAIL_PAGE_SIZE = 20;

export function getSegmentedButtonClass(isActive) {
  return [
    "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
    isActive
      ? "bg-[color:var(--ds-surface-primary)] text-[color:var(--ds-text-primary)] shadow-sm"
      : "border border-[color:var(--ds-border-subtle)] bg-white text-[color:var(--ds-text-secondary)] hover:text-[color:var(--ds-text-primary)]",
  ].join(" ");
}

export function sortStatsCollection(list = [], sortKey = "kpi", getLabel = (item) => item?.name || "") {
  const metricKeys = ["kpi", "decls", "licenses"];
  const key = metricKeys.includes(sortKey) ? sortKey : "kpi";
  const fallbackKeys = metricKeys.filter((item) => item !== key);
  return [...list].sort((a = {}, b = {}) => {
    const statsA = a.stats || {};
    const statsB = b.stats || {};
    const primaryDiff = Number(statsB[key] || 0) - Number(statsA[key] || 0);
    if (primaryDiff !== 0) return primaryDiff;
    for (const fallback of fallbackKeys) {
      const diff = Number(statsB[fallback] || 0) - Number(statsA[fallback] || 0);
      if (diff !== 0) return diff;
    }
    const labelA = getLabel(a) || "";
    const labelB = getLabel(b) || "";
    return labelA.localeCompare(labelB, "vi", { sensitivity: "base" });
  });
}
