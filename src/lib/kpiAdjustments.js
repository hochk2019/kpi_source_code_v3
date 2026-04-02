import {
  KPI_ADJUSTMENT_CATEGORY_CONFIG,
  normalizeAdjustmentCategoryKey,
} from "../../shared/kpiAdjustments.js";

export const KPI_ADJUSTMENTS_KEY = "kpi_adjustments_v1";
export const KPI_ADJUSTMENT_SETTINGS_KEY = "kpi_adjustment_settings_v1";
export const KPI_ADJUSTMENT_STATUS_SET = new Set(["pending", "approved", "rejected"]);

const KPI_ADJUSTMENT_HISTORY_LIMIT = 50;
const KPI_ADJUSTMENT_AUTO_APPROVE_DEFAULT = Object.freeze({
  enabled: false,
  note: null,
  updatedAt: null,
  updatedBy: null,
});
const KPI_ADJUSTMENT_BUILTIN_DEFAULTS = Object.freeze({
  tax_refund_customer: Object.freeze({
    extraUnitPoints: 0.5,
  }),
});

function safeParse(json, fallback) {
  try {
    const value = JSON.parse(json);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizeAutoApproveSettings(value, { normalizeStr }) {
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

function cloneAutoApproveSettings(value, helpers) {
  const normalized = normalizeAutoApproveSettings(value, helpers);
  return {
    enabled: normalized.enabled,
    note: normalized.note,
    updatedAt: normalized.updatedAt,
    updatedBy: normalized.updatedBy,
  };
}

export function createKpiAdjustmentStore({
  getItem = () => null,
  setItem = () => {},
  refreshSharedKeys = () => {},
  pushAuditLog = null,
  normalizeStr = (value) => String(value ?? "").trim(),
  normalizeMST = (value) => String(value ?? "").replace(/\D/g, ""),
  roundAdjustmentPoint = (value) => value,
} = {}) {
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

  function writeAdjustmentSettings(settings) {
    const payload = cloneAdjustmentSettings(settings || {});
    setItem(KPI_ADJUSTMENT_SETTINGS_KEY, JSON.stringify(payload));
    refreshSharedKeys([KPI_ADJUSTMENT_SETTINGS_KEY]);
    return payload;
  }

  function normalizeAdjustmentCategory(value) {
    const key = normalizeAdjustmentCategoryKey(value);
    if (key && KPI_ADJUSTMENT_CATEGORY_CONFIG[key]) {
      return key;
    }
    return "";
  }

  function normalizeAdjustmentMonth(value) {
    if (!value) return "";
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, "0");
      return `${year}-${month}`;
    }

    const str = normalizeStr(value);
    if (!str) return "";

    const isoMonth = str.match(/^(\d{4})-(\d{2})$/);
    if (isoMonth) {
      const monthNum = Number.parseInt(isoMonth[2], 10);
      if (monthNum >= 1 && monthNum <= 12) {
        return `${isoMonth[1]}-${isoMonth[2]}`;
      }
    }

    const isoDate = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDate) {
      const monthNum = Number.parseInt(isoDate[2], 10);
      if (monthNum >= 1 && monthNum <= 12) {
        return `${isoDate[1]}-${isoDate[2]}`;
      }
    }

    const compact = str.match(/^(\d{4})(\d{2})$/);
    if (compact) {
      const monthNum = Number.parseInt(compact[2], 10);
      if (monthNum >= 1 && monthNum <= 12) {
        return `${compact[1]}-${compact[2]}`;
      }
    }

    const slash = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (slash) {
      let [, first, second, yearRaw] = slash;
      let year = Number.parseInt(yearRaw, 10);
      if (year < 100) {
        year += year < 50 ? 2000 : 1900;
      }
      const a = Number.parseInt(first, 10);
      const b = Number.parseInt(second, 10);
      const month = a > 12 && b <= 12 ? b : a;
      if (month >= 1 && month <= 12) {
        return `${year}-${String(month).padStart(2, "0")}`;
      }
    }

    return "";
  }

  function normalizeAdjustmentReferences(value) {
    if (!value) return [];
    const list = Array.isArray(value) ? value : [value];
    const normalized = [];
    const seen = new Set();

    for (const item of list) {
      const text = normalizeStr(item);
      if (!text || seen.has(text)) continue;
      seen.add(text);
      normalized.push(text);
    }

    return normalized;
  }

  function normalizeAdjustmentHistoryEntry(entry) {
    if (!entry || typeof entry !== "object") return null;
    const ts =
      entry.ts && !Number.isNaN(new Date(entry.ts).getTime())
        ? new Date(entry.ts).toISOString()
        : new Date().toISOString();
    const actor = normalizeStr(entry.actor) || "system";
    const action = normalizeStr(entry.action) || "update";
    const detail = normalizeStr(entry.detail);
    const changes = entry.changes && typeof entry.changes === "object" ? entry.changes : null;

    return {
      id: entry.id || `adj-hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts,
      actor,
      action,
      detail,
      changes,
    };
  }

  function clampHistory(list) {
    const entries = Array.isArray(list) ? list.map(normalizeAdjustmentHistoryEntry).filter(Boolean) : [];
    return entries.slice(-KPI_ADJUSTMENT_HISTORY_LIMIT);
  }

  function computeAdjustmentTotal({ category, unitPoints, quantity, mode, extraQuantity, extraUnitPoints }) {
    const config = KPI_ADJUSTMENT_CATEGORY_CONFIG[category] || { type: "quantity" };
    const unit = Number.isFinite(unitPoints) ? unitPoints : 0;
    let baseTotal = 0;

    if (config.type === "fixed" || config.type === "grade") {
      baseTotal = roundAdjustmentPoint(unit);
    } else if (config.type === "hybrid") {
      const normalizedMode = normalizeStr(mode).toLowerCase();
      const targetMode = (config.modes || []).find((item) => item.value === normalizedMode) || config.modes?.[0];
      if (targetMode?.compute === "fixed") {
        baseTotal = roundAdjustmentPoint(unit);
      } else {
        const qtyHybrid = Number.isFinite(quantity) ? quantity : 0;
        baseTotal = roundAdjustmentPoint(unit * qtyHybrid);
      }
    } else {
      const qty = Number.isFinite(quantity) ? quantity : 0;
      baseTotal = roundAdjustmentPoint(unit * qty);
    }

    let bonusTotal = 0;
    const extraConfig = config.extraPointConfig;
    if (extraConfig) {
      const fallbackExtraUnit = Number.isFinite(extraConfig.defaultUnit)
        ? roundAdjustmentPoint(Number(extraConfig.defaultUnit))
        : 0;
      const resolvedExtraUnit = Number.isFinite(extraUnitPoints) ? extraUnitPoints : fallbackExtraUnit;
      const resolvedExtraQty = Number.isFinite(extraQuantity) ? extraQuantity : 0;
      bonusTotal = roundAdjustmentPoint(resolvedExtraUnit * resolvedExtraQty);
    }

    return roundAdjustmentPoint(baseTotal + bonusTotal);
  }

  function normalizeAdjustmentInput(input, { now, actor, current, permissions = {} } = {}) {
    if (!input || typeof input !== "object") {
      return null;
    }

    const category = normalizeAdjustmentCategory(input.category || current?.category);
    if (!category) {
      return null;
    }

    const config = KPI_ADJUSTMENT_CATEGORY_CONFIG[category];
    const settings = readAdjustmentSettings();
    const override = settings.categories?.[category] || {};
    const allowManualOverride = permissions?.adjustOverridePoints === true || category === "support_misc";
    const staffName = normalizeStr(input.staffName ?? input.staff ?? current?.staffName ?? "");
    const teamName = normalizeStr(input.teamName ?? input.team ?? current?.teamName ?? "");
    const month = normalizeAdjustmentMonth(input.month ?? input.period ?? current?.month ?? "");
    if (!month) {
      return null;
    }

    const companyName = normalizeStr(input.companyName ?? input.company ?? current?.companyName ?? "");
    const taxCode = normalizeMST(input.taxCode ?? input.mst ?? current?.taxCode ?? "");
    const gradeSource = input.grade ?? input.value ?? input.unitPoints ?? input.points;
    const gradeValue =
      gradeSource !== undefined && gradeSource !== null && gradeSource !== ""
        ? Number.parseFloat(gradeSource)
        : Number.NaN;
    const allowedModes = Array.isArray(config?.modes)
      ? config.modes.map((item) => item.value).filter(Boolean)
      : [];
    let mode = normalizeStr(
      input.mode ?? input.adjustMode ?? current?.mode ?? override.defaultMode ?? config?.defaultMode ?? "",
    ).toLowerCase();

    if (allowedModes.length) {
      if (!allowedModes.includes(mode)) {
        const fallbackMode = [override.defaultMode, config?.defaultMode, allowedModes[0]]
          .map((candidate) => {
            const normalized = normalizeStr(candidate).toLowerCase();
            return allowedModes.includes(normalized) ? normalized : null;
          })
          .find(Boolean);
        mode = fallbackMode || allowedModes[0];
      }
    } else {
      mode = "";
    }

    let licenseCode = "";
    if (config?.requiresLicenseCode) {
      licenseCode = normalizeStr(input.licenseCode ?? input.license ?? current?.licenseCode ?? "");
      if (licenseCode) {
        licenseCode = licenseCode.toUpperCase();
      }
    }

    const mergedLicensePoints = {};
    if (config?.licensePoints && typeof config.licensePoints === "object") {
      for (const [code, value] of Object.entries(config.licensePoints)) {
        if (!code) continue;
        const normalizedCode = code.toString().trim().toUpperCase();
        if (!normalizedCode) continue;
        const num = Number.parseFloat(value);
        if (Number.isFinite(num)) {
          mergedLicensePoints[normalizedCode] = roundAdjustmentPoint(num);
        }
      }
    }

    if (override?.licensePoints && typeof override.licensePoints === "object") {
      for (const [code, value] of Object.entries(override.licensePoints)) {
        if (!code) continue;
        const normalizedCode = code.toString().trim().toUpperCase();
        if (!normalizedCode) continue;
        const num = Number.parseFloat(value);
        if (Number.isFinite(num)) {
          mergedLicensePoints[normalizedCode] = roundAdjustmentPoint(num);
        } else if (value === null) {
          delete mergedLicensePoints[normalizedCode];
        }
      }
    }

    const overrideDefaultUnit = Number.isFinite(Number.parseFloat(override?.defaultUnit))
      ? roundAdjustmentPoint(Number.parseFloat(override.defaultUnit))
      : undefined;
    const preservedUnit = Number.isFinite(Number.parseFloat(current?.unitPoints))
      ? roundAdjustmentPoint(Number.parseFloat(current.unitPoints))
      : undefined;
    const unitSource = allowManualOverride ? input.unitPoints ?? input.basePoint ?? input.pointsPerUnit : undefined;
    let unitPoints =
      unitSource !== undefined && unitSource !== null && unitSource !== ""
        ? Number.parseFloat(unitSource)
        : Number.NaN;
    const canAdoptGradeValue = config?.type === "grade" || allowManualOverride;

    if (!Number.isFinite(unitPoints) && canAdoptGradeValue && Number.isFinite(gradeValue)) {
      unitPoints = gradeValue;
    }

    if (!Number.isFinite(unitPoints)) {
      if (!allowManualOverride && Number.isFinite(preservedUnit)) {
        unitPoints = preservedUnit;
      } else if (config?.type === "hybrid") {
        const modeConfig = (config.modes || []).find((item) => item.value === mode);
        const overrideModeUnits = override?.modeUnits && typeof override.modeUnits === "object" ? override.modeUnits : {};
        if (overrideModeUnits && Number.isFinite(Number.parseFloat(overrideModeUnits[mode]))) {
          unitPoints = roundAdjustmentPoint(Number.parseFloat(overrideModeUnits[mode]));
        } else if (modeConfig && Number.isFinite(Number.parseFloat(modeConfig.defaultUnit))) {
          unitPoints = roundAdjustmentPoint(Number.parseFloat(modeConfig.defaultUnit));
        } else if (Number.isFinite(overrideDefaultUnit)) {
          unitPoints = overrideDefaultUnit;
        } else {
          unitPoints = Number.isFinite(config?.defaultUnit) ? config.defaultUnit : 0;
        }
      } else if (config?.requiresLicenseCode && licenseCode && mergedLicensePoints[licenseCode] != null) {
        unitPoints = mergedLicensePoints[licenseCode];
      } else if (Number.isFinite(overrideDefaultUnit)) {
        unitPoints = overrideDefaultUnit;
      } else {
        unitPoints = Number.isFinite(config?.defaultUnit) ? config.defaultUnit : 0;
      }
    }

    if (config?.type === "grade" && config.grades?.length) {
      const allowed = config.grades.map((item) => item.value);
      if (!allowed.includes(unitPoints)) {
        unitPoints = allowed.find((value) => value === Math.round(unitPoints)) ?? allowed[2] ?? 0;
      }
    }

    let quantity = Number.parseFloat(input.quantity ?? input.count ?? input.total ?? current?.quantity ?? 0);
    if (!Number.isFinite(quantity) || quantity < 0) {
      quantity = 0;
    }
    if (config?.type === "fixed" || config?.type === "grade") {
      quantity = 1;
    }

    if (config?.type === "hybrid") {
      const modeConfig = (config.modes || []).find((item) => item.value === mode);
      if (modeConfig?.compute === "fixed") {
        quantity = 1;
      } else if (quantity === 0) {
        quantity = 1;
      }
    } else if (config?.type === "quantity" && quantity === 0) {
      quantity = 1;
    }

    let extraQuantity = 0;
    let extraUnitPointsValue = 0;
    const extraConfig = config?.extraPointConfig;

    if (extraConfig) {
      const overrideExtraUnit = Number.isFinite(Number.parseFloat(override?.extraUnitPoints))
        ? roundAdjustmentPoint(Number.parseFloat(override.extraUnitPoints))
        : undefined;
      const defaultExtraUnit = Number.isFinite(Number.parseFloat(extraConfig.defaultUnit))
        ? roundAdjustmentPoint(Number.parseFloat(extraConfig.defaultUnit))
        : 0;
      const preservedExtraUnit = Number.isFinite(Number.parseFloat(current?.extraUnitPoints))
        ? roundAdjustmentPoint(Number.parseFloat(current.extraUnitPoints))
        : undefined;
      const extraUnitSource = allowManualOverride
        ? input.extraUnitPoints ?? input.bonusUnitPoints ?? current?.extraUnitPoints ?? current?.bonusUnitPoints
        : undefined;
      const parsedExtraUnit =
        extraUnitSource !== undefined && extraUnitSource !== null && extraUnitSource !== ""
          ? Number.parseFloat(extraUnitSource)
          : Number.NaN;

      if (Number.isFinite(parsedExtraUnit)) {
        extraUnitPointsValue = roundAdjustmentPoint(parsedExtraUnit);
      } else if (!allowManualOverride && Number.isFinite(preservedExtraUnit)) {
        extraUnitPointsValue = preservedExtraUnit;
      } else if (Number.isFinite(overrideExtraUnit)) {
        extraUnitPointsValue = overrideExtraUnit;
      } else {
        extraUnitPointsValue = defaultExtraUnit;
      }

      const extraQuantitySource =
        input.extraQuantity ?? input.bonusQuantity ?? current?.extraQuantity ?? current?.bonusQuantity ?? 0;
      const parsedExtraQuantity = Number.parseFloat(extraQuantitySource);
      if (Number.isFinite(parsedExtraQuantity) && parsedExtraQuantity >= 0) {
        extraQuantity = roundAdjustmentPoint(parsedExtraQuantity);
      } else {
        extraQuantity = 0;
      }
    }

    const references = normalizeAdjustmentReferences(input.references ?? input.reference ?? current?.references ?? []);
    const note = normalizeStr(input.note ?? input.description ?? current?.note ?? "");
    const statusCandidate = normalizeStr(input.status ?? current?.status ?? "pending").toLowerCase();
    const status = KPI_ADJUSTMENT_STATUS_SET.has(statusCandidate) ? statusCandidate : "pending";
    const totalOverride = Number.parseFloat(input.totalPoints ?? input.pointsTotal ?? input.total ?? Number.NaN);

    let totalPoints;
    if (Number.isFinite(totalOverride)) {
      totalPoints = roundAdjustmentPoint(totalOverride);
    } else {
      totalPoints = computeAdjustmentTotal({
        category,
        unitPoints,
        quantity,
        mode,
        extraQuantity,
        extraUnitPoints: extraUnitPointsValue,
      });
    }

    const createdAt =
      current?.createdAt && !Number.isNaN(new Date(current.createdAt).getTime())
        ? new Date(current.createdAt).toISOString()
        : now.toISOString();
    const createdBy = current?.createdBy || actor;
    const history = clampHistory(input.history ?? current?.history ?? []);

    const payload = {
      id: current?.id || input.id || `adj-${month.replace(/-/g, "")}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category,
      staffName,
      teamName,
      month,
      quantity,
      unitPoints: roundAdjustmentPoint(unitPoints),
      extraQuantity: extraConfig ? extraQuantity : undefined,
      extraUnitPoints: extraConfig ? extraUnitPointsValue : undefined,
      totalPoints,
      references,
      note,
      status,
      mode: mode || undefined,
      licenseCode: licenseCode || undefined,
      createdAt,
      createdBy,
      history,
    };

    if (taxCode) {
      payload.taxCode = taxCode;
    }
    if (companyName) {
      payload.companyName = companyName;
    }

    const approvedAtSource = input.approvedAt ?? current?.approvedAt ?? null;
    if (approvedAtSource) {
      const approvedAtDate = new Date(approvedAtSource);
      if (!Number.isNaN(approvedAtDate.getTime())) {
        payload.approvedAt = approvedAtDate.toISOString();
      }
    }

    const approvedBySource = input.approvedBy ?? current?.approvedBy ?? null;
    if (typeof approvedBySource === "string") {
      const trimmed = approvedBySource.trim();
      if (trimmed) {
        payload.approvedBy = trimmed;
      }
    }

    const rejectedAtSource = input.rejectedAt ?? current?.rejectedAt ?? null;
    if (rejectedAtSource) {
      const rejectedAtDate = new Date(rejectedAtSource);
      if (!Number.isNaN(rejectedAtDate.getTime())) {
        payload.rejectedAt = rejectedAtDate.toISOString();
      }
    }

    const rejectedBySource = input.rejectedBy ?? current?.rejectedBy ?? null;
    if (typeof rejectedBySource === "string") {
      const trimmed = rejectedBySource.trim();
      if (trimmed) {
        payload.rejectedBy = trimmed;
      }
    }

    return payload;
  }

  function diffAdjustments(prev, next) {
    if (!prev) return null;
    const changes = {};
    const fields = [
      "staffName",
      "teamName",
      "month",
      "category",
      "quantity",
      "unitPoints",
      "extraQuantity",
      "extraUnitPoints",
      "totalPoints",
      "note",
      "status",
      "mode",
      "licenseCode",
      "companyName",
      "taxCode",
    ];

    for (const field of fields) {
      if (JSON.stringify(prev[field]) !== JSON.stringify(next[field])) {
        changes[field] = { from: prev[field], to: next[field] };
      }
    }

    if (JSON.stringify(prev.references) !== JSON.stringify(next.references)) {
      changes.references = { from: prev.references, to: next.references };
    }

    return Object.keys(changes).length ? changes : null;
  }

  function getAllAdjustments() {
    const raw = safeParse(getItem(KPI_ADJUSTMENTS_KEY), []);
    const entries = Array.isArray(raw) ? raw : [];
    return entries
      .map((item) =>
        normalizeAdjustmentInput(item, {
          now: new Date(),
          actor: "system",
          current: item,
          permissions: { adjustOverridePoints: true },
        }),
      )
      .filter(Boolean)
      .sort((a, b) => {
        if (a.month !== b.month) {
          return b.month.localeCompare(a.month);
        }
        if (a.staffName !== b.staffName) {
          return a.staffName.localeCompare(b.staffName, "vi", { sensitivity: "base" });
        }
        return a.id.localeCompare(b.id);
      });
  }

  function persistAdjustments(list) {
    setItem(KPI_ADJUSTMENTS_KEY, JSON.stringify(list));
  }

  function getKpiAdjustmentSettings() {
    return cloneAdjustmentSettings(readAdjustmentSettings());
  }

  function saveKpiAdjustmentSettings(patch, { actor = "system", permissions = {} } = {}) {
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

    writeAdjustmentSettings(next);

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

  function getKpiAdjustments() {
    return getAllAdjustments();
  }

  function saveKpiAdjustment(entry, { actor = "system", permissions = {} } = {}) {
    const permissionSet = permissions || {};
    const canSubmit = permissionSet.adjustSubmit === true;
    const canApprove = permissionSet.adjustApprove === true;
    if (!canSubmit && !canApprove) {
      throw new Error("Ban khong co quyen tao diem KPI bo sung");
    }

    const now = new Date();
    const settingsSnapshot = readAdjustmentSettings();
    const autoApproveConfig = cloneAutoApproveSettings(settingsSnapshot.autoApprove, helperBag);
    const autoApproveEnabled = autoApproveConfig.enabled === true;
    const adjustments = getAllAdjustments();
    const existingIndex = entry?.id ? adjustments.findIndex((item) => item.id === entry.id) : -1;
    const current = existingIndex >= 0 ? adjustments[existingIndex] : null;
    const normalized = normalizeAdjustmentInput(entry, {
      now,
      actor,
      current,
      permissions,
    });

    if (!normalized) {
      throw new Error("Dữ liệu điểm KPI bổ sung không hợp lệ");
    }

    let status = current?.status || "pending";
    const requestedStatus = normalized.status || "pending";
    if (requestedStatus !== status) {
      if ((requestedStatus === "approved" || requestedStatus === "rejected") && !permissions.adjustApprove) {
        throw new Error("Bạn không có quyền duyệt điểm KPI bổ sung");
      }
      status = requestedStatus;
    }

    let autoApproved = false;
    if (!current && status === "pending" && autoApproveEnabled && !canApprove) {
      status = "approved";
      autoApproved = true;
    }

    normalized.status = status;
    normalized.updatedAt = now.toISOString();
    normalized.updatedBy = actor;
    if (autoApproved) {
      const autoApproveActor = autoApproveConfig.updatedBy || "auto-approve";
      normalized.approvedAt = now.toISOString();
      normalized.approvedBy = autoApproveActor;
      if ("rejectedAt" in normalized) {
        delete normalized.rejectedAt;
      }
      if ("rejectedBy" in normalized) {
        delete normalized.rejectedBy;
      }
    }

    if (!current) {
      normalized.createdAt = now.toISOString();
      normalized.createdBy = actor;
    }

    const history = current?.history ? current.history.slice() : [];
    const changes = diffAdjustments(current, normalized);
    history.push(
      normalizeAdjustmentHistoryEntry({
        action: current ? "update" : "create",
        actor,
        detail: normalized.note,
        changes,
      }),
    );

    if (autoApproved) {
      const autoApproveActor = autoApproveConfig.updatedBy || "auto-approve";
      const autoApproveDetail = autoApproveConfig.note
        ? `Duyet tu dong: ${autoApproveConfig.note}`
        : autoApproveConfig.updatedBy
          ? `Duyet tu dong (bat boi ${autoApproveConfig.updatedBy})`
          : "Duyet tu dong";
      history.push(
        normalizeAdjustmentHistoryEntry({
          action: "status.approved",
          actor: autoApproveActor,
          detail: autoApproveDetail,
        }),
      );
    }

    normalized.history = clampHistory(history);

    if (existingIndex >= 0) {
      adjustments[existingIndex] = { ...current, ...normalized };
    } else {
      adjustments.unshift(normalized);
    }

    persistAdjustments(adjustments);

    if (typeof pushAuditLog === "function") {
      pushAuditLog({
        actor,
        action: current ? "kpi.adjustment.update" : "kpi.adjustment.create",
        detail: `${normalized.staffName || "Chưa rõ"} - ${normalized.month} (${KPI_ADJUSTMENT_CATEGORY_CONFIG[normalized.category]?.label || normalized.category})`,
        meta: {
          id: normalized.id,
          status: normalized.status,
          totalPoints: normalized.totalPoints,
          autoApproved,
        },
      });
    }

    return normalized;
  }

  function updateKpiAdjustmentStatus(id, status, { actor = "system", note = "", permissions = {} } = {}) {
    const normalizedStatus = normalizeStr(status).toLowerCase();
    if (!KPI_ADJUSTMENT_STATUS_SET.has(normalizedStatus)) {
      throw new Error("Trạng thái điểm KPI bổ sung không hợp lệ");
    }

    if (!permissions.adjustApprove) {
      throw new Error("Bạn không có quyền duyệt điểm KPI bổ sung");
    }

    const adjustments = getAllAdjustments();
    const index = adjustments.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error("Không tìm thấy điểm KPI bổ sung");
    }

    const entry = { ...adjustments[index] };
    entry.status = normalizedStatus;

    const now = new Date();
    entry.updatedAt = now.toISOString();
    entry.updatedBy = actor;
    if (normalizedStatus === "approved") {
      entry.approvedAt = now.toISOString();
      entry.approvedBy = actor;
    } else if (normalizedStatus === "rejected") {
      entry.rejectedAt = now.toISOString();
      entry.rejectedBy = actor;
    }

    const history = entry.history ? entry.history.slice() : [];
    history.push(
      normalizeAdjustmentHistoryEntry({
        action: `status.${normalizedStatus}`,
        actor,
        detail: note,
      }),
    );
    entry.history = clampHistory(history);

    adjustments[index] = entry;
    persistAdjustments(adjustments);

    if (typeof pushAuditLog === "function") {
      pushAuditLog({
        actor,
        action: "kpi.adjustment.status",
        detail: `${entry.staffName || "Chưa rõ"} - ${entry.month} (${entry.status})`,
        meta: { id: entry.id, status: entry.status },
      });
    }

    return entry;
  }

  function removeKpiAdjustment(id, { actor = "system", permissions = {} } = {}) {
    if (!permissions.adjustApprove && !permissions.adjustSubmit) {
      throw new Error("Bạn không có quyền xoá điểm KPI bổ sung");
    }

    const adjustments = getAllAdjustments();
    const index = adjustments.findIndex((item) => item.id === id);
    if (index === -1) {
      return false;
    }

    const [removed] = adjustments.splice(index, 1);
    persistAdjustments(adjustments);

    if (typeof pushAuditLog === "function") {
      pushAuditLog({
        actor,
        action: "kpi.adjustment.delete",
        detail: `${removed.staffName || "Chưa rõ"} - ${removed.month}`,
        meta: { id },
      });
    }

    return true;
  }

  function mapAdjustmentsByMonth(adjustments = []) {
    const list = Array.isArray(adjustments) ? adjustments : [];
    const map = new Map();

    for (const entry of list) {
      if (!entry || entry.status !== "approved") continue;

      const month = entry.month || "";
      if (!month) continue;

      if (!map.has(month)) {
        map.set(month, []);
      }

      map.get(month).push(entry);
    }

    return map;
  }

  return {
    getKpiAdjustmentSettings,
    saveKpiAdjustmentSettings,
    getKpiAdjustments,
    saveKpiAdjustment,
    updateKpiAdjustmentStatus,
    removeKpiAdjustment,
    mapAdjustmentsByMonth,
  };
}
