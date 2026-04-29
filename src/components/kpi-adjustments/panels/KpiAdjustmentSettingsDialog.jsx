import { Button } from "@/components/ui/button.jsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.jsx";
import { Input } from "@/components/ui/input.jsx";
import { KPI_ADJUSTMENT_CATEGORY_CONFIG } from "../../../../shared/kpiAdjustments.js";

export default function KpiAdjustmentSettingsDialog({
  open,
  embedded = false,
  focusCategory,
  settingsDraft,
  settingsError,
  settingsSaving,
  onOpenChange,
  onClose,
  onReset,
  onSubmit,
  onUpdateDraft,
  buildSettingsFieldId,
  buildLicenseFieldId,
}) {
  const orderedCategories = Object.entries(KPI_ADJUSTMENT_CATEGORY_CONFIG).sort(([leftKey], [rightKey]) => {
    if (focusCategory && leftKey === focusCategory) return -1;
    if (focusCategory && rightKey === focusCategory) return 1;
    return 0;
  });
  const focusLabel = focusCategory ? KPI_ADJUSTMENT_CATEGORY_CONFIG[focusCategory]?.label || focusCategory : "";

  const formContent = (
    <form className="space-y-6" onSubmit={onSubmit}>
      {focusLabel ? (
        <div
          className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground"
          data-testid="kpi-adjust-settings-focus-banner"
        >
          Đang chỉnh nhanh cho: <span className="font-semibold">{focusLabel}</span>
        </div>
      ) : null}

      <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
        {orderedCategories.map(([category, config]) => {
          const draft = settingsDraft[category] || {};
          const groupLabel = config.groupLabel || config.groupKey;
          const defaultUnitId = buildSettingsFieldId(category, "default-unit");
          const defaultModeId = buildSettingsFieldId(category, "default-mode");
          const extraUnitId = buildSettingsFieldId(category, "extra-unit");
          const licenseKeys = draft.licensePoints ? Object.keys(draft.licensePoints) : [];

          return (
            <div
              key={category}
              className="rounded-xl border border-border bg-muted/30 p-4 text-sm shadow-sm"
              data-testid={focusCategory === category ? "kpi-adjust-settings-focused-card" : undefined}
            >
              <div className="font-semibold text-foreground">{config.label}</div>
              {groupLabel ? <div className="text-xs text-muted-foreground">{groupLabel}</div> : null}

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
                    onChange={(event) => onUpdateDraft(category, "defaultUnit", event.target.value)}
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
                      onChange={(event) => onUpdateDraft(category, "extraUnitPoints", event.target.value)}
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
                        onChange={(event) => onUpdateDraft(category, "defaultMode", event.target.value)}
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
                            onChange={(event) =>
                              onUpdateDraft(category, `modeUnits.${mode.value}`, event.target.value)
                            }
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
                            onChange={(event) =>
                              onUpdateDraft(category, `licensePoints.${code}`, event.target.value)
                            }
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

      <div className={embedded ? "flex gap-3 pt-4 border-t" : ""}>
        <Button type="button" variant="ghost" onClick={onClose} disabled={settingsSaving}>
          Hủy
        </Button>

        <Button type="button" variant="outline" onClick={onReset} disabled={settingsSaving}>
          Đặt lại
        </Button>

        <Button type="submit" disabled={settingsSaving}>
          {settingsSaving ? "Đang lưu..." : "Lưu cấu hình"}
        </Button>
      </div>
    </form>
  );

  if (embedded) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">Cấu hình điểm mặc định</h2>
          <p className="text-sm text-gray-500">
            Chỉ áp dụng cho Admin/Quản lý. Để trống sẽ dùng giá trị hệ thống.
          </p>
        </div>
        {formContent}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Cấu hình điểm mặc định</DialogTitle>
          <DialogDescription>
            Chỉ áp dụng cho Admin/Quản lý. Để trống sẽ dùng giá trị hệ thống.
          </DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
