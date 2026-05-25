import { test, expect } from './fixtures.js';

import { loginAsAdmin, openReportsTab, openTeamsTab } from './utils.js';

const AUDIT_CHUNK_PATTERN = /\/assets\/AuditLog-[^/]+\.js(?:\?.*)?$/;
const REPORT_CENTER_CHUNK_PATTERN = /\/assets\/ReportCenterPanel-[^/]+\.js(?:\?.*)?$/;

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

test('workflow guide giữ fallback focus trên tab báo cáo khi report center còn đang tải', async ({
  page,
}) => {
  let releaseReportCenterChunk = () => {};
  const reportCenterChunkGate = new Promise((resolve) => {
    releaseReportCenterChunk = resolve;
  });

  await page.route(REPORT_CENTER_CHUNK_PATTERN, async (route) => {
    await reportCenterChunkGate;
    await route.continue();
  });

  await loginAsAdmin(page);
  await openTeamsTab(page);

  await page.getByRole('button', { name: 'Mở báo cáo KPI' }).click();

  const reportsRoot = page.locator('#app-tab-root-reports');
  const loadingStatus = page.getByRole('status');

  await expect(reportsRoot).toBeVisible();
  await expect(reportsRoot).toBeFocused();
  await expect(loadingStatus).toContainText('Đang tải nội dung Báo cáo KPI...');

  releaseReportCenterChunk();

  await expect(page.getByText('1. Chốt phạm vi báo cáo')).toBeVisible();
  await expect(page.getByText('3. Export và truy vết')).toBeVisible();
  await expect(loadingStatus).toBeHidden();
});
