import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../../src/lib/utils";

export interface LoadingStateProps {
  /** Loading message */
  message?: string;
  /** Subtle description below message */
  description?: string;
  /** Size of the spinner and container */
  size?: "sm" | "md" | "lg";
  /** Custom icon instead of default spinner */
  icon?: ReactNode;
  /** Full screen overlay mode */
  fullscreen?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: {
    spinner: "h-4 w-4",
    container: "p-4 gap-2",
    message: "text-sm",
    description: "text-xs",
  },
  md: {
    spinner: "h-8 w-8",
    container: "p-8 gap-3",
    message: "text-base",
    description: "text-sm",
  },
  lg: {
    spinner: "h-12 w-12",
    container: "p-12 gap-4",
    message: "text-lg",
    description: "text-base",
  },
};

export function LoadingState({
  message = "Đang tải...",
  description,
  size = "md",
  icon,
  fullscreen = false,
  className,
}: LoadingStateProps) {
  const sizes = sizeConfig[size];

  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        sizes.container,
        className
      )}
      role="status"
      aria-live="polite"
    >
      {icon ?? (
        <Loader2
          className={cn("animate-spin text-ds-accent", sizes.spinner)}
          aria-hidden
        />
      )}
      <div className={cn("font-medium text-ds-text-primary", sizes.message)}>
        {message}
      </div>
      {description ? (
        <div className={cn("text-ds-text-muted", sizes.description)}>
          {description}
        </div>
      ) : null}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ds-surface-base/80 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return content;
}
