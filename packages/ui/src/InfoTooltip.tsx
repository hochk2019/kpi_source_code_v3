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
            <Info className={sizeClass[size]} aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
