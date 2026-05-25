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
      <DropdownMenuTrigger asChild disabled={disabled || busy}>
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
