export function generateSampleDeclarations(options?: {
  count?: number;
  startYear?: number;
  startMonth?: number;
  rules?: Record<string, unknown> | null;
}): Record<string, unknown>[];

export function seedSampleDeclarations(options?: {
  actor?: string;
  count?: number;
  rules?: Record<string, unknown> | null;
}): Record<string, unknown>[];
