import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
      'GET /api/ai/profile': () =>
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
      'GET /api/ai/config': () =>
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
      'GET /api/ai/history': () => jsonResponse({ ok: true, messages: [] }),
      'GET /api/ai/insights': () => jsonResponse({ ok: true, insights: [], meta: null }),
      'GET /api/ai/data/snapshot': () => jsonResponse({ ok: true, snapshot: null }),
      'POST /api/ai/providers/test': () =>
        jsonResponse({
          ok: true,
          provider: { id: 'ollama-local' },
          message: 'Sẵn sàng',
          usage: { total_tokens: 42 },
        }),
      'POST /api/ai/providers/ping': () =>
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
});
