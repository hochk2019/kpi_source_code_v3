import { test, expect } from '@playwright/test';

const LOGIN_PATHNAMES = new Set(['/api/v4/auth/login']);

test.describe('runtime non-mock smoke', () => {
  test('health check and login request reach backend runtime', async ({ page, request }) => {
    const healthResponse = await request.get('/api/v4/health');
    expect(healthResponse.ok()).toBe(true);

    const loginStatuses = [];
    page.on('response', (response) => {
      if (response.request().method() !== 'POST') {
        return;
      }
      const pathname = new URL(response.url()).pathname;
      if (LOGIN_PATHNAMES.has(pathname)) {
        loginStatuses.push(response.status());
      }
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Đăng nhập quản trị' }).click();
    await page.getByPlaceholder('admin').fill('runtime-smoke-invalid');
    await page.getByPlaceholder(/•/).fill('runtime-smoke-invalid');

    await Promise.all([
      page.waitForResponse((response) => {
        if (response.request().method() !== 'POST') {
          return false;
        }
        const pathname = new URL(response.url()).pathname;
        return LOGIN_PATHNAMES.has(pathname);
      }),
      page.getByRole('button', { name: /^Đăng nhập$/i }).click(),
    ]);
    await page.getByText(/Sai tài khoản hoặc mật khẩu/i).waitFor({ timeout: 20000 });
    expect(loginStatuses.length).toBeGreaterThan(0);
    expect(loginStatuses.some((status) => status === 200 || status === 401 || status === 404)).toBe(true);

    await expect(
      page.getByText(/Không kết nối được máy chủ đăng nhập|Không tìm thấy API đăng nhập/i),
    ).toHaveCount(0);
  });
});
