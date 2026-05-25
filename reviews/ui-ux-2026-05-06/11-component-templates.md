# 11 — Component Templates (Sample Code)

> **Starter code** cho 6 component mới. Agent có thể copy-paste vào files chỉ định, sau đó iterate.
> **Lưu ý**: Code dưới đây là **starter**, chưa hoàn thiện. Slice 4 phải:
> - Thêm tests đầy đủ (theo `08-test-and-typescript-fixes.md`)
> - Verify với gitnexus_impact (mặc dù file mới, không có upstream)
> - Tinh chỉnh edge cases visual
> - Đảm bảo accessibility (aria, focus management)

> **Imports được giả định** (verify khi paste):
> - `react`, `react-dom`
> - `@/components/ui/*` (shadcn components đã có)
> - `lucide-react`
> - `clsx` hoặc `cn` từ `@/lib/utils`
> - `@radix-ui/react-*` (đã có via shadcn)

---

## 1. `<PageHeader>` template

**File**: `e:\GPT\kpi_source_code_v4\packages\ui\src\PageHeader.tsx` (NEW)

```tsx
import { type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "../../../src/lib/utils";
import { InfoTooltip } from "./InfoTooltip";

export interface PageHeaderProps {
  /** Tên page (bắt buộc) */
  title: string;
  /** Eyebrow text uppercase nhỏ trên title */
  eyebrow?: string;
  /** Phụ đề ngắn dưới title (≤ 80 ký tự) */
  subtitle?: string;
  /** Info tooltip giải thích page */
  info?: string;
  /** Back link */
  back?: { label: string; href?: string; onClick?: () => void };
  /** Meta items (period, count, status badges) */
  meta?: ReactNode[];
  /** Actions chính (max 2: 1 primary + 1 secondary/dropdown) */
  actions?: ReactNode;
  /** Sticky on scroll */
  sticky?: boolean;
  /** Custom className */
  className?: string;
}

export function PageHeader({
  title,
  eyebrow,
  subtitle,
  info,
  back,
  meta,
  actions,
  sticky = false,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-1.5",
        "px-4 py-3 sm:px-6 sm:py-4",
        "border-b border-ds-border-subtle",
        sticky && "sticky top-0 z-20 bg-ds-surface-base/85 backdrop-blur",
        className
      )}
    >
      {back ? (
        <a
          href={back.href}
          onClick={(e) => {
            if (back.onClick) {
              e.preventDefault();
              back.onClick();
            }
          }}
          className="inline-flex items-center gap-1 text-xs text-ds-text-muted hover:text-ds-text-primary transition-colors"
        >
          <ArrowLeft size={14} aria-hidden />
          <span>{back.label}</span>
        </a>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5 min-w-0">
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ds-text-muted">
              {eyebrow}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <h1
              className="text-lg font-semibold text-ds-text-primary sm:text-xl truncate"
              title={title}
            >
              {title}
            </h1>
            {info ? <InfoTooltip content={info} /> : null}
            {meta && meta.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-ds-text-muted">
                {meta.map((item, idx) => (
                  <span key={idx} className="inline-flex items-center">
                    {idx > 0 ? <span className="mx-1.5 text-ds-text-muted-soft">·</span> : null}
                    {item}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {subtitle ? (
            <p className="text-sm text-ds-text-muted line-clamp-1">{subtitle}</p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
```

**Re-export**: `e:\GPT\kpi_source_code_v4\packages\ui\src\index.ts`
```ts
export { PageHeader, type PageHeaderProps } from "./PageHeader";
```

---

## 2. `<InfoTooltip>` template

**File**: `e:\GPT\kpi_source_code_v4\packages\ui\src\InfoTooltip.tsx` (NEW)

```tsx
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../src/components/ui/tooltip";
import { cn } from "../../../src/lib/utils";
import { type ReactNode } from "react";

export interface InfoTooltipProps {
  content: string | ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  size?: "xs" | "sm" | "md";
  variant?: "default" | "subtle";
  className?: string;
  ariaLabel?: string;
}

const sizeClass = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  md: "h-5 w-5",
};

export function InfoTooltip({
  content,
  side = "top",
  size = "sm",
  variant = "default",
  className,
  ariaLabel = "Thông tin",
}: InfoTooltipProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={ariaLabel}
            className={cn(
              "inline-flex items-center justify-center rounded-full",
              "text-ds-text-muted hover:text-ds-text-primary",
              "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent",
              variant === "subtle" && "opacity-60 hover:opacity-100",
              className
            )}
          >
            <Info aria-hidden className={sizeClass[size]} />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-xs">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

---

## 3. `<EmptyState>` template

**File**: `e:\GPT\kpi_source_code_v4\packages\ui\src\EmptyState.tsx` (NEW)

```tsx
import { type ReactNode } from "react";
import { cn } from "../../../src/lib/utils";

type EmptyStateAction = {
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  onClick?: () => void;
  href?: string;
  icon?: ReactNode;
};

export interface EmptyStateProps {
  /** Title chính (bắt buộc) */
  title: string;
  /** Description 1-2 dòng */
  description?: string;
  /** Icon (lucide component hoặc ReactNode) */
  icon?: ReactNode;
  /** Image/illustration thay icon */
  illustration?: ReactNode;
  /** Actions */
  actions?: EmptyStateAction[];
  /** Size */
  size?: "compact" | "md" | "lg";
  /** Tone */
  tone?: "neutral" | "info" | "success" | "warning";
  className?: string;
}

const sizeClass = {
  compact: {
    container: "p-4 gap-2",
    icon: "h-6 w-6",
    title: "text-sm",
    description: "text-xs",
  },
  md: {
    container: "p-8 gap-3",
    icon: "h-10 w-10",
    title: "text-base",
    description: "text-sm",
  },
  lg: {
    container: "p-12 gap-4",
    icon: "h-16 w-16",
    title: "text-lg",
    description: "text-base",
  },
};

const toneIconClass: Record<NonNullable<EmptyStateProps["tone"]>, string> = {
  neutral: "text-ds-text-muted",
  info: "text-ds-info",
  success: "text-ds-success",
  warning: "text-ds-warning",
};

const buttonVariantClass: Record<NonNullable<EmptyStateAction["variant"]>, string> = {
  primary: "bg-brand-500 text-brand-on-500 hover:bg-brand-600",
  secondary:
    "bg-ds-surface-card border border-ds-border-subtle text-ds-text-primary hover:bg-ds-surface-muted",
  ghost: "text-ds-text-secondary hover:text-ds-text-primary hover:bg-ds-surface-muted",
};

export function EmptyState({
  title,
  description,
  icon,
  illustration,
  actions,
  size = "md",
  tone = "neutral",
  className,
}: EmptyStateProps) {
  const sizes = sizeClass[size];
  const showDescription = size !== "compact" && description;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        sizes.container,
        className
      )}
      role="status"
    >
      {illustration ?? (
        icon ? (
          <div className={cn("flex items-center justify-center", toneIconClass[tone])}>
            <span className={sizes.icon}>{icon}</span>
          </div>
        ) : null
      )}
      <h3 className={cn("font-semibold text-ds-text-primary", sizes.title)}>{title}</h3>
      {showDescription ? (
        <p className={cn("max-w-md text-ds-text-muted", sizes.description)}>{description}</p>
      ) : null}
      {actions && actions.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {actions.map((action, idx) => {
            const Tag = action.href ? "a" : "button";
            return (
              <Tag
                key={idx}
                href={action.href}
                onClick={action.onClick}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  buttonVariantClass[action.variant ?? "secondary"]
                )}
              >
                {action.icon}
                {action.label}
              </Tag>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
```

---

## 4. `<PermissionBanner>` template

**File**: `e:\GPT\kpi_source_code_v4\packages\ui\src\PermissionBanner.tsx` (NEW)

```tsx
import { useState, useEffect, type ReactNode } from "react";
import { AlertTriangle, Info as InfoIcon, AlertCircle, X } from "lucide-react";
import { cn } from "../../../src/lib/utils";

type PermissionBannerLevel = "info" | "warning" | "error";

type PermissionBannerAction = {
  label: string;
  variant?: "primary" | "secondary";
  onClick?: () => void;
};

export interface PermissionBannerProps {
  title: string;
  description: string;
  level?: PermissionBannerLevel;
  actions?: PermissionBannerAction[];
  dismissible?: boolean;
  /** Lưu dismiss state vào localStorage với key này */
  persistKey?: string;
  className?: string;
}

const levelConfig: Record<
  PermissionBannerLevel,
  { container: string; iconWrapper: string; icon: ReactNode }
> = {
  info: {
    container: "bg-ds-info/8 border-ds-info/20 text-ds-text-primary",
    iconWrapper: "text-ds-info",
    icon: <InfoIcon className="h-5 w-5" aria-hidden />,
  },
  warning: {
    container: "bg-ds-warning/8 border-ds-warning/30 text-ds-text-primary",
    iconWrapper: "text-ds-warning",
    icon: <AlertTriangle className="h-5 w-5" aria-hidden />,
  },
  error: {
    container: "bg-ds-destructive/8 border-ds-destructive/20 text-ds-text-primary",
    iconWrapper: "text-ds-destructive",
    icon: <AlertCircle className="h-5 w-5" aria-hidden />,
  },
};

const buttonVariantClass = {
  primary: "bg-brand-500 text-brand-on-500 hover:bg-brand-600",
  secondary:
    "bg-ds-surface-card border border-ds-border-subtle text-ds-text-primary hover:bg-ds-surface-muted",
};

export function PermissionBanner({
  title,
  description,
  level = "warning",
  actions,
  dismissible = false,
  persistKey,
  className,
}: PermissionBannerProps) {
  const storageKey = persistKey ? `perm-banner-dismissed:${persistKey}` : null;
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (storageKey) {
      try {
        const value = window.localStorage.getItem(storageKey);
        if (value === "1") setDismissed(true);
      } catch {
        // localStorage unavailable
      }
    }
  }, [storageKey]);

  const handleDismiss = () => {
    setDismissed(true);
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, "1");
      } catch {
        // localStorage unavailable
      }
    }
  };

  if (dismissed) return null;

  const config = levelConfig[level];

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-md border px-4 py-3",
        config.container,
        className
      )}
    >
      <div className={cn("shrink-0 mt-0.5", config.iconWrapper)}>{config.icon}</div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-0.5 text-sm text-ds-text-secondary">{description}</p>
        {actions && actions.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {actions.map((action, idx) => (
              <button
                key={idx}
                type="button"
                onClick={action.onClick}
                className={cn(
                  "inline-flex items-center rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  buttonVariantClass[action.variant ?? "secondary"]
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {dismissible ? (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Đóng thông báo"
          className="shrink-0 rounded-md p-1 text-ds-text-muted hover:text-ds-text-primary hover:bg-ds-surface-muted"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
```

---

## 5. `<ExportDropdown>` template

**File**: `e:\GPT\kpi_source_code_v4\packages\ui\src\ExportDropdown.tsx` (NEW)

```tsx
import { useState, type ReactNode } from "react";
import { Download, ChevronDown, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../src/components/ui/dropdown-menu";
import { cn } from "../../../src/lib/utils";

export interface ExportItem {
  id: string;
  label: string;
  description?: string;
  format: string;
  scope?: "filtered" | "all";
  disabled?: boolean;
  disabledReason?: string;
}

export interface ExportDropdownProps {
  items: ExportItem[];
  onExport: (item: ExportItem) => void | Promise<void>;
  triggerLabel?: string;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
}

export function ExportDropdown({
  items,
  onExport,
  triggerLabel = "Xuất báo cáo",
  disabled = false,
  icon,
  className,
}: ExportDropdownProps) {
  const [busy, setBusy] = useState(false);

  const handleSelect = async (item: ExportItem) => {
    if (item.disabled || busy) return;
    setBusy(true);
    try {
      await onExport(item);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled || busy}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border border-ds-border-subtle bg-ds-surface-card",
            "px-3 py-1.5 text-sm font-medium text-ds-text-primary transition-colors",
            "hover:bg-ds-surface-muted",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            className
          )}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            icon ?? <Download className="h-4 w-4" aria-hidden />
          )}
          <span>{triggerLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-ds-text-muted">
          Chọn định dạng xuất
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem
            key={item.id}
            disabled={item.disabled || busy}
            onSelect={() => handleSelect(item)}
            className={cn(
              "flex flex-col items-start gap-0.5 cursor-pointer",
              item.disabled && "opacity-60"
            )}
            title={item.disabled ? item.disabledReason : undefined}
          >
            <span className="text-sm font-medium text-ds-text-primary">{item.label}</span>
            {item.description ? (
              <span className="text-xs text-ds-text-muted">{item.description}</span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## 6. `<BulkActionBar>` template

**File**: `e:\GPT\kpi_source_code_v4\packages\ui\src\BulkActionBar.tsx` (NEW)

```tsx
import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../../src/lib/utils";

type BulkAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "destructive";
  onClick?: () => void;
  disabled?: boolean;
  disabledReason?: string;
};

export interface BulkActionBarProps {
  selectedCount: number;
  totalCount?: number;
  actions: BulkAction[];
  onClear?: () => void;
  onSelectAll?: () => void;
  /** Hidden when selectedCount=0 (default true) */
  autoHide?: boolean;
  className?: string;
}

const variantClass: Record<NonNullable<BulkAction["variant"]>, string> = {
  primary: "bg-brand-500 text-brand-on-500 hover:bg-brand-600",
  secondary:
    "bg-ds-surface-card border border-ds-border-subtle text-ds-text-primary hover:bg-ds-surface-muted",
  destructive:
    "bg-ds-destructive/10 border border-ds-destructive/20 text-ds-destructive hover:bg-ds-destructive/20",
};

export function BulkActionBar({
  selectedCount,
  totalCount,
  actions,
  onClear,
  onSelectAll,
  autoHide = true,
  className,
}: BulkActionBarProps) {
  // ESC key clears selection
  useEffect(() => {
    if (!onClear) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedCount > 0) {
        onClear();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClear, selectedCount]);

  if (autoHide && selectedCount === 0) return null;

  return (
    <div
      role="region"
      aria-label="Hành động hàng loạt"
      className={cn(
        "sticky bottom-0 z-30",
        "flex flex-wrap items-center justify-between gap-3",
        "border-t border-ds-border-subtle bg-ds-surface-card/95 backdrop-blur",
        "px-4 py-2.5",
        "shadow-[0_-4px_12px_rgba(15,23,42,0.06)]",
        "animate-in slide-in-from-bottom duration-200",
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm text-ds-text-primary">
        <span className="inline-flex items-center justify-center rounded-full bg-ds-accent-soft px-2 py-0.5 text-xs font-semibold text-ds-accent">
          ✓ {selectedCount}
          {totalCount !== undefined ? `/${totalCount}` : ""}
        </span>
        <span>đã chọn</span>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-xs text-ds-text-muted hover:text-ds-text-primary"
            aria-label="Bỏ chọn tất cả"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            <span>Bỏ chọn</span>
          </button>
        ) : null}
        {onSelectAll && totalCount !== undefined && selectedCount < totalCount ? (
          <button
            type="button"
            onClick={onSelectAll}
            className="text-xs text-ds-accent hover:underline"
          >
            Chọn tất cả {totalCount}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.disabled ? action.disabledReason : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              variantClass[action.variant ?? "secondary"],
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

## 7. `<FilterBar>` template (compound)

**File**: `e:\GPT\kpi_source_code_v4\packages\ui\src\FilterBar.tsx` (NEW)

```tsx
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
```

---

## 8. Re-exports & integration

### 8.1 — Add exports

**File**: `e:\GPT\kpi_source_code_v4\packages\ui\src\index.ts`

```ts
// Existing exports...

// New components (slice 4)
export { PageHeader, type PageHeaderProps } from "./PageHeader";
export { InfoTooltip, type InfoTooltipProps } from "./InfoTooltip";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { PermissionBanner, type PermissionBannerProps } from "./PermissionBanner";
export { ExportDropdown, type ExportDropdownProps, type ExportItem } from "./ExportDropdown";
export { BulkActionBar, type BulkActionBarProps } from "./BulkActionBar";
export {
  FilterBar,
  type FilterBarProps,
  type FilterSearchProps,
  type FilterSelectProps,
  type FilterDateRangeProps,
  type FilterToggleProps,
} from "./FilterBar";
```

### 8.2 — Designsystem re-export

**File**: `e:\GPT\kpi_source_code_v4\src\components\designSystem\primitives.jsx` (extend)

```jsx
// Existing re-exports...

// New components (slice 4)
export {
  PageHeader,
  InfoTooltip,
  EmptyState,
  PermissionBanner,
  ExportDropdown,
  BulkActionBar,
  FilterBar,
} from "@kpi/ui";
```

(Verify package alias `@kpi/ui` đang map đúng `packages/ui/src/index.ts`)

---

## 9. Tokens cần expose qua Tailwind

**File**: `e:\GPT\kpi_source_code_v4\tailwind.config.ts` (verify slice 1.1)

```ts
import { type Config } from "tailwindcss";

export default {
  // ...
  theme: {
    extend: {
      colors: {
        "ds-surface-base": "var(--ds-surface-base)",
        "ds-surface-card": "var(--ds-surface-card)",
        "ds-surface-muted": "var(--ds-surface-muted)",
        "ds-surface-raised": "var(--ds-surface-raised)",
        "ds-surface-overlay": "var(--ds-surface-overlay)",
        "ds-text-primary": "var(--ds-text-primary)",
        "ds-text-secondary": "var(--ds-text-secondary)",
        "ds-text-muted": "var(--ds-text-muted)",
        "ds-text-muted-soft": "var(--ds-text-muted-soft)",
        "ds-text-inverse": "var(--ds-text-inverse)",
        "ds-border-subtle": "var(--ds-border-subtle)",
        "ds-border-strong": "var(--ds-border-strong)",
        "ds-info": "var(--ds-info)",
        "ds-success": "var(--ds-success)",
        "ds-warning": "var(--ds-warning)",
        "ds-destructive": "var(--ds-destructive)",
        "ds-accent": "var(--ds-accent)",
        "ds-accent-strong": "var(--ds-accent-strong)",
        "ds-accent-soft": "var(--ds-accent-soft)",
        "brand-50": "var(--brand-50)",
        "brand-100": "var(--brand-100)",
        "brand-500": "var(--brand-500)",
        "brand-600": "var(--brand-600)",
        "brand-700": "var(--brand-700)",
        "brand-on-500": "var(--brand-on-500, #ffffff)",
      },
      borderRadius: {
        "ds-xs": "var(--ds-radius-xs)",
        "ds-sm": "var(--ds-radius-sm)",
        "ds-md": "var(--ds-radius-md)",
        "ds-lg": "var(--ds-radius-lg)",
        "ds-pill": "var(--ds-radius-pill)",
      },
      boxShadow: {
        "ds-sm": "var(--ds-shadow-sm)",
        "ds-md": "var(--ds-shadow-md)",
        "ds-lg": "var(--ds-shadow-lg)",
      },
      transitionDuration: {
        "ds-fast": "var(--ds-duration-fast)",
        "ds-md": "var(--ds-duration-md)",
        "ds-slow": "var(--ds-duration-slow)",
      },
    },
  },
} satisfies Config;
```

---

## 10. Sample usage trong page

### 10.1 — Dashboard usage (slice 5.1)

```tsx
import { PageHeader, EmptyState, PermissionBanner } from "@/components/designSystem/primitives";
import { Database, RefreshCw } from "lucide-react";

export default function AppDashboardLanding({ canEdit, period, ... }) {
  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="TỔNG QUAN"
        title="Tổng quan KPI"
        info="Bảng tổng hợp KPI realtime cho kỳ hiện tại"
        meta={[
          <span key="period">Kỳ {formatPeriod(period)}</span>,
        ]}
        actions={
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-md border border-ds-border-subtle bg-ds-surface-card px-3 py-1.5 text-sm font-medium text-ds-text-primary hover:bg-ds-surface-muted"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            <span>Làm mới</span>
          </button>
        }
        sticky
      />

      {!canEdit ? (
        <PermissionBanner
          title="Quyền hạn chế"
          description="Tài khoản đang đăng nhập với quyền guest. Đăng nhập admin để có toàn quyền."
          level="warning"
          actions={[{ label: "Đăng nhập admin", variant: "primary", onClick: openLogin }]}
          dismissible
          persistKey="dashboard-perm"
        />
      ) : null}

      {totalRecords === 0 ? (
        <EmptyState
          size="lg"
          icon={<Database />}
          title="Chưa có dữ liệu kỳ này"
          description="Hãy import tờ khai từ ECUS hoặc tải file XLSX để bắt đầu."
          actions={[
            {
              label: "Mở Import Data",
              variant: "primary",
              onClick: () => navigate("?section=operations&tab=import"),
            },
          ]}
        />
      ) : (
        <MetricsGrid ... />
      )}
    </div>
  );
}
```

### 10.2 — MST page usage (slice 5.3)

```tsx
import { PageHeader, FilterBar, ExportDropdown, BulkActionBar } from "@/components/designSystem/primitives";

export default function MSTAssignment({ rows, canEdit, ... }) {
  const [search, setSearch] = useState("");
  const [team, setTeam] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  return (
    <>
      <PageHeader
        eyebrow="VẬN HÀNH"
        title="Gán MST & Đại lý HQ"
        info="Quản lý phân bổ MST cho team và đại lý HQ"
        actions={
          <button
            type="button"
            disabled={!isDirty || !canEdit}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-brand-on-500 hover:bg-brand-600 disabled:opacity-50"
          >
            Lưu thay đổi {dirtyCount > 0 ? `(${dirtyCount})` : ""}
          </button>
        }
      />

      <FilterBar onReset={resetAll} activeFilterCount={activeCount}>
        <FilterBar.Search
          value={search}
          onChange={setSearch}
          placeholder="Tìm MST, tên công ty..."
        />
        <FilterBar.Select
          label="Tổ đội"
          value={team}
          options={teamOptions}
          onChange={setTeam}
        />
        <FilterBar.Spacer />
        <FilterBar.Actions>
          <ExportDropdown
            items={[
              { id: "xlsx-filtered", label: "Excel (kết quả lọc)", format: "xlsx", scope: "filtered" },
              { id: "csv-filtered", label: "CSV (kết quả lọc)", format: "csv", scope: "filtered" },
              { id: "xlsx-all", label: "Excel (toàn bộ)", format: "xlsx", scope: "all" },
              { id: "csv-all", label: "CSV (toàn bộ)", format: "csv", scope: "all" },
            ]}
            onExport={handleExport}
          />
        </FilterBar.Actions>
      </FilterBar>

      <DataTable
        rows={filteredRows}
        columns={mstColumns}
        selection={{
          selectedKeys: selected,
          onChange: setSelected,
          keyExtractor: (r) => r.mst,
        }}
      />

      <BulkActionBar
        selectedCount={selected.size}
        totalCount={filteredRows.length}
        onClear={() => setSelected(new Set())}
        actions={[
          { id: "assign", label: "Gán team", variant: "primary", onClick: openAssignDialog },
          { id: "export", label: "Xuất", variant: "secondary", onClick: () => exportSelected(selected) },
        ]}
      />
    </>
  );
}
```

---

## 11. Lưu ý integration

### 11.1 — Verify imports

Khi paste code, agent phải:

1. Confirm `cn()` từ `src/lib/utils.ts` đang export đúng
2. Confirm `@/components/ui/dropdown-menu`, `tooltip` đã có (shadcn)
3. Confirm `lucide-react` đã có trong `package.json`
4. Confirm tailwind config đã expose `ds-*` colors trước khi compile

### 11.2 — Path alias

Sample code dùng path relative `../../../src/lib/utils` — agent cần đổi sang absolute alias nếu repo có config:

```tsx
// Có thể đổi:
import { cn } from "../../../src/lib/utils";
// Sang:
import { cn } from "@/lib/utils";
```

Verify `tsconfig.json` paths trước khi đổi.

### 11.3 — Test files đầu tiên

Sau khi tạo mỗi component, ngay lập tức tạo file test theo pattern `08-test-and-typescript-fixes.md` mục D.

### 11.4 — Build verify

Sau slice 4 (build component xong), verify:

```powershell
rtk pnpm run typecheck:frontend
rtk pnpm exec vitest run tests/PageHeader.test.tsx tests/FilterBar.test.tsx tests/ExportDropdown.test.tsx tests/EmptyState.test.tsx tests/PermissionBanner.test.tsx tests/BulkActionBar.test.tsx
rtk pnpm run test:smoke:frontend-core
```

→ Nếu pass, slice 4 sẵn sàng cho slice 5 sử dụng.
