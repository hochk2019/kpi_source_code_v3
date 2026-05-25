export function resolveReportingRule(input, requestedIdInput = '') {
  const requestedId = normalizeText(requestedIdInput);

  if (isRuleCollection(input)) {
    const sets = input.sets.filter(isRuleSet);
    if (!sets.length) {
      return null;
    }

    if (requestedId) {
      return sets.find((entry) => normalizeText(entry.id) === requestedId) || null;
    }

    const activeId = normalizeText(input.activeId);
    return sets.find((entry) => normalizeText(entry.id) === activeId) || sets[0];
  }

  if (isRuleSet(input)) {
    if (requestedId) {
      const storedId = normalizeText(input.id);
      if (storedId && storedId !== requestedId) {
        return null;
      }
    }

    return input;
  }

  return null;
}

function isRuleCollection(input) {
  return isRecord(input) && Array.isArray(input.sets);
}

function isRuleSet(input) {
  return isRecord(input) && (isRecord(input.groups) || isRecord(input.license) || isRecord(input.bonuses));
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(input) {
  return typeof input === 'string' ? input.trim() : '';
}
