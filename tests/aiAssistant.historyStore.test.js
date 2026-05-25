import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getLocalHistoryKey,
  limitHistory,
  prepareMessagesForStorage,
  readLocalHistory,
  removeLocalHistory,
  writeLocalHistory,
} from '@/components/ai-assistant/historyStore.js';

describe('aiAssistant history store helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('sanitizes and limits stored messages', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-25T10:00:00.000Z'));

    const messages = Array.from({ length: 55 }, (_, index) => ({
      id: `msg-${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      text: `message-${index}`,
      scope: 'general',
      providerId: 'ollama-local',
      usage: { total_tokens: index },
      createdAt: '2026-03-25T10:00:00.000Z',
    }));
    messages.push({ role: 'invalid', text: 'skip me' });

    const prepared = prepareMessagesForStorage(messages);

    expect(prepared).toHaveLength(50);
    expect(prepared[0].id).toBe('msg-5');
    expect(prepared.at(-1)).toMatchObject({
      id: 'msg-54',
      providerId: 'ollama-local',
      usage: { totalTokens: 54 },
    });

    vi.useRealTimers();
  });

  it('writes, reads, and removes local history by storage key', () => {
    const storageKey = getLocalHistoryKey('admin');
    const messages = [{ id: 'msg-1', role: 'user', text: 'Xin chào', createdAt: '2026-03-25T10:00:00.000Z' }];

    writeLocalHistory(storageKey, messages);
    expect(readLocalHistory(storageKey)).toEqual([
      {
        id: 'msg-1',
        role: 'user',
        text: 'Xin chào',
        scope: '',
        providerId: null,
        cached: false,
        usage: null,
        createdAt: '2026-03-25T10:00:00.000Z',
      },
    ]);

    removeLocalHistory(storageKey);
    expect(readLocalHistory(storageKey)).toEqual([]);
  });

  it('builds guest and user-specific history keys', () => {
    expect(getLocalHistoryKey('alice')).toBe('ai_chat_history_user_alice');
    expect(getLocalHistoryKey('')).toBe('ai_chat_history_guest_v1');
    expect(limitHistory([{ id: 'one' }])).toEqual([{ id: 'one' }]);
  });
});
