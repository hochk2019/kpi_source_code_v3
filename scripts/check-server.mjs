import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = dirname(__dirname);
const serverDir = join(projectRoot, 'server');
const serverEntry = join(serverDir, 'index.js');
const serverDataDir = join(serverDir, 'data');
const sqliteFile = join(serverDataDir, 'storage.sqlite');
const legacyJson = join(serverDataDir, 'db.json');

const envCandidates = [
  join(projectRoot, '.env'),
  join(projectRoot, '.env.local'),
  join(projectRoot, '.env.production'),
  join(projectRoot, '.env.development'),
];
const requiredEnvConfigPath = join(projectRoot, 'config', 'required-env.json');

async function pathExists(targetPath) {
  try {
    await access(targetPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function runCheck({ description, paths, mode = 'all', required = true, fix }) {
  const existence = await Promise.all(paths.map((targetPath) => pathExists(targetPath)));

  if (mode === 'any') {
    const index = existence.findIndex(Boolean);
    if (index >= 0) {
      console.log(`\u2705 Đã xác nhận ${description}: ${paths[index]}`);
      return { passed: true };
    }

    const message = `Không tìm thấy ${description}.`;
    if (required) {
      console.error(`\u274c ${message}`);
      if (fix) {
        console.error(`   Gợi ý: ${fix}`);
      }
      return { passed: false };
    }

    console.warn(`\u26a0\ufe0f ${message}`);
    if (fix) {
      console.warn(`   Gợi ý: ${fix}`);
    }
    return { passed: true, warned: true };
  }

  const missingIndexes = existence
    .map((value, index) => (value ? null : index))
    .filter((value) => value !== null);

  if (missingIndexes.length === 0) {
    console.log(`\u2705 Đã xác nhận ${description}.`);
    return { passed: true };
  }

  const missingPaths = missingIndexes.map((index) => paths[index]);
  const message = `Không tìm thấy ${description}: ${missingPaths.join(', ')}`;

  if (required) {
    console.error(`\u274c ${message}`);
    if (fix) {
      console.error(`   Gợi ý: ${fix}`);
    }
    return { passed: false };
  }

  console.warn(`\u26a0\ufe0f ${message}`);
  if (fix) {
    console.warn(`   Gợi ý: ${fix}`);
  }
  return { passed: true, warned: true };
}

const isStrictMode = process.argv.includes('--strict');

async function loadRequiredEnvVariables() {
  try {
    const raw = await readFile(requiredEnvConfigPath, 'utf8');
    const data = JSON.parse(raw);

    let list;
    if (Array.isArray(data)) {
      list = data;
    } else if (data && Array.isArray(data.requiredVariables)) {
      list = data.requiredVariables;
    } else if (data && Array.isArray(data.required)) {
      list = data.required;
    } else {
      throw new Error('Cấu hình không hợp lệ.');
    }

    const invalid = list.filter((item) => typeof item !== 'string' || item.trim() === '');
    if (invalid.length > 0) {
      throw new Error(`Giá trị không hợp lệ: ${invalid.join(', ')}`);
    }

    return list.map((item) => item.trim());
  } catch (error) {
    throw new Error(
      `Không thể đọc danh sách biến môi trường từ ${requiredEnvConfigPath}. ${error.message}`,
    );
  }
}

async function findFirstExisting(paths) {
  for (const candidate of paths) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  return null;
}

function parseEnvContent(content) {
  const result = new Map();
  const lines = content.split(/\r?\n/);

  for (const originalLine of lines) {
    let line = originalLine.trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }

    if (line.startsWith('export ')) {
      line = line.slice(7);
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim();

    if (key === '') {
      continue;
    }

    const unquotedValue = value.replace(/^['"]/, '').replace(/['"]$/, '');
    result.set(key, unquotedValue);
  }

  return result;
}

async function ensureRequiredEnvVariables(requiredVariables) {
  if (requiredVariables.length === 0) {
    console.log('ℹ️ Không có biến môi trường bắt buộc nào được cấu hình.');
    return { passed: true };
  }

  const declaredVariables = new Set();
  Object.entries(process.env).forEach(([key, value]) => {
    if (typeof value === 'string' && value.trim() !== '') {
      declaredVariables.add(key);
    }
  });

  let envFileUsed = null;
  try {
    envFileUsed = await findFirstExisting(envCandidates);
    if (envFileUsed) {
      const content = await readFile(envFileUsed, 'utf8');
      const parsed = parseEnvContent(content);
      parsed.forEach((value, key) => {
        if (value.trim() !== '') {
          declaredVariables.add(key);
        }
      });
    }
  } catch (error) {
    console.warn('⚠️ Không thể đọc tệp môi trường để xác minh biến bắt buộc.', error.message);
  }

  const missing = requiredVariables.filter((variable) => !declaredVariables.has(variable));

  if (missing.length === 0) {
    console.log('✅ Đã xác nhận đầy đủ biến môi trường bắt buộc.');
    return { passed: true };
  }

  const message = `Thiếu biến môi trường bắt buộc: ${missing.join(', ')}`;
  const fixSuggestion = envFileUsed
    ? `Bổ sung vào ${envFileUsed}.`
    : 'Tạo hoặc cập nhật tệp .env và khai báo đầy đủ các biến yêu cầu.';

  if (isStrictMode) {
    console.error(`❌ ${message}`);
    console.error(`   Gợi ý: ${fixSuggestion}`);
    return { passed: false };
  }

  console.warn(`⚠️ ${message}`);
  console.warn(`   Gợi ý: ${fixSuggestion}`);
  return { passed: true, warned: true };
}

async function main() {
  const checks = [
    runCheck({
      description: 'thư mục backend (server)',
      paths: [serverDir],
      fix: 'Đồng bộ lại mã nguồn hoặc giải nén thư mục server từ bản sao lưu.',
    }),
    runCheck({
      description: 'tệp khởi động backend (server/index.js)',
      paths: [serverEntry],
      fix: 'Khôi phục file server/index.js hoặc kéo lại mã nguồn mới nhất.',
    }),
    runCheck({
      description: 'thư mục dữ liệu backend (server/data)',
      paths: [serverDataDir],
      fix: 'Tạo lại thư mục server/data (bao gồm các file cấu hình và cơ sở dữ liệu).',
    }),
    runCheck({
      description: 'cơ sở dữ liệu backend (storage.sqlite hoặc db.json)',
      paths: [sqliteFile, legacyJson],
      mode: 'any',
      fix: 'Chạy "pnpm db:init" để tạo file storage.sqlite hoặc khôi phục db.json từ bản sao lưu.',
    }),
    runCheck({
      description: 'tệp cấu hình môi trường (.env/.env.local/.env.production/.env.development)',
      paths: envCandidates,
      mode: 'any',
      required: isStrictMode,
      fix: 'Tạo file .env (hoặc biến thể tương ứng) để khai báo KPI_LISTEN_HOST, PORT, VITE_API_BASE và các biến môi trường cần thiết.',
    }),
    runCheck({
      description: 'cấu hình danh sách biến môi trường bắt buộc (config/required-env.json)',
      paths: [requiredEnvConfigPath],
      fix: 'Tạo file config/required-env.json và liệt kê các biến môi trường bắt buộc, ví dụ {"requiredVariables":["KPI_LISTEN_HOST","PORT","VITE_API_BASE"]}.',
    }),
  ];

  const results = await Promise.all(checks);

  if (results.every((result) => result.passed || result.warned)) {
    try {
      const requiredVariables = await loadRequiredEnvVariables();
      const envVariableResult = await ensureRequiredEnvVariables(requiredVariables);
      results.push(envVariableResult);
    } catch (error) {
      console.error(`❌ ${error.message}`);
      results.push({ passed: false });
    }
  }

  const hasFailure = results.some((result) => !result.passed);
  const hasWarning = results.some((result) => result.warned);

  if (hasFailure) {
    console.error('\nVui lòng khôi phục đầy đủ thư mục backend và dữ liệu trước khi tiếp tục.');
    console.error('Sau khi bổ sung tệp, hãy chạy lại: pnpm install && pnpm db:init');
    process.exitCode = 1;
    return;
  }

  if (hasWarning) {
    console.warn('\nLưu ý: một số tệp cấu hình tùy chọn chưa được thiết lập. Hãy cập nhật chúng trước khi triển khai để tránh lỗi môi trường.');
  }

  if (isStrictMode) {
    console.log('\u2705 Đã xác nhận đầy đủ các tệp backend và cấu hình môi trường trong chế độ nghiêm ngặt.');
  } else {
    console.log('\u2705 Đã xác nhận các thành phần backend cốt lõi tồn tại.');
  }
}

main().catch((error) => {
  console.error('\u274c Xảy ra lỗi khi kiểm tra thư mục server.');
  console.error(error);
  process.exitCode = 1;
});
