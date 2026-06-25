import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useAppDialog } from '@/hooks/useAppDialog';

import { t } from '@/lib/i18n.js';
import { PageHeader } from '@/components/designSystem/PageHeader';
import { PageLayout } from '@/components/layout/PageLayout';
import { PermissionBanner, FilterBar } from '@/components/designSystem/primitives';
import { Settings, BarChart3, List } from "lucide-react";

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
import PageSizeControl from "@/components/mst-assignment/table/PageSizeControl.jsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

import { useKpiAdjustmentForm } from "@/components/kpi-adjustments/hooks/useKpiAdjustmentForm.js";
import { useKpiAdjustmentFilters } from "@/components/kpi-adjustments/hooks/useKpiAdjustmentFilters.js";
import useKpiAdjustmentPageSize, {
  KPI_ADJUSTMENT_PAGE_SIZE_OPTIONS,
  MIN_KPI_ADJUSTMENT_PAGE_SIZE,
} from "@/components/kpi-adjustments/hooks/useKpiAdjustmentPageSize.js";
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
import { CATEGORY_OPTIONS } from "@/components/kpi-adjustments/model/categoryOptions.js";
import { parseReferences } from "@/components/kpi-adjustments/model/referenceParsing.js";
import { buildSettingsDraft } from "@/components/kpi-adjustments/model/settingsDraft.js";
import { buildStaffOptions } from "@/components/kpi-adjustments/model/staffOptions.js";
const KpiAdjustmentDetailDialog = React.lazy(() =>
  import("@/components/kpi-adjustments/panels/KpiAdjustmentDetailDialog.jsx")
);
import KpiAdjustmentFormPanel from "@/components/kpi-adjustments/panels/KpiAdjustmentFormPanel.jsx";
const KpiAdjustmentGuidanceDialog = React.lazy(() =>
  import("@/components/kpi-adjustments/panels/KpiAdjustmentGuidanceDialog.jsx")
);
import KpiAdjustmentListPanel from "@/components/kpi-adjustments/panels/KpiAdjustmentListPanel.jsx";
import KpiAdjustmentOverviewPanel from "@/components/kpi-adjustments/panels/KpiAdjustmentOverviewPanel.jsx";
const KpiAdjustmentSettingsDialog = React.lazy(() =>
  import("@/components/kpi-adjustments/panels/KpiAdjustmentSettingsDialog.jsx")
);
import useKpiAdjustmentSelection from "@/components/kpi-adjustments/hooks/useKpiAdjustmentSelection.js";
import usePagination from "@/hooks/usePagination.js";
import type { AuthAccountView, AccountPermissions } from '@/types';

const STATUS_LABELS: Record<string, string> = {
  pending: t('kpi.status.pending'),
  approved: t('kpi.status.approved'),
  rejected: t('kpi.status.rejected'),
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
  unitPoints: "kpi-adjust-unitpoints",
  gradeValue: "kpi-adjust-gradevalue",
  extraQuantity: "kpi-adjust-extraquantity",
  extraUnitPoints: "kpi-adjust-extraunitpoints",
  decisionNote: "kpi-adjust-decision-note",
});

function TabLoadingSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-32 w-full" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

const SELECT_FIELD_CLASS =
  "mt-1 h-9 w-full rounded-md border border-ds-border-subtle bg-ds-surface-base px-3 text-sm text-ds-text-primary shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ds-accent-ring";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("vi-VN", { hour12: false });
  } catch (err) {
    console.warn(t('kpi.error.formatDate'), value, err);
    return value;
  }
}

interface StaffDefaults {
  staffName: string;
  teamName: string;
}

function resolveStaffDefaults(user: AuthAccountView | null | undefined, roster: { teams: { members: { name: string }[] }[] }): StaffDefaults {
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
      console.warn(t('kpi.error.defaultTeam'), error);
    }
  }

  return { staffName, teamName };
}

interface DetailEntry {
  entry: Record<string, unknown>;
  intent: "view" | "approve" | "reject";
}

interface KPIAdjustmentsProps {
  currentUser?: AuthAccountView | null;
}

export default function KPIAdjustments({ currentUser }: KPIAdjustmentsProps) {
  const { alert, confirm } = useAppDialog();

  const [settings, setSettings] = useState(() => getKpiAdjustmentSettings());
  const [adjustments, setAdjustments] = useState(() => getKpiAdjustments());
  const [roster, setRoster] = useState(() => getTeamRoster());
  const [isLoading, setIsLoading] = useState(true);
  const [detailEntry, setDetailEntry] = useState<DetailEntry | null>(null);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [guidanceFullscreen, setGuidanceFullscreen] = useState(false);

  const permissions = (currentUser?.permissions || {}) as AccountPermissions;
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
  const { initialPageSize, persistPageSize } = useKpiAdjustmentPageSize();
  const {
    page,
    pageSize,
    pageCount,
    totalItems,
    currentPageItems,
    setPageSize,
    nextPage,
    previousPage,
  } = usePagination(filteredAdjustments, {
    initialPage: 1,
    initialPageSize,
    minPageSize: MIN_KPI_ADJUSTMENT_PAGE_SIZE,
  });
  const {
    selectedIdSet: selectedAdjustmentIdSet,
    selectedItems: selectedAdjustments,
    selectedCount: selectedAdjustmentCount,
    allVisibleSelected: allVisibleAdjustmentsSelected,
    toggleSelection: toggleAdjustmentSelection,
    toggleVisibleSelection: toggleVisibleAdjustmentsSelection,
    clearSelection: clearAdjustmentSelection,
  } = useKpiAdjustmentSelection({
    canSelect: canApprove,
    visibleItems: currentPageItems,
  });

  const {
    form,
    setForm,
    isEditing,
    formError,
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
  const activeCategorySettings = useMemo(
    () => buildSettingsDraft(settings)?.[form.category] || {},
    [form.category, settings]
  );

  const [autoApproveSaving, setAutoApproveSaving] = useState(false);
  const [autoApproveError, setAutoApproveError] = useState("");
  const [decisionNote, setDecisionNote] = useState("");

  const actor = currentUser?.username || currentUser?.name || "ui";

  const autoApproveSettings = (settings?.autoApprove || {}) as Record<string, unknown>;
  const autoApproveEnabled = autoApproveSettings.enabled === true;
  const autoApproveUpdatedBy = (autoApproveSettings.updatedBy || "") as string;
  const autoApproveUpdatedAt = (autoApproveSettings.updatedAt || "") as string;
  const autoApproveNote = (autoApproveSettings.note || "") as string;

  const autoApproveStatusMessage = useMemo(() => {
    if (autoApproveEnabled) {
      const details: string[] = [];
      if (autoApproveUpdatedBy) {
        details.push(`bởi ${autoApproveUpdatedBy}`);
      }
      if (autoApproveUpdatedAt) {
        details.push(formatDateTime(autoApproveUpdatedAt));
      }
      if (autoApproveNote) {
        details.push(`Ghi chú: ${autoApproveNote}`);
      }
      const suffix = details.length ? ` (${details.join(" · ")})` : "";
      return `Duyệt tự động đang bật${suffix}`;
    }
    return "Duyệt tự động đang tắt";
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
        const previousAuto = (prev?.autoApprove || {}) as Record<string, unknown>;
        const latestAuto = (latestSettings?.autoApprove || {}) as Record<string, unknown>;
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
    const timer = setTimeout(() => setIsLoading(false), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!detailEntry) {
      setDecisionNote("");
    }
  }, [detailEntry]);

  useEffect(() => {
    persistPageSize(pageSize);
  }, [pageSize, persistPageSize]);

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

  const handleToggleAutoApprove = async () => {
    if (!canApprove || autoApproveSaving) {
      return;
    }
    setAutoApproveError("");
    setAutoApproveSaving(true);
    try {
      const updatedSettings = await saveKpiAdjustmentSettings(
        { autoApprove: { enabled: !autoApproveEnabled } },
        { actor, permissions: currentUser?.permissions || {} }
      );
      setSettings(updatedSettings);
    } catch (err) {
      console.error(err);
      setAutoApproveError((err as Error)?.message || "Không thể cập nhật duyệt tự động.");
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

  const handleDelete = async (entry: Record<string, unknown>) => {
    if (!entry) return;
    if (!await confirm("Bạn có chắc chắn muốn xóa mục điểm KPI bổ sung này?", { variant: 'destructive', confirmLabel: 'Xóa' })) {
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
      await alert("Không thể xóa mục điểm KPI bổ sung. Vui lòng thử lại.");
    }
  };

  const handleStatusChange = async (entry: Record<string, unknown>, status: string, noteOverride: string | null = null) => {
    if (!entry) return;
    if (!canApprove) {
      await alert("Bạn không có quyền duyệt điểm KPI bổ sung.");
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
      await alert("Không thể cập nhật trạng thái. Vui lòng thử lại.");
    }
  };

  const bulkApproveCount = useMemo(
    () => selectedAdjustments.filter((item: Record<string, unknown>) => item?.status !== "approved").length,
    [selectedAdjustments]
  );
  const bulkRejectCount = useMemo(
    () => selectedAdjustments.filter((item: Record<string, unknown>) => item?.status !== "rejected").length,
    [selectedAdjustments]
  );

  const handleBulkStatusChange = async (status: string) => {
    if (!canApprove) {
      await alert("Bạn không có quyền duyệt điểm KPI bổ sung.");
      return;
    }
    const actionableEntries = selectedAdjustments.filter((item: Record<string, unknown>) => {
      if (!item) return false;
      return status === "approved" ? item.status !== "approved" : item.status !== "rejected";
    });
    if (actionableEntries.length === 0) return;

    const actionLabel = status === "approved" ? "duyệt" : "từ chối";
    const confirmed = await confirm(
      `Bạn có chắc chắn muốn ${actionLabel} ${actionableEntries.length} mục điểm KPI bổ sung đã chọn?`
    );
    if (!confirmed) return;

    let note = "";
    if (status === "rejected") {
      note = window.prompt("Nhập lý do từ chối cho các mục đã chọn (tuỳ chọn)", "") || "";
    }
    try {
      for (const entry of actionableEntries) {
        updateKpiAdjustmentStatus(entry.id, status, {
          actor,
          note,
          permissions: currentUser?.permissions || {},
        });
      }
      setAdjustments(getKpiAdjustments());
      clearAdjustmentSelection();
    } catch (err) {
      console.error(err);
      await alert("Không thể cập nhật trạng thái hàng loạt. Vui lòng thử lại.");
    }
  };

  const detailData = detailEntry?.entry || null;
  const detailCategoryConfig = detailData ? KPI_ADJUSTMENT_CATEGORY_CONFIG[detailData.category as string] || {} : {};
  const detailExtraQuantity = (detailCategoryConfig as Record<string, unknown>).extraPointConfig
    ? Number.parseFloat((detailData as Record<string, unknown>)?.extraQuantity as string ?? "0") || 0
    : 0;
  const detailExtraUnit = (detailCategoryConfig as Record<string, unknown>).extraPointConfig
    ? Number.parseFloat(
      (detailData as Record<string, unknown>)?.extraUnitPoints as string ??
      String(((detailCategoryConfig as Record<string, unknown>).extraPointConfig as Record<string, unknown>)?.defaultUnit ?? 0)
    ) || 0
    : 0;
  const detailExtraTotal = (detailCategoryConfig as Record<string, unknown>).extraPointConfig
    ? roundAdjustmentPoint(detailExtraQuantity * detailExtraUnit)
    : 0;
  const detailIntent = detailEntry?.intent || "view";
  const detailLabel = detailIntent === "approve" ? "Duyệt điểm" : detailIntent === "reject" ? "Từ chối điểm" : "Chi tiết mục điểm";

  return (
    <PageLayout title="Điểm KPI +/- Thêm">
    <div className="space-y-6">
      {detailEntry ? (
        <Suspense fallback={null}>
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
        </Suspense>
      ) : null}

      {guidanceOpen ? (
        <Suspense fallback={null}>
          <KpiAdjustmentGuidanceDialog
            open={guidanceOpen}
            fullscreen={guidanceFullscreen}
            guidanceGroups={guidanceGroups}
            formatDecimal={formatDecimal}
            onOpenChange={setGuidanceOpen}
            onToggleFullscreen={() => setGuidanceFullscreen((current: boolean) => !current)}
            onOpenSettings={() => {
              setGuidanceOpen(false);
              openSettingsDialog();
            }}
          />
        </Suspense>
      ) : null}

      {settingsOpen ? (
        <Suspense fallback={null}>
          <KpiAdjustmentSettingsDialog
            open={settingsOpen}
            focusCategory={settingsFocusCategory}
            settingsDraft={settingsDraft}
            settingsError={settingsError}
            settingsSaving={settingsSaving}
            onOpenChange={(open: boolean) => (open ? setSettingsOpen(true) : closeSettingsDialog())}
            onClose={closeSettingsDialog}
            onReset={handleSettingsReset}
            onSubmit={handleSettingsSubmit}
            onUpdateDraft={updateSettingsDraft}
            buildSettingsFieldId={buildSettingsFieldId}
            buildLicenseFieldId={buildLicenseFieldId}
          />
        </Suspense>
      ) : null}

      <PageHeader
        eyebrow="HIỆU SUẤT"
        title="Điểm KPI +/- Thêm"
        info="Quản lý điểm KPI bổ sung, cộng/trừ điểm theo tháng"
        actions={
          <button
            onClick={() => openSettingsDialog()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-ds-text-primary bg-ds-surface-card border border-ds-border-subtle rounded-md hover:bg-ds-surface-muted transition-colors"
          >
            <Settings size={14} />
            Cài đặt
          </button>
        }
      />

      {/* Permission Banner */}
      {!canApprove && !canSubmit && (
        <PermissionBanner
          level="warning"
          title={t('adjustments.noPermission.title') || "Không có quyền"}
          description={t('adjustments.noPermission.desc') || "Bạn không có quyền nhập hoặc duyệt điểm KPI bổ sung."}
        />
      )}

      <Tabs defaultValue="form" className="w-full">
        <TabsList className="mb-4 border-b border-ds-border-subtle w-full justify-start rounded-none bg-transparent p-0 h-auto">
          <TabsTrigger 
            value="form"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-ds-accent data-[state=active]:text-ds-accent data-[state=active]:shadow-none rounded-none bg-transparent"
          >
            <BarChart3 size={14} />
            Tổng quan
          </TabsTrigger>
          <TabsTrigger 
            value="list"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-ds-accent data-[state=active]:text-ds-accent data-[state=active]:shadow-none rounded-none bg-transparent"
          >
            <List size={14} />
            Danh sách
          </TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="space-y-6 mt-0">
          {isLoading ? (
            <TabLoadingSkeleton />
          ) : (
            <>
              <KpiAdjustmentOverviewPanel stats={stats} formatInt={formatInt} formatDecimal={formatDecimal} />

              <KpiAdjustmentFormPanel
                canApprove={canApprove}
                autoApproveEnabled={autoApproveEnabled}
                autoApproveSaving={autoApproveSaving}
                autoApproveStatusMessage={autoApproveStatusMessage}
                autoApproveError={autoApproveError}
                onAutoApproveToggle={handleToggleAutoApprove}
                onRefreshDeclarations={handleRefreshDeclarations}
                onOpenGuidance={() => setGuidanceOpen(true)}
                onOpenSettings={() => openSettingsDialog()}
                onOpenCategorySettings={() => openSettingsDialog(form.category)}
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
                activeCategorySettings={activeCategorySettings}
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
            </>
          )}
        </TabsContent>

        <TabsContent value="list" className="space-y-6 mt-0">
          {/* Filter Bar for List Tab */}
          <FilterBar
            activeFilterCount={(filterMonth ? 1 : 0) + (filterStatus ? 1 : 0) + (showMineOnly ? 1 : 0)}
            onReset={() => {
              setFilterMonth('');
              setFilterStatus('');
              if (showMineOnly) handleMineToggle();
            }}
          >
            <FilterBar.Search
              placeholder="Tìm theo MST, tên công ty..."
              value={declarationSearch}
              onChange={setDeclarationSearch}
            />
            <FilterBar.Select
              label="Tháng"
              value={filterMonth}
              onChange={setFilterMonth}
              options={[{ value: '', label: 'Tất cả tháng' }, { value: '01', label: 'Tháng 1' }, { value: '02', label: 'Tháng 2' }, { value: '03', label: 'Tháng 3' }]}
            />
            <FilterBar.Select
              label="Trạng thái"
              value={filterStatus}
              onChange={setFilterStatus}
              options={[{ value: '', label: 'Tất cả' }, { value: 'pending', label: 'Chờ duyệt' }, { value: 'approved', label: 'Đã duyệt' }, { value: 'rejected', label: 'Từ chối' }]}
            />
          </FilterBar>

          {isLoading ? (
            <TabLoadingSkeleton />
          ) : (
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
              currentPageItems={currentPageItems}
              page={page}
              pageSize={pageSize}
              pageCount={pageCount}
              totalItems={totalItems}
              pageSizeOptions={KPI_ADJUSTMENT_PAGE_SIZE_OPTIONS}
              onPageSizeChange={setPageSize}
              onNextPage={nextPage}
              onPreviousPage={previousPage}
              PageSizeControlComponent={PageSizeControl}
              categoryConfig={KPI_ADJUSTMENT_CATEGORY_CONFIG}
              statusLabels={STATUS_LABELS}
              formatDecimal={formatDecimal}
              formatDateTime={formatDateTime}
              selectedAdjustmentIds={selectedAdjustmentIdSet}
              allVisibleAdjustmentsSelected={allVisibleAdjustmentsSelected}
              selectedAdjustmentCount={selectedAdjustmentCount}
              bulkApproveCount={bulkApproveCount}
              bulkRejectCount={bulkRejectCount}
              onToggleAdjustmentSelection={toggleAdjustmentSelection}
              onToggleVisibleAdjustmentsSelection={toggleVisibleAdjustmentsSelection}
              onClearSelection={clearAdjustmentSelection}
              onBulkApprove={() => handleBulkStatusChange("approved")}
              onBulkReject={() => handleBulkStatusChange("rejected")}
              onEdit={handleEdit}
              onViewDetail={(item: Record<string, unknown>) => setDetailEntry({ entry: item, intent: "view" })}
              onApprove={(item: Record<string, unknown>) => setDetailEntry({ entry: item, intent: "approve" })}
              onReject={(item: Record<string, unknown>) => setDetailEntry({ entry: item, intent: "reject" })}
              onDelete={handleDelete}
            />
          )}
        </TabsContent>

      </Tabs>
    </div>
    </PageLayout>
  );
}
