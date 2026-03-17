import { test, expect } from './fixtures.js';

import { loginAsAdmin, openImportTab, registerDialogAutoAccept } from './utils.js';



test('đồng bộ ECUS thủ công và xem trước dữ liệu', async ({ page, apiEvents }) => {

  registerDialogAutoAccept(page);
  const sourceStep = page.getByLabel('Bước 1: Nạp nguồn');

  await loginAsAdmin(page);

  await openImportTab(page);



  await page.getByRole('button', { name: 'Xem trước dữ liệu' }).click();

  await expect(page.getByRole('cell', { name: 'CÔNG TY PREVIEW' }).first()).toBeVisible();

  expect(apiEvents.preview).toHaveLength(1);
  expect(apiEvents.preview[0]?.path).toBe('/api/v4/declarations/imports/ecus-preview');



  await sourceStep.getByRole('button', { name: 'Đồng bộ ngay' }).click();

  await expect(page.getByText('Đã đồng bộ 4 tờ khai mới từ ECUS')).toBeVisible();

  expect(apiEvents.run).toHaveLength(1);
  expect(apiEvents.run[0]?.path).toBe('/api/v4/declarations/imports/ecus-commit');
  expect(
    apiEvents.requests.some(({ path }) =>
      [
        '/api/import/ecus/config',
        '/api/import/ecus/status',
        '/api/import/ecus/preview',
        '/api/import/ecus/run',
        '/api/import/search',
        '/api/import/deleted-declarations',
      ].includes(path)
    )
  ).toBe(false);

});

