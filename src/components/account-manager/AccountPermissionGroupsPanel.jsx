import React from "react";

import { ChevronDown } from "lucide-react";

import { normalizeName } from "@/lib/store.js";


function buildPermissionGroupId(category, scope) {
  const base = normalizeName(category || "nhóm");
  const slug = base.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${scope}-${slug || "nhom"}`;
}


function PermissionCheckbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  compact = false,
}) {
  const baseClass = [
    "flex min-h-[48px] gap-3 rounded-lg border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-subtle)]/60 px-3 py-2 transition",
    disabled
      ? "cursor-not-allowed opacity-60"
      : "hover:border-[color:var(--ds-accent)] hover:bg-[color:var(--ds-surface-card)]",
  ].join(" ");
  const labelClass = compact
    ? "text-sm font-medium leading-snug text-[color:var(--ds-text-primary)]"
    : "text-sm font-semibold leading-snug text-[color:var(--ds-text-primary)]";

  return (
    <label className={baseClass} title={label}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--ds-accent)]"
      />
      <span className="flex min-w-0 flex-col">
        <span className={labelClass}>{label}</span>
        {!compact && description ? (
          <span className="text-xs leading-4 text-[color:var(--ds-text-secondary)]">{description}</span>
        ) : null}
      </span>
    </label>
  );
}


export default function AccountPermissionGroupsPanel({
  groups,
  permissionValues,
  collapsedGroups,
  onToggleGroup,
  scope,
  onPermissionChange,
  isPermissionDisabled,
  countLabelFormatter,
  headingVariant = "default",
}) {
  const headingClassName =
    headingVariant === "compact"
      ? "text-xs font-semibold uppercase tracking-wide text-[color:var(--ds-text-secondary)]"
      : "text-sm font-semibold text-[color:var(--ds-text-primary)]";

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const enabledCount = group.items.reduce(
          (count, item) => (permissionValues?.[item.key] ? count + 1 : count),
          0
        );
        const isCollapsed = collapsedGroups.has(group.category);
        const contentId = buildPermissionGroupId(group.category, scope);

        return (
          <div key={group.category} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className={headingClassName}>{group.category}</h3>
              <div className="flex items-center gap-2 text-xs text-[color:var(--ds-text-muted)]">
                <span>{countLabelFormatter(enabledCount, group.items.length)}</span>
                <button
                  type="button"
                  onClick={() => onToggleGroup(group.category)}
                  className="inline-flex items-center gap-1 rounded border border-transparent px-2 py-1 text-xs font-medium text-[color:var(--ds-text-secondary)] transition hover:border-[color:var(--ds-border-subtle)] hover:bg-[color:var(--ds-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-accent-ring)] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-expanded={!isCollapsed}
                  aria-controls={contentId}
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                    aria-hidden="true"
                  />
                  <span>{isCollapsed ? "Mở rộng" : "Thu gọn"}</span>
                </button>
              </div>
            </div>

            <div
              id={contentId}
              className={`grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))] ${
                isCollapsed ? "hidden" : ""
              }`}
              aria-hidden={isCollapsed}
            >
              {group.items.map((item) => (
                <PermissionCheckbox
                  key={item.key}
                  label={item.label}
                  description={item.description}
                  checked={permissionValues?.[item.key]}
                  onChange={(value) => onPermissionChange(item.key, value)}
                  disabled={isPermissionDisabled?.(item) ?? false}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
