import { describe, expect, it } from 'vitest';

import { buildDefaultAiProviders, detectDefaultAiProvider } from '../server/aiProviders/index.js';


describe('buildDefaultAiProviders', () => {
  it('chọn Ollama làm mặc định khi thiếu cấu hình đám mây', () => {
    const { defaultProviderId, fallbackProviderId } = buildDefaultAiProviders({});

    expect(defaultProviderId).toBe('ollama-local');
    expect(fallbackProviderId).toBeNull();
  });

  it('ưu tiên Azure khi cấu hình đầy đủ', () => {
    const env = {
      AZURE_OPENAI_KEY: 'sk-azure',
      AZURE_OPENAI_ENDPOINT: 'https://example.openai.azure.com',
      AZURE_OPENAI_DEPLOYMENT: 'gpt-4o-mini',
    };

    const { defaultProviderId, fallbackProviderId } = buildDefaultAiProviders(env);

    expect(defaultProviderId).toBe('azure-openai');
    expect(fallbackProviderId).toBe('ollama-local');
  });

  it('bỏ qua Azure khi thiếu endpoint', () => {
    const env = {
      AZURE_OPENAI_KEY: 'sk-azure',
      AZURE_OPENAI_ENDPOINT: '   ',
    };

    const { defaultProviderId, fallbackProviderId } = buildDefaultAiProviders(env);

    expect(defaultProviderId).toBe('ollama-local');
    expect(fallbackProviderId).toBeNull();
  });
});


describe('detectDefaultAiProvider', () => {
  it('trả về null khi không provider nào đủ điều kiện', () => {
    const { defaultProviderId, fallbackProviderId } = detectDefaultAiProvider(
      [
        { id: 'azure-openai', enabled: false },
        { id: 'ollama-local', enabled: false },
      ],
      {},
    );

    expect(defaultProviderId).toBeNull();
    expect(fallbackProviderId).toBeNull();
  });

  it('xác định fallback là provider đủ điều kiện kế tiếp', () => {
    const providers = [
      { id: 'custom-primary', enabled: true, apiKeyEnv: 'CUSTOM_API_KEY' },
      { id: 'custom-secondary', enabled: true, apiKeyEnv: 'CUSTOM_SECONDARY_KEY' },
    ];

    const env = {
      CUSTOM_API_KEY: 'abc',
      CUSTOM_SECONDARY_KEY: 'xyz',
    };

    const { defaultProviderId, fallbackProviderId } = detectDefaultAiProvider(providers, env);

    expect(defaultProviderId).toBe('custom-primary');
    expect(fallbackProviderId).toBe('custom-secondary');
  });
});
