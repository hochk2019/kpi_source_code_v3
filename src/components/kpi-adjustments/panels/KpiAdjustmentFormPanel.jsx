import React, { useState, useEffect } from "react";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";

import { t } from '@/lib/i18n.js';

import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import { cn } from "@/lib/utils.js";

export default function KpiAdjustmentFormPanel({
  canApprove,
  autoApproveEnabled,
  autoApproveSaving,
  autoApproveStatusMessage,
  autoApproveError,
  onAutoApproveToggle,
  onRefreshDeclarations,
  onOpenGuidance,
  onOpenSettings,
  onOpenCategorySettings,
  onSubmit,
  formFieldIds,
  form,
  setForm,
  normalizeStr,
  filteredStaffOptions,
  staffOptions,
  teamOptions,
  mstOptions,
  onTaxCodeInput,
  companyOptions,
  onCompanyInput,
  selectFieldClass,
  onCategoryChange,
  categoryOptions,
  formCategoryConfig,
  activeCategorySettings,
  isEditing,
  statusSet,
  statusLabels,
  onLicenseChange,
  licenseOptions,
  quickDeclarationSuggestions,
  onReferencePick,
  declarationSearch,
  onDeclarationSearchChange,
  filteredDeclarationResults,
  formatDateOnly,
  normalizedMode,
  modeOptions,
  onModeChange,
  isHybridFixed,
  allowManualPointOverride,
  computedExtraTotal,
  computedTotal,
  formatDecimal,
  formError,
  canSubmit,
  onReset,
  historyEntries,
  formatDateTime,
}) {
  const [isFormOpen, setIsFormOpen] = useState(isEditing);

  useEffect(() => {
    if (isEditing) {
      setIsFormOpen(true);
    }
  }, [isEditing]);

  const categoryLabel =
    formCategoryConfig.label ||
    categoryOptions.find((option) => option.value === form.category)?.label ||
    form.category;
  const defaultModeLabel =
    modeOptions.find((option) => option.value === activeCategorySettings?.defaultMode)?.label || "Theo hệ thống";
  const activeModeUnits = activeCategorySettings?.modeUnits
    ? Object.entries(activeCategorySettings.modeUnits).filter(([, value]) => value !== "" && value !== null)
    : [];
  const activeLicensePoints = activeCategorySettings?.licensePoints
    ? Object.entries(activeCategorySettings.licensePoints).filter(([, value]) => value !== "" && value !== null)
    : [];
  const formatSettingValue = (value) => {
    if (value === "" || value === null || value === undefined) {
      return "Theo hệ thống";
    }
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? formatDecimal(parsed) : String(value);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg font-semibold text-foreground">{t('kpi.form.title')}</CardTitle>
          <CardDescription>{t('kpi.form.description')}</CardDescription>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {canApprove ? (
              <Button
                type="button"
                variant={autoApproveEnabled ? "default" : "outline"}
                size="sm"
                onClick={onAutoApproveToggle}
                disabled={autoApproveSaving}
                aria-pressed={autoApproveEnabled}
                data-testid="auto-approve-toggle"
              >
                <Sparkles className="mr-1 h-4 w-4" />
                {autoApproveSaving
                  ? t('kpi.form.autoApproveSaving')
                  : autoApproveEnabled
                    ? t('kpi.form.autoApproveOn')
                    : t('kpi.form.autoApproveOff')}
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="sm" onClick={onRefreshDeclarations}>
              {t('kpi.form.refreshReference')}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onOpenGuidance}>
              {t('kpi.form.guide')}
            </Button>
            {canApprove ? (
              <Button type="button" variant="secondary" size="sm" onClick={onOpenSettings}>
                {t('kpi.form.defaultSettings')}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsFormOpen((prev) => !prev)}
              aria-expanded={isFormOpen}
              className={!isFormOpen ? "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100" : ""}
            >
              {isFormOpen ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
              {isFormOpen ? t('kpi.form.collapse') : t('kpi.form.openForm')}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground sm:text-right">{autoApproveStatusMessage}</p>

          {canApprove && autoApproveError ? (
            <p className="text-xs text-destructive sm:text-right">{autoApproveError}</p>
          ) : null}
        </div>
      </CardHeader>

      {isFormOpen && (
        <CardContent>
          <form className="space-y-6" onSubmit={onSubmit}>
            <div className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              <div>
                <label className="text-sm font-medium text-foreground" htmlFor={formFieldIds.month}>
                  {t('kpi.form.month')}
                </label>
                <Input
                  id={formFieldIds.month}
                  type="month"
                  value={form.month}
                  onChange={(event) => setForm((prev) => ({ ...prev, month: event.target.value }))}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground" htmlFor={formFieldIds.staff}>
                  {t('kpi.form.staff')}
                </label>
                <Input
                  id={formFieldIds.staff}
                  list="kpi-adjust-staff-options"
                  placeholder={t('kpi.form.staffPlaceholder')}
                  value={form.staffName}
                  onChange={(event) => {
                    const nextName = event.target.value;
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
                <label className="text-sm font-medium text-foreground" htmlFor={formFieldIds.team}>
                  {t('kpi.form.team')}
                </label>
                <Input
                  id={formFieldIds.team}
                  list="kpi-adjust-team-options"
                  placeholder={t('kpi.form.teamPlaceholder')}
                  value={form.teamName}
                  onChange={(event) => {
                    const nextTeam = event.target.value;
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
                <label className="text-sm font-medium text-foreground" htmlFor={formFieldIds.taxCode}>
                  {t('kpi.detail.taxCode')}
                </label>
                <Input
                  id={formFieldIds.taxCode}
                  list="kpi-adjust-taxcode-options"
                  placeholder={t('kpi.form.taxCodePlaceholder')}
                  value={form.taxCode}
                  onChange={(event) => onTaxCodeInput(event.target.value)}
                  className="mt-1"
                />
                <datalist id="kpi-adjust-taxcode-options">
                  {mstOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </datalist>
                <p className="mt-1 text-xs text-muted-foreground">{t('kpi.form.taxCodeHint')}</p>
              </div>

              <div className="md:col-span-2 xl:col-span-2">
                <label className="text-sm font-medium text-foreground" htmlFor={formFieldIds.company}>
                  {t('kpi.detail.company')}
                </label>
                <Input
                  id={formFieldIds.company}
                  list="kpi-adjust-company-options"
                  placeholder={t('kpi.form.companyPlaceholder')}
                  value={form.companyName}
                  onChange={(event) => onCompanyInput(event.target.value)}
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
                  {t('kpi.form.companyHint')}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground" htmlFor={formFieldIds.category}>
                  {t('kpi.form.category')}
                </label>
                <select
                  id={formFieldIds.category}
                  className={selectFieldClass}
                  value={form.category}
                  onChange={(event) => onCategoryChange(event.target.value)}
                >
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {formCategoryConfig.requiresLicenseCode ? (
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor={formFieldIds.license}>
                    {t('kpi.form.license')}
                  </label>

                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      id={formFieldIds.license}
                      list="kpi-adjust-license-options"
                      placeholder={t('kpi.form.licensePlaceholder')}
                      value={form.licenseCode}
                      onChange={(event) => onLicenseChange(event.target.value)}
                      className="flex-1"
                    />
                    {form.licenseCode ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onLicenseChange("")}
                        className="px-2 py-1"
                        data-tooltip={t('kpi.form.clearLicense')}
                        aria-label={t('kpi.form.clearLicense')}
                      >
                        {t('kpi.form.delete')}
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
                  <label className="text-sm font-medium text-foreground" htmlFor={formFieldIds.status}>
                    {t('kpi.form.status')}
                  </label>
                  <select
                    id={formFieldIds.status}
                    className={selectFieldClass}
                    value={form.status}
                    onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                  >
                    {[...statusSet].map((status) => (
                      <option key={status} value={status}>
                        {statusLabels[status] || status}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            <div
              className="rounded-xl border border-border bg-muted/30 p-4 text-sm"
              data-testid="kpi-adjust-active-settings"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t('kpi.form.activeSettings')}
                  </div>
                  <div className="mt-1 font-semibold text-foreground">{categoryLabel}</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('kpi.form.settingsHint')}
                  </p>
                </div>

                {canApprove ? (
                  <Button type="button" variant="secondary" size="sm" onClick={onOpenCategorySettings}>
                    {t('kpi.form.editCategorySettings')}
                  </Button>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">{t('kpi.form.defaultPoints')}</div>
                  <div className="mt-1 font-medium text-foreground">
                    {formatSettingValue(activeCategorySettings?.defaultUnit)}
                  </div>
                </div>

                {formCategoryConfig.type === "hybrid" ? (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground">{t('kpi.form.defaultMode')}</div>
                    <div className="mt-1 font-medium text-foreground">{defaultModeLabel}</div>
                  </div>
                ) : null}

                {formCategoryConfig.extraPointConfig ? (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground">
                      {formCategoryConfig.extraPointConfig.unitLabel || t('kpi.form.extraPointsUnit')}
                    </div>
                    <div className="mt-1 font-medium text-foreground">
                      {formatSettingValue(activeCategorySettings?.extraUnitPoints)}
                    </div>
                  </div>
                ) : null}

                {formCategoryConfig.requiresLicenseCode ? (
                  <div className="md:col-span-2 xl:col-span-2">
                    <div className="text-xs font-semibold text-muted-foreground">{t('kpi.detail.license')}</div>
                    <div className="mt-1 text-foreground">
                      {activeLicensePoints.length ? (
                        activeLicensePoints.map(([code, value]) => (
                          <span key={code} className="mr-3 inline-flex">
                            {code}: {formatSettingValue(value)}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground">{t('kpi.form.systemDefault')}</span>
                      )}
                    </div>
                  </div>
                ) : null}

                {formCategoryConfig.type === "hybrid" && activeModeUnits.length ? (
                  <div className="md:col-span-2 xl:col-span-2">
                    <div className="text-xs font-semibold text-muted-foreground">{t('kpi.form.modePointsLabel')}</div>
                    <div className="mt-1 text-foreground">
                      {activeModeUnits.map(([modeKey, value]) => {
                        const label = modeOptions.find((option) => option.value === modeKey)?.label || modeKey;
                        return (
                          <span key={modeKey} className="mr-3 inline-flex">
                            {label}: {formatSettingValue(value)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor={formFieldIds.note}>
                    {t('kpi.form.note')}
                  </label>
                  <Textarea
                    id={formFieldIds.note}
                    className="mt-1 min-h-24"
                    value={form.note}
                    onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                    placeholder={t('kpi.form.notePlaceholder')}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor={formFieldIds.references}>
                    {t('kpi.form.references')}
                  </label>
                  <Textarea
                    id={formFieldIds.references}
                    className="mt-1 min-h-28"
                    value={form.referencesInput}
                    onChange={(event) => setForm((prev) => ({ ...prev, referencesInput: event.target.value }))}
                    placeholder={t('kpi.form.referencesPlaceholder')}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{t('kpi.form.suggestions')}</span>
                    {quickDeclarationSuggestions.length ? (
                      quickDeclarationSuggestions.map((decl) => (
                        <Button
                          type="button"
                          key={decl.key}
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => onReferencePick(decl)}
                        >
                          {decl.soTk}
                        </Button>
                      ))
                    ) : (
                      <span className="text-muted-foreground">{t('kpi.form.noRecentDeclarations')}</span>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={onRefreshDeclarations}
                    >
                      {t('kpi.form.refreshList')}
                    </Button>
                  </div>

                  <div className="mt-3 space-y-3 rounded-xl border border-dashed border-border/60 p-3">
                    <div className="text-xs font-semibold uppercase text-muted-foreground">{t('kpi.form.declarationSearch')}</div>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                      <div>
                        <Input
                          value={declarationSearch}
                          onChange={(event) => onDeclarationSearchChange(event.target.value)}
                          placeholder={t('kpi.form.searchPlaceholder')}
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('kpi.form.searchHint')}
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
                                onClick={() => onReferencePick(decl)}
                              >
                                {t('kpi.form.add')}
                              </Button>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-md bg-muted/40 p-3 text-muted-foreground">
                            {declarationSearch
                              ? t('kpi.form.noResults')
                              : t('kpi.form.searchPrompt')}
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
                    <div className="text-sm font-medium text-foreground">{t('kpi.form.selectGrade')}</div>
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
                            onChange={(event) =>
                              setForm((prev) => ({
                                ...prev,
                                gradeValue: Number(event.target.value),
                                unitPoints: Number(event.target.value),
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
                        <label className="text-sm font-medium text-foreground" htmlFor={formFieldIds.mode}>
                          {t('kpi.form.calculationMode')}
                        </label>
                        <select
                          id={formFieldIds.mode}
                          className={selectFieldClass}
                          value={normalizedMode}
                          onChange={(event) => onModeChange(event.target.value)}
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
                          <label className="text-sm font-medium text-foreground" htmlFor={formFieldIds.quantity}>
                            Số lượng
                          </label>
                          <Input
                            id={formFieldIds.quantity}
                            type="number"
                            min="0"
                            step="1"
                            value={form.quantity}
                            onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))}
                            className="mt-1"
                          />
                        </div>
                      ) : null}

                      <div>
                        <label className="text-sm font-medium text-foreground" htmlFor={formFieldIds.unit}>
                          {formCategoryConfig.type === "hybrid" && isHybridFixed ? "Điểm cố định" : "Điểm mỗi đơn vị"}
                        </label>
                        <Input
                          id={formFieldIds.unit}
                          type="number"
                          step="0.1"
                          value={form.unitPoints}
                          onChange={(event) =>
                            setForm((prev) => {
                              if (!allowManualPointOverride) {
                                return prev;
                              }
                              return { ...prev, unitPoints: event.target.value };
                            })
                          }
                          readOnly={!allowManualPointOverride}
                          aria-readonly={!allowManualPointOverride}
                          className={cn("mt-1", !allowManualPointOverride && "bg-muted/40 text-muted-foreground")}
                        />
                      </div>
                    </div>

                    {formCategoryConfig.extraPointConfig ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="text-sm font-medium text-foreground" htmlFor={formFieldIds.extraQuantity}>
                            {formCategoryConfig.extraPointConfig.quantityLabel || "Số lượng bổ sung"}
                          </label>
                          <Input
                            id={formFieldIds.extraQuantity}
                            type="number"
                            min="0"
                            step="1"
                            value={form.extraQuantity}
                            onChange={(event) =>
                              setForm((prev) => ({ ...prev, extraQuantity: event.target.value }))
                            }
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <label className="text-sm font-medium text-foreground" htmlFor={formFieldIds.extraUnit}>
                                {formCategoryConfig.extraPointConfig.unitLabel || "Điểm bổ sung mỗi đơn vị"}
                              </label>
                            </TooltipTrigger>
                            <TooltipContent sideOffset={8} className="max-w-xs text-xs leading-relaxed">
                              Điểm bổ sung mỗi tờ khai
                            </TooltipContent>
                          </Tooltip>

                          <Input
                            id={formFieldIds.extraUnit}
                            type="number"
                            step="0.1"
                            value={form.extraUnitPoints}
                            onChange={(event) =>
                              setForm((prev) => {
                                if (!allowManualPointOverride) {
                                  return prev;
                                }
                                return { ...prev, extraUnitPoints: event.target.value };
                              })
                            }
                            readOnly={!allowManualPointOverride}
                            aria-readonly={!allowManualPointOverride}
                            className={cn("mt-1", !allowManualPointOverride && "bg-muted/40 text-muted-foreground")}
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
                <Button type="button" variant="outline" onClick={onReset}>
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
      )}
    </Card>
  );
}
