# Checklist QA giao diện cuối sprint

Tài liệu này chốt bộ kiểm tra tối thiểu trước khi đóng một đợt thay đổi UI, đặc biệt với shell runtime, lazy tabs, importer, reporting và các màn hình vận hành nhiều người dùng.

## Khi nào dùng

- Trước khi đóng một cụm slice giao diện.
- Trước khi merge các thay đổi shell/runtime có nguy cơ ảnh hưởng navigation, loading hoặc error boundary.
- Khi cần ghi lại bằng chứng chạy thử vào [ui-verification-log.md](/C:/Users/PC/.codex/worktrees/7720/kpi_source_code_v4/docs/operations/ui-verification-log.md).

## Chuẩn bị

- Đồng bộ nhánh làm việc và xác nhận không có migration/runtime change chưa verify.
- Chạy app bằng môi trường gần với staging nhất có thể.
- Chuẩn bị tài khoản quản trị bootstrap và ít nhất một tài khoản nghiệp vụ thông thường.
- Mở sẵn nơi lưu ảnh chụp/mô tả lỗi ngoài repo nếu cần đính kèm bằng chứng.

## Lệnh verify tối thiểu

| Nhóm | Lệnh | Kỳ vọng |
| --- | --- | --- |
| Build shell | `pnpm build` | build thành công |
| Browser runtime regression | `npx playwright test tests/playwright/lazy-tab-shell.spec.js --reporter=line` | pass toàn bộ |
| Lazy tab unit regression | `pnpm exec vitest run tests/kpiCalculator.lazyTabs.test.jsx tests/kpiCalculator.errorBoundary.test.jsx --environment jsdom` | pass toàn bộ |
| Diff hygiene | `git diff --check -- docs/operations/ui-sprint-qa-checklist.md docs/operations/ui-verification-log.md docs/ux-improvement-backlog.md docs/open-backlog.md task.md` | không có output |

## Checklist manual

### 1. Shell bootstrap và điều hướng

- [ ] Đăng nhập bằng tài khoản quản trị và xác nhận shell render đầy đủ, không nháy layout bất thường.
- [ ] Chuyển ít nhất qua các tab `dashboard`, `adjustments`, `reports`, `audit` và xác nhận focus không bị rơi mất.
- [ ] Khi tab lazy-load, vùng `role="status"` phải hiển thị thông điệp tải phù hợp rồi tự biến mất sau khi hoàn tất.

### 2. Error boundary và fallback

- [ ] Kiểm tra ít nhất một đường đi có runtime fallback hoặc network failure để chắc `RuntimeErrorBoundary` vẫn hiển thị thông điệp rõ ràng.
- [ ] Nút retry hoặc đường quay lại màn hình an toàn phải còn hoạt động.

### 3. Reporting và audit

- [ ] Từ report workflow, mở audit/export history và xác nhận không có crash khi dữ liệu thiếu trường optional.
- [ ] Các số liệu tóm tắt phải hiển thị được ngay cả khi payload có field rỗng hoặc thiếu.

### 4. Data importer và sync workflow

- [ ] Mở preview importer, chạy ít nhất một thao tác lọc và xác nhận UI không bị block dài bất thường.
- [ ] Nếu có toast lỗi hoặc warning, nội dung phải dễ hiểu và bằng tiếng Việt nhất quán.

### 5. Accessibility smoke

- [ ] Dùng bàn phím để di chuyển qua các nút/tab chính, không có bẫy focus.
- [ ] Kiểm tra các nút hành động trọng yếu có tên truy cập được (`aria-label` hoặc text rõ nghĩa).
- [ ] Đảm bảo trạng thái loading/error được screen reader announce qua `role="status"` hoặc `role="alert"` khi phù hợp.

## Ghi nhận kết quả

Sau khi hoàn tất:

1. Ghi ngày chạy, người chạy, phạm vi kiểm tra và kết quả vào [ui-verification-log.md](/C:/Users/PC/.codex/worktrees/7720/kpi_source_code_v4/docs/operations/ui-verification-log.md).
2. Nếu có lỗi chưa sửa ngay, tạo bead/backlog item tương ứng thay vì để TODO trôi nổi.
3. Nếu pass toàn bộ, cập nhật backlog/slice tracker để xác nhận sprint QA artifact đã sẵn sàng cho lần sau.
