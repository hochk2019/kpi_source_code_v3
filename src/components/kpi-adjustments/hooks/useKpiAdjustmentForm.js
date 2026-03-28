import { useCallback, useEffect, useState } from "react";

import {
  getKpiAdjustmentSettings,
  getKpiAdjustments,
  KPI_ADJUSTMENT_CATEGORY_CONFIG,
  normalizeMST,
  normalizeStr,
  saveKpiAdjustment,
  saveKpiAdjustmentSettings,
} from "@/lib/store.js";

import {
  resolveCategoryDefaults,
  resolveLicenseUnit,
  normalizeUnitValue,
} from "../model/calculationInfo.js";
import { buildSettingsDraft } from "../model/settingsDraft.js";

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function initialFormState(month = getCurrentMonth(), settings, presets = {}) {
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
}

export function useKpiAdjustmentForm({
  currentUser,
  settings,
  setSettings,
  filterMonth,
  staffDefaults,
  canApprove,
  canSubmit,
  parseReferences,
  setAdjustments,
}) {
  const [form, setForm] = useState(() => initialFormState(undefined, settings, staffDefaults));
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsFocusCategory, setSettingsFocusCategory] = useState("");
  const [settingsDraft, setSettingsDraft] = useState({});
  const [settingsError, setSettingsError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);

  const actor = currentUser?.username || currentUser?.name || "ui";
  const defaultStaffName = staffDefaults?.staffName || "";
  const defaultTeamName = staffDefaults?.teamName || "";

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

  const handleCategoryChange = useCallback(
    (value) => {
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
    },
    [settings]
  );

  const handleModeChange = useCallback(
    (nextMode) => {
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
        const overrideUnit =
          override.modeUnits && typeof override.modeUnits === "object"
            ? override.modeUnits[normalizedMode]
            : undefined;
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
    },
    [settings]
  );

  const handleLicenseChange = useCallback(
    (nextCode) => {
      setForm((prev) => {
        const normalized = normalizeStr(nextCode || "").toUpperCase();
        const unitPoints = resolveLicenseUnit(prev.category, normalized, settings);
        return {
          ...prev,
          licenseCode: normalized,
          unitPoints,
        };
      });
    },
    [settings]
  );

  const handleEdit = useCallback(
    (entry) => {
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
    },
    [settings]
  );

  const resetForm = useCallback(() => {
    setForm(
      initialFormState(
        filterMonth && filterMonth !== "all" ? filterMonth : getCurrentMonth(),
        settings,
        staffDefaults
      )
    );
    setIsEditing(false);
    setFormError("");
  }, [filterMonth, settings, staffDefaults]);

  const handleSubmit = useCallback(
    (event) => {
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
          payload.licenseCode =
            normalizeStr(categoryConfig.licenseOptions[0].value || "").toUpperCase() || undefined;
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
    },
    [actor, canApprove, canSubmit, currentUser?.permissions, form, parseReferences, resetForm, setAdjustments, settings]
  );

  const openSettingsDialog = useCallback((category) => {
    const normalizedCategory = normalizeStr(category || "").toLowerCase();
    setSettingsFocusCategory(
      normalizedCategory && KPI_ADJUSTMENT_CATEGORY_CONFIG[normalizedCategory] ? normalizedCategory : ""
    );
    setSettingsDraft(buildSettingsDraft(settings));
    setSettingsError("");
    setSettingsOpen(true);
  }, [settings]);

  const closeSettingsDialog = useCallback(() => {
    if (!settingsSaving) {
      setSettingsOpen(false);
      setSettingsFocusCategory("");
    }
  }, [settingsSaving]);

  const updateSettingsDraft = useCallback((category, path, value) => {
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
  }, []);

  const handleSettingsReset = useCallback(() => {
    setSettingsDraft(buildSettingsDraft({}));
  }, []);

  const handleSettingsSubmit = useCallback(
    (event) => {
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
          entryPayload.defaultMode = normalizedMode || null;
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

        if (Object.prototype.hasOwnProperty.call(draftEntry, "extraUnitPoints")) {
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
        setSettingsFocusCategory("");
      } catch (err) {
        console.error(err);
        setSettingsError(err?.message || "Không thể lưu cấu hình mặc định.");
      } finally {
        setSettingsSaving(false);
      }
    },
    [actor, canApprove, currentUser?.permissions, setSettings, settingsDraft]
  );

  return {
    form,
    setForm,
    isEditing,
    setIsEditing,
    formError,
    setFormError,
    settingsOpen,
    setSettingsOpen,
    settingsFocusCategory,
    settingsDraft,
    settingsError,
    settingsSaving,
    handleCategoryChange,
    handleModeChange,
    handleLicenseChange,
    handleEdit,
    resetForm,
    handleSubmit,
    openSettingsDialog,
    closeSettingsDialog,
    updateSettingsDraft,
    handleSettingsReset,
    handleSettingsSubmit,
  };
}
