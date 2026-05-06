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
