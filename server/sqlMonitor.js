import { EventEmitter } from 'node:events';

const emitter = new EventEmitter();
const state = {
  sqlTimeouts: [],
};

export function recordSqlTimeout(event = {}) {
  const payload = {
    at: new Date().toISOString(),
    message: event.message || 'SQL timeout detected',
    context: event.context || null,
  };
  state.sqlTimeouts.push(payload);
  emitter.emit('sql-timeout', payload);
  return payload;
}

export function getSqlTimeoutEvents() {
  return state.sqlTimeouts.slice();
}

export function resetSqlMonitor() {
  state.sqlTimeouts.length = 0;
}

export function onSqlTimeout(listener) {
  emitter.on('sql-timeout', listener);
  return () => emitter.off('sql-timeout', listener);
}
