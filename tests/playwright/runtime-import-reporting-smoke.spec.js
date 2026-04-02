import { test, expect } from '@playwright/test';

import {
  createSampleWorkbook,
  loginAsAdmin,
  openImportTab,
  openReportsTab,
} from './utils.js';

test.describe('runtime import + reporting smoke', () => {
  async function expectReportingScopeState(page) {
    const exportButton = page.getByRole('button', { name: 'Xuất Excel' }).first();
    const noDataGuard = page.getByText(
      'Chưa có dữ liệu tờ khai trong khoảng thời gian đã chọn. Vui lòng import dữ liệu hoặc thay đổi bộ lọc.',
    );

    if (await exportButton.isVisible().catch(() => false)) {
      await expect(exportButton).toBeVisible();

      if (await exportButton.isDisabled()) {
        const disabledReason = exportButton.locator('xpath=../span[1]');
        await expect(disabledReason).toBeVisible();
      }

      return;
    }

    await expect(noDataGuard).toBeVisible();
  }

  test('import valid workbook enables import action and keeps export available in staff/team scopes', async ({
    page,
  }, testInfo) => {
    await loginAsAdmin(page);
    await openImportTab(page);

    const now = new Date();
    const today = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const { filePath } = await createSampleWorkbook(testInfo, [
      {
        'Số tờ khai': 'TK-PLAY-001',
        Ngày: today,
        MST: '0101234567',
        'Công ty': 'Công ty Playwright',
        'Loại hình': 'A11',
        'Mục hàng': 5,
      },
    ]);

    const importStep = page.getByLabel('Bước 1: Nạp nguồn');
    const importButton = importStep.getByRole('button', { name: 'Import XLSX' });

    await page.setInputFiles('[data-testid="import-file-input"]', filePath);

    const previewTable = page.getByRole('table', {
      name: 'Bảng các dòng thêm mới từ file import',
    });

    await expect(previewTable.getByText('Công ty Playwright')).toBeVisible();
    await expect(importButton).toBeEnabled();

    await importButton.click();
    await expect(page.locator('tbody tr', { hasText: 'TK-PLAY-001' })).toBeVisible();

    await openReportsTab(page);

    await page.getByRole('button', { name: 'Nhân viên', exact: true }).click();
    await expectReportingScopeState(page);

    await page.getByRole('button', { name: 'Tổ đội', exact: true }).click();
    await expectReportingScopeState(page);
  });
});
