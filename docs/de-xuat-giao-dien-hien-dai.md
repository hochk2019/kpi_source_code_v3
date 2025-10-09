# Đề xuất cải tiến giao diện và tính năng nâng cao

## 1. Hiện đại hóa giao diện người dùng
- Áp dụng hệ thống thiết kế thống nhất (Design System) với bộ quy tắc về màu sắc, typography, spacing và thành phần UI để đảm bảo trải nghiệm liền mạch trên toàn ứng dụng.
- Sử dụng layout dạng lưới responsive, tự động co giãn theo kích thước màn hình (desktop, laptop, tablet) nhằm tránh scroll ngang và tối ưu không gian trống.
- Chuẩn hóa các thẻ KPI dưới dạng "card" có tiêu đề, icon ngữ nghĩa và trendline mini giúp người dùng nắm bắt nhanh biến động.
- Tích hợp cơ chế theme động (Light/Dark/High Contrast). Theme được cấu hình trong store trung tâm và cho phép đồng bộ với tùy chọn hệ điều hành của người dùng.
- Tăng cường khả năng truy cập (Accessibility): bổ sung mô tả aria-label, bảo đảm độ tương phản màu đạt tiêu chuẩn WCAG 2.1 AA, hỗ trợ điều hướng bằng bàn phím.

## 2. Gom nhóm và tái cấu trúc chức năng
- Thiết kế lại trang Báo cáo KPI theo dạng dashboard mô-đun: cụm biểu đồ chiến lược (overview), cụm phân tích chi tiết (chi tiết tổ đội/nhân viên) và cụm hành động (xuất báo cáo, chia sẻ).
- Gom các thao tác quản trị dữ liệu (import, đồng bộ ECUS, làm sạch dữ liệu) vào một khu vực "Trung tâm điều phối dữ liệu" với wizard từng bước để giảm sai sót.
- Bổ sung sidebar điều hướng nhanh theo vai trò (lãnh đạo, nhân viên, admin) giúp lọc chức năng phù hợp, tránh quá tải trên cùng một trang.

## 3. Tích hợp chức năng bật/tắt giao diện Light/Dark
- Thêm nút chuyển trạng thái theme trong header hoặc menu người dùng, hiển thị biểu tượng mặt trời/mặt trăng trực quan.
- Lưu trạng thái theme vào hồ sơ tài khoản trên backend (nếu đăng nhập) và đồng bộ xuống localStorage để giữ nhất quán giữa các thiết bị.
- Cập nhật component chart/table để sử dụng token màu trung tính, đảm bảo đọc tốt ở cả hai theme.

## 4. Mở rộng khả năng cá nhân hóa và hiệu suất
- Cho phép người dùng tạo "bộ lọc yêu thích" và ghim chúng trên dashboard; các bộ lọc này có thể được chia sẻ giữa các thành viên cùng tổ đội.
- Bổ sung trang tổng quan "Sức khỏe dữ liệu" hiển thị số lượng tờ khai trùng, tờ khai thiếu thông tin, tình trạng đồng bộ ECUS để đội vận hành theo dõi.
- Tích hợp tính năng thông báo real-time (qua SignalR/WebSocket) khi có tờ khai mới, KPI vượt ngưỡng hoặc yêu cầu phê duyệt giấy phép.

## 5. Trải nghiệm chatbot AI nâng cao
- Hợp nhất UI chatbot vào panel bên phải với khả năng thu gọn/mở rộng; cung cấp bộ lọc câu hỏi gợi ý theo ngữ cảnh (ví dụ: KPI, thủ tục, báo cáo).
- Cho phép chuyển đổi giữa các chế độ gợi ý: "Tư vấn nghiệp vụ", "Thống kê nhanh", "Trợ giúp nhập liệu". Mỗi chế độ có prompt và hành vi khác nhau.
- Lưu lịch sử hội thoại thành timeline có thể tìm kiếm, hỗ trợ đánh dấu câu trả lời quan trọng và xuất ra Markdown/PDF khi cần chia sẻ.

## 6. Lộ trình triển khai đề xuất
| Giai đoạn | Mục tiêu chính | Trạng thái | Ghi chú |
| --- | --- | --- | --- |
| 1 | Xây dựng Design System, theme động, refactor layout dashboard KPI | ✅ Hoàn thành | Đã phát hành trong sprint trước với ThemeProvider và bố cục KPI hai cột. |
| 2 | Gom nhóm chức năng dữ liệu, bổ sung bộ lọc yêu thích và trung tâm điều phối dữ liệu | ✅ Hoàn thành | Hoàn thiện hub điều phối dữ liệu, quick action, bộ lọc yêu thích và thang đo sức khỏe dữ liệu. |
| 3 | Nâng cấp chatbot AI, triển khai thông báo real-time và trang sức khỏe dữ liệu | ✅ Hoàn thành | Hoàn thiện chế độ trợ lý theo ngữ cảnh, thông báo real-time và dashboard Sức khỏe dữ liệu. |
| 4 | Tối ưu hiệu năng, kiểm thử accessibility, đào tạo người dùng và thu thập phản hồi để cải tiến tiếp | ✅ Hoàn thành | Trung tâm hỗ trợ & đào tạo, API phản hồi người dùng và kiểm thử accessibility đã sẵn sàng. |

### 6.1.1. Tổng kết giai đoạn 2

- Thiết lập "Trung tâm điều phối dữ liệu" trên module Import Data với các quick action dẫn tới các khu vực quan trọng (Import Excel, Đồng bộ ECUS, Làm sạch trùng 11 số, Cảnh báo thiếu thông tin).
- Hiển thị chỉ báo sức khỏe dữ liệu (trạng thái backend/SQL Server, số nhóm trùng 11 số, cảnh báo cần xử lý) để đội vận hành nắm bắt nhanh trước khi thao tác.
- Cho phép lưu nhiều "Bộ lọc yêu thích" và áp dụng tức thời cho danh sách tờ khai, hỗ trợ đổi tên/xóa từng bộ để chia sẻ quy trình chuẩn.


### 6.1.2. Tổng kết giai đoạn 3

- Trợ lý AI có 3 chế độ hội thoại (Tư vấn nghiệp vụ, Thống kê nhanh, Trợ giúp nhập liệu) với system prompt riêng, gợi ý câu hỏi nhanh và bộ lọc tìm kiếm lịch sử hội thoại.
- Thiết lập kênh thông báo real-time qua SSE, hiển thị trung tâm thông báo trên header và tự động phát tín hiệu khi đồng bộ ECUS, phát sinh cảnh báo hay lỗi SQL Server.
- Bổ sung tab "Sức khỏe dữ liệu" với thẻ chỉ số, bảng nhóm trùng 11 số, cảnh báo tồn đọng, lịch sử timeout SQL và dòng sự kiện real-time để đội vận hành giám sát.

### 6.1.3. Tổng kết giai đoạn 4

- Hoàn thiện trung tâm "Hỗ trợ & Đào tạo" ngay trên header: cung cấp tài liệu học tập, theo dõi tiến độ cá nhân, lưu trạng thái hoàn thành vào localStorage và đồng bộ theo theme sáng/tối.
- Công bố API `/api/training-resources`, `/api/feedback`, `/api/feedback/summary` và cơ chế SSE thông báo phản hồi mới, giúp đội vận hành nhận tín hiệu real-time.
- Bổ sung kiểm thử accessibility bằng `vitest-axe`, đảm bảo dialog hỗ trợ bàn phím/screen reader và thiết lập prefetch theo `requestIdleCallback` để cải thiện hiệu năng tải chậm.


Các đề xuất trên nhằm mục tiêu hiện đại hóa giao diện, giúp người dùng thao tác nhanh hơn, giảm chi phí đào tạo và chuẩn bị cho khả năng mở rộng trong tương lai.

### 6.1. Lộ trình xử lý trùng tờ khai giữa import Excel và ECUS5VNACCS

**Hiện trạng:** Module Import Data đang phát hiện các nhóm trùng theo 11 số đầu và tự động gợi ý xóa bản trùng với nhãn "Xóa bản trùng (giữ mới nhất)". Tuy nhiên thuật toán hiện tại ưu tiên bản ghi có nhiều dữ liệu phụ trợ (đã gán nhân viên/tổ đội, đã duyệt, có nhật ký chỉnh sửa) thay vì thời điểm nhập gần nhất. Vì vậy khi nguồn ECUS đồng bộ lại một tờ khai mới hơn nhưng chưa kịp gán đủ thông tin, thao tác "giữ mới nhất" có thể thực chất giữ lại bản cũ và không cho phép admin chọn thủ công phiên bản muốn giữ.

**Đề xuất triển khai:**

1. **Sprint 1:**
   - Cập nhật thuật toán so sánh để ưu tiên bản ghi có timestamp mới nhất (importedAt/syncedAt/updatedAt) và chỉ dùng điểm trọng số như tiêu chí phụ.
   - Hiển thị bảng so sánh chi tiết giữa các bản trùng (nguồn dữ liệu, thời gian cập nhật, người nhập) trước khi xóa để admin nhận diện.
   - Ghi lại nhật ký thao tác xóa/giữ bản trùng cùng thông tin người thực hiện.
2. **Sprint 2:**
   - Cho phép admin chọn thủ công bản cần giữ hoặc hợp nhất trường dữ liệu theo từng cột (ví dụ: giữ nhân viên từ bản cũ nhưng giữ KPI từ bản mới).
   - Bổ sung chế độ "Đánh dấu cần rà soát" thay vì xóa ngay, giúp các bộ phận khác kiểm chứng trước khi loại bỏ dữ liệu.
3. **Sprint 3:**
   - Thêm thống kê "Sức khỏe dữ liệu" trong dashboard với số lượng tờ khai trùng, trạng thái đã xử lý, thời gian tồn đọng trung bình.
   - Cấu hình chính sách tự động (ví dụ: sau 7 ngày không xử lý thì gửi thông báo) và tuỳ chọn khóa nguồn đồng bộ gây trùng bất thường.

Lộ trình này bảo đảm việc làm sạch dữ liệu minh bạch, ưu tiên dữ liệu mới nhất và trao quyền quyết định cuối cùng cho admin, tránh thất thoát thông tin quan trọng khi nhập từ nhiều nguồn.
