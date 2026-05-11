import { test, expect } from './fixtures.js';
import { loginAsAdmin, openImportTab, openReportsTab, openTeamsTab, openHQTab, openAccountsTab } from './utils.js';

const PAGES = [
  { name: 'dashboard', setup: null },
  { name: 'import', setup: (page) => openImportTab(page) },
  { name: 'teams', setup: (page) => openTeamsTab(page) },
  { name: 'reports', setup: (page) => openReportsTab(page) },
  { name: 'accounts', setup: (page) => openAccountsTab(page) },
];

test.describe('Visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const { name, setup } of PAGES) {
    test(`Page: ${name}`, async ({ page }) => {
      if (setup) {
        await setup(page);
      }

      // Wait for content to stabilize
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot(`${name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
});
