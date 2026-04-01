import path from 'node:path';

import { promises as fs } from 'node:fs';

import XLSX from 'xlsx';



export function registerDialogAutoAccept(page, { promptText = 'Playwright@2026' } = {}) {

  page.on('dialog', (dialog) => {
    if (dialog.type() === 'prompt') {
      dialog.accept(promptText).catch(() => {});
      return;
    }

    dialog.accept().catch(() => {});

  });

}



export async function loginAsAdmin(page) {

  await page.goto('/');

  await page.getByRole('button', { name: 'Đăng nhập quản trị' }).click();

  await page.getByPlaceholder('admin').fill('admin');

  await page.getByPlaceholder(/•/).fill('admin123');

  await Promise.all([

    page.waitForResponse((resp) => {
      if (resp.request().method() !== 'POST') {
        return false;
      }
      const pathname = new URL(resp.url()).pathname;
      return pathname === '/api/v4/auth/login';
    }),

    page.getByRole('button', { name: /^Đăng nhập$/i }).click(),

  ]);

  await Promise.any([
    page.getByText(/Xin chào, \s*Quản trị viên/i).waitFor({ timeout: 20000 }),
    page.getByText(/Người dùng admin/i).waitFor({ timeout: 20000 }),
    page.getByRole('tab', { name: /Dashboard KPI/i }).waitFor({ timeout: 20000 }),
    page.getByRole('button', { name: /Command Center/i }).first().waitFor({ timeout: 20000 }),
  ]);

}

async function revealTab(page, tabName) {

  const visibleTab = page.getByRole('tab', { name: tabName });

  if (await visibleTab.isVisible().catch(() => false)) {
    return visibleTab;
  }

  const group = page
    .locator('.ds-app-shell__nav-group')
    .filter({ has: page.getByRole('tab', { name: tabName, includeHidden: true }) })
    .first();

  if (await group.count()) {
    const toggle = group.locator('.ds-app-shell__group-toggle');
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
  }

  await visibleTab.waitFor();

  return visibleTab;

}



export async function openImportTab(page) {

  const importTab = await revealTab(page, 'Import Data');
  const importRoot = page.locator('#app-tab-root-import');

  if (!(await importRoot.isVisible().catch(() => false))) {

    await importTab.scrollIntoViewIfNeeded();
    await importTab.click();

  }

  if (!(await importRoot.isVisible().catch(() => false))) {

    await page.getByRole('button', { name: 'Command Center' }).first().click();

    const commandDialog = page.getByRole('dialog');
    const commandSearch = commandDialog.getByRole('searchbox', { name: 'Tìm thao tác trong Command Center' });

    await commandSearch.fill('Import Data');
    await commandDialog.getByRole('button', { name: /^Đi tới tab Import Data/i }).click();

  }

  await importRoot.waitFor({ state: 'visible' });
  await Promise.any([
    page.getByRole('button', { name: /Xem trước/i }).waitFor({ timeout: 5000 }),
    page.getByRole('button', { name: /Đồng bộ/i }).waitFor({ timeout: 5000 }),
    importRoot.locator('h1, h2, h3, [role="heading"]').first().waitFor({ timeout: 5000 }),
  ]).catch(() => {});

}

async function openTabWithRoot(page, tabName, tabId) {

  const tab = await revealTab(page, tabName);
  const root = page.locator(`#app-tab-root-${tabId}`);

  if (!(await root.isVisible().catch(() => false))) {
    await tab.scrollIntoViewIfNeeded();
    await tab.click();
  }

  await root.waitFor({ state: 'visible' });

  return root;

}

export async function openAccountsTab(page) {

  await openTabWithRoot(page, 'Tài khoản', 'accounts');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).waitFor();

}

export async function openTeamsTab(page) {

  await openTabWithRoot(page, 'Quản lý Tổ đội', 'teams');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).waitFor();

}

export async function openHQTab(page) {

  await openTabWithRoot(page, 'Đại Lý HQ', 'hq');
  await page.getByRole('button', { name: 'Lưu cấu hình' }).waitFor();

}

export async function openReportsTab(page) {

  await openTabWithRoot(page, 'Báo cáo KPI', 'reports');
  await page.getByRole('region', { name: 'Điều khiển báo cáo KPI' }).waitFor();

}



export async function createSampleWorkbook(testInfo, rows = []) {

  const workbook = XLSX.utils.book_new();

  const defaultRows = rows.length

    ? rows

    : [

        {

          'Số tờ khai': 'TK-PLAY-001',

          'Ngày': '15/08/2025',

          MST: '0101234567',

          'Công ty': 'Công ty Playwright',

          'Loại hình': 'A11',

          'Mục hàng': 5,

        },

      ];

  const worksheet = XLSX.utils.json_to_sheet(defaultRows);

  XLSX.utils.book_append_sheet(workbook, worksheet, 'ToKhai');

  const arrayBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

  const filePath = path.join(testInfo.outputPath(), `import-${Date.now()}.xlsx`);

  await fs.writeFile(filePath, Buffer.from(arrayBuffer));

  return { filePath, binary: Array.from(new Uint8Array(arrayBuffer)) };

}



export async function installWorkbookMock(page, binary) {

  const payload = Array.isArray(binary) ? binary : Array.from(binary ?? []);

  await page.evaluate((data) => {

    const bytes = new Uint8Array(data || []);

    window.__playwrightWorkbook = bytes;

    class MockFileReader {

      constructor() {

        this.onload = null;

        this.result = null;

      }



      readAsArrayBuffer() {

        const clone = bytes.slice();

        this.result = clone.buffer;

        if (typeof this.onload === 'function') {

          this.onload({ target: this });

        }

      }

    }

    window.FileReader = MockFileReader;

  }, payload);

}

