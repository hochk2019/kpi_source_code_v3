import React from "react";

import { CircleX, Search } from "lucide-react";

import { cn } from "../../../src/lib/utils.js";

export function SectionSurface({ as = "section", className, children, ...props }) {
  return React.createElement(as, { className: cn("ds-card ds-section", className), ...props }, children);
}

export function SectionHeader({
  title,
  description,
  meta,
  actions,
  className,
  titleClassName,
  descriptionClassName,
  titleAs = "h2",
  ...props
}) {
  return (
    <div className={cn("ds-section__header", className)} {...props}>
      <div className="ds-section__intro">
        {React.createElement(titleAs, { className: cn("ds-section__title", titleClassName) }, title)}
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

export function SectionToolbar({
  children,
  actions,
  className,
  mainClassName,
  actionsClassName,
  ...props
}) {
  return (
    <div className={cn("ds-toolbar", className)} {...props}>
      <div className={cn("ds-toolbar__main", mainClassName)}>{children}</div>
      {actions ? <div className={cn("ds-toolbar__actions", actionsClassName)}>{actions}</div> : null}
    </div>
  );
}

export const SearchField = React.forwardRef(function SearchField(
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
