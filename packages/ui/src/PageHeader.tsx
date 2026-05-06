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
