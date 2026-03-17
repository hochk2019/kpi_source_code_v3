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

test('sidebar tabs do not overlap on mobile shell', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await loginAsAdmin(page);

  await assertSidebarLayout(page, testInfo, 'sidebar-mobile.png');
});
