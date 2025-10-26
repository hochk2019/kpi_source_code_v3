# Hướng dẫn sử dụng hệ thống KPI Hải quan

Tài liệu này mô tả cách sử dụng hệ thống KPI ở cả hai chế độ: **khách truy cập** (không đăng nhập) và **quản trị viên** (đăng nhập bằng tài khoản được cấp quyền).

Hệ thống được triển khai cho Công ty TNHH Tiếp Vận Hoàng Kim (Golden Logistics Co., Ltd) nhằm minh bạch điểm KPI của đội ngũ khai báo hải quan.

## 1. Truy cập và phân quyền tổng quát

- Khi mở ứng dụng tại `http://localhost:5173`, mọi người đều có thể xem dữ liệu đã lưu mà **không cần đăng nhập**. Ở chế độ này chỉ được phép tra cứu và xuất báo cáo, không thể sửa hoặc import dữ liệu.
- Dữ liệu được lưu tập trung trên máy chủ nội bộ (chạy `pnpm server`) bằng cơ sở dữ liệu SQLite (`server/data/storage.sqlite`). File SQLite sẽ được tạo tự động trong lần đầu khởi chạy hoặc bạn có thể chủ động tạo trước bằng `pnpm db:init` sau khi cài đặt. Tất cả máy trong cùng mạng LAN truy cập giao diện (`pnpm dev` hoặc `pnpm start`) sẽ dùng chung nguồn dữ liệu này. Ứng dụng phía client sẽ tự động dò tìm máy chủ định kỳ: nếu lúc mở trang máy chủ chưa khởi động, giao diện sẽ hiển thị trạng thái “đang chờ backend” và tự động gửi lại các thao tác khi kết nối thành công, tránh tình trạng mỗi máy giữ dữ liệu riêng lẻ. Script `pnpm server` sẽ tự động chạy `pnpm rebuild better-sqlite3` nếu thiếu native binding; nếu vẫn gặp lỗi, hãy chạy `pnpm server:rebuild` (hoặc `pnpm rebuild better-sqlite3`) rồi thử lại.
- Nút **“Đăng nhập quản trị”** ở góc trên bên phải dành cho quản trị viên. Tài khoản mặc định:
  - `admin / admin123` (quản trị viên toàn quyền)
  - `manager.hoangkimhoa / Hoa@2024`, `manager.thuyha / ThuyHa@2024`, `manager.hoainam / Nam@2024` (nhóm quản lý – đầy đủ quyền cấu hình, không quản lý tài khoản)
  - `lead.hoc / Hoc@2024`, `lead.phuong / Phuong@2024`, `lead.tuan / Tuan@2024` (trưởng nhóm – quyền import, MST, cảnh báo và báo cáo)
  - `nhanvien / 123456` (tài khoản mẫu quyền hạn hạn chế)
- Sau khi đăng nhập, phần tiêu đề hiển thị tên người dùng cùng vai trò và bổ sung các nút **Đổi mật khẩu** và **Đăng xuất**.

## 2. Chức năng theo từng khu vực

### 2.1 Import Data

| Chế độ | Quyền hạn |
| --- | --- |
| Khách (không đăng nhập) | Xem dữ liệu đã lưu theo từng trang (20 dòng), tra cứu bằng ô "Tìm nhanh" (Số TK / MST / Công ty / Đại lý) và các bộ lọc thiếu Nhân viên/Tổ đội. Không thể import file, chỉnh sửa hay lưu dữ liệu. |
| Có quyền `Import Data` | Chọn file `.xlsx`, cấu hình ghi đè hoặc hợp nhất, tự động gán nhân viên/tổ đội, chỉnh sửa các cột Nhân viên – Tổ đội – Số lượng GP – Đại lý, đánh dấu đã rà soát, xóa dòng và lưu lại. Mọi thao tác được ghi vào nhật ký. |

- Bảng dữ liệu đã bổ sung cột **C/O**. Hệ thống tự động ghi "Có" khi phát hiện tờ khai có mã biểu thuế khác các mã không ưu đãi (B01, B03, B30) dựa trên dữ liệu ECUS/XML/Excel, đồng thời cộng điểm KPI theo Rule v2 khi quy tắc bật.
- Nếu màn hình hiển thị chật, bảng cho phép kéo ngang (horizontal scroll) để quan sát đủ cột.
- Khu vực **Đồng bộ ECUS** hiển thị trạng thái backend và kết nối SQL Server. Nút **Kiểm tra kết nối** sẽ gọi API `/api/import/ecus/status` để thông báo cần khởi động dịch vụ trước khi đồng bộ thủ công.
- Khi cấu hình đồng bộ, quản trị viên có thể giới hạn doanh nghiệp cần lấy dữ liệu bằng hai ô **“Chỉ đồng bộ các MST”** và **“Danh sách MST loại trừ”**. Nhập nhiều MST bằng cách phân tách dấu `;` hoặc xuống dòng, hệ thống sẽ tự chuẩn hóa và loại bỏ bản sao. Nếu danh sách “chỉ đồng bộ” có giá trị, hệ thống chỉ lấy đúng các MST đó; các MST trong danh sách loại trừ sẽ luôn bị bỏ qua. Khi bộ lọc hoạt động, thông báo kết quả và bảng xem trước sẽ kèm ghi chú để tránh nhầm lẫn.

### 2.2 Đại Lý HQ

| Chế độ | Quyền hạn |
| --- | --- |
| Khách | Tìm kiếm và xem danh sách MST – doanh nghiệp – Đại lý hải quan đã cấu hình. |
| Có quyền `Gán MST` | Import danh sách từ Excel hoặc nhập thủ công, chỉnh sửa/thêm/xóa dòng và lưu. Khi lưu hệ thống tự đồng bộ tên công ty & đại lý sang bảng MST và các tờ khai liên quan. |

- Khi nhập MST mới, chỉ cần điền cột **Mã số thuế**, hệ thống sẽ tự đề xuất tên công ty theo dữ liệu tờ khai đã có (nếu tìm thấy). Người dùng chỉ việc chọn Đại lý HQ tương ứng và lưu lại.
- **Nhập nhiều đại lý cho cùng một MST**:
  1. Chuẩn bị file Excel với tối thiểu ba cột `Mã số thuế`, `Công ty` và `Đại lý HQ`. Có thể dùng dấu tiếng Việt hoặc chữ thường/hoa tùy ý, hệ thống sẽ tự chuẩn hóa.
  2. Trong cột `Đại lý HQ`, hãy liệt kê các đại lý theo đúng thứ tự ưu tiên và ngăn cách bằng dấu phẩy, dấu chấm phẩy, dấu gạch dọc (`|`) hoặc xuống dòng. Ví dụ: `ABC Logistics, DEF Logistics`.
  3. Khi import, hệ thống sẽ tự động tách danh sách theo các dấu phân cách nêu trên, loại bỏ khoảng trắng thừa, xóa trùng và hiển thị lại dưới dạng chuỗi chuẩn `Đại lý HQ` với dấu phẩy.
  4. Nếu nhập thủ công trên giao diện, nhấn icon chỉnh sửa ở cột `Đại lý HQ` và nhập danh sách theo cùng định dạng. Nhấn **Enter** để lưu tạm trước khi bấm **Lưu thay đổi** toàn bảng.
  5. Sau khi lưu, mở lịch sử (icon đồng hồ) để xác nhận hệ thống đã ghi nhận đầy đủ danh sách đại lý và người cập nhật.
  6. Khi đồng bộ tờ khai, cả danh sách đại lý hợp lệ sẽ được dùng để gợi ý trong tab **Import Data** và ghi vào lịch sử gán MST.

### 2.3 Gán MST

| Chế độ | Quyền hạn |
| --- | --- |
| Khách | Xem và tìm kiếm danh sách công ty theo MST, không chỉnh sửa. |
| Có quyền `Gán MST` | Import bảng gán MST từ Excel, chỉnh sửa trực tiếp (MST, công ty, người phụ trách, tổ đội, ngày hiệu lực) và lưu. Khi lưu hệ thống ghi log hành động. |

> 🔗 **Theo dõi lộ trình nâng cấp giao diện**: xem tài liệu [Kế hoạch nâng cấp tab "Gán MST"](operations/mst-assignment-ui-plan.md) để nắm những thay đổi mới nhất và các đề xuất cải tiến.

### 2.4 Quản lý Tổ đội

| Chế độ | Quyền hạn |
| --- | --- |
| Khách | Xem danh sách tổ đội, thành viên, doanh nghiệp được gán và lịch sử MST của từng người. Không thể thêm/xóa/điều chuyển. |
| Có quyền `Quản lý tổ đội` | Thêm thành viên, đổi tên, điều chuyển giữa các team, xóa thành viên, lưu tổ đội và đồng bộ tự động sang bảng MST. Mỗi lần lưu ghi lại nhật ký. |

### 2.5 Quy tắc KPI

| Chế độ | Quyền hạn |
| --- | --- |
| Khách | Các trường cấu hình bị khóa, vẫn có thể dùng khu vực **Test nhanh** để kiểm tra điểm KPI của tờ khai đã lưu hoặc nhập tay. |
| Có quyền `Quy tắc KPI` | Chỉnh sửa quy tắc (nhóm loại hình, bậc cộng, giấy phép, điểm cộng C/O), lưu phiên bản mới, xuất/import JSON, khôi phục mặc định. Lưu quy tắc sẽ ghi nhận vào nhật ký. |

- Quy tắc mặc định đã chuyển sang **Rules v2** với tuỳ chọn cộng điểm C/O. Có thể bật/tắt và chỉnh mức điểm cộng trong giao diện Quy tắc KPI.

### 2.6 Báo cáo KPI

- Mọi tài khoản (kể cả khách) đều có thể chọn khoảng thời gian, bộ quy tắc KPI và xem báo cáo chi tiết.
- Nút **Xuất Excel** và **In / Xuất PDF** chỉ khả dụng khi quyền `Báo cáo KPI – xuất file` được bật (mặc định bật cho khách và quản trị viên).
- Khu vực mặc định khi mở ứng dụng (F5) hiển thị báo cáo để minh bạch số liệu mới nhất.

### 2.7 Quản lý tài khoản *(chỉ hiển thị khi tài khoản có quyền `Quản lý tài khoản`)*

- **Tạo tài khoản**: nhập username, họ tên hiển thị, mật khẩu tạm, chọn vai trò và bật/tắt các quyền cụ thể.
- **Danh sách tài khoản**: chỉnh quyền bằng checkbox, đổi vai trò, đặt lại mật khẩu hoặc xóa tài khoản. Không thể xóa quản trị viên cuối cùng.
- Tất cả thao tác đều được ghi vào nhật ký.

### 2.8 Nhật ký hệ thống *(chỉ hiển thị khi có quyền `Quản lý tài khoản`)*

- Theo dõi mọi hành động quan trọng (đăng nhập, import dữ liệu, chỉnh sửa quy tắc, cập nhật MST, quản lý tổ đội, thao tác tài khoản...).
- Có thể lọc theo từ khóa, tải lại hoặc xóa toàn bộ nhật ký. Khi xóa, hệ thống lưu lại bản ghi “audit.clear” để kiểm soát.

### 2.9 Trợ lý AI

- Giao diện gồm ba khu vực chính:
  - **Chat với trợ lý AI**: nhập câu hỏi nghiệp vụ và chọn nhà cung cấp (mặc định là mô hình Ollama cục bộ để đảm bảo dữ liệu không rời mạng nội bộ). Câu trả lời được lưu vào lịch sử từng người dùng và có thể xóa/đặt lại bất kỳ lúc nào.
  - **Snapshot & Tóm tắt KPI**: nhấn “Lấy snapshot” để gọi API `/api/ai/data/snapshot`, hệ thống sẽ truy vấn SQL Server ECUS5VNACCS theo khoảng thời gian chọn sẵn. Nút “Tạo tóm tắt KPI” dùng snapshot đó dựng prompt và gọi mô hình AI để tạo bản tóm tắt tiếng Việt. Snapshot được cache 5 phút cả ở server lẫn trình duyệt, có thể giữ phím `Shift` khi bấm để ép tải lại.
  - **Insight AI tự động**: liệt kê các insight vừa sinh từ endpoint `/api/ai/insights`. Nếu có quyền `aiAssistManage`, bạn có thể chạy thủ công bằng nút “Chạy ngay” (gọi `/api/ai/insights/run`). Các insight hiển thị thời gian tạo, mô hình sử dụng, số token ước tính và nội dung phân tích.
- Mỗi insight hiển thị hai nút **Hữu ích** / **Chưa hữu ích**. Khi bấm, hệ thống gửi phản hồi qua `/api/ai/insights/feedback`, lưu tổng số lượt đánh giá và đánh dấu lựa chọn của chính bạn. Dòng trạng thái bên dưới sẽ cập nhật tức thì (ví dụ “1 hữu ích · 0 chưa hữu ích”).
- Khu vực insight bổ sung công tắc **“Nhận thông báo khi insight cảnh báo bất thường”** (chỉ hiển thị cho người có quyền quản trị AI). Khi bật, mọi insight có dấu hiệu giảm KPI mạnh sẽ đẩy thông báo cảnh báo trên giao diện.
- Ngay bên dưới danh sách insight là **Lịch sử snapshot KPI**: hệ thống lưu lại các snapshot sinh từ job tự động cùng thông tin bộ quy tắc/roster áp dụng. Bấm “Xem snapshot” để xem nhanh số liệu chính (tờ khai, KPI, điều chỉnh) mà không cần gọi lại SQL. Nút “Tải lại” gọi `/api/ai/data/snapshot/history` để đồng bộ lịch sử mới nhất.
- Khung thông tin bên cạnh cho biết lần chạy gần nhất, trạng thái (thành công, cached, lỗi…) và lịch chạy tiếp theo. Nếu insight được lấy từ cache (dữ liệu snapshot không thay đổi) giao diện sẽ hiển thị thông báo “Đã sử dụng insight gần nhất”.
- Máy chủ tự động chạy job insight lúc **07:30** hằng ngày theo cron mặc định (`30 7 * * *`). Có thể thay đổi lịch bằng biến môi trường `AI_INSIGHT_CRON`; khi cron bị vô hiệu (ví dụ đặt `never`), hệ thống vẫn lưu lại cấu hình để quản trị viên chủ động bật lại.
- Tất cả hành động AI đều ghi vào nhật ký: chạy insight (`ai.insight.generate`), gửi phản hồi (`ai.insight.feedback`) hoặc gọi chat (`ai.chat`) để tiện truy vết.

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

## 7. Công cụ hỗ trợ vận hành

- Để tránh phải gõ lệnh `pnpm server` khi vận hành trên Windows, dùng script `scripts/kpi-control-gui.ps1`. Script này cung cấp giao diện (PowerShell + WPF) với các chức năng:
  - Khởi động/tạm dừng/tắt server KPI, reset nhanh (`pnpm server:rebuild`), đổi port và kiểm tra trạng thái.
  - Bật/tắt chế độ khởi động cùng Windows (tạo Scheduled Task chạy `kpi-control-gui.ps1 -AutoStart`).
  - Ghi log theo thời gian thực ở khung dưới cùng để tiện theo dõi.
- Chạy script bằng PowerShell (Run with PowerShell). Khi đổi port trong giao diện, hệ thống sẽ tự khởi động lại server với port mới.
---

Chúc bạn quản lý và theo dõi KPI hiệu quả! Nếu cần mở rộng thêm tính năng hoặc quyền chi tiết hơn, hãy cập nhật cấu hình trong tab **Tài khoản** hoặc liên hệ nhóm phát triển để được hỗ trợ.
