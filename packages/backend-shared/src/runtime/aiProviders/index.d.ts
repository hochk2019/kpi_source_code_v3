export interface AiProviderConfig {
  id: string;
  type: string;
  label: string;
  endpoint?: string;
  model?: string;
  apiKeyEnv?: string;
  apiKey?: string;
  deployment?: string;
  apiVersion?: string;
  temperature?: number;
  maxTokens?: number;
  enabled?: boolean;
  retryAttempts?: number;
  retryDelayMs?: number;
  cacheTtlMs?: number;
  [key: string]: unknown;
}

export function detectDefaultAiProvider(
  providers?: AiProviderConfig[],
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): {
  defaultProviderId: string | null;
  fallbackProviderId: string | null;
};

export function buildDefaultAiProviders(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): {
  defaultProviderId: string | null;
  fallbackProviderId: string | null;
  providers: AiProviderConfig[];
};
