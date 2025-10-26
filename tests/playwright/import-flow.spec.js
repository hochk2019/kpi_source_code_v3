import { test, expect } from './fixtures.js';

import {

  createSampleWorkbook,

  installWorkbookMock,

  loginAsAdmin,

  openImportTab,

  registerDialogAutoAccept,

} from './utils.js';



test('quản trị viên import tờ khai từ file Excel mẫu', async ({ page }, testInfo) => {

  registerDialogAutoAccept(page);

  const { filePath, binary } = await createSampleWorkbook(testInfo);

  await loginAsAdmin(page);

  await openImportTab(page);

  await installWorkbookMock(page, binary);

  await page.setInputFiles('[data-testid="import-file-input"]', filePath);



  await expect(page.getByText('Công ty Playwright')).toBeVisible();

  await page.getByRole('button', { name: 'Import XLSX' }).click();



  const savedRow = page.locator('tbody tr', { hasText: 'TK-PLAY-001' });

  await expect(savedRow).toBeVisible();

  await expect(savedRow).toContainText('Công ty Playwright');

});

