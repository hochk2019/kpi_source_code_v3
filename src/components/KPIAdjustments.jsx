import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  getDeclRows,
  getKpiAdjustments,
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
  normalizeStr,
  normalizeMST,
  normalizeName,
  roundAdjustmentPoint,
  sortDeclRows,
  DECL_KEY,
  MST_KEY,
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

import { Input } from "@/components/ui/input.jsx";
import { Switch } from "@/components/ui/switch.jsx";

import { Textarea } from "@/components/ui/textarea.jsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.jsx";

import { cn } from "@/lib/utils.js";
import {
  buildBusinessDirectory,
  buildDeclarationSuggestions,
  extractDigits,
  MAX_DECLARATION_SUGGESTIONS,
} from "@/components/kpi-adjustments/model/businessDirectory.js";
import { buildGuidanceGroups } from "@/components/kpi-adjustments/model/guidanceGroups.js";
import { useKpiAdjustmentForm } from "@/components/kpi-adjustments/hooks/useKpiAdjustmentForm.js";
import { useKpiAdjustmentFilters } from "@/components/kpi-adjustments/hooks/useKpiAdjustmentFilters.js";
import KpiAdjustmentDetailDialog from "@/components/kpi-adjustments/panels/KpiAdjustmentDetailDialog.jsx";
import KpiAdjustmentGuidanceDialog from "@/components/kpi-adjustments/panels/KpiAdjustmentGuidanceDialog.jsx";
import KpiAdjustmentSettingsDialog from "@/components/kpi-adjustments/panels/KpiAdjustmentSettingsDialog.jsx";

import { Sparkles } from "lucide-react";



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

  filterMine: "kpi-adjust-filter-mine",

  filterStaff: "kpi-adjust-filter-staff",

  decisionNote: "kpi-adjust-decision-note",

});



function formatDateOnly(value) {

  if (!value) return "";

  const ts = Date.parse(value);

  if (!Number.isFinite(ts)) return "";

  try {

    return new Date(ts).toLocaleDateString("vi-VN");

  } catch {

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

const EMPTY_BUSINESS_DIRECTORY = Object.freeze({
  entries: [],
  byMst: new Map(),
  byCompany: new Map(),
});



const SELECT_FIELD_CLASS =

  "mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring/40";



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



export default function KPIAdjustments({ currentUser }) {

  const [settings, setSettings] = useState(() => getKpiAdjustmentSettings());

  const [adjustments, setAdjustments] = useState(() => getKpiAdjustments());

  const [roster, setRoster] = useState(() => getTeamRoster());

  const [businessData, setBusinessData] = useState(() => {

    const suggestions = buildDeclarationSuggestions(MAX_DECLARATION_SUGGESTIONS);

    return { suggestions, directory: buildBusinessDirectory(suggestions) };

  });

  const declarationSuggestions = useMemo(() => businessData.suggestions ?? [], [businessData.suggestions]);

  const businessDirectory = useMemo(
    () => businessData.directory ?? EMPTY_BUSINESS_DIRECTORY,
    [businessData.directory]
  );

  const [detailEntry, setDetailEntry] = useState(null);

  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [guidanceFullscreen, setGuidanceFullscreen] = useState(false);

  const [declarationSearch, setDeclarationSearch] = useState("");

  const permissions = currentUser?.permissions || {};
  const isAuthenticated = Boolean(currentUser);
  const canApprove = permissions.adjustApprove === true;
  const canSubmit = permissions.adjustSubmit === true || canApprove;
  const canOverridePoints = permissions.adjustOverridePoints === true || canApprove;
  const staffDefaults = useMemo(() => resolveStaffDefaults(currentUser, roster), [currentUser, roster]);
  const currentStaffKey = normalizeName(staffDefaults.staffName || "");

  const staffOptions = useMemo(() => buildStaffOptions(roster), [roster]);

  const {
    filterMonth,
    setFilterMonth,
    filterStatus,
    setFilterStatus,
    showMineOnly,
    staffFilter,
    setStaffFilter,
    staffFilterOptions,
    handleMineToggle,
    filteredAdjustments,
  } = useKpiAdjustmentFilters({
    adjustments,
    staffOptions,
    currentStaffKey,
    canApprove,
    isAuthenticated,
  });

  const {
    form,
    setForm,
    isEditing,
    formError,
    settingsOpen,
    setSettingsOpen,
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
  } = useKpiAdjustmentForm({
    currentUser,
    settings,
    setSettings,
    filterMonth,
    staffDefaults,
    canApprove,
    canSubmit,
    parseReferences,
    setAdjustments,
  });

  const showMineToggle = isAuthenticated && !!currentStaffKey;

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

    const digits = extractDigits(rawQuery);

    const normalizedQuery = normalizeName(rawQuery);

    const primaryResults = declarationSuggestions

      .filter((item) => {

        if (!item) return false;

        if (digits) {

          if ((item.soTkDigits || "").includes(digits)) return true;

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

        const rawNumber = row?.so_tk_full ?? row?.so_tk ?? "";

        const soTkDigits = extractDigits(rawNumber);

        const soTkValue = normalizeStr(rawNumber);

        const mstDigits = normalizeMST(row?.mst ?? row?.ma_so_thue ?? row?.taxCode ?? "");

        const hasMatch =

          (soTkDigits && soTkDigits.includes(digits)) ||

          (mstDigits && mstDigits.includes(digits));

        if (!hasMatch) {

          continue;

        }

        const branch = normalizeStr(row?.nhanh ?? row?.branch ?? "");

        const key = `${soTkDigits || soTkValue}|${branch}`;

        if (seenKeys.has(key)) {

          continue;

        }

        seenKeys.add(key);

        fallback.push({

          key,

          soTk: soTkValue,

          soTkDigits,

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

    [mergeBusinessInfo, setForm]

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

    [mergeBusinessInfo, setForm]

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

    [mergeBusinessInfo, setForm]

  );



  const handleReferencePick = useCallback(

    (item) => {

      if (!item) return;

      appendReference(item.soTk, { mst: item.mst, company: item.company });

    },

    [appendReference]

  );

  const [autoApproveSaving, setAutoApproveSaving] = useState(false);
  const [autoApproveError, setAutoApproveError] = useState("");

  const [decisionNote, setDecisionNote] = useState("");

  const actor = currentUser?.username || currentUser?.name || "ui";

  const autoApproveSettings = settings?.autoApprove || {};

  const autoApproveEnabled = autoApproveSettings.enabled === true;

  const autoApproveUpdatedBy = autoApproveSettings.updatedBy || "";

  const autoApproveUpdatedAt = autoApproveSettings.updatedAt || "";

  const autoApproveNote = autoApproveSettings.note || "";


  const autoApproveStatusMessage = useMemo(() => {

    if (autoApproveEnabled) {

      const details = [];

      if (autoApproveUpdatedBy) {

        details.push(`bat boi ${autoApproveUpdatedBy}`);

      }

      if (autoApproveUpdatedAt) {

        details.push(formatDateTime(autoApproveUpdatedAt));

      }

      if (autoApproveNote) {

        details.push(`Ghi chu: ${autoApproveNote}`);

      }

      const suffix = details.length ? ` (${details.join(" · ")})` : "";

      return `Duyet tu dong dang bat${suffix}`;

    }

    return "Duyet tu dong dang tat";

  }, [autoApproveEnabled, autoApproveUpdatedAt, autoApproveUpdatedBy, autoApproveNote]);



  useEffect(() => {

    const unsubscribe = subscribeStorage(KPI_ADJUSTMENTS_KEY, () => {

      setAdjustments(getKpiAdjustments());

    });

    return () => unsubscribe?.();

  }, []);



  useEffect(() => {

    const unsubscribe = subscribeStorage(KPI_ADJUSTMENT_SETTINGS_KEY, () => {

      const latestSettings = getKpiAdjustmentSettings();
      setSettings((prev) => {
        const previousAuto = prev?.autoApprove || {};
        const latestAuto = latestSettings.autoApprove || {};
        if (
          latestAuto &&
          latestAuto.updatedAt === null &&
          latestAuto.updatedBy === null &&
          previousAuto.updatedAt
        ) {
          return prev;
        }
        return latestSettings;
      });

    });

    return () => unsubscribe?.();

  }, []);


  useEffect(() => {

    if (autoApproveError) {

      setAutoApproveError("");

    }

  }, [autoApproveEnabled, autoApproveError]);



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



  const handleRefreshDeclarations = useCallback(() => {

    refreshBusinessData();

  }, [refreshBusinessData]);



  const handleToggleAutoApprove = () => {

    if (!canApprove || autoApproveSaving) {

      return;

    }

    setAutoApproveError("");

    setAutoApproveSaving(true);

    try {

      const updatedSettings = saveKpiAdjustmentSettings(

        { autoApprove: { enabled: !autoApproveEnabled } },

        { actor, permissions: currentUser?.permissions || {} }

      );

      setSettings(updatedSettings);

    } catch (err) {

      console.error(err);

      setAutoApproveError(err?.message || "Khong the cap nhat duyet tu dong.");

    } finally {

      setAutoApproveSaving(false);

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



  const formCategoryConfig = KPI_ADJUSTMENT_CATEGORY_CONFIG[form.category] || {};

  const historyEntries = Array.isArray(form.history) ? form.history.slice().reverse() : [];

  const modeOptions = Array.isArray(formCategoryConfig.modes) ? formCategoryConfig.modes : [];

  const baseLicenseOptions = Array.isArray(formCategoryConfig.licenseOptions)
    ? formCategoryConfig.licenseOptions
    : [];
  let licenseOptions = baseLicenseOptions.map((opt) => {
    if (!opt) return opt;
    const code = String(opt.value || '').toUpperCase();
    let label = opt.label || opt.value;
    if (code === 'ZB02') label = 'ZB02 - Xin cấp phép tiền chất CN';
    else if (code === 'ZB03') label = 'ZB03 - Khai báo hóa chất';
    return { ...opt, value: code, label };
  });
  if (!licenseOptions.some((o) => String(o?.value || '').toUpperCase() === 'ZB99')) {
    licenseOptions = [...licenseOptions, { value: 'ZB99', label: 'ZB99 - Giấy phép khác' }];
  }

  const normalizedMode = normalizeStr(form.mode || "").toLowerCase();

  const isHybridFixed = formCategoryConfig.type === "hybrid" && normalizedMode === "fixed";

  const computedQuantity = Number.parseFloat(form.quantity ?? 0) || 0;

  const computedUnit =

    formCategoryConfig.type === "grade"

      ? Number.parseFloat(form.gradeValue ?? form.unitPoints ?? 0) || 0

      : Number.parseFloat(form.unitPoints ?? 0) || 0;

  const computedExtraQuantity = Number.parseFloat(form.extraQuantity ?? 0) || 0;

  const computedExtraUnit = Number.parseFloat(form.extraUnitPoints ?? 0) || 0;

  const computedExtraTotal = roundAdjustmentPoint(computedExtraQuantity * computedExtraUnit);

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

    return roundAdjustmentPoint(baseTotal + computedExtraTotal);

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



      <KpiAdjustmentDetailDialog
        open={Boolean(detailEntry)}
        detailLabel={detailLabel}
        detailData={detailData}
        detailCategoryConfig={detailCategoryConfig}
        detailExtraQuantity={detailExtraQuantity}
        detailExtraUnit={detailExtraUnit}
        detailExtraTotal={detailExtraTotal}
        detailIntent={detailIntent}
        statusLabels={STATUS_LABELS}
        formatDecimal={formatDecimal}
        formatDateTime={formatDateTime}
        decisionNote={decisionNote}
        onDecisionNoteChange={setDecisionNote}
        showClearLicenseAction={Boolean(form.licenseCode)}
        onClearLicenseCode={() => handleLicenseChange("")}
        onClose={closeDetailDialog}
        onConfirm={handleDetailConfirm}
        decisionNoteFieldId={FORM_FIELD_IDS.decisionNote}
      />



      <KpiAdjustmentGuidanceDialog
        open={guidanceOpen}
        fullscreen={guidanceFullscreen}
        guidanceGroups={guidanceGroups}
        formatDecimal={formatDecimal}
        onOpenChange={setGuidanceOpen}
        onToggleFullscreen={() => setGuidanceFullscreen((current) => !current)}
        onOpenSettings={() => {
          setGuidanceOpen(false);
          openSettingsDialog();
        }}
      />

      <KpiAdjustmentSettingsDialog
        open={settingsOpen}
        settingsDraft={settingsDraft}
        settingsError={settingsError}
        settingsSaving={settingsSaving}
        onOpenChange={(open) => (open ? setSettingsOpen(true) : closeSettingsDialog())}
        onClose={closeSettingsDialog}
        onReset={handleSettingsReset}
        onSubmit={handleSettingsSubmit}
        onUpdateDraft={updateSettingsDraft}
        buildSettingsFieldId={buildSettingsFieldId}
        buildLicenseFieldId={buildLicenseFieldId}
      />



      <Card>

        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <CardTitle className="text-lg font-semibold text-foreground">Thêm điểm KPI +/-</CardTitle>

            <CardDescription>Ghi nhận cộng/trừ điểm cho từng nhân viên.</CardDescription>

          </div>

          <div className="flex flex-col items-stretch gap-2 sm:items-end">

            <div className="flex flex-wrap gap-2 sm:justify-end">

              {canApprove ? (

                <Button

                  type="button"

                  variant={autoApproveEnabled ? "default" : "outline"}

                  size="sm"

                  onClick={handleToggleAutoApprove}

                  disabled={autoApproveSaving}

                  aria-pressed={autoApproveEnabled}

                  data-testid="auto-approve-toggle"

                >

                  <Sparkles className="mr-1 h-4 w-4" />

                  {autoApproveSaving

                    ? "Dang cap nhat..."

                    : autoApproveEnabled

                      ? "Tat duyet tu dong"

                      : "Bat duyet tu dong"}

                </Button>

              ) : null}

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

            <p className="text-xs text-muted-foreground sm:text-right">{autoApproveStatusMessage}</p>

            {canApprove && autoApproveError ? (

              <p className="text-xs text-destructive sm:text-right">{autoApproveError}</p>

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
                    {'M\u00E3 gi\u1EA5y ph\u00E9p'}
                  </label>

                  <div className="mt-1 flex items-center gap-2">
                  <Input

                    id={FORM_FIELD_IDS.license}

                    list="kpi-adjust-license-options"

                    placeholder={'V\u00ED d\u1EE5: ZB02'}

                    value={form.licenseCode}

                    onChange={(e) => handleLicenseChange(e.target.value)}

                    className="flex-1"

                  />
                    {form.licenseCode ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleLicenseChange("")}
                        className="px-2 py-1"
                        data-tooltip="X\u00F3a m\u00E3 gi\u1EA5y ph\u00E9p"
                        aria-label="X\u00F3a m\u00E3 gi\u1EA5y ph\u00E9p"
                      >
                        {'X\u00F3a'}
                      </Button>
                    ) : null}
                  </div>

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

                    <div className="grid gap-3 md:grid-cols-3">

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

                        <Tooltip>

                          <TooltipTrigger asChild>

                            <label className="text-sm font-medium text-foreground" htmlFor={FORM_FIELD_IDS.extraUnit}>

                              {formCategoryConfig.extraPointConfig.unitLabel || "Điểm bổ sung mỗi đơn vị"}

                            </label>

                          </TooltipTrigger>

                          <TooltipContent sideOffset={8} className="max-w-xs text-xs leading-relaxed">

                            Điểm bổ sung mỗi tờ khai

                          </TooltipContent>

                        </Tooltip>

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

                      <div className="flex flex-col">

                        <span className="text-sm font-medium text-foreground">Điểm bổ sung</span>

                        <span aria-live="polite" className="mt-1 text-base font-semibold text-foreground">

                          {formatDecimal(computedExtraTotal)}

                        </span>

                        <p className="mt-1 text-xs text-muted-foreground">

                          Giá trị được tính bằng Số lượng bổ sung nhân với Điểm bổ sung mỗi đơn vị.

                        </p>

                      </div>

                    </div>

                  ) : null}

                  </div>

                )}



                <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">

                  <div className="text-xs font-medium uppercase text-muted-foreground">Điểm dự kiến</div>

                  <div

                    data-testid="kpi-adjust-total-value"

                    className="mt-1 text-lg font-semibold text-foreground"

                    aria-live="polite"

                  >

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

          <div className="grid gap-4 text-sm md:grid-cols-4">

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

            {showMineToggle ? (
              <div>
                <label className="text-sm font-medium text-foreground" htmlFor={FORM_FIELD_IDS.filterMine}>
                  Chỉ hiển thị điểm bổ sung của tôi
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <Switch
                    id={FORM_FIELD_IDS.filterMine}
                    checked={showMineOnly}
                    onCheckedChange={handleMineToggle}
                    disabled={!currentStaffKey}
                  />
                  <span className="text-xs text-muted-foreground">
                    {showMineOnly ? "Đang lọc theo chính bạn" : "Đang xem tất cả"}
                  </span>
                </div>
              </div>
            ) : null}

            {canApprove ? (
              <div>
                <label className="text-sm font-medium text-foreground" htmlFor={FORM_FIELD_IDS.filterStaff}>
                  Lọc theo nhân viên
                </label>
                <select
                  id={FORM_FIELD_IDS.filterStaff}
                  className={SELECT_FIELD_CLASS}
                  value={staffFilter}
                  onChange={(e) => setStaffFilter(e.target.value)}
                  disabled={showMineOnly || staffFilterOptions.length === 0}
                >
                  <option value="all">Tất cả</option>
                  {staffFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

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




