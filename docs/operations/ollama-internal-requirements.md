# Yêu cầu hạ tầng cho Ollama nội bộ

Tài liệu này tổng hợp các điều kiện tối thiểu để triển khai dịch vụ Ollama dùng cho Trợ lý AI nội bộ. Việc cài đặt chi tiết sẽ được bổ sung sau khi hoàn tất Giai đoạn 2 (khi backend và UI phục vụ snapshot KPI sẵn sàng).

## 1. Máy chủ và hệ điều hành

- Windows 11 Pro/Enterprise 22H2 trở lên, đã bật Windows Subsystem for Linux (WSL) để hỗ trợ Ollama.
- Quyền quản trị viên cục bộ để cài đặt dịch vụ nền và thiết lập firewall.
- Đồng hồ hệ thống đồng bộ NTP nhằm tránh lỗi chứng chỉ khi gọi HTTPS nội bộ.

## 2. Tài nguyên phần cứng

- CPU tối thiểu 6 nhân (Intel Core i7 thế hệ 10 hoặc AMD Ryzen 7 tương đương) để phục vụ đồng thời 3–5 phiên chat.
- RAM tối thiểu 32 GB; khuyến nghị 48 GB nếu chạy thêm dịch vụ KPI khác.
- GPU có VRAM ≥ 12 GB (ví dụ RTX 3060 Ti/4070) nếu muốn suy luận tăng tốc; trường hợp không có GPU cần bảo đảm CPU đủ mạnh.
- 40 GB dung lượng trống trên ổ SSD để lưu model `llama3.1:8b` và cache suy luận.

## 3. Mạng và bảo mật

- Cổng nội bộ 11434 cho HTTP API của Ollama, chỉ mở trong LAN; cấu hình firewall từ chối kết nối bên ngoài.
- Bật HTTPS reverse proxy (IIS/NGINX) nếu muốn gom nhật ký và giới hạn IP.
- Bố trí tài khoản dịch vụ riêng (ví dụ `svc_ollama`) không có quyền đăng nhập tương tác, chỉ chạy dịch vụ Ollama.

## 4. Giám sát và nhật ký

- Lưu log Ollama vào `C:\Logs\ollama-service\` với cơ chế xoay log 7 ngày.
- Thiết lập Task Scheduler kiểm tra `http://localhost:11434/api/tags` mỗi 5 phút; nếu thất bại ≥2 lần liên tiếp thì gửi cảnh báo cho nhóm vận hành.
- Ghi nhận dung lượng RAM/VRAM trong Performance Monitor để điều chỉnh giới hạn request khi tải cao.

## 5. Tích hợp với hệ thống KPI

- Tải model `llama3.1:8b` trước khi cấu hình Trợ lý AI để tránh lần gọi đầu tiên bị timeout.
- Đặt biến môi trường `OLLAMA_HOST=http://localhost:11434` cho dịch vụ backend KPI.
- Đảm bảo tài khoản dịch vụ KPI có quyền truy cập mạng nội bộ tới máy chạy Ollama (nếu tách máy).

> Ghi chú: Sau khi hoàn tất các giai đoạn tiếp theo, tài liệu này sẽ được mở rộng với hướng dẫn cài đặt chi tiết và quy trình khôi phục sự cố.
