import React, { useEffect, useMemo, useRef, useState } from 'react';

import clsx from 'clsx';

import { t } from '@/lib/i18n.js';

import {

  fetchNotificationHistory,

  subscribeNotificationStream,

} from '@/lib/notificationClient.js';

import { subscribeCommand } from '@/lib/commandBus.js';



function formatDate(value) {

  if (!value) return t('notification.unknownTime');

  try {

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {

      return value;

    }

    return date.toLocaleString('vi-VN');

  } catch {

    return value;

  }

}



const toneClassMap = {

  info: 'border-sky-200 bg-sky-50 text-sky-700',

  warning: 'border-amber-200 bg-amber-50 text-amber-700',

  error: 'border-red-200 bg-red-50 text-red-700',

  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',

};



export default function NotificationCenter({ className }) {

  const [events, setEvents] = useState([]);

  const [unreadIds, setUnreadIds] = useState(() => new Set());

  const [open, setOpen] = useState(false);

  const [loading, setLoading] = useState(false);

  const panelRef = useRef(null);



  useEffect(() => {
    let cancelled = false;
    let unsubscribe = null;

    setLoading(true);

    fetchNotificationHistory(20)
      .then((initial) => {
        if (cancelled) return;
        setEvents(initial);
      })
      .catch((err) => {
        // CRIT-002: Remove console.warn to avoid noise in production
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Không thể tải thông báo gần nhất', err);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    // CRIT-002: Safe subscription setup
    const setupSubscription = async () => {
      try {
        unsubscribe = await subscribeNotificationStream((event) => {
          if (!event || cancelled) return;

          setEvents((prev) => {
            const next = [event, ...prev];
            const unique = new Map();
            for (const entry of next) {
              if (entry && entry.id && !unique.has(entry.id)) {
                unique.set(entry.id, entry);
              }
            }
            return Array.from(unique.values()).slice(0, 50);
          });

          setUnreadIds((prev) => {
            const next = new Set(prev);
            if (event.id) {
              next.add(event.id);
            }
            return next;
          });
        });
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Failed to subscribe to notification stream', err);
        }
      }
    };

    setupSubscription();

    return () => {
      cancelled = true;
      // CRIT-002: Safe unsubscribe - check if it's a function
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);



  useEffect(() => {

    const handleClickOutside = (event) => {

      if (!panelRef.current) return;

      if (panelRef.current.contains(event.target)) {

        return;

      }

      setOpen(false);

    };

    if (open) {

      document.addEventListener('mousedown', handleClickOutside);

      return () => document.removeEventListener('mousedown', handleClickOutside);

    }

    return undefined;

  }, [open]);

  // UI-003: Auto-dismiss notifications after 5 seconds
  useEffect(() => {
    if (events.length === 0) return undefined;

    const timers = events
      .filter((e) => e.tone !== 'error')
      .map((event) =>
        setTimeout(() => {
          setEvents((prev) => prev.filter((e) => e.id !== event.id));
        }, 5000)
      );

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [events]);


  useEffect(() => {

    const unsubscribe = subscribeCommand((id) => {

      if (id === 'open:notifications') {

        setOpen(true);

      }

    });

    return () => unsubscribe();

  }, []);



  const unreadCount = useMemo(() => unreadIds.size, [unreadIds]);



  const handleMarkAllRead = () => {

    setUnreadIds(new Set());

  };



  const groupedEvents = useMemo(() => {

    const groups = [];

    let currentDate = null;

    let currentItems = [];

    for (const event of events) {

      const dateStr = event?.createdAt ? event.createdAt.slice(0, 10) : 'khac';

      if (dateStr !== currentDate) {

        if (currentItems.length) {

          groups.push({ date: currentDate, items: currentItems });

        }

        currentDate = dateStr;

        currentItems = [];

      }

      currentItems.push(event);

    }

    if (currentItems.length) {

      groups.push({ date: currentDate, items: currentItems });

    }

    return groups;

  }, [events]);



  return (

    <div className={clsx('relative', className)} ref={panelRef}>

      <button

        type="button"

        onClick={() => setOpen((value) => !value)}

        className={clsx(

          'relative flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-slate-800'

        )}

        aria-label={t('notification.title')}

      >

        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">

          <path

            d="M12 3c-3.314 0-6 2.686-6 6v3.086l-.707.707A1 1 0 0 0 6 14h12a1 1 0 0 0 .707-1.707L18 12.086V9c0-3.314-2.686-6-6-6z"

            strokeLinecap="round"

            strokeLinejoin="round"

          />

          <path d="M9 18a3 3 0 0 0 6 0" strokeLinecap="round" strokeLinejoin="round" />

        </svg>

        {unreadCount > 0 && (

          <span className="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">

            {unreadCount > 99 ? '99+' : unreadCount}

          </span>

        )}

      </button>

      {open && (

        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] rounded border border-gray-200 bg-white text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900">

          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-slate-700 dark:text-gray-300">

            <div className="flex min-w-0 items-center gap-2">

              <span>{t('notification.title')}</span>

              <span className="font-normal text-gray-400">{loading ? t('notification.loading') : t('notification.itemCount', { count: events.length })}</span>

            </div>

            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={unreadCount <= 0}
              className={clsx(
                'shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold normal-case tracking-normal transition',
                unreadCount > 0
                  ? 'border-sky-200 text-sky-700 hover:bg-sky-50 dark:border-sky-500/40 dark:text-sky-200 dark:hover:bg-sky-500/10'
                  : 'cursor-not-allowed border-gray-200 text-gray-300 dark:border-slate-700 dark:text-gray-600'
              )}
            >
              {t('notification.markAllRead')}
            </button>

          </div>

          <div className="max-h-96 overflow-y-auto p-3 space-y-3">

            {events.length === 0 && !loading ? (

              <p className="text-xs text-gray-500">{t('notification.empty')}</p>

            ) : null}

            {groupedEvents.map((group) => (

              <div key={group.date} className="space-y-2">

                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">

                  {group.date === 'khac' ? t('notification.unknownDate') : new Date(group.date).toLocaleDateString('vi-VN')}

                </div>

                <div className="space-y-2">

                  {group.items.map((event) => {

                    const tone = toneClassMap[event?.severity] || toneClassMap.info;
                    const isUnread = Boolean(event?.id && unreadIds.has(event.id));

                    return (

                      <div
                        key={event.id || `${event.createdAt}_${event.type}`}
                        className={clsx(
                          'rounded border px-3 py-2 text-xs leading-relaxed shadow-sm transition',
                          tone,
                          isUnread && 'ring-1 ring-sky-200 dark:ring-sky-500/50'
                        )}
                      >

                        <div className="flex items-start justify-between gap-2 text-[11px] uppercase tracking-wide">

                          <span className="flex items-center gap-1.5">
                            {event?.type || t('notification.unknownType')}
                            {isUnread ? (
                              <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-sky-700 dark:bg-slate-900/70 dark:text-sky-200">
                                {t('notification.new')}
                              </span>
                            ) : null}
                          </span>

                          <span>{formatDate(event?.createdAt)}</span>

                        </div>

                        {event?.title && <div className="mt-1 text-sm font-semibold">{event.title}</div>}

                        {event?.message && <div className="mt-1 whitespace-pre-wrap text-sm">{event.message}</div>}

                        {event?.meta && (

                          <pre className="mt-2 overflow-x-auto rounded bg-black/5 p-2 text-[11px] leading-tight text-gray-600">

                            {JSON.stringify(event.meta, null, 2)}

                          </pre>

                        )}

                      </div>

                    );

                  })}

                </div>

              </div>

            ))}

          </div>

        </div>

      )}

    </div>

  );

}

