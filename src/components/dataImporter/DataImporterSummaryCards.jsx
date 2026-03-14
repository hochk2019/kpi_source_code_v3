import React from "react";

export default function DataImporterSummaryCards({
  summaryCards = [],
  cardSurfaceClass = "",
}) {
  if (!Array.isArray(summaryCards) || summaryCards.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {summaryCards.map((card) => (
        <div key={card.label} className={`${cardSurfaceClass} p-3`}>
          <div className="text-xs uppercase tracking-wide text-gray-500">{card.label}</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900">
            {card.value?.toLocaleString?.("vi-VN") ?? card.value}
          </div>
        </div>
      ))}
    </div>
  );
}
