### **Danh sách kiểm tra (Checklist) Nâng cấp Hệ thống KPI Hải quan v3.0**

Bạn hãy xác nhận xem các hạng mục dưới đây đã được hoàn thành hay chưa?

#### **Phần 1: Sửa lỗi tính năng**
- [ ] **Lỗi loại trừ giấy phép:** Các tờ khai có mã giấy phép trong danh sách loại trừ (ví dụ: ZN02, HDGC) đã được lọc bỏ một cách chính xác khi đồng bộ từ ECUS chưa? Chúng không còn bị tính điểm KPI sai nữa phải không?
- [ ] **Lỗi đối soát C/O:** Chức năng "Chạy kiểm tra" trong khu vực "Đối soát C/O" ở tab **Import Data** đã hoạt động bình thường và không còn báo lỗi `HTTP 500` nữa phải không?
- [ ] **Tối ưu mã nguồn:** Mã nguồn đã được rà soát để loại bỏ các đoạn code không sử dụng (code thừa) chưa?

---

#### **Phần 2: Nâng cấp Giao diện và Tính năng mới**

##### **1. Tab "Import Data"**
- [ ] **Giao diện gọn gàng:** Các khu vực "Đồng bộ tự động", "Cấu hình mã ưu đãi C/O", và "Đối soát C/O" đã có thể thu gọn hoặc ẩn/hiện được chưa?
- [ ] **Chuẩn bị cho Tờ khai AMA:** Đã thêm cột **"Số TK AMA"** vào bảng danh sách tờ khai để sẵn sàng cho việc nâng cấp trong tương lai chưa?
- [ ] **Nâng cấp khu vực tìm kiếm:** Đã bổ sung các tính năng sau chưa?
    - [ ] Tìm kiếm theo khoảng thời gian được chọn.
    - [ ] Nút "Chọn tất cả" các tờ khai trong kết quả tìm kiếm.
    - [ ] Nút "Đối chiếu và loại bỏ" để áp dụng lại quy tắc loại trừ giấy phép cho các tờ khai đã chọn.
- [ ] **Export Excel:** Đã có nút để xuất danh sách tờ khai đã được chọn ra file Excel chưa?

##### **2. Tab "Gán MST"**
- [ ] **Thêm thủ công:** Đã có nút **"Thêm mới"** để nhập tay thông tin gán MST cho khách hàng chưa?
- [ ] **Lịch sử chỉnh sửa:** Hệ thống đã hiển thị được lịch sử thay đổi người phụ trách và ngày áp dụng cho mỗi dòng MST chưa (ví dụ: qua tooltip hoặc một nút bấm)?
- [ ] **Export Excel:** Đã có nút để xuất danh sách MST ra file Excel chưa?

##### **3. Tab "Đại Lý HQ"**
- [ ] **Hỗ trợ nhiều đại lý & Lịch sử:** Một mã số thuế đã có thể được gán cho nhiều đại lý hải quan (dữ liệu nhập được ngăn cách bằng dấu phẩy ",") và có thể xem được lịch sử chỉnh sửa trên từng dòng chưa?

##### **4. Tab "Quản Lý Tổ Đội"**
- [ ] **Lịch sử thay đổi:** Có thể xem được lịch sử các thay đổi liên quan đến thành viên hoặc các mã số thuế được phân công cho tổ/đội không?

##### **5. Tab "Quy tắc KPI"**
- [ ] **Lưu trữ quy tắc an toàn:** Các quy tắc KPI đã được lưu vào cơ sở dữ liệu để đảm bảo không bị mất sau khi build lại dự án chưa?
- [ ] **Cải thiện nhập liệu:** Ô nhập danh sách mã loại trừ đã được thay thế bằng trình chọn đa lựa chọn (multi-select) có gợi ý tự động để tránh sai chính tả chưa?

##### **6. Tab mới "Điểm KPI +/- Thêm"**
- [ ] **Tạo tab mới:** Giao diện đã có tab mới tên là **"Điểm KPI +/- Thêm"** chưa?
- [ ] **Đầy đủ chức năng:** Tab này đã có các mục để cộng/trừ điểm KPI thủ công cho nhân viên theo tháng, bao gồm:
    - [ ] Hỗ trợ thông quan.
    - [ ] Hủy / Sửa tờ khai (phân biệt lỗi nhân viên/khách hàng).
    - [ ] Hoàn thuế (phân biệt lỗi nhân viên/khách hàng).
    - [ ] Đánh giá định tính: Tinh thần nhóm, Thái độ đồng nghiệp, Thái độ khách hàng.
    - [ ] Ghi nhận vi phạm: Đi làm muộn.

##### **7. Tab "Báo Cáo KPI"**
- [ ] **Tái cấu trúc báo cáo:** Báo cáo KPI đã được cập nhật để tính toán và hiển thị tổng điểm cuối cùng, bao gồm cả các điểm cộng/trừ từ tab "Điểm KPI +/- Thêm" chưa?
- [ ] **Bổ sung thông tin:** Báo cáo chi tiết đã hiển thị thêm các thông tin mới như: tổng số lượng C/O, danh sách các mã giấy phép đã bị loại trừ trong kỳ báo cáo chưa?

##### **8. Tab "Tài Khoản"**
- [ ] **Tạo tài khoản mặc định:** Các tài khoản cho nhân viên, trưởng nhóm (Học, Phương, Tuấn), và cấp quản lý (Hòa, Hà, Nam) với các cấp phân quyền tương ứng đã được tạo sẵn trong hệ thống chưa?

##### **9. Nâng cấp chung**
- [ ] **Hướng dẫn sử dụng (Tooltip):** Khi di chuột qua các nút bấm chính, có hiển thị chú thích ngắn gọn về chức năng của nút đó không?
- [ ] **Tích hợp AI:** Đã lên kế hoạch và phát triển tích hợp AI trong xử lý dữ liệu và chatbot sao cho tiết kiệm token hay chưa?