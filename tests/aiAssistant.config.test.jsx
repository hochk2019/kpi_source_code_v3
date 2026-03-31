import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';

import React from 'react';



import AiAssistant from '@/components/AiAssistant.jsx';

import { installMockApi } from './helpers/mockApi.js';

import { jsonResponse } from './helpers/mockApiState.js';



function ensureTestGlobals() {

  if (!globalThis.ResizeObserver) {

    vi.stubGlobal('ResizeObserver', class {

      observe() {}

      unobserve() {}

      disconnect() {}

    });

  }

  if (!window.matchMedia) {

    Object.defineProperty(window, 'matchMedia', {

      writable: true,

      value: (query) => ({

        matches: false,

        media: query,

        onchange: null,

        addListener() {},

        removeListener() {},

        addEventListener() {},

        removeEventListener() {},

        dispatchEvent() {

          return false;

        },

      }),

    });

  }

  if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {

    Element.prototype.scrollIntoView = () => {};

  }

}



describe('AiAssistant – cấu hình Ollama nội bộ', () => {

  const providerConfig = {

    id: 'ollama-local',

    type: 'ollama',

    label: 'Ollama cục bộ (llama3.1:8b)',

    enabled: true,

    endpoint: 'http://localhost:11434',

    model: 'llama3.1:8b',

    temperature: 0.4,

    maxTokens: 2048,

    apiKeyEnv: 'OLLAMA_HOST',

  };



  beforeEach(() => {

    ensureTestGlobals();

    installMockApi({

      'GET /api/v4/ai/profile': () =>

        jsonResponse({

          ok: true,

          profile: {

            enabled: true,

            defaultProvider: 'ollama-local',

            fallbackProvider: '',

            providers: [providerConfig],

            caching: { enabled: true, ttlMinutes: 10, maxEntries: 50 },

          },

        }),

      'GET /api/v4/ai/config': () =>

        jsonResponse({

          ok: true,

          config: {

            enabled: true,

            defaultProvider: 'ollama-local',

            fallbackProvider: '',

            temperature: 0.4,

            maxTokens: 2048,

            maxInputLength: 6000,

            timeoutMs: 30000,

            systemPrompt: 'Bạn là trợ lý nội bộ.',

            caching: { enabled: true, ttlMinutes: 10, maxEntries: 50 },

            providers: [providerConfig],

          },

          cacheSummary: [],

        }),

      'GET /api/v4/ai/history': () => jsonResponse({ ok: true, messages: [] }),

      'GET /api/v4/ai/insights': () =>

        jsonResponse({

          ok: true,

          insights: [],

          meta: {

            state: { lastRunAt: null, lastStatus: 'never', lastError: null, lastProviderId: null },

            schedule: { nextRun: null },

            settings: { notifyOnAnomaly: false },

            history: { entries: [], limit: 6 },

          },

        }),

      'GET /api/v4/ai/data/snapshot': () => jsonResponse({ ok: true, snapshot: null }),

      'GET /api/v4/ai/data/snapshot/history': () => jsonResponse({ ok: true, entries: [] }),

      'PUT /api/v4/ai/insights/settings': ({ init }) => {

        const body = JSON.parse(init?.body ?? '{}');

        return jsonResponse({ ok: true, settings: body.settings || { notifyOnAnomaly: false } });

      },

      'POST /api/v4/ai/providers/test': () =>

        jsonResponse({

          ok: true,

          provider: { id: 'ollama-local' },

          message: 'Sẵn sàng',

          usage: { total_tokens: 42 },

        }),

      'POST /api/v4/ai/providers/ping': () =>

        jsonResponse({ ok: true, provider: { id: 'ollama-local' }, message: 'pong' }),

    });

  });



  afterEach(() => {

    vi.unstubAllGlobals();

  });



  it('hiển thị cảnh báo nội bộ và trạng thái health-check cho Ollama', async () => {

    render(

      <AiAssistant

        currentUser={{

          username: 'admin',

          permissions: { aiAssistUse: true, aiAssistManage: true },

        }}

      />

    );



    await screen.findByText('Cấu hình trợ lý AI');

    const defaultLabel = await screen.findByText('Nhà cung cấp mặc định');

    const defaultSelect = defaultLabel.closest('label')?.querySelector('select');

    expect(defaultSelect).not.toBeNull();

    await waitFor(() => expect(defaultSelect?.value).toBe('ollama-local'));



    expect(

      screen.getByText(

        'Đang sử dụng mô hình Ollama nội bộ — dữ liệu hỏi đáp sẽ được giữ trong mạng doanh nghiệp.'

      )

    ).toBeInTheDocument();



    await waitFor(() =>

      expect(

        screen.getByText('Dữ liệu câu hỏi được xử lý hoàn toàn nội bộ qua Ollama cục bộ.')

      ).toBeInTheDocument()

    );



    const internalBadge = await screen.findByText('Nội bộ (Ollama)');

    const statusContainer = internalBadge.closest('div');

    expect(statusContainer).not.toBeNull();

    await waitFor(() => expect(within(statusContainer).getByText('Trực tuyến')).toBeInTheDocument());

  });



  it('hiển thị insight và gửi phản hồi hữu ích', async () => {

    const feedbackSpy = vi.fn();

    const notifySpy = vi.fn();

    const historyEntry = {

      id: 'hist-1',

      generatedAt: '2025-08-02T08:00:00.000Z',

      range: { from: '2025-08-01', to: '2025-08-02' },

      rulesVersion: 'v1',

      rosterVersion: '2025.07',

      totals: { rowsFetched: 12, declarations: 12 },

      summary: { declarations: 12, import: 7, export: 5, kpi: 180, items: 0, licenses: 0 },

      snapshot: {

        summary: { declarations: 12, import: 7, export: 5, kpi: 180, items: 0, licenses: 0 },

        adjustments: { totals: { approved: 1, pending: 0, rejected: 0, totalPoints: 12 } },

        topStaff: [],

        topTeams: [],

      },

    };

    installMockApi({

      'GET /api/v4/ai/insights': () =>

        jsonResponse({

          ok: true,

          insights: [

            {

              insightId: 'ins-test',

              createdAt: '2025-08-03T07:00:00.000Z',

              providerId: 'ollama-local',

              status: 'success',

              response: 'Insight thử nghiệm.',

              range: { from: '2025-08-01', to: '2025-08-02' },

              meta: { rangeLabel: '2025-08-01 → 2025-08-02' },

              tokens: { totalTokens: 32 },

              feedback: { helpful: 0, notHelpful: 0, viewer: null },

            },

          ],

          meta: {

            state: { lastRunAt: '2025-08-03T07:00:00.000Z', lastStatus: 'success', lastError: null, lastProviderId: 'ollama-local' },

            schedule: { nextRun: null },

            settings: { notifyOnAnomaly: true },

            history: { entries: [historyEntry], limit: 6 },

          },

        }),

      'GET /api/v4/ai/data/snapshot/history': () => jsonResponse({ ok: true, entries: [historyEntry] }),

      'POST /api/v4/ai/insights/feedback': ({ init }) => {

        const body = JSON.parse(init?.body ?? '{}');

        expect(body.insightId).toBe('ins-test');

        expect(body.helpful).toBe(true);

        feedbackSpy();

        return jsonResponse({

          ok: true,

          totals: { helpful: 1, notHelpful: 0 },

          feedback: { helpful: true, comment: null, updatedAt: '2025-08-03T07:10:00.000Z' },

        });

      },

      'PUT /api/v4/ai/insights/settings': ({ init }) => {

        const body = JSON.parse(init?.body ?? '{}');

        notifySpy(body?.settings?.notifyOnAnomaly);

        return jsonResponse({ ok: true, settings: { notifyOnAnomaly: !!body?.settings?.notifyOnAnomaly } });

      },

    });



    render(

      <AiAssistant

        currentUser={{

          username: 'admin',

          permissions: { aiAssistUse: true, aiAssistManage: true },

        }}

      />

    );



    await screen.findByText('Insight thử nghiệm.');

    const helpfulButton = await screen.findByRole('button', { name: 'Hữu ích' });

    fireEvent.click(helpfulButton);



    await waitFor(() => expect(feedbackSpy).toHaveBeenCalled());

    await waitFor(() =>

      expect(screen.getByText('1 hữu ích · 0 chưa hữu ích')).toBeInTheDocument()

    );



    const historyHeadings = await screen.findAllByText('Lịch sử snapshot KPI');

    expect(historyHeadings.length).toBeGreaterThanOrEqual(1);

    const historyRangeLabels = await screen.findAllByText('2025-08-01 → 2025-08-02');

    expect(historyRangeLabels.length).toBeGreaterThanOrEqual(1);



    const toggles = await screen.findAllByLabelText('Nhận thông báo khi insight cảnh báo bất thường');

    expect(toggles.length).toBeGreaterThanOrEqual(1);

    expect(toggles.some((node) => node.checked)).toBe(true);

    const toggle = toggles.find((node) => node.checked) ?? toggles[0];

    fireEvent.click(toggle);

    await waitFor(() => expect(notifySpy).toHaveBeenCalledWith(false));

  });

});

