# Findings & Decisions

## Final Findings

### 1. Lớp điều hướng bên trái đang hiển thị bất thường và gây nhiễu thị giác

- Từ bằng chứng trực quan, tôi quan sát thấy sidebar/domain navigation ở mé trái bị chồng lớp và nhìn như có một lớp chữ/tab "ma" đè lên card `KPI Control Center`.
- Hiện tượng này xuất hiện lặp lại ở cả desktop lẫn mobile, không phải lỗi đơn lẻ của một màn hình.
- Tác động: giảm độ rõ ràng của navigation, tạo cảm giác UI vỡ layout hoặc render hai lớp cùng lúc.

### 2. Trải nghiệm mobile chưa được co lại theo mobile-first

- Trên mobile, header và navigation vẫn giữ cấu trúc desktop thu nhỏ, thay vì chuyển sang drawer/toggle gọn.
- Kết quả là chữ rất nhỏ, nhiều khối thông tin bị nén dọc, và thao tác chọn tab khó quét nhanh.
- Tác động: app vẫn dùng được, nhưng mức đọc hiểu và điều hướng trên điện thoại kém rõ rệt.

### 3. Màn hình `Báo cáo KPI` có mật độ thông tin quá dày

- Ở desktop, màn hình report kéo rất dài, nhiều card/chart/filter xếp dày trong một cột dài.
- Ở mobile, bố cục vẫn mang tư duy desktop nên chart/filter/summary bị nén mạnh, độ đọc giảm rõ.
- Tác động: người dùng khó hình thành mental model nhanh, đặc biệt khi cần quét số liệu hoặc đối chiếu nhiều khối cùng lúc.

### 4. Điều hướng tuần tự sang `Báo cáo KPI` có dấu hiệu bất thường

- Audit tuần tự qua nhiều tab cho thấy cả desktop và mobile đều bị treo khi chuyển sang `Báo cáo KPI` sau chuỗi Import -> Accounts -> Teams -> HQ -> Reports.
- Trong khi đó, khi mở `Báo cáo KPI` trực tiếp từ trạng thái mới, màn hình vẫn render được bình thường.
- Tác động: có khả năng tồn tại vấn đề state transition, render accumulation, hoặc navigation shell bị kẹt sau nhiều lần chuyển module.

### 5. Workflow chrome đang lấn át vùng làm việc chính ở vài màn hình

- Ở Tài khoản, Tổ đội và Đại Lý HQ, phần `Operator workflow` và phần hero/context chiếm nhiều chiều cao trước khi người dùng chạm tới nội dung thao tác chính.
- Tác động: tăng scroll cost và làm hành động chính bị đẩy xuống dưới, nhất là trên mobile.

## Final Decisions

- Ưu tiên sửa lớp điều hướng bên trái và chiến lược responsive navigation trước, vì đây là vấn đề nhìn thấy ngay trên hầu hết màn hình.
- Điều tra riêng bug chuyển tab sang `Báo cáo KPI` sau chuỗi điều hướng dài; đây có thể là lỗi state shell hơn là lỗi của bản thân report screen.
- Nếu tiếp tục tối ưu UX, nên giảm chiều cao của hero/workflow chrome ở các module thao tác thường xuyên.

## Remediation Mapping

- Finding 1: sidebar ghosting / visual overlap
  - Bead: `cng-mtn.1`
- Finding 2: mobile shell still behaves like a shrunk desktop
  - Bead: `cng-mtn.2`
- Finding 3: report surface is too dense and hard to scan
  - Bead: `cng-mtn.4`
- Finding 4: sequential navigation into `Báo cáo KPI` hangs
  - Bead: `cng-mtn.3`
- Finding 5: workflow chrome pushes primary actions too far down
  - Bead: `cng-mtn.2`
- Cross-cutting investigation for possible data/read-model cost inside report rendering
  - Bead: `cng-mtn.5`
- Regression protection after fixes
  - Bead: `cng-mtn.6`

## Design Constraints For The Fixes

- Keep the shell mobile-first instead of shrinking the desktop layout.
- Preserve clear keyboard order and visible focus states while changing navigation.
- Reduce shell chrome before adding more visual polish; information access comes first.
- Treat the report surface as a data-dense dashboard, but use stronger hierarchy and progressive disclosure on narrow screens.

## Implementation Findings: `cng-mtn.1`

### Root Cause

- Sidebar ghosting không xuất phát từ một CSS override lẻ trong `App.css`.
- Gốc vấn đề là shell navigation đang reuse `TabsTrigger`/`TabsList` với bộ utility classes mặc định dành cho compact tabs.
- Khi shell lại áp thêm class `.ds-app-shell__nav-trigger` để biến tab thành stacked card nhiều dòng, hai mô hình styling này xung đột:
  - shell muốn `height: auto`, `padding` lớn, caption xuống dòng
  - primitive mặc định giữ `inline-flex`, `px-2`, `py-1`, `h-[calc(100%-1px)]`, `whitespace-nowrap`
- Kết quả là tab thực tế bị ép xuống khoảng 29px trong bundle cũ và các item chồng lên nhau.

### Fix Chosen

- Thêm escape hatch `unstyled` vào `TabsList` và `TabsTrigger`.
- `AppShellFrame` dùng `unstyled` cho sidebar navigation để shell chỉ render class chuyên biệt của chính nó.
- Cách này sạch hơn việc tăng specificity hoặc chồng thêm override ở `App.css`, vì nó giải quyết xung đột ngay tại primitive boundary.

### Verification Notes

- Khi verify bằng Playwright trong repo này, cần nhớ config đang chạy `vite preview`, tức là dùng `dist`.
- Nếu source đã đổi mà chưa `pnpm build`, kết quả UI có thể phản ánh bundle cũ và dẫn tới chẩn đoán sai.
- Sau khi rebuild, desktop và mobile sidebar đều không còn overlap.
