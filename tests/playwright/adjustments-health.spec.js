import { test, expect } from './fixtures.js';

import { loginAsAdmin } from './utils.js';

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

test('quản trị viên mở workflow điều chỉnh KPI với đủ ba chặng vận hành', async ({ page }) => {
  await loginAsAdmin(page);
  await openTabWithRoot(page, 'Điểm KPI +/- Thêm', 'adjustments');

  await expect(page.locator('#app-tab-root-adjustments')).toBeVisible();
  await expect(page.getByRole('heading', { name: '1. Chọn kỳ điều chỉnh' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '2. Workspace điều chỉnh' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '3. Xuất bản tác động' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xem tác động KPI' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mở report center' })).toBeVisible();
  await expect(
    page.getByText(/Điều chỉnh KPI được neo vào workflow ba bước/i),
  ).toBeVisible();
});

test('quản trị viên mở dashboard sức khỏe dữ liệu và thấy các khối triage chính', async ({
  page,
}) => {
  await loginAsAdmin(page);
  await openTabWithRoot(page, 'Sức khỏe dữ liệu', 'health');

  await expect(page.locator('#app-tab-root-health')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Health & sync triage' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tổng quan sức khỏe dữ liệu' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Đang tải…|Làm mới/u }).first()).toBeVisible();
  await expect(
    page.getByText(/Theo dõi chất lượng dữ liệu tờ khai, cảnh báo thiếu thông tin/i),
  ).toBeVisible();
});
