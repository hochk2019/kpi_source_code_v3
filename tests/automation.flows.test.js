import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  previewDeclRows,
  saveDeclRows,
  getDeclRows,
  saveMSTRow,
  getMSTFor,
  getMSTHistoryEntries,
  saveKpiAdjustmentSettings,
  getKpiAdjustmentSettings,
  saveKpiAdjustment,
  getKpiAdjustments,
} from '@/lib/store.js';
import { saveRules, DEFAULT_RULES } from '@/lib/rules.js';
import { computeLicenseSnapshot, normalizeLicenseCode } from '../shared/licenseSummary.js';
import { createAccount, updateAccount, reloadAccounts, getAuth, listAccounts } from '@/auth/localAuth.js';
import { clearStorageCache } from '@/lib/storageClient.js';
import { installMockApi } from './helpers/mockApi.js';

const SAMPLE_DECLS = [
  {
    so_tk: '1020304050',
    so_tk_suffix: '01',
    branch: 'HQ01',
    mst: '0312345678',
    company: 'Công ty Tiếp Vận A',
    nhan_vien: 'Nguyễn Văn A',
    team: 'Team A',
    trang_thai: 'moi',
    ngay_dang_ky: '2024-11-02',
    licenses: 2,
    licenseSourceCodes: ['ZB02', 'ZB03'],
  },
  {
    so_tk: '1122334455',
    so_tk_suffix: '01',
    branch: 'HQ02',
    mst: '0300000001',
    company: 'Golden Logistics',
    nhan_vien: 'Trần Thị B',
    team: 'Team B',
    trang_thai: 'cho_duyet',
    ngay_dang_ky: '2024-11-05',
    licenseManualCount: 1,
    licenseSourceCodes: ['ZB03'],
  },
];

let fetchMock;

beforeEach(() => {
  clearStorageCache();
  fetchMock = installMockApi();
});

afterEach(() => {
  if (fetchMock?.mockRestore) {
    fetchMock.mockRestore();
  }
});

describe('Tự động hoá quy trình nghiệp vụ chính', () => {
  it('xem trước và import tờ khai rồi gán MST theo lịch sử', () => {
    saveDeclRows([], { overwrite: true, actor: 'tester' });
    const preview = previewDeclRows(SAMPLE_DECLS, { actor: 'tester' });
    expect(preview.mode).toBe('merge');
    expect(preview.totalIncoming).toBe(SAMPLE_DECLS.length);

    const result = saveDeclRows(SAMPLE_DECLS, { actor: 'tester', detail: 'Import thử nghiệm' });
    expect(result.totalStored).toBe(SAMPLE_DECLS.length);
    expect(result.errors).toEqual([]);

    const stored = getDeclRows();
    expect(stored).toHaveLength(2);
    const mstRow = saveMSTRow(
      {
        mst: '0312345678',
        company: 'Công ty Tiếp Vận A',
        person_import: 'Nguyễn Văn A',
        team: 'Team A',
        effective_from: '2024-10-01',
        status: 'active',
      },
      { actor: 'tester' }
    );
    expect(mstRow.ok).toBe(true);

    const effective = getMSTFor('0312345678', '2024-11-02');
    expect(effective?.person_import).toBe('Nguyễn Văn A');
    const history = getMSTHistoryEntries();
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].mst).toBe('0312345678');
  });

  it('đối chiếu giấy phép và tính điểm KPI bổ sung theo rule', () => {
    const rule = saveRules({
      ...DEFAULT_RULES,
      id: 'rule-auto-test',
      name: 'Rule automation test',
      license: {
        ...DEFAULT_RULES.license,
        exclude: { codes: ['ZZ00'] },
      },
    });
    expect(rule.id).toBe('rule-auto-test');

    const snapshot = computeLicenseSnapshot(
      {
        licenseSourceCodes: ['ZB02', 'ZZ00', 'zb03'],
        licenseExcludedCodes: 'ZZ00',
        __raw: { 'Số lượng GP': '3' },
      },
      rule
    );
    expect(snapshot.includedCodes).toEqual(['ZB02', 'ZB03']);
    expect(snapshot.excludedCodes).toContain('ZZ00');
    expect(snapshot.includedCount).toBe(2);

    saveKpiAdjustmentSettings(
      {
        categories: {
          license_support: {
            licensePoints: { ZB02: 2.5 },
          },
        },
      },
      { actor: 'tester', permissions: { adjustApprove: true } }
    );
    const settings = getKpiAdjustmentSettings();
    expect(settings.categories.license_support.licensePoints.ZB02).toBe(2.5);

    const adjustment = saveKpiAdjustment(
      {
        category: 'license_support',
        staffName: 'Nguyễn Văn A',
        teamName: 'Team A',
        month: '2024-11',
        quantity: 2,
        licenseCode: 'ZB02',
      },
      { actor: 'tester', permissions: { adjustApprove: true } }
    );
    expect(adjustment.totalPoints).toBeCloseTo(5.0, 5);
    expect(getKpiAdjustments()).toHaveLength(1);
    expect(normalizeLicenseCode('zb02')).toBe('ZB02');
  });

  it('tạo và cập nhật tài khoản để kiểm tra phân quyền', async () => {
    await reloadAccounts();
    const created = await createAccount(
      {
        username: 'tester',
        password: '123456',
        role: 'manager',
        permissions: { adjustApprove: true },
      },
      { actor: 'admin' }
    );
    expect(created?.username).toBe('tester');

    const updated = await updateAccount(
      'tester',
      {
        role: 'admin',
        permissions: { manageAccounts: true },
      },
      { actor: 'admin' }
    );
    expect(updated?.role).toBe('admin');
    expect(updated?.permissions.accountManage).toBe(true);

    const accounts = listAccounts();
    expect(accounts.some((account) => account.username === 'tester')).toBe(true);
    expect(getAuth()?.username).not.toBe('tester');
  });
});
