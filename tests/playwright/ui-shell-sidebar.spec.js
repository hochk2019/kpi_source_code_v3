import { test, expect } from './fixtures.js';

import { loginAsAdmin } from './utils.js';

async function assertSidebarLayout(page, testInfo, screenshotName) {
  const sidebar = page.locator('.ds-app-shell__sidebar');
  const tabs = sidebar.getByRole('tab');

  await expect(sidebar).toBeVisible();
  const tabCount = await tabs.count();
  expect(tabCount).toBeGreaterThan(7);

  const boxes = [];

  for (let index = 0; index < tabCount; index += 1) {
    const tab = tabs.nth(index);
    await expect(tab).toBeVisible();
    const box = await tab.boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThan(60);
    boxes.push(box);
  }

  for (let index = 1; index < boxes.length; index += 1) {
    const prev = boxes[index - 1];
    const current = boxes[index];
    expect(current.y).toBeGreaterThanOrEqual(prev.y + prev.height - 1);
  }

  await sidebar.screenshot({ path: testInfo.outputPath(screenshotName) });
}

test('sidebar tabs do not overlap on desktop shell', async ({ page }, testInfo) => {
  await loginAsAdmin(page);

  await assertSidebarLayout(page, testInfo, 'sidebar-desktop.png');
});

test('mobile shell uses compact navigation with readable targets', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await loginAsAdmin(page);

  const shell = page.locator('.ds-app-shell__layout');
  const sidebar = page.locator('.ds-app-shell__sidebar');
  const compactSummary = sidebar.locator('.ds-app-shell__compact-status');
  const brandCopy = sidebar.locator('.ds-app-shell__brand-copy');
  const firstToggle = sidebar.locator('.ds-app-shell__group-toggle').first();

  await expect(shell).toHaveAttribute('data-shell-layout', 'compact');
  await expect(compactSummary).toBeVisible();
  await expect(brandCopy).toBeHidden();
  await expect(firstToggle).toBeVisible();

  const visibleTabs = sidebar.getByRole('tab');
  const compactTabCount = await visibleTabs.count();
  expect(compactTabCount).toBeGreaterThan(0);
  expect(compactTabCount).toBeLessThan(6);

  const activeTabBox = await visibleTabs.first().boundingBox();
  expect(activeTabBox).not.toBeNull();
  expect(activeTabBox.height).toBeGreaterThanOrEqual(44);

  await firstToggle.click();
  await expect(sidebar.getByRole('tab', { name: /MST/i })).toBeVisible();

  await sidebar.screenshot({ path: testInfo.outputPath('sidebar-mobile-compact.png') });
});
