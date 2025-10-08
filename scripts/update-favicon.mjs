#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

async function main() {
  const [, , svgInput, htmlInput = 'index.html'] = process.argv;
  if (!svgInput) {
    console.error('Cách dùng: node scripts/update-favicon.mjs <đường-dẫn-SVG> [đường-dẫn-index.html]');
    process.exit(1);
  }

  const svgPath = path.resolve(process.cwd(), svgInput);
  const htmlPath = path.resolve(process.cwd(), htmlInput);

  let svgContent;
  try {
    svgContent = await readFile(svgPath, 'utf8');
  } catch (err) {
    console.error('Không thể đọc file SVG:', svgPath, err);
    process.exit(1);
  }
  const normalizedSvg = svgContent.replace(/\r\n?/g, '\n').trim();
  if (!normalizedSvg.startsWith('<svg')) {
    console.error('Tệp đầu vào không phải SVG hợp lệ (thiếu thẻ <svg ...>).');
    process.exit(1);
  }
  const base64 = Buffer.from(normalizedSvg, 'utf8').toString('base64');

  let htmlContent;
  try {
    htmlContent = await readFile(htmlPath, 'utf8');
  } catch (err) {
    console.error('Không thể đọc file HTML mục tiêu:', htmlPath, err);
    process.exit(1);
  }

  const replacement = `href="data:image/svg+xml;base64,${base64}"`;
  if (!/href="data:image\/svg\+xml;base64,[^"]*"/u.test(htmlContent)) {
    console.error('Không tìm thấy favicon dạng data:image/svg+xml trong file HTML cần cập nhật.');
    process.exit(1);
  }

  const updatedHtml = htmlContent.replace(/href="data:image\/svg\+xml;base64,[^"]*"/u, replacement);
  if (updatedHtml === htmlContent) {
    console.log('Nội dung favicon không thay đổi, bỏ qua ghi file.');
    return;
  }

  await writeFile(htmlPath, updatedHtml, 'utf8');
  console.log(`Đã cập nhật favicon Base64 trong ${path.relative(process.cwd(), htmlPath)} từ ${path.relative(process.cwd(), svgPath)}.`);
}

main().catch((err) => {
  console.error('Cập nhật favicon thất bại:', err);
  process.exit(1);
});
