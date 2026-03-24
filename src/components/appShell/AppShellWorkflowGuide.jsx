import React from "react";

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
  eyebrow = "Operator workflow",
  headline,
  actions = [],
  steps = [],
}) {
  if (!headline || !steps.length) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-3 shadow-sm sm:px-4 sm:py-4">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--ds-text-muted)]">
            {eyebrow}
          </p>
          <h3 className="text-base font-semibold text-[color:var(--ds-text-primary)] sm:text-lg">{headline}</h3>
        </div>

        {actions.length ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <ActionButton key={action.label} action={action} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2.5 lg:grid-cols-3">
        {steps.map((step) => (
          <a
            key={step.number}
            href={`#${step.targetId}`}
            className="block min-h-24 rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)]/50 p-3 transition hover:border-[color:var(--ds-border-strong)] hover:bg-[color:var(--ds-surface-muted)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[color:var(--ds-text-primary)]">{step.title}</p>
                <p className="text-[13px] leading-5 text-[color:var(--ds-text-muted)]">{step.detail}</p>
              </div>
              <span className="rounded-full border border-[color:var(--ds-border-subtle)] px-2 py-1 text-[11px] font-semibold text-[color:var(--ds-text-muted)]">
                Bước {step.number}
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
