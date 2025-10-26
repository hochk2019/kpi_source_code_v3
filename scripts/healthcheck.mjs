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

  if (typeof serverModule.getDataHealthSnapshot === 'function') {
    try {
      const snapshot = await serverModule.getDataHealthSnapshot();
      if (snapshot?.storage) {
        const { backup, disk, database, health } = snapshot.storage;
        if (health?.issues?.length) {
          console.warn(`⚠️ Cảnh báo storage (${health.severity || 'unknown'}):`);
          for (const issue of health.issues) {
            const description = typeof issue === 'string' ? issue : issue?.message || issue?.code || 'Không rõ';
            console.warn(`   • ${description}`);
          }
        } else {
          console.log('✅ Dung lượng lưu trữ ổn định.');
        }
        if (backup) {
          const latest = backup.recent?.[0];
          if (latest) {
            const status = latest?.meta?.status || latest?.result || 'không rõ';
            console.log(`   • Sao lưu gần nhất: ${latest?.ts || 'chưa có'} (${status})`);
          }
        }
        if (database) {
          console.log(`   • SQLite dung lượng hiện tại: ${database?.sizeLabel || database?.sizeBytes || 'không rõ'}`);
          if (database.sqliteStats) {
            const freePages = database.sqliteStats.freelistCount ?? 0;
            console.log(
              `   • Trang dữ liệu: ${database.sqliteStats.pageCount ?? 'không rõ'} (trống ${freePages})`
            );
          }
        }
        if (disk) {
          const usedPercent = typeof disk?.usedPercent === 'number' ? disk.usedPercent.toFixed(1) : 'không rõ';
          console.log(`   • Ổ đĩa: ${disk?.usedLabel || ''} / ${disk?.totalLabel || ''} (${usedPercent}% đã dùng)`);
          if (disk?.error) {
            console.warn(`   • Không thể thống kê đầy đủ dung lượng ổ đĩa: ${disk.error}`);
          }
        }
      }
      if (snapshot?.sqlServer?.health && snapshot.sqlServer.health.ok === false) {
        console.warn('⚠️ SQL Server cảnh báo:', snapshot.sqlServer.health.message || snapshot.sqlServer.health.state);
      }
    } catch (err) {
      console.warn('⚠️ Không thể lấy báo cáo sức khỏe dữ liệu:', err.message);
    }
  }

  const elapsed = Date.now() - startAt;
  console.log(`Hoàn tất health check sau ${Math.round(elapsed)}ms.`);
  process.exit(0);
} catch (err) {
  console.error('Không thể tải backend để kiểm tra:', err.message);
  process.exit(1);
}
