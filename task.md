# Task Tracker

## Active Slice

- Title: Bổ sung test cho cảnh báo disk error trong healthcheck
- Bead: `cng-bik`
- Status: completed
- Last updated: 2026-03-24
- Current implementation status:
  - `cng-mtn` completed
  - `cng-ldq` completed
  - `cng-m2m` completed
  - `cng-ejz` completed
  - `cng-9qb` completed
  - `cng-qgx` completed
  - `cng-uep` completed
  - `cng-5bs` completed
  - `cng-50t` completed
  - `cng-1g7` completed
  - `cng-p0o` completed
  - `cng-bik` completed

## Goal

- Khóa nhánh warning khi `snapshot.storage.disk.error` xuất hiện trong `healthcheck-core`.
- Đảm bảo runner vẫn trả `0` nhưng in warning thống kê dung lượng đúng format.
- Giữ runtime behavior hiện tại của healthcheck local không đổi.

## Current Scope

1. Mở rộng snapshot test để mô phỏng lỗi thống kê dung lượng ổ đĩa.
2. Không thay đổi runtime behavior của `healthcheck-core`, chỉ tăng coverage.
3. Verify lại CLI thật để chắc rằng coverage mới không kéo theo regression ngoài ý muốn.

## Completion Criteria

- Có test cho:
  - `snapshot.storage.disk.error`
  - warning `Không thể thống kê đầy đủ dung lượng ổ đĩa`
- `node scripts/healthcheck.mjs` vẫn pass trên local DB thật sau khi thêm coverage.

## Notes

- Bead hiện tại: `cng-bik`
- Root cause:
  - sau `cng-p0o`, suite đã khóa phần lớn nhánh lỗi/warning chính nhưng vẫn thiếu một warning output hữu ích:
    - `disk.error` trong snapshot storage
  - nhánh này không làm healthcheck fail, nên nếu không có test riêng thì rất dễ bị thay đổi format hoặc biến mất mà không ai để ý
- Fix đã áp dụng:
  - thêm 1 regression test cho nhánh `disk.error`
  - assert đồng thời warning line và disk summary line
  - không cần thay đổi thêm code runtime
- Verify:
  - `pnpm exec vitest run tests/healthcheckCore.test.js tests/runBackupCore.test.js tests/server.backup.test.js`
  - `node scripts/healthcheck.mjs`
