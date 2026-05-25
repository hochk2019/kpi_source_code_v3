import React from "react";

export default function StageTimelineGroups({
  groups = [],
  formatDate,
  getStageKey,
}) {
  const safeGroups = Array.isArray(groups) ? groups : [];
  const renderDate = (value) =>
    typeof formatDate === "function" ? formatDate(value) : value;
  const resolveStageKey = (stage, fallbackKey) =>
    (typeof getStageKey === "function" ? getStageKey(stage) : "") || fallbackKey;

  if (!safeGroups.length) {
    return (
      <p className="text-sm text-slate-500">
        Không có giai đoạn nào khớp bộ lọc hiện tại.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {safeGroups.map((group, groupIndex) => {
        const stageList = Array.isArray(group?.stages) ? group.stages : [];
        const groupKey = group?.mst || `group-${groupIndex}`;
        return (
          <div
            key={groupKey}
            className="rounded border border-slate-200 bg-slate-50 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  {group?.mst || "(MST trống)"}
                </div>
                <div className="max-w-2xl truncate text-xs text-slate-500">
                  {group?.company || "Chưa cập nhật tên công ty"}
                </div>
              </div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {stageList.length} giai đoạn
              </span>
            </div>
            {stageList.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {stageList.map((stage, stageIndex) => {
                  const stageKey = resolveStageKey(
                    stage,
                    `${group?.mst || "stage"}-${stage?.effective_from || ""}-${stage?.effective_to || stageIndex}`
                  );
                  const startLabel = stage?.effective_from
                    ? renderDate(stage.effective_from)
                    : "Không xác định";
                  const endLabel = stage?.effective_to
                    ? renderDate(stage.effective_to)
                    : "Hiện tại";
                  const active = !stage?.effective_to;
                  return (
                    <div
                      key={stageKey}
                      className={`min-w-[14rem] rounded border px-3 py-2 text-xs ${
                        active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">
                          {startLabel} → {endLabel}
                        </span>
                        {active ? (
                          <span className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            Đang áp dụng
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 space-y-1 text-slate-600">
                        <div>
                          <span className="font-medium text-slate-500">Nhập:</span>{" "}
                          {stage?.person_import || "—"}
                        </div>
                        <div>
                          <span className="font-medium text-slate-500">Xuất:</span>{" "}
                          {stage?.person_export || "—"}
                        </div>
                        {stage?.status ? (
                          <div>
                            <span className="font-medium text-slate-500">Trạng thái:</span>{" "}
                            {stage.status}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-xs italic text-slate-500">
                Chưa có dữ liệu giai đoạn.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
