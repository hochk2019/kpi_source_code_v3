# Task Plan

## Active Bead

- `cng-bik` - Bổ sung test cho cảnh báo disk error trong healthcheck

## Execution Plan

1. Bổ sung coverage cho nhánh `disk.error`
   - Intent: khóa behavior khi snapshot storage có lỗi thống kê dung lượng ổ đĩa.
   - Status: completed
   - Outcome: test mới xác nhận warning `Không thể thống kê đầy đủ dung lượng ổ đĩa` và disk summary line.
2. Verify runtime không đổi
   - Intent: chắc rằng việc tăng coverage không kéo theo side effect ngoài ý muốn.
   - Status: completed
   - Outcome: `node scripts/healthcheck.mjs` vẫn pass trên local DB thật.

## Verification Targets

- `tests/healthcheckCore.test.js` cover thêm nhánh `disk.error` và tăng lên 13 case.
- `tests/runBackupCore.test.js` và `tests/server.backup.test.js` vẫn pass để chứng minh không có regression lân cận.
- `node scripts/healthcheck.mjs` vẫn pass trên local DB thật.

## Decisions

- Không sửa runtime code; bead này chỉ mở rộng snapshot test.
- Với warning output kiểu informational/non-fatal, test phải khóa cả message warning lẫn summary line đi kèm để tránh regression format.
- Tiếp tục dùng fake `serverModule`/`serverModuleLoader` để giữ test nhanh và tách biệt khỏi DB thật.
