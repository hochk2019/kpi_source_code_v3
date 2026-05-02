import { t } from '@/lib/i18n.js';
import { Button } from "@/components/ui/button.jsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.jsx";
import { Textarea } from "@/components/ui/textarea.jsx";
import { emitCommand } from "@/lib/commandBus.js";
import { KPI_ADJUSTMENT_CATEGORY_CONFIG } from "../../../../shared/kpiAdjustments.js";

function copyLookupValue(value) {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue || typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return;
  }

  navigator.clipboard.writeText(normalizedValue).catch(() => {});
}

function openWorkflowLookup(tab, focus, value) {
  copyLookupValue(value);
  emitCommand("navigate:tab", { tab, focus });
}

export default function KpiAdjustmentDetailDialog({
  open,
  detailLabel,
  detailData,
  detailCategoryConfig,
  detailExtraQuantity,
  detailExtraUnit,
  detailExtraTotal,
  detailIntent,
  statusLabels,
  formatDecimal,
  formatDateTime,
  decisionNote,
  onDecisionNoteChange,
  showClearLicenseAction = false,
  onClearLicenseCode,
  onClose,
  onConfirm,
  decisionNoteFieldId,
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? null : onClose())}>
      <DialogContent data-testid="kpi-adjust-detail-dialog" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{detailLabel}</DialogTitle>
          <DialogDescription>{t('kpi.detail.description')}</DialogDescription>
        </DialogHeader>
        {detailData ? (
          <div className="space-y-4 text-sm text-foreground">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">{t('kpi.detail.staff')}</div>
                <div className="mt-1 font-medium text-foreground">{detailData.staffName || t('kpi.common.notAssigned')}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">{t('kpi.detail.team')}</div>
                <div className="mt-1 font-medium text-foreground">{detailData.teamName || t('kpi.common.dash')}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">{t('kpi.detail.category')}</div>
                <div className="mt-1 font-medium text-foreground">
                  {KPI_ADJUSTMENT_CATEGORY_CONFIG[detailData.category]?.label || detailData.category}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">{t('kpi.detail.status')}</div>
                <div className="mt-1 font-medium text-foreground">
                  {statusLabels[detailData.status] || detailData.status}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">{t('kpi.detail.company')}</div>
                <div className="mt-1 font-medium text-foreground">{detailData.companyName || t('kpi.common.dash')}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">{t('kpi.detail.taxCode')}</div>
                {detailData.taxCode ? (
                  <div className="mt-1 flex flex-col items-start gap-2">
                    <span className="font-medium text-foreground">{detailData.taxCode}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto px-0 py-0 text-xs font-medium text-primary hover:bg-transparent"
                      onClick={() => openWorkflowLookup("mst", "review", detailData.taxCode)}
                    >
                      {t('kpi.detail.openMST')}
                    </Button>
                  </div>
                ) : (
                  <div className="mt-1 font-medium text-foreground">—</div>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">{t('kpi.detail.quantity')}</div>
                <div className="mt-1 font-medium text-foreground">{formatDecimal(detailData.quantity ?? 0)}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">{t('kpi.detail.unitPoints')}</div>
                <div className="mt-1 font-medium text-foreground">{formatDecimal(detailData.unitPoints ?? 0)}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">{t('kpi.detail.totalPoints')}</div>
                <div className="mt-1 font-semibold text-foreground">{formatDecimal(detailData.totalPoints ?? 0)}</div>
              </div>
              {detailCategoryConfig.extraPointConfig ? (
                <>
                  <div>
                    <div className="text-xs font-medium uppercase text-muted-foreground">
                      {detailCategoryConfig.extraPointConfig.quantityLabel || t('kpi.detail.extraQuantity')}
                    </div>
                    <div className="mt-1 font-medium text-foreground">{formatDecimal(detailExtraQuantity)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-muted-foreground">
                      {detailCategoryConfig.extraPointConfig.unitLabel || t('kpi.detail.extraUnitPoints')}
                    </div>
                    <div className="mt-1 font-medium text-foreground">{formatDecimal(detailExtraUnit)}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs font-medium uppercase text-muted-foreground">{t('kpi.detail.extraTotal')}</div>
                    <div className="mt-1 font-medium text-foreground">{formatDecimal(detailExtraTotal)}</div>
                  </div>
                </>
              ) : null}
              {detailData.licenseCode ? (
                <div>
                  <div className="text-xs font-medium uppercase text-muted-foreground">{t('kpi.detail.license')}</div>
                  <div className="mt-1 font-medium text-foreground">{detailData.licenseCode}</div>
                </div>
              ) : null}
            </div>

            <div>
              <div className="text-xs font-medium uppercase text-muted-foreground">{t('kpi.detail.note')}</div>
              <div className="mt-1 whitespace-pre-line text-foreground">{detailData.note || "—"}</div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase text-muted-foreground">{t('kpi.detail.reference')}</div>
              {Array.isArray(detailData.references) && detailData.references.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {detailData.references.map((ref) => (
                    <Button
                      key={ref}
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={t('kpi.common.openDeclaration', { ref })}
                      onClick={() => openWorkflowLookup("import", "review", ref)}
                    >
                      {ref}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="mt-1 text-muted-foreground">{t('kpi.detail.noReference')}</div>
              )}
            </div>

            {detailData.history && detailData.history.length ? (
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">{t('kpi.detail.history')}</div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {detailData.history
                    .slice()
                    .reverse()
                    .slice(0, 5)
                    .map((entry) => (
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
                <label className="text-sm font-medium text-foreground" htmlFor={decisionNoteFieldId}>
                  {t('kpi.detail.rejectReason')}
                </label>
                <Textarea
                  id={decisionNoteFieldId}
                  rows={3}
                  value={decisionNote}
                  onChange={(event) => onDecisionNoteChange(event.target.value)}
                  placeholder={t('kpi.detail.rejectPlaceholder')}
                />
                {showClearLicenseAction ? (
                  <div className="mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClearLicenseCode}
                      className="px-2 py-1"
                      data-tooltip={t('kpi.detail.clearLicense')}
                      aria-label={t('kpi.detail.clearLicense')}
                    >
                      {t('kpi.detail.delete')}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('kpi.settings.close')}
          </Button>
          {detailIntent === "approve" ? (
            <Button type="button" onClick={onConfirm}>
              {t('kpi.detail.approve')}
            </Button>
          ) : null}
          {detailIntent === "reject" ? (
            <Button type="button" variant="destructive" onClick={onConfirm}>
              {t('kpi.detail.reject')}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
