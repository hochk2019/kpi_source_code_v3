import type { AiProviderConfig } from './index.js';

export function createOllamaProvider(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): AiProviderConfig;
