import { test, expect } from './fixtures.js';
import { loginAsAdmin, openImportTab, registerDialogAutoAccept } from './utils.js';

test('đồng bộ ECUS thủ công và xem trước dữ liệu', async ({ page, apiEvents }) => {
  registerDialogAutoAccept(page);
  await loginAsAdmin(page);
  await openImportTab(page);

  await page.getByRole('button', { name: 'Xem trước dữ liệu' }).click();
  await expect(page.getByText('CÔNG TY PREVIEW')).toBeVisible();
  expect(apiEvents.preview).toHaveLength(1);

  await page.getByRole('button', { name: 'Đồng bộ ngay' }).click();
  await expect(page.getByText('Đã đồng bộ 4 tờ khai mới từ ECUS')).toBeVisible();
  expect(apiEvents.run).toHaveLength(1);
});
