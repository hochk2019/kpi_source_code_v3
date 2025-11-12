# Kế hoạch tái cấu trúc tab "Báo cáo KPI"

Tài liệu này kết hợp ba đề xuất cải tiến giao diện đã thống nhất và bổ sung các yêu cầu loại bỏ/di chuyển chức năng để đảm bảo khu vực tab "Báo cáo KPI" gọn gàng, hiện đại và dễ mở rộng. Mỗi nhiệm vụ được chia nhỏ dưới dạng checklist để đội ngũ có thể lần lượt đánh dấu khi hoàn thành.

## 1. Chuẩn hoá thanh điều khiển đầu trang

### Mục tiêu
- Tách riêng vùng lọc nhanh và cấu hình bối cảnh (template, bộ quy tắc) để người dùng tìm thấy điều khiển quan trọng ngay lập tức.
- Loại bỏ nút **Reload** khỏi giao diện; thay vào đó, dữ liệu được làm tươi tự động sau khi điều chỉnh bộ lọc hoặc qua các hành động khác.

### Nhiệm vụ
- [x] Tách JSX trong `src/components/ReportViewer.jsx` (đoạn hiện xử lý thanh điều khiển) thành hai component độc lập: `ReportFilterBar` và `ReportContextToolbar`.
  - [x] Xác định chính xác block JSX hiện chịu trách nhiệm cho thanh điều khiển (đoạn ~dòng 8321-8603) và ghi chú phụ thuộc state/props.
  - [x] Tạo hai file component mới dưới `src/components/report-viewer/` (hoặc thư mục phù hợp) và chuyển JSX tương ứng sang từng file.
  - [x] Cập nhật import trong `ReportViewer.jsx`, đảm bảo props/state được truyền đúng và không xuất hiện circular import.
- [x] Bố trí `ReportFilterBar` chỉ gồm bộ lọc thời gian, nút xuất/in (nếu vẫn cần) và trạng thái tổng quan; bỏ hẳn nút reload.
  - [x] Loại bỏ callback/nút `onReload` khỏi component và kiểm tra các hook `useEffect` để đảm bảo dữ liệu tự reload.
  - [x] Hiển thị một nhãn tóm tắt trạng thái bộ lọc (ví dụ: "Kỳ: 01/2024 - 03/2024") trong thanh này.
- [x] Gom lựa chọn template và bộ quy tắc KPI vào `ReportContextToolbar`, bổ sung nhãn mô tả rõ ràng và gộp các hành động phụ (lưu/cập nhật/xoá) vào menu phụ.
  - [x] Dùng `Dropdown`/`Menu` từ design system để gom các hành động phụ thay vì hiển thị toàn bộ nút.
  - [x] Bảo toàn luồng gọi API hiện có (create/update/delete template) thông qua menu mới.
- [x] Hiển thị tình trạng “Đang áp dụng: Template A / Bộ quy tắc B” trong header để người dùng nắm bối cảnh.
  - [x] Viết helper định dạng tên template/bộ quy tắc và xử lý fallback khi thiếu dữ liệu.
- [x] Chuẩn hoá style (flex row, spacing, typography) để tạo cảm giác hiện đại, đồng bộ với design system.
  - [x] Áp dụng token spacing và typography từ `components.json` (nếu có); kiểm tra giao diện ở độ rộng 1280px và 1440px. _(Chuẩn hoá bằng Select/Input/Badge của design system, rà soát layout responsive theo breakpoint 1280px & 1440px trong môi trường phát triển.)_
  - [x] Chạy lại snapshot test (nếu tồn tại) cho khu vực header sau khi refactor. _(Không có snapshot liên quan; xác nhận bằng bộ kiểm thử vitest hiện có.)_

## 2. Tổ chức lại khu vực nội dung tổng quan

### Mục tiêu
- Gom các widget thống kê nhanh, biểu đồ và thành phần liên quan thành một nhóm tổng quan rõ ràng.
- Di chuyển/hoà nhập khu vực **Top 10 công ty theo tờ khai** vào vùng tổng quan phù hợp để tránh rải rác.
- Loại bỏ hoàn toàn khối **Lập lịch gửi báo cáo KPI** khỏi tab.
- Tái cấu trúc khu vực **Điểm KPI +/- bổ sung** thành hai tầng: **Tổng quan** (hiển thị mặc định) và **Chi tiết** (mở khi cần).

### Nhiệm vụ
- [x] Tạo container `KpiOverviewSection` bao gồm các component số liệu: `SummaryCard`, `TeamPieWidget`, `TopCompanyLeaderboard`, `TopStaffWidget`, biểu đồ Top 10 công ty theo tờ khai và các widget tổng quan khác.
  - [x] Kiểm kê đầy đủ các component tổng quan hiện có trong `ReportViewer.jsx` để tránh bỏ sót.
  - [x] Bọc toàn bộ vào một component cha với heading "Tổng quan KPI" và mô tả ngắn.
- [x] Thiết lập layout 2 cột (ví dụ 8/4 hoặc grid responsive) để đảm bảo sự cân bằng giữa số liệu và biểu đồ.
  - [x] Sử dụng CSS grid hoặc `Stack`/`Grid` từ design system, kiểm tra responsive ở breakpoint tablet (≥1024px) và mobile.
- [x] Di chuyển khối **Top 10 công ty theo tờ khai** vào `KpiOverviewSection`.
  - [x] Kết nối dữ liệu Top 10 với phần còn lại để chia sẻ bộ lọc chung.
  - [x] Đảm bảo tiêu đề/thuyết minh đồng bộ với các widget khác.
- [x] Xoá hoặc ngăn render hoàn toàn khối `ReportAutomationPanel` / `Lập lịch gửi báo cáo KPI` khỏi `ReportViewer`.
  - [x] Xoá component cũ và các import/state liên quan.
  - [x] Đảm bảo không còn route/API nào phụ thuộc khối automation trong tab này; nếu cần, chuyển sang trang cấu hình khác.
- [x] Tách logic của khu vực **Điểm KPI +/- bổ sung** thành component riêng có hai chế độ: `overview` (cards gọn, KPI chính) và `detail` (bảng/phân tích chuyên sâu); đặt `overview` làm mặc định.
  - [x] Tạo component `KpiAdjustmentPanel` với state điều khiển chế độ.
  - [x] Thiết lập lazy load cho phần `detail` nếu dữ liệu lớn.
- [x] Thiết kế lại `KpiOverviewSection` để gắn khối **Điểm KPI +/- bổ sung** ở dạng tab phụ (Overview/Detail) hoặc accordion, đảm bảo không chiếm quá nhiều chiều cao khi mới mở trang.
  - [x] Kiểm tra accessibility cho cơ chế chuyển tab/accordion.
  - [x] Cập nhật documentation nội bộ hướng dẫn sử dụng component mới.
- [x] Bổ sung tiêu đề phụ và mô tả ngắn cho từng nhóm trong `KpiOverviewSection` để người dùng hiểu nhanh nội dung.
  - [x] Viết copy súc tích cho từng nhóm (ví dụ "Hiệu suất chung", "Điều chỉnh KPI").
  - [x] Đảm bảo localization (vi/english) vẫn hoạt động nếu dự án hỗ trợ đa ngôn ngữ.

## 3. Thiết kế lại khu vực báo cáo theo tổ đội & cá nhân dạng Tab

### Mục tiêu
- Chuyển phần chuyển đổi phạm vi `staff/team` hiện tại thành hệ thống tab hai tầng thân thiện.
- Giảm trùng lặp giữa logic bảng của nhân viên và tổ đội bằng cách tái sử dụng component chung.
- Gom các bộ lọc nâng cao, lựa chọn cột vào panel phụ để phần đầu tab gọn gàng.

### Nhiệm vụ
- [x] Thay state toggle `scope` bằng tab cha “Nhân viên” / “Tổ đội”, sử dụng component tab của design system (hoặc tự xây dựng) bảo đảm accessibility.
  - [x] Rà soát state/logic hiện dùng cho `scope` và chuẩn hoá lại thành `activeScopeTab`.
  - [x] Áp dụng keyboard navigation (ArrowLeft/ArrowRight) nếu tự triển khai tab. _(Sử dụng Tabs của design system với hỗ trợ bàn phím mặc định.)_
- [x] Bên trong mỗi tab cha, tạo hai tab con “Tổng quan” (bảng rút gọn + chỉ số chính) và “Chi tiết” (card theo cá nhân/tổ, biểu đồ chuyên sâu), hiển thị “Tổng quan” mặc định. _Đã tái sử dụng dữ liệu hiện có để không phát sinh thêm API._
  - [x] Xác định dữ liệu cần thiết cho từng tab con và tối ưu hoá gọi API (prefetch khi người dùng hover tab?). _Tổng quan và chi tiết cùng chia sẻ dataset lọc, không cần thêm request._
  - [x] Thiết kế layout riêng cho mobile (stack) vs desktop (song song). _Flex/grid hiện hỗ trợ wrap trên mobile và giữ hàng ngang trên desktop._
- [x] Trích xuất phần bảng + phân trang chung từ `renderStaffSection`/`renderTeamSection` thành component `ReportEntityTable` tái sử dụng.
  - [x] Định nghĩa props chung (`columns`, `rows`, `pagination`, `onSort`) và viết test đơn vị cho component mới.
  - [x] Cập nhật cả hai khu vực nhân viên/tổ đội sử dụng component này để tránh lặp code.
- [ ] Di chuyển phần cấu hình hiển thị cột (`COLUMN_VISIBILITY_OPTIONS`) vào popover hoặc slide-over bên phải, tránh chiếm không gian trong thanh tab.
  - [ ] Chọn component overlay phù hợp (popover/drawer) và đảm bảo đóng mở qua keyboard.
  - [ ] Lưu trạng thái lựa chọn cột vào store (nếu cần) để tái sử dụng giữa các tab.
- [ ] Đảm bảo các component chi tiết (ví dụ `StaffDetailCard`, `TeamDetailCard`) nhận dữ liệu từ nguồn chung và hỗ trợ lazy loading khi người dùng mở tab “Chi tiết”.
  - [ ] Thêm skeleton/loading indicator khi dữ liệu detail đang tải.
  - [ ] Kiểm tra ảnh hưởng tới performance khi số lượng nhân viên lớn.
- [ ] Bổ sung breadcrumbs nhỏ hoặc nhãn tiêu đề trong từng tab để người dùng biết mình đang ở tầng nào.
  - [ ] Hiển thị đường dẫn ví dụ "Báo cáo KPI › Nhân viên › Chi tiết" ngay dưới tiêu đề tab.
  - [ ] Đảm bảo breadcrumbs ẩn bớt trên mobile để không chiếm chỗ.

## 4. Theo dõi tiến độ
- Cập nhật trạng thái checklist trên mỗi nhiệm vụ khi hoàn thành.
- Ghi chú thêm ngày/thành viên hoàn thành ngay bên cạnh hộp kiểm nếu cần.
- Khi toàn bộ checklist được đánh dấu, bổ sung mục **Tổng kết** tóm lược cải tiến và kết quả đo lường (nếu có).

### Kiểm thử bắt buộc sau từng mốc
- [x] `pnpm lint`
- [x] `pnpm exec vitest run --config vitest.frontend.config.mjs tests/reports.test.js`
- [ ] Thực hiện kiểm thử thủ công luồng lọc thời gian và chuyển tab trong môi trường staging.
- [ ] Ghi nhận ảnh chụp màn hình (before/after) cho khu vực header, tổng quan và tab Nhân viên/Tổ đội.

