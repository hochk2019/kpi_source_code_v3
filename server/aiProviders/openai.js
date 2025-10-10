import { createProviderConfig } from './utils.js';

export function createOpenAiProvider() {
  return createProviderConfig({
    id: 'openai-gpt4o',
    type: 'openai',
    label: 'OpenAI GPT-4o mini',
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKeyEnv: 'OPENAI_API_KEY',
    temperature: 0.2,
    maxTokens: 1024,
    enabled: false,
  });
}
