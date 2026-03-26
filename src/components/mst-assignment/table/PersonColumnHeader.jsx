import React from "react";

import { LogIn, LogOut } from "lucide-react";

const PERSON_HEADER_CONFIG = {
  person_import: {
    icon: LogIn,
    labelLines: ["Phụ trách", "Nhập"],
    tooltip: "Người phụ trách Nhập",
  },
  person_export: {
    icon: LogOut,
    labelLines: ["Phụ trách", "Xuất"],
    tooltip: "Người phụ trách Xuất",
  },
};

export default function PersonColumnHeader({ columnKey }) {
  const config = PERSON_HEADER_CONFIG[columnKey];
  if (!config) {
    return null;
  }

  const { icon: Icon, labelLines, tooltip } = config;

  return (
    <div
      className="flex items-start gap-1.5"
      title={tooltip}
      data-tooltip={tooltip}
      data-column={columnKey}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-gray-500" aria-hidden="true" />
      <span className="flex flex-col text-left font-medium leading-tight text-gray-700">
        {labelLines.map((line) => (
          <span key={line}>{line}</span>
        ))}
        <span className="sr-only">{tooltip}</span>
      </span>
    </div>
  );
}
