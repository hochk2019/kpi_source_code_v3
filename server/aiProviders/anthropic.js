import { createProviderConfig } from './utils.js';

export function createAnthropicProvider() {
  return createProviderConfig({
    id: 'anthropic-claude',
    type: 'anthropic',
    label: 'Anthropic Claude 3.5 Sonnet',
    endpoint: 'https://api.anthropic.com',
    model: 'claude-3-5-sonnet-20241022',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    apiVersion: '2023-06-01',
    temperature: 0.2,
    maxTokens: 1024,
    enabled: false,
  });
}
