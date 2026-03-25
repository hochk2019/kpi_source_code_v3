import React from "react";

export default function StageTimelinePreview({
  stages = [],
  onViewFull,
  formatDate,
  getStageKey,
}) {
  const safeStages = Array.isArray(stages) ? stages : [];
  const limitedStages = safeStages.slice(0, 3);
  const canViewFull = typeof onViewFull === "function" && safeStages.length > 0;
  const renderDate = (value) =>
    typeof formatDate === "function" ? formatDate(value) : value;
  const resolveStageKey = (stage, fallbackKey) =>
    (typeof getStageKey === "function" ? getStageKey(stage) : "") || fallbackKey;

  return (
    <details className="mt-2 text-xs text-slate-600">
      <summary className="flex cursor-pointer items-center gap-2 text-blue-600 hover:text-blue-800">
        <span>Lịch sử giai đoạn</span>
        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
          {safeStages.length}
        </span>
      </summary>
      {safeStages.length ? (
        <>
          <ul className="mt-1 space-y-1">
            {limitedStages.map((stage, index) => {
              const stageKey = resolveStageKey(
                stage,
                `${stage?.mst || "stage"}-${stage?.effective_from || ""}-${stage?.effective_to || index}`
              );
              const startLabel = stage?.effective_from
                ? renderDate(stage.effective_from)
                : "Không xác định";
              const endLabel = stage?.effective_to
                ? renderDate(stage.effective_to)
                : "Hiện tại";
              const active = !stage?.effective_to;
              return (
                <li
                  key={stageKey}
                  className="rounded border border-slate-200 bg-white px-2 py-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700">
                      {startLabel} → {endLabel}
                    </span>
                    {active ? (
                      <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Hiện hành
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-slate-500">
                    <span>Nhập: {stage?.person_import || "—"}</span>
                    <span>Xuất: {stage?.person_export || "—"}</span>
                    {stage?.status ? <span>Trạng thái: {stage.status}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {safeStages.length > limitedStages.length ? (
            <p className="mt-1 text-[11px] text-slate-500">
              … và {safeStages.length - limitedStages.length} giai đoạn khác
            </p>
          ) : null}
          {canViewFull ? (
            <button
              type="button"
              className="mt-2 inline-flex items-center text-[11px] font-semibold text-blue-600 hover:text-blue-800"
              onClick={onViewFull}
            >
              Xem toàn màn hình
            </button>
          ) : null}
        </>
      ) : (
        <p className="mt-1 italic text-slate-400">Chưa có dữ liệu giai đoạn.</p>
      )}
    </details>
  );
}
