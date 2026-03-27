import React from 'react';

import clsx from 'clsx';

export default function DataHealthActivityFeedsPanel({ sqlEvents = [], notifications = {} }) {
  const recentSqlEvents = Array.isArray(sqlEvents) ? sqlEvents : [];
  const realtimeNotifications = Array.isArray(notifications.entries) ? notifications.entries : [];

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Sự kiện SQL Server gần đây</h3>

        <div className="mt-3 space-y-2 text-sm">
          {recentSqlEvents.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">Không ghi nhận timeout trong thời gian gần đây.</p>
          ) : (
            recentSqlEvents.map((event) => (
              <div
                key={event.key}
                className="rounded border border-sky-200 bg-sky-50 p-3 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-wide">
                  <span>Timeout</span>
                  <span>{event.atLabel}</span>
                </div>

                <div className="mt-1 text-xs">{event.message}</div>

                {event.contextLabel ? (
                  <pre className="mt-2 overflow-x-auto rounded bg-black/5 p-2 text-[11px] leading-tight text-sky-800 dark:bg-black/40 dark:text-sky-100">
                    {event.contextLabel}
                  </pre>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Thông báo real-time</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">{notifications.countLabel}</span>
        </div>

        <div className="mt-3 space-y-2 text-sm">
          {realtimeNotifications.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">Chưa có thông báo mới.</p>
          ) : (
            realtimeNotifications.map((event) => (
              <div
                key={event.key}
                className={clsx('rounded border px-3 py-2 text-xs shadow-sm', event.containerClass)}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-wide">
                  <span>{event.typeLabel}</span>
                  <span>{event.createdAtLabel}</span>
                </div>

                {event.title ? <div className="mt-1 text-sm font-semibold">{event.title}</div> : null}
                {event.message ? <div className="mt-1 whitespace-pre-wrap text-sm">{event.message}</div> : null}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
