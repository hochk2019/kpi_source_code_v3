# Task Plan

## Active Bead

- `cng-mtn` - Remediation backlog for app shell and report UX audit

## Execution Plan

1. Shell foundation
   - Bead: `cng-mtn.1`
   - Intent: sửa sidebar ghosting và làm sạch navigation states trước khi đổi layout lớn hơn.
   - Status: completed
   - Outcome: shell tabs đã bỏ default tab utility classes, sidebar không còn overlap ở desktop/mobile, và regression tests đã được thêm.
2. Responsive shell
   - Bead: `cng-mtn.2`
   - Intent: bỏ mô hình desktop-thu-nho-tren-mobile, nén hero/workflow chrome, và ưu tiên vùng thao tác chính.
   - Status: next
3. Report navigation bug
   - Bead: `cng-mtn.3`
   - Intent: ổn định luồng chuyển tuần tự vào `reports`, tập trung vào tab state, focus routing, và render timing.
4. Report information architecture
   - Bead: `cng-mtn.4`
   - Intent: tái cấu trúc bề mặt report để giảm density và cải thiện khả năng quét ở desktop/mobile.
5. Conditional data/backend investigation
   - Bead: `cng-mtn.5`
   - Intent: profile read-model và aggregation cost của report trước khi quyết định có mở rộng sang backend/database hay không.
6. Regression guardrails
   - Bead: `cng-mtn.6`
   - Intent: khóa fix bằng Playwright coverage cho report navigation và mobile shell behavior.

## Verification Targets

- `cng-mtn.1`: xác nhận lại shell sidebar ở desktop/mobile bằng Playwright trên build hiện tại, đồng thời khóa `unstyled` behavior bằng unit test.
- `cng-mtn.2`: kiểm tra viewport 375px, 768px, 1024px, 1440px và khả năng thao tác thật.
- `cng-mtn.3`: flow tuần tự Import -> Accounts -> Teams -> HQ -> Reports pass ổn định.
- `cng-mtn.4`: report surface có hierarchy rõ và mobile không còn bị nén như desktop co nhỏ.
- `cng-mtn.5`: có kết quả profiling rõ ràng cho report data pipeline.
- `cng-mtn.6`: Playwright suite có guardrails ổn định cho các fix UX chính.

## Decisions

- Sửa shell foundation trước khi đụng sâu vào report surface để giảm rủi ro side effect.
- Không giả định ngay lỗi nằm ở backend/database; chỉ mở rộng khi profiling có bằng chứng.
- Giữ E2E guardrails như deliverable cuối của epic để tránh tái phát regression.
