import React, { useId, useMemo } from "react";

import { Input } from "@/components/ui/input.tsx";

export default function LicenseCodeInput({
  value,
  onChange,
  options = [],
  placeholder = "Ví dụ: ZB02",
  disabled = false,
}) {
  const listId = useId();
  const normalizedOptions = useMemo(() => {
    return options
      .map((item) => ({
        value: String(item?.value || "").trim().toUpperCase(),
        count: Number.isFinite(item?.count) ? Number(item.count) : 0,
      }))
      .filter((item) => item.value);
  }, [options]);

  return (
    <>
      <Input
        value={value || ""}
        onChange={(event) => onChange?.(event.target.value.toUpperCase())}
        placeholder={placeholder}
        list={listId}
        disabled={disabled}
      />
      <datalist id={listId}>
        {normalizedOptions.map((item) => (
          <option
            key={item.value}
            value={item.value}
            label={
              item.count
                ? `${item.value} (${item.count.toLocaleString("vi-VN")})`
                : item.value
            }
          />
        ))}
      </datalist>
    </>
  );
}
