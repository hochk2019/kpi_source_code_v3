import path from 'node:path';
import { promises as fs } from 'node:fs';
import XLSX from 'xlsx';

export function registerDialogAutoAccept(page) {
  page.on('dialog', (dialog) => {
    dialog.accept().catch(() => {});
  });
}

export async function loginAsAdmin(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Đăng nhập quản trị' }).click();
  await page.getByPlaceholder('admin').fill('admin');
  await page.getByPlaceholder(/•/).fill('admin123');
  await Promise.all([
    page.waitForResponse((resp) => resp.url().includes('/api/auth/login') && resp.request().method() === 'POST'),
    page.getByRole('button', { name: /^Đăng nhập$/i }).click(),
  ]);
  await page.getByText(/Xin chào, \s*Quản trị viên/i).waitFor();
}

export async function openImportTab(page) {
  await page.getByRole('tab', { name: 'Import Data' }).click();
  await page.getByRole('heading', { name: 'Đồng bộ ECUS' }).waitFor();
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
