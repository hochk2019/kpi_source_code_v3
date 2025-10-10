import { createProviderConfig, readEnv } from './utils.js';

export function createOllamaProvider(env = process.env) {
  return createProviderConfig(
    {
      id: 'ollama-local',
      type: 'ollama',
      label: 'Ollama cục bộ (llama3.1:8b)',
      temperature: 0.1,
      enabled: false,
    },
    {
      endpoint: readEnv(env, 'OLLAMA_ENDPOINT', 'http://localhost:11434'),
      model: readEnv(env, 'OLLAMA_MODEL', 'llama3.1:8b'),
    },
  );
}
