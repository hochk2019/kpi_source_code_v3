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
1. **Giai đoạn 1 (1-2 sprint):** xây dựng Design System, theme động, refactor layout dashboard KPI.
2. **Giai đoạn 2 (2-3 sprint):** gom nhóm chức năng dữ liệu, bổ sung bộ lọc yêu thích và trung tâm điều phối dữ liệu.
3. **Giai đoạn 3 (2 sprint):** nâng cấp chatbot AI, triển khai thông báo real-time và trang sức khỏe dữ liệu.
4. **Giai đoạn 4 (liên tục):** tối ưu hiệu năng, kiểm thử accessibility, đào tạo người dùng và thu thập phản hồi để cải tiến tiếp.

Các đề xuất trên nhằm mục tiêu hiện đại hóa giao diện, giúp người dùng thao tác nhanh hơn, giảm chi phí đào tạo và chuẩn bị cho khả năng mở rộng trong tương lai.
