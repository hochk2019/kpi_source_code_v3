import { describe, expect, it } from 'vitest';

import { createRulesPersistenceStore } from '@/lib/rulesPersistence.js';
import { createDefaultRuleCollection } from '../packages/domain/src/defaultRules.js';

function createRulesPersistenceHarness(initialValue = null) {
  const storage = new Map();
  if (initialValue !== null) {
    storage.set('rules_test_key', initialValue);
  }

  const getItem = (key) => (storage.has(key) ? storage.get(key) : null);
  const setItem = (key, value) => {
    storage.set(key, value);
  };
  const safeParse = (json, fallback) => {
    try {
      const value = JSON.parse(json);
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };

  const store = createRulesPersistenceStore({
    getItem,
    setItem,
    safeParse,
    createDefaultRuleCollection,
    rulesKey: 'rules_test_key',
  });

  return { storage, store };
}

describe('rulesPersistenceStore', () => {
  it('returns the default collection when storage is empty or invalid', () => {
    const emptyHarness = createRulesPersistenceHarness();
    const invalidHarness = createRulesPersistenceHarness('{invalid');

    expect(emptyHarness.store.getRules()).toEqual(createDefaultRuleCollection());
    expect(invalidHarness.store.getRules()).toEqual(createDefaultRuleCollection());
  });

  it('serializes persisted collections without changing the payload shape', () => {
    const { storage, store } = createRulesPersistenceHarness();
    const nextRules = {
      activeId: 'custom-rule',
      sets: [
        {
          id: 'custom-rule',
          name: 'Quy tắc kiểm thử',
          groups: [],
          license: {},
        },
      ],
    };

    store.setRules(nextRules);

    expect(storage.get('rules_test_key')).toBe(JSON.stringify(nextRules));
    expect(store.getRules()).toEqual(nextRules);
  });
});
