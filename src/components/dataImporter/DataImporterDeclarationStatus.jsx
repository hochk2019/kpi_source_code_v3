import React from "react";

import { StatusBadge } from "@/components/designSystem/primitives.jsx";
import { resolveDeclarationStatus } from "@/components/dataImporter/dataImporterDeclarationStatus.js";

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function DeclarationStatusDisplay({
  row,
  withDetail = false,
  size = "md",
  className,
}) {
  const status = resolveDeclarationStatus(row);
  if (!status) {
    return null;
  }

  const sizeClass =
    size === "sm"
      ? "px-2 py-0.5 text-[11px]"
      : size === "xs"
        ? "px-1.5 py-0.5 text-[10px]"
        : "";

  return (
    <div className={joinClasses("inline-flex flex-col items-start gap-1", className)}>
      <StatusBadge tone={status.tone} className={sizeClass}>
        {status.label}
      </StatusBadge>
      {withDetail && status.detail ? (
        <span className="text-[11px] text-gray-500 dark:text-gray-400">{status.detail}</span>
      ) : null}
    </div>
  );
}
