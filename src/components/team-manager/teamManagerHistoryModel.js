import { t } from '@/lib/i18n.js';

export const MST_HISTORY_FIELD_LABELS = {
  person_import: t('mst.personImport'),
  person_export: t('mst.personExport'),
  effective_from: t('mst.effectiveFrom'),
};

export const formatTeamManagerHistoryTimestamp = (value) => {
  if (!value) return "";

  try {
    return new Date(value).toLocaleString("vi-VN", { hour12: false });
  } catch (error) {
    console.warn("formatTeamManagerHistoryTimestamp", error);
    return value;
  }
};
