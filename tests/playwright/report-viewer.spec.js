import { test, expect } from './fixtures.js';

import {
  loginAsAdmin,
  openReportsTab,
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
