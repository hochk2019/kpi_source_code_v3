import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
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
  normalizeName,
  roundAdjustmentPoint,
  DECL_KEY,
  MST_KEY,
} from "@/lib/store.js";

import { subscribe as subscribeStorage } from "@/lib/storageClient.js";

import { useKpiAdjustmentForm } from "@/components/kpi-adjustments/hooks/useKpiAdjustmentForm.js";
import { useKpiAdjustmentFilters } from "@/components/kpi-adjustments/hooks/useKpiAdjustmentFilters.js";
import { useKpiAdjustmentFormWorkspace } from "@/components/kpi-adjustments/hooks/useKpiAdjustmentFormWorkspace.js";
import {
  formatDateOnly,
  formatDecimal,
  formatInt,
} from "@/components/kpi-adjustments/model/formatting.js";
import {
  buildLicenseFieldId,
  buildSettingsFieldId,
} from "@/components/kpi-adjustments/model/fieldIds.js";
import { parseReferences } from "@/components/kpi-adjustments/model/referenceParsing.js";
import KpiAdjustmentDetailDialog from "@/components/kpi-adjustments/panels/KpiAdjustmentDetailDialog.jsx";
import KpiAdjustmentFormPanel from "@/components/kpi-adjustments/panels/KpiAdjustmentFormPanel.jsx";
import KpiAdjustmentGuidanceDialog from "@/components/kpi-adjustments/panels/KpiAdjustmentGuidanceDialog.jsx";
import KpiAdjustmentListPanel from "@/components/kpi-adjustments/panels/KpiAdjustmentListPanel.jsx";
import KpiAdjustmentOverviewPanel from "@/components/kpi-adjustments/panels/KpiAdjustmentOverviewPanel.jsx";
import KpiAdjustmentSettingsDialog from "@/components/kpi-adjustments/panels/KpiAdjustmentSettingsDialog.jsx";



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

  const [detailEntry, setDetailEntry] = useState(null);

  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [guidanceFullscreen, setGuidanceFullscreen] = useState(false);

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
  const {
    guidanceGroups,
    mstOptions,
    companyOptions,
    teamOptions,
    filteredStaffOptions,
    quickDeclarationSuggestions,
    declarationSearch,
    setDeclarationSearch,
    filteredDeclarationResults,
    refreshBusinessData,
    handleTaxCodeInput,
    handleCompanyInput,
    handleReferencePick,
    formCategoryConfig,
    historyEntries,
    modeOptions,
    licenseOptions,
    normalizedMode,
    isHybridFixed,
    allowManualPointOverride,
    computedExtraTotal,
    computedTotal,
  } = useKpiAdjustmentFormWorkspace({
    form,
    setForm,
    settings,
    roster,
    staffOptions,
    canOverridePoints,
    parseReferences,
  });

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

      <KpiAdjustmentOverviewPanel stats={stats} formatInt={formatInt} formatDecimal={formatDecimal} />



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

      <KpiAdjustmentFormPanel
        canApprove={canApprove}
        autoApproveEnabled={autoApproveEnabled}
        autoApproveSaving={autoApproveSaving}
        autoApproveStatusMessage={autoApproveStatusMessage}
        autoApproveError={autoApproveError}
        onAutoApproveToggle={handleToggleAutoApprove}
        onRefreshDeclarations={handleRefreshDeclarations}
        onOpenGuidance={() => setGuidanceOpen(true)}
        onOpenSettings={openSettingsDialog}
        onSubmit={handleSubmit}
        formFieldIds={FORM_FIELD_IDS}
        form={form}
        setForm={setForm}
        normalizeStr={normalizeStr}
        filteredStaffOptions={filteredStaffOptions}
        staffOptions={staffOptions}
        teamOptions={teamOptions}
        mstOptions={mstOptions}
        onTaxCodeInput={handleTaxCodeInput}
        companyOptions={companyOptions}
        onCompanyInput={handleCompanyInput}
        selectFieldClass={SELECT_FIELD_CLASS}
        onCategoryChange={handleCategoryChange}
        categoryOptions={CATEGORY_OPTIONS}
        formCategoryConfig={formCategoryConfig}
        isEditing={isEditing}
        statusSet={KPI_ADJUSTMENT_STATUS_SET}
        statusLabels={STATUS_LABELS}
        onLicenseChange={handleLicenseChange}
        licenseOptions={licenseOptions}
        quickDeclarationSuggestions={quickDeclarationSuggestions}
        onReferencePick={handleReferencePick}
        declarationSearch={declarationSearch}
        onDeclarationSearchChange={setDeclarationSearch}
        filteredDeclarationResults={filteredDeclarationResults}
        formatDateOnly={formatDateOnly}
        normalizedMode={normalizedMode}
        modeOptions={modeOptions}
        onModeChange={handleModeChange}
        isHybridFixed={isHybridFixed}
        allowManualPointOverride={allowManualPointOverride}
        computedExtraTotal={computedExtraTotal}
        computedTotal={computedTotal}
        formatDecimal={formatDecimal}
        formError={formError}
        canSubmit={canSubmit}
        onReset={resetForm}
        historyEntries={historyEntries}
        formatDateTime={formatDateTime}
      />



      <KpiAdjustmentListPanel
        formFieldIds={FORM_FIELD_IDS}
        selectFieldClass={SELECT_FIELD_CLASS}
        filterMonth={filterMonth}
        onFilterMonthChange={setFilterMonth}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        showMineToggle={showMineToggle}
        showMineOnly={showMineOnly}
        currentStaffKey={currentStaffKey}
        onMineToggle={handleMineToggle}
        canApprove={canApprove}
        staffFilter={staffFilter}
        onStaffFilterChange={setStaffFilter}
        staffFilterOptions={staffFilterOptions}
        filteredAdjustments={filteredAdjustments}
        categoryConfig={KPI_ADJUSTMENT_CATEGORY_CONFIG}
        statusLabels={STATUS_LABELS}
        formatDecimal={formatDecimal}
        formatDateTime={formatDateTime}
        onEdit={handleEdit}
        onViewDetail={(item) => setDetailEntry({ entry: item, intent: "view" })}
        onApprove={(item) => setDetailEntry({ entry: item, intent: "approve" })}
        onReject={(item) => setDetailEntry({ entry: item, intent: "reject" })}
        onDelete={handleDelete}
      />

    </div>

  );

}




