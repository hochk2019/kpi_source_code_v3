import React from 'react';

import {
  persistWorkflowGuideCollapsed,
  resolveWorkflowGuideCollapsed,
} from '@/components/appShell/appShellWorkflowGuidePreference.js';

function ActionButton({ action }) {
  const isPrimary = action.variant === "primary";

  return (
    <button
      type="button"
      onClick={action.onClick}
      className={`min-h-11 rounded-full px-3.5 py-2 text-sm font-medium transition ${
        isPrimary
          ? "bg-slate-950 text-white hover:bg-slate-800 dark:bg-amber-300 dark:text-slate-950 dark:hover:bg-amber-200"
          : "border border-[color:var(--ds-border-subtle)] bg-white text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)] dark:bg-slate-950/50"
      }`}
    >
      {action.label}
    </button>
  );
}

export default function AppShellWorkflowGuide({
  eyebrow = 'Operator workflow',
  headline,
  actions = [],
  steps = [],
  preferenceId = '',
  defaultCollapsed = false,
}) {
  const hasContent = Boolean(headline && steps.length);

  const panelId = React.useId();
  const [collapsed, setCollapsed] = React.useState(() =>
    resolveWorkflowGuideCollapsed(preferenceId, defaultCollapsed),
  );

  React.useEffect(() => {
    setCollapsed(resolveWorkflowGuideCollapsed(preferenceId, defaultCollapsed));
  }, [defaultCollapsed, preferenceId]);

  const handleToggleCollapse = () => {
    setCollapsed((previousState) => {
      const nextState = !previousState;
      persistWorkflowGuideCollapsed(preferenceId, nextState);
      return nextState;
    });
  };

  const stepSummary = `${steps.length} bước`;
  const actionSummary = actions.length ? `${actions.length} thao tác nhanh` : 'Không có thao tác nhanh';

  if (!hasContent) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-3 shadow-sm sm:px-4 sm:py-4">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--ds-text-muted)]">
            {eyebrow}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-[color:var(--ds-text-primary)] sm:text-lg">
              {headline}
            </h3>
            <span className="rounded-full border border-[color:var(--ds-border-subtle)] px-2 py-1 text-[11px] font-semibold text-[color:var(--ds-text-muted)]">
              {stepSummary}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!collapsed && actions.length ? (
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <ActionButton key={action.label} action={action} />
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleToggleCollapse}
            aria-controls={panelId}
            aria-expanded={!collapsed}
            className="min-h-11 rounded-full border border-[color:var(--ds-border-subtle)] bg-white px-3.5 py-2 text-sm font-medium text-[color:var(--ds-text-secondary)] transition hover:bg-[color:var(--ds-surface-muted)] dark:bg-slate-950/50"
          >
            {collapsed ? 'Mở lại hướng dẫn' : 'Thu gọn hướng dẫn'}
          </button>
        </div>
      </div>

      <div id={panelId}>
        {collapsed ? (
          <div className="mt-3 rounded-xl border border-dashed border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)]/40 px-3 py-3 text-sm text-[color:var(--ds-text-muted)]">
            <p className="font-medium text-[color:var(--ds-text-secondary)]">
              Hướng dẫn đã được thu gọn cho workflow này.
            </p>
            <p className="mt-1">
              {stepSummary} • {actionSummary}
            </p>
          </div>
        ) : (
          <div className="mt-3 grid gap-2.5 lg:grid-cols-3">
            {steps.map((step) => (
              <a
                key={step.number}
                href={`#${step.targetId}`}
                className="block min-h-24 rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)]/50 p-3 transition hover:border-[color:var(--ds-border-strong)] hover:bg-[color:var(--ds-surface-muted)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[color:var(--ds-text-primary)]">
                      {step.title}
                    </p>
                    <p className="text-[13px] leading-5 text-[color:var(--ds-text-muted)]">
                      {step.detail}
                    </p>
                  </div>
                  <span className="rounded-full border border-[color:var(--ds-border-subtle)] px-2 py-1 text-[11px] font-semibold text-[color:var(--ds-text-muted)]">
                    Bước {step.number}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
