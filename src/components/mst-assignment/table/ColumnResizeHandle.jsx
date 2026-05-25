import React from "react";

export default function ColumnResizeHandle({
  columnKey,
  label,
  onResizeStart,
}) {
  const resolvedLabel = label || columnKey;

  const handleMouseDown = (event) => {
    if (typeof onResizeStart === "function") {
      onResizeStart(columnKey, event);
    }
  };

  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Điều chỉnh chiều rộng cột ${resolvedLabel}`}
      title={`Kéo để điều chỉnh chiều rộng cột ${resolvedLabel}`}
      data-resize-handle={columnKey}
      className="absolute inset-y-0 right-0 flex w-3 cursor-col-resize select-none items-center justify-center"
      onMouseDown={handleMouseDown}
    >
      <span className="pointer-events-none h-full w-px bg-amber-500/50 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
    </span>
  );
}
