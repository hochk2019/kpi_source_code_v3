import { EventEmitter } from 'node:events';

const MAX_HISTORY = 200;
let counter = 0;
const history = [];
const emitter = new EventEmitter();
const clients = new Set();

function createEventId() {
  counter += 1;
  return `evt_${Date.now().toString(36)}_${counter.toString(36)}`;
}

function normalizeEvent(input = {}) {
  const now = new Date();
  const event = {
    id: input.id || createEventId(),
    type: input.type || 'info',
    title: input.title || '',
    message: input.message || '',
    severity: input.severity || 'info',
    createdAt: input.createdAt ? new Date(input.createdAt).toISOString() : now.toISOString(),
    meta: input.meta && typeof input.meta === 'object' ? input.meta : null,
  };
  if (!event.title && event.message) {
    event.title = event.message.slice(0, 120);
  }
  return event;
}

function pushToHistory(event) {
  history.push(event);
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }
}

function sendToClient(client, event) {
  try {
    client.res.write(`id: ${event.id}\n`);
    client.res.write(`event: ${event.type}\n`);
    client.res.write(`data: ${JSON.stringify(event)}\n\n`);
  } catch (err) {
    client.res.end();
    clients.delete(client);
  }
}

export function pushNotification(event) {
  const normalized = normalizeEvent(event);
  pushToHistory(normalized);
  emitter.emit('event', normalized);
  for (const client of clients) {
    sendToClient(client, normalized);
  }
  return normalized;
}

export function listNotifications({ limit = 50 } = {}) {
  const slice = Math.max(1, Math.min(Number(limit) || 50, MAX_HISTORY));
  return history.slice(-slice).reverse();
}

export function subscribeNotifications(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }
  emitter.on('event', listener);
  return () => {
    emitter.off('event', listener);
  };
}

export function registerSseClient(res) {
  const client = { res };
  clients.add(client);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('retry: 15000\n\n');
  for (const event of history.slice(-20)) {
    sendToClient(client, event);
  }
  const interval = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch {
      clearInterval(interval);
    }
  }, 15000);
  if (typeof interval.unref === 'function') {
    interval.unref();
  }
  res.on('close', () => {
    clearInterval(interval);
    clients.delete(client);
  });
  res.on('error', () => {
    clearInterval(interval);
    clients.delete(client);
  });
  return () => {
    clearInterval(interval);
    clients.delete(client);
    try {
      res.end();
    } catch {
      // ignore
    }
  };
}

export function resetNotifications() {
  history.length = 0;
  emitter.removeAllListeners();
  for (const client of clients) {
    try {
      client.res.end();
    } catch {
      // ignore
    }
  }
  clients.clear();
  counter = 0;
}
