/* eslint-env node */
/* @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import {
  AI_CHAT_HISTORY_PREFIX,
  MAX_AI_HISTORY_MESSAGES,
  MAX_AI_MESSAGE_LENGTH,
  MAX_AI_PROVIDER_LENGTH,
  MAX_AI_SCOPE_LENGTH,
} from '../server-v4/src/modules/ai/ai.constants.js';
import { createAiChatHistoryStore } from '../server-v4/src/modules/ai/aiChatHistoryStore.js';
import { registerAiRoutes } from '../server-v4/src/modules/ai/aiLegacyRoutes.js';

function createInMemoryStorage() {
  const map = new Map();
  return {
    map,
    getValue: vi.fn((key) => map.get(key) ?? null),
    upsertValue: vi.fn((key, value) => {
      map.set(key, value);
    }),
    deleteValue: vi.fn((key) => {
      map.delete(key);
    }),
  };
}

describe('AI chat history store', () => {
  it('sanitizes and clamps saved history payloads', () => {
    const storage = createInMemoryStorage();
    const store = createAiChatHistoryStore({
      getValue: storage.getValue,
      upsertValue: storage.upsertValue,
      deleteValue: storage.deleteValue,
      aiChatHistoryPrefix: AI_CHAT_HISTORY_PREFIX,
      maxAiHistoryMessages: 2,
      maxAiMessageLength: 5,
      maxAiScopeLength: 4,
      maxAiProviderLength: 4,
    });

    const saved = store.saveAiChatHistory(
      'staff',
      [
        { role: 'user', text: '123456', scope: 'scope-too-long', providerId: 'provider-too-long' },
        { role: 'assistant', text: 'ok', usage: { total_tokens: 12 } },
        { role: 'invalid', text: 'drop-me' },
      ],
      { actor: 'tester' },
    );

    expect(saved.messages).toHaveLength(2);
    expect(saved.messages[0]).toMatchObject({
      role: 'user',
      text: '12345',
      scope: 'scop',
      providerId: 'prov',
    });
    expect(saved.messages[1]).toMatchObject({
      role: 'assistant',
      usage: { totalTokens: 12 },
    });

    const loaded = store.loadAiChatHistory('staff');
    expect(loaded.messages).toEqual(saved.messages);
    expect(storage.upsertValue).toHaveBeenCalledTimes(1);
    expect(storage.getValue).toHaveBeenCalledTimes(1);
  });

  it('deletes persisted history by account key', () => {
    const storage = createInMemoryStorage();
    const key = `${AI_CHAT_HISTORY_PREFIX}staff`;
    storage.map.set(key, '{"messages":[{"role":"user","text":"hello"}]}');

    const store = createAiChatHistoryStore({
      getValue: storage.getValue,
      upsertValue: storage.upsertValue,
      deleteValue: storage.deleteValue,
      aiChatHistoryPrefix: AI_CHAT_HISTORY_PREFIX,
      maxAiHistoryMessages: MAX_AI_HISTORY_MESSAGES,
      maxAiMessageLength: MAX_AI_MESSAGE_LENGTH,
      maxAiScopeLength: MAX_AI_SCOPE_LENGTH,
      maxAiProviderLength: MAX_AI_PROVIDER_LENGTH,
    });

    store.deleteAiChatHistory('staff', { actor: 'tester' });
    expect(storage.map.has(key)).toBe(false);
    expect(storage.deleteValue).toHaveBeenCalledWith(key, { actor: 'tester', source: 'ai-history-delete' });
  });
});

describe('AI route module', () => {
  function buildApp() {
    const app = express();
    app.use(express.json());

    registerAiRoutes(app, {
      requireAiAssistUsage: () => ({ denied: false, context: { account: { username: 'staff' } } }),
      requireAiAssistManage: () => ({ denied: false, context: { account: { username: 'admin' } } }),
      resolveActor: () => 'actor',
      buildAiKpiSnapshot: vi.fn(async () => ({ snapshot: { ok: true }, cached: false, cacheKey: 'snapshot-key' })),
      toPositiveInt: (value, fallback) => {
        const parsed = Number.parseInt(String(value ?? ''), 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
      },
      listAiSnapshotHistory: vi.fn(() => []),
      getAiSnapshotHistoryEntry: vi.fn(() => null),
      AI_INSIGHT_MAX_ENTRIES: 30,
      getAiInsightsStore: vi.fn(() => ({ entries: [], state: {}, schedule: {}, settings: {} })),
      sanitizeAiInsightForClient: vi.fn((entry) => entry),
      runAiInsightGeneration: vi.fn(async () => ({ id: 'run-1' })),
      submitAiInsightFeedback: vi.fn(() => ({ totals: {}, feedback: {} })),
      normalizeAiInsightsSettings: vi.fn(() => ({ notifyOnAnomaly: false })),
      setAiInsightsStore: vi.fn(),
      DEFAULT_AI_INSIGHTS: { version: 1 },
      pushAuditLog: vi.fn(),
      loadAiChatHistory: vi.fn(() => ({ messages: [{ role: 'assistant', text: 'hello' }], updatedAt: '2026-03-31' })),
      saveAiChatHistory: vi.fn(() => ({ messages: [{ role: 'user', text: 'saved' }], updatedAt: '2026-03-31' })),
      deleteAiChatHistory: vi.fn(),
      getAiConfig: vi.fn(() => ({
        enabled: true,
        maxInputLength: 1000,
        timeoutMs: 1000,
        temperature: 0.2,
        maxTokens: 128,
        caching: { enabled: false, ttlMinutes: 1, maxEntries: 10 },
        providers: [],
      })),
      buildAiProfile: vi.fn(() => ({ status: 'ready' })),
      buildAiConfigForClient: vi.fn((config) => config),
      DEFAULT_AI_CONFIG: { timeoutMs: 1000, maxTokens: 128, caching: { ttlMinutes: 1 } },
      AI_CACHE_LIMIT: 10,
      pruneAiCache: vi.fn(() => ({ cache: { entries: [] } })),
      cloneJson: (value) => JSON.parse(JSON.stringify(value)),
      DEFAULT_AI_USAGE_CACHE: { entries: [] },
      setAiConfig: vi.fn((payload) => payload),
      normalizeAiProviderEntry: vi.fn((entry) => entry),
      buildErrorDetails: vi.fn((error) => error?.message || 'error'),
      selectAiProvider: vi.fn(() => null),
      dispatchAiChat: vi.fn(async () => ({ message: 'pong', usage: null })),
      buildAbortSignal: vi.fn(() => undefined),
      toFiniteNumber: (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback),
      truncateText: (value) => String(value ?? ''),
      buildSystemPrompt: vi.fn(() => ''),
      computeAiCacheKey: vi.fn(() => 'cache-key'),
      storeAiCacheEntry: vi.fn(),
      normalizeAiUsage: vi.fn(() => null),
      clearAiCache: vi.fn(),
    });

    return app;
  }

  it('serves AI history routes via injected handlers', async () => {
    const app = buildApp();

    const history = await request(app).get('/api/ai/history');
    expect(history.status).toBe(200);
    expect(history.body).toMatchObject({
      ok: true,
      messages: [{ role: 'assistant', text: 'hello' }],
    });

    const saved = await request(app).put('/api/ai/history').send({ messages: [{ role: 'user', text: 'x' }] });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({
      ok: true,
      messages: [{ role: 'user', text: 'saved' }],
    });
  });

  it('validates provider payload for diagnostics route', async () => {
    const app = buildApp();
    const response = await request(app).post('/api/ai/providers/test').send({});
    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
    expect(response.body.error).toContain('Thiếu thông tin nhà cung cấp');
  });
});
