import type { AiProviderConfig } from './index.js';

export function createDeepseekProvider(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): AiProviderConfig;
