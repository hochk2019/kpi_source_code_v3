import {
  KPI_ADJUSTMENT_AUTO_APPROVE_DEFAULT,
  KPI_ADJUSTMENT_BUILTIN_DEFAULTS,
  KPI_ADJUSTMENT_SETTINGS_KEY,
} from "./constants.js";
import {
  KPI_ADJUSTMENT_CATEGORY_CONFIG,
  normalizeAdjustmentCategoryKey,
} from "../../../shared/kpiAdjustments.js";

export function safeParse(json, fallback) {
  try {
    const value = JSON.parse(json);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function normalizeAutoApproveSettings(value, { normalizeStr }) {
  const source = value && typeof value === "object" ? value : {};
  const enabled = source.enabled === true;
  const updatedAt = typeof source.updatedAt === "string" ? source.updatedAt : null;
  const updatedByRaw = typeof source.updatedBy === "string" ? source.updatedBy : null;
  const updatedBy = updatedByRaw ? normalizeStr(updatedByRaw) || updatedByRaw.trim() || null : null;
  let note = null;

  if (Object.prototype.hasOwnProperty.call(source, "note")) {
    if (source.note === null) {
      note = null;
    } else if (typeof source.note === "string") {
      const normalized = normalizeStr(source.note);
      note = normalized || null;
    }
  }

  return {
    enabled,
    note,
    updatedAt,
    updatedBy,
  };
}

export function cloneAutoApproveSettings(value, helpers) {
  const normalized = normalizeAutoApproveSettings(value, helpers);
  return {
    enabled: normalized.enabled,
    note: normalized.note,
    updatedAt: normalized.updatedAt,
    updatedBy: normalized.updatedBy,
  };
}

export function createKpiAdjustmentSettingsStore({
  getItem,
  setItem,
  refreshSharedKeys,
  pushAuditLog,
  normalizeStr,
  roundAdjustmentPoint,
}) {
  const helperBag = { normalizeStr };

  function readAdjustmentSettings() {
    const raw = safeParse(getItem(KPI_ADJUSTMENT_SETTINGS_KEY), {});
    if (!raw || typeof raw !== "object") {
      return {
        categories: {},
        updatedAt: null,
        updatedBy: null,
        autoApprove: { ...KPI_ADJUSTMENT_AUTO_APPROVE_DEFAULT },
      };
    }

    const source = raw.categories && typeof raw.categories === "object" ? raw.categories : {};
    const categories = {};

    for (const [key, value] of Object.entries(source)) {
      const categoryKey = normalizeAdjustmentCategoryKey(key);
      if (!categoryKey || !KPI_ADJUSTMENT_CATEGORY_CONFIG[categoryKey]) {
        continue;
      }
      if (!value || typeof value !== "object") {
        continue;
      }
      categories[categoryKey] = { ...value };
    }

    for (const [key, defaults] of Object.entries(KPI_ADJUSTMENT_BUILTIN_DEFAULTS)) {
      if (!KPI_ADJUSTMENT_CATEGORY_CONFIG[key]) {
        continue;
      }
      const baseCategory = categories[key] ? { ...categories[key] } : {};
      let changed = false;

      for (const [field, defaultValue] of Object.entries(defaults)) {
        if (Object.prototype.hasOwnProperty.call(baseCategory, field)) {
          continue;
        }
        if (typeof defaultValue === "number") {
          baseCategory[field] = roundAdjustmentPoint(defaultValue);
        } else {
          baseCategory[field] = defaultValue;
        }
        changed = true;
      }

      if (changed || categories[key]) {
        categories[key] = baseCategory;
      }
    }

    return {
      categories,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
      updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : null,
      autoApprove: cloneAutoApproveSettings(raw.autoApprove, helperBag),
    };
  }

  function cloneAdjustmentSettings(settings) {
    const categories = {};
    if (settings?.categories && typeof settings.categories === "object") {
      for (const [key, value] of Object.entries(settings.categories)) {
        categories[key] = value && typeof value === "object" ? { ...value } : {};
      }
    }

    return {
      categories,
      updatedAt: settings?.updatedAt || null,
      updatedBy: settings?.updatedBy || null,
      autoApprove: cloneAutoApproveSettings(settings?.autoApprove, helperBag),
    };
  }

  async function writeAdjustmentSettings(settings) {
    const payload = cloneAdjustmentSettings(settings || {});
    await setItem(KPI_ADJUSTMENT_SETTINGS_KEY, JSON.stringify(payload));
    refreshSharedKeys([KPI_ADJUSTMENT_SETTINGS_KEY]);
    return payload;
  }

  function getKpiAdjustmentSettings() {
    return cloneAdjustmentSettings(readAdjustmentSettings());
  }

  async function saveKpiAdjustmentSettings(patch, { actor = "system", permissions = {} } = {}) {
    if (!permissions.adjustApprove) {
      throw new Error("Bạn không có quyền cấu hình điểm KPI bổ sung");
    }

    const base = readAdjustmentSettings();
    const categories = { ...base.categories };
    const patchCategories =
      patch && typeof patch === "object" && typeof patch.categories === "object" ? patch.categories : null;

    if (patchCategories) {
      for (const [rawKey, rawValue] of Object.entries(patchCategories)) {
        const key = normalizeAdjustmentCategoryKey(rawKey);
        if (!key || !KPI_ADJUSTMENT_CATEGORY_CONFIG[key]) {
          continue;
        }

        const value = rawValue && typeof rawValue === "object" ? rawValue : {};
        const current = categories[key] ? { ...categories[key] } : {};

        if (Object.prototype.hasOwnProperty.call(value, "defaultUnit")) {
          const num = Number.parseFloat(value.defaultUnit);
          if (Number.isFinite(num)) {
            current.defaultUnit = roundAdjustmentPoint(num);
          } else if (value.defaultUnit === null) {
            delete current.defaultUnit;
          }
        }

        if (Object.prototype.hasOwnProperty.call(value, "defaultMode")) {
          const modeCandidate = normalizeStr(value.defaultMode).toLowerCase();
          const allowedModes = new Set((KPI_ADJUSTMENT_CATEGORY_CONFIG[key].modes || []).map((item) => item.value));
          if (modeCandidate && allowedModes.has(modeCandidate)) {
            current.defaultMode = modeCandidate;
          } else if (!modeCandidate) {
            delete current.defaultMode;
          }
        }

        if (value.modeUnits && typeof value.modeUnits === "object") {
          const modeUnits = { ...(current.modeUnits || {}) };
          for (const [modeKey, rawUnit] of Object.entries(value.modeUnits)) {
            const normalizedMode = normalizeStr(modeKey).toLowerCase();
            if (!normalizedMode) continue;
            const allowedMode = (KPI_ADJUSTMENT_CATEGORY_CONFIG[key].modes || []).find(
              (item) => item.value === normalizedMode,
            );
            if (!allowedMode) continue;
            const num = Number.parseFloat(rawUnit);
            if (Number.isFinite(num)) {
              modeUnits[normalizedMode] = roundAdjustmentPoint(num);
            } else if (rawUnit === null) {
              delete modeUnits[normalizedMode];
            }
          }

          if (Object.keys(modeUnits).length) {
            current.modeUnits = modeUnits;
          } else {
            delete current.modeUnits;
          }
        }

        if (value.licensePoints && typeof value.licensePoints === "object") {
          const licensePoints = { ...(current.licensePoints || {}) };
          for (const [licenseKey, rawUnit] of Object.entries(value.licensePoints)) {
            const normalizedLicense = normalizeStr(licenseKey).toUpperCase();
            if (!normalizedLicense) continue;
            const num = Number.parseFloat(rawUnit);
            if (Number.isFinite(num)) {
              licensePoints[normalizedLicense] = roundAdjustmentPoint(num);
            } else if (rawUnit === null) {
              delete licensePoints[normalizedLicense];
            }
          }

          if (Object.keys(licensePoints).length) {
            current.licensePoints = licensePoints;
          } else {
            delete current.licensePoints;
          }
        }

        if (
          Object.prototype.hasOwnProperty.call(value, "extraUnitPoints") &&
          KPI_ADJUSTMENT_CATEGORY_CONFIG[key] &&
          KPI_ADJUSTMENT_CATEGORY_CONFIG[key].extraPointConfig
        ) {
          if (value.extraUnitPoints === null) {
            delete current.extraUnitPoints;
          } else {
            const num = Number.parseFloat(value.extraUnitPoints);
            if (Number.isFinite(num)) {
              current.extraUnitPoints = roundAdjustmentPoint(num);
            }
          }
        }

        if (Object.keys(current).length) {
          categories[key] = current;
        } else {
          delete categories[key];
        }
      }
    }

    let autoApprove = cloneAutoApproveSettings(base.autoApprove, helperBag);
    const autoPatch =
      patch && typeof patch === "object" && patch.autoApprove && typeof patch.autoApprove === "object"
        ? patch.autoApprove
        : null;

    if (autoPatch) {
      const nextAuto = { ...autoApprove };
      let changed = false;

      if (Object.prototype.hasOwnProperty.call(autoPatch, "enabled")) {
        const requestedEnabled = autoPatch.enabled === true;
        if (requestedEnabled !== nextAuto.enabled) {
          nextAuto.enabled = requestedEnabled;
          changed = true;
        }
      }

      if (Object.prototype.hasOwnProperty.call(autoPatch, "note")) {
        let noteValue = nextAuto.note ?? null;
        if (autoPatch.note === null) {
          noteValue = null;
        } else if (typeof autoPatch.note === "string") {
          const normalizedNote = normalizeStr(autoPatch.note);
          noteValue = normalizedNote || null;
        }
        if (noteValue !== (nextAuto.note ?? null)) {
          nextAuto.note = noteValue;
          changed = true;
        }
      }

      if (changed) {
        const stamp = new Date().toISOString();
        nextAuto.updatedAt = stamp;
        nextAuto.updatedBy = actor;
        autoApprove = nextAuto;
      }
    }

    const timestamp = new Date().toISOString();
    const next = {
      categories,
      autoApprove,
      updatedAt: timestamp,
      updatedBy: actor,
    };

    await writeAdjustmentSettings(next);

    if (typeof pushAuditLog === "function") {
      pushAuditLog({
        actor,
        action: "kpi.adjustment.defaults",
        detail: "Cập nhật cấu hình điểm KPI bổ sung",
        meta: {
          categories: Object.keys(categories),
          autoApprove: autoApprove.enabled,
        },
      });
    }

    return cloneAdjustmentSettings(next);
  }

  return {
    readAdjustmentSettings,
    cloneAdjustmentSettings,
    writeAdjustmentSettings,
    getKpiAdjustmentSettings,
    saveKpiAdjustmentSettings,
  };
}
