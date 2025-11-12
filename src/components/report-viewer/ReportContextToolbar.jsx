import PropTypes from "prop-types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.jsx";

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
  return (
    <div className="grid gap-4 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)]/60 p-4 text-sm text-[color:var(--ds-text-secondary)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase text-[color:var(--ds-text-secondary)]">
            Template báo cáo
          </span>
          {isTemplateDirty ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 uppercase">
              Đã chỉnh sửa
            </span>
          ) : null}
        </div>
        <select
          className="w-full rounded border border-[color:var(--ds-border-subtle)] bg-white px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
          value={activeTemplateId}
          onChange={(event) => onTemplateChange(event.target.value)}
          disabled={!hasTemplates && !activeTemplateId}
        >
          <option value="">Tuỳ chỉnh hiện tại</option>
          {templateOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {!hasTemplates ? (
          <p className="text-xs text-[color:var(--ds-text-muted)]">
            Chưa có template nào, hãy lưu cấu hình hiện tại.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="report-rule-select"
          className="text-xs font-semibold uppercase text-[color:var(--ds-text-secondary)]"
        >
          Bộ quy tắc KPI
        </label>
        <select
          id="report-rule-select"
          value={selectedRuleId}
          onChange={(event) => onRuleChange(event.target.value)}
          className="w-full rounded border border-[color:var(--ds-border-subtle)] bg-white px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
        >
          {ruleOptions.length ? (
            ruleOptions.map((option) => (
              <option key={option.value || "__default"} value={option.value}>
                {option.label}
              </option>
            ))
          ) : (
            <option value="">Chưa có bộ quy tắc</option>
          )}
        </select>
        <div className="text-xs text-[color:var(--ds-text-secondary)]">{ruleMetaLabel}</div>
        <div className="rounded border border-dashed border-[color:var(--ds-border-subtle)] bg-white/60 px-2 py-1 text-xs text-[color:var(--ds-text-secondary)]">
          {ruleStatusLabel}
        </div>
      </div>

      <div className="flex flex-col gap-2 lg:col-span-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ds-text-secondary)]">
            Đang áp dụng
          </span>
          <div className="mt-1 text-sm font-semibold text-[color:var(--ds-text-primary)]">
            {appliedContextLabel}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded border border-[color:var(--ds-border-subtle)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--ds-text-primary)] shadow-sm transition hover:border-[color:var(--ds-border-strong)] hover:bg-[color:var(--ds-surface-muted)]"
            >
              Tuỳ chọn template
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={onSaveTemplate}>
              Lưu template mới
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canOverwriteTemplate} onSelect={onOverwriteTemplate}>
              Cập nhật template hiện tại
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!canDeleteTemplate} onSelect={onDeleteTemplate} className="text-rose-600">
              Xoá template này
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

ReportContextToolbar.propTypes = {
  templateOptions: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired,
    })
  ).isRequired,
  activeTemplateId: PropTypes.string.isRequired,
  onTemplateChange: PropTypes.func.isRequired,
  isTemplateDirty: PropTypes.bool,
  hasTemplates: PropTypes.bool,
  onSaveTemplate: PropTypes.func.isRequired,
  onOverwriteTemplate: PropTypes.func.isRequired,
  onDeleteTemplate: PropTypes.func.isRequired,
  canOverwriteTemplate: PropTypes.bool,
  canDeleteTemplate: PropTypes.bool,
  ruleOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
  selectedRuleId: PropTypes.string.isRequired,
  onRuleChange: PropTypes.func.isRequired,
  ruleStatusLabel: PropTypes.string.isRequired,
  ruleMetaLabel: PropTypes.string.isRequired,
  appliedContextLabel: PropTypes.string.isRequired,
};

ReportContextToolbar.defaultProps = {
  isTemplateDirty: false,
  hasTemplates: false,
  canOverwriteTemplate: false,
  canDeleteTemplate: false,
};

export default ReportContextToolbar;
