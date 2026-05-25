/* eslint-env node */

import { describe, expect, it } from 'vitest';

import { resolveReportingRule } from '@kpi/backend-shared/reporting';

describe('resolveReportingRule', () => {
  it('accepts legacy rule sets without groups when license config is present', () => {
    const ruleSet = {
      version: 1,
      license: {
        exclude: {
          codes: [],
          agencies: [{ agency: 'Dai ly HQ 1', codes: ['AG01'] }],
        },
      },
    };

    expect(resolveReportingRule(ruleSet)).toEqual(ruleSet);
  });

  it('selects collection entries that only contain legacy license config', () => {
    const selected = {
      id: 'legacy-license-only',
      license: {
        exclude: {
          codes: ['ZN02'],
          agencies: [{ agency: 'Dai ly HQ 1', codes: ['AG01'] }],
        },
      },
    };
    const collection = {
      version: 2,
      activeId: 'legacy-license-only',
      sets: [selected],
    };

    expect(resolveReportingRule(collection)).toEqual(selected);
  });
});
