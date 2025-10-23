# Snapshot KPI phục vụ Trợ lý AI

Tài liệu này mô tả cấu trúc dữ liệu trả về từ API `GET /api/ai/data/snapshot`, cơ chế cache cũng như các bước kiểm tra khi truy vấn SQL Server 2008 R2 gặp lỗi. Toàn bộ nội dung dùng tiếng Việt có dấu, đã được chuẩn hóa Unicode NFC để tránh lỗi hiển thị.

## 1. Tổng quan luồng xử lý

1. Người dùng bấm **Lấy snapshot KPI** trong tab Trợ lý AI.
2. Frontend gọi `fetchAiDataSnapshot` với khoảng thời gian `from`/`to`.
3. Backend sử dụng service `buildAiKpiSnapshot` để:
   - Áp dụng bộ lọc MST (danh sách chỉ đồng bộ và loại trừ) tương tự luồng đồng bộ ECUS.
   - Tải dữ liệu tờ khai qua `fetchEcusDeclarations` với cấu hình kết nối hiện tại.
   - Dựng báo cáo KPI thông qua `buildReportData` (tái sử dụng logic báo cáo chuẩn của hệ thống).
4. Kết quả snapshot được lưu vào cache nội bộ trong 15 phút (theo khóa gồm khoảng ngày và bộ lọc).
5. Frontend cũng lưu cache 5 phút trong `sessionStorage` để tránh gọi lại khi người dùng chưa đổi phạm vi ngày.

## 2. Cấu trúc phản hồi API

```json
{
  "generatedAt": "2024-08-18T09:15:22.123Z",
  "range": { "from": "2024-08-01", "to": "2024-08-18" },
  "filters": {
    "includeTaxCodes": ["0312345678"],
    "excludeTaxCodes": ["0312345999"]
  },
  "source": { "server": "10.0.0.5\\SQL2008", "database": "ECUS_KPI" },
  "summary": {
    "declarations": 128,
    "import": 74,
    "export": 54,
    "items": 521,
    "licenses": 16,
    "companyCount": 45,
    "kpi": 312.5,
    "co": 27,
    "coLines": 32,
    "licenseSummary": "Có 3 mã giấy phép chiếm 80%",
    "licenseSamples": ["C31", "C32"],
    "adjustmentTotals": {
      "pending": 2,
      "approved": 5
    }
  },
  "totals": {
    "rowsFetched": 128,
    "declarations": 120
  },
  "topStaff": [
    {
      "key": "NV001",
      "name": "Nguyễn Văn A",
      "declarations": 35,
      "totalKpi": 82,
      "items": 140,
      "teams": ["Team 1"],
      "adjustmentSummary": { "approved": 3 }
    }
  ],
  "topTeams": [
    {
      "key": "T01",
      "name": "Team Xuất khẩu",
      "declarations": 62,
      "totalKpi": 151,
      "members": [{ "key": "NV001", "name": "Nguyễn Văn A", "declarations": 35, "totalKpi": 82 }],
      "adjustmentSummary": { "pending": 1 }
    }
  ],
  "trends": {
    "monthly": [
      { "month": "2024-06", "declarations": 110, "items": 430, "licenses": 12, "kpi": 280 }
    ],
    "teamSeries": [],
    "comparison": null
  },
  "adjustments": {
    "totals": { "pending": 2, "approved": 5, "rejected": 0, "applied": 5, "totalPoints": 12 },
    "totalsByCategory": { "Tăng điểm": 4 },
    "staffSummaries": [],
    "teamSummaries": [],
    "sample": []
  },
  "rawDeclarations": [
    {
      "date": "2024-08-18",
      "so_tk": "1020203001",
      "mst": "0312345678",
      "cong_ty": "Công ty A",
      "loai_hinh": "A12",
      "nhan_vien": "Nguyễn Văn A",
      "team": "Team Xuất khẩu",
      "kpi": 2.4,
      "num_items": 6,
      "licenses": 0,
      "isExport": true,
      "hasCO": false,
      "licenseCodes": []
    }
  ]
}
```

> Lưu ý: `rawDeclarations` chỉ chứa tối đa 50 bản ghi mẫu để tránh trả quá nhiều dữ liệu nhạy cảm ra ngoài.

## 3. TTL cache và key

| Thành phần                                 | TTL     | Số lượng tối đa | Ghi chú                                                               |
| ------------------------------------------ | ------- | --------------- | --------------------------------------------------------------------- |
| Cache server (`storeAiSnapshotCacheEntry`) | 15 phút | 40 mục          | Key gồm: khoảng ngày, MST include/exclude, thông tin máy chủ.         |
| Cache frontend (`sessionStorage`)          | 5 phút  | 6 mục           | Key giống backend, lưu trong `sessionStorage` để tự xóa khi đóng tab. |

Khi cần cưỡng bức tải lại, người dùng giữ phím **Shift** trong lúc bấm nút **Lấy snapshot KPI**. Frontend sẽ bỏ qua cache local và yêu cầu backend lấy dữ liệu mới.

## 4. Kiểm tra và xử lý lỗi SQL Server

1. **Timeout** (`request to server timed out`): backend sẽ ghi log `recordSqlTimeout` với context `ai-snapshot`. Kiểm tra file log của dịch vụ Node.js và bảo đảm SQL Server 2008 R2 cho phép kết nối từ máy chủ ứng dụng.
2. **Sai thông tin kết nối**: API trả HTTP 400 với thông điệp “Chưa cấu hình kết nối SQL Server…”. Cập nhật lại cấu hình trong mục Đồng bộ ECUS trước khi thử lại.
3. **Bộ lọc MST trống**: hệ thống tự động dùng danh sách trong cấu hình đồng bộ. Nếu cả hai danh sách trống, snapshot sẽ lấy toàn bộ dữ liệu theo phạm vi ngày.
4. **Kết quả rỗng**: Kiểm tra bảng `decls_kpi` đã được đồng bộ gần nhất chưa. Có thể chạy lại đồng bộ ECUS, sau đó tải snapshot.

## 5. Nhật ký cần theo dõi

- `logs/ai-snapshot.log` (nếu bật log riêng) hoặc stdout của dịch vụ Node.js.
- Bảng `kv_store` khóa `ai_snapshot_cache_v1` để xem thông tin cache phía server.
- `sessionStorage.aiSnapshotCache.v1` trong DevTools → Application → Session Storage để debug cache phía trình duyệt.

## 6. Các bước chuẩn bị trước khi mở rộng

- Đảm bảo máy chủ ứng dụng có quyền đọc dữ liệu từ SQL Server 2008 R2 (kiểm tra bằng PowerShell 7: `Test-NetConnection`).
- Kiểm tra lại các biến môi trường `ECUS_SQL_*` để chắc chắn thông tin đăng nhập chính xác và chuỗi kết nối không chứa ký tự đặc biệt chưa được escape.
- Lên lịch dọn cache thủ công nếu cần (xóa khóa `ai_snapshot_cache_v1` bằng script bảo trì khi thay đổi lớn trong dữ liệu).

## 7. Kế hoạch mở rộng

Sau khi snapshot ổn định, có thể dùng dữ liệu này để:

- Sinh insight tự động (Giai đoạn 3) bằng cách so sánh `trends` và `adjustments` giữa các khoảng thời gian.
- Tích hợp với dashboard KPI nhằm hiển thị lại mẫu `rawDeclarations` khi người dùng muốn truy ngược dữ liệu gốc.
