import { test, expect } from './fixtures.js';

import {
  loginAsAdmin,
  openImportTab,
  registerDialogAutoAccept,
} from './utils.js';

test('quản trị viên chạy đối soát C/O mà không gặp lỗi HTTP 500', async ({ page }) => {
  registerDialogAutoAccept(page);

  await loginAsAdmin(page);
  await openImportTab(page);

  const monitoringPanel = page.locator('section[data-collapsible-id="co-discrepancy"]');

  await expect(monitoringPanel.getByText('Đối soát C/O')).toBeVisible();

  await monitoringPanel.getByRole('button', { name: 'Chạy kiểm tra' }).click();

  await expect(monitoringPanel.getByText(/^Đã chạy đối soát C\/O:/)).toBeVisible();
  await expect(monitoringPanel.getByText('HTTP 500')).toHaveCount(0);
  await expect(monitoringPanel.getByText('Lỗi đối soát')).toHaveCount(0);
});
