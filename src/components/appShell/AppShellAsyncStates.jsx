import React from 'react';

function AppShellStateCard({
  title,
  description,
  tone = 'default',
  actionLabel = '',
  onAction = null,
}) {
  return (
    <div
      className="rounded-xl border px-4 py-4 shadow-sm"
      data-tone={tone}
      style={{
        borderColor:
          tone === 'error'
            ? 'var(--ds-danger-border, #f5c2c7)'
            : 'var(--ds-border-subtle)',
        background:
          tone === 'error'
            ? 'var(--ds-danger-surface, rgba(220, 38, 38, 0.06))'
            : 'var(--ds-surface-muted)',
      }}
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[color:var(--ds-text-primary)]">{title}</p>
        {description ? (
          <p className="text-sm leading-6 text-[color:var(--ds-text-secondary)]">{description}</p>
        ) : null}
      </div>

      {actionLabel && typeof onAction === 'function' ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 rounded-full border border-[color:var(--ds-border-subtle)] bg-white px-3 py-1.5 text-sm font-medium text-[color:var(--ds-text-secondary)] transition hover:bg-[color:var(--ds-surface-card)] dark:bg-slate-950/50"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function AppShellLoadingState({
  title = 'Đang tải dữ liệu',
  description = 'Hệ thống đang chuẩn bị bề mặt thao tác cho bạn.',
}) {
  return <AppShellStateCard title={title} description={description} tone="loading" />;
}

export function AppShellEmptyState({
  title = 'Chưa có dữ liệu phù hợp',
  description = 'Hãy chọn một workflow khác hoặc thử lại khi dữ liệu đã sẵn sàng.',
  actionLabel = '',
  onAction = null,
}) {
  return (
    <AppShellStateCard
      title={title}
      description={description}
      tone="empty"
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
}

export function AppShellErrorState({
  title = 'Không thể tải nội dung',
  description = 'Đã có lỗi xảy ra khi chuẩn bị bề mặt thao tác này.',
  actionLabel = '',
  onAction = null,
}) {
  return (
    <AppShellStateCard
      title={title}
      description={description}
      tone="error"
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
}

