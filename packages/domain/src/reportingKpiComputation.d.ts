import type { RuleSetV2 } from './defaultRules.js';

export { DEFAULT_RULES } from './defaultRules.js';

export function computeKPI(row: Record<string, unknown>, rulesInput?: RuleSetV2 | null): number;
