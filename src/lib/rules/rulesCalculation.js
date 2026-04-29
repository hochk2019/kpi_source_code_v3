// rulesCalculation.js
// KPI calculation logic - tier-based scoring

function clone(obj) {
  return JSON.parse(JSON.stringify(obj ?? null));
}

function addByTiers(numItems, tiers = [], isCumulative = false) {
  if (!numItems || !tiers?.length) return 0;
  const sorted = [...tiers].sort((a, b) => (a.from || 0) - (b.from || 0));
  let sum = 0;
  for (const tier of sorted) {
    const { from = 0, to = Number.POSITIVE_INFINITY, add = 0 } = tier;
    if (numItems < from) continue;
    if (isCumulative) {
      sum += Number(add || 0);
    } else {
      // Find the highest matching tier (keep iterating to find higher tiers)
      if (numItems >= from && numItems <= to) {
        sum = Number(add || 0);
        // Don't break - continue to check higher tiers that might also match
      }
      // For highest-match mode, we continue to check all tiers
      // and the last matching tier (highest from value) wins
    }
  }
  return sum;
}

export function computeKPI(row, rulesInput) {
  if (!row || typeof row !== "object") return 0;
  const rules = rulesInput || {};
  const tiers = rules?.export?.tiers || rules?.import?.tiers || [];
  const isCumulative = rules?.cumulative || false;
  const itemCount = Number(row.itemCount) || 0;
  return addByTiers(itemCount, tiers, isCumulative);
}

export function computeRowKPI(row, ruleSet) {
  return computeKPI(row, ruleSet);
}

export function recalcKPIForRows(rows, rules) {
  if (!Array.isArray(rows)) return [];
  const updated = [];
  for (const row of rows) {
    const kpi = computeKPI(row, rules);
    if (kpi !== (row.kpi || 0)) {
      updated.push({ ...row, kpi, updatedAt: new Date().toISOString() });
    } else {
      updated.push(row);
    }
  }
  return updated;
}

export function addByTiersExported(numItems, tiers, isCumulative) {
  return addByTiers(numItems, tiers, isCumulative);
}

export default {
  computeKPI,
  computeRowKPI,
  recalcKPIForRows,
  addByTiers: addByTiersExported,
};
