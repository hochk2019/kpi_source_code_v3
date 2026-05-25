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
