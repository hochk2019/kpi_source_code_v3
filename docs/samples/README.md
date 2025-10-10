# Bộ dữ liệu mẫu

Thư mục này lưu một số tập tin mẫu phục vụ kiểm thử và tài liệu hoá quy trình
đồng bộ ECUS:

- `ECUS5VNACCS2018_ToKhai_105110557420_STT2131.xml` và
  `ECUS5VNACCS2018_ToKhai_305254416960_STT2175.xml`: dùng làm ví dụ khi mô tả cấu
  trúc XML của tờ khai và chạy lệnh `pnpm ecus:inspect` trong tài liệu
  `docs/ECUS_XML_MAPPING.md`.
- `BaoCaoToKhai.csv`: file mẫu minh hoạ dữ liệu export khi kiểm thử pipeline báo
  cáo.
- `Gan MST.xlsx`: dữ liệu Excel ví dụ để kiểm tra quy trình gán MST trong module
  `MSTAssignment`.

Các tập tin này chỉ phục vụ tài liệu và kiểm thử thủ công, không được tải lên
các môi trường triển khai chính thức.
