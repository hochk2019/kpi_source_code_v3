import { test, expect } from './fixtures.js';

import {
  openAccountsTab,
  openHQTab,
  openImportTab,
  loginAsAdmin,
  openReportsTab,
  openTeamsTab,
} from './utils.js';

test('quản trị viên xem báo cáo KPI và đổi cấu hình hiển thị', async ({ page }) => {
  await loginAsAdmin(page);
  await openReportsTab(page);
  const reportControls = page.getByRole('region', { name: 'Điều khiển báo cáo KPI' });

  await expect(page.getByText(/Top nhân viên theo điểm KPI/i)).toBeVisible();

  const rangeSelect = reportControls.getByRole('combobox').first();

  await rangeSelect.selectOption('all_time');
  await expect(rangeSelect).toHaveValue('all_time');

  await expect(
    page.getByText('Chưa có dữ liệu tờ khai trong khoảng thời gian đã chọn. Vui lòng import dữ liệu hoặc thay đổi bộ lọc.')
  ).toBeVisible();

  const licensesCheckbox = page.getByRole('checkbox', { name: 'Số giấy phép' });

  await expect(licensesCheckbox).toBeVisible();
  await licensesCheckbox.uncheck();
  await expect(licensesCheckbox).not.toBeChecked();
  await licensesCheckbox.check();
  await expect(licensesCheckbox).toBeChecked();
});

test('điều hướng tuần tự vẫn mở được báo cáo KPI sau khi đi qua nhiều tab', async ({ page }) => {
  await loginAsAdmin(page);

  await openImportTab(page);
  await openAccountsTab(page);
  await openTeamsTab(page);
  await openHQTab(page);
  await openReportsTab(page);

  await expect(page.locator('#app-tab-root-reports')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Điều khiển báo cáo KPI' })).toBeVisible();
});

test('mobile compact shell vẫn mở được báo cáo KPI sau chuỗi điều hướng tuần tự', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await loginAsAdmin(page);

  await openImportTab(page);
  await openAccountsTab(page);
  await openTeamsTab(page);
  await openHQTab(page);
  await openReportsTab(page);

  await expect(page.locator('#app-tab-root-reports')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Điều khiển báo cáo KPI' })).toBeVisible();
});

test('mobile report center cho phép nhảy nhanh từ sơ đồ điều hướng tới lịch gửi', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await loginAsAdmin(page);
  await openReportsTab(page);

  await expect(page.getByText('Sơ đồ report center')).toBeVisible();

  await page.getByRole('link', { name: /Lịch gửi & phát hành/i }).click();

  await expect(page).toHaveURL(/#report-viewer-schedule$/);
  await expect(page.getByRole('region', { name: 'Lập lịch gửi báo cáo KPI' })).toBeVisible();
});

test('workflow guide trong report center handoff focus đúng tới khu export', async ({ page }) => {
  await loginAsAdmin(page);
  await openReportsTab(page);

  await page.getByRole('button', { name: 'Tới khu export' }).click();

  const exportSurface = page.locator('#app-workflow-reports-export');

  await expect(exportSurface).toBeVisible();
  await expect(exportSurface).toBeFocused();
  await expect(page.getByText('3. Export và truy vết')).toBeVisible();
});
