import { useState, useEffect, type ReactNode, type ChangeEvent } from "react";
import { Search, X, ChevronDown, Filter } from "lucide-react";
import { cn } from "../../../src/lib/utils";

// ========== Root ==========

export interface FilterBarProps {
  children: ReactNode;
  onReset?: () => void;
  activeFilterCount?: number;
  sticky?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
}

export function FilterBarRoot({
  children,
  onReset,
  activeFilterCount = 0,
  sticky = false,
  collapsible = false,
  defaultCollapsed = false,
  className,
}: FilterBarProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div
      className={cn(
        "border-b border-ds-border-subtle bg-ds-surface-base",
        sticky && "sticky top-12 z-10",
        className
      )}
    >
      {collapsible ? (
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2 text-sm text-ds-text-secondary hover:bg-ds-surface-muted"
          aria-expanded={!collapsed}
        >
          <span className="inline-flex items-center gap-2">
            <Filter className="h-4 w-4" aria-hidden />
            <span>Bộ lọc</span>
            {activeFilterCount > 0 ? (
              <span className="inline-flex items-center justify-center rounded-full bg-ds-accent-soft px-1.5 text-xs font-semibold text-ds-accent">
                {activeFilterCount}
              </span>
            ) : null}
          </span>
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", !collapsed && "rotate-180")}
            aria-hidden
          />
        </button>
      ) : null}
      {!collapsed ? (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 sm:gap-3">
          {children}
          {onReset && activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 text-xs text-ds-text-muted hover:text-ds-text-primary ml-auto"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              <span>Xoá bộ lọc</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ========== Search ==========

export interface FilterSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export function FilterSearch({
  value,
  onChange,
  placeholder = "Tìm kiếm...",
  debounceMs = 250,
  className,
}: FilterSearchProps) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (local !== value) onChange(local);
    }, debounceMs);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, debounceMs]);

  return (
    <div className={cn("relative flex-1 min-w-[180px] max-w-[320px]", className)}>
      <Search
        className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-text-muted pointer-events-none"
        aria-hidden
      />
      <input
        type="search"
        value={local}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setLocal(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-md border border-ds-border-subtle bg-ds-surface-card",
          "pl-8 pr-8 py-1.5 text-sm text-ds-text-primary placeholder:text-ds-text-muted",
          "focus:outline-none focus:ring-2 focus:ring-ds-accent focus:border-transparent"
        )}
      />
      {local ? (
        <button
          type="button"
          onClick={() => setLocal("")}
          aria-label="Xoá tìm kiếm"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-ds-text-muted hover:text-ds-text-primary"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

// ========== Select ==========

export interface FilterSelectProps {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  className?: string;
}

export function FilterSelect({
  label,
  value,
  options,
  onChange,
  className,
}: FilterSelectProps) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-ds-text-muted",
        className
      )}
    >
      <span className="font-medium">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "rounded-md border border-ds-border-subtle bg-ds-surface-card",
          "px-2 py-1 text-sm text-ds-text-primary",
          "focus:outline-none focus:ring-2 focus:ring-ds-accent"
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ========== DateRange ==========

export interface FilterDateRangeProps {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  fromLabel?: string;
  toLabel?: string;
  className?: string;
}

export function FilterDateRange({
  from,
  to,
  onChange,
  fromLabel = "Từ",
  toLabel = "Đến",
  className,
}: FilterDateRangeProps) {
  return (
    <div className={cn("inline-flex items-center gap-1.5 text-xs text-ds-text-muted", className)}>
      <label className="inline-flex items-center gap-1">
        <span className="font-medium">{fromLabel}:</span>
        <input
          type="date"
          value={from}
          onChange={(e) => onChange({ from: e.target.value, to })}
          className="rounded-md border border-ds-border-subtle bg-ds-surface-card px-2 py-1 text-sm text-ds-text-primary focus:outline-none focus:ring-2 focus:ring-ds-accent"
        />
      </label>
      <label className="inline-flex items-center gap-1">
        <span className="font-medium">{toLabel}:</span>
        <input
          type="date"
          value={to}
          onChange={(e) => onChange({ from, to: e.target.value })}
          className="rounded-md border border-ds-border-subtle bg-ds-surface-card px-2 py-1 text-sm text-ds-text-primary focus:outline-none focus:ring-2 focus:ring-ds-accent"
        />
      </label>
    </div>
  );
}

// ========== Toggle ==========

export interface FilterToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  className?: string;
}

export function FilterToggle({ label, value, onChange, className }: FilterToggleProps) {
  return (
    <label className={cn("inline-flex items-center gap-1.5 text-xs text-ds-text-secondary cursor-pointer", className)}>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-ds-border-subtle text-ds-accent focus:ring-ds-accent"
      />
      <span>{label}</span>
    </label>
  );
}

// ========== Spacer + Actions ==========

export function FilterSpacer() {
  return <div className="flex-1" />;
}

export function FilterActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2 ml-auto">{children}</div>;
}

// ========== Compound exports ==========

export const FilterBar = Object.assign(FilterBarRoot, {
  Search: FilterSearch,
  Select: FilterSelect,
  DateRange: FilterDateRange,
  Toggle: FilterToggle,
  Spacer: FilterSpacer,
  Actions: FilterActions,
});
