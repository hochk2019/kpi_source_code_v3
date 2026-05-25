import { describe, expect, it } from 'vitest';

import {
  KPI_ADJUSTMENT_CATEGORY_CONFIG as legacyAdjustmentConfig,
  isExportDecl as legacyIsExportDecl,
  mapMemberNamesToTeams as legacyMapMemberNamesToTeams,
  normalizeName as legacyNormalizeName,
  normalizeStr as legacyNormalizeStr,
  roundAdjustmentPoint as legacyRoundAdjustmentPoint,
  toISODate as legacyToISODate,
} from '../src/lib/store.js';
import {
  KPI_ADJUSTMENT_CATEGORY_CONFIG,
  isExportDecl,
  mapMemberNamesToTeams,
  normalizeName,
  normalizeStr,
  roundAdjustmentPoint,
  toISODate,
} from '../shared/reportingLegacySupport.js';

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

describe('shared/reportingLegacySupport', () => {
  it('matches the legacy normalization helpers', () => {
    expect(normalizeStr('  Tést   Name  ')).toBe(legacyNormalizeStr('  Tést   Name  '));
    expect(normalizeName(' Đội Kê Khai 01 ')).toBe(legacyNormalizeName(' Đội Kê Khai 01 '));
  });

  it('matches the legacy date and export helpers', () => {
    const date = new Date('2026-02-03T15:20:30.000Z');

    expect(toISODate(date)).toBe(legacyToISODate(date));
    expect(isExportDecl('E62', '')).toBe(legacyIsExportDecl('E62', ''));
    expect(isExportDecl('H11', 'XK')).toBe(legacyIsExportDecl('H11', 'XK'));
  });

  it('matches the legacy roster-to-team mapping behavior', () => {
    const roster = {
      teams: [
        {
          id: 'team-a',
          name: 'Đội A',
          members: [
            { id: 'member-a', name: 'Nguyễn Văn A' },
            { id: 'member-b', name: 'Trần Văn B' },
          ],
        },
        {
          id: 'team-b',
          name: 'Đội B',
          members: [
            { id: 'member-c', name: 'Lê Văn C' },
          ],
        },
      ],
    };

    expect(mapMemberNamesToTeams(cloneJson(roster))).toEqual(legacyMapMemberNamesToTeams(cloneJson(roster)));
  });

  it('reuses the same adjustment config and rounding behavior', () => {
    expect(KPI_ADJUSTMENT_CATEGORY_CONFIG).toBe(legacyAdjustmentConfig);
    expect(roundAdjustmentPoint(1.234)).toBe(legacyRoundAdjustmentPoint(1.234));
    expect(roundAdjustmentPoint(-0.333)).toBe(legacyRoundAdjustmentPoint(-0.333));
  });
});
