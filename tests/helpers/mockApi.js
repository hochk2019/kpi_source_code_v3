import { vi } from 'vitest';

function jsonResponse(payload) {
  return { ok: true, json: async () => payload };
}

const DEFAULT_HANDLERS = {
  'GET /api/import/ecus/config': () =>
    jsonResponse({
      ok: true,
      config: {
        enabled: false,
        schedule: '0 * * * *',
        rangeDays: 1,
        connection: { server: '', database: '', user: '', hasPassword: false },
      },
    }),
  'GET /api/import/alerts': () =>
    jsonResponse({
      ok: true,
      alerts: [],
      summary: { outstanding: 0, totalTracked: 0, lastEvaluatedAt: null },
    }),
  'POST /api/import/alerts': () => jsonResponse({ ok: true, updated: [] }),
  'POST /api/import/ecus/run': () => jsonResponse({ ok: true, result: { imported: 0, fetched: 0, alerts: {} } }),
  'GET /api/audit': () => jsonResponse({ ok: true, logs: [] }),
};

function normalisePath(rawUrl) {
  try {
    const url = new URL(rawUrl, 'http://localhost');
    return url.pathname;
  } catch {
    return rawUrl.split('?')[0] || rawUrl;
  }
}

function resolveHandler(map, method, path) {
  const key = `${method} ${path}`;
  if (map.has(key)) {
    return map.get(key);
  }
  if (map.has(path)) {
    return map.get(path);
  }
  return map.get(`${method} ${path.replace(/\/$/, '')}`) ?? map.get(path.replace(/\/$/, ''));
}

export function installMockApi(overrides = {}) {
  const handlerMap = new Map();
  for (const [key, handler] of Object.entries(DEFAULT_HANDLERS)) {
    handlerMap.set(key, handler);
  }
  for (const [key, handler] of Object.entries(overrides)) {
    handlerMap.set(key, handler);
  }

  const fetchMock = vi.fn(async (input, init = {}) => {
    const method = (init.method || 'GET').toUpperCase();
    const url = typeof input === 'string' ? input : input?.url ?? '';
    const path = normalisePath(url);
    const handler = resolveHandler(handlerMap, method, path) ?? (() => jsonResponse({ ok: true }));
    return handler({ method, url, init, path });
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
