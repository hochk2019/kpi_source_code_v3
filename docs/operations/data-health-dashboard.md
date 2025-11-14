# Data Health Dashboard

Tài liệu này ghi lại các chỉ số kiểm tra chất lượng dữ liệu và hướng dẫn vận hành tab **Data Health** trong ứng dụng KPI.

## 1. Mục tiêu

- Cảnh báo sớm các bất thường ở dữ liệu import (thiếu tờ khai, lệch điểm, thiếu nhân sự phụ trách).
- Đưa ra checklist xử lý nhanh cho từng cảnh báo để đội vận hành không bỏ sót.
- Cung cấp số liệu tổng hợp giúp trưởng nhóm ưu tiên các lỗi ảnh hưởng KPI nhiều nhất.

## 2. <a name="chi-so-giam-sat-chinh"></a>Các chỉ số giám sát chính

| Nhóm | Mô tả | Ngưỡng mặc định | Hành động khuyến nghị |
| --- | --- | --- | --- |
| **Thiếu tờ khai** | So sánh số tờ khai import với snapshot ECUS cùng kỳ. | Sai lệch > 5% | Kiểm tra job đồng bộ, xem log trong Notification Center để tìm tờ khai lỗi. |
| **Thiếu nhân viên/tổ đội** | Đếm dòng chưa gán nhân viên phụ trách. | > 10 dòng | Dùng tab Gán MST hoặc Team Manager để cập nhật roster. |
| **Điều chỉnh chờ duyệt** | Tổng số điều chỉnh trạng thái `pending` quá hạn. | > 3 ngày | Mở tab Điều chỉnh KPI, lọc theo trạng thái `pending` và duyệt hàng loạt. |
| **Sai lệch KPI** | So sánh điểm KPI giữa báo cáo chính và bản import mới nhất. | Sai lệch > 2 điểm/tờ khai | Chạy lại báo cáo KPI, đối chiếu log import để xác minh. |
| **Cảnh báo ECUS** | Ghi nhận lần đồng bộ ECUS thất bại gần nhất. | Lỗi trong 24h | Làm theo checklist tại [`ecus-sync-monitoring.md`](./ecus-sync-monitoring.md). |

Các chỉ số hiển thị theo từng khoảng thời gian chọn (ngày/tuần/tháng). Có thể tùy chỉnh ngưỡng trong `dataHealthThresholds` của store nếu cần siết chặt kiểm soát.

## 3. Luồng thao tác

1. Chọn khoảng thời gian ở thanh filter (mặc định 7 ngày gần nhất).
2. Quan sát widget tổng hợp ở đầu trang; màu đỏ thể hiện cảnh báo cần xử lý ngay.
3. Nhấn vào từng widget để mở bảng chi tiết, cho phép xuất CSV danh sách tờ khai/điều chỉnh liên quan.
4. Sau khi xử lý, bấm **Tải lại** để chạy lại kiểm tra và xác nhận trạng thái.

## 4. <a name="chia-se-va-xuat-bao-cao"></a>Chia sẻ & xuất báo cáo

- Nút **Xuất CSV** trong mỗi bảng giúp gửi nhanh danh sách cảnh báo cho bộ phận phụ trách.
- Với cảnh báo ECUS, nên đính kèm cả log từ Notification Center để đội hạ tầng đối chiếu.
- Các widget đã xử lý sẽ chuyển sang trạng thái màu xanh nhạt, lưu dấu thời gian xử lý cuối cùng trong local storage để tiện theo dõi.

## 5. Tự động hóa đề xuất

- Có thể bật cron gửi email tóm tắt cảnh báo bằng script `pnpm server --data-health-report` (tham khảo phần `automation` trong tài liệu vận hành backend).
- Khi tích hợp với Slack/Microsoft Teams, sử dụng API `/api/data-health/export` để lấy JSON cảnh báo và đẩy vào webhook.

---

Đề xuất cải tiến thêm chỉ số? Hãy cập nhật file này và mở PR để thống nhất cùng nhóm vận hành.

