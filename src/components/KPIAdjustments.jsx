import React, { useCallback, useEffect, useMemo, useState } from "react";

import {

  getKpiAdjustments,

  saveKpiAdjustment,

  updateKpiAdjustmentStatus,

  removeKpiAdjustment,

  KPI_ADJUSTMENT_CATEGORY_CONFIG,

  KPI_ADJUSTMENT_STATUS_SET,

  KPI_ADJUSTMENTS_KEY,

  KPI_ADJUSTMENT_SETTINGS_KEY,

  getKpiAdjustmentSettings,

  saveKpiAdjustmentSettings,

  getTeamRoster,
  mapMemberNamesToTeams,

  getDeclRows,

  sortDeclRows,

  getMSTMap,

  normalizeStr,

  normalizeMST,

  normalizeName,

  roundAdjustmentPoint,
  normalizeDeclarationNumber,

  DECL_KEY,

  MST_KEY,

} from "@/lib/store.js";

import { subscribe as subscribeStorage } from "@/lib/storageClient.js";

import { Button } from "@/components/ui/button.jsx";

import { Badge } from "@/components/ui/badge.jsx";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion.jsx";

import {

  Card,

  CardHeader,

  CardTitle,

  CardDescription,

  CardContent,

} from "@/components/ui/card.jsx";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.jsx";
import { ScrollArea } from "@/components/ui/scroll-area.jsx";

import { Input } from "@/components/ui/input.jsx";

import { Textarea } from "@/components/ui/textarea.jsx";

import { cn } from "@/lib/utils.js";

import { Calculator, Hash, Medal, NotebookPen, PlusCircle, Sparkles } from "lucide-react";



const STATUS_LABELS = {

  pending: "Chờ duyệt",

  approved: "Đã duyệt",

  rejected: "Đã từ chối",

};



const FORM_FIELD_IDS = Object.freeze({

  month: "kpi-adjust-month",

  staff: "kpi-adjust-staff",

  team: "kpi-adjust-team",

  category: "kpi-adjust-category",

  company: "kpi-adjust-company",

  taxCode: "kpi-adjust-taxcode",

  license: "kpi-adjust-license",

  status: "kpi-adjust-status",

  note: "kpi-adjust-note",

  references: "kpi-adjust-references",

  mode: "kpi-adjust-mode",

  quantity: "kpi-adjust-quantity",

  unit: "kpi-adjust-unit",

  extraQuantity: "kpi-adjust-extra-quantity",

  extraUnit: "kpi-adjust-extra-unit",

  filterMonth: "kpi-adjust-filter-month",

  filterStatus: "kpi-adjust-filter-status",

  decisionNote: "kpi-adjust-decision-note",

});



const MAX_DECLARATION_SUGGESTIONS = 200;

const GUIDANCE_GROUP_DESCRIPTIONS = Object.freeze({
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

const COMPANY_FIELD_KEYS = new Set([

  "company",

  "cong ty",

  "ten cong ty",

  "ten doanh nghiep",

  "doanh nghiep",

  "customer",

]);

const MST_FIELD_KEYS = new Set(["mst", "ma so thue", "ma so thue (mst)", "tax code"]);



function extractCompanyFromRow(row) {

  if (!row || typeof row !== "object") return "";

  const direct = normalizeStr(row?.company ?? row?.cong_ty ?? row?.customer ?? "");

  if (direct) return direct;

  for (const [key, value] of Object.entries(row)) {

    if (value === null || value === undefined || value === "") continue;

    const normalizedKey = normalizeName(key);

    if (!COMPANY_FIELD_KEYS.has(normalizedKey)) continue;

    const strValue = normalizeStr(value);

    if (strValue) return strValue;

  }

  return "";

}



function extractMstFromRow(row) {

  if (!row || typeof row !== "object") return "";

  const direct = normalizeMST(row?.mst);

  if (direct) return direct;

  for (const [key, value] of Object.entries(row)) {

    if (value === null || value === undefined || value === "") continue;

    const normalizedKey = normalizeName(key);

    if (!MST_FIELD_KEYS.has(normalizedKey)) continue;

    const candidate = normalizeMST(value);

    if (candidate) return candidate;

  }

  return "";

}



function buildDeclarationSuggestions(limit = MAX_DECLARATION_SUGGESTIONS) {

  const rows = sortDeclRows(getDeclRows());

  const suggestions = [];

  const seenKeys = new Set();

  const baseTime = Date.now();



  for (let index = 0; index < rows.length && suggestions.length < limit; index += 1) {

    const row = rows[index];

    if (!row) continue;

    const soTk = normalizeStr(row?.so_tk ?? row?.so_tk_full ?? "");

    if (!soTk) continue;

    const branch = normalizeStr(row?.nhanh ?? row?.branch ?? "");

    const key = `${soTk}|${branch}`;

    if (seenKeys.has(key)) continue;

    seenKeys.add(key);



    const mst = extractMstFromRow(row);

    const company = extractCompanyFromRow(row);

    const parsedTs = row?.date ? Date.parse(row.date) : Number.NaN;

    const timestamp = Number.isFinite(parsedTs) ? parsedTs : baseTime - index;



    suggestions.push({

      key,

      soTk,

      branch,

      mst,

      company,

      date: row?.date || "",

      timestamp,

    });

  }



  return suggestions;

}



function buildBusinessDirectory(declarationSuggestions = null) {

  const byMst = new Map();

  const byCompany = new Map();



  const registerEntry = (mstValue, companyValue, timestamp = 0) => {

    const mst = normalizeMST(mstValue || "");

    const company = normalizeStr(companyValue || "");

    if (!mst && !company) return;



    if (mst) {

      if (!byMst.has(mst)) {

        byMst.set(mst, { mst, company: company || "", lastSeen: timestamp });

      }

      const entry = byMst.get(mst);

      if (company && (!entry.company || timestamp >= entry.lastSeen)) {

        entry.company = company;

        entry.lastSeen = timestamp;

      }

    }



    if (company) {

      const companyKey = normalizeName(company);

      if (!byCompany.has(companyKey)) {

        byCompany.set(companyKey, {

          company,

          normalized: companyKey,

          msts: new Set(),

          lastSeen: timestamp,

        });

      }

      const companyEntry = byCompany.get(companyKey);

      if (timestamp >= companyEntry.lastSeen) {

        companyEntry.company = company;

        companyEntry.lastSeen = timestamp;

      }

      if (mst) {

        companyEntry.msts.add(mst);

        const mstEntry = byMst.get(mst);

        if (mstEntry && !mstEntry.company) {

          mstEntry.company = company;

        }

      }

    }

  };



  const mstRows = getMSTMap();

  const mstBaseTs = Date.now();

  mstRows.forEach((row, index) => {

    if (!row) return;

    registerEntry(row.mst, row.company, mstBaseTs + index);

  });



  const declSuggestions = Array.isArray(declarationSuggestions)

    ? declarationSuggestions

    : buildDeclarationSuggestions(MAX_DECLARATION_SUGGESTIONS);

  declSuggestions.forEach((item, index) => {

    if (!item) return;

    registerEntry(item.mst, item.company, (item.timestamp ?? 0) - index);

  });



  const entries = Array.from(byMst.values()).sort((a, b) => {

    if (a.company && b.company && a.company !== b.company) {

      return a.company.localeCompare(b.company, "vi", { sensitivity: "base" });

    }

    if (a.company && !b.company) return -1;

    if (!a.company && b.company) return 1;

    return a.mst.localeCompare(b.mst);

  });



  const companyDirectory = new Map();

  for (const [key, value] of byCompany.entries()) {

    companyDirectory.set(key, {

      company: value.company,

      normalized: key,

      msts: new Set(value.msts),

      lastSeen: value.lastSeen,

    });

  }



  return { entries, byMst, byCompany: companyDirectory };

}



function formatDateOnly(value) {

  if (!value) return "";

  const ts = Date.parse(value);

  if (!Number.isFinite(ts)) return "";

  try {

    return new Date(ts).toLocaleDateString("vi-VN");

  } catch (err) {

    return "";

  }

}



const normalizeFieldSegment = (value) =>

  String(value ?? "")

    .trim()

    .toLowerCase()

    .replace(/[^a-z0-9_-]+/g, "-")

    .replace(/-{2,}/g, "-")

    .replace(/^-+|-+$/g, "");



const buildSettingsFieldId = (category, suffix) =>

  `kpi-setting-${normalizeFieldSegment(category)}-${normalizeFieldSegment(suffix)}`;



const buildLicenseFieldId = (category, code) =>

  `kpi-setting-${normalizeFieldSegment(category)}-license-${normalizeFieldSegment(code)}`;



function formatInt(value) {

  const num = Number(value || 0);

  return Number.isFinite(num) ? num.toLocaleString("vi-VN") : "0";

}



function formatDecimal(value) {

  const num = Number(value || 0);

  return Number.isFinite(num)

    ? num.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    : "0,0";

}



function getCurrentMonth() {

  const now = new Date();

  const y = now.getFullYear();

  const m = String(now.getMonth() + 1).padStart(2, "0");

  return `${y}-${m}`;

}



function parseReferences(text) {

  if (!text) return [];

  const raw = text

    .split(/[\n,;]+/)

    .map((item) => normalizeStr(item))

    .filter(Boolean);

  return Array.from(new Set(raw));

}



function buildStaffOptions(roster) {

  const options = [];

  if (!roster || !Array.isArray(roster.teams)) {

    return options;

  }

  for (const team of roster.teams) {

    if (!team?.name || !Array.isArray(team.members)) continue;

    for (const member of team.members) {

      const name = normalizeStr(member?.name);

      if (!name) continue;

      options.push({

        team: team.name,

        name,

      });

    }

  }

  return options;

}



function buildTeamOptions(roster) {

  if (!roster || !Array.isArray(roster.teams)) {

    return [];

  }

  return roster.teams

    .map((team) => normalizeStr(team?.name))

    .filter(Boolean);

}



function resolveCategoryOptions() {

  return Object.entries(KPI_ADJUSTMENT_CATEGORY_CONFIG).map(([key, config]) => ({

    value: key,

    label: config.label,

    type: config.type,

  }));

}



const CATEGORY_OPTIONS = resolveCategoryOptions();



const SELECT_FIELD_CLASS =

  "mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring/40";



function normalizeUnitValue(value) {

  const num = Number.parseFloat(value);

  return Number.isFinite(num) ? roundAdjustmentPoint(num) : undefined;

}



function resolveCategoryDefaults(category, settings) {

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

    const overrideModeUnits = overrides.modeUnits && typeof overrides.modeUnits === "object" ? overrides.modeUnits : {};

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

    const fallbackUnit = normalizeUnitValue(overrides.defaultUnit) ?? normalizeUnitValue(config.defaultUnit) ?? 0;

    const unitPoints = licenseCode && mergedPoints[licenseCode] !== undefined ? mergedPoints[licenseCode] : fallbackUnit;

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



  const unitPoints = normalizeUnitValue(overrides.defaultUnit) ?? normalizeUnitValue(config.defaultUnit) ?? 0;

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



function resolveLicenseUnit(category, licenseCode, settings) {

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



function hasActiveOverrides(overrides) {

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



function mergeLicensePoints(config, overrides) {

  if (!config?.requiresLicenseCode) {

    return [];

  }

  const merged = new Map();

  const append = (source) => {

    if (!source || typeof source !== "object") {

      return;

    }

    for (const [code, value] of Object.entries(source)) {

      if (!code) continue;

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



function buildCalculationInfo(config, defaults) {

  const notes = [];

  let badge = "";

  let description = "Điểm = Số lượng x Điểm mỗi đơn vị.";

  if (config?.type === "hybrid") {

    const modes = Array.isArray(config.modes) ? config.modes : [];

    const modeKey = normalizeStr(defaults?.mode || config.defaultMode || "").toLowerCase();

    const modeConfig = modes.find((item) => normalizeStr(item.value).toLowerCase() === modeKey) || modes[0] || {};

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

  if (typeof defaults?.unitPoints === "number" && Number.isFinite(defaults.unitPoints) && defaults.unitPoints < 0) {

    notes.push("Giá trị âm thể hiện mức trừ điểm KPI.");

  }

  return { badge, description, notes };

}



function buildGuidanceGroups(settings) {

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



function buildSettingsDraft(settings) {

  const draft = {};

  for (const [category, config] of Object.entries(KPI_ADJUSTMENT_CATEGORY_CONFIG)) {

    const overrides = settings?.categories?.[category] || {};

    if (config.type === "hybrid") {

      const modes = Array.isArray(config.modes) ? config.modes : [];

      const modeUnits = {};

      for (const mode of modes) {

        const key = mode.value;

        const overrideUnit = overrides.modeUnits && typeof overrides.modeUnits === "object" ? overrides.modeUnits[key] : undefined;

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

    } else if (config.requiresLicenseCode) {

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

        const overrideUnit = overrides.licensePoints && typeof overrides.licensePoints === "object" ? overrides.licensePoints[code] : undefined;

        const configUnit = config.licensePoints && typeof config.licensePoints === "object" ? config.licensePoints[code] : undefined;

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

    } else if (config.type === "grade") {

      const defaultGrade =

        normalizeUnitValue(overrides.defaultUnit) ??

        (Array.isArray(config.grades)

          ? config.grades.find((item) => item.value === 0)?.value ?? config.grades[0]?.value

          : 0);

      draft[category] = {

        defaultUnit: defaultGrade === undefined ? "" : defaultGrade.toString(),

      };

    } else {

      const defaultUnit = normalizeUnitValue(overrides.defaultUnit) ?? normalizeUnitValue(config.defaultUnit) ?? "";

      draft[category] = {

        defaultUnit: defaultUnit === undefined ? "" : defaultUnit.toString(),

      };

    }

    if (config.extraPointConfig) {

      const extraUnitValue =

        normalizeUnitValue(overrides.extraUnitPoints) ??

        normalizeUnitValue(config.extraPointConfig.defaultUnit) ??

        "";

      const entry = draft[category] || {};

      entry.extraUnitPoints = extraUnitValue === undefined ? "" : extraUnitValue.toString();

      draft[category] = entry;

    }

  }

  return draft;

}



function formatDateTime(value) {

  if (!value) return "";

  try {

    return new Date(value).toLocaleString("vi-VN", { hour12: false });

  } catch (err) {

    console.warn("Khong the dinh dang thoi gian dieu chinh KPI", value, err);

    return value;

  }

}



function resolveStaffDefaults(user, roster) {

  const staffName = normalizeStr(user?.memberName || "");

  if (!staffName) {

    return { staffName: "", teamName: "" };

  }


  let teamName = normalizeStr(user?.teamName || "");

  if (!teamName) {

    try {

      const memberMap = mapMemberNamesToTeams(roster);

      const normalizedKey = normalizeName(staffName);

      if (normalizedKey && memberMap instanceof Map) {

        const matched = memberMap.get(normalizedKey);

        if (matched?.team) {

          teamName = normalizeStr(matched.team);

        }

      }

    } catch (error) {

      console.warn("Khong the lay thong tin to doi mac dinh cho nhan vien", error);

    }

  }


  return { staffName, teamName };

}



const initialFormState = (month = getCurrentMonth(), settings, presets = {}) => {

  const categoryDefaults = resolveCategoryDefaults("support_fixed", settings);

  const presetStaff = normalizeStr(presets.staffName || "");

  const presetTeam = normalizeStr(presets.teamName || "");

  return {

    id: null,

    category: "support_fixed",

    month,

    staffName: presetStaff,

    teamName: presetTeam,

    companyName: "",

    taxCode: "",

    quantity: categoryDefaults.quantity,

    unitPoints: categoryDefaults.unitPoints,

    gradeValue: categoryDefaults.gradeValue,

    extraQuantity: categoryDefaults.extraQuantity ?? 0,

    extraUnitPoints: categoryDefaults.extraUnitPoints ?? 0,

    mode: categoryDefaults.mode,

    licenseCode: categoryDefaults.licenseCode || "",

    note: "",

    referencesInput: "",

    status: "pending",

    history: [],

  };

};



export default function KPIAdjustments({ currentUser }) {

  const [settings, setSettings] = useState(() => getKpiAdjustmentSettings());

  const [adjustments, setAdjustments] = useState(() => getKpiAdjustments());

  const [roster, setRoster] = useState(() => getTeamRoster());

  const [businessData, setBusinessData] = useState(() => {

    const suggestions = buildDeclarationSuggestions(MAX_DECLARATION_SUGGESTIONS);

    return { suggestions, directory: buildBusinessDirectory(suggestions) };

  });

  const declarationSuggestions = businessData.suggestions || [];

  const businessDirectory = businessData.directory || { entries: [], byMst: new Map(), byCompany: new Map() };

  const [filterMonth, setFilterMonth] = useState(getCurrentMonth());

  const [filterStatus, setFilterStatus] = useState("all");

  const [form, setForm] = useState(() =>
    initialFormState(undefined, settings, resolveStaffDefaults(currentUser, getTeamRoster()))
  );

  const [isEditing, setIsEditing] = useState(false);

  const [formError, setFormError] = useState("");

  const [detailEntry, setDetailEntry] = useState(null);

  const [guidanceOpen, setGuidanceOpen] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);

  const [settingsDraft, setSettingsDraft] = useState({});

  const [settingsError, setSettingsError] = useState("");

  const [declarationSearch, setDeclarationSearch] = useState("");

  const staffDefaults = useMemo(() => resolveStaffDefaults(currentUser, roster), [currentUser, roster]);

  const { staffName: defaultStaffName, teamName: defaultTeamName } = staffDefaults;

  const businessEntries = useMemo(() => businessDirectory.entries || [], [businessDirectory]);

  const businessByMst = useMemo(

    () => (businessDirectory.byMst instanceof Map ? businessDirectory.byMst : new Map()),

    [businessDirectory]

  );

  const businessByCompany = useMemo(

    () => (businessDirectory.byCompany instanceof Map ? businessDirectory.byCompany : new Map()),

    [businessDirectory]

  );



  const mstOptions = useMemo(() => {

    return businessEntries.slice(0, 400).map((entry) => ({

      value: entry.mst,

      label: entry.company ? `${entry.mst} — ${entry.company}` : entry.mst,

    }));

  }, [businessEntries]);



  const companyOptions = useMemo(() => {

    const list = Array.from(businessByCompany.values()).map((entry) => {

      const msts = Array.from(entry.msts || []);

      return {

        company: entry.company,

        msts,

        label: entry.company,

        description: msts.length ? `MST: ${msts.join(", ")}` : "Chưa có MST",

      };

    });

    return list

      .filter((item) => item.company)

      .sort((a, b) => a.company.localeCompare(b.company, "vi", { sensitivity: "base" }))

      .slice(0, 400);

  }, [businessByCompany]);



  const quickDeclarationSuggestions = useMemo(() => declarationSuggestions.slice(0, 5), [declarationSuggestions]);



  const guidanceGroups = useMemo(() => buildGuidanceGroups(settings), [settings]);



  const filteredDeclarationResults = useMemo(() => {

    if (!declarationSuggestions.length) return [];

    const rawQuery = normalizeStr(declarationSearch);

    if (!rawQuery) {

      return declarationSuggestions.slice(0, 8);

    }

    const digits = rawQuery.replace(/\D+/g, "");

    const normalizedQuery = normalizeName(rawQuery);

    const primaryResults = declarationSuggestions

      .filter((item) => {

        if (!item) return false;

        if (digits) {

          if ((item.soTk || "").includes(digits)) return true;

          if (item.mst && item.mst.includes(digits)) return true;

        }

        if (normalizedQuery) {

          if (item.company && normalizeName(item.company).includes(normalizedQuery)) {

            return true;

          }

        }

        return false;

      })

      .slice(0, 10);

    if (digits && primaryResults.length < 10) {

      const seenKeys = new Set(primaryResults.map((item) => item.key));

      const fallback = [];

      const rows = sortDeclRows(getDeclRows());

      for (const row of rows) {

        if (primaryResults.length + fallback.length >= 10) {

          break;

        }

        const soTkDigits = normalizeDeclarationNumber(row?.so_tk_full ?? row?.so_tk ?? "", 1);

        const mstDigits = normalizeMST(row?.mst ?? row?.ma_so_thue ?? row?.taxCode ?? "");

        const hasMatch =

          (soTkDigits && soTkDigits.includes(digits)) ||

          (mstDigits && mstDigits.includes(digits));

        if (!hasMatch) {

          continue;

        }

        const branch = normalizeStr(row?.nhanh ?? row?.branch ?? "");

        const key = `${soTkDigits}|${branch}`;

        if (seenKeys.has(key)) {

          continue;

        }

        seenKeys.add(key);

        fallback.push({

          key,

          soTk: soTkDigits,

          branch,

          mst: mstDigits,

          company: normalizeStr(

            row?.cong_ty ?? row?.company ?? row?.ten_cong_ty ?? row?.doanh_nghiep ?? ""

          ),

          date: row?.date || "",

          timestamp: row?.date ? Date.parse(row.date) || 0 : 0,

        });

      }

      if (fallback.length) {

        return primaryResults.concat(fallback);

      }

    }

    return primaryResults;

  }, [declarationSearch, declarationSuggestions]);



  const mergeBusinessInfo = useCallback(

    (draft, info = {}) => {

      if (!draft) return draft;

      const next = { ...draft };

      const incomingMst = info.mst ? normalizeMST(info.mst) : "";

      const incomingCompany = info.company ? normalizeStr(info.company) : "";



      if (incomingMst) {

        next.taxCode = incomingMst;

        const mstEntry = businessByMst.get(incomingMst);

        if (mstEntry?.company) {

          next.companyName = mstEntry.company;

        } else if (incomingCompany) {

          if (!next.companyName || normalizeName(next.companyName) !== normalizeName(incomingCompany)) {

            next.companyName = incomingCompany;

          }

        }

      }



      if (incomingCompany) {

        if (!next.companyName || normalizeName(next.companyName) !== normalizeName(incomingCompany)) {

          next.companyName = incomingCompany;

        }

        const companyKey = normalizeName(incomingCompany);

        const companyEntry = businessByCompany.get(companyKey);

        if (companyEntry) {

          const currentMst = next.taxCode ? normalizeMST(next.taxCode) : "";

          const hasCurrent = currentMst && companyEntry.msts instanceof Set && companyEntry.msts.has(currentMst);

          if (!hasCurrent) {

            const firstMst = companyEntry.msts instanceof Set ? Array.from(companyEntry.msts)[0] : undefined;

            if (firstMst) {

              next.taxCode = firstMst;

              const resolved = businessByMst.get(firstMst);

              if (resolved?.company) {

                next.companyName = resolved.company;

              }

            }

          }

        }

      }



      return next;

    },

    [businessByCompany, businessByMst]

  );



  const appendReference = useCallback(

    (referenceValue, metadata = null) => {

      if (!referenceValue) return;

      setForm((prev) => {

        const combined = parseReferences(`${prev.referencesInput}\n${referenceValue}`).join("\n");

        let next = { ...prev, referencesInput: combined };

        if (metadata) {

          next = mergeBusinessInfo(next, metadata);

        }

        return next;

      });

    },

    [mergeBusinessInfo]

  );



  const refreshBusinessData = useCallback(() => {

    const suggestions = buildDeclarationSuggestions(MAX_DECLARATION_SUGGESTIONS);

    setBusinessData({ suggestions, directory: buildBusinessDirectory(suggestions) });

  }, []);



  const handleTaxCodeInput = useCallback(

    (value) => {

      const sanitized = normalizeMST(value);

      setForm((prev) => {

        const draft = { ...prev, taxCode: sanitized };

        if (!sanitized) {

          return draft;

        }

        return mergeBusinessInfo(draft, { mst: sanitized });

      });

    },

    [mergeBusinessInfo]

  );



  const handleCompanyInput = useCallback(

    (value) => {

      const trimmed = normalizeStr(value);

      setForm((prev) => {

        if (!trimmed) {

          return { ...prev, companyName: "" };

        }

        const draft = { ...prev, companyName: trimmed };

        return mergeBusinessInfo(draft, { company: trimmed });

      });

    },

    [mergeBusinessInfo]

  );



  const handleReferencePick = useCallback(

    (item) => {

      if (!item) return;

      appendReference(item.soTk, { mst: item.mst, company: item.company });

    },

    [appendReference]

  );

  const [settingsSaving, setSettingsSaving] = useState(false);

  const [decisionNote, setDecisionNote] = useState("");

  const canSubmit = currentUser?.permissions?.adjustSubmit !== false;

  const canApprove = !!currentUser?.permissions?.adjustApprove;

  const canOverridePoints = currentUser?.permissions?.adjustOverridePoints === true;

  const actor = currentUser?.username || currentUser?.name || "ui";



  useEffect(() => {

    const unsubscribe = subscribeStorage(KPI_ADJUSTMENTS_KEY, () => {

      setAdjustments(getKpiAdjustments());

    });

    return () => unsubscribe?.();

  }, []);



  useEffect(() => {

    const unsubscribe = subscribeStorage(KPI_ADJUSTMENT_SETTINGS_KEY, () => {

      setSettings(getKpiAdjustmentSettings());

    });

    return () => unsubscribe?.();

  }, []);



  useEffect(() => {

    const unsubscribeDecl = subscribeStorage(DECL_KEY, refreshBusinessData);

    const unsubscribeMst = subscribeStorage(MST_KEY, refreshBusinessData);

    return () => {

      unsubscribeDecl?.();

      unsubscribeMst?.();

    };

  }, [refreshBusinessData]);



  useEffect(() => {

    setRoster(getTeamRoster());

  }, [currentUser]);



  useEffect(() => {

    if (!detailEntry) {

      setDecisionNote("");

    }

  }, [detailEntry]);



  useEffect(() => {

    if (isEditing) {

      return;

    }


    const hasDefaultStaff = normalizeStr(defaultStaffName);

    const hasDefaultTeam = normalizeStr(defaultTeamName);


    if (!hasDefaultStaff && !hasDefaultTeam) {

      return;

    }


    setForm((prev) => {

      const currentStaff = normalizeStr(prev.staffName);

      const currentTeam = normalizeStr(prev.teamName);

      let updated = false;

      const next = { ...prev };

      if (hasDefaultStaff && !currentStaff) {

        next.staffName = defaultStaffName;

        updated = true;

      }

      if (hasDefaultTeam && !currentTeam) {

        next.teamName = defaultTeamName;

        updated = true;

      }

      return updated ? next : prev;

    });

  }, [defaultStaffName, defaultTeamName, isEditing]);



  const staffOptions = useMemo(() => buildStaffOptions(roster), [roster]);

  const teamOptions = useMemo(() => buildTeamOptions(roster), [roster]);

  const normalizedTeamFilter = normalizeStr(form.teamName);

  const filteredStaffOptions = useMemo(() => {

    if (!normalizedTeamFilter) {

      return staffOptions;

    }

    return staffOptions.filter((option) => normalizeStr(option.team) === normalizedTeamFilter);

  }, [normalizedTeamFilter, staffOptions]);



  const stats = useMemo(() => {

    const base = { total: 0, approved: 0, pending: 0, rejected: 0, totalPoints: 0 };

    for (const item of adjustments) {

      if (!item) continue;

      base.total += 1;

      if (item.status === "approved") {

        base.approved += 1;

        base.totalPoints += Number(item.totalPoints || 0);

      } else if (item.status === "pending") {

        base.pending += 1;

      } else if (item.status === "rejected") {

        base.rejected += 1;

      }

    }

    return base;

  }, [adjustments]);



  const filteredAdjustments = useMemo(() => {

    return adjustments

      .filter((item) => {

        if (!item) return false;

        if (filterMonth && filterMonth !== "all" && item.month !== filterMonth) {

          return false;

        }

        if (filterStatus !== "all" && item.status !== filterStatus) {

          return false;

        }

        return true;

      })

      .sort((a, b) => {

        const timeA = new Date(b.updatedAt || b.createdAt || 0).getTime();

        const timeB = new Date(a.updatedAt || a.createdAt || 0).getTime();

        if (timeA !== timeB) return timeA - timeB;

        return (b.month || "").localeCompare(a.month || "");

      });

  }, [adjustments, filterMonth, filterStatus]);



  const handleRefreshDeclarations = useCallback(() => {

    refreshBusinessData();

  }, [refreshBusinessData]);



  const handleCategoryChange = (value) => {

    const defaults = resolveCategoryDefaults(value, settings);

    setForm((prev) => ({

      ...prev,

      category: value,

      quantity: defaults.quantity,

      unitPoints: defaults.unitPoints,

      gradeValue: defaults.gradeValue,

      extraQuantity: defaults.extraQuantity ?? 0,

      extraUnitPoints: defaults.extraUnitPoints ?? 0,

      mode: defaults.mode,

      licenseCode: defaults.licenseCode || "",

    }));

  };



  const handleModeChange = (nextMode) => {

    setForm((prev) => {

      const config = KPI_ADJUSTMENT_CATEGORY_CONFIG[prev.category] || {};

      if (config.type !== "hybrid") {

        return prev;

      }

      const normalizedMode = normalizeStr(nextMode || "").toLowerCase();

      const availableModes = Array.isArray(config.modes) ? config.modes.map((item) => item.value) : [];

      if (!availableModes.includes(normalizedMode)) {

        return prev;

      }

      const override = settings?.categories?.[prev.category] || {};

      const modeConfig = (config.modes || []).find((item) => item.value === normalizedMode) || {};

      const overrideUnit = override.modeUnits && typeof override.modeUnits === "object" ? override.modeUnits[normalizedMode] : undefined;

      const fallbackUnit =

        normalizeUnitValue(overrideUnit) ??

        normalizeUnitValue(modeConfig.defaultUnit) ??

        normalizeUnitValue(override.defaultUnit) ??

        normalizeUnitValue(config.defaultUnit) ??

        0;

      const quantity = modeConfig?.compute === "fixed" ? 1 : prev.quantity || 1;

      return {

        ...prev,

        mode: normalizedMode,

        quantity,

        unitPoints: fallbackUnit,

      };

    });

  };



  const handleLicenseChange = (nextCode) => {

    setForm((prev) => {

      const normalized = normalizeStr(nextCode || "").toUpperCase();

      const unitPoints = resolveLicenseUnit(prev.category, normalized, settings);

      return {

        ...prev,

        licenseCode: normalized,

        unitPoints,

      };

    });

  };



  const openSettingsDialog = () => {

    setSettingsDraft(buildSettingsDraft(settings));

    setSettingsError("");

    setSettingsOpen(true);

  };



  const closeSettingsDialog = () => {

    if (!settingsSaving) {

      setSettingsOpen(false);

    }

  };



  const updateSettingsDraft = (category, path, value) => {

    setSettingsDraft((prev) => {

      const next = { ...prev };

      const entry = { ...(next[category] || {}) };

      if (path === "defaultUnit") {

        entry.defaultUnit = value;

      } else if (path === "defaultMode") {

        entry.defaultMode = value;

      } else if (path === "extraUnitPoints") {

        entry.extraUnitPoints = value;

      } else if (path.startsWith("modeUnits.")) {

        const key = path.split(".")[1];

        entry.modeUnits = { ...(entry.modeUnits || {}) };

        entry.modeUnits[key] = value;

      } else if (path.startsWith("licensePoints.")) {

        const key = path.split(".")[1];

        entry.licensePoints = { ...(entry.licensePoints || {}) };

        entry.licensePoints[key] = value;

      }

      next[category] = entry;

      return next;

    });

  };



  const handleSettingsReset = () => {

    setSettingsDraft(buildSettingsDraft({}));

  };



  const handleSettingsSubmit = (event) => {

    event.preventDefault();

    if (!canApprove) {

      setSettingsError("Bạn không có quyền cập nhật cấu hình mặc định.");

      return;

    }

    const payload = { categories: {} };

    for (const [category, draftEntry] of Object.entries(settingsDraft)) {

      if (!draftEntry) continue;

      const config = KPI_ADJUSTMENT_CATEGORY_CONFIG[category];

      if (!config) continue;

      const entryPayload = {};

      if (Object.prototype.hasOwnProperty.call(draftEntry, "defaultUnit")) {

        if (draftEntry.defaultUnit === "") {

          entryPayload.defaultUnit = null;

        } else {

          const num = Number.parseFloat(draftEntry.defaultUnit);

          if (!Number.isNaN(num)) {

            entryPayload.defaultUnit = num;

          }

        }

      }

      if (draftEntry.defaultMode !== undefined) {

        const normalizedMode = normalizeStr(draftEntry.defaultMode || "").toLowerCase();

        if (normalizedMode) {

          entryPayload.defaultMode = normalizedMode;

        } else {

          entryPayload.defaultMode = null;

        }

      }

      if (draftEntry.modeUnits && typeof draftEntry.modeUnits === "object") {

        const modeUnits = {};

        for (const [modeKey, rawValue] of Object.entries(draftEntry.modeUnits)) {

          if (rawValue === "") {

            modeUnits[modeKey] = null;

          } else {

            const num = Number.parseFloat(rawValue);

            if (!Number.isNaN(num)) {

              modeUnits[modeKey] = num;

            }

          }

        }

        if (Object.keys(modeUnits).length) {

          entryPayload.modeUnits = modeUnits;

        }

      }

      if (config.extraPointConfig && Object.prototype.hasOwnProperty.call(draftEntry, "extraUnitPoints")) {

        if (draftEntry.extraUnitPoints === "") {

          entryPayload.extraUnitPoints = null;

        } else {

          const num = Number.parseFloat(draftEntry.extraUnitPoints);

          if (!Number.isNaN(num)) {

            entryPayload.extraUnitPoints = num;

          }

        }

      }

      if (draftEntry.licensePoints && typeof draftEntry.licensePoints === "object") {

        const licensePoints = {};

        for (const [licenseKey, rawValue] of Object.entries(draftEntry.licensePoints)) {

          if (!licenseKey) continue;

          if (rawValue === "") {

            licensePoints[licenseKey] = null;

          } else {

            const num = Number.parseFloat(rawValue);

            if (!Number.isNaN(num)) {

              licensePoints[licenseKey] = num;

            }

          }

        }

        if (Object.keys(licensePoints).length) {

          entryPayload.licensePoints = licensePoints;

        }

      }

      if (Object.keys(entryPayload).length) {

        payload.categories[category] = entryPayload;

      }

    }

    setSettingsSaving(true);

    try {

      saveKpiAdjustmentSettings(payload, { actor, permissions: currentUser?.permissions || {} });

      setSettings(getKpiAdjustmentSettings());

      setSettingsOpen(false);

    } catch (err) {

      console.error(err);

      setSettingsError(err?.message || "Không thể lưu cấu hình mặc định.");

    } finally {

      setSettingsSaving(false);

    }

  };



  const closeDetailDialog = () => {

    setDetailEntry(null);

  };



  const handleDetailConfirm = async () => {

    if (!detailEntry?.entry) {

      setDetailEntry(null);

      return;

    }

    if (detailEntry.intent === "approve") {

      await handleStatusChange(detailEntry.entry, "approved");

      setDetailEntry(null);

    } else if (detailEntry.intent === "reject") {

      await handleStatusChange(detailEntry.entry, "rejected", decisionNote || "");

      setDetailEntry(null);

    } else {

      setDetailEntry(null);

    }

  };



  const handleEdit = (entry) => {

    if (!entry) return;

    const defaults = resolveCategoryDefaults(entry.category, settings);

    setForm({

      id: entry.id,

      category: entry.category,

      month: entry.month || getCurrentMonth(),

      staffName: entry.staffName || "",

      teamName: entry.teamName || "",

      companyName: entry.companyName || "",

      taxCode: entry.taxCode ? normalizeMST(entry.taxCode) : "",

      quantity: entry.quantity ?? defaults.quantity,

      unitPoints: entry.unitPoints ?? defaults.unitPoints,

      gradeValue: entry.unitPoints ?? defaults.gradeValue,

      extraQuantity: entry.extraQuantity ?? defaults.extraQuantity ?? 0,

      extraUnitPoints: entry.extraUnitPoints ?? defaults.extraUnitPoints ?? 0,

      mode: entry.mode || defaults.mode,

      licenseCode: entry.licenseCode || defaults.licenseCode || "",

      note: entry.note || "",

      referencesInput: Array.isArray(entry.references) ? entry.references.join("\n") : "",

      status: entry.status || "pending",

      history: Array.isArray(entry.history) ? entry.history : [],

    });

    setIsEditing(true);

    setFormError("");

  };



  const resetForm = () => {

    setForm(

      initialFormState(

        filterMonth && filterMonth !== "all" ? filterMonth : getCurrentMonth(),

        settings,

        staffDefaults,

      ),

    );

    setIsEditing(false);

    setFormError("");

  };



  const handleDelete = async (entry) => {

    if (!entry) return;

    if (!window.confirm("Bạn có chắc chắn muốn xóa mục điểm KPI bổ sung này?")) {

      return;

    }

    try {

      const ok = removeKpiAdjustment(entry.id, {

        actor,

        permissions: currentUser?.permissions || {},

      });

      if (ok) {

        setAdjustments(getKpiAdjustments());

      }

    } catch (err) {

      console.error(err);

      window.alert("Không thể xóa mục điểm KPI bổ sung. Vui lòng thử lại.");

    }

  };



  const handleStatusChange = async (entry, status, noteOverride = null) => {

    if (!entry) return;

    if (!canApprove) {

      window.alert("Bạn không có quyền duyệt điểm KPI bổ sung.");

      return;

    }

    let note = noteOverride != null ? noteOverride : "";

    if (status === "rejected" && noteOverride == null) {

      note = window.prompt("Nhập lý do từ chối (tuỳ chọn)", "") || "";

    }

    try {

      updateKpiAdjustmentStatus(entry.id, status, {

        actor,

        note,

        permissions: currentUser?.permissions || {},

      });

      setAdjustments(getKpiAdjustments());

    } catch (err) {

      console.error(err);

      window.alert("Không thể cập nhật trạng thái. Vui lòng thử lại.");

    }

  };



  const handleSubmit = (event) => {

    event.preventDefault();

    if (!canSubmit) {

      setFormError("Tài khoản hiện không có quyền tạo điểm KPI bổ sung.");

      return;

    }

    if (!form.staffName) {

      setFormError("Vui lòng nhập tên nhân viên.");

      return;

    }

    if (!form.month) {

      setFormError("Vui lòng chọn tháng áp dụng.");

      return;

    }



    const categoryConfig = KPI_ADJUSTMENT_CATEGORY_CONFIG[form.category] || {};

    const references = parseReferences(form.referencesInput);

    const payload = {

      id: form.id || undefined,

      category: form.category,

      month: form.month,

      staffName: form.staffName,

      teamName: form.teamName,

      references,

      note: form.note,

      status: canApprove && form.id ? form.status : "pending",

    };

    const normalizedTaxCode = normalizeMST(form.taxCode);

    const normalizedCompanyName = normalizeStr(form.companyName);

    if (normalizedTaxCode) {

      payload.taxCode = normalizedTaxCode;

    }

    if (normalizedCompanyName) {

      payload.companyName = normalizedCompanyName;

    }

    if (categoryConfig.type === "grade") {

      payload.quantity = 1;

      payload.unitPoints = Number(form.gradeValue ?? form.unitPoints ?? 0);

    } else {

      payload.quantity = Number(form.quantity || 0) || 0;

      payload.unitPoints = Number(form.unitPoints || 0) || 0;

    }

    if (categoryConfig.extraPointConfig) {

      payload.extraQuantity = Number(form.extraQuantity || 0) || 0;

      payload.extraUnitPoints = Number(form.extraUnitPoints || 0) || 0;

    }

    if (categoryConfig.type === "hybrid") {

      payload.mode = normalizeStr(form.mode || "").toLowerCase();

      if (!payload.mode) {

        payload.mode = resolveCategoryDefaults(form.category, settings).mode || "";

      }

      if (payload.mode === "fixed") {

        payload.quantity = 1;

      }

    }

    if (categoryConfig.requiresLicenseCode) {

      const normalizedCode = normalizeStr(form.licenseCode || "").toUpperCase();

      if (normalizedCode) {

        payload.licenseCode = normalizedCode;

      } else if (Array.isArray(categoryConfig.licenseOptions) && categoryConfig.licenseOptions.length) {

        payload.licenseCode = normalizeStr(categoryConfig.licenseOptions[0].value || "").toUpperCase() || undefined;

      }

    }



    try {

      saveKpiAdjustment(payload, {

        actor,

        permissions: currentUser?.permissions || {},

      });

      setAdjustments(getKpiAdjustments());

      resetForm();

    } catch (err) {

      console.error(err);

      setFormError(err?.message || "Không thể lưu điểm KPI bổ sung.");

    }

  };



  const formCategoryConfig = KPI_ADJUSTMENT_CATEGORY_CONFIG[form.category] || {};

  const historyEntries = Array.isArray(form.history) ? form.history.slice().reverse() : [];

  const modeOptions = Array.isArray(formCategoryConfig.modes) ? formCategoryConfig.modes : [];

  const licenseOptions = Array.isArray(formCategoryConfig.licenseOptions) ? formCategoryConfig.licenseOptions : [];

  const normalizedMode = normalizeStr(form.mode || "").toLowerCase();

  const isHybridFixed = formCategoryConfig.type === "hybrid" && normalizedMode === "fixed";

  const computedQuantity = Number.parseFloat(form.quantity ?? 0) || 0;

  const computedUnit =

    formCategoryConfig.type === "grade"

      ? Number.parseFloat(form.gradeValue ?? form.unitPoints ?? 0) || 0

      : Number.parseFloat(form.unitPoints ?? 0) || 0;

  const computedExtraQuantity = Number.parseFloat(form.extraQuantity ?? 0) || 0;

  const computedExtraUnit = Number.parseFloat(form.extraUnitPoints ?? 0) || 0;

  const allowManualPointOverride = canOverridePoints || form.category === "support_misc";

  const computedTotal = (() => {

    let baseTotal = 0;

    if (formCategoryConfig.type === "grade") {

      baseTotal = roundAdjustmentPoint(computedUnit);

    }

    if (formCategoryConfig.type === "hybrid" && isHybridFixed) {

      baseTotal = roundAdjustmentPoint(computedUnit);

    }

    if (baseTotal === 0 && formCategoryConfig.type !== "grade") {

      baseTotal = roundAdjustmentPoint((computedQuantity || 0) * computedUnit);

    }

    const extraTotal = roundAdjustmentPoint(computedExtraQuantity * computedExtraUnit);

    return roundAdjustmentPoint(baseTotal + extraTotal);

  })();

  const detailData = detailEntry?.entry || null;

  const detailCategoryConfig = detailData ? KPI_ADJUSTMENT_CATEGORY_CONFIG[detailData.category] || {} : {};

  const detailExtraQuantity = detailCategoryConfig.extraPointConfig

    ? Number.parseFloat(detailData?.extraQuantity ?? 0) || 0

    : 0;

  const detailExtraUnit = detailCategoryConfig.extraPointConfig

    ? Number.parseFloat(

        detailData?.extraUnitPoints ??

          (detailCategoryConfig.extraPointConfig?.defaultUnit ?? 0)

      ) || 0

    : 0;

  const detailExtraTotal = detailCategoryConfig.extraPointConfig

    ? roundAdjustmentPoint(detailExtraQuantity * detailExtraUnit)

    : 0;

  const detailIntent = detailEntry?.intent || "view";

  const detailLabel = detailIntent === "approve" ? "Duyệt điểm" : detailIntent === "reject" ? "Từ chối điểm" : "Chi tiết mục điểm";



  return (

    <div className="space-y-6">

      <Card>

        <CardHeader>

          <CardTitle className="text-lg font-semibold text-foreground">

            Tổng quan điểm KPI +/-

          </CardTitle>

        </CardHeader>

        <CardContent className="grid gap-4 pt-0 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm shadow-sm">

            <div className="text-xs font-medium uppercase text-muted-foreground">Tổng số mục</div>

            <div className="mt-1 text-2xl font-semibold text-foreground">{formatInt(stats.total)}</div>

          </div>

          <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm shadow-sm">

            <div className="text-xs font-medium uppercase text-muted-foreground">Đã duyệt</div>

            <div className="mt-1 text-2xl font-semibold text-emerald-600">{formatInt(stats.approved)}</div>

          </div>

          <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm shadow-sm">

            <div className="text-xs font-medium uppercase text-muted-foreground">Chờ duyệt</div>

            <div className="mt-1 text-2xl font-semibold text-amber-600">{formatInt(stats.pending)}</div>

          </div>

          <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm shadow-sm">

            <div className="text-xs font-medium uppercase text-muted-foreground">Điểm đã cộng/trừ</div>

            <div className="mt-1 text-2xl font-semibold text-blue-600">{formatDecimal(stats.totalPoints)}</div>

          </div>

        </CardContent>

      </Card>



      <Dialog open={!!detailEntry} onOpenChange={(open) => (open ? null : closeDetailDialog())}>

        <DialogContent data-testid="kpi-adjust-detail-dialog" className="max-w-2xl">

          <DialogHeader>

            <DialogTitle>{detailLabel}</DialogTitle>

            <DialogDescription>Xem nhanh chi tiết điểm KPI trước khi duyệt.</DialogDescription>

          </DialogHeader>

          {detailData ? (

            <div className="space-y-4 text-sm text-foreground">

              <div className="grid gap-3 sm:grid-cols-2">

                <div>

                  <div className="text-xs font-medium uppercase text-muted-foreground">Nhân viên</div>

                  <div className="mt-1 font-medium text-foreground">{detailData.staffName || "Chưa gán"}</div>

                </div>

                <div>

                  <div className="text-xs font-medium uppercase text-muted-foreground">Tổ đội</div>

                  <div className="mt-1 font-medium text-foreground">{detailData.teamName || "—"}</div>

                </div>

                <div>

                  <div className="text-xs font-medium uppercase text-muted-foreground">Hạng mục</div>

                  <div className="mt-1 font-medium text-foreground">{KPI_ADJUSTMENT_CATEGORY_CONFIG[detailData.category]?.label || detailData.category}</div>

                </div>

                <div>

                  <div className="text-xs font-medium uppercase text-muted-foreground">Trạng thái</div>

                  <div className="mt-1 font-medium text-foreground">{STATUS_LABELS[detailData.status] || detailData.status}</div>

                </div>

                <div>

                  <div className="text-xs font-medium uppercase text-muted-foreground">Công ty</div>

                  <div className="mt-1 font-medium text-foreground">{detailData.companyName || "—"}</div>

                </div>

                <div>

                  <div className="text-xs font-medium uppercase text-muted-foreground">Mã số thuế</div>

                  <div className="mt-1 font-medium text-foreground">{detailData.taxCode || "—"}</div>

                </div>

              </div>

              <div className="grid gap-3 sm:grid-cols-2">

                <div>

                  <div className="text-xs font-medium uppercase text-muted-foreground">Số lượng</div>

                  <div className="mt-1 font-medium text-foreground">{formatDecimal(detailData.quantity ?? 0)}</div>

                </div>

                <div>

                  <div className="text-xs font-medium uppercase text-muted-foreground">Điểm mỗi đơn vị</div>

                  <div className="mt-1 font-medium text-foreground">{formatDecimal(detailData.unitPoints ?? 0)}</div>

                </div>

                <div>

                  <div className="text-xs font-medium uppercase text-muted-foreground">Tổng điểm</div>

                  <div className="mt-1 font-semibold text-foreground">{formatDecimal(detailData.totalPoints ?? 0)}</div>

                </div>

                {detailCategoryConfig.extraPointConfig ? (

                  <>

                    <div>

                      <div className="text-xs font-medium uppercase text-muted-foreground">

                        {detailCategoryConfig.extraPointConfig.quantityLabel || "Số lượng bổ sung"}

                      </div>

                      <div className="mt-1 font-medium text-foreground">{formatDecimal(detailExtraQuantity)}</div>

                    </div>

                    <div>

                      <div className="text-xs font-medium uppercase text-muted-foreground">

                        {detailCategoryConfig.extraPointConfig.unitLabel || "Điểm bổ sung mỗi đơn vị"}

                      </div>

                      <div className="mt-1 font-medium text-foreground">{formatDecimal(detailExtraUnit)}</div>

                    </div>

                    <div className="sm:col-span-2">

                      <div className="text-xs font-medium uppercase text-muted-foreground">Điểm bổ sung</div>

                      <div className="mt-1 font-medium text-foreground">{formatDecimal(detailExtraTotal)}</div>

                    </div>

                  </>

                ) : null}

                {detailData.licenseCode ? (

                  <div>

                    <div className="text-xs font-medium uppercase text-muted-foreground">Giấy phép</div>

                    <div className="mt-1 font-medium text-foreground">{detailData.licenseCode}</div>

                  </div>

                ) : null}

              </div>

              <div>

                <div className="text-xs font-medium uppercase text-muted-foreground">Ghi chú</div>

                <div className="mt-1 whitespace-pre-line text-foreground">{detailData.note || "—"}</div>

              </div>

              <div>

                <div className="text-xs font-medium uppercase text-muted-foreground">Tham chiếu</div>

                {Array.isArray(detailData.references) && detailData.references.length ? (

                  <div className="mt-2 flex flex-wrap gap-2">

                    {detailData.references.map((ref) => (

                      <Badge key={ref} variant="outline">

                        {ref}

                      </Badge>

                    ))}

                  </div>

                ) : (

                  <div className="mt-1 text-muted-foreground">Không có tham chiếu.</div>

                )}

              </div>

              {detailData.history && detailData.history.length ? (

                <div>

                  <div className="text-xs font-medium uppercase text-muted-foreground">Lịch sử</div>

                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">

                    {detailData.history.slice().reverse().slice(0, 5).map((entry) => (

                      <li key={entry.id} className="flex items-center justify-between gap-3">

                        <span>{formatDateTime(entry.ts)}</span>

                        <span className="text-foreground">{entry.actor || "system"}</span>

                      </li>

                    ))}

                  </ul>

                </div>

              ) : null}

              {detailIntent === "reject" ? (

                <div className="space-y-2">

                  <label className="text-sm font-medium text-foreground" htmlFor={FORM_FIELD_IDS.decisionNote}>

                    Lý do từ chối (tuỳ chọn)

                  </label>

                  <Textarea

                    id={FORM_FIELD_IDS.decisionNote}

                    rows={3}

                    value={decisionNote}

                    onChange={(e) => setDecisionNote(e.target.value)}

                    placeholder="Ghi chú lý do từ chối..."

                  />

                </div>

              ) : null}

            </div>

          ) : null}

          <DialogFooter>

            <Button type="button" variant="ghost" onClick={closeDetailDialog}>

              Đóng

            </Button>

            {detailIntent === "approve" ? (

              <Button type="button" onClick={handleDetailConfirm}>

                Duyệt

              </Button>

            ) : null}

            {detailIntent === "reject" ? (

              <Button type="button" variant="destructive" onClick={handleDetailConfirm}>

                Từ chối

              </Button>

            ) : null}

          </DialogFooter>

        </DialogContent>

      </Dialog>



        <Dialog open={guidanceOpen} onOpenChange={setGuidanceOpen}>

          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden p-0">

            <div className="flex max-h-[85vh] flex-col">

              <DialogHeader className="px-6 pb-4 pt-6">

                <DialogTitle>Hướng dẫn nhập điểm KPI +/-</DialogTitle>

                <DialogDescription>

                  Tham khảo điểm mặc định, điểm bổ sung và cách tính cho từng nhóm hạng mục theo cấu hình hiện tại.

                </DialogDescription>

              </DialogHeader>

              {guidanceGroups.length ? (

                <ScrollArea className="flex-1 px-6 pb-6">

                  <div className="space-y-3 text-foreground">

                    <Accordion type="multiple" className="space-y-3 text-foreground">
                      {guidanceGroups.map((group) => {
                        const totalDefaultPoints = group.items.reduce(
                          (sum, item) => (Number.isFinite(item.defaultUnit) ? sum + item.defaultUnit : sum),
                          0,
                        );
                        const hasDefaultPoints = group.items.some((item) => Number.isFinite(item.defaultUnit));
                        const activeDefaultCount = group.items.reduce(
                          (count, item) => (Number.isFinite(item.defaultUnit) ? count + 1 : count),
                          0,
                        );
                        return (
                          <AccordionItem
                            key={group.key}
                            value={group.key}
                            className="rounded-xl border border-border/70 bg-muted/20 px-1 py-1 shadow-sm transition-colors [&[data-state=open]]:border-border [&[data-state=open]]:bg-background"
                          >
                            <AccordionTrigger className="flex-col gap-3 px-3 text-left text-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
                              <div className="flex flex-1 flex-col gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-base font-semibold text-foreground">{group.label}</span>
                                  <Badge variant="outline" className="border-border/70 bg-background/60 text-xs font-medium">
                                    {group.items.length} hạng mục
                                  </Badge>
                                </div>
                                {group.description ? (
                                  <p className="text-xs text-muted-foreground">{group.description}</p>
                                ) : null}
                              </div>
                              <div className="flex flex-col items-start gap-2 text-xs font-medium text-muted-foreground sm:items-end">
                                <span className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-primary">
                                  <Calculator className="size-4" aria-hidden="true" />
                                  {hasDefaultPoints ? `Tổng điểm chuẩn: ${formatDecimal(totalDefaultPoints)}` : "Chưa có điểm chuẩn"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Sparkles className="size-4" aria-hidden="true" />
                                  {`${activeDefaultCount}/${group.items.length} hạng mục có điểm mặc định`}
                                </span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-2 text-sm text-foreground sm:px-4">
                              <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
                                {group.items.map((item) => (
                                  <article
                                    key={item.key}
                                    className="rounded-lg border border-border/70 bg-background/80 shadow-sm transition hover:border-border"
                                  >
                                    <div className="flex flex-col gap-4 p-4 lg:flex-row">
                                      <div className="flex flex-col gap-3 lg:w-[32%]">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-semibold text-foreground">{item.label}</span>
                                            {item.hasOverride ? (
                                              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-xs font-medium text-primary">
                                                Tuỳ chỉnh
                                              </Badge>
                                            ) : null}
                                          </div>
                                          {item.modeLabel ? (
                                            <Badge variant="secondary" className="flex items-center gap-1 text-xs font-medium">
                                              {item.modeLabel}
                                            </Badge>
                                          ) : null}
                                        </div>
                                        <div className="grid gap-3">
                                          <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                              <Sparkles className="size-4" aria-hidden="true" />
                                              <span>Điểm mặc định</span>
                                            </div>
                                            <div className="mt-1 text-lg font-semibold text-foreground">
                                              {Number.isFinite(item.defaultUnit) ? (
                                                formatDecimal(item.defaultUnit)
                                              ) : (
                                                <span className="text-sm font-normal text-muted-foreground">Không xác định</span>
                                              )}
                                            </div>
                                          </div>
                                          <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                              <PlusCircle className="size-4" aria-hidden="true" />
                                              <span>Điểm bổ sung</span>
                                            </div>
                                            {item.extraUnit !== null ? (
                                              <div className="mt-1 space-y-1">
                                                <div className="text-lg font-semibold text-foreground">{formatDecimal(item.extraUnit)}</div>
                                                {item.extraLabel ? (
                                                  <p className="text-xs text-muted-foreground">{item.extraLabel}</p>
                                                ) : null}
                                              </div>
                                            ) : (
                                              <p className="mt-1 text-sm text-muted-foreground">Không áp dụng</p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex-1 space-y-4">
                                        <section className="rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-2">
                                          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            <Calculator className="size-4" aria-hidden="true" />
                                            <span>Cách tính</span>
                                          </div>
                                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.calculation}</p>
                                        </section>
                                        {item.licensePoints.length ? (
                                          <section className="rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-2">
                                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                              <Hash className="size-4" aria-hidden="true" />
                                              <span>Mã &amp; điểm</span>
                                            </div>
                                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                              {item.licensePoints.map((license) => (
                                                <div
                                                  key={`${item.key}-${license.code}`}
                                                  className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/70 px-3 py-2 text-xs"
                                                >
                                                  <span className="font-semibold text-foreground">{license.code}</span>
                                                  <span className="text-muted-foreground">{formatDecimal(license.points)} điểm</span>
                                                </div>
                                              ))}
                                            </div>
                                          </section>
                                        ) : null}
                                        {item.gradeOptions.length ? (
                                          <section className="rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-2">
                                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                              <Medal className="size-4" aria-hidden="true" />
                                              <span>Các mức đánh giá</span>
                                            </div>
                                            <ul className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                                              {item.gradeOptions.map((grade) => (
                                                <li key={`${item.key}-grade-${grade.value}`}>{grade.label}</li>
                                              ))}
                                            </ul>
                                          </section>
                                        ) : null}
                                        {item.notes.length ? (
                                          <section className="rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-2">
                                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                              <NotebookPen className="size-4" aria-hidden="true" />
                                              <span>Ghi chú</span>
                                            </div>
                                            <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-relaxed text-muted-foreground">
                                              {item.notes.map((note, index) => (
                                                <li key={`${item.key}-note-${index}`}>{note}</li>
                                              ))}
                                            </ul>
                                          </section>
                                        ) : null}
                                      </div>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>

                  </div>

                </ScrollArea>

              ) : (

                <div className="px-6 pb-6">

                  <p className="text-sm text-muted-foreground">

                    Chưa có thông tin cấu hình khả dụng. Vui lòng mở phần cấu hình để kiểm tra lại.

                  </p>

                </div>

              )}

              <DialogFooter className="flex flex-col gap-3 px-6 pb-6 sm:flex-row sm:items-center sm:justify-between">

                <Button

                  type="button"

                  variant="link"

                  className="h-auto px-0 text-sm"

                  onClick={() => {

                    setGuidanceOpen(false);

                    openSettingsDialog();

                  }}

                >

                  Mở phần cấu hình

                </Button>

                <div className="flex w-full justify-end gap-2 sm:w-auto">

                  <Button type="button" onClick={() => setGuidanceOpen(false)}>

                    Đã rõ

                  </Button>

                </div>

              </DialogFooter>

            </div>

          </DialogContent>

        </Dialog>

      <Dialog open={settingsOpen} onOpenChange={(open) => (open ? setSettingsOpen(true) : closeSettingsDialog())}>

        <DialogContent className="max-w-3xl">

          <DialogHeader>

            <DialogTitle>Cấu hình điểm mặc định</DialogTitle>

            <DialogDescription>Chỉ áp dụng cho Admin/Quản lý. Để trống sẽ dùng giá trị hệ thống.</DialogDescription>

          </DialogHeader>

          <form className="space-y-6" onSubmit={handleSettingsSubmit}>

            <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">

              {Object.entries(KPI_ADJUSTMENT_CATEGORY_CONFIG).map(([category, config]) => {

                const draft = settingsDraft[category] || {};

                const groupLabel = config.groupLabel || config.groupKey;

                const defaultUnitId = buildSettingsFieldId(category, "default-unit");

                const defaultModeId = buildSettingsFieldId(category, "default-mode");

                const extraUnitId = buildSettingsFieldId(category, "extra-unit");

                const licenseKeys = draft.licensePoints ? Object.keys(draft.licensePoints) : [];

                return (

                  <div key={category} className="rounded-xl border border-border bg-muted/30 p-4 text-sm shadow-sm">

                    <div className="font-semibold text-foreground">{config.label}</div>

                    {groupLabel ? (

                      <div className="text-xs text-muted-foreground">{groupLabel}</div>

                    ) : null}

                    <div className="mt-3 space-y-3">

                      <div>

                        <label className="text-xs font-semibold text-muted-foreground" htmlFor={defaultUnitId}>

                          Điểm mặc định

                        </label>

                        <Input

                          id={defaultUnitId}

                          type="number"

                          step="0.1"

                          placeholder="—"

                          value={draft.defaultUnit ?? ""}

                          onChange={(e) => updateSettingsDraft(category, "defaultUnit", e.target.value)}

                          className="mt-1"

                        />

                      </div>

                      {config.extraPointConfig ? (

                        <div>

                          <label className="text-xs font-semibold text-muted-foreground" htmlFor={extraUnitId}>

                            {config.extraPointConfig.unitLabel || "Điểm bổ sung mỗi đơn vị"}

                          </label>

                          <Input

                            id={extraUnitId}

                            type="number"

                            step="0.1"

                            placeholder="-"

                            value={draft.extraUnitPoints ?? ""}

                            onChange={(e) => updateSettingsDraft(category, "extraUnitPoints", e.target.value)}

                            className="mt-1"

                          />

                        </div>

                      ) : null}

                      {config.modes ? (

                        <div className="grid gap-3 sm:grid-cols-2">

                          <div>

                            <label className="text-xs font-semibold text-muted-foreground" htmlFor={defaultModeId}>

                              Chế độ mặc định

                            </label>

                            <select

                              id={defaultModeId}

                              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring/40"

                              value={draft.defaultMode || ""}

                              onChange={(e) => updateSettingsDraft(category, "defaultMode", e.target.value)}

                            >

                              <option value="">Theo hệ thống</option>

                              {config.modes.map((mode) => (

                                <option key={mode.value} value={mode.value}>

                                  {mode.label}

                                </option>

                              ))}

                            </select>

                          </div>

                          {config.modes.map((mode) => {

                            const modeUnitId = buildSettingsFieldId(category, `mode-${mode.value}`);

                            return (

                              <div key={mode.value}>

                                <label className="text-xs font-semibold text-muted-foreground" htmlFor={modeUnitId}>

                                  Điểm chế độ {mode.label}

                                </label>

                                <Input

                                  id={modeUnitId}

                                  type="number"

                                  step="0.1"

                                  placeholder="—"

                                  value={draft.modeUnits?.[mode.value] ?? ""}

                                  onChange={(e) => updateSettingsDraft(category, `modeUnits.${mode.value}`, e.target.value)}

                                  className="mt-1"

                                />

                              </div>

                            );

                          })}

                        </div>

                      ) : null}

                      {config.requiresLicenseCode ? (

                        <div className="grid gap-3 sm:grid-cols-2">

                          {licenseKeys.map((code) => {

                            const licenseFieldId = buildLicenseFieldId(category, code);

                            return (

                              <div key={code}>

                                <label className="text-xs font-semibold text-muted-foreground" htmlFor={licenseFieldId}>

                                  Mã {code}

                                </label>

                                <Input

                                  id={licenseFieldId}

                                  type="number"

                                  step="0.1"

                                  placeholder="—"

                                  value={draft.licensePoints?.[code] ?? ""}

                                  onChange={(e) => updateSettingsDraft(category, `licensePoints.${code}`, e.target.value)}

                                  className="mt-1"

                                />

                              </div>

                            );

                          })}

                        </div>

                      ) : null}

                    </div>

                  </div>

                );

              })}

            </div>

            {settingsError ? (

              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">

                {settingsError}

              </div>

            ) : null}

            <DialogFooter>

              <Button type="button" variant="ghost" onClick={closeSettingsDialog} disabled={settingsSaving}>

                Hủy

              </Button>

              <Button type="button" variant="outline" onClick={handleSettingsReset} disabled={settingsSaving}>

                Khôi phục mặc định

              </Button>

              <Button type="submit" disabled={settingsSaving}>

                {settingsSaving ? "Đang lưu..." : "Lưu cấu hình"}

              </Button>

            </DialogFooter>

          </form>

        </DialogContent>

      </Dialog>



      <Card>

        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <CardTitle className="text-lg font-semibold text-foreground">Thêm điểm KPI +/-</CardTitle>

            <CardDescription>Ghi nhận cộng/trừ điểm cho từng nhân viên.</CardDescription>

          </div>

          <div className="flex flex-wrap gap-2">

            <Button type="button" variant="ghost" size="sm" onClick={handleRefreshDeclarations}>

              Làm mới tham chiếu

            </Button>

            <Button type="button" variant="outline" size="sm" onClick={() => setGuidanceOpen(true)}>

              Hướng dẫn

            </Button>

            {canApprove ? (

              <Button type="button" variant="secondary" size="sm" onClick={openSettingsDialog}>

                Cấu hình mặc định

              </Button>

            ) : null}

          </div>

        </CardHeader>

        <CardContent>

          <form className="space-y-6" onSubmit={handleSubmit}>

            <div className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">

              <div>

                <label className="text-sm font-medium text-foreground" htmlFor={FORM_FIELD_IDS.month}>

                  Tháng áp dụng

                </label>

                <Input

                  id={FORM_FIELD_IDS.month}

                  type="month"

                  value={form.month}

                  onChange={(e) => setForm((prev) => ({ ...prev, month: e.target.value }))}

                  required

                  className="mt-1"

                />

              </div>

              <div>

                <label className="text-sm font-medium text-foreground" htmlFor={FORM_FIELD_IDS.staff}>

                  Nhân viên

                </label>

                <Input

                  id={FORM_FIELD_IDS.staff}

                  list="kpi-adjust-staff-options"

                  placeholder="Nhập tên nhân viên"

                  value={form.staffName}

                  onChange={(e) => {

                    const nextName = e.target.value;

                    const normalizedName = normalizeStr(nextName);

                    const matched = staffOptions.find((option) => normalizeStr(option.name) === normalizedName);

                    setForm((prev) => ({

                      ...prev,

                      staffName: nextName,

                      teamName: matched && matched.team ? matched.team : prev.teamName,

                    }));

                  }}

                  required

                  className="mt-1"

                />

                <datalist id="kpi-adjust-staff-options">

                  {filteredStaffOptions.map((option) => (

                    <option key={`${option.team}-${option.name}`} value={option.name}>

                      {option.name} — {option.team}

                    </option>

                  ))}

                </datalist>

              </div>

              <div>

                <label className="text-sm font-medium text-foreground" htmlFor={FORM_FIELD_IDS.team}>

                  Tổ đội

                </label>

                <Input

                  id={FORM_FIELD_IDS.team}

                  list="kpi-adjust-team-options"

                  placeholder="Ví dụ: Team 1"

                  value={form.teamName}

                  onChange={(e) => {

                    const nextTeam = e.target.value;

                    setForm((prev) => {

                      const normalized = normalizeStr(nextTeam);

                      if (!normalized) {

                        return { ...prev, teamName: nextTeam };

                      }

                      const currentStaffNormalized = normalizeStr(prev.staffName);

                      if (currentStaffNormalized) {

                        const matched = staffOptions.find(

                          (option) =>

                            normalizeStr(option.name) === currentStaffNormalized &&

                            normalizeStr(option.team) === normalized

                        );

                        if (!matched) {

                          return { ...prev, teamName: nextTeam, staffName: "" };

                        }

                      }

                      return { ...prev, teamName: nextTeam };

                    });

                  }}

                  className="mt-1"

                />

                <datalist id="kpi-adjust-team-options">

                  {teamOptions.map((team) => (

                    <option key={team} value={team}>

                      {team}

                    </option>

                  ))}

                </datalist>

              </div>

              <div>

                <label className="text-sm font-medium text-foreground" htmlFor={FORM_FIELD_IDS.taxCode}>

                  Mã số thuế

                </label>

                <Input

                  id={FORM_FIELD_IDS.taxCode}

                  list="kpi-adjust-taxcode-options"

                  placeholder="Ví dụ: 0312345678"

                  value={form.taxCode}

                  onChange={(e) => handleTaxCodeInput(e.target.value)}

                  className="mt-1"

                />

                <datalist id="kpi-adjust-taxcode-options">

                  {mstOptions.map((option) => (

                    <option key={option.value} value={option.value}>

                      {option.label}

                    </option>

                  ))}

                </datalist>

                <p className="mt-1 text-xs text-muted-foreground">Chọn MST để tự điền tên công ty tương ứng.</p>

              </div>

              <div className="md:col-span-2 xl:col-span-2">

                <label className="text-sm font-medium text-foreground" htmlFor={FORM_FIELD_IDS.company}>

                  Công ty

                </label>

                <Input

                  id={FORM_FIELD_IDS.company}

                  list="kpi-adjust-company-options"

                  placeholder="Nhập tên công ty hoặc chọn từ danh sách"

                  value={form.companyName}

                  onChange={(e) => handleCompanyInput(e.target.value)}

                  className="mt-1"

                />

                <datalist id="kpi-adjust-company-options">

                  {companyOptions.map((option) => (

                    <option key={option.company} value={option.company}>

                      {option.description}

                    </option>

                  ))}

                </datalist>

                <p className="mt-1 text-xs text-muted-foreground">

                  Khi chọn công ty, hệ thống sẽ gợi ý lại MST nếu chưa chính xác.

                </p>

              </div>

              <div>

                <label className="text-sm font-medium text-foreground" htmlFor={FORM_FIELD_IDS.category}>

                  Hạng mục

                </label>

                <select

                  id={FORM_FIELD_IDS.category}

                  className={SELECT_FIELD_CLASS}

                  value={form.category}

                  onChange={(e) => handleCategoryChange(e.target.value)}

                >

                  {CATEGORY_OPTIONS.map((option) => (

                    <option key={option.value} value={option.value}>

                      {option.label}

                    </option>

                  ))}

                </select>

              </div>

              {formCategoryConfig.requiresLicenseCode ? (

                <div>

                  <label className="text-sm font-medium text-foreground" htmlFor={FORM_FIELD_IDS.license}>

                    Mã giấy phép

                  </label>

                  <Input

                    id={FORM_FIELD_IDS.license}

                    list="kpi-adjust-license-options"

                    placeholder="Ví dụ: ZB02"

                    value={form.licenseCode}

                    onChange={(e) => handleLicenseChange(e.target.value)}

                    className="mt-1"

                  />

                  <datalist id="kpi-adjust-license-options">

                    {licenseOptions.map((option) => (

                      <option key={option.value} value={option.value}>

                        {option.label || option.value}

                      </option>

                    ))}

                  </datalist>

                </div>

              ) : null}

              {isEditing && canApprove ? (

                <div>

                  <label className="text-sm font-medium text-foreground" htmlFor={FORM_FIELD_IDS.status}>

                    Trạng thái

                  </label>

                  <select

                    id={FORM_FIELD_IDS.status}

                    className={SELECT_FIELD_CLASS}

                    value={form.status}

                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}

                  >

                    {[...KPI_ADJUSTMENT_STATUS_SET].map((status) => (

                      <option key={status} value={status}>

                        {STATUS_LABELS[status] || status}

                      </option>

                    ))}

                  </select>

                </div>

              ) : null}

            </div>



            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">

              <div className="space-y-4">

                <div>

                  <label className="text-sm font-medium text-foreground" htmlFor={FORM_FIELD_IDS.note}>

                    Mô tả / ghi chú

                  </label>

                  <Textarea

                    id={FORM_FIELD_IDS.note}

                    className="mt-1 min-h-24"

                    value={form.note}

                    onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}

                    placeholder="Nhập ghi chú, lý do cộng/trừ điểm..."

                  />

                </div>

                <div>

                  <label className="text-sm font-medium text-foreground" htmlFor={FORM_FIELD_IDS.references}>

                    Tham chiếu tờ khai / quyết định

                  </label>

                  <Textarea

                    id={FORM_FIELD_IDS.references}

                    className="mt-1 min-h-28"

                    value={form.referencesInput}

                    onChange={(e) => setForm((prev) => ({ ...prev, referencesInput: e.target.value }))}

                    placeholder="Nhập số tờ khai, mỗi dòng một số hoặc ngăn cách bằng dấu phẩy"

                  />

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">

                    <span>Gợi ý gần đây:</span>

                    {quickDeclarationSuggestions.length ? (

                      quickDeclarationSuggestions.map((decl) => (

                        <Button

                          type="button"

                          key={decl.key}

                          variant="outline"

                          size="sm"

                          className="h-7 px-2 text-xs"

                          onClick={() => handleReferencePick(decl)}

                        >

                          {decl.soTk}

                        </Button>

                      ))

                    ) : (

                      <span className="text-muted-foreground">Không có tờ khai gần đây.</span>

                    )}

                    <Button

                      type="button"

                      variant="ghost"

                      size="sm"

                      className="h-7 px-2 text-xs"

                      onClick={handleRefreshDeclarations}

                    >

                      Làm mới danh sách

                    </Button>

                  </div>

                  <div className="mt-3 space-y-3 rounded-xl border border-dashed border-border/60 p-3">

                    <div className="text-xs font-semibold uppercase text-muted-foreground">Tra cứu tờ khai</div>

                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">

                      <div>

                        <Input

                          value={declarationSearch}

                          onChange={(e) => setDeclarationSearch(e.target.value)}

                          placeholder="Tìm theo số tờ khai, MST hoặc tên công ty"

                        />

                        <p className="mt-1 text-xs text-muted-foreground">

                          Chọn kết quả để thêm tham chiếu và tự điền thông tin doanh nghiệp.

                        </p>

                      </div>

                      <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border bg-background/60 p-2 text-xs">

                        {filteredDeclarationResults.length ? (

                          filteredDeclarationResults.map((decl) => (

                            <div

                              key={decl.key}

                              className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-2"

                            >

                              <div className="flex-1">

                                <div className="font-medium text-foreground">{decl.soTk}</div>

                                <div className="text-[11px] text-muted-foreground">

                                  {decl.company || "—"}

                                  {decl.mst ? ` • MST ${decl.mst}` : ""}

                                  {decl.branch ? ` • ${decl.branch}` : ""}

                                  {decl.date ? ` • ${formatDateOnly(decl.date)}` : ""}

                                </div>

                              </div>

                              <Button

                                type="button"

                                variant="secondary"

                                size="sm"

                                className="h-7 px-2 text-xs"

                                onClick={() => handleReferencePick(decl)}

                              >

                                Thêm

                              </Button>

                            </div>

                          ))

                        ) : (

                          <div className="rounded-md bg-muted/40 p-3 text-muted-foreground">

                            {declarationSearch

                              ? "Không tìm thấy tờ khai phù hợp."

                              : "Nhập từ khoá để tra cứu tờ khai."}

                          </div>

                        )}

                      </div>

                    </div>

                  </div>

                </div>

              </div>



              <div className="space-y-4">

                {formCategoryConfig.type === "grade" ? (

                  <div>

                    <div className="text-sm font-medium text-foreground">Chọn mức đánh giá</div>

                    <div className="mt-2 grid gap-2">

                      {(formCategoryConfig.grades || []).map((grade) => (

                        <label

                          key={grade.value}

                          className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground transition hover:bg-muted/60"

                        >

                          <input

                            type="radio"

                            name="gradeValue"

                            value={grade.value}

                            checked={Number(form.gradeValue) === grade.value}

                            onChange={(e) =>

                              setForm((prev) => ({

                                ...prev,

                                gradeValue: Number(e.target.value),

                                unitPoints: Number(e.target.value),

                              }))

                            }

                            className="size-4"

                          />

                          <span>{grade.label}</span>

                        </label>

                      ))}

                    </div>

                  </div>

                ) : (

                  <div className="space-y-3">

                    {formCategoryConfig.type === "hybrid" ? (

                      <div>

                        <label className="text-sm font-medium text-foreground" htmlFor={FORM_FIELD_IDS.mode}>

                          Chế độ tính điểm

                        </label>

                        <select

                          id={FORM_FIELD_IDS.mode}

                          className={SELECT_FIELD_CLASS}

                          value={normalizedMode}

                          onChange={(e) => handleModeChange(e.target.value)}

                        >

                          {modeOptions.map((mode) => (

                            <option key={mode.value} value={mode.value}>

                              {mode.label}

                            </option>

                          ))}

                        </select>

                      </div>

                    ) : null}

                    <div className="grid gap-3 md:grid-cols-2">

                      {!isHybridFixed ? (

                        <div>

                          <label className="text-sm font-medium text-foreground" htmlFor={FORM_FIELD_IDS.quantity}>

                            Số lượng

                          </label>

                          <Input

                            id={FORM_FIELD_IDS.quantity}

                            type="number"

                            min="0"

                            step="1"

                            value={form.quantity}

                            onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}

                            className="mt-1"

                          />

                        </div>

                      ) : null}

                      <div>

                        <label

                          className="text-sm font-medium text-foreground"

                          htmlFor={FORM_FIELD_IDS.unit}

                        >

                          {formCategoryConfig.type === "hybrid" && isHybridFixed ? "Điểm cố định" : "Điểm mỗi đơn vị"}

                        </label>

                        <Input

                          id={FORM_FIELD_IDS.unit}

                          type="number"

                          step="0.1"

                          value={form.unitPoints}

                          onChange={(e) =>
                            setForm((prev) => {
                              if (!allowManualPointOverride) {
                                return prev;
                              }
                              return { ...prev, unitPoints: e.target.value };
                            })
                          }

                          readOnly={!allowManualPointOverride}

                          aria-readonly={!allowManualPointOverride}

                          className={cn(
                            "mt-1",

                            !allowManualPointOverride && "bg-muted/40 text-muted-foreground"
                          )}

                        />

                      </div>

                    </div>

                  {formCategoryConfig.extraPointConfig ? (

                    <div className="grid gap-3 md:grid-cols-2">

                      <div>

                        <label className="text-sm font-medium text-foreground" htmlFor={FORM_FIELD_IDS.extraQuantity}>

                          {formCategoryConfig.extraPointConfig.quantityLabel || "Số lượng bổ sung"}

                        </label>

                        <Input

                          id={FORM_FIELD_IDS.extraQuantity}

                          type="number"

                          min="0"

                          step="1"

                          value={form.extraQuantity}

                          onChange={(e) => setForm((prev) => ({ ...prev, extraQuantity: e.target.value }))}

                          className="mt-1"

                        />

                      </div>

                      <div>

                        <label className="text-sm font-medium text-foreground" htmlFor={FORM_FIELD_IDS.extraUnit}>

                          {formCategoryConfig.extraPointConfig.unitLabel || "Điểm bổ sung mỗi đơn vị"}

                        </label>

                        <Input

                          id={FORM_FIELD_IDS.extraUnit}

                          type="number"

                          step="0.1"

                          value={form.extraUnitPoints}

                          onChange={(e) =>
                            setForm((prev) => {
                              if (!allowManualPointOverride) {
                                return prev;
                              }
                              return { ...prev, extraUnitPoints: e.target.value };
                            })
                          }

                          readOnly={!allowManualPointOverride}

                          aria-readonly={!allowManualPointOverride}

                          className={cn(
                            "mt-1",

                            !allowManualPointOverride && "bg-muted/40 text-muted-foreground"
                          )}

                        />

                      </div>

                    </div>

                  ) : null}

                  </div>

                )}



                <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">

                  <div className="text-xs font-medium uppercase text-muted-foreground">Điểm dự kiến</div>

                  <div data-testid="kpi-adjust-total-value" className="mt-1 text-lg font-semibold text-foreground">

                    {formatDecimal(computedTotal)}

                  </div>

                </div>

              </div>

            </div>



            {formError ? (

              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">

                {formError}

              </div>

            ) : null}



            <div className="flex flex-wrap items-center gap-3">

              <Button type="submit" disabled={!canSubmit}>

                {isEditing ? "Cập nhật điểm" : "Thêm điểm KPI"}

              </Button>

              {isEditing ? (

                <Button type="button" variant="outline" onClick={resetForm}>

                  Hủy chỉnh sửa

                </Button>

              ) : null}

            </div>



            {isEditing && historyEntries.length ? (

              <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">

                <div className="font-semibold text-foreground">Lịch sử cập nhật</div>

                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">

                  {historyEntries.map((entry) => (

                    <li key={entry.id} className="flex items-center justify-between gap-3">

                      <span>{formatDateTime(entry.ts)}</span>

                      <span className="flex-1 text-foreground">{entry.actor || "system"}</span>

                      <span>{entry.action || "update"}</span>

                    </li>

                  ))}

                </ul>

              </div>

            ) : null}

          </form>

        </CardContent>

      </Card>



      <Card>

        <CardHeader>

          <CardTitle className="text-lg font-semibold text-foreground">Danh sách điểm KPI +/-</CardTitle>

          <CardDescription>Lọc và duyệt các đề xuất cộng/trừ điểm.</CardDescription>

        </CardHeader>

        <CardContent>

          <div className="grid gap-4 text-sm md:grid-cols-3">

            <div>

              <label className="text-sm font-medium text-foreground" htmlFor={FORM_FIELD_IDS.filterMonth}>

                Lọc theo tháng

              </label>

              <Input

                id={FORM_FIELD_IDS.filterMonth}

                type="month"

                value={filterMonth === "all" ? "" : filterMonth}

                onChange={(e) => setFilterMonth(e.target.value || "all")}

                className="mt-1"

              />

            </div>

            <div>

              <label className="text-sm font-medium text-foreground" htmlFor={FORM_FIELD_IDS.filterStatus}>

                Trạng thái

              </label>

              <select

                id={FORM_FIELD_IDS.filterStatus}

                className={SELECT_FIELD_CLASS}

                value={filterStatus}

                onChange={(e) => setFilterStatus(e.target.value)}

              >

                <option value="all">Tất cả</option>

                <option value="approved">Đã duyệt</option>

                <option value="pending">Chờ duyệt</option>

                <option value="rejected">Đã từ chối</option>

              </select>

            </div>

          </div>



          <div className="mt-6 overflow-hidden rounded-xl border border-border">

            <table className="min-w-full text-sm">

              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">

                <tr className="text-left">

                  <th className="px-4 py-2">Tháng</th>

                  <th className="px-4 py-2">Hạng mục</th>

                  <th className="px-4 py-2">Công ty</th>

                  <th className="px-4 py-2">Mã số thuế</th>

                  <th className="px-4 py-2">Nhân viên</th>

                  <th className="px-4 py-2">Tổ đội</th>

                  <th className="px-4 py-2 text-right">Điểm</th>

                  <th className="px-4 py-2">Trạng thái</th>

                  <th className="px-4 py-2">Cập nhật</th>

                  <th className="px-4 py-2">Hành động</th>

                </tr>

              </thead>

              <tbody className="divide-y divide-border/60 text-foreground">

                {filteredAdjustments.length ? (

                  filteredAdjustments.map((item) => {

                    const label = KPI_ADJUSTMENT_CATEGORY_CONFIG[item.category]?.label || item.category;

                    const statusLabel = STATUS_LABELS[item.status] || item.status;

                    const rowConfig = KPI_ADJUSTMENT_CATEGORY_CONFIG[item.category] || {};

                    const statusClass = cn(

                      "rounded-md px-2 py-1 text-xs font-medium",

                      item.status === "approved"

                        ? "bg-emerald-500/10 text-emerald-600"

                        : item.status === "rejected"

                        ? "bg-rose-500/10 text-rose-600"

                        : "bg-amber-500/10 text-amber-600"

                    );

                    const extraQuantity =

                      rowConfig.extraPointConfig ? Number.parseFloat(item.extraQuantity ?? 0) || 0 : 0;

                    const extraUnitPoints =

                      rowConfig.extraPointConfig

                        ? Number.parseFloat(

                            item.extraUnitPoints ??

                              (rowConfig.extraPointConfig.defaultUnit ?? 0)

                          ) || 0

                        : 0;

                    const extraTotal =

                      rowConfig.extraPointConfig

                        ? roundAdjustmentPoint(extraQuantity * extraUnitPoints)

                        : 0;

                    return (

                      <tr key={item.id} className="odd:bg-background even:bg-muted/30">

                        <td className="px-4 py-2 align-top">{item.month || "—"}</td>

                        <td className="px-4 py-2 align-top">

                          <div className="flex flex-col gap-1">

                            <span className="font-medium text-foreground">{label}</span>

                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">

                              {item.mode ? (

                                <Badge variant="outline" className="border-dashed">

                                  Chế độ: {item.mode === "fixed" ? "Cố định" : "Linh hoạt"}

                                </Badge>

                              ) : null}

                              {item.licenseCode ? (

                                <Badge variant="outline">GP: {item.licenseCode}</Badge>

                              ) : null}

                              {rowConfig.groupLabel ? (

                                <Badge variant="outline">{rowConfig.groupLabel}</Badge>

                              ) : null}

                              {rowConfig.extraPointConfig && extraQuantity > 0 ? (

                                <Badge variant="outline">

                                  Bổ sung: {formatDecimal(extraQuantity)} x {formatDecimal(extraUnitPoints)} ({formatDecimal(extraTotal)})

                                </Badge>

                              ) : null}

                            </div>

                          </div>

                        </td>

                        <td className="px-4 py-2 align-top">{item.companyName || "—"}</td>

                        <td className="px-4 py-2 align-top">{item.taxCode || "—"}</td>

                        <td className="px-4 py-2 align-top">{item.staffName || "Chưa gán"}</td>

                        <td className="px-4 py-2 align-top">{item.teamName || "—"}</td>

                        <td

                          className={cn(

                            "px-4 py-2 text-right font-semibold",

                            item.totalPoints >= 0 ? "text-emerald-600" : "text-rose-600"

                          )}

                        >

                          {formatDecimal(item.totalPoints)}

                        </td>

                        <td className="px-4 py-2 align-top">

                          <span className={statusClass}>{statusLabel}</span>

                        </td>

                        <td className="px-4 py-2 align-top text-muted-foreground">

                          {formatDateTime(item.updatedAt || item.createdAt)}

                        </td>

                        <td className="px-4 py-2 align-top">

                          <div className="flex flex-wrap gap-2">

                            <Button variant="outline" size="sm" type="button" onClick={() => handleEdit(item)}>

                              Sửa

                            </Button>

                            <Button variant="ghost" size="sm" type="button" onClick={() => setDetailEntry({ entry: item, intent: "view" })}>

                              Chi tiết

                            </Button>

                            {canApprove ? (

                              <>

                                {item.status !== "approved" ? (

                                  <Button

                                    size="sm"

                                    type="button"

                                    onClick={() => setDetailEntry({ entry: item, intent: "approve" })}

                                  >

                                    Duyệt

                                  </Button>

                                ) : null}

                                {item.status !== "rejected" ? (

                                  <Button

                                    variant="destructive"

                                    size="sm"

                                    type="button"

                                    onClick={() => setDetailEntry({ entry: item, intent: "reject" })}

                                  >

                                    Từ chối

                                  </Button>

                                ) : null}

                              </>

                            ) : null}

                            <Button

                              variant="ghost"

                              size="sm"

                              className="text-destructive hover:bg-destructive/10"

                              type="button"

                              onClick={() => handleDelete(item)}

                            >

                              Xóa

                            </Button>

                          </div>

                        </td>

                      </tr>

                    );

                  })

                ) : (

                  <tr>

                    <td className="px-4 py-6 text-center text-muted-foreground" colSpan={10}>

                      Không có điểm KPI bổ sung nào phù hợp với bộ lọc hiện tại.

                    </td>

                  </tr>

                )}

              </tbody>

            </table>

          </div>

        </CardContent>

      </Card>

    </div>

  );

}


