export function resolveSeverity(input: unknown): string;

export function buildPlainText(payload?: {
  severity?: string;
  title?: string;
  message?: string;
  summary?: Record<string, unknown>;
  alerts?: Record<string, unknown>[];
  meta?: Record<string, unknown>;
}): string;

export function normalizeTeamsText(input: unknown): string;

export function getEmailConfig(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): {
  transport: { host: string; port: number; secure: boolean; auth?: { user: string; pass: string } };
  defaults: {
    from: string;
    to: string[];
    cc: string[];
    bcc: string[];
    replyTo?: string;
    subjectPrefix?: string;
  };
  source: string;
} | null;

export function getTeamsConfig(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): {
  webhook: string;
  mentions: string[];
  channel?: string;
  source: string;
} | null;

export function sendEmail(
  event: Record<string, unknown>,
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): Promise<{ ok: boolean; result?: unknown; reason?: string }>;

export function sendTeams(
  event: Record<string, unknown>,
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
  fetchImpl?: typeof globalThis.fetch,
): Promise<{ ok: boolean; status?: number | null; reason?: string }>;

export const __internal: Readonly<{
  parseRecipients: (value: unknown) => string[];
  parseBoolean: (value: unknown, fallback?: boolean) => boolean;
  parseNumber: (value: unknown) => number | null;
  buildEmailSubject: (event: Record<string, unknown>, config: Record<string, unknown>) => string;
  buildTeamsCard: (event: Record<string, unknown>, config: Record<string, unknown>) => Record<string, unknown>;
  convertPlainToHtml: (text: string) => string;
}>;
