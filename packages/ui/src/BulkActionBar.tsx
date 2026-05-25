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
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm text-ds-text-primary">
        <span className="inline-flex items-center justify-center rounded-full bg-ds-accent-soft px-2 py-0.5 text-xs font-semibold text-ds-accent">
          {selectedCount}
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
