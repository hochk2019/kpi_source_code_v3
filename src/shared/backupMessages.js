export const BACKUP_REASON_LABELS = Object.freeze({
  cron_disabled_env: 'Cron tự động đang bị tắt bởi KPI_DISABLE_CRON.',
  cron_disabled_config: "Biểu thức cron chưa được cấu hình hoặc đang để 'never'.",
  memory_db: 'CSDL đang chạy ở chế độ bộ nhớ (:memory:) nên không thể thiết lập lịch tự động.',
  memory_backup_dir: 'Thư mục sao lưu hiện đang là :memory:, cần chỉnh lại đường dẫn.',
  invalid_cron_expression: 'Biểu thức cron sao lưu không hợp lệ.',
  schedule_error: 'Không thể khởi tạo lịch sao lưu tự động, vui lòng kiểm tra log máy chủ.',
});

export const BACKUP_FAILURE_LABELS = Object.freeze({
  memory_db: 'Không thể sao lưu vì CSDL đang chạy ở chế độ bộ nhớ.',
  invalid_backup_dir: 'Thư mục đích sao lưu không hợp lệ.',
  in_progress: 'Đang có phiên sao lưu khác diễn ra.',
  missing_source: 'Không tìm thấy file CSDL nguồn để sao lưu.',
  error: 'Lỗi hệ thống khi thực hiện sao lưu.',
});

export function translateBackupReason(code) {
  if (!code) return '';
  return BACKUP_REASON_LABELS[code] || code;
}

export function translateBackupFailure(code) {
  if (!code) return '';
  return BACKUP_FAILURE_LABELS[code] || code;
}
