import { test as base, expect } from '@playwright/test';
import {
  createDefaultAccountsState,
  createDefaultHandlers,
  jsonResponse,
  normalisePath,
  resolveHandler,
  safeParse,
} from '../helpers/mockApiState.js';

function toHeadersObject(headersList) {
  const result = {};
  if (!headersList || typeof headersList[Symbol.iterator] !== 'function') {
    return result;
  }
  for (const entry of headersList) {
    if (!entry) continue;
    const name = typeof entry.name === 'string' ? entry.name : Array.isArray(entry) ? entry[0] : null;
    const value = typeof entry.value === 'string' ? entry.value : Array.isArray(entry) ? entry[1] : null;
    if (name && value !== null && value !== undefined) {
      result[name.toLowerCase()] = value;
    }
  }
  return result;
}

const test = base.extend({
  apiEvents: async ({}, use) => {
    const events = { preview: [], run: [], reportExports: [] };
    await use(events);
  },
  page: async ({ page, apiEvents }, use) => {
    const state = createDefaultAccountsState();
    const handlerMap = new Map();
    const defaults = createDefaultHandlers(state);
    for (const [key, handler] of Object.entries(defaults)) {
      handlerMap.set(key, handler);
    }

    handlerMap.set('GET /api/bootstrap', () => jsonResponse({ ok: true, data: {} }));
    handlerMap.set('GET /api/import/ecus/status', () =>
      jsonResponse({
        ok: true,
        backend: { ok: true, state: 'online', checkedAt: new Date().toISOString(), detail: 'Mock API ready' },
        database: { ok: true, state: 'ready', checkedAt: new Date().toISOString(), detail: 'SQL Server OK' },
        config: {
          enabled: true,
          schedule: '0 3 * * *',
          rangeDays: 2,
          preferMonthFirst: false,
          connection: { server: 'ECUS-SERVER', database: 'ECUS5VNACCS', user: 'sa', hasPassword: true },
          lastRun: new Date().toISOString(),
          lastStatus: 'success',
        },
      })
    );

    handlerMap.set('POST /api/import/ecus/preview', ({ init }) => {
      const body = safeParse(init?.body, {});
      apiEvents.preview.push(body);
      const from = body?.from || '2025-08-01';
      const to = body?.to || '2025-08-02';
      return jsonResponse({
        ok: true,
        preview: {
          rows: [
            {
              so_tk: 'TK-PREVIEW-001',
              date: '2025-08-01',
              mst: '0101234567',
              cong_ty: 'CÔNG TY PREVIEW',
              nhan_vien: '',
              status: 'new',
              co_line_count: 2,
            },
            {
              so_tk: 'TK-PREVIEW-888',
              date: '2025-08-01',
              mst: '0312345678',
              cong_ty: 'CÔNG TY ĐÃ CÓ',
              nhan_vien: 'Hạnh',
              status: 'existing',
              co_line_count: 0,
            },
          ],
          limited: false,
          fetched: 2,
          range: { from, to },
        },
      });
    });

    handlerMap.set('POST /api/import/ecus/run', ({ init }) => {
      const body = safeParse(init?.body, {});
      apiEvents.run.push(body);
      return jsonResponse({
        ok: true,
        result: { imported: 4, fetched: 4, skipped: 0, alerts: {} },
      });
    });

    handlerMap.set('POST /api/reports/export', ({ init }) => {
      const payload = safeParse(init?.body, {});
      apiEvents.reportExports.push(payload);
      const buffer = Buffer.from('mock-excel');
      return {
        ok: true,
        status: 200,
        body: buffer,
        headers: {
          'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'content-disposition': "attachment; filename=bao-cao-kpi.xlsx",
        },
      };
    });

    handlerMap.set('GET /api/import/co-discrepancy', () =>
      jsonResponse({ ok: true, state: { lastRun: null, total: 0, limited: false, entries: [] } })
    );

    handlerMap.set('GET /api/import/co-discrepancy/config', () =>
      jsonResponse({
        ok: true,
        config: { enabled: false, cron: '', rangeDays: 3, threshold: 10, sampleLimit: 500 },
      })
    );

    handlerMap.set('POST /api/import/co-discrepancy/config', ({ init }) => {
      const body = safeParse(init?.body, {});
      return jsonResponse({ ok: true, config: body?.config || {} });
    });

    await page.route('**/api/**', async (route, request) => {
      const method = request.method();
      const url = request.url();
      const path = normalisePath(url);
      const handler = resolveHandler(handlerMap, method, path);
      if (handler) {
        const headersArray =
          typeof request.headersArray === 'function'
            ? request.headersArray()
            : Object.entries(request.headers());
        const init = {
          method,
          headers: toHeadersObject(headersArray),
          body: request.postData(),
        };
        const result = await handler({ method, url, init, path });
        if (!result) {
          await route.fulfill({ status: 204, body: '' });
          return;
        }

        const headers = { 'content-type': 'application/json', ...(result.headers || {}) };
        const status = result.status ?? (result.ok === false ? 500 : 200);
        if (result.body !== undefined) {
          await route.fulfill({ status, body: result.body, headers });
          return;
        }
        if (typeof result.json === 'function') {
          const payload = await result.json();
          await route.fulfill({ status, body: JSON.stringify(payload), headers });
          return;
        }
        await route.fulfill({ status, body: JSON.stringify(result), headers });
        return;
      }

      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }), headers: { 'content-type': 'application/json' } });
    });

    await use(page);
  },
});

export { test, expect };
