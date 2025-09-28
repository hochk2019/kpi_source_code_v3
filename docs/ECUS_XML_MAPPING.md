# Hướng dẫn xác định trường dữ liệu ECUS5VNACCS

Các file XML tờ khai ECUS thường chứa thông tin chi tiết của một tờ khai trong
cấu trúc dạng cây. Để cấu hình tác vụ đồng bộ `/api/import/ecus/run`, cần biết
chính xác tên trường (column) tương ứng với **Số tờ khai**, **Ngày đăng ký**,
**MST**, **Doanh nghiệp**, **Loại hình**, **Số mục hàng** và **Danh sách giấy
phép hợp lệ**. Tài liệu này mô tả cách phân tích nhanh file XML và liên hệ với
các cột mong đợi trong hệ thống KPI.

## 1. Dùng CLI `pnpm ecus:inspect`

1. Tải file XML cần phân tích (ví dụ
   `ECUS5VNACCS2018_ToKhai_105110557420_STT2131.xml`).
2. Chạy lệnh:

   ```bash
   pnpm ecus:inspect --file ECUS5VNACCS2018_ToKhai_105110557420_STT2131.xml
   ```

3. Công cụ sẽ duyệt toàn bộ cây XML, tìm các nút có chứa các khóa giống
   `so_tk`, `mst`, `ma_so_thue`… và in ra đường dẫn cùng các trường quan trọng.
   Ví dụ kết quả (rút gọn):

   ```
   Đường dẫn: ROOT > DATA > TOKHAI
     Số tờ khai: 105110557420
     Ngày: 2025-08-01
     MST: 1051105574
     Công ty: CÔNG TY TNHH ABC
     Loại hình: A11
     Số mục hàng: 5
     Giấy phép: GP01, GP05
     NV nhập: Phương
     NV xuất: (trống)
   ```

4. Dựa vào đường dẫn này, cập nhật `columnMap` trong cấu hình đồng bộ ECUS hoặc
   điều chỉnh câu truy vấn SQL để trả về đúng tên cột.

## 2. Bảng ánh xạ trường phổ biến

Hệ thống KPI tự động hỗ trợ các alias sau khi đọc bản ghi từ SQL Server. Nếu
các cột trong XML (hoặc view SQL) khớp với một trong các tên dưới đây thì không
cần cấu hình thêm `columnMap`:

| Trường KPI      | Các tên cột được nhận diện |
|-----------------|----------------------------|
| `so_tk`         | `so_tk`, `So_tk`, `SoTK`, `sotk` |
| `date`          | `ngay_dang_ky`, `Ngay_dang_ky`, `ngay_dk`, `NgayDK`, `NgayLapToKhai` |
| `mst`           | `mst`, `MST`, `ma_so_thue`, `MaSoThue` |
| `cong_ty`       | `cong_ty`, `ten_dn`, `TenDoanhNghiep`, `doanh_nghiep` |
| `loai_hinh`     | `loai_hinh`, `Loai_hinh`, `ma_loai_hinh`, `MA_LH`, `ma_lh` |
| `num_items`     | `muc_hang`, `so_muc`, `so_luong_mh`, `TotalItems`, `totalitems` |
| `loai_hinh`     | `loai_hinh`, `Loai_hinh`, `ma_loai_hinh` |
| `num_items`     | `muc_hang`, `so_muc`, `so_luong_mh`, `TotalItems` |
| `licenses`      | `licenses`, `ds_gp`, `ds_giay_phep`, `DanhSachGiayPhep`, `ma_gp`, các mảng con chứa mã GP |
| `nhan_vien_nhap`| `nhan_vien_nhap`, `NhanVienNhap`, `NVNhap` |
| `nhan_vien_xuat`| `nhan_vien_xuat`, `NhanVienXuat`, `NVXuat` |

Nếu tên cột khác hoàn toàn, hãy điền rõ vào `columnMap` trong cấu hình ECUS,
ví dụ:

```json
{
  "columnMap": {
    "so_tk": "SoTK",
    "date": "Ngay_dang_ky",
    "mst": "MaSoThue",
    "cong_ty": "TenDoanhNghiep"
  }
}
```

## 3. Xử lý danh sách giấy phép

Một số XML lưu danh sách giấy phép dưới dạng mảng hoặc cây con phức tạp
(ví dụ: `<DS_GP><GP>GP01</GP><GP>ZN02</GP></DS_GP>`). Hàm
`parseLicenseCount` đã hỗ trợ duyệt đệ quy các mảng/đối tượng con, lọc những mã
nằm trong danh sách loại trừ (`license.excludeCodes`) rồi đếm số giấy phép hợp
lệ. Vì vậy chỉ cần bảo đảm cây con chứa mã giấy phép nằm trong một trường được
ánh xạ tới `licenses` hoặc `license_codes` là đủ.

## 4. Gợi ý kiểm thử

- Dùng `pnpm ecus:mock --count 20 --output mock.json` để tạo recordset giả lập
  rồi gọi `POST /api/import/ecus/run` nhằm kiểm tra toàn bộ pipeline import.
- Khi có quyền truy cập trực tiếp SQL Server, tạo view `v_kpi_declarations`
  với các tên cột kể trên để backend có thể truy vấn thống nhất cho mọi tờ khai.

Tài liệu này giúp đảm bảo việc đồng bộ tự động từ ECUS5VNACCS sang hệ thống KPI
không gặp lỗi sai tên cột hay thiếu dữ liệu cần thiết.
