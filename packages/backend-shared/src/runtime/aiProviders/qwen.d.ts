import type { AiProviderConfig } from './index.js';

export function createQwenProvider(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): AiProviderConfig;
