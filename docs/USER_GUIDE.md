# Hướng dẫn sử dụng hệ thống KPI Hải quan

Tài liệu này mô tả cách sử dụng hệ thống KPI ở cả hai chế độ: **khách truy cập** (không đăng nhập) và **quản trị viên** (đăng nhập bằng tài khoản được cấp quyền).

## 1. Truy cập và phân quyền tổng quát

- Khi mở ứng dụng tại `http://localhost:5173`, mọi người đều có thể xem dữ liệu đã lưu mà **không cần đăng nhập**. Ở chế độ này chỉ được phép tra cứu và xuất báo cáo, không thể sửa hoặc import dữ liệu.
- Dữ liệu được lưu tập trung trên máy chủ nội bộ (chạy `pnpm server`) bằng cơ sở dữ liệu SQLite (`server/data/storage.sqlite`). Tất cả máy trong cùng mạng LAN truy cập giao diện (`pnpm dev` hoặc `pnpm start`) sẽ dùng chung nguồn dữ liệu này.
- Nút **“Đăng nhập quản trị”** ở góc trên bên phải dành cho quản trị viên. Tài khoản mặc định:
  - `admin / admin123` (quản trị viên toàn quyền)
  - `nhanvien / 123456` (tài khoản mẫu quyền hạn hạn chế)
- Sau khi đăng nhập, phần tiêu đề hiển thị tên người dùng cùng vai trò và bổ sung các nút **Đổi mật khẩu** và **Đăng xuất**.

## 2. Chức năng theo từng khu vực

### 2.1 Import Excel

| Chế độ | Quyền hạn |
| --- | --- |
| Khách (không đăng nhập) | Chỉ xem 20 tờ khai mới nhất, tra cứu bằng ô "Tìm nhanh". Không thể import file, chỉnh sửa dòng hay lưu dữ liệu. |
| Quản trị viên / tài khoản được cấp quyền `Import Excel` | Có thể chọn file `.xlsx`, tùy chọn ghép/ghi đè, chỉnh sửa nhân viên/tổ đội/số lượng GP ngay trong bảng và lưu lại. Mọi thao tác import hoặc lưu đều được ghi vào nhật ký. |

### 2.2 Gán MST

| Chế độ | Quyền hạn |
| --- | --- |
| Khách | Xem và tìm kiếm danh sách công ty theo MST, không chỉnh sửa. |
| Có quyền `Gán MST` | Import bảng gán MST từ Excel, chỉnh sửa trực tiếp (MST, công ty, người phụ trách, tổ đội, ngày hiệu lực) và lưu. Khi lưu hệ thống ghi log hành động. |

### 2.3 Quy tắc KPI

| Chế độ | Quyền hạn |
| --- | --- |
| Khách | Các trường cấu hình bị khóa, vẫn có thể dùng khu vực **Test nhanh** để kiểm tra điểm KPI của tờ khai đã lưu hoặc nhập tay. |
| Có quyền `Quy tắc KPI` | Chỉnh sửa quy tắc (nhóm loại hình, bậc cộng, giấy phép), lưu phiên bản mới, xuất/import JSON, khôi phục mặc định. Lưu quy tắc sẽ ghi nhận vào nhật ký. |

### 2.4 Quản lý Thành viên & Tổ đội

| Chế độ | Quyền hạn |
| --- | --- |
| Khách | Xem danh sách tổ đội, thành viên, doanh nghiệp được gán và lịch sử MST của từng người. Không thể thêm/xóa/điều chuyển. |
| Có quyền `Quản lý tổ đội` | Thêm thành viên, đổi tên, điều chuyển giữa các team, xóa thành viên, lưu tổ đội và đồng bộ tự động sang bảng MST. Mỗi lần lưu ghi lại nhật ký. |

### 2.5 Báo cáo/In

- Mọi tài khoản (kể cả khách) đều có thể chọn khoảng thời gian, bộ lọc nhân viên/tổ đội và xem báo cáo chi tiết. 
- Nút **Xuất Excel** và **In / Xuất PDF** chỉ khả dụng khi quyền `Báo cáo/In – xuất file` được bật (mặc định bật cho khách và quản trị viên).

### 2.6 Quản lý tài khoản *(chỉ hiển thị khi tài khoản có quyền `Quản lý tài khoản`)*

- **Tạo tài khoản**: nhập username, họ tên hiển thị, mật khẩu tạm, chọn vai trò và bật/tắt các quyền cụ thể.
- **Danh sách tài khoản**: chỉnh quyền bằng checkbox, đổi vai trò, đặt lại mật khẩu hoặc xóa tài khoản. Không thể xóa quản trị viên cuối cùng.
- Tất cả thao tác đều được ghi vào nhật ký.

### 2.7 Nhật ký hệ thống *(chỉ hiển thị khi có quyền `Quản lý tài khoản`)*

- Theo dõi mọi hành động quan trọng (đăng nhập, import dữ liệu, chỉnh sửa quy tắc, cập nhật MST, quản lý tổ đội, thao tác tài khoản...).
- Có thể lọc theo từ khóa, tải lại hoặc xóa toàn bộ nhật ký. Khi xóa, hệ thống lưu lại bản ghi “audit.clear” để kiểm soát.

## 3. Quản trị tài khoản

- Vào tab **Tài khoản** để tạo người dùng mới, gán quyền theo nhu cầu (ví dụ chỉ cho phép import nhưng không sửa quy tắc).
- Chọn **Đặt lại mật khẩu** để cấp mật khẩu mới cho nhân sự (hệ thống không gửi email, thông báo trực tiếp cho người dùng).
- Người dùng có thể tự đổi mật khẩu bằng nút **Đổi mật khẩu** ở tiêu đề. Nếu nhập sai mật khẩu hiện tại, hệ thống hiển thị thông báo.

## 4. Ghi log và minh bạch dữ liệu

- Tất cả các thao tác chỉnh sửa (import tờ khai, lưu MST, lưu quy tắc, quản lý tổ đội, thao tác tài khoản, đăng nhập/đăng xuất...) đều được ghi vào `audit_logs_v1` và hiển thị trong tab **Nhật ký**.
- Nhật ký giữ tối đa 200 bản ghi gần nhất để tránh tràn dữ liệu. Khi cần lưu trữ lâu dài, hãy xuất báo cáo định kỳ.

## 5. Quy trình đề xuất khi làm việc

1. Khách truy cập có thể xem báo cáo và tra cứu dữ liệu đã lưu để đảm bảo tính minh bạch.
2. Quản trị viên đăng nhập để import dữ liệu mới, cập nhật tổ đội, quy tắc KPI hoặc gán MST.
3. Sau khi cập nhật, vào tab **Báo cáo/In** để kiểm tra kết quả, in báo cáo hoặc xuất Excel/PDF.
4. Theo dõi tab **Nhật ký** để kiểm soát lịch sử chỉnh sửa. Có thể lọc theo tên người dùng hoặc hành động để truy vết nhanh.

## 6. Tài khoản mặc định & khuyến nghị bảo mật

- Sau khi chạy thử, nên đổi mật khẩu của tài khoản `admin` (dùng nút **Đổi mật khẩu**).
- Có thể tạo thêm tài khoản với quyền hạn phù hợp cho từng nhóm (ví dụ tài khoản chỉ được import dữ liệu nhưng không chỉnh sửa quy tắc).
- Nếu quên mật khẩu, quản trị viên khác có thể đặt lại trong tab **Tài khoản**.

---

Chúc bạn quản lý và theo dõi KPI hiệu quả! Nếu cần mở rộng thêm tính năng hoặc quyền chi tiết hơn, hãy cập nhật cấu hình trong tab **Tài khoản** hoặc liên hệ nhóm phát triển để được hỗ trợ.
