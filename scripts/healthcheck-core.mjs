import process from 'node:process';

export const IGNORED_BACKUP_ISSUE_CODES = ['schedule_inactive', 'schedule_reason_cron_disabled_env'];
export const BACKUP_REMEDIATION_COMMAND = 'pnpm backup:run';

function collectIssueCodes(issues) {
  return new Set(
    Array.isArray(issues)
      ? issues.map((issue) => (typeof issue === 'string' ? issue : issue?.code)).filter(Boolean)
      : []
  );
}

export async function runHealthcheck({
  logger = console,
  env = process.env,
  serverModuleLoader = () => import('../server/index.js'),
  serverModule: providedServerModule,
  startAt = Date.now(),
} = {}) {
  env.KPI_SKIP_LISTEN = env.KPI_SKIP_LISTEN || '1';
  env.KPI_DISABLE_CRON = env.KPI_DISABLE_CRON || '1';

  logger.log('🔍 Đang chạy health check backend...');

  try {
    const serverModule = providedServerModule ?? (await serverModuleLoader());
    const { DB_FILE, getDatabaseHandle, checkSqlServerHealth, getDatabaseInitState } = serverModule;
    const db = typeof serverModule.getDatabaseHandle === 'function' ? serverModule.getDatabaseHandle() : getDatabaseHandle?.();

    if (!db) {
      logger.error('Không thể lấy kết nối SQLite.');
      return 1;
    }

    try {
      db.prepare('SELECT 1').get();
      logger.log(`✅ SQLite sẵn sàng (${DB_FILE || 'in-memory'})`);
      if (typeof getDatabaseInitState === 'function') {
        const initInfo = getDatabaseInitState();
        if (initInfo?.seeded) {
          logger.warn(
            `⚠️ Cảnh báo: SQLite vừa được seed lại với ${initInfo.insertedEntries} khóa mặc định. Hãy kiểm tra và khôi phục sao lưu nếu cần.`
          );
        } else if (initInfo?.missingInserted) {
          logger.log(`ℹ️ SQLite đã bổ sung ${initInfo.missingInserted} khóa mặc định còn thiếu trong lần khởi động này.`);
        }
      }
    } catch (err) {
      logger.error('❌ Không thể truy vấn SQLite:', err.message);
      return 1;
    }

    if (typeof checkSqlServerHealth === 'function') {
      try {
        const sqlStatus = await checkSqlServerHealth();
        if (sqlStatus.ok) {
          logger.log('✅ SQL Server: sẵn sàng hoặc chưa cấu hình (không bắt buộc khi chạy nội bộ).');
        } else if (sqlStatus.state === 'not_configured') {
          logger.warn('ℹ️ SQL Server chưa cấu hình — bỏ qua kiểm tra này.');
        } else {
          logger.warn('⚠️ Không thể kết nối SQL Server:', sqlStatus.message || sqlStatus.state);
        }
      } catch (err) {
        logger.warn('⚠️ Không thể kiểm tra SQL Server:', err.message);
      }
    }

    if (typeof serverModule.getDataHealthSnapshot === 'function') {
      try {
        const snapshot = await serverModule.getDataHealthSnapshot({
          backupHealth: {
            ignoreIssueCodes: IGNORED_BACKUP_ISSUE_CODES,
          },
        });

        if (snapshot?.storage) {
          const { backup, disk, database, health } = snapshot.storage;
          const issueCodes = collectIssueCodes(health?.issues);

          if (env.KPI_DISABLE_CRON === '1') {
            logger.log('ℹ️ Healthcheck local bỏ qua cảnh báo lịch sao lưu tự động vì KPI_DISABLE_CRON=1.');
          }

          if (health?.issues?.length) {
            logger.warn(`⚠️ Cảnh báo storage (${health.severity || 'unknown'}):`);
            for (const issue of health.issues) {
              const description = typeof issue === 'string' ? issue : issue?.message || issue?.code || 'Không rõ';
              logger.warn(`   • ${description}`);
            }
            if (issueCodes.has('backup_missing')) {
              logger.log(`ℹ️ Gợi ý: chạy "${BACKUP_REMEDIATION_COMMAND}" để tạo bản sao lưu baseline trên local.`);
            }
          } else {
            logger.log('✅ Dung lượng lưu trữ ổn định.');
          }

          if (backup) {
            const latest = backup.recent?.[0];
            if (latest) {
              const status = latest?.meta?.status || latest?.result || 'không rõ';
              logger.log(`   • Sao lưu gần nhất: ${latest?.ts || 'chưa có'} (${status})`);
            }
          }

          if (database) {
            logger.log(`   • SQLite dung lượng hiện tại: ${database?.sizeLabel || database?.sizeBytes || 'không rõ'}`);
            if (database.sqliteStats) {
              const freePages = database.sqliteStats.freelistCount ?? 0;
              logger.log(`   • Trang dữ liệu: ${database.sqliteStats.pageCount ?? 'không rõ'} (trống ${freePages})`);
            }
          }

          if (disk) {
            const usedPercent = typeof disk?.usedPercent === 'number' ? disk.usedPercent.toFixed(1) : 'không rõ';
            logger.log(`   • Ổ đĩa: ${disk?.usedLabel || ''} / ${disk?.totalLabel || ''} (${usedPercent}% đã dùng)`);
            if (disk?.error) {
              logger.warn(`   • Không thể thống kê đầy đủ dung lượng ổ đĩa: ${disk.error}`);
            }
          }
        }

        if (snapshot?.sqlServer?.health && snapshot.sqlServer.health.ok === false) {
          logger.warn('⚠️ SQL Server cảnh báo:', snapshot.sqlServer.health.message || snapshot.sqlServer.health.state);
        }
      } catch (err) {
        logger.warn('⚠️ Không thể lấy báo cáo sức khỏe dữ liệu:', err.message);
      }
    }

    const elapsed = Date.now() - startAt;
    logger.log(`Hoàn tất health check sau ${Math.round(elapsed)}ms.`);
    return 0;
  } catch (err) {
    logger.error('Không thể tải backend để kiểm tra:', err.message);
    return 1;
  }
}
