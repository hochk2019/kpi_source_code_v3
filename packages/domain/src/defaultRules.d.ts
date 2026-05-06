export interface RuleGroupConfig {
  key: string;
  title: string;
  description: string;
  codes: string[];
  base: number;
  perItem: number;
  tierMode: string;
  tiers: readonly { from?: number; to?: number; add?: number }[];
}

export interface LicenseCodePoint {
  code: string;
  points: number;
}

export interface AgencyExclusion {
  agency: string;
  codes: string[];
}

export interface LicenseConfig {
  defaultPoints: number;
  codePoints: readonly LicenseCodePoint[];
  exclude: {
    codes: readonly string[];
    agencies: readonly AgencyExclusion[];
  };
}

export interface CoBonusConfig {
  enabled: boolean;
  label: string;
  points: number;
  perLine: number;
}

export interface RuleSetV2 {
  id: string;
  name: string;
  description: string;
  applyFrom: string;
  updatedAt: string;
  groups: Record<string, RuleGroupConfig>;
  license: LicenseConfig;
  bonuses: {
    co: CoBonusConfig;
  };
}

export interface RuleCollection {
  version: number;
  activeId: string;
  sets: RuleSetV2[];
}

export function createDefaultRuleSetV2(): RuleSetV2;
export function createDefaultRuleCollection(): RuleCollection;

export const DEFAULT_RULES: RuleSetV2;
export const DEFAULT_RULE_COLLECTION: RuleCollection;
