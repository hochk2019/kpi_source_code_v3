import React, { useId, useMemo } from "react";

import { Input } from "@/components/ui/input.jsx";

export default function AgencyInput({
  value,
  onChange,
  options = [],
  placeholder = "Ví dụ: G&B",
  disabled = false,
}) {
  const listId = useId();
  const normalizedOptions = useMemo(() => {
    const seen = new Set();
    const list = [];
    options.forEach((item) => {
      const valueStr = String(item?.value || item).trim();
      if (!valueStr || seen.has(valueStr)) return;
      seen.add(valueStr);
      list.push({
        value: valueStr,
        label: item?.label || valueStr,
        hint: item?.hint || "",
      });
    });
    return list;
  }, [options]);

  return (
    <>
      <Input
        value={value || ""}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        list={listId}
        disabled={disabled}
      />
      <datalist id={listId}>
        {normalizedOptions.map((item) => (
          <option
            key={item.value}
            value={item.value}
            label={item.hint ? `${item.label} – ${item.hint}` : item.label}
          />
        ))}
      </datalist>
    </>
  );
}
