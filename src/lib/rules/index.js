// rules/index.js
// Domain barrel for KPI rules management

// Core operations (CRUD)
export {
  loadRules,
  persistRules,
  getActiveRuleSet,
  createRuleSet,
  updateRuleSet,
  deleteRuleSet,
  setActiveRuleSet,
} from './rulesCore.js';

// Calculation logic
export {
  computeKPI,
  computeRowKPI,
  recalcKPIForRows,
  addByTiers,
} from './rulesCalculation.js';

// Validation
export {
  validateTier,
  validateRuleSet,
  sanitizeRuleSetName,
  sanitizeTierValue,
  isValidRuleId,
  MIN_TIER_ADD,
  MAX_TIER_ADD,
  MAX_TIERS,
} from './rulesValidation.js';

// Presets and templates
export {
  DEFAULT_RULE_SET,
  EMPTY_RULE_SET,
  TIER_TEMPLATES,
  createDefaultRuleCollection,
  createEmptyTier,
  cloneTierTemplate,
} from './rulesPresets.js';
