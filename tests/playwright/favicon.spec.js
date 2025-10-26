import { test, expect } from '@playwright/test';



const ICON_SELECTOR = 'link[rel="icon"]';



async function extractFaviconHref(page) {

  return page.evaluate((selector) => {

    const element = document.querySelector(selector);

    return element ? element.getAttribute('href') : null;

  }, ICON_SELECTOR);

}



test('favicon được nhúng Base64 và chụp ảnh màn hình trang chủ', async ({ page }) => {

  await page.goto('/', { waitUntil: 'networkidle' });



  const href = await extractFaviconHref(page);

  expect(href).toBeTruthy();

  expect(href).toMatch(/^data:image\/svg\+xml;base64,/);



  const base64Length = href.length - 'data:image/svg+xml;base64,'.length;

  expect(base64Length).toBeGreaterThan(100);



  const screenshot = await page.screenshot({ fullPage: true });

  await test.info().attach('trang-chu', { body: screenshot, contentType: 'image/png' });

});

