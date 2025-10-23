# Quy trình chuẩn hoá sao lưu ECUS5VNACCS

Tài liệu này mô tả quy trình chuẩn hoá việc sao lưu và kiểm tra khôi phục
cho cơ sở dữ liệu **ECUS5VNACCS** đang chạy trên máy chủ SQL Server 2008 R2.
Ứng dụng KPI nội bộ chỉ đọc dữ liệu thông qua tài khoản đồng bộ, lưu trữ dữ
liệu vận hành bằng SQLite và **không** thực hiện thao tác ghi trực tiếp lên
máy chủ SQL Server. Vì vậy, các bước dưới đây tập trung vào việc phối hợp
cùng đội vận hành ECUS để đảm bảo tính sẵn sàng của nguồn dữ liệu đồng bộ.

## 1. Phạm vi & trách nhiệm

- **Đội vận hành ECUS**: quản lý máy chủ Windows Server/SQL Server 2008 R2,
  cấu hình lịch sao lưu, giám sát dung lượng và kiểm tra khôi phục.
- **Đội KPI**: giám sát tiến trình đồng bộ, xác nhận dữ liệu sau khi khôi phục
  và cập nhật tài liệu vận hành liên quan.
- **Không thay đổi**: cấu trúc bảng trong ECUS5VNACCS, tài khoản dịch vụ và
  quyền hạn hiện hữu.

## 2. Lịch sao lưu chuẩn

| Loại sao lưu    | Thời điểm                                | Mô tả                                                                                                     |
| --------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Full            | 01:00 hằng ngày                          | Sao lưu đầy đủ toàn bộ database `ECUS5VNACCS` vào thư mục `D:\Backups\Full` (hoặc thư mục đã thoả thuận). |
| Differential    | Mỗi 6 giờ (07:00, 13:00, 19:00, 01:00+1) | Sao lưu chênh lệch vào `D:\Backups\Diff`.                                                                 |
| Transaction log | 30 phút/lần (tuỳ chọn)                   | Áp dụng nếu cần rút ngắn mất dữ liệu tiềm ẩn; lưu ở `D:\Backups\Log`.                                     |

### Tác vụ mẫu sử dụng `sqlcmd`

```powershell
# Full backup
sqlcmd -S localhost\ECUS -E -Q "BACKUP DATABASE [ECUS5VNACCS] TO DISK='D:\\Backups\\Full\\ECUS5VNACCS_$(Get-Date -Format yyyyMMdd).bak' WITH INIT, COMPRESSION"

# Differential backup
sqlcmd -S localhost\ECUS -E -Q "BACKUP DATABASE [ECUS5VNACCS] TO DISK='D:\\Backups\\Diff\\ECUS5VNACCS_DIFF_$(Get-Date -Format yyyyMMdd_HHmm).bak' WITH DIFFERENTIAL, COMPRESSION"
```

> **Lưu ý Unicode**: Bật tuỳ chọn `-f 65001` khi chạy `sqlcmd` nếu máy chủ lưu
> tên file chứa ký tự tiếng Việt để đảm bảo đường dẫn hợp lệ.

## 3. Chính sách lưu trữ & sao chép

- Giữ tối thiểu 14 bản full gần nhất và 30 bản diff gần nhất.
- Đồng bộ thư mục backup đến NAS nội bộ mỗi đêm (Robocopy với cờ `/XO /FFT /MIR`).
- Kiểm tra dung lượng ổ đĩa mỗi ngày, cảnh báo khi còn dưới 15%.

## 4. Kiểm tra khôi phục định kỳ

Thực hiện ít nhất **mỗi tháng** trên máy chủ dự phòng hoặc VM kiểm thử.

1. Sao chép file `.bak` mới nhất (full + diff liên quan) sang máy chủ dự phòng.
2. Khôi phục dưới tên `ECUS5VNACCS_Staging` để tránh trùng với cơ sở dữ liệu
   đang chạy.
3. Cấp tài khoản chỉ đọc cho dịch vụ đồng bộ KPI, cập nhật tạm thời file
   cấu hình kết nối của KPI để trỏ sang bản staging và chạy lệnh đồng bộ thử.
4. Đối chiếu dữ liệu tờ khai gần nhất trên giao diện KPI (dashboard ECUS) để
   xác nhận dữ liệu sau khôi phục không bị lỗi Unicode hoặc thiếu cột.
5. Ghi lại kết quả vào nhật ký `backup-restore-log.xlsx` (mẫu trong thư mục
   vận hành) và báo cáo nếu phát hiện sai lệch.

### Script khôi phục tham khảo

```sql
RESTORE DATABASE [ECUS5VNACCS_Staging]
FROM DISK = 'D:\Backups\Full\ECUS5VNACCS_20250110.bak'
WITH MOVE 'ECUS5VNACCS' TO 'D:\SQLData\ECUS5VNACCS_Staging.mdf',
     MOVE 'ECUS5VNACCS_log' TO 'D:\SQLLogs\ECUS5VNACCS_Staging.ldf',
     REPLACE, NORECOVERY;

RESTORE DATABASE [ECUS5VNACCS_Staging]
FROM DISK = 'D:\Backups\Diff\ECUS5VNACCS_DIFF_20250110_1300.bak'
WITH RECOVERY;
```

## 5. Tích hợp với hệ thống KPI

- Sau mỗi lần khôi phục thành công, chạy lại script `scripts/monitor-ecus-sync.ps1`
  để xác nhận API giám sát trả về trạng thái "healthy" và độ trễ nhỏ hơn 15 phút.
- Nếu cần kiểm tra thủ công, sử dụng tiện ích `pnpm ecus:inspect` để đọc một số
  tờ khai mẫu và đối chiếu với dữ liệu thực tế trên ECUS.
- Khi phát hiện sai lệch, ghi nhận vào `docs/operations/ecus-sync-monitoring.md`
  tại mục "Sự cố thường gặp" và cập nhật giải pháp khắc phục.

## 6. Danh sách kiểm tra nhanh

- [ ] Lịch backup full/diff đã cấu hình đúng thời gian.
- [ ] Dung lượng ổ đĩa còn > 15% sau mỗi phiên backup.
- [ ] NAS hoặc vị trí lưu trữ dự phòng đã nhận bản sao trong 24 giờ gần nhất.
- [ ] Bài kiểm tra khôi phục gần nhất không quá 30 ngày.
- [ ] API giám sát trả về trạng thái "healthy" sau khôi phục.
- [ ] Đội KPI đã cập nhật log và thông báo nếu phát sinh sự cố.

## 7. Tài liệu liên quan

- `docs/operations/ecus-sync-monitoring.md`
- `docs/operations/ecus-credentials.md`
- `scripts/monitor-ecus-sync.ps1`

Tài liệu này sẽ được rà soát lại khi có thay đổi về phiên bản SQL Server hoặc
khi đội vận hành ECUS cập nhật chính sách sao lưu.
