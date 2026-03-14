/* eslint-env node */

/* @vitest-environment node */

import { describe, expect, it } from 'vitest';

import {
  getBootstrapPasswordEnvKey,
  listBootstrapPasswordEnvKeys,
  normalizeBootstrapPasswordEnvSegment,
  readBootstrapAccountPassword,
} from '../server/bootstrapAccountPasswords.js';

describe('bootstrapAccountPasswords', () => {
  it('ưu tiên alias rõ nghĩa cho admin và vẫn hỗ trợ generic key', () => {
    expect(getBootstrapPasswordEnvKey('admin')).toBe('KPI_BOOTSTRAP_ADMIN_PASSWORD');
    expect(listBootstrapPasswordEnvKeys('admin')).toEqual([
      'KPI_BOOTSTRAP_ADMIN_PASSWORD',
      'KPI_BOOTSTRAP_PASSWORD_ADMIN',
    ]);
  });

  it('chuẩn hóa username thành segment env an toàn', () => {
    expect(normalizeBootstrapPasswordEnvSegment('lead.phuong')).toBe('LEAD_PHUONG');
    expect(normalizeBootstrapPasswordEnvSegment(' manager.thuyha ')).toBe('MANAGER_THUYHA');
  });

  it('đọc password bootstrap đã trim từ env hiện có', () => {
    const env = {
      KPI_BOOTSTRAP_PASSWORD_LEAD_PHUONG: '  Secret#2026  ',
    };

    expect(readBootstrapAccountPassword('lead.phuong', env)).toBe('Secret#2026');
    expect(readBootstrapAccountPassword('manager.hoainam', env)).toBe('');
  });
});
