export function readEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> | undefined,
  key: string,
  defaultValue?: string,
): string;

export function createProviderConfig(
  base: Record<string, unknown>,
  overrides?: Record<string, unknown>,
): Record<string, unknown>;
