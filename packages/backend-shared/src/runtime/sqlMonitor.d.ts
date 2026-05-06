export interface SqlTimeoutEvent {
  at: string;
  message: string;
  context: unknown;
}

export function recordSqlTimeout(event?: {
  message?: string;
  context?: unknown;
}): SqlTimeoutEvent;

export function getSqlTimeoutEvents(): SqlTimeoutEvent[];

export function resetSqlMonitor(): void;

export function onSqlTimeout(listener: (event: SqlTimeoutEvent) => void): () => void;
