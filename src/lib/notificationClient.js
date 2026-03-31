import { fetchWithAuth } from '../auth/localAuth.js';
import { API_V4_ROUTES } from './apiRoutes.js';



const listeners = new Set();

let eventSource = null;

let reconnectTimer = null;

let lastEventId = null;

const ALERT_ROUTES = API_V4_ROUTES.alerts;



function notify(event) {

  for (const listener of Array.from(listeners)) {

    try {

      listener(event);

    } catch (err) {

      console.error('Notification listener error', err);

    }

  }

}



function scheduleReconnect() {

  if (reconnectTimer) {

    return;

  }

  reconnectTimer = setTimeout(() => {

    reconnectTimer = null;

    ensureConnection();

  }, 5000);

  if (typeof reconnectTimer.unref === 'function') {

    reconnectTimer.unref();

  }

}



function handleEventMessage(event) {

  if (!event || !event.data) {

    return;

  }

  try {

    const parsed = JSON.parse(event.data);

    lastEventId = parsed?.id || event.lastEventId || lastEventId;

    notify(parsed);

  } catch (err) {

    console.warn('Không thể phân tích thông báo real-time', err);

  }

}



function ensureConnection() {

  if (typeof window === 'undefined') {

    return;

  }

  if (!listeners.size) {

    return;

  }

  if (!window.EventSource) {

    if (!reconnectTimer) {

      reconnectTimer = setTimeout(async () => {

        reconnectTimer = null;

        try {

          const latest = await fetchNotificationHistory(1);

          if (latest?.[0]) {

            notify(latest[0]);

          }

        } catch {

          // ignore

        }

        ensureConnection();

      }, 5000);

      if (typeof reconnectTimer.unref === 'function') {

        reconnectTimer.unref();

      }

    }

    return;

  }

  if (eventSource) {

    return;

  }

  const source = new EventSource(ALERT_ROUTES.notificationsStream, { withCredentials: true });

  eventSource = source;

  source.onmessage = handleEventMessage;

  source.addEventListener('open', () => {

    reconnectTimer = null;

  });

  source.addEventListener('error', () => {

    if (eventSource) {

      eventSource.close();

      eventSource = null;

    }

    scheduleReconnect();

  });

}



function teardownConnection() {

  if (listeners.size > 0) {

    return;

  }

  if (eventSource) {

    try {

      eventSource.close();

    } catch {

      // ignore

    }

    eventSource = null;

  }

  if (reconnectTimer) {

    clearTimeout(reconnectTimer);

    reconnectTimer = null;

  }

}



export async function fetchNotificationHistory(limit = 50) {

  const params = new URLSearchParams();

  if (Number.isFinite(limit) && limit > 0) {

    params.set('limit', String(limit));

  }

  const url = `${ALERT_ROUTES.notifications}${params.toString() ? `?${params.toString()}` : ''}`;

  const response = await fetchWithAuth(url, { cache: 'no-store' });

  if (!response.ok) {

    throw new Error(`HTTP ${response.status}`);

  }

  const payload = await response.json();

  if (payload?.ok === false) {

    throw new Error(payload.error || 'Không thể tải thông báo');

  }

  return Array.isArray(payload?.events) ? payload.events : [];

}



export function subscribeNotificationStream(listener) {

  if (typeof listener !== 'function') {

    return () => {};

  }

  listeners.add(listener);

  ensureConnection();

  return () => {

    listeners.delete(listener);

    teardownConnection();

  };

}



export function getLastNotificationId() {

  return lastEventId;

}

