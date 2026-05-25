export function formatDisplayDate(input: unknown): string;

export function formatDateRangeLabel(
  range: string | { from?: unknown; to?: unknown } | null | undefined,
): string;

export function formatDateTime(
  input: unknown,
  options?: { withSeconds?: boolean },
): string;
