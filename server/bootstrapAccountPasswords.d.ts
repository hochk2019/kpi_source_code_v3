export function normalizeBootstrapPasswordEnvSegment(usernameInput: unknown): string;
export function listBootstrapPasswordEnvKeys(usernameInput: unknown): string[];
export function getBootstrapPasswordEnvKey(usernameInput: unknown): string;
export function readBootstrapAccountPassword(
  usernameInput: unknown,
  env?: NodeJS.ProcessEnv,
): string;
