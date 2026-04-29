// rulesPresets.js
// Default rule presets and templates

export const DEFAULT_RULE_SET = {
  id: "default",
  name: "Mặc định",
  rules: {
    import: {
      tiers: [
        { from: 0, to: 10, add: 50000 },
        { from: 11, to: 50, add: 45000 },
        { from: 51, to: 100, add: 40000 },
        { from: 101, to: Infinity, add: 35000 },
      ],
    },
    export: {
      tiers: [
        { from: 0, to: 10, add: 55000 },
        { from: 11, to: 50, add: 50000 },
        { from: 51, to: 100, add: 45000 },
        { from: 101, to: Infinity, add: 40000 },
      ],
    },
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const EMPTY_RULE_SET = {
  id: "",
  name: "",
  rules: {
    import: { tiers: [] },
    export: { tiers: [] },
  },
  createdAt: "",
  updatedAt: "",
};

export const TIER_TEMPLATES = {
  standard: [
    { from: 0, to: 10, add: 50000 },
    { from: 11, to: 50, add: 45000 },
    { from: 51, to: 100, add: 40000 },
  ],
  premium: [
    { from: 0, to: 5, add: 60000 },
    { from: 6, to: 20, add: 55000 },
    { from: 21, to: 50, add: 50000 },
    { from: 51, to: 100, add: 45000 },
  ],
  minimal: [
    { from: 0, to: Infinity, add: 30000 },
  ],
};

export function createDefaultRuleCollection() {
  return {
    sets: [{ ...DEFAULT_RULE_SET }],
    activeId: DEFAULT_RULE_SET.id,
  };
}

export function createEmptyTier(from = 0, to = 10, add = 0) {
  return { from, to, add };
}

export function cloneTierTemplate(templateName) {
  const template = TIER_TEMPLATES[templateName];
  if (!template) return [];
  return template.map((t) => ({ ...t }));
}

export default {
  DEFAULT_RULE_SET,
  EMPTY_RULE_SET,
  TIER_TEMPLATES,
  createDefaultRuleCollection,
  createEmptyTier,
  cloneTierTemplate,
};
