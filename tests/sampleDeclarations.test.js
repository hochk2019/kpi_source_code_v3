import { describe, it, expect, beforeEach } from 'vitest';

import { seedSampleDeclarations } from '@/shared/sampleDeclarations.js';

import { DEFAULT_RULES } from '@/shared/defaultRules.js';

import { clearStorageCache, getItem as sharedGetItem } from '@/lib/storageClient.js';

import { DECL_KEY } from '@/lib/store.js';



const GROUP_KEYS = ['group1', 'group2', 'group3'];



function makeGroupSets(rules) {

  return GROUP_KEYS.reduce((acc, key) => {

    const codes = rules?.groups?.[key]?.codes ?? [];

    acc[key] = new Set(codes.map((code) => String(code).trim().toUpperCase()));

    return acc;

  }, {});

}



const EXPECTED_LICENSE_COMBOS = [

  ['ZB02'],

  ['ZB03'],

  ['ZB02', 'ZB03'],

  ['ZC01'],

  ['ZB02', 'ZC01'],

  ['ZB99'],

  ['ZN02'],

  ['HDGC'],

  [],

];



describe('seedSampleDeclarations integration', () => {

  beforeEach(() => {

    clearStorageCache();

  });



  it('ghi đè dữ liệu mẫu và đảm bảo phân bố đều theo nhóm & giấy phép', () => {

    const count = 90;

    const rows = seedSampleDeclarations({ actor: 'integration-test', count, rules: DEFAULT_RULES });



    expect(rows).toHaveLength(count);



    const storedRaw = sharedGetItem(DECL_KEY);

    expect(storedRaw).toBeTypeOf('string');

    const stored = JSON.parse(storedRaw || '[]');

    expect(stored).toHaveLength(count);



    const groupSets = makeGroupSets(DEFAULT_RULES);

    const distribution = { group1: 0, group2: 0, group3: 0 };



    for (const row of rows) {

      const code = String(row?.loai_hinh || row?.loaiHinh || '').trim().toUpperCase();

      const match = GROUP_KEYS.find((key) => groupSets[key].has(code));

      expect(match, `Loại hình ${code} phải thuộc một nhóm`).toBeTruthy();

      if (match) {

        distribution[match] += 1;

      }

    }



    const counts = Object.values(distribution);

    const min = Math.min(...counts);

    const max = Math.max(...counts);

    expect(max - min).toBeLessThanOrEqual(1);



    const comboHistogram = new Map();

    for (const row of rows) {

      const key = JSON.stringify(row.licenseCodes);

      comboHistogram.set(key, (comboHistogram.get(key) || 0) + 1);

    }



    for (const combo of EXPECTED_LICENSE_COMBOS) {

      const key = JSON.stringify(combo);

      expect(comboHistogram.has(key), `Thiếu tổ hợp giấy phép ${key}`).toBe(true);

    }



    const excludedRows = rows.filter((row) =>

      row.licenseCodes.some((code) => ['ZN02', 'HDGC'].includes(code))

    );

    expect(excludedRows.length).toBeGreaterThan(0);

    for (const row of excludedRows) {

      expect(row.licenses).toBe(0);

    }



    const manualCountRows = rows.filter(

      (row) => row.licenseCodes.length === 0 && row.licenses > 0

    );

    expect(manualCountRows.length).toBeGreaterThan(0);

  });

});

