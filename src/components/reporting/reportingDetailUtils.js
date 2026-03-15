export function formatInt(value) {
  const num = Number(value || 0);
  return num.toLocaleString("vi-VN");
}

export function formatDecimal(value) {
  const num = Number(value || 0);
  return num.toLocaleString("vi-VN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatOptionalDecimal(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || Math.abs(num) < 0.0001) {
    return "—";
  }
  return formatDecimal(num);
}

export function formatOptionalInt(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) {
    return "—";
  }
  return formatInt(num);
}

export const METRIC_SORT_OPTIONS = [
  { value: "kpi", label: "Điểm KPI" },
  { value: "decls", label: "Số tờ khai" },
  { value: "licenses", label: "Số giấy phép" },
];

const METRIC_SORT_KEYS = METRIC_SORT_OPTIONS.map((option) => option.value);

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

export function sortStatsCollection(
  list = [],
  sortKey = "kpi",
  getLabel = (item) => item?.name || "",
) {
  const key = METRIC_SORT_KEYS.includes(sortKey) ? sortKey : "kpi";
  const fallbackKeys = METRIC_SORT_KEYS.filter((item) => item !== key);

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
