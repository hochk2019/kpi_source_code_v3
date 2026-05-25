import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  MIN_PAGE_SIZE,
  normalizePageSize,
  PAGE_SIZE_OPTIONS,
} from "@/components/mst-assignment/hooks/useMSTAssignmentPageSize.js";

export default function PageSizeControl({
  value,
  onChange,
  options = PAGE_SIZE_OPTIONS,
  minValue = MIN_PAGE_SIZE,
  selectId = "mst-assignment-page-size",
}) {
  const hasPredefinedOption = options.includes(value);
  const [customValue, setCustomValue] = useState(() => String(Math.max(minValue, value || minValue)));
  const [selectedOption, setSelectedOption] = useState(() =>
    hasPredefinedOption ? String(value) : "custom"
  );
  const previousValueRef = useRef(value);

  useEffect(() => {
    if (previousValueRef.current === value) {
      return;
    }
    previousValueRef.current = value;
    const nextHasOption = options.includes(value);
    const nextOption = nextHasOption ? String(value) : "custom";
    setSelectedOption(nextOption);
    if (!nextHasOption) {
      setCustomValue(String(Math.max(minValue, value || minValue)));
    }
  }, [minValue, options, value]);

  const handleSelectChange = useCallback(
    (event) => {
      const next = event.target.value;
      if (next === "custom") {
        setSelectedOption("custom");
        setCustomValue(String(Math.max(minValue, value || minValue)));
        return;
      }
      setSelectedOption(next);
      const numeric = Number(next);
      if (Number.isFinite(numeric)) {
        onChange(normalizePageSize(numeric, minValue));
      }
    },
    [minValue, onChange, value]
  );

  const handleCustomChange = useCallback((event) => {
    const next = event.target.value;
    if (/^\d*$/.test(next)) {
      setCustomValue(next);
    }
  }, []);

  const applyCustomValue = useCallback(() => {
    if (customValue === "") {
      const fallback = Math.max(minValue, value || minValue);
      setCustomValue(String(fallback));
      onChange(fallback);
      return;
    }
    const normalized = normalizePageSize(customValue, minValue);
    setCustomValue(String(normalized));
    onChange(normalized);
  }, [customValue, minValue, onChange, value]);

  const handleCustomBlur = useCallback(() => {
    applyCustomValue();
  }, [applyCustomValue]);

  const handleCustomKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyCustomValue();
      }
    },
    [applyCustomValue]
  );

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
      <label htmlFor={selectId} className="font-medium text-gray-700">
        Số dòng mỗi trang
      </label>
      <select
        id={selectId}
        className="rounded border px-2 py-1"
        value={selectedOption}
        onChange={handleSelectChange}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option} dòng
          </option>
        ))}
        <option value="custom">Tùy chỉnh…</option>
      </select>
      {selectedOption === "custom" ? (
        <div className="flex items-center gap-2">
          <label htmlFor={`${selectId}-custom`} className="sr-only">
            Nhập số dòng tùy chỉnh
          </label>
          <input
            id={`${selectId}-custom`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="w-20 rounded border px-2 py-1 text-right"
            value={customValue}
            onChange={handleCustomChange}
            onBlur={handleCustomBlur}
            onKeyDown={handleCustomKeyDown}
            aria-describedby={`${selectId}-hint`}
          />
          <span id={`${selectId}-hint`} className="text-xs text-gray-500">
            Tối thiểu {minValue} dòng
          </span>
        </div>
      ) : null}
    </div>
  );
}
