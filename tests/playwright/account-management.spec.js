import { test, expect } from './fixtures.js';

import {
  loginAsAdmin,
  openAccountsTab,
  registerDialogAutoAccept,
} from './utils.js';

test('quản trị viên tạo và xóa tài khoản từ giao diện quản trị', async ({ page }) => {
  registerDialogAutoAccept(page);

  await loginAsAdmin(page);
  await openAccountsTab(page);

  const username = 'playwright-user';
  const accountsTable = page.getByRole('table', { name: 'Danh sách tài khoản KPI' });

  await page.getByPlaceholder('username').fill(username);
  await page.getByPlaceholder('Tên người dùng').fill('Tài khoản Playwright');
  await page.getByPlaceholder('Ít nhất 6 ký tự').fill('Playwright@2026');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();

  const accountRow = accountsTable.locator('tbody tr', { hasText: username });

  await expect(accountRow).toBeVisible();

  await accountRow.getByRole('button', { name: 'Xóa tài khoản' }).click();

  const deleteDialog = page.getByRole('dialog', { name: 'Xóa tài khoản' });

  await deleteDialog
    .getByLabel('Nhập lại tên tài khoản để xác nhận')
    .fill(username);
  await deleteDialog.getByRole('button', { name: 'Xóa vĩnh viễn' }).click();

  await expect(accountRow).toHaveCount(0);
});
