import { createRequire } from 'node:module';

import { test, expect } from './fixtures.js';

import {
  loginAsAdmin,
  openImportTab,
} from './utils.js';

const require = createRequire(import.meta.url);
const axeSourcePath = require.resolve('axe-core/axe.min.js');

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

async function runAxe(page, scopeSelector) {
  await page.addScriptTag({ path: axeSourcePath });

  return page.evaluate(async (scope) => {
    const context = scope ? document.querySelector(scope) : document;
    if (!context) {
      return { violations: [{ id: 'missing-scope', impact: 'serious', help: `Missing scope ${scope}` }] };
    }

    return window.axe.run(context, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
      },
    });
  }, scopeSelector);
}

function formatViolations(violations) {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => node.target.join(' ')),
  }));
}

test('admin tabs pass axe audit for import, mst, and adjustments flows', async ({ page }) => {
  await loginAsAdmin(page);

  await openImportTab(page);
  const importResults = await runAxe(page, '#app-tab-root-import');
  expect(formatViolations(importResults.violations)).toEqual([]);

  await openTabWithRoot(page, 'Gán MST', 'mst');
  const mstResults = await runAxe(page, '#app-tab-root-mst');
  expect(formatViolations(mstResults.violations)).toEqual([]);

  await openTabWithRoot(page, 'Điểm KPI +/- Thêm', 'adjustments');
  const adjustmentsResults = await runAxe(page, '#app-tab-root-adjustments');
  expect(formatViolations(adjustmentsResults.violations)).toEqual([]);
});
