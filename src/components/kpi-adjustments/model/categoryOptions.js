import { KPI_ADJUSTMENT_CATEGORY_CONFIG } from "@/lib/store.js";

export function resolveCategoryOptions() {
  return Object.entries(KPI_ADJUSTMENT_CATEGORY_CONFIG).map(([key, config]) => ({
    value: key,
    label: config.label,
    type: config.type,
  }));
}

export const CATEGORY_OPTIONS = resolveCategoryOptions();
