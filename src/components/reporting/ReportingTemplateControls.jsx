import React from "react";

export default function ReportingTemplateControls({
  selectedTemplateId = "",
  templates = [],
  templateBusy = false,
  templateSaving = false,
  appliedTemplate = null,
  appliedTemplateUpdatedAt = "",
  onSelectTemplate,
  onApplySelectedTemplate,
  onSaveTemplateAsNew,
  onOverwriteSelectedTemplate,
  onDeleteSelectedTemplate,
  onRefreshTemplates,
}) {
  return (
    <div className="rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[13rem] flex-1 flex-col text-xs text-[color:var(--ds-text-secondary)]">
          <span className="text-[11px] font-semibold uppercase tracking-wide">
            Mẫu báo cáo
          </span>
          <select
            value={selectedTemplateId}
            onChange={(event) => onSelectTemplate?.(event.target.value)}
            className="mt-1 rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
          >
            <option value="">Chọn mẫu đã lưu</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={onApplySelectedTemplate}
          disabled={!selectedTemplateId || templateBusy}
          className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-xs font-medium text-[color:var(--ds-text-secondary)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Áp dụng
        </button>

        <button
          type="button"
          onClick={onSaveTemplateAsNew}
          disabled={templateBusy}
          className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-xs font-medium text-[color:var(--ds-text-secondary)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {templateSaving ? "Đang lưu…" : "Lưu mẫu mới"}
        </button>

        {selectedTemplateId ? (
          <>
            <button
              type="button"
              onClick={onOverwriteSelectedTemplate}
              disabled={templateBusy}
              className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-xs font-medium text-[color:var(--ds-text-secondary)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Ghi đè mẫu
            </button>
            <button
              type="button"
              onClick={onDeleteSelectedTemplate}
              disabled={templateBusy}
              className="rounded border border-rose-400/60 bg-rose-500/5 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Xoá mẫu
            </button>
          </>
        ) : null}

        <button
          type="button"
          onClick={onRefreshTemplates}
          disabled={templateBusy}
          className="rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-xs font-medium text-[color:var(--ds-text-secondary)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Làm mới
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[color:var(--ds-text-secondary)]">
        <span>Lưu cục bộ theo trình duyệt hiện tại.</span>
        {appliedTemplate ? (
          <span>
            Đang áp dụng:{" "}
            <span className="font-medium text-[color:var(--ds-text-primary)]">
              {appliedTemplate.name}
            </span>
            {appliedTemplateUpdatedAt ? ` • Cập nhật ${appliedTemplateUpdatedAt}` : ""}
          </span>
        ) : (
          <span>Chưa áp dụng mẫu báo cáo nào.</span>
        )}
      </div>
    </div>
  );
}

