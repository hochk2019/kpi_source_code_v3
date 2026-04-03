import { describe, expect, it } from 'vitest';

import { createAuditLogStore } from '@/lib/auditLog.js';

function createAuditHarness() {
  const storage = new Map();
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
  const shallowClone = (value) => JSON.parse(JSON.stringify(value ?? null));

  const store = createAuditLogStore({
    getItem,
    setItem,
    safeParse,
    shallowClone,
    auditKey: 'audit_logs_test',
  });

  return { storage, store };
}

describe('auditLogStore', () => {
  it('normalizes category, note, and meta when pushing audit entries', () => {
    const { store } = createAuditHarness();

    const entry = store.pushAuditLog({
      actor: 'tester',
      action: 'team.save',
      detail: 'Lưu tổ đội',
      meta: { nested: { value: 1 } },
      note: '  cap nhat  ',
    });

    expect(entry).toMatchObject({
      actor: 'tester',
      action: 'team.save',
      category: 'team',
      detail: 'Lưu tổ đội',
      note: 'cap nhat',
      result: null,
      meta: { nested: { value: 1 } },
    });

    entry.meta.nested.value = 9;

    expect(store.getAuditLogs(1)[0]).toMatchObject({
      meta: { nested: { value: 1 } },
    });
  });

  it('returns full log list when limit is invalid and clears logs with audit.clear entry', () => {
    const { store } = createAuditHarness();

    store.pushAuditLog({ action: 'decl.save', detail: 'Lưu tờ khai 1' });
    store.pushAuditLog({ action: 'decl.save', detail: 'Lưu tờ khai 2' });

    expect(store.getAuditLogs(0)).toHaveLength(2);

    const cleared = store.clearAuditLogs({
      actor: 'admin',
      note: '  Xóa nhật ký thủ công  ',
    });

    expect(cleared).toMatchObject({
      actor: 'admin',
      action: 'audit.clear',
      category: 'audit',
      detail: '  Xóa nhật ký thủ công  ',
      note: 'Xóa nhật ký thủ công',
      result: 'success',
    });
    expect(store.getAuditLogs()).toEqual([cleared]);
  });
});
