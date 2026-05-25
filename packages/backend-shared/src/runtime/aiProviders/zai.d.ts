import type { AiProviderConfig } from './index.js';

export function createZaiProvider(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): AiProviderConfig;
