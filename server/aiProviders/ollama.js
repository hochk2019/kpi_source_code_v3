import { createProviderConfig, readEnv } from './utils.js';

export function createOllamaProvider(env = process.env) {
  return createProviderConfig(
    {
      id: 'ollama-local',
      type: 'ollama',
      label: 'Ollama cục bộ (llama3.1:8b)',
      temperature: 0.1,
      maxTokens: 2048,
      enabled: true,
      retryAttempts: 2,
    },
    {
      endpoint: readEnv(env, 'OLLAMA_ENDPOINT', 'http://localhost:11434'),
      model: readEnv(env, 'OLLAMA_MODEL', 'llama3.1:8b'),
      retryDelayMs: Number.parseInt(readEnv(env, 'OLLAMA_RETRY_DELAY_MS', '250'), 10) || 250,
      cacheTtlMs: Number.parseInt(readEnv(env, 'OLLAMA_CACHE_TTL_MS', '30000'), 10) || 30000,
    },
  );
}
