import React, { useCallback, useEffect, useId, useRef } from "react";

import clsx from "clsx";

import {
  getCompanyNameWarnings,
  sanitizeCompanyNameInput,
  shouldWrapCompanyName,
} from "@/components/mst-assignment/model/companyName.js";

export default function CompanyNameCell({
  value,
  isReadOnly,
  onChange,
  placeholder = "Tên công ty",
}) {
  const safeValue = value == null ? "" : value.toString();
  const trimmedValue = safeValue.trim();
  const shouldWrap = shouldWrapCompanyName(safeValue);
  const warnings = getCompanyNameWarnings(safeValue);
  const textareaRef = useRef(null);
  const warningId = useId();

  const adjustTextareaHeight = useCallback(
    (element, nextValue) => {
      const target = element || textareaRef.current;
      if (!target) {
        return;
      }

      const measuredValue = nextValue ?? safeValue;
      const wrapCandidate = shouldWrapCompanyName(measuredValue);
      const baseMinHeight = wrapCandidate ? 40 : 36;

      target.style.minHeight = `${baseMinHeight}px`;
      target.style.height = "auto";
      const nextHeight = Math.max(target.scrollHeight, baseMinHeight);
      target.style.height = `${nextHeight}px`;
    },
    [safeValue]
  );

  useEffect(() => {
    adjustTextareaHeight();
  }, [safeValue, adjustTextareaHeight]);

  if (isReadOnly) {
    if (!trimmedValue) {
      return (
        <span className="italic text-gray-400" data-company-wrap="empty">
          (Không tên)
        </span>
      );
    }

    return (
      <span
        className={clsx(
          "block whitespace-normal break-words text-gray-900",
          shouldWrap ? "leading-snug" : "leading-normal"
        )}
        title={safeValue}
        data-company-wrap={shouldWrap ? "wrapped" : "single"}
        style={{ wordBreak: "break-word" }}
      >
        {safeValue}
      </span>
    );
  }

  const handleChange = (event) => {
    const sanitizedValue = sanitizeCompanyNameInput(event.target.value);
    adjustTextareaHeight(event.target, sanitizedValue);
    if (!onChange) {
      return;
    }

    if (sanitizedValue !== safeValue || event.target.value !== safeValue) {
      onChange(sanitizedValue);
    }
  };

  return (
    <div className="space-y-1">
      <textarea
        ref={textareaRef}
        value={safeValue}
        onChange={handleChange}
        className={clsx(
          "border rounded px-2 py-1 w-full resize-y whitespace-normal break-words",
          shouldWrap ? "leading-snug min-h-[2.5rem]" : "leading-normal min-h-[2.25rem]",
          warnings.length ? "border-amber-400 bg-amber-50/40" : null
        )}
        placeholder={placeholder}
        title={trimmedValue ? safeValue : undefined}
        spellCheck={false}
        aria-describedby={warnings.length ? warningId : undefined}
        data-company-wrap={shouldWrap ? "wrapped" : "single"}
        data-company-warning-count={warnings.length}
        style={{ wordBreak: "break-word" }}
      />
      {warnings.length ? (
        <div id={warningId} className="space-y-1">
          {warnings.map((warning) => (
            <p key={warning.code} className="text-xs text-amber-700">
              {warning.message}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
