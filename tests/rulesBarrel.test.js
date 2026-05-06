// tests/rulesBarrel.test.js
// Tests for refactored rules barrel exports

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadRules,
  persistRules,
  getActiveRuleSet,
  createRuleSet,
  updateRuleSet,
  deleteRuleSet,
  setActiveRuleSet,
} from "../src/lib/rules/rulesCore.js";
import {
  computeKPI,
  addByTiersExported as addByTiers,
} from "../src/lib/rules/rulesCalculation.js";
import {
  validateTier,
  validateRuleSet,
  sanitizeRuleSetName,
  isValidRuleId,
} from "../src/lib/rules/rulesValidation.js";
import {
  DEFAULT_RULE_SET,
  createDefaultRuleCollection,
  createEmptyTier,
} from "../src/lib/rules/rulesPresets.js";

// Mock storage
vi.mock("../src/lib/storageClient.js", () => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock("../src/lib/auditLog.js", () => ({
  pushAuditLog: vi.fn(),
}));

describe("Rules Barrel", () => {
  describe("rulesPresets", () => {
    it("has valid default rule set", () => {
      expect(DEFAULT_RULE_SET).toBeDefined();
      expect(DEFAULT_RULE_SET.name).toBe("Mặc định");
      expect(DEFAULT_RULE_SET.rules.import.tiers.length).toBeGreaterThan(0);
      expect(DEFAULT_RULE_SET.rules.export.tiers.length).toBeGreaterThan(0);
    });

    it("creates default collection", () => {
      const collection = createDefaultRuleCollection();
      expect(collection.sets.length).toBe(1);
      expect(collection.activeId).toBeDefined();
    });

    it("creates empty tier", () => {
      const tier = createEmptyTier(0, 10, 500);
      expect(tier).toEqual({ from: 0, to: 10, add: 500 });
    });
  });

  describe("rulesValidation", () => {
    it("validates correct tier", () => {
      const result = validateTier({ from: 0, to: 10, add: 500 });
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("rejects invalid tier range", () => {
      const result = validateTier({ from: 10, to: 5, add: 500 });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("validates rule set name", () => {
      expect(sanitizeRuleSetName("  Test Name  ")).toBe("Test Name");
      expect(sanitizeRuleSetName("")).toBe("Bộ quy tắc mới");
    });

    it("validates rule IDs", () => {
      expect(isValidRuleId("rule_1234567890_abc")).toBe(true);
      expect(isValidRuleId("invalid")).toBe(false);
      expect(isValidRuleId("")).toBe(false);
    });
  });

  describe("rulesCalculation", () => {
    it("calculates KPI for export row", () => {
      const row = { itemCount: 15 };
      const rules = {
        export: {
          tiers: [
            { from: 0, to: 10, add: 50000 },
            { from: 11, to: 50, add: 45000 },
          ],
        },
      };
      const kpi = computeKPI(row, rules);
      expect(kpi).toBe(45000);
    });

    it("returns 0 for empty tiers", () => {
      const row = { itemCount: 15 };
      const kpi = computeKPI(row, { export: { tiers: [] } });
      expect(kpi).toBe(0);
    });

    it("calculates tier addition correctly - finds highest matching tier", () => {
      const tiers = [
        { from: 0, to: 10, add: 100 },
        { from: 11, to: 20, add: 200 },
        { from: 21, to: 50, add: 300 },
      ];
      expect(addByTiers(5, tiers, false)).toBe(100);
      expect(addByTiers(15, tiers, false)).toBe(200);
      expect(addByTiers(25, tiers, false)).toBe(300);
      // Critical: should find highest matching tier, not first
      expect(addByTiers(15, tiers, false)).toBe(200); // NOT 100
    });
  });
});
