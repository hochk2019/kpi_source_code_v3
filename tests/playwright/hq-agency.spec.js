import { test, expect } from './fixtures.js';

import {
  loginAsAdmin,
  openHQTab,
  openImportTab,
  registerDialogAutoAccept,
} from './utils.js';

test('quản trị viên thêm cấu hình đại lý HQ và lưu vào hệ thống', async ({ page }) => {
  registerDialogAutoAccept(page);
  const mst = '0312345678';
  const company = 'Công ty Hợp Tác';
  const agencies = 'AnExpress, BLogistics';

  await loginAsAdmin(page);
  await openHQTab(page);

  await page.getByRole('button', { name: 'Thêm dòng mới' }).click();

  const agentInput = page.getByPlaceholder('Ví dụ: Đại lý A, Đại lý B').first();
  const draftRow = agentInput.locator('xpath=ancestor::tr[1]');
  const rowInputs = draftRow.locator('input');

  await rowInputs.nth(0).fill(mst);
  await rowInputs.nth(1).fill(company);
  await agentInput.fill(agencies);

  await draftRow.getByRole('button', { name: 'Cập nhật' }).click();

  const searchInput = page.getByPlaceholder('Tìm theo MST, Công ty hoặc Đại lý');

  await searchInput.fill(mst);

  await expect(page.getByText('1 dòng • Trang 1/1')).toBeVisible();

  let savedRow = page.locator('tbody tr').first();
  let savedInputs = savedRow.locator('input');

  await expect(savedInputs.nth(0)).toHaveValue(mst);
  await expect(savedInputs.nth(1)).toHaveValue(company);
  await expect(savedInputs.nth(2)).toHaveValue(agencies);

  await openImportTab(page);
  await openHQTab(page);
  await searchInput.fill(mst);

  await expect(page.getByText('1 dòng • Trang 1/1')).toBeVisible();

  savedRow = page.locator('tbody tr').first();
  savedInputs = savedRow.locator('input');

  await expect(savedInputs.nth(0)).toHaveValue(mst);
  await expect(savedInputs.nth(1)).toHaveValue(company);
  await expect(savedInputs.nth(2)).toHaveValue(agencies);
});
