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

test('giữ bộ lọc ngày và MST xuyên suốt preview, filter runtime, và đồng bộ tay', async ({
  page,
  apiEvents,
}) => {
  registerDialogAutoAccept(page);
  const sourceStep = page.getByLabel('Bước 1: Nạp nguồn');

  await loginAsAdmin(page);
  await openImportTab(page);

  await sourceStep.getByLabel('Chỉ đồng bộ các MST').fill('0100109106;\n0312345678');
  await sourceStep.getByLabel('Danh sách MST loại trừ').fill('0401234567;0407654321');
  await sourceStep.getByLabel('Ngày bắt đầu chạy tay ECUS').fill('2025-08-01');
  await sourceStep.getByLabel('Ngày kết thúc chạy tay ECUS').fill('2025-08-02');

  await sourceStep.getByRole('button', { name: 'Xem trước dữ liệu' }).click();

  const mainTable = page.getByRole('table', { name: 'Danh sách tờ khai import' });
  await expect(mainTable.getByRole('cell', { name: 'CÔNG TY PREVIEW' }).first()).toBeVisible();
  expect(apiEvents.preview).toHaveLength(1);
  expect(apiEvents.preview[0]?.body).toMatchObject({
    from: '2025-08-01',
    to: '2025-08-02',
    includeTaxCodes: ['0100109106', '0312345678'],
    excludeTaxCodes: ['0401234567', '0407654321'],
  });

  await page.getByRole('searchbox', { name: 'Tìm nhanh danh sách tờ khai' }).fill('ĐÃ CÓ');
  await expect(mainTable.getByRole('cell', { name: 'CÔNG TY ĐÃ CÓ' }).first()).toBeVisible();
  await expect(mainTable.getByRole('cell', { name: 'CÔNG TY PREVIEW' })).toHaveCount(0);

  await sourceStep.getByRole('button', { name: 'Đồng bộ ngay' }).click();

  await expect(page.getByText('Đã đồng bộ 4 tờ khai mới từ ECUS')).toBeVisible();
  expect(apiEvents.run).toHaveLength(1);
  expect(apiEvents.run[0]?.body).toMatchObject({
    from: '2025-08-01',
    to: '2025-08-02',
    includeTaxCodes: ['0100109106', '0312345678'],
    excludeTaxCodes: ['0401234567', '0407654321'],
  });
});

