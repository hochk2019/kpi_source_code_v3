import { test, expect } from './fixtures.js';

import {
  loginAsAdmin,
  openImportTab,
  openTeamsTab,
  registerDialogAutoAccept,
} from './utils.js';

test('quản trị viên thêm thành viên mới vào tổ đội và lưu lại', async ({ page }) => {
  registerDialogAutoAccept(page);

  await loginAsAdmin(page);
  await openTeamsTab(page);

  const memberName = 'Playwright Member';
  const memberInput = page.getByPlaceholder('Tên thành viên mới');
  const addMemberForm = memberInput.locator('xpath=ancestor::form[1]');

  await page.getByRole('button', { name: 'Team 1' }).click();
  await memberInput.fill(memberName);
  await addMemberForm.getByRole('button', { name: 'Thêm' }).click();

  const memberButton = page.getByRole('button', { name: new RegExp(memberName) });

  await expect(memberButton).toBeVisible();

  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled();

  await openImportTab(page);
  await openTeamsTab(page);
  await page.getByRole('button', { name: 'Team 1' }).click();

  await expect(page.getByRole('button', { name: new RegExp(memberName) })).toBeVisible();
});
