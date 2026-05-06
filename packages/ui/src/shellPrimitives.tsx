import React from "react";
import { CircleX, Search } from "lucide-react";
import { cn } from "../../../src/lib/utils.js";
import { InfoTooltip } from "./InfoTooltip";

interface SectionSurfaceProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  className?: string;
  children?: React.ReactNode;
}

export function SectionSurface({ as: Component = "section", className, children, ...props }: SectionSurfaceProps) {
  return <Component className={cn("ds-card ds-section", className)} {...props}>{children}</Component>;
}

interface SectionHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  /** @deprecated Use `info` prop instead for tooltip content */
  description?: React.ReactNode;
  /** Tooltip content displayed next to title */
  info?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  titleAs?: React.ElementType;
}

export function SectionHeader({
  title,
  description,
  info,
  meta,
  actions,
  className,
  titleClassName,
  descriptionClassName,
  titleAs: TitleComponent = "h2",
  ...props
}: SectionHeaderProps) {
  // Warn about deprecated description prop in dev mode
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'development';
  if (description && isDev) {
    console.warn('[SectionHeader] `description` prop is deprecated. Use `info` for tooltip or `meta` for status info instead.');
  }

  return (
    <div className={cn("ds-section__header", className)} {...props}>
      <div className="ds-section__intro">
        <div className="flex items-center gap-2">
          <TitleComponent className={cn("ds-section__title", titleClassName)}>{title}</TitleComponent>
          {info ? <InfoTooltip content={info} size="sm" variant="subtle" /> : null}
        </div>
        {description ? (
          <p className={cn("ds-section__description", descriptionClassName)}>{description}</p>
        ) : null}
      </div>
      {meta || actions ? (
        <div className="ds-section__aside">
          {meta ? <div className="ds-section__meta">{meta}</div> : null}
          {actions ? <div className="ds-toolbar__actions">{actions}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

interface SectionToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  mainClassName?: string;
  actionsClassName?: string;
}

export function SectionToolbar({
  children,
  actions,
  className,
  mainClassName,
  actionsClassName,
  ...props
}: SectionToolbarProps) {
  return (
    <div className={cn("ds-toolbar", className)} {...props}>
      <div className={cn("ds-toolbar__main", mainClassName)}>{children}</div>
      {actions ? <div className={cn("ds-toolbar__actions", actionsClassName)}>{actions}</div> : null}
    </div>
  );
}

interface SearchFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  label: string;
  hideLabel?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear?: () => void;
  clearLabel?: string;
  placeholder?: string;
  className?: string;
  controlClassName?: string;
  inputClassName?: string;
  trailingContent?: React.ReactNode;
  trailingClassName?: string;
  icon?: boolean;
}

export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  {
    id,
    label,
    hideLabel = false,
    value = "",
    onChange,
    onClear,
    clearLabel = "Xóa tìm kiếm",
    placeholder = "Tìm kiếm…",
    className,
    controlClassName,
    inputClassName,
    trailingContent,
    trailingClassName,
    icon = true,
    ...props
  },
  ref,
) {
  const generatedId = React.useId();
  const inputId = id || `ds-search-field-${generatedId}`;

  return (
    <div className={cn("ds-search-field", className)}>
      <label htmlFor={inputId} className={cn("ds-search-field__label", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className={cn("ds-search-field__control", controlClassName)}>
        {icon ? (
          <span className="ds-search-field__icon" aria-hidden="true">
            <Search className="h-4 w-4" />
          </span>
        ) : null}
        <input
          {...props}
          id={inputId}
          ref={ref}
          type="search"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={cn("ds-search-field__input", inputClassName)}
        />
        {value && onClear ? (
          <button
            type="button"
            onClick={onClear}
            aria-label={clearLabel}
            className="ds-search-field__clear"
          >
            <CircleX className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
        {trailingContent ? (
          <span className={cn("ds-search-field__trailing", trailingClassName)}>{trailingContent}</span>
        ) : null}
      </div>
    </div>
  );
});
