import { test, expect } from './fixtures.js';

import {

  createSampleWorkbook,

  installWorkbookMock,

  loginAsAdmin,

  openImportTab,

  registerDialogAutoAccept,

} from './utils.js';



test('xuất Excel các tờ khai đã chọn trong Import Data', async ({ page }, testInfo) => {

  registerDialogAutoAccept(page);

  const { filePath, binary } = await createSampleWorkbook(testInfo);

  await loginAsAdmin(page);

  await openImportTab(page);

  await installWorkbookMock(page, binary);

  await page.setInputFiles('[data-testid="import-file-input"]', filePath);

  await page.getByRole('button', { name: 'Import XLSX' }).click();

  const sourceStage = page.getByLabel('Bước 1: Nạp nguồn');

  await sourceStage.getByRole('button', { name: 'Hiển thị dữ liệu đã lưu' }).click();

  const checkbox = page.locator('tbody input[type="checkbox"]').first();

  await checkbox.waitFor();

  await checkbox.check();



  const [download] = await Promise.all([

    page.waitForEvent('download'),

    page.getByRole('button', { name: 'Export Excel' }).click(),

  ]);



  const downloadPath = await download.path();

  expect(download.suggestedFilename()).toMatch(/tokhai_da_chon_/);

  expect(downloadPath).toBeTruthy();

});

