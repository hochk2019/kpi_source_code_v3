import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAiConversation } from '@/components/ai-assistant/hooks/useAiConversation.js';
import {
  fetchAiHistory,
  requestAiCompletion,
  saveAiHistory,
} from '@/lib/aiClient.js';
import {
  getLocalHistoryKey,
  limitHistory,
  prepareMessagesForStorage,
  readLocalHistory,
  sanitizeHistoryMessage,
} from '@/components/ai-assistant/historyStore.js';

vi.mock('@/shared/toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/lib/aiClient.js', () => ({
  clearAiHistory: vi.fn(),
  fetchAiHistory: vi.fn(),
  requestAiCompletion: vi.fn(),
  saveAiHistory: vi.fn(),
}));

vi.mock('@/components/ai-assistant/historyStore.js', () => {
  let seq = 0;
  return {
    createMessageId: vi.fn(() => `msg-${++seq}`),
    getLocalHistoryKey: vi.fn((username) => `history:${username || 'guest'}`),
    limitHistory: vi.fn((messages) => messages),
    prepareMessagesForStorage: vi.fn((messages) => messages),
    readLocalHistory: vi.fn(() => []),
    removeLocalHistory: vi.fn(),
    sanitizeHistoryMessage: vi.fn((message) => message),
    writeLocalHistory: vi.fn(),
  };
});

const assistantModes = [
  {
    id: 'general',
    label: 'Tổng quát',
    scope: 'general',
    prefillContext: 'Ngữ cảnh mặc định',
    systemPrompt: 'System',
  },
  {
    id: 'analytics',
    label: 'Phân tích',
    scope: 'analytics',
    prefillContext: 'Ngữ cảnh phân tích',
    systemPrompt: 'Analytics',
  },
];

describe('useAiConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLocalHistoryKey.mockImplementation((username) => `history:${username || 'guest'}`);
    limitHistory.mockImplementation((messages) => messages);
    prepareMessagesForStorage.mockImplementation((messages) => messages);
    readLocalHistory.mockImplementation(() => []);
    sanitizeHistoryMessage.mockImplementation((message) => message);
    fetchAiHistory.mockResolvedValue([]);
    requestAiCompletion.mockResolvedValue({
      message: 'Đã có phản hồi',
      providerId: 'ollama-local',
      cached: false,
      usage: { total_tokens: 8 },
      scope: 'analytics',
    });
    saveAiHistory.mockResolvedValue(undefined);
  });

  it('loads history for authenticated users and applies default provider', async () => {
    fetchAiHistory.mockResolvedValue([
      {
        id: 'server-1',
        role: 'assistant',
        text: 'Lịch sử từ server',
        scope: 'general',
        createdAt: '2025-08-03T07:00:00.000Z',
      },
    ]);

    const { result } = renderHook(() =>
      useAiConversation({
        assistantModes,
        canUse: true,
        profileDefaultProvider: 'ollama-local',
        username: 'admin',
      })
    );

    await waitFor(() => expect(result.current.historyReady).toBe(true));

    expect(fetchAiHistory).toHaveBeenCalledTimes(1);
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe('Lịch sử từ server');
    expect(result.current.selectedProviderId).toBe('ollama-local');
  });

  it('changes mode, applies suggestions, and sends a prompt', async () => {
    const { result } = renderHook(() =>
      useAiConversation({
        assistantModes,
        canUse: true,
        profileDefaultProvider: 'ollama-local',
        username: 'admin',
      })
    );

    await waitFor(() => expect(result.current.historyReady).toBe(true));

    act(() => {
      result.current.handleModeChange('analytics');
    });

    expect(result.current.scope).toBe('analytics');
    expect(result.current.context).toBe('Ngữ cảnh phân tích');

    act(() => {
      result.current.handleSuggestionClick({
        prompt: 'So sánh KPI',
        context: 'Dùng dữ liệu tháng này',
        scope: 'analytics',
      });
    });

    expect(result.current.prompt).toBe('So sánh KPI');
    expect(result.current.context).toBe('Dùng dữ liệu tháng này');

    act(() => {
      result.current.setPrompt('Tạo báo cáo KPI');
    });

    await act(async () => {
      await result.current.handleSendPrompt({ preventDefault() {} });
    });

    expect(requestAiCompletion).toHaveBeenCalledWith({
      context: 'Dùng dữ liệu tháng này',
      prompt: 'Tạo báo cáo KPI',
      providerId: 'ollama-local',
      scope: 'analytics',
      systemPrompt: 'Analytics',
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[1].role).toBe('assistant');
    expect(result.current.messages[1].text).toBe('Đã có phản hồi');
    await waitFor(() => expect(saveAiHistory).toHaveBeenCalled());
  });
});
