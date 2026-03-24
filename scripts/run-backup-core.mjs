import process from 'node:process';

export const DEFAULT_BACKUP_REASON = 'bootstrap-local';

export const DEFAULT_BACKUP_COMMAND = 'pnpm backup:run';

export function parseBackupCliArgs(argv = []) {
  const options = {
    reason: DEFAULT_BACKUP_REASON,
    note: null,
    retention: undefined,
    directory: undefined,
    actor: 'local-cli',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--reason') {
      options.reason = `${argv[index + 1] || ''}`.trim() || DEFAULT_BACKUP_REASON;
      index += 1;
      continue;
    }

    if (token === '--note') {
      const value = argv[index + 1];
      options.note = value === undefined ? null : `${value}`;
      index += 1;
      continue;
    }

    if (token === '--directory') {
      const value = `${argv[index + 1] || ''}`.trim();
      if (!value) {
        throw new Error('Thiếu giá trị cho --directory');
      }
      options.directory = value;
      index += 1;
      continue;
    }

    if (token === '--actor') {
      const value = `${argv[index + 1] || ''}`.trim();
      options.actor = value || 'local-cli';
      index += 1;
      continue;
    }

    if (token === '--retention') {
      const rawValue = argv[index + 1];
      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error('Giá trị --retention phải là số nguyên không âm');
      }
      options.retention = Math.trunc(parsed);
      index += 1;
      continue;
    }

    throw new Error(`Tham số không hỗ trợ: ${token}`);
  }

  return options;
}

export async function main(argv = process.argv.slice(2), { logger = console } = {}) {
  process.env.KPI_SKIP_LISTEN = process.env.KPI_SKIP_LISTEN || '1';
  process.env.KPI_DISABLE_CRON = process.env.KPI_DISABLE_CRON || '1';

  const options = parseBackupCliArgs(argv);
  const serverModule = await import('../server/index.js');
  const { performDatabaseBackup, getBackupDirectory } = serverModule;

  const result = await performDatabaseBackup({
    reason: options.reason,
    note: options.note,
    retention: options.retention,
    actor: options.actor,
    backupDir: options.directory ?? getBackupDirectory(),
  });

  if (!result?.ok) {
    const reason = result?.reason || 'unknown';
    throw new Error(`Không thể tạo backup local: ${reason}`);
  }

  logger.log(`✅ Đã tạo backup local: ${result.file}`);
  logger.log(`ℹ️ Có thể chạy "${DEFAULT_BACKUP_COMMAND}" lại khi cần tạo bản sao lưu thủ công mới.`);
  logger.log('ℹ️ Chạy "pnpm healthcheck" hoặc "pnpm build" để xác nhận cảnh báo backup_missing đã biến mất.');

  return result;
}
