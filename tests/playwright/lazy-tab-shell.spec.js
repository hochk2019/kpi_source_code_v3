import { test, expect } from './fixtures.js';

import { loginAsAdmin, openReportsTab } from './utils.js';

const AUDIT_CHUNK_PATTERN = /\/assets\/AuditLog-[^/]+\.js(?:\?.*)?$/;

async function navigateToAuditFromReportWorkflow(page) {
  await openReportsTab(page);
  await page
    .locator('#app-tab-root-reports')
    .getByRole('button', { name: 'Mở audit trail' })
    .first()
    .click();
}

test('report workflow giữ tab root có focus ổn định khi audit chunk còn đang tải', async ({
  page,
}) => {
  let releaseAuditChunk = () => {};
  const auditChunkGate = new Promise((resolve) => {
    releaseAuditChunk = resolve;
  });

  await page.route(AUDIT_CHUNK_PATTERN, async (route) => {
    await auditChunkGate;
    await route.continue();
  });

  await loginAsAdmin(page);
  await navigateToAuditFromReportWorkflow(page);

  const auditRoot = page.locator('#app-tab-root-audit');
  const loadingStatus = page.getByRole('status');

  await expect(auditRoot).toBeVisible();
  await expect(auditRoot).toBeFocused();
  await expect(loadingStatus).toContainText('Đang tải nội dung Nhật ký hệ thống...');

  releaseAuditChunk();

  await expect(page.getByText('Lịch sao lưu CSDL')).toBeVisible();
  await expect(page.getByText('Tra cứu lịch sử export')).toBeVisible();
  await expect(loadingStatus).toBeHidden();
});

test('audit tab hiển thị runtime error boundary khi lazy chunk tải lỗi', async ({ page }) => {
  await page.route(AUDIT_CHUNK_PATTERN, async (route) => {
    await route.abort('failed');
  });

  await loginAsAdmin(page);
  await navigateToAuditFromReportWorkflow(page);

  const auditRoot = page.locator('#app-tab-root-audit');
  const runtimeAlert = page.getByRole('alert');

  await expect(auditRoot).toBeVisible();
  await expect(runtimeAlert).toContainText('Lỗi runtime');
  await expect(runtimeAlert).toContainText('Không thể hiển thị Nhật ký hệ thống.');
  await expect(runtimeAlert).toContainText('Thử hiển thị lại');
});
