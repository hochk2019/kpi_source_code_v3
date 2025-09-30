import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = dirname(__dirname);
const serverDir = join(projectRoot, 'server');
const serverEntry = join(serverDir, 'index.js');

async function ensureExists(targetPath, description) {
  try {
    await access(targetPath, constants.F_OK);
    return true;
  } catch (error) {
    console.error(`\u274c Không tìm thấy ${description}: ${targetPath}`);
    return false;
  }
}

async function main() {
  const dirExists = await ensureExists(serverDir, 'thư mục backend (server)');
  const entryExists = await ensureExists(serverEntry, 'tệp khởi động backend (server/index.js)');

  if (!dirExists || !entryExists) {
    console.error('\nVui lòng đồng bộ lại mã nguồn hoặc khôi phục thư mục "server" trước khi tiếp tục.');
    console.error('Sau khi bổ sung thư mục, hãy chạy lại: pnpm install && pnpm db:init');
    process.exitCode = 1;
    return;
  }

  console.log('\u2705 Đã xác nhận thư mục "server" và tệp "index.js" tồn tại.');
}

main().catch((error) => {
  console.error('\u274c Xảy ra lỗi khi kiểm tra thư mục server.');
  console.error(error);
  process.exitCode = 1;
});
