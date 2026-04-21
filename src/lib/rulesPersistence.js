export function createRulesPersistenceStore({
  getItem = () => null,
  setItem = () => { },
  safeParse = (_json, fallback) => fallback,
  createDefaultRuleCollection = () => ({}),
  rulesKey = "kpi_rules_v2",
} = {}) {
  return {
    getRules() {
      return safeParse(getItem(rulesKey), createDefaultRuleCollection());
    },

    async setRules(value) {
      await setItem(rulesKey, JSON.stringify(value));
    },
  };
}
