import React, { useMemo } from 'react';

import clsx from 'clsx';

const READINESS_BADGE_TONES = {
  ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  degraded: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200',
  idle: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
};

const CHECK_TONES = {
  pass: {
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
    container: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10',
  },
  warn: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
    container: 'border-amber-200 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/10',
  },
  fail: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200',
    container: 'border-red-200 bg-red-50/70 dark:border-red-500/30 dark:bg-red-500/10',
  },
};

const STAGE_BADGE_TONES = {
  ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  hold: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200',
};

function formatTimestamp(value) {
  if (!value) return 'Không xác định';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN');
}

function buildSummaryCards({ readiness, currentStage, nextStage, writePath, persistenceSource }) {
  return [
    {
      key: 'current-stage',
      label: 'Giai đoạn hiện tại',
      value: currentStage?.label || 'Chưa xác định',
      detail: currentStage?.gate || 'Chưa có gate chi tiết.',
    },
    {
      key: 'next-stage',
      label: 'Bước kế tiếp',
      value: nextStage?.label || 'Đã đạt cutover-ready',
      detail: nextStage?.gate || 'Không còn bước rollout kế tiếp cần mở.',
    },
    {
      key: 'write-path',
      label: 'Đường ghi declarations',
      value: writePath || 'Không xác định',
      detail: 'Giữ hiển thị công khai để operator biết write path đang được khuyến nghị.',
    },
    {
      key: 'persistence',
      label: 'Persistence source',
      value: persistenceSource || 'Không xác định',
      detail: readiness?.detail || 'Không có metadata readiness.',
    },
  ];
}

export default function DataHealthRolloutStatusPanel({ rollout = null, loading = false, error = '' }) {
  const readiness = rollout?.health?.readiness || null;
  const stages = Array.isArray(rollout?.rollout?.stages) ? rollout.rollout.stages : [];
  const fallbackSteps = Array.isArray(rollout?.rollout?.fallback) ? rollout.rollout.fallback : [];
  const currentStage = stages.find((entry) => entry.id === rollout?.rollout?.currentStage) || null;
  const nextStage = stages.find((entry) => entry.id === rollout?.rollout?.recommendedNextStage) || null;
  const readinessBadgeTone =
    READINESS_BADGE_TONES[readiness?.state] || READINESS_BADGE_TONES.idle;

  const highlightedChecks = useMemo(() => {
    const checks = Array.isArray(rollout?.migrationVerification?.checks)
      ? rollout.migrationVerification.checks
      : [];
    if (checks.length === 0) return [];
    const nonPassChecks = checks.filter((entry) => entry.status !== 'pass');
    return (nonPassChecks.length > 0 ? nonPassChecks : checks).slice(0, 4);
  }, [rollout]);

  const summaryCards = buildSummaryCards({
    readiness,
    currentStage,
    nextStage,
    writePath: rollout?.rollout?.declarationCutover?.writePath,
    persistenceSource: rollout?.persistence?.source,
  });

  return (
    <section className="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">
            Tiến độ rollout server-v4
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Công bố trạng thái migration gate để operator không phải gọi thủ công
            <code className="ml-1 rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-slate-800">
              /api/v4/meta/rollout
            </code>
            .
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <span
            className={clsx(
              'rounded-full px-2.5 py-1 text-xs font-semibold',
              readinessBadgeTone
            )}
          >
            {loading ? 'Đang đồng bộ rollout…' : readiness?.label || 'Chưa có metadata'}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Cập nhật lúc: {formatTimestamp(rollout?.generatedAt)}
          </span>
        </div>
      </div>

      {error && !rollout ? (
        <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-200">
          Không thể tải metadata rollout: {error}
        </div>
      ) : null}

      {rollout ? (
        <>
          {error ? (
            <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200">
              Metadata rollout đang hiển thị từ lần tải thành công gần nhất. Lần làm mới mới nhất thất bại: {error}
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            {summaryCards.map((card) => (
              <div
                key={card.key}
                className="rounded border border-gray-200 bg-gray-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60"
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {card.label}
                </div>
                <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-50">
                  {card.value}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  {card.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
            <div className="rounded border border-gray-200 p-4 dark:border-slate-700">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                  Gate theo giai đoạn
                </h4>
                {rollout?.rollout?.declarationCutover?.operatorAction ? (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Operator action: {rollout.rollout.declarationCutover.operatorAction}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 space-y-3">
                {stages.map((stage) => {
                  const badgeTone = STAGE_BADGE_TONES[stage.status] || STAGE_BADGE_TONES.hold;
                  const isCurrent = stage.id === rollout?.rollout?.currentStage;
                  return (
                    <div
                      key={stage.id}
                      className={clsx(
                        'rounded border p-3 text-sm',
                        isCurrent
                          ? 'border-sky-300 bg-sky-50/80 dark:border-sky-500/40 dark:bg-sky-500/10'
                          : 'border-gray-200 bg-gray-50/80 dark:border-slate-700 dark:bg-slate-800/40'
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-gray-50">
                          {stage.label}
                        </span>
                        <span
                          className={clsx(
                            'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            badgeTone
                          )}
                        >
                          {stage.status}
                        </span>
                        {isCurrent ? (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-500/20 dark:text-sky-200">
                            Đang active
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                        {stage.gate}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded border border-gray-200 p-4 dark:border-slate-700">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                  Verification nổi bật
                </h4>
                <div className="mt-3 space-y-3">
                  {highlightedChecks.length > 0 ? (
                    highlightedChecks.map((check) => {
                      const tones = CHECK_TONES[check.status] || CHECK_TONES.warn;
                      return (
                        <div
                          key={check.id}
                          className={clsx('rounded border p-3 text-sm', tones.container)}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-gray-900 dark:text-gray-50">
                              {check.summary}
                            </span>
                            <span
                              className={clsx(
                                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                tones.badge
                              )}
                            >
                              {check.status}
                            </span>
                          </div>
                          <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                            {check.detail}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded border border-dashed border-gray-300 p-3 text-sm text-gray-500 dark:border-slate-600 dark:text-gray-400">
                      Chưa có rollout check nào để hiển thị.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded border border-gray-200 p-4 dark:border-slate-700">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                  Fallback cho operator
                </h4>
                <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  {fallbackSteps.length > 0 ? (
                    fallbackSteps.slice(0, 3).map((step) => (
                      <li key={step} className="rounded bg-gray-50 px-3 py-2 dark:bg-slate-800/50">
                        {step}
                      </li>
                    ))
                  ) : (
                    <li className="rounded bg-gray-50 px-3 py-2 dark:bg-slate-800/50">
                      Chưa có hướng dẫn fallback.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </>
      ) : loading ? null : (
        <div className="mt-4 rounded border border-dashed border-gray-300 p-3 text-sm text-gray-500 dark:border-slate-600 dark:text-gray-400">
          Chưa có metadata rollout để hiển thị.
        </div>
      )}
    </section>
  );
}
