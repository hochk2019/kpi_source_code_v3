import { KPI_ADJUSTMENT_CATEGORY_CONFIG } from "../../../../shared/kpiAdjustments.js";

import {
  buildCalculationInfo,
  hasActiveOverrides,
  mergeLicensePoints,
  resolveCategoryDefaults,
} from "./calculationInfo.js";

export const GUIDANCE_GROUP_DESCRIPTIONS = Object.freeze({
  support: "Điểm cộng cho các tình huống hỗ trợ thông quan theo từng luồng.",
  license_support: "Áp dụng khi hỗ trợ khách hàng xin giấy phép chuyên ngành.",
  support_misc: "Ghi nhận các hỗ trợ ngoài quy chuẩn với chế độ linh hoạt.",
  correction: "Theo dõi việc sửa tờ khai để cộng/trừ điểm phù hợp.",
  cancel: "Quản lý việc huỷ tờ khai và mức điểm ảnh hưởng.",
  tax: "Điểm điều chỉnh liên quan tới các hồ sơ hoàn thuế.",
  teamwork: "Đánh giá tinh thần làm việc nhóm của nhân viên.",
  coworker_attitude: "Ghi nhận thái độ ứng xử với đồng nghiệp trong nội bộ.",
  customer_attitude: "Theo dõi thái độ với khách hàng và đối tác.",
});

export function buildGuidanceGroups(settings) {
  const groups = new Map();

  Object.entries(KPI_ADJUSTMENT_CATEGORY_CONFIG).forEach(([categoryKey, config], index) => {
    const groupKey = config.groupKey || categoryKey;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        label: config.groupLabel || config.label || "Khác",
        description: GUIDANCE_GROUP_DESCRIPTIONS[groupKey] || "",
        order: index,
        items: [],
      });
    }

    const groupEntry = groups.get(groupKey);
    const defaults = resolveCategoryDefaults(categoryKey, settings);
    const overrides = settings?.categories?.[categoryKey] || {};
    const licensePoints = mergeLicensePoints(config, overrides);
    const calcInfo = buildCalculationInfo(config, defaults);
    const hasOverride = hasActiveOverrides(overrides);
    const notes = [...calcInfo.notes];

    if (hasOverride) {
      notes.push("Đang áp dụng cấu hình tuỳ chỉnh của đơn vị.");
    }

    const extraUnit = config.extraPointConfig ? defaults.extraUnitPoints ?? 0 : null;
    groupEntry.items.push({
      key: categoryKey,
      label: config.label,
      defaultUnit: defaults.unitPoints,
      extraUnit,
      extraLabel: config.extraPointConfig?.unitLabel || "",
      calculation: calcInfo.description,
      modeLabel: calcInfo.badge,
      notes,
      licensePoints,
      gradeOptions: Array.isArray(config.grades) ? config.grades : [],
      hasOverride,
      order: index,
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      key: group.key,
      label: group.label,
      description: group.description,
      order: group.order,
      items: group.items
        .sort((a, b) => a.order - b.order)
        .map((item) => ({
          key: item.key,
          label: item.label,
          defaultUnit: item.defaultUnit,
          extraUnit: item.extraUnit,
          extraLabel: item.extraLabel,
          calculation: item.calculation,
          modeLabel: item.modeLabel,
          notes: item.notes,
          licensePoints: item.licensePoints,
          gradeOptions: item.gradeOptions,
          hasOverride: item.hasOverride,
        })),
    }))
    .sort((a, b) => a.order - b.order);
}
