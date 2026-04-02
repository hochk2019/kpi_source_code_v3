export const KPI_ADJUSTMENTS_KEY = "kpi_adjustments_v1";
export const KPI_ADJUSTMENT_SETTINGS_KEY = "kpi_adjustment_settings_v1";
export const KPI_ADJUSTMENT_STATUS_SET = new Set(["pending", "approved", "rejected"]);

export const KPI_ADJUSTMENT_HISTORY_LIMIT = 50;

export const KPI_ADJUSTMENT_AUTO_APPROVE_DEFAULT = Object.freeze({
  enabled: false,
  note: null,
  updatedAt: null,
  updatedBy: null,
});

export const KPI_ADJUSTMENT_BUILTIN_DEFAULTS = Object.freeze({
  tax_refund_customer: Object.freeze({
    extraUnitPoints: 0.5,
  }),
});
