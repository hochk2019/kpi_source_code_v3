import type { AiProviderConfig } from './index.js';

export function createAzureProvider(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): AiProviderConfig;
