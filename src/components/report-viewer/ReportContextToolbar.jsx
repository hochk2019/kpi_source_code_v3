import { Badge } from "@/components/ui/badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Label } from "@/components/ui/label.jsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.jsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.jsx";

const CUSTOM_TEMPLATE_VALUE = "__custom_template__";
const NO_RULE_VALUE = "__no_rule_selected__";

function ReportContextToolbar({
  templateOptions,
  activeTemplateId,
  onTemplateChange,
  isTemplateDirty,
  hasTemplates,
  onSaveTemplate,
  onOverwriteTemplate,
  onDeleteTemplate,
  canOverwriteTemplate,
  canDeleteTemplate,
  ruleOptions,
  selectedRuleId,
  onRuleChange,
  ruleStatusLabel,
  ruleMetaLabel,
  appliedContextLabel,
}) {
  const templateSelectValue = activeTemplateId || CUSTOM_TEMPLATE_VALUE;
  const ruleSelectValue = selectedRuleId || NO_RULE_VALUE;

  return (
    <section className="rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)]/40 p-6 shadow-sm">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="report-template-select"
              className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ds-text-secondary)]"
            >
              Template báo cáo
            </Label>
            {isTemplateDirty ? (
              <Badge
                variant="secondary"
                className="ds-pill border-amber-200 bg-amber-50 text-[11px] font-semibold uppercase tracking-wide text-amber-700"
              >
                Đã chỉnh sửa
              </Badge>
            ) : null}
          </div>
          <Select
            value={templateSelectValue}
            onValueChange={(value) =>
              onTemplateChange(value === CUSTOM_TEMPLATE_VALUE ? "" : value)
            }
          >
            <SelectTrigger
              id="report-template-select"
              className="h-10 justify-between rounded-lg border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:ring-[color:var(--ds-accent-ring)]"
              aria-label="Template báo cáo"
            >
              <SelectValue placeholder="Tuỳ chỉnh hiện tại" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={CUSTOM_TEMPLATE_VALUE}>Tuỳ chỉnh hiện tại</SelectItem>
              {templateOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!hasTemplates ? (
            <p className="text-xs leading-relaxed text-[color:var(--ds-text-muted)]">
              Chưa có template nào, hãy lưu cấu hình hiện tại.
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <Label
            htmlFor="report-rule-select"
            className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ds-text-secondary)]"
          >
            Bộ quy tắc KPI
          </Label>
            <Select
              value={ruleSelectValue}
              onValueChange={(value) =>
                onRuleChange(value === NO_RULE_VALUE ? "" : value)
              }
            >
              <SelectTrigger
              id="report-rule-select"
              className="h-10 justify-between rounded-lg border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:ring-[color:var(--ds-accent-ring)]"
              aria-label="Bộ quy tắc KPI"
            >
              <SelectValue placeholder="Chưa có bộ quy tắc" />
            </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={NO_RULE_VALUE}>Chưa có bộ quy tắc</SelectItem>
                {ruleOptions.map((option) => (
                  <SelectItem key={option.value || "__default"} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          <p className="text-xs leading-relaxed text-[color:var(--ds-text-secondary)]">{ruleMetaLabel}</p>
          <div className="ds-callout ds-callout--info border-dashed border-[color:var(--ds-border-subtle)] bg-white/70 text-xs text-[color:var(--ds-text-secondary)]">
            {ruleStatusLabel}
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-lg bg-[color:var(--ds-surface-card)]/70 p-4 lg:col-span-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ds-text-secondary)]">
              Đang áp dụng
            </span>
            <div className="text-sm font-semibold text-[color:var(--ds-text-primary)]">{appliedContextLabel}</div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-10 items-center gap-2 rounded-lg border-[color:var(--ds-border-subtle)] bg-white px-3 text-sm font-semibold text-[color:var(--ds-text-primary)] shadow-sm hover:border-[color:var(--ds-border-strong)] hover:bg-[color:var(--ds-surface-muted)]"
              >
                Tuỳ chọn template
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={onSaveTemplate}>Lưu template mới</DropdownMenuItem>
              <DropdownMenuItem disabled={!canOverwriteTemplate} onSelect={onOverwriteTemplate}>
                Cập nhật template hiện tại
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!canDeleteTemplate}
                onSelect={onDeleteTemplate}
                className="text-rose-600 focus:bg-rose-50 focus:text-rose-700"
              >
                Xoá template này
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </section>
  );
}

ReportContextToolbar.defaultProps = {
  templateOptions: [],
  activeTemplateId: "",
  ruleOptions: [],
  selectedRuleId: "",
  ruleStatusLabel: "",
  ruleMetaLabel: "",
  appliedContextLabel: "",
  isTemplateDirty: false,
  hasTemplates: false,
  canOverwriteTemplate: false,
  canDeleteTemplate: false,
};

export default ReportContextToolbar;
