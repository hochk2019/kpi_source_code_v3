import { KPI_ADJUSTMENT_CATEGORY_CONFIG } from "../../../../shared/kpiAdjustments.js";

import { normalizeUnitValue } from "./calculationInfo.js";

export function buildSettingsDraft(settings) {
  const draft = {};

  for (const [category, config] of Object.entries(KPI_ADJUSTMENT_CATEGORY_CONFIG)) {
    const overrides = settings?.categories?.[category] || {};

    if (config.type === "hybrid") {
      const modes = Array.isArray(config.modes) ? config.modes : [];
      const modeUnits = {};
      for (const mode of modes) {
        const key = mode.value;
        const overrideUnit =
          overrides.modeUnits && typeof overrides.modeUnits === "object"
            ? overrides.modeUnits[key]
            : undefined;
        const unitValue =
          normalizeUnitValue(overrideUnit) ??
          normalizeUnitValue(mode.defaultUnit) ??
          normalizeUnitValue(overrides.defaultUnit) ??
          normalizeUnitValue(config.defaultUnit) ??
          "";
        modeUnits[key] = unitValue === undefined ? "" : unitValue.toString();
      }

      draft[category] = {
        defaultMode: overrides.defaultMode || config.defaultMode || (modes[0]?.value ?? ""),
        defaultUnit:
          normalizeUnitValue(overrides.defaultUnit) ?? normalizeUnitValue(config.defaultUnit) ?? "",
        modeUnits,
      };

      continue;
    }

    if (config.requiresLicenseCode) {
      const licenseCodes = new Set();
      if (Array.isArray(config.licenseOptions)) {
        for (const option of config.licenseOptions) {
          if (option?.value) {
            licenseCodes.add(option.value.toString().trim().toUpperCase());
          }
        }
      }
      if (config.licensePoints && typeof config.licensePoints === "object") {
        for (const code of Object.keys(config.licensePoints)) {
          if (code) {
            licenseCodes.add(code.toString().trim().toUpperCase());
          }
        }
      }
      if (overrides.licensePoints && typeof overrides.licensePoints === "object") {
        for (const code of Object.keys(overrides.licensePoints)) {
          if (code) {
            licenseCodes.add(code.toString().trim().toUpperCase());
          }
        }
      }

      const licensePoints = {};
      for (const code of Array.from(licenseCodes).filter(Boolean)) {
        const overrideUnit =
          overrides.licensePoints && typeof overrides.licensePoints === "object"
            ? overrides.licensePoints[code]
            : undefined;
        const configUnit =
          config.licensePoints && typeof config.licensePoints === "object"
            ? config.licensePoints[code]
            : undefined;
        const unitValue =
          normalizeUnitValue(overrideUnit) ??
          normalizeUnitValue(configUnit) ??
          normalizeUnitValue(overrides.defaultUnit) ??
          normalizeUnitValue(config.defaultUnit) ??
          "";
        licensePoints[code] = unitValue === undefined ? "" : unitValue.toString();
      }

      draft[category] = {
        defaultUnit:
          normalizeUnitValue(overrides.defaultUnit) ?? normalizeUnitValue(config.defaultUnit) ?? "",
        licensePoints,
      };

      continue;
    }

    draft[category] = {
      defaultUnit:
        normalizeUnitValue(overrides.defaultUnit) ?? normalizeUnitValue(config.defaultUnit) ?? "",
    };

    if (config.extraPointConfig) {
      draft[category].extraUnitPoints =
        normalizeUnitValue(overrides.extraUnitPoints) ??
        normalizeUnitValue(config.extraPointConfig.defaultUnit) ??
        "";
    }
  }

  return draft;
}
