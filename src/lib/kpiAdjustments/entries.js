import {
  KPI_ADJUSTMENT_HISTORY_LIMIT,
  KPI_ADJUSTMENT_STATUS_SET,
} from "./constants.js";
import {
  KPI_ADJUSTMENT_CATEGORY_CONFIG,
  normalizeAdjustmentCategoryKey,
} from "../../../shared/kpiAdjustments.js";

export function normalizeAdjustmentCategory(value) {
  const key = normalizeAdjustmentCategoryKey(value);
  if (key && KPI_ADJUSTMENT_CATEGORY_CONFIG[key]) {
    return key;
  }
  return "";
}

export function normalizeAdjustmentMonth(value, { normalizeStr }) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 7);
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

export function normalizeAdjustmentReferences(value, { normalizeStr }) {
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

export function normalizeAdjustmentHistoryEntry(entry, { normalizeStr }) {
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

export function clampHistory(list, helpers) {
  const entries = Array.isArray(list)
    ? list.map((entry) => normalizeAdjustmentHistoryEntry(entry, helpers)).filter(Boolean)
    : [];
  return entries.slice(-KPI_ADJUSTMENT_HISTORY_LIMIT);
}

export function computeAdjustmentTotal(
  { category, unitPoints, quantity, mode, extraQuantity, extraUnitPoints },
  { normalizeStr, roundAdjustmentPoint },
) {
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

export function diffAdjustments(prev, next) {
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

export function normalizeAdjustmentInput(
  input,
  {
    now,
    actor,
    current,
    permissions = {},
    normalizeStr,
    normalizeMST,
    roundAdjustmentPoint,
    readAdjustmentSettings,
  },
) {
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
  const month = normalizeAdjustmentMonth(input.month ?? input.period ?? current?.month ?? "", { normalizeStr });
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

  const references = normalizeAdjustmentReferences(input.references ?? input.reference ?? current?.references ?? [], {
    normalizeStr,
  });
  const note = normalizeStr(input.note ?? input.description ?? current?.note ?? "");
  const statusCandidate = normalizeStr(input.status ?? current?.status ?? "pending").toLowerCase();
  const status = KPI_ADJUSTMENT_STATUS_SET.has(statusCandidate) ? statusCandidate : "pending";
  const totalOverride = Number.parseFloat(input.totalPoints ?? input.pointsTotal ?? input.total ?? Number.NaN);

  let totalPoints;
  if (Number.isFinite(totalOverride)) {
    totalPoints = roundAdjustmentPoint(totalOverride);
  } else {
    totalPoints = computeAdjustmentTotal(
      {
        category,
        unitPoints,
        quantity,
        mode,
        extraQuantity,
        extraUnitPoints: extraUnitPointsValue,
      },
      { normalizeStr, roundAdjustmentPoint },
    );
  }

  const createdAt =
    current?.createdAt && !Number.isNaN(new Date(current.createdAt).getTime())
      ? new Date(current.createdAt).toISOString()
      : now.toISOString();
  const createdBy = current?.createdBy || actor;
  const history = clampHistory(input.history ?? current?.history ?? [], { normalizeStr });

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
