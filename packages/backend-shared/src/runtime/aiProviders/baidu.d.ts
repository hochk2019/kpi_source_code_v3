import type { AiProviderConfig } from './index.js';

export function createBaiduProvider(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): AiProviderConfig;
