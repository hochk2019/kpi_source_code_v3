import {
  KPI_ADJUSTMENT_CATEGORY_CONFIG,
  normalizeStr,
  roundAdjustmentPoint,
} from "@/lib/store.js";

export function normalizeUnitValue(value) {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? roundAdjustmentPoint(num) : undefined;
}

export function resolveCategoryDefaults(category, settings) {
  const config = KPI_ADJUSTMENT_CATEGORY_CONFIG[category] || {};
  const overrides = settings?.categories?.[category] || {};
  const extraConfig = config.extraPointConfig;
  const extraOverrideUnit = normalizeUnitValue(overrides.extraUnitPoints);
  const extraDefaultUnit =
    extraConfig && extraConfig.defaultUnit !== undefined
      ? normalizeUnitValue(extraConfig.defaultUnit)
      : undefined;
  const resolvedExtraUnit = extraConfig ? extraOverrideUnit ?? extraDefaultUnit ?? 0 : 0;

  if (config.type === "grade") {
    const allowed = Array.isArray(config.grades) ? config.grades : [];
    const overrideValue = normalizeUnitValue(overrides.defaultUnit);
    const defaultGrade =
      allowed.find((item) => Number(item.value) === overrideValue) ||
      allowed.find((item) => item.value === 0) ||
      allowed[0] || { value: 0 };
    return {
      quantity: 1,
      unitPoints: defaultGrade.value,
      gradeValue: defaultGrade.value,
      mode: "",
      licenseCode: "",
      extraQuantity: 0,
      extraUnitPoints: resolvedExtraUnit,
    };
  }

  if (config.type === "hybrid") {
    const modes = Array.isArray(config.modes) ? config.modes : [];
    const allowedModes = modes.map((item) => item.value);
    let mode = normalizeStr(overrides.defaultMode || config.defaultMode || allowedModes[0] || "").toLowerCase();
    if (!allowedModes.includes(mode) && allowedModes.length) {
      mode = allowedModes[0];
    }
    const modeConfig = modes.find((item) => item.value === mode) || modes[0] || {};
    const overrideModeUnits =
      overrides.modeUnits && typeof overrides.modeUnits === "object" ? overrides.modeUnits : {};
    const overrideUnit = normalizeUnitValue(overrideModeUnits[mode]);
    const fallbackUnit =
      normalizeUnitValue(modeConfig.defaultUnit) ??
      normalizeUnitValue(overrides.defaultUnit) ??
      normalizeUnitValue(config.defaultUnit) ??
      0;
    const unitPoints = overrideUnit ?? fallbackUnit ?? 0;
    const isFixed = modeConfig?.compute === "fixed";
    return {
      quantity: isFixed ? 1 : 1,
      unitPoints,
      gradeValue: null,
      mode,
      licenseCode: "",
      extraQuantity: 0,
      extraUnitPoints: resolvedExtraUnit,
    };
  }

  if (config.requiresLicenseCode) {
    const licenseOptions = Array.isArray(config.licenseOptions) ? config.licenseOptions : [];
    const mergedPoints = {};
    if (config.licensePoints && typeof config.licensePoints === "object") {
      for (const [code, value] of Object.entries(config.licensePoints)) {
        if (!code) continue;
        const normalized = code.toString().trim().toUpperCase();
        const num = normalizeUnitValue(value);
        if (normalized && num !== undefined) {
          mergedPoints[normalized] = num;
        }
      }
    }
    if (overrides.licensePoints && typeof overrides.licensePoints === "object") {
      for (const [code, value] of Object.entries(overrides.licensePoints)) {
        if (!code) continue;
        const normalized = code.toString().trim().toUpperCase();
        const num = normalizeUnitValue(value);
        if (normalized && num !== undefined) {
          mergedPoints[normalized] = num;
        }
      }
    }
    const defaultLicense = normalizeStr(licenseOptions[0]?.value || "").toUpperCase();
    const licenseCode = defaultLicense || "";
    const fallbackUnit =
      normalizeUnitValue(overrides.defaultUnit) ?? normalizeUnitValue(config.defaultUnit) ?? 0;
    const unitPoints =
      licenseCode && mergedPoints[licenseCode] !== undefined
        ? mergedPoints[licenseCode]
        : fallbackUnit;
    return {
      quantity: 1,
      unitPoints,
      gradeValue: null,
      mode: "",
      licenseCode,
      extraQuantity: 0,
      extraUnitPoints: resolvedExtraUnit,
    };
  }

  const unitPoints =
    normalizeUnitValue(overrides.defaultUnit) ?? normalizeUnitValue(config.defaultUnit) ?? 0;
  return {
    quantity: 1,
    unitPoints,
    gradeValue: null,
    mode: "",
    licenseCode: "",
    extraQuantity: 0,
    extraUnitPoints: resolvedExtraUnit,
  };
}

export function resolveLicenseUnit(category, licenseCode, settings) {
  const config = KPI_ADJUSTMENT_CATEGORY_CONFIG[category] || {};
  if (!config.requiresLicenseCode) {
    return normalizeUnitValue(config.defaultUnit) ?? 0;
  }

  const overrides = settings?.categories?.[category] || {};
  const mergedPoints = {};
  if (config.licensePoints && typeof config.licensePoints === "object") {
    for (const [code, value] of Object.entries(config.licensePoints)) {
      if (!code) continue;
      const normalized = code.toString().trim().toUpperCase();
      const num = normalizeUnitValue(value);
      if (normalized && num !== undefined) {
        mergedPoints[normalized] = num;
      }
    }
  }
  if (overrides.licensePoints && typeof overrides.licensePoints === "object") {
    for (const [code, value] of Object.entries(overrides.licensePoints)) {
      if (!code) continue;
      const normalized = code.toString().trim().toUpperCase();
      const num = normalizeUnitValue(value);
      if (normalized && num !== undefined) {
        mergedPoints[normalized] = num;
      }
    }
  }

  const normalizedCode = normalizeStr(licenseCode || "").toUpperCase();
  if (normalizedCode && mergedPoints[normalizedCode] !== undefined) {
    return mergedPoints[normalizedCode];
  }

  return normalizeUnitValue(overrides.defaultUnit) ?? normalizeUnitValue(config.defaultUnit) ?? 0;
}

export function hasActiveOverrides(overrides) {
  if (!overrides || typeof overrides !== "object") {
    return false;
  }

  for (const value of Object.values(overrides)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === "object") {
      if (hasActiveOverrides(value)) {
        return true;
      }
      continue;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return true;
    }
    if (normalizeStr(value)) {
      return true;
    }
  }

  return false;
}

export function mergeLicensePoints(config, overrides) {
  if (!config?.requiresLicenseCode) {
    return [];
  }

  const merged = new Map();
  const append = (source) => {
    if (!source || typeof source !== "object") {
      return;
    }
    for (const [code, value] of Object.entries(source)) {
      const normalized = normalizeStr(code).toUpperCase();
      const unit = normalizeUnitValue(value);
      if (normalized && unit !== undefined) {
        merged.set(normalized, unit);
      }
    }
  };

  append(config.licensePoints);
  append(overrides?.licensePoints);

  return Array.from(merged.entries())
    .map(([code, points]) => ({ code, points }))
    .sort((a, b) => a.code.localeCompare(b.code, "vi", { sensitivity: "base" }));
}

export function buildCalculationInfo(config, defaults) {
  const notes = [];
  let badge = "";
  let description = "Điểm = Số lượng x Điểm mỗi đơn vị.";

  if (config?.type === "hybrid") {
    const modes = Array.isArray(config.modes) ? config.modes : [];
    const modeKey = normalizeStr(defaults?.mode || config.defaultMode || "").toLowerCase();
    const modeConfig =
      modes.find((item) => normalizeStr(item.value).toLowerCase() === modeKey) || modes[0] || {};
    const label = normalizeStr(modeConfig.label);
    badge = label ? `Chế độ: ${label}` : "Chế độ linh hoạt";
    if (modeConfig.description) {
      description = modeConfig.description;
    } else if (modeConfig.compute === "fixed") {
      description = "Áp dụng điểm cố định cho mỗi lần ghi nhận.";
    } else {
      description = "Điểm = Hệ số x Số lượng theo chế độ linh hoạt.";
    }
  } else if (config?.type === "grade") {
    badge = "Thang điểm";
    description = "Chọn mức đánh giá phù hợp để cộng/trừ điểm tương ứng.";
  } else if (config?.requiresLicenseCode) {
    badge = "Theo mã giấy phép";
    description = "Điền mã giấy phép hợp lệ, hệ thống áp dụng điểm tương ứng nhân với số lượng.";
  }

  if (config?.extraPointConfig) {
    const quantityLabel = config.extraPointConfig.quantityLabel || "số lượng bổ sung";
    notes.push(`Có thể nhập ${quantityLabel} để cộng thêm điểm.`);
  }

  if (
    typeof defaults?.unitPoints === "number" &&
    Number.isFinite(defaults.unitPoints) &&
    defaults.unitPoints < 0
  ) {
    notes.push("Giá trị âm thể hiện mức trừ điểm KPI.");
  }

  return { badge, description, notes };
}
