import { describe, it, expect } from 'vitest';

import {

  computeKPI,

  DEFAULT_RULES,

  saveRules,

  deleteRule,

  loadRuleSets,

  exportRuleCollection,

  restoreRuleCollection,

} from '@/lib/rules.js';



describe('computeKPI', () => {

  it('uses muc_hang when num_items is missing', () => {

    const row = { loaiHinh: 'A11', muc_hang: 25 };

    const point = computeKPI(row, DEFAULT_RULES);

    expect(point).toBe(5.2);

  });



  it('still honors explicit num_items when provided', () => {

    const row = { loaiHinh: 'A11', muc_hang: 25, num_items: 5 };

    const point = computeKPI(row, DEFAULT_RULES);

    // base 0.2 + 5 mục hàng × 0.2

    expect(point).toBe(1.2);

  });



  it('cộng điểm theo mã giấy phép và loại trừ theo đại lý', () => {

    const row = {

      loaiHinh: 'E11',

      num_items: 3,

      licenseCodes: ['ZB02', 'ZB03', 'ZC01'],

      agency: 'G&B',

    };

    const point = computeKPI(row, DEFAULT_RULES);

    // Nhóm 1: base 0.2 + 3 × 0.1 = 0.5

    // Licenses: ZB02 và ZB03 bị loại khi đại lý G&B, chỉ còn ZC01 → 0.3 điểm

    expect(point).toBe(0.8);

  });



  it('cộng điểm C/O khi được bật', () => {

    const row = {

      loaiHinh: 'E41',

      num_items: 1,

      licenseCodes: [],

      has_co: true,

    };

    const point = computeKPI(row, DEFAULT_RULES);

    // Nhóm 2: base 0.2 + 1 × 0.15 = 0.35, + C/O 0.3 → 0.65

    expect(point).toBe(0.7);

  });



  it('cộng điểm theo số dòng áp C/O khi có cấu hình', () => {

    const row = {

      loaiHinh: 'E41',

      num_items: 1,

      co_line_count: 5,

      has_co: true,

    };

    const point = computeKPI(row, DEFAULT_RULES);

    // 0.35 + 0.3 + (5 × 0.05) = 0.9

    expect(point).toBe(0.9);

  });

});



describe('deleteRule', () => {

  it('không cho phép xóa bộ quy tắc cuối cùng', () => {

    const onlyRule = loadRuleSets().sets[0];

    expect(() => deleteRule(onlyRule.id)).toThrow(/cuối cùng/i);

  });



  it('xóa bộ quy tắc phụ và giữ lại các bộ khác', () => {

    const extra = saveRules({

      ...DEFAULT_RULES,

      id: 'rule-phu',

      name: 'Rule phụ',

    }, { actor: 'tester', appendHistory: false, ruleId: 'rule-phu' });



    const before = loadRuleSets();

    expect(before.sets.some((entry) => entry.id === extra.id)).toBe(true);



    const afterDelete = deleteRule(extra.id, { actor: 'tester' });

    expect(afterDelete.sets.some((entry) => entry.id === extra.id)).toBe(false);

    const persisted = loadRuleSets();

    expect(persisted.sets.some((entry) => entry.id === extra.id)).toBe(false);

    expect(persisted.sets.length).toBeGreaterThanOrEqual(1);

  });

});



describe('exportRuleCollection & restoreRuleCollection', () => {

  it('sao lưu và khôi phục bộ quy tắc thành công', () => {

    const snapshot = exportRuleCollection();

    const backup = JSON.parse(JSON.stringify(snapshot));

    const target = { ...backup.sets[0], name: 'Bộ khôi phục kiểm thử' };

    const restoredData = {

      version: backup.version,

      activeId: target.id,

      sets: [target],

    };



    try {

      const restored = restoreRuleCollection(restoredData, { actor: 'tester' });

      expect(restored.activeId).toBe(target.id);

      expect(restored.sets).toHaveLength(1);

      expect(restored.sets[0].name).toBe('Bộ khôi phục kiểm thử');



      const persisted = loadRuleSets();

      expect(persisted.activeId).toBe(target.id);

      expect(persisted.sets).toHaveLength(1);

    } finally {

      restoreRuleCollection(snapshot, { actor: 'tester' });

    }

  });

});

