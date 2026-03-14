# KPI Hải quan – chế độ lưu trữ dùng chung

Ứng dụng tính điểm KPI cho nhân viên làm thủ tục hải quan. Phiên bản này bổ sung
Giải pháp được thiết kế cho Công ty TNHH Tiếp Vận Hoàng Kim (Golden Logistics Co., Ltd) để chuẩn hóa dữ liệu và chia sẻ báo cáo KPI minh bạch trong toàn bộ đội ngũ khai báo. 
máy chủ API cục bộ để nhiều máy trong cùng mạng LAN có thể cùng truy cập và
chia sẻ dữ liệu mà không cần sao chép thủ công giữa các máy.

## 1. Cài đặt

```bash
pnpm install
```

```bash
pnpm db:init
```

Lệnh `db:init` tạo sẵn file `server/data/storage.sqlite` cùng dữ liệu mặc
định để có thể chạy thử backend ngay cả khi chưa khởi động server lần đầu.

> Nếu trong quá trình cài đặt xuất hiện cảnh báo `Ignored build scripts:
> better-sqlite3`, hãy chạy `pnpm approve-builds` hoặc `pnpm rebuild
> better-sqlite3` để cho phép biên dịch native module của SQLite. Script
> khởi động backend (`pnpm server`) cũng sẽ tự động rebuild nếu phát hiện
> thiếu binding.

## 2. Khởi chạy cho môi trường phát triển

Chỉ cần một lệnh duy nhất:

```bash
pnpm dev
```

Script này sẽ tự động:

- đảm bảo native module `better-sqlite3` sẵn sàng (tương đương với `pnpm server:rebuild` khi cần);
- khởi chạy backend tại `http://localhost:5000` và Vite tại `http://localhost:5173` song song;
- dừng cả hai tiến trình ngay khi bạn nhấn `Ctrl+C`.

Script hoạt động thuần Node nên tương thích với Windows 11 và không phụ thuộc shell đặc thù.

Nhờ đó việc đăng nhập bằng lệnh `pnpm dev` không còn gặp lỗi HTTP 500 khi backend chưa được mở riêng như trước.

### Tuỳ chọn khác

- `pnpm server`: chỉ khởi động backend (thích hợp cho môi trường staging hoặc khi muốn ghép với reverse proxy khác).
- `pnpm dev:frontend`: chỉ chạy Vite để phát triển giao diện, vẫn sử dụng proxy `/api` trỏ về `VITE_API_BASE` (mặc định `http://localhost:5000`).

> Nếu vẫn gặp lỗi native module, bạn có thể chủ động chạy `pnpm server:rebuild` hoặc `pnpm rebuild better-sqlite3` trước khi `pnpm dev`.

### Kết nối qua mạng LAN

Từ máy khác trong cùng mạng hãy truy cập `http://<IP_MAY_CHU>:5173` (ví dụ `http://192.168.1.114:5173`). Backend lắng nghe trên mọi địa chỉ (`0.0.0.0`) theo mặc định, đồng thời cho phép ghi đè thông qua biến môi trường `KPI_LISTEN_HOST` nếu bạn chỉ muốn phục vụ trên một IP cố định.

> **Ví dụ:**
>
> ```bash
> KPI_LISTEN_HOST=192.168.1.114 pnpm start
> ```
>
> Khi thay đổi port của backend, đừng quên cập nhật `VITE_API_BASE` trước khi chạy `pnpm dev` hoặc `pnpm dev:frontend`.

## 3. Triển khai cho môi trường vận hành nội bộ

1. Đóng gói giao diện:

   ```bash
   pnpm build
   ```

2. Khởi động máy chủ Express ở chế độ production:

   ```bash
   pnpm start
   ```

   Máy chủ sẽ phục vụ cả API `/api/...` lẫn nội dung tĩnh trong thư mục `dist/`.
   Lệnh `pnpm start` sử dụng script Node thuần nên tương thích Windows 11,
   tự đặt `NODE_ENV=production` và không còn phụ thuộc `cross-env`.
   Người dùng chỉ cần truy cập `http://<IP_MAY_CHU>:5000` (hoặc port bạn cấu
   hình). Có thể giới hạn địa chỉ lắng nghe bằng biến `KPI_LISTEN_HOST`, ví dụ
   `KPI_LISTEN_HOST=192.168.1.114 pnpm start`, và đổi port bằng `PORT=... pnpm start`.

### 3.1. Thiết lập cookie an toàn (KPI_COOKIE_SECURE)

Server đặt cookie phiên `kpi_session` dựa trên biến môi trường `KPI_COOKIE_SECURE`
để quyết định có bật cờ `secure` (chỉ gửi qua HTTPS) hay không. Các giá trị hỗ trợ:

- **Bỏ trống** hoặc `auto` *(mặc định)*: backend sẽ kiểm tra trực tiếp request để
  xác định giao thức thật. Cookie chỉ bật `secure` khi kết nối HTTPS hoặc
  request có header `X-Forwarded-Proto: https`. Cách này phù hợp cho máy chủ nội bộ
  truy cập qua HTTP và cho các reverse proxy có cấu hình chuẩn.
- `always`, `true`, `1`: luôn bật `secure` bất kể request đi qua HTTP hay HTTPS.
  Dùng khi backend chạy phía sau reverse proxy/ingress kết nối tới client bằng HTTPS
  nhưng chỉ chuyển tiếp HTTP xuống Node.js (ví dụ Nginx terminate TLS).
- `never`, `false`, `0`: luôn tắt `secure`, phù hợp cho môi trường LAN chỉ sử dụng HTTP
  và không muốn bắt buộc HTTPS.

| Giá trị `KPI_COOKIE_SECURE` | Điều kiện bật cờ `secure`                                                         | Môi trường khuyến nghị                                  | Ghi chú                                                                                             |
| --------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| *(trống)* / `auto` *(mặc định)* | Khi request thực sự đi qua HTTPS hoặc có header `X-Forwarded-Proto: https`.        | Reverse proxy chuẩn, môi trường nội bộ hỗn hợp HTTP/HTTPS | Ưu tiên tự động, không cần chỉnh tay khi proxy cấu hình đúng.                                       |
| `always` / `true` / `1`    | Luôn bật `secure` cho mọi request.                                               | Proxy/ingress HTTPS nhưng kết nối backend bằng HTTP      | Dùng khi không kiểm soát được `X-Forwarded-Proto` nhưng vẫn muốn đảm bảo cookie chỉ gửi qua HTTPS. |
| `never` / `false` / `0`    | Không bao giờ bật `secure`.                                                       | Máy trạm LAN nội bộ chỉ dùng HTTP                        | Tránh mất phiên khi chỉ có HTTP nội bộ; cần cân nhắc rủi ro khi truy cập qua mạng không an toàn.    |

> **Lưu ý khi đặt sau reverse proxy:** đảm bảo proxy luôn chuyển tiếp header
> `X-Forwarded-Proto` tương ứng với giao thức người dùng truy cập. Nếu không thể
> sửa proxy, hãy đặt `KPI_COOKIE_SECURE=always` để tránh mất phiên khi đăng nhập qua HTTPS.

> **Ví dụ `.env.production`**
>
> ```env
> # Chỉ bật `secure` khi request thực sự đi qua HTTPS hoặc proxy báo `X-Forwarded-Proto: https`
> KPI_COOKIE_SECURE=auto
> # Tùy chọn: giới hạn host và port backend khi chạy nội bộ
> KPI_LISTEN_HOST=0.0.0.0
> PORT=5000
> ```

> **Cấu hình header `X-Forwarded-Proto` phổ biến**
>
> - **Nginx**
>
>   ```nginx
>   location / {
>     proxy_set_header Host $host;
>     proxy_set_header X-Real-IP $remote_addr;
>     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
>     proxy_set_header X-Forwarded-Proto $scheme;
>     proxy_pass http://127.0.0.1:5000;
>   }
>   ```
>
> - **Traefik (file provider)**
>
>   ```yaml
>   http:
>     routers:
>       kpi:
>         rule: Host(`kpi.example.com`)
>         entryPoints: ["websecure"]
>         service: kpi
>         tls: {}
>     services:
>       kpi:
>         loadBalancer:
>           servers:
>             - url: "http://127.0.0.1:5000"
>   ```
>
>   Traefik tự động bổ sung `X-Forwarded-Proto=https` cho các entry point TLS, do đó backend sẽ bật `secure` mà không cần cấu hình bổ sung.

> `pnpm build` sẽ tự động chạy `pnpm healthcheck` trước khi đóng gói nhằm đảm
> bảo SQLite (và tuỳ chọn SQL Server) đã sẵn sàng. Bạn có thể gọi thủ công
> `pnpm healthcheck` sau khi cài đặt trên Windows để kiểm tra nhanh tình trạng
> môi trường trước khi triển khai.

### 3.2. Script PowerShell kiểm thử toàn diện

Để đảm bảo quy trình kiểm thử thống nhất trên Windows 11 Pro + PowerShell 7,
chúng tôi cung cấp `scripts/run-all-checks.ps1`. Script sẽ:

1. Kiểm tra phiên bản PowerShell/pnpm và tạo thư mục `.logs` lưu toàn bộ output.
2. Chạy lần lượt `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm test`,
   `pnpm build` và `pnpm test:screenshot`.
3. Tự dừng ngay khi có bước thất bại, trả về mã lỗi khác 0 để dễ dàng tích hợp
   vào quy trình CI/CD hoặc chạy thủ công.

```powershell
pwsh ./scripts/run-all-checks.ps1
```

Khi môi trường chưa sẵn sàng cho Playwright (thiếu trình duyệt, không cần ảnh
chụp), thêm tham số `-SkipScreenshots` để bỏ qua bước cuối cùng.

```powershell
pwsh ./scripts/run-all-checks.ps1 -SkipScreenshots
```

### 3.3. Lint/test tự động trước khi commit & trên CI

- Repo đã bật `simple-git-hooks`: sau mỗi lần `pnpm install` hệ thống tự cấu hình
  hook `pre-commit` chạy `pnpm lint` và `pnpm test -- --runInBand`. Nếu cần kiểm
  tra trước khi commit, chạy trực tiếp `pnpm precommit`.
- Workflow GitHub Actions `frontend-ci.yml` tiếp tục chạy lint/test trên Windows
  và Ubuntu. Khi muốn kiểm tra sâu hơn (bao gồm build và Playwright), hãy gọi
  script `pwsh ./scripts/run-all-checks.ps1` ngay trong pipeline hoặc máy cục bộ.

3. Tất cả dữ liệu (tờ khai, gán MST, quy tắc KPI, tài khoản, nhật ký…) được lưu
   trong `server/data/storage.sqlite`. Sao lưu file này định kỳ để tránh mất dữ
   liệu. Bạn có thể xóa `server/data/db.json` sau khi đã nâng cấp nếu không còn
   sử dụng bản lưu trữ cũ.

## 4. Khắc phục sự cố backend

Thông báo "Dữ liệu mới đang tạm lưu cục bộ vì backend chưa sẵn sàng đồng bộ." xuất hiện khi ứng dụng frontend phát hiện cờ `syncStatus.waitingForBackend` trong `src/App.jsx`. Điều này có nghĩa là dữ liệu người dùng vừa nhập chỉ mới được lưu tại trình duyệt và chưa thể gửi tới máy chủ.

Để khôi phục khả năng đồng bộ, hãy lần lượt thực hiện các bước sau:

1. Khởi động dịch vụ backend bằng `pnpm server` và đảm bảo tiến trình vẫn chạy ổn định.
2. Xác nhận cơ sở dữ liệu đã được tạo bằng cách chạy lại `pnpm db:init` nếu cần.
3. Kiểm tra log của tiến trình backend, đặc biệt thông báo "Lỗi ghi dữ liệu" để phát hiện sự cố ghi file hoặc quyền truy cập.
4. Xác minh biến môi trường `VITE_API_BASE` mà frontend đang sử dụng trỏ đúng tới địa chỉ backend.
- Nếu gặp lỗi `Cannot find module .../server/index.js`, hãy kiểm tra lại thư mục `server` (đặc biệt file `index.js`) có còn tồn tại hay không. Sao lưu và tải lại dự án nếu thiếu thư mục, sau đó quay lại [bước cài đặt](#1-cài-đặt) để chạy lại `pnpm install` và `pnpm db:init` trước khi khởi động backend.

Sau khi hoàn tất các bước trên, thông báo cảnh báo sẽ tự biến mất khi frontend đồng bộ thành công. Bạn cũng có thể tham khảo thêm phần [Kiểm thử](#7-kiểm-thử) để chạy `pnpm healthcheck` hỗ trợ tự chẩn đoán hệ thống.

## 5. Bootstrap tài khoản

Hệ thống không còn seed mật khẩu công khai trong mã nguồn. Với cơ sở dữ liệu
mới, hãy cấu hình ít nhất biến môi trường `KPI_BOOTSTRAP_ADMIN_PASSWORD` trước
khi đăng nhập lần đầu để tạo tài khoản `admin`.

Nếu muốn bật thêm các tài khoản mẫu khác ở lần bootstrap, hãy đặt biến theo
mẫu `KPI_BOOTSTRAP_PASSWORD_<USERNAME>`, trong đó `USERNAME` là username viết
hoa và thay ký tự không phải chữ/số bằng `_`. Ví dụ:

- `lead.phuong` -> `KPI_BOOTSTRAP_PASSWORD_LEAD_PHUONG`
- `manager.hoangkimhoa` -> `KPI_BOOTSTRAP_PASSWORD_MANAGER_HOANGKIMHOA`
- `nhanvien` -> `KPI_BOOTSTRAP_PASSWORD_NHANVIEN`

Sau khi bootstrap xong, bạn có thể tạo thêm tài khoản và phân quyền trong tab
**Tài khoản**. Mọi thao tác chỉnh sửa đều ghi lại trong tab **Nhật ký**.

## 6. Trợ lý AI tiết kiệm token

Từ phiên bản 3.0, backend bổ sung các route `/api/ai/...` cho phép cấu hình và
sử dụng trợ lý AI nội bộ mà không phụ thuộc vào máy khác. Tính năng này mặc định
đã bật với các thiết lập tiết kiệm token, đồng thời hỗ trợ chuyển đổi nhà cung
cấp linh hoạt:

| Route | Mô tả | Quyền yêu cầu |
| ----- | ----- | ------------- |
| `GET /api/ai/profile` | Trả về trạng thái rút gọn để người dùng biết nhà cung cấp đang bật, cache, TTL. | `aiAssistUse` |
| `GET /api/ai/config` | Đọc cấu hình AI hiện tại, trả về cả danh sách cache gần nhất. | `aiAssistManage` |
| `PUT /api/ai/config` | Cập nhật endpoint, prompt hệ thống, giới hạn token, TTL cache. | `aiAssistManage` |
| `DELETE /api/ai/cache` | Xóa toàn bộ cache để ép gọi lại mô hình. | `aiAssistManage` |
| `POST /api/ai/chat` | Gọi trợ lý AI với câu hỏi tiếng Việt, tự động dùng cache nếu có. | `aiAssistUse` |

## 7. Hướng dẫn triển khai trên Windows 11 Pro + SQL Server 2008 R2 + PowerShell 7

Tài liệu này tổng hợp các bước chuẩn hóa để chạy hệ thống đúng với môi trường
khách hàng (máy trạm Windows 11 Pro, kết nối cơ sở dữ liệu ECUS5VNACCS trên SQL
Server 2008 R2, shell mặc định PowerShell 7).

### 7.1. Chuẩn bị môi trường

1. **Cài đặt phần mềm bắt buộc**
   - [Node.js 18 LTS](https://nodejs.org/) bản dành cho Windows (kèm theo `npm`).
   - [pnpm](https://pnpm.io/installation) thông qua PowerShell:

     ```powershell
     iwr https://get.pnpm.io/install.ps1 -useb | iex
     ```

   - **PowerShell 7** (nếu máy chưa có) từ Microsoft Store hoặc MSI chính thức.
   - **Visual Studio Build Tools 2019 trở lên** với workload "Desktop development with C++" để biên dịch `better-sqlite3`.
   - **ODBC Driver 17 for SQL Server** (hoặc driver tương thích với SQL Server 2008 R2) để kết nối ECUS.

2. **Thiết lập biến môi trường** (chạy trong PowerShell 7 với quyền admin):

   ```powershell
   [System.Environment]::SetEnvironmentVariable('KPI_LISTEN_HOST', '0.0.0.0', 'Machine')
   [System.Environment]::SetEnvironmentVariable('ECUS_SQL_SERVER', 'TEN_MAY_CHU_SQL', 'Machine')
   [System.Environment]::SetEnvironmentVariable('ECUS_SQL_DATABASE', 'ECUS5VNACCS', 'Machine')
   [System.Environment]::SetEnvironmentVariable('ECUS_SQL_USER', 'ten_dang_nhap', 'Machine')
   [System.Environment]::SetEnvironmentVariable('ECUS_SQL_PASSWORD', 'mat_khau', 'Machine')
   ```

   Có thể thay `'Machine'` bằng `'User'` nếu chỉ áp dụng cho người dùng hiện tại. Sau
   khi đặt biến, hãy mở cửa sổ PowerShell mới trước khi chạy dự án.

3. **Kiểm tra kết nối SQL Server 2008 R2**:

   ```powershell
   Test-NetConnection -ComputerName TEN_MAY_CHU_SQL -Port 1433
   ```

   Nếu kết quả `TcpTestSucceeded` là `False`, hãy kiểm tra firewall và đảm bảo SQL
   Server bật chế độ "SQL Server and Windows Authentication". Bạn cũng nên mở SQL
   Server Configuration Manager để bật TCP/IP.

### 7.2. Thiết lập mã nguồn

1. Mở PowerShell 7 **Run as Administrator** và clone repo:

   ```powershell
   git clone https://example.com/kpi_source_code_v3.git
   cd kpi_source_code_v3
   ```

2. Cài đặt phụ thuộc:

   ```powershell
   pnpm install
   pnpm db:init
   pnpm healthcheck
   ```

   `pnpm healthcheck` giúp xác nhận driver SQLite, kiểm tra dung lượng sao lưu,
   ổ đĩa và trạng thái SQL Server. Khi phát hiện vấn đề, script hiển thị chi tiết
   từng cảnh báo để bạn xử lý kịp thời.

3. Khởi chạy môi trường phát triển:

   ```powershell
   pnpm dev
   ```

   Cửa sổ PowerShell sẽ hiển thị log backend và frontend. Địa chỉ truy cập mặc
   định:
   - Frontend: http://localhost:5173
   - API backend: http://localhost:5000

   > **Kiểm thử nhanh:** sử dụng `pnpm test tests/automation.flows.test.js` để
   > chạy bộ test tích hợp các quy trình chính (import tờ khai, gán MST, điểm KPI,
   > phân quyền). Lệnh `pnpm test` sẽ chạy toàn bộ test suite bao gồm bài kiểm
   > thử mới này.

### 7.3. Đồng bộ dữ liệu ECUS5VNACCS

1. Đảm bảo tài khoản ECUS có quyền đọc bảng tờ khai (`dbo.HoSoHaiQuan` hoặc tên
   tương ứng) và các view liên quan.
2. Mở file cấu hình `config/ecus.json` (nếu có) hoặc sử dụng UI trong tab **Import
   Data** để nhập lại thông tin kết nối. Ứng dụng sẽ ưu tiên biến môi trường nếu có.
3. Trong PowerShell, dùng script kiểm tra thử kết nối:

   ```powershell
   pnpm sql:ping
   ```

   Script sẽ báo thành công/ thất bại và gợi ý điều chỉnh timeout (`ECUS_SQL_REQUEST_TIMEOUT`).

### 7.4. Quy trình build & triển khai nội bộ

1. Build frontend:

   ```powershell
   pnpm build
   ```

2. Khởi động backend production (có thể tạo shortcut `.ps1` chạy cùng lúc):

   ```powershell
   pnpm start
   ```

3. Đặt shortcut trong `Task Scheduler` hoặc `shell:startup` để tự khởi động cùng Windows.
4. Sao lưu thư mục `server/data/` và database SQL Server trước mỗi lần cập nhật.

#### Lập lịch giám sát đồng bộ ECUS

- Dùng script PowerShell `./scripts/schedule-ecus-monitor.ps1` để đăng ký tác vụ
  chạy `monitor-ecus-sync.ps1` mỗi 5 phút. Script này yêu cầu biến môi trường
  `MONITOR_ACCESS_TOKEN` (hoặc truyền trực tiếp `-MonitorToken`) trùng với cấu
  hình backend.
- Ví dụ: `pwsh ./scripts/schedule-ecus-monitor.ps1 -MonitorToken 'token-bi-mat'`
  sẽ tạo tác vụ chạy bằng tài khoản SYSTEM và kích hoạt lần đầu ngay lập tức.
- Khi cần gỡ bỏ tác vụ, chạy lại script với tham số `-Remove`.

### 7.5. Các lỗi thường gặp trên Windows 11

- **Lỗi `better-sqlite3.node` thiếu**: chạy `pnpm rebuild better-sqlite3` trong PowerShell 7 (Run as Administrator).
- **Không kết nối được SQL Server**: kiểm tra lại driver ODBC, bật port 1433 và đảm bảo người dùng có quyền `db_datareader`.
- **PowerShell Execution Policy**: nếu script `.ps1` bị chặn, dùng `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

> Ghi chú: toàn bộ lệnh PowerShell ở trên tương thích với Windows Terminal. Nếu cần chạy trong PowerShell 5.1, hãy đảm bảo đã cài module
> `Invoke-WebRequest` cập nhật và sử dụng encoding UTF-8 khi chỉnh sửa file cấu hình để tránh lỗi Unicode.

Giao diện **Trợ lý AI** (tab mới trong dashboard) cho phép:

- Người dùng có quyền `aiAssistUse` trò chuyện trực tiếp, đính kèm ngữ cảnh và chọn nhà cung cấp nếu cần.
- Quản trị viên cấu hình prompt hệ thống, chuyển đổi giữa Azure OpenAI / Google AI Studio / Ollama, điều chỉnh TTL cache và xem cache gần nhất.

### 6.1. Biến môi trường hỗ trợ Azure OpenAI, Google AI Studio & Ollama

```env
# Azure OpenAI (gợi ý dùng GPT-4o mini để tối ưu chi phí)
AZURE_OPENAI_ENDPOINT=https://<tên-resource>.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_KEY=<mã khóa bí mật>
AZURE_OPENAI_API_VERSION=2024-08-01-preview

# Google AI Studio (Gemini, yêu cầu bật API Generative Language)
GOOGLE_AI_STUDIO_API_KEY=<api key của dự án Google>
# Tuỳ chọn: ghi đè endpoint và model nếu không dùng mặc định
# GOOGLE_AI_STUDIO_ENDPOINT=https://generativelanguage.googleapis.com
# GOOGLE_AI_STUDIO_MODEL=gemini-1.5-flash

# Tuỳ chọn: Ollama nội bộ (Windows 11 có thể chạy qua WSL)
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

Nếu không đặt biến môi trường, server vẫn tạo cấu hình mặc định và cho phép quản
trị viên chỉnh sửa trong runtime bằng API kể trên.

### 6.2. Cơ chế tiết kiệm token

- Prompt và ngữ cảnh luôn được cắt xuống tối đa 4000 ký tự trước khi gửi.
- Cache lưu trong SQLite (`kv_store`) với TTL mặc định 72 giờ và tối đa 50 mục.
- Khi cache trùng khớp hash (provider + scope + prompt + ngữ cảnh), backend trả
  lời ngay mà không gọi ra ngoài.
- Usage (số token prompt/completion) được trả về để admin theo dõi ngân sách.

### 6.3. Ví dụ gọi thử

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token đăng nhập>" \
  http://localhost:5000/api/ai/chat \
  -d '{
    "scope": "bao-cao",
    "prompt": "Tóm tắt điểm KPI cộng/trừ của tháng 8 cho phòng khai báo",
    "context": "Tháng 8 có 4 nhân viên được cộng thêm điểm hỗ trợ thông quan."
  }'
```

Nếu server trả về `{ "cached": true }`, nghĩa là câu hỏi tương tự đã được xử lý
trong 72 giờ gần nhất nên không phát sinh chi phí token.

### Đồng bộ quyền tài khoản với SQL Server

- Backend tự động lấy và đẩy dữ liệu bảng `[dbo].[KPI_USER_ROLES]` (có thể đổi tên qua biến môi trường `KPI_ACCOUNT_SYNC_TABLE`) nhằm tránh ghi đè quyền đã cấu hình trên hệ thống kế thừa.
- Khi thao tác với tài khoản, trường `updatedAt` sẽ được cập nhật và xuất hiện trong bản ghi SQLite để so sánh với cột `updated_at` trên SQL Server, bảo đảm bản ghi mới nhất luôn được ưu tiên.
- Trước khi kích hoạt đồng bộ, hãy cấu hình `ECUS_SQL_SERVER` bằng tên máy chủ thật. Nếu để nguyên giá trị mặc định `Server`, ứng dụng sẽ bỏ qua việc kết nối để tránh phát sinh lỗi khi môi trường chưa sẵn sàng.
- Bảng đồng bộ yêu cầu tối thiểu các cột `username`, `password_hash`, `role`, `name`, `permissions` (chuỗi JSON) và `updated_at` kiểu `DATETIME`.

## 8. Kiểm thử

```bash
pnpm lint
pnpm test -- --runInBand
```

Các bài test sử dụng Vitest (môi trường `jsdom`) và khởi động mock backend
ngay trong tiến trình kiểm thử, vì vậy không cần chạy server riêng.

> **Mẹo cho môi trường chưa sẵn SQL Server/Ollama:** đặt biến môi trường
> `KPI_SKIP_EXTERNAL_TESTS=1` trước khi gọi `pnpm test` (hoặc `pnpm precommit`).
> Khi đó các nhóm kiểm thử tích hợp phụ thuộc SQL Server hoặc Ollama sẽ được
> `skip`, giúp rút ngắn thời gian chạy trên máy trạm nhưng vẫn giữ nguyên phạm vi
> kiểm thử đầy đủ trên CI.

### Kiểm thử API backend

Để kiểm tra các route đồng bộ ECUS và cảnh báo tờ khai, Vitest đã bổ sung
integration test dùng `supertest`. Các test này tự động tạo cơ sở dữ liệu
SQLite trong bộ nhớ (`:memory:`) và mô phỏng kết nối SQL Server, giúp phát hiện
lỗi kết nối hoặc mapping dữ liệu ngay trên CI.

## 9. Công cụ hỗ trợ dữ liệu ECUS

Các tác vụ CLI mới giúp kiểm thử/khảo sát dữ liệu ECUS khi chưa kết nối được
SQL Server thật:

- `pnpm ecus:mock [--count 50 --start 2025-08-01 --range 10 --output mock.json]`
  tạo danh sách tờ khai giả lập đúng định dạng API (mặc định in ra STDOUT).
- `pnpm ecus:inspect --file <đường-dẫn-tệp-xml>` phân tích file XML xuất từ
  ECUS5VNACCS, liệt kê đường dẫn nút tờ khai cùng các trường quan trọng
  (Số tờ khai, ngày đăng ký, MST, doanh nghiệp, loại hình, giấy phép...).

Bạn có thể dùng dữ liệu mock để chạy thử `/api/import/ecus/run` mà không cần
kết nối tới SQL Server, hoặc dùng lệnh `inspect` để xác định rõ tên cột trước
khi viết câu truy vấn đồng bộ.

## 10. Kế hoạch triển khai chi tiết cho Windows 11 & phân quyền

Trước khi mở rộng triển khai cho toàn bộ đội ngũ, vui lòng tham khảo tài liệu
[docs/windows11-permission-plan.md](docs/windows11-permission-plan.md) để nắm
rõ kiến trúc, ma trận quyền và lộ trình kiểm thử hồi quy nhằm tránh phát sinh
sai lệch dữ liệu khi vận hành trên Windows 11.

Trong quá trình tạo Pull Request nếu gặp thông báo "Tệp nhị phân không được hỗ trợ" đối với file ảnh template, tham khảo thêm
[docs/troubleshooting-pr-binary.md](docs/troubleshooting-pr-binary.md) để hiểu nguyên nhân và hướng xử lý.

## 11. Định hướng giao diện & tính năng tương lai

Để đáp ứng yêu cầu hiện đại hóa, gom gộp chức năng và bổ sung cơ chế chuyển đổi giao diện sáng/tối, vui lòng tham khảo tài liệu [Đề xuất cải tiến giao diện và tính năng nâng cao](docs/de-xuat-giao-dien-hien-dai.md). Tài liệu này tổng hợp lộ trình triển khai, bao gồm xây dựng design system, trung tâm điều phối dữ liệu, theme Light/Dark và nâng cấp trải nghiệm chatbot AI.

- ✅ *Giai đoạn 1* – Hoàn tất nền tảng design system và theme Light/Dark cho toàn bộ dashboard KPI.
- ✅ *Giai đoạn 2* – Trung tâm điều phối dữ liệu với quick action, chỉ báo sức khỏe dữ liệu và bộ lọc yêu thích đã sẵn sàng sử dụng trong module Import Data.
- ✅ *Giai đoạn 3* – Hoàn thiện trợ lý AI đa chế độ, trung tâm thông báo real-time và tab "Sức khỏe dữ liệu" để giám sát chất lượng vận hành.
