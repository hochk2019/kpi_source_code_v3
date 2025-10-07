import React, { useEffect, useMemo, useState } from "react";

function resolveInitialOpen(storageKey, defaultOpen) {
  if (!storageKey || typeof window === "undefined") {
    return defaultOpen;
  }
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "0") return false;
    if (stored === "1") return true;
  } catch (err) {
    console.warn("Không thể đọc trạng thái thu gọn", err);
  }
  return defaultOpen;
}

export default function CollapsibleCard({
  id,
  storageKey,
  title,
  description = "",
  actions = null,
  defaultOpen = true,
  className = "",
  bodyClassName = "",
  children,
}) {
  const effectiveStorageKey = useMemo(() => {
    if (storageKey) return storageKey;
    if (id) return `collapsible:${id}`;
    return null;
  }, [id, storageKey]);

  const [open, setOpen] = useState(() => resolveInitialOpen(effectiveStorageKey, defaultOpen));

  useEffect(() => {
    if (!effectiveStorageKey || typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(effectiveStorageKey, open ? "1" : "0");
    } catch (err) {
      console.warn("Không thể lưu trạng thái thu gọn", err);
    }
  }, [effectiveStorageKey, open]);

  const toggleLabel = open ? "Thu gọn" : "Mở rộng";

  return (
    <section className={`rounded border bg-white p-4 shadow-sm ${className}`} data-collapsible-id={id || storageKey || ""}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[200px] flex-1">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-gray-500">{description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            data-tooltip={toggleLabel}
            className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            {toggleLabel}
          </button>
        </div>
      </div>
      {open ? <div className={`mt-4 ${bodyClassName}`}>{children}</div> : null}
    </section>
  );
}
