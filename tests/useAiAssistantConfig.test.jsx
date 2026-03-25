import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAiAssistantConfig } from '@/components/ai-assistant/hooks/useAiAssistantConfig.js';
import {
  clearAiCache,
  fetchAiConfig,
  fetchAiProfile,
  pingAiConnection,
  updateAiConfig,
} from '@/lib/aiClient.js';

vi.mock('@/shared/toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/lib/aiClient.js', () => ({
  clearAiCache: vi.fn(),
  fetchAiConfig: vi.fn(),
  fetchAiProfile: vi.fn(),
  pingAiConnection: vi.fn(),
  testAiProvider: vi.fn(),
  updateAiConfig: vi.fn(),
}));

const providerPresets = [
  {
    key: 'custom',
    label: 'Tùy chỉnh',
    idBase: 'custom-provider',
    type: 'custom',
    endpoint: '',
    model: '',
  },
];

const provider = {
  id: 'ollama-local',
  type: 'ollama',
  label: 'Ollama cục bộ',
  enabled: true,
  endpoint: 'http://localhost:11434',
  model: 'llama3.1:8b',
  temperature: 0.4,
  maxTokens: 2048,
  apiKeyEnv: 'OLLAMA_HOST',
};

const profilePayload = {
  enabled: true,
  defaultProvider: 'ollama-local',
  fallbackProvider: '',
  updatedAt: '2025-08-03T07:00:00.000Z',
  providers: [provider],
  caching: { enabled: true, ttlMinutes: 10, maxEntries: 50 },
};

const configPayload = {
  enabled: true,
  defaultProvider: 'ollama-local',
  fallbackProvider: '',
  temperature: 0.4,
  maxTokens: 2048,
  maxInputLength: 6000,
  timeoutMs: 30000,
  systemPrompt: 'Bạn là trợ lý nội bộ.',
  providers: [provider],
  caching: { enabled: true, ttlMinutes: 10, maxEntries: 50 },
};

describe('useAiAssistantConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAiProfile.mockResolvedValue(profilePayload);
    fetchAiConfig.mockResolvedValue({
      config: configPayload,
      cacheSummary: [
        {
          key: 'cache-1',
          providerId: 'ollama-local',
          promptPreview: 'Tóm tắt KPI',
          responsePreview: 'KPI tăng',
          createdAt: '2025-08-03T07:00:00.000Z',
        },
      ],
    });
    pingAiConnection.mockResolvedValue({
      provider: { id: 'ollama-local', label: 'Ollama cục bộ' },
      message: 'pong',
      usage: { total_tokens: 7 },
    });
    updateAiConfig.mockResolvedValue(configPayload);
    clearAiCache.mockResolvedValue(undefined);
  });

  it('loads profile/config and derives ping defaults', async () => {
    const { result } = renderHook(() =>
      useAiAssistantConfig({
        canManage: true,
        canUse: true,
        providerPresets,
      })
    );

    await waitFor(() => expect(result.current.profile?.defaultProvider).toBe('ollama-local'));
    await waitFor(() => expect(result.current.config?.defaultProvider).toBe('ollama-local'));

    expect(result.current.providerOptions).toHaveLength(1);
    expect(result.current.pingProviderId).toBe('ollama-local');
    expect(result.current.draftDefaultProvider?.id).toBe('ollama-local');
  });

  it('adds providers, pings connection, submits config, and clears cache', async () => {
    const { result } = renderHook(() =>
      useAiAssistantConfig({
        canManage: true,
        canUse: true,
        providerPresets,
      })
    );

    await waitFor(() => expect(result.current.draft?.providers).toHaveLength(1));

    act(() => {
      result.current.handleAddProvider('custom');
      result.current.setPingPrompt('Ping mới');
      result.current.handleDraftFieldChange('maxTokens', '4096');
    });

    expect(result.current.draft.providers).toHaveLength(2);
    expect(result.current.draft.maxTokens).toBe('4096');

    await act(async () => {
      await result.current.handlePingConnection();
    });

    expect(pingAiConnection).toHaveBeenCalledWith({
      providerId: 'ollama-local',
      prompt: 'Ping mới',
    });
    expect(result.current.pingState.status).toBe('success');

    await act(async () => {
      await result.current.handleConfigSubmit({ preventDefault() {} });
    });

    expect(updateAiConfig).toHaveBeenCalled();

    await act(async () => {
      await result.current.handleClearCache();
    });

    expect(clearAiCache).toHaveBeenCalledTimes(1);
  });
});
