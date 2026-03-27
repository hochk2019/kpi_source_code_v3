import React from 'react';

import clsx from 'clsx';

export default function DataHealthInfrastructureStatusPanel({ alerts = [], sync = {} }) {
  const infrastructureAlerts = Array.isArray(alerts) ? alerts : [];

  return (
    <>
      {infrastructureAlerts.length > 0 ? (
        <section className="grid gap-2 md:grid-cols-2">
          {infrastructureAlerts.map((alert) => (
            <div
              key={alert.key}
              className={clsx(
                'rounded border p-3 text-xs shadow-sm transition dark:border-slate-700 dark:bg-slate-900',
                alert.containerClass
              )}
            >
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className={clsx('h-2.5 w-2.5 rounded-full', alert.dotClass)} />
                <span>{alert.severityLabel}</span>
              </div>
              <p className="mt-1 leading-relaxed">{alert.message}</p>
            </div>
          ))}
        </section>
      ) : null}

      <section
        className={clsx(
          'flex flex-col gap-2 rounded border p-4 text-sm shadow-sm transition md:flex-row md:items-center md:justify-between',
          sync.containerClass
        )}
      >
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className={clsx('h-2.5 w-2.5 rounded-full', sync.dotClass)} />
            <span>Trạng thái kết nối ECUS</span>
          </div>
          <p className="mt-1 text-xs opacity-90">{sync.overview}</p>
        </div>

        <div className="text-xs text-right opacity-80 md:text-left">
          <div>Lần chạy gần nhất: {sync.lastRunLabel}</div>
          <div>{sync.relative}</div>
          <div>Trạng thái: {sync.statusText}</div>
          {sync.operatorName ? <div>Người trực: {sync.operatorName}</div> : null}
        </div>
      </section>
    </>
  );
}
