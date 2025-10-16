import React, { useEffect, useMemo, useState } from "react";
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
  getDeclRows,
  sortDeclRows,
  normalizeStr,
} from "@/lib/store.js";
import { subscribe as subscribeStorage } from "@/lib/storageClient.js";
import { Button } from "@/components/ui/button.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card.jsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Textarea } from "@/components/ui/textarea.jsx";
import { cn } from "@/lib/utils.js";

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
  license: "kpi-adjust-license",
  status: "kpi-adjust-status",
  note: "kpi-adjust-note",
  references: "kpi-adjust-references",
  mode: "kpi-adjust-mode",
  quantity: "kpi-adjust-quantity",
  unit: "kpi-adjust-unit",
  filterMonth: "kpi-adjust-filter-month",
  filterStatus: "kpi-adjust-filter-status",
  decisionNote: "kpi-adjust-decision-note",
});

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
    ? num.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
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
  return Number.isFinite(num) ? Math.round(num * 10) / 10 : undefined;
}

function resolveCategoryDefaults(category, settings) {
  const config = KPI_ADJUSTMENT_CATEGORY_CONFIG[category] || {};
  const overrides = settings?.categories?.[category] || {};

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
    };
  }

  const unitPoints = normalizeUnitValue(overrides.defaultUnit) ?? normalizeUnitValue(config.defaultUnit) ?? 0;
  return {
    quantity: 1,
    unitPoints,
    gradeValue: null,
    mode: "",
    licenseCode: "",
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

const initialFormState = (month = getCurrentMonth(), settings) => {
  const defaults = resolveCategoryDefaults("support_fixed", settings);
  return {
    id: null,
    category: "support_fixed",
    month,
    staffName: "",
    teamName: "",
    quantity: defaults.quantity,
    unitPoints: defaults.unitPoints,
    gradeValue: defaults.gradeValue,
    mode: defaults.mode,
    licenseCode: defaults.licenseCode || "",
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
  const [recentDeclarations, setRecentDeclarations] = useState(() => {
    const rows = sortDeclRows(getDeclRows());
    return rows.slice(-20).reverse();
  });
  const [filterMonth, setFilterMonth] = useState(getCurrentMonth());
  const [filterStatus, setFilterStatus] = useState("all");
  const [form, setForm] = useState(() => initialFormState(undefined, settings));
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState("");
  const [detailEntry, setDetailEntry] = useState(null);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState({});
  const [settingsError, setSettingsError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [decisionNote, setDecisionNote] = useState("");
  const canSubmit = currentUser?.permissions?.adjustSubmit !== false;
  const canApprove = !!currentUser?.permissions?.adjustApprove;
  const actor = currentUser?.username || currentUser?.name || "ui";

  useEffect(() => {
    const unsubscribe = subscribeStorage(KPI_ADJUSTMENTS_KEY, () => {
      setAdjustments(getKpiAdjustments());
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeStorage(KPI_ADJUSTMENT_SETTINGS_KEY, () => {
      setSettings(getKpiAdjustmentSettings());
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setRoster(getTeamRoster());
  }, [currentUser]);

  useEffect(() => {
    if (!detailEntry) {
      setDecisionNote("");
    }
  }, [detailEntry]);

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

  const handleRefreshDeclarations = () => {
    const rows = sortDeclRows(getDeclRows());
    setRecentDeclarations(rows.slice(-20).reverse());
  };

  const handleCategoryChange = (value) => {
    const defaults = resolveCategoryDefaults(value, settings);
    setForm((prev) => ({
      ...prev,
      category: value,
      quantity: defaults.quantity,
      unitPoints: defaults.unitPoints,
      gradeValue: defaults.gradeValue,
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
      quantity: entry.quantity ?? defaults.quantity,
      unitPoints: entry.unitPoints ?? defaults.unitPoints,
      gradeValue: entry.unitPoints ?? defaults.gradeValue,
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
    setForm(initialFormState(filterMonth && filterMonth !== "all" ? filterMonth : getCurrentMonth(), settings));
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
    if (categoryConfig.type === "grade") {
      payload.quantity = 1;
      payload.unitPoints = Number(form.gradeValue ?? form.unitPoints ?? 0);
    } else {
      payload.quantity = Number(form.quantity || 0) || 0;
      payload.unitPoints = Number(form.unitPoints || 0) || 0;
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
  const computedTotal = (() => {
    if (formCategoryConfig.type === "grade") {
      return Math.round(computedUnit * 10) / 10;
    }
    if (formCategoryConfig.type === "hybrid" && isHybridFixed) {
      return Math.round(computedUnit * 10) / 10;
    }
    return Math.round((computedQuantity || 0) * computedUnit * 10) / 10;
  })();
  const detailData = detailEntry?.entry || null;
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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Hướng dẫn nhập điểm KPI +/-</DialogTitle>
            <DialogDescription>Những điểm mới khi ghi nhận điểm cộng/trừ bổ sung.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-foreground">
            <p>
              • Hạng mục "Đi làm muộn" đã được loại bỏ. Thay vào đó, bổ sung các mục "Hỗ trợ xin giấy phép", "Hỗ trợ khác" và
              "Sửa tờ khai bổ sung C/O" với cách tính điểm riêng.
            </p>
            <p>
              • "Hỗ trợ thông quan" được tách thành luồng xanh (0.1 điểm) và luồng vàng/đỏ (0.25 điểm) để phản ánh đúng mức độ
              hỗ trợ.
            </p>
            <p>
              • Với "Hỗ trợ khác", chọn chế độ điểm cố định hoặc linh hoạt theo số lượng (0.1 điểm/đơn vị) tuỳ tình huống.
            </p>
            <p>
              • Khi chọn "Hỗ trợ xin giấy phép", hệ thống gợi ý điểm theo mã (ZB02 = 2 điểm, ZB03/khác = 1.5 điểm) và có thể điều
              chỉnh trong phần cấu hình.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setGuidanceOpen(false)}>
              Đã rõ
            </Button>
          </DialogFooter>
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
                    {recentDeclarations.slice(0, 5).map((decl) => (
                      <Button
                        type="button"
                        key={`${decl.date}-${decl.so_tk}`}
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            referencesInput: parseReferences(`${prev.referencesInput}\n${decl.so_tk}`).join("\n"),
                          }))
                        }
                      >
                        {decl.so_tk}
                      </Button>
                    ))}
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
                          onChange={(e) => setForm((prev) => ({ ...prev, unitPoints: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                    </div>
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
                            </div>
                          </div>
                        </td>
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
                    <td className="px-4 py-6 text-center text-muted-foreground" colSpan={8}>
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
