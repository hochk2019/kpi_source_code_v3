import { describe, expect, it } from 'vitest';

import {
  createDraftFromConfig,
  isOllamaProvider,
  resolveProviderDetails,
  resolveProviderHealth,
  resolveProviderLabel,
} from '@/components/ai-assistant/providerConfig.js';

describe('aiAssistant provider helpers', () => {
  const profile = {
    defaultProvider: 'ollama-local',
    providers: [{ id: 'ollama-local', label: 'Ollama cục bộ', type: 'ollama' }],
  };

  const config = {
    enabled: true,
    defaultProvider: 'ollama-local',
    fallbackProvider: 'azure-primary',
    caching: { enabled: true, ttlMinutes: 10, maxEntries: 50 },
    providers: [
      {
        id: 'ollama-local',
        label: 'Ollama cục bộ',
        type: 'ollama',
        enabled: true,
        endpoint: 'http://localhost:11434',
        model: 'llama3.1:8b',
        temperature: 0.4,
        maxTokens: 2048,
        apiKeyPreview: '***',
        hasApiKey: true,
      },
    ],
  };

  it('prefers profile/config metadata when resolving provider labels and details', () => {
    expect(resolveProviderLabel(profile, config, 'ollama-local')).toBe('Ollama cục bộ');
    expect(resolveProviderLabel(profile, config, '')).toBe('Mặc định');
    expect(resolveProviderDetails(profile, config, 'ollama-local')).toEqual(profile.providers[0]);
    expect(resolveProviderDetails(null, config, 'ollama-local')).toEqual(config.providers[0]);
  });

  it('detects ollama providers and maps health states', () => {
    expect(isOllamaProvider({ type: 'ollama' })).toBe(true);
    expect(isOllamaProvider({ id: 'my-ollama-node' })).toBe(true);
    expect(isOllamaProvider({ type: 'azure-openai', id: 'azure-primary' })).toBe(false);

    expect(resolveProviderHealth({ status: 'success' })).toMatchObject({ label: 'Trực tuyến' });
    expect(resolveProviderHealth({ status: 'error' })).toMatchObject({ label: 'Ngoại tuyến' });
    expect(resolveProviderHealth(null)).toMatchObject({ label: 'Chưa kiểm tra' });
  });

  it('creates a draft config without leaking stored api keys', () => {
    expect(createDraftFromConfig(config)).toEqual({
      enabled: true,
      defaultProvider: 'ollama-local',
      fallbackProvider: 'azure-primary',
      temperature: '',
      maxTokens: '',
      maxInputLength: '',
      timeoutMs: '',
      systemPrompt: '',
      caching: { enabled: true, ttlMinutes: 10, maxEntries: 50 },
      providers: [
        {
          id: 'ollama-local',
          type: 'ollama',
          label: 'Ollama cục bộ',
          enabled: true,
          endpoint: 'http://localhost:11434',
          deployment: '',
          apiVersion: '',
          apiKeyEnv: '',
          model: 'llama3.1:8b',
          temperature: 0.4,
          maxTokens: 2048,
          apiKey: '',
          apiKeyPreview: '***',
          hasStoredKey: true,
          clearStoredKey: false,
        },
      ],
    });
  });
});
