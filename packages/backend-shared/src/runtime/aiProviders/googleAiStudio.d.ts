import type { AiProviderConfig } from './index.js';

export function createGoogleAiStudioProvider(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): AiProviderConfig;
