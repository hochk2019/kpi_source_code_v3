#!/usr/bin/env node
import process from 'node:process';

const startAt = Date.now();
process.env.KPI_SKIP_LISTEN = '1';
process.env.KPI_DISABLE_CRON = '1';

console.log('🔍 Đang chạy health check backend...');

try {
  const serverModule = await import('../server/index.js');
  const { DB_FILE, getDatabaseHandle, checkSqlServerHealth, getDatabaseInitState } = serverModule;
  const db = typeof serverModule.getDatabaseHandle === 'function'
    ? serverModule.getDatabaseHandle()
    : getDatabaseHandle?.();
  if (!db) {
    console.error('Không thể lấy kết nối SQLite.');
    process.exit(1);
  }

  try {
    db.prepare('SELECT 1').get();
    console.log(`✅ SQLite sẵn sàng (${DB_FILE || 'in-memory'})`);
    if (typeof getDatabaseInitState === 'function') {
      const initInfo = getDatabaseInitState();
      if (initInfo?.seeded) {
        console.warn(
          `⚠️ Cảnh báo: SQLite vừa được seed lại với ${initInfo.insertedEntries} khóa mặc định. Hãy kiểm tra và khôi phục sao lưu nếu cần.`
        );
      } else if (initInfo?.missingInserted) {
        console.log(
          `ℹ️ SQLite đã bổ sung ${initInfo.missingInserted} khóa mặc định còn thiếu trong lần khởi động này.`
        );
      }
    }
  } catch (err) {
    console.error('❌ Không thể truy vấn SQLite:', err.message);
    process.exit(1);
  }

  if (typeof checkSqlServerHealth === 'function') {
    try {
      const sqlStatus = await checkSqlServerHealth();
      if (sqlStatus.ok) {
        console.log('✅ SQL Server: sẵn sàng hoặc chưa cấu hình (không bắt buộc khi chạy nội bộ).');
      } else if (sqlStatus.state === 'not_configured') {
        console.warn('ℹ️ SQL Server chưa cấu hình — bỏ qua kiểm tra này.');
      } else {
        console.warn('⚠️ Không thể kết nối SQL Server:', sqlStatus.message || sqlStatus.state);
      }
    } catch (err) {
      console.warn('⚠️ Không thể kiểm tra SQL Server:', err.message);
    }
  }

  const elapsed = Date.now() - startAt;
  console.log(`Hoàn tất health check sau ${Math.round(elapsed)}ms.`);
  process.exit(0);
} catch (err) {
  console.error('Không thể tải backend để kiểm tra:', err.message);
  process.exit(1);
}
