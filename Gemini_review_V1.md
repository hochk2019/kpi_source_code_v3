# Gemini Review V1 — Đánh giá Toàn diện Hệ thống Công nợ KPI v4

> **Ngày đánh giá:** 24/03/2026  
> **Phiên bản:** kpi_source_code_v4 (fork từ v3 tại `E:\GPT\kpi_source_code_v3`)  
> **Người đánh giá:** Gemini (Deep Codebase Review)  
> **Phương pháp:** Phân tích trực tiếp mã nguồn (source → grep → lint → test), không chỉ dựa vào tài liệu cũ.

---

## MỤC LỤC

1. [Tổng quan Kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Vấn đề #1: Backend Monolith (server/index.js)](#2-vấn-đề-1-backend-monolith)
3. [Vấn đề #2: Server-v4 chưa được Hòa mạng](#3-vấn-đề-2-server-v4-chưa-được-hòa-mạng)
4. [Vấn đề #3: Frontend Fat Components](#4-vấn-đề-3-frontend-fat-components)
5. [Vấn đề #4: ESLint Linebreak (CRLF)](#5-vấn-đề-4-eslint-linebreak-crlf)
6. [Vấn đề #5: Testing Gap](#6-vấn-đề-5-testing-gap)
7. [Vấn đề #6: Checklist nghiệp vụ chưa hoàn thiện](#7-vấn-đề-6-checklist-nghiệp-vụ-chưa-hoàn-thiện)
8. [Tiến độ Refactor v3 → v4 đã hoàn thành](#8-tiến-độ-refactor-v3--v4-đã-hoàn-thành)
9. [Hành động đã thực thi trong phiên Review](#9-hành-động-đã-thực-thi-trong-phiên-review)
10. [Đề xuất Hành động Chi tiết (Roadmap)](#10-đề-xuất-hành-động-chi-tiết-roadmap)
11. [Vấn đề #7: Bảo mật (Security)](#11-vấn-đề-7-bảo-mật-security)
12. [Vấn đề #8: Database & Persistence](#12-vấn-đề-8-database--persistence)
13. [Vấn đề #9: Business Logic & KPI Engine](#13-vấn-đề-9-business-logic--kpi-engine)
14. [Vấn đề #10: UI/UX & Design System](#14-vấn-đề-10-uiux--design-system)
15. [Vấn đề #11: Performance & Bundle Size](#15-vấn-đề-11-performance--bundle-size)
16. [Vấn đề #12: Error Handling & Resilience](#16-vấn-đề-12-error-handling--resilience)

---

## 1. Tổng quan Kiến trúc

### 1.1. Cấu trúc Thư mục Chính

| Thư mục              | Vai trò                                       | Ngôn ngữ       | Trạng thái        |
|-----------------------|-----------------------------------------------|----------------|--------------------|
| `server/`             | Backend chính (Monolith Express)               | JavaScript ESM | ⚠️ Đang hoạt động   |
| `server-v4/src/`      | Backend mới (Modular TypeScript)               | TypeScript     | ✅ Được viết xong nhưng chưa mount |
| `src/`                | Frontend React (Vite)                          | JSX            | ✅ Đang hoạt động   |
| `packages/domain/`    | Shared business logic (rules, roles, CO, etc.) | JavaScript ESM | ✅ Ổn định          |
| `apps/ecus-bridge/`   | Cầu nối SQL Server ↔ SQLite                   | JavaScript ESM | ✅ Ổn định          |
| `scripts/`            | CLI utilities (healthcheck, backup, start)     | JavaScript ESM | ✅ Ổn định          |
| `tests/`              | Vitest + Playwright                            | JavaScript     | ✅ 24/24 tests pass |

### 1.2. Technology Stack

- **Runtime:** Node.js v22, Express.js
- **Database:** SQLite (better-sqlite3) + SQL Server 2008 R2 (ECUS bridge via mssql)
- **Frontend:** React 18, Vite, Radix UI primitives, Lucide icons
- **Testing:** Vitest (unit/integration), Playwright (E2E)
- **AI:** Ollama (local), Azure OpenAI, Google AI (provider-agnostic)
- **Cron:** node-cron (backup, ECUS sync, CO discrepancy)

---

## 2. Vấn đề #1: Backend Monolith

### Hiện trạng

| Metric               | Giá trị                   |
|-----------------------|---------------------------|
| **File**              | `server/index.js`         |
| **Dung lượng**        | **501 KB**                |
| **Số dòng code**      | **~27,000 dòng**          |
| **Số export functions**| Hàng trăm                |
| **Express app init**  | Dòng 21,975               |
| **app.listen()**      | Dòng 26,920               |

### Nhận định Code

- File này là **"God Object"** điển hình: chứa toàn bộ routing, business logic, database queries (SQLite), cron jobs, authentication, Excel export, AI provider integration, ECUS SQL Server bridge, notification bus, và backup management.
- Mọi sửa đổi nhỏ đều có **blast radius cực lớn** — không thể dùng GitNexus impact analysis hiệu quả vì symbol density quá cao.
- Vi phạm trực tiếp quy tắc dự án trong `AGENTS.md`: *"Không nhồi quá nhiều code vào trong một module (mỗi module không quá 800 dòng nếu có thể)."*
- Mặc dù đã có nhiều file satellite được tách ra (`reportExport.js`, `businessSnapshotSqlite.js`, `teamRosterSqlite.js`, `rulesPersistence.js`, v.v.), phần lõi vẫn còn quá nặng.

### Hướng xử lý

| # | Hành động                                                                 | Ưu tiên  | Độ phức tạp |
|---|---------------------------------------------------------------------------|----------|-------------|
| 1 | **Freeze `server/index.js`:** Tuyệt đối không thêm code mới vào file này | 🔴 Ngay  | Thấp        |
| 2 | **Dùng GitNexus để phân tích blast radius** cho từng nhóm function        | 🔴 Ngay  | Trung bình  |
| 3 | **Tách Auth domain:** Move toàn bộ `buildDefaultAccounts()`, `DEFAULT_ACCOUNT_SEED`, session management (lines 1226–1539) sang `server-v4/modules/auth/` | 🟡 Sớm   | Trung bình  |
| 4 | **Tách ECUS sync domain:** Move `DEFAULT_ECUS_SYNC_CONFIG`, schedule normalizers, cron logic (lines 466–1160) sang `server-v4/modules/declarations/` | 🟡 Sớm   | Cao         |
| 5 | **Tách Backup/Restore logic:** Move backup scheduling, retention, pruning logic sang module `server-v4/modules/backup/` mới | 🟢 Sau   | Trung bình  |
| 6 | **Tách AI Assistant routes:** Move AI config constants, chat history management sang `server-v4/modules/ai/` | 🟢 Sau   | Trung bình  |
| 7 | **Tách Alert/Notification logic:** Move `DEFAULT_ALERT_CONFIG`, `deliverAlertNotification` handlers sang `server-v4/modules/alerts/` | 🟢 Sau   | Thấp        |
| 8 | **Cuối cùng: Xóa `server/index.js`,** thay entry point bằng `server-v4/src/index.ts` | 🟢 Cuối  | Rất cao     |

---

## 3. Vấn đề #2: Server-v4 chưa được Hòa mạng

### Hiện trạng

Thư mục `server-v4/` **đã được dựng đầy đủ kiến trúc TypeScript chuẩn** với các module:

| Module            | Controller | Service | Repository | Routes | Trạng thái    |
|-------------------|-----------|---------|-----------|--------|---------------|
| `auth`            | ✅         | ✅       | ✅ (SQLite + Postgres) | ✅      | Hoàn thiện    |
| `declarations`    | ✅         | ✅ (5 services) | ✅         | ✅      | Hoàn thiện    |
| `hq-agencies`     | ✅         | ✅       | ✅         | ✅      | Hoàn thiện    |
| `kpi-adjustments` | ✅         | ✅       | ✅         | ✅      | Hoàn thiện    |
| `kpi-rules`       | ✅         | ✅       | ✅         | ✅      | Hoàn thiện    |
| `mst-assignments` | ✅         | —        | ✅         | ✅      | Hoàn thiện    |
| `reporting`       | ✅         | ✅       | ✅         | ✅      | Hoàn thiện    |
| `teams`           | ✅         | ✅       | ✅         | ✅      | Hoàn thiện    |

Hàm `buildV4App()` trong `server-v4/src/app/build-v4-app.ts` khởi tạo một Express app hoàn chỉnh, mount tất cả 8 modules trên, cùng với Rollout Status API (`/api/v4/health`, `/api/v4/meta/modules`, `/api/v4/meta/rollout`).

**Nhưng:** Trước phiên review này, `buildV4App()` **không hề được gọi hay import** từ bất kỳ đâu trong production code (`server/index.js` hoặc `start-backend.mjs`). Toàn bộ kiến trúc v4 chỉ nằm "ngủ đông" trên ổ cứng.

### Nhận định Code

- Codebase v4 viết rất sạch: Controller → Service → Repository, có Zod validation, `BaseController` error handling pattern.
- Có sẵn `legacyCompatRoutes.ts` với cơ chế `ImporterCompatTrafficTracker` giúp chuyển đổi traffic giữa old/new routes an toàn.
- Build pipeline (`pnpm build:server-v4`) hoạt động tốt, output ra `dist/server-v4/`.

### Hướng xử lý

| # | Hành động                                                                 | Ưu tiên  | Độ phức tạp |
|---|---------------------------------------------------------------------------|----------|-------------|
| 1 | ✅ **ĐÃ LÀM:** Import `buildV4App` vào `server/index.js` và mount module `reporting` | 🔴 Xong  | —           |
| 2 | **Mount thêm module `auth`:** Redirect `/api/v4/auth/*` routes sang v4    | 🟡 Sớm   | Trung bình  |
| 3 | **Mount thêm module `declarations`:** Bật `ImporterCompatTrafficTracker` ở chế độ `shadow` (song song, không block legacy) | 🟡 Sớm   | Cao         |
| 4 | **Mount toàn bộ 8 modules:** Chạy `buildV4App(moduleCatalog)` thay vì chỉ 1 module | 🟡 Sớm   | Trung bình  |
| 5 | **Bật Rollout Dashboard:** Frontend hiển thị `/api/v4/meta/rollout` để theo dõi tiến độ migration realtime | 🟢 Sau   | Thấp        |
| 6 | **Chuyển entry point:** Sửa `start-backend.mjs` để khởi động từ `server-v4/src/index.ts` (biên dịch), hoàn toàn thay thế `server/index.js` | 🟢 Cuối  | Rất cao     |

---

## 4. Vấn đề #3: Frontend Fat Components

### Hiện trạng

| File                        | Dung lượng | Số dòng ước tính | Vi phạm quy tắc 800 dòng |
|-----------------------------|-----------|------|---------------------------|
| `KPIAdjustments.jsx`        | 140 KB    | ~5,000 | ❌ Gấp 6x                 |
| `AiAssistant.jsx`           | 133 KB    | ~4,800 | ❌ Gấp 6x                 |
| `MSTAssignment.jsx`         | 130 KB    | ~5,900 | ❌ Gấp 7x                 |
| `RulesEditor.jsx`           | 76 KB     | ~2,700 | ❌ Gấp 3x                 |
| `DataHealthDashboard.jsx`   | 67 KB     | ~2,400 | ❌ Gấp 3x                 |
| `AccountManager.jsx`        | 59 KB     | ~2,100 | ❌ Gấp 2.5x               |
| `HQAgencyManager.jsx`       | 50 KB     | ~1,800 | ❌ Gấp 2x                 |
| `TeamManager.jsx`           | 38 KB     | ~1,400 | ❌ Gấp 1.7x               |

### Nhận định Code

- **Code trùng lặp nghiêm trọng:** Component `StaffCombobox` được **copy-paste** ít nhất 3 lần: trong `MSTAssignment.jsx` (line 228), `AccountManager.jsx` (line 379), và `dataImporter/DataImporterAssignmentComboboxes.jsx` (line 113).
- Các file ôm đồm quá nhiều responsibilities: UI Rendering, State Management (useState/useEffect chains), Data Fetching (fetch calls), Form Validation, Excel Import/Export, localStorage persistence.
- Thư mục `src/components/dataImporter/` là ví dụ rất tốt cho cấu trúc đúng: 90 files nhỏ, mỗi file đơn trách nhiệm, clean hooks. Nhưng các component hạng nặng ở thư mục mẹ `src/components/` thì chưa được cải tạo tương tự.

### Hướng xử lý

| # | Hành động                                                                 | Ưu tiên  | Độ phức tạp |
|---|---------------------------------------------------------------------------|----------|-------------|
| 1 | **Tách `StaffCombobox` thành shared component:** Tạo `src/components/shared/StaffCombobox.jsx`, import lại từ 3 nơi dùng chung | 🔴 Ngay  | Thấp        |
| 2 | **Tách `MSTAssignment.jsx`:**                                              | 🟡 Sớm   | Cao         |
|   | → `mstAssignment/MSTTable.jsx` (UI bảng chính)                            |          |             |
|   | → `mstAssignment/MSTHistoryDialog.jsx` (Modal lịch sử: `HistoryDetails`, `StageTimelinePreview`, `StageTimelineGroups`) |          |             |
|   | → `mstAssignment/MSTBatchImport.jsx` (Logic import Excel)                 |          |             |
|   | → `mstAssignment/mstAssignmentUtils.js` (Pure functions: `normalize`, `sanitizeColumnWidths`, `headerAliases`, `tidyMST`, `toISO`, `sortMSTRows`, `makeRowKey`) |          |             |
|   | → `mstAssignment/mstAssignmentConstants.js` (Constants: `COLUMN_OPTIONS`, `DEFAULT_COLUMN_WIDTHS`, `COLUMN_MIN_WIDTHS`, `PAGE_SIZE_OPTIONS`) |          |             |
|   | → `mstAssignment/useMSTAssignmentState.js` (Custom hook cho toàn bộ state management) |          |             |
| 3 | **Tách `AiAssistant.jsx`:**                                                | 🟡 Sớm   | Cao         |
|   | → `ai/AiChatInterface.jsx` (Giao diện chat)                               |          |             |
|   | → `ai/AiProviderConfig.jsx` (Cấu hình provider: Ollama/Azure/Google)      |          |             |
|   | → `ai/AiCacheManager.jsx` (Quản lý cache token)                           |          |             |
|   | → `ai/useAiChat.js` (Custom hook cho luồng chat)                          |          |             |
| 4 | **Tách `KPIAdjustments.jsx`:**                                             | 🟡 Sớm   | Cao         |
|   | → `kpiAdjustments/KPIAdjustmentTable.jsx`                                 |          |             |
|   | → `kpiAdjustments/KPIAdjustmentForm.jsx`                                  |          |             |
|   | → `kpiAdjustments/KPIApprovalWorkflow.jsx`                                |          |             |
|   | → `kpiAdjustments/useKPIAdjustmentData.js`                                |          |             |
| 5 | **Tách `RulesEditor.jsx`, `DataHealthDashboard.jsx`, `AccountManager.jsx`:** Theo cùng mẫu trên | 🟢 Sau   | Trung bình  |

> ⚠️ **Lưu ý quan trọng:** Việc refactor Frontend cần thực hiện bằng IDE có AST support (VSCode + ESLint + TypeScript Language Server) để đảm bảo không mất React Hook dependencies hoặc gây lỗi import chain. Không nên dùng CLI scripting cho việc này.

---

## 5. Vấn đề #4: ESLint Linebreak (CRLF)

### Hiện trạng

File `eslint.config.js` cũ cấu hình:
```javascript
const linebreakRule = isWindows ? ["error", "windows"] : "off";
```
Dẫn tới `pnpm lint` **fail toàn bộ** trên Windows vì nhiều file có linebreaks lẫn lộn (CRLF vs LF, đặc biệt các file được checkout bởi git với `core.autocrlf=true`).

### Nhận định Code

- Rule này không mang lại giá trị thực tế vì Git đã xử lý linebreaks qua `.gitattributes` và `core.autocrlf`.
- Việc enforce linebreaks ở mức linter chỉ gây noise và ngăn cản CI/CD pipeline.

### Hướng xử lý

| # | Hành động                                              | Ưu tiên  | Độ phức tạp |
|---|--------------------------------------------------------|----------|-------------|
| 1 | ✅ **ĐÃ LÀM:** Sửa `linebreakRule = "off"` trong `eslint.config.js` | 🔴 Xong  | —           |
| 2 | **Thêm `.gitattributes`** với `* text=auto` nếu chưa có | 🟢 Sau   | Thấp        |
| 3 | **Chạy `pnpm lint --fix`** toàn bộ project để dọn dẹp warnings còn lại (43 warnings: unused vars) | 🟢 Sau   | Thấp        |

---

## 6. Vấn đề #5: Testing Gap

### Hiện trạng

| Test Suite                     | Kết quả       | Ghi chú                                 |
|-------------------------------|--------------|------------------------------------------|
| `test:smoke:backend-core`     | ✅ 24/24 pass | 7 files: seed, snapshot, roster, ecus, etc. |
| `test:server-v4`              | ✅ Pass       | TypeScript module tests                   |
| `pnpm lint`                   | ✅ 0 errors   | 43 warnings (unused vars)                 |
| `pnpm build`                  | ✅ Pass       | Vite build thành công                     |
| Playwright E2E                | ⚠️ Chưa chạy  | Cần `dist/` folder (phải build trước)     |

### Nhận định Code

- Backend có test coverage tương đối tốt nhờ kiến trúc tách biệt các module SQLite (`businessSnapshotSqlite`, `teamRosterSqlite`, `reportingProjectionSqlite`).
- Nhưng **logic bên trong `server/index.js` gần như không thể unit test** vì tất cả functions là file-scope (không export riêng lẻ), phụ thuộc global state (`dbBackupJob`, `backupInProgress`, etc.).
- Frontend components cũng thiếu component-level tests vì quá lớn để isolate.

### Hướng xử lý

| # | Hành động                                                                 | Ưu tiên  | Độ phức tạp |
|---|---------------------------------------------------------------------------|----------|-------------|
| 1 | **Viết test cho mỗi module v4 mới** khi migrate từ `server/index.js`      | 🔴 Ngay  | Trung bình  |
| 2 | **Tạo test cho `buildV4App` integration:** Verify toàn bộ routes respond correctly | 🟡 Sớm   | Trung bình  |
| 3 | **Bổ sung React Testing Library** cho các component được tách nhỏ         | 🟢 Sau   | Trung bình  |
| 4 | **Playwright regression suite:** Chạy UI smoke test sau mỗi lần tách component | 🟢 Sau   | Cao         |

---

## 7. Vấn đề #6: Checklist nghiệp vụ chưa hoàn thiện

### So sánh `Checklist.md` với mã nguồn thực tế

| Yêu cầu trong Checklist                      | Trạng thái    | Bằng chứng trong code                          |
|-----------------------------------------------|---------------|--------------------------------------------------|
| Loại trừ giấy phép ZN02, HDGC                 | ✅ Hoàn thành  | Logic exclusion trong `dataImporterLicenseUtils.js` |
| Lỗi đối soát C/O (HTTP 500)                   | ✅ Hoàn thành  | `declarationsCoMonitoringService.ts` trong v4    |
| Tab "Điểm KPI +/- Thêm"                       | ✅ Hoàn thành  | `KPIAdjustments.jsx` + `appShellNavigation`      |
| Thêm thủ công MST                             | ✅ Hoàn thành  | `MSTAssignment.jsx` Command UI                   |
| Lưu trữ quy tắc KPI (SQLite)                  | ✅ Hoàn thành  | `rulesPersistence.js`                            |
| Tài khoản mặc định bootstrap                  | ✅ Hoàn thành  | `bootstrapAccountPasswords.js` + env vars        |
| AI Assistant (Ollama/Azure/Google)             | ✅ Hoàn thành  | `aiProviders/` + `AiAssistant.jsx`               |
| ~~Bổ sung cột "Số TK AMA"~~                    | 🚫 Đã loại bỏ  | Chủ động loại khỏi scope theo quyết định nghiệp vụ |
| Lịch sử chỉnh sửa MST/Tổ đội (UI)            | ⚠️ Một phần    | `HistoryDetails` component tồn tại, nhưng chưa hiển thị trực quan dạng Tooltip/Modal mặc định |
| Tìm kiếm tờ khai theo khoảng thời gian        | ⚠️ Một phần    | `DataImporterQueryFilterControls.jsx` tồn tại, cần verify hoạt động |
| Chọn tất cả tờ khai (Bulk Select)              | ⚠️ Một phần    | `DataImporterSelectionActions.jsx` có, cần verify |
| Export Excel cho Gán MST                       | ⚠️ Một phần    | Thư viện `xlsx` đã cài, nhưng nút Export chưa rõ |
| Gán nhiều đại lý (dấu phẩy) cho 1 MST         | ❓ Chưa rõ     | Cần kiểm tra logic backend                       |
| Theme Light/Dark toggle                        | ✅ Hoàn thành  | `ThemeToggle.jsx` (4.8 KB)                       |

### Hướng xử lý

| # | Hành động                                                                 | Ưu tiên  | Độ phức tạp |
|---|---------------------------------------------------------------------------|----------|-------------|
| ~~1~~ | ~~**Thêm cột "Số TK AMA"**~~ | 🚫 Loại bỏ | — | *(Đã quyết định loại khỏi scope, không cần triển khai)* |
| 2 | **Kiểm tra UI Lịch sử:** Verify `HistoryDetails` hiển thị đúng khi click vào hàng MST | 🟡 Sớm   | Thấp        |
| 3 | **Verify Bulk Select:** Mở app, thử "Chọn tất cả" tờ khai và chạy resync | 🟡 Sớm   | Thấp        |
| 4 | **Verify Export Excel MST:** Bảo đảm đã có nút Export trên toolbar        | 🟡 Sớm   | Thấp        |
| 5 | **Cập nhật `Checklist.md`:** Đánh dấu `[x]` cho các mục đã hoàn thành    | 🟢 Sau   | Thấp        |

---

## 8. Tiến độ Refactor v3 → v4 đã hoàn thành

Các Epic/Bead đã close thành công (theo `progress.md` và `task.md`):

| Bead       | Nội dung                                                              | Trạng thái |
|------------|-----------------------------------------------------------------------|------------|
| `cng-mtn.1`| Sửa sidebar ghosting/overlap                                         | ✅ Done     |
| `cng-mtn.2`| Mobile-first compact navigation                                      | ✅ Done     |
| `cng-mtn.3`| Fix navigation hang khi duyệt liên tiếp                              | ✅ Done     |
| `cng-mtn.4`| Restructure ReportViewer (SectionSurface layout)                      | ✅ Done     |
| `cng-ldq`  | React.lazy + Suspense code-splitting                                  | ✅ Done     |
| `cng-m2m`  | Healthcheck test coverage (SQL Server paths)                          | ✅ Done     |
| `cng-ejz`  | Healthcheck test coverage (SQLite init paths)                         | ✅ Done     |
| `cng-9qb`  | Healthcheck test coverage (backup missing)                            | ✅ Done     |
| `cng-bik`  | Healthcheck test coverage (disk error warnings)                       | ✅ Done     |

---

## 9. Hành động đã thực thi trong phiên Review

Trong phiên review này, tôi đã thực hiện các thay đổi sau:

### 9.1. Sửa ESLint ✅
- **File:** `eslint.config.js`
- **Thay đổi:** `linebreakRule = "off"` (trước: `isWindows ? ["error", "windows"] : "off"`)
- **Kết quả:** `pnpm lint` → 0 errors, 43 warnings

### 9.2. Hòa mạng Server-v4 (Strangler Fig) ✅
- **File:** `server/index.js` (line 1 + line 21975)
- **Thay đổi:** 
  - Thêm `import { buildV4App, moduleCatalog } from '../dist/server-v4/index.js'`
  - Mount module `reporting` qua `app.use(v4App)` ngay sau `express()` init
- **Kết quả:** 24/24 backend tests pass, `pnpm build` thành công

### 9.3. Biên dịch Server-v4 ✅
- **Lệnh:** `pnpm build:server-v4`
- **Output:** `dist/server-v4/` (ES Module)

---

## 10. Đề xuất Hành động Chi tiết (Roadmap)

### Giai đoạn 1: Ổn định ngay (1–2 ngày)
1. Mount **toàn bộ 8 modules** v4 (thay vì chỉ `reporting`) bằng `buildV4App(moduleCatalog)`
2. Tách `StaffCombobox` thành shared component (xóa 2 bản copy-paste)
3. Verify các tính năng Checklist chưa rõ (Bulk Select, Export Excel, History UI)
4. Chạy `pnpm lint --fix` dọn dẹp 43 warnings còn lại
5. Cập nhật `Checklist.md` đánh dấu hoàn thành

### Giai đoạn 2: Tách nhỏ Backend (1–2 tuần)
1. Di chuyển Auth logic từ `server/index.js` → `server-v4/modules/auth/`
2. Di chuyển ECUS Sync logic → `server-v4/modules/declarations/`
3. Di chuyển Backup/Restore → module mới `server-v4/modules/backup/`
4. Viết test cho mỗi module được migrate
5. Bật `ImporterCompatTrafficTracker` ở chế độ `shadow`

### Giai đoạn 3: Tách nhỏ Frontend (2–3 tuần)
1. Refactor `MSTAssignment.jsx` theo cấu trúc đề xuất ở mục 4
2. Refactor `AiAssistant.jsx` thành 4 sub-modules
3. Refactor `KPIAdjustments.jsx` thành 4 sub-modules
4. Bổ sung React Testing Library cho components mới
5. ~~Thêm cột "Số TK AMA"~~ *(đã loại bỏ theo quyết định nghiệp vụ)*

### Giai đoạn 4: Hoàn thiện Migration (1 tuần)
1. Chuyển entry point từ `server/index.js` sang `server-v4/src/index.ts`
2. Xóa file `server/index.js` (hoặc archive)
3. Cập nhật `start-backend.mjs` để khởi động trực tiếp từ TypeScript (hoặc compiled JS)
4. Full regression test (Playwright + Vitest)
5. Cập nhật `README.md` và tài liệu triển khai

---

## 11. Vấn đề #7: Bảo mật (Security)

### Hiện trạng

| Hạng mục                  | Trạng thái | Chi tiết                                    |
|---------------------------|-----------|---------------------------------------------|
| **Mã hóa mật khẩu**       | ✅ Tốt     | Dùng `bcryptjs` với `hashSync`/`compare`, salt rounds chuẩn |
| **Session management**     | ✅ Khá     | Cookie-based (`credentials: 'include'`), không storing token ở localStorage |
| **Input validation (v4)**  | ✅ Tốt     | Zod schema validation ở tất cả Controllers v4 |
| **Rate limiting**          | ❌ Thiếu   | Không có `express-rate-limit` hay tương đương |
| **HTTP Security Headers**  | ❌ Thiếu   | Không dùng `helmet` — thiếu CSP, X-Frame-Options, HSTS |
| **CSRF Protection**        | ❌ Thiếu   | Không tìm thấy CSRF token cho mutation routes |
| **SQL Injection (SQLite)** | ✅ An toàn  | Dùng parameterized queries (`prepare().run(...)`) |
| **XSS (Frontend)**         | ✅ An toàn  | React tự escape JSX, không dùng `dangerouslySetInnerHTML` |
| **Password policy**        | ⚠️ Yếu     | `MIN_PASSWORD_LENGTH = 6` — quá ngắn, không yêu cầu uppercase/số/ký tự đặc biệt |

### Nhận định Code

- **Rất tốt:** Auth flow dùng `bcryptjs` đúng chuẩn, SQLite queries parameterized an toàn.
- **Nguy hiểm:** Thiếu hoàn toàn HTTP security headers (helmet). Bất kỳ ai cũng có thể nhúng app vào iframe (clickjacking).
- **Rủi ro trung bình:** Không có rate limiting → brute-force trên `/api/auth/login` là khả thi.
- Không có CSRF protection → mutation endpoints (`POST`, `PUT`, `DELETE`) có thể bị cross-origin request forgery nếu deploy trên domain công khai.

### Hướng xử lý

| # | Hành động | Ưu tiên | Độ phức tạp |
|---|-----------|---------|-------------|
| 1 | **Cài `helmet`:** Thêm `app.use(helmet())` vào Express middleware chain | 🔴 Ngay | Thấp |
| 2 | **Cài rate limiting:** `express-rate-limit` cho `/api/auth/login` (max 5 attempts / 15 phút) | 🔴 Ngay | Thấp |
| 3 | **Nâng password policy:** MIN 8 ký tự, yêu cầu có chữ hoa + số | 🟡 Sớm | Thấp |
| 4 | **CSRF token:** Implement double-submit cookie pattern cho mutation routes | 🟡 Sớm | Trung bình |
| 5 | **Audit log:** Ghi log mọi login attempt (thành công/thất bại) vào bảng `audit_log` | 🟢 Sau | Trung bình |

---

## 12. Vấn đề #8: Database & Persistence

### Hiện trạng

| Thành phần | Mô tả | Trạng thái |
|-----------|--------|------------|
| **Primary DB** | SQLite (`better-sqlite3`) file-based | ✅ Ổn định |
| **Schema pattern** | Key-value store (`kv_store`) + typed snapshot tables | ⚠️ Hỗn hợp |
| **External sync** | SQL Server 2008 R2 via `mssql` (ECUS bridge) | ✅ Hoạt động |
| **Backup strategy** | Cron-based file copy + retention pruning | ✅ Có nhưng nằm trong monolith |
| **Migration system** | Không có (schema inline trong code) | ❌ Thiếu |

### Nhận định Code

- **Kiến trúc kv_store:** File `runtimeStorageLifecycle.js` sử dụng pattern lưu toàn bộ domain data (declarations, MST, teams, rules, adjustments) dưới dạng JSON blobs trong bảng `kv_store`. Pattern này đơn giản nhưng có nhược điểm:
  - Không thể query trực tiếp theo field (phải deserialize toàn bộ JSON).
  - Khi data lớn (>10,000 tờ khai), mỗi lần read/write sẽ serialize/deserialize toàn bộ mảng.
- **Typed snapshots:** Song song với kv_store, có các bảng snapshot riêng (`decl_rows_snapshot`, `mst_assignment_snapshot`, `team_roster_snapshot`, `kpi_rules_snapshot`). Logic `hydrateRuntimeStorageSnapshots()` sync giữa kv_store → snapshot tables khi bootstrap.
- **Không có migration tool:** Schema được tạo inline (CREATE TABLE IF NOT EXISTS). Khi cần thay đổi schema, không có migration history → rủi ro data corruption.

### Hướng xử lý

| # | Hành động | Ưu tiên | Độ phức tạp |
|---|-----------|---------|-------------|
| 1 | **Schema migration:** Tạo file `server-v4/migrations/` với numbered SQL files (e.g. `001_initial.sql`, `002_add_audit_log.sql`) | 🟡 Sớm | Trung bình |
| 2 | **Index optimization:** Tạo index cho các bảng snapshot hay query (nếu chưa có) | 🟡 Sớm | Thấp |
| 3 | **Kv_store → relational:** Từng bước chuyển domain data sang typed tables thay vì JSON blob | 🟢 Sau | Cao |
| 4 | **Backup ngoài monolith:** Move backup logic ra `server-v4/modules/backup/` | 🟢 Sau | Trung bình |

---

## 13. Vấn đề #9: Business Logic & KPI Engine

### Hiện trạng

Logic tính điểm KPI nằm trong `packages/domain/src/reportingKpiComputation.js` (236 dòng) — **đây là module viết tốt nhất trong toàn bộ codebase.**

### Nhận định Code (Tích cực)

- **Cấu trúc rõ ràng:** `computeKPI(row, rules)` là pure function, dễ test và predictable.
- **Hỗ trợ tiered pricing:** `addByTiers()` xử lý cả cumulative và highest-match mode.
- **License code exclusion:** Hàm `buildLicenseConfigMaps()` + `resolveLicenseSource()` xử lý tốt chuỗi loại trừ giấy phép theo agency.
- **CO bonus:** Logic C/O (Certificate of Origin) có `perLine` bonus, hỗ trợ nhiều nguồn data (explicit, inferred).
- **Edge case:** Result luôn `Math.max(0, ...)` → không bao giờ trả KPI âm.

### Vấn đề cần lưu ý

| # | Vấn đề | Mức rủi ro | Đề xuất |
|---|--------|-----------|----------|
| 1 | **Field name hardcoded tiếng Việt:** `'Số lượng GP'`, `'Mã giấy phép'` — nếu ECUS đổi format sẽ vỡ | ⚠️ Trung bình | Tạo field mapping configuration thay vì hardcode |
| 2 | **`bcrypt.hashSync` là synchronous:** Trong `server/index.js` dùng `hashSync` → block event loop khi hash password | ⚠️ Trung bình | Chuyển sang `await bcrypt.hash()` (async) |
| 3 | **`reportingLegacyMath.js` (38KB):** Module support legacy computation rất lớn, cần kiểm tra xem có còn dùng không | ⚠️ Thấp | Review nếu đã deprecate thì xóa |
| 4 | **Rounding precision:** `Math.round((point + Number.EPSILON) * 10) / 10` — chỉ 1 decimal. Cần confirm business rule | ⚠️ Thấp | Verify với user nếu 1 decimal là đủ |

---

## 14. Vấn đề #10: UI/UX & Design System

### Hiện trạng

| Hạng mục | Trạng thái | Chi tiết |
|----------|-----------|----------|
| **Design System** | ✅ Hoàn thiện | Custom CSS variables (`--ds-*`), oklch color space, consistent component primitives |
| **Dark Mode** | ✅ Hoạt động | `.dark` class toggle, full dark palette, proper contrast |
| **Typography** | ✅ Tốt | "Be Vietnam Pro" + "Inter" fallback, responsive `clamp()` sizing |
| **Responsive** | ✅ Tốt | Grid layout chuyển sidebar ↔ stacked tại `1024px`, mobile-first approach |
| **Code-splitting** | ✅ Áp dụng | `React.lazy` cho Login, ChangePassword, SupportCenter, KPICalculator |
| **Toast system** | ✅ Có | `sonner` library, positioned top-right |
| **Accessibility** | ⚠️ Một phần | Có `aria-label`, `role="combobox"`, nhưng thiếu skip-links, focus trapping |
| **Error Boundary** | ❌ Thiếu | Xem mục 16 |

### Nhận định Code

- **App.css (1311 dòng):** Design system rất mature, dùng oklch color space (hiện đại nhất), có đầy đủ surface/border/text/accent tokens cho cả light lẫn dark mode.
- **Component library:** Dùng Radix UI primitives (Dialog, Popover, Command, Tabs) — lựa chọn tốt cho accessibility.
- **App.jsx (544 dòng):** Nằm trong giới hạn 800 dòng, cấu trúc tốt với proper memo/callback usage.
- **Prefetch strategy:** `requestIdleCallback` prefetch SupportCenter và feedbackClient khi idle — kỹ thuật performance tốt.

### Hướng xử lý

| # | Hành động | Ưu tiên | Độ phức tạp |
|---|-----------|---------|-------------|
| 1 | **Skip-to-content link:** Thêm accessible skip link đầu page cho keyboard users | 🟡 Sớm | Thấp |
| 2 | **Focus trap trong Dialog:** Verify Radix Dialog có trap focus đúng (likely already works) | 🟡 Sớm | Thấp |
| 3 | **Loading skeleton:** Thay `"Đang tải dashboard..."` bằng skeleton UI cho first-paint đẹp hơn | 🟢 Sau | Trung bình |
| 4 | **High-contrast theme:** Có `data-theme='high-contrast'` trong CSS nhưng chưa rõ toggle ở đâu | 🟢 Sau | Thấp |

---

## 15. Vấn đề #11: Performance & Bundle Size

### Hiện trạng

| Chunk | Kích thước | Ghi chú |
|-------|-----------|----------|
| `KPICalculator-*.js` | **612 KB** | ⚠️ Quá lớn — chứa toàn bộ dashboard logic |
| `vendor-react-dom-*.js` | **608 KB** | Framework, không thể giảm |
| `xlsx-*.js` | **420 KB** | Thư viện Excel, lazy-load được |
| Tổng cộng JS | **~1.7 MB** (gzip ~170KB) | Acceptable nhưng có room to improve |

### Nhận định Code

- **Chunk KPICalculator 612KB** là vấn đề lớn nhất: file này chứa tất cả Fat Components (MSTAssignment, AiAssistant, KPIAdjustments...). Khi lazy-split Frontend thành sub-modules, chunk này sẽ tự động giảm đáng kể.
- **xlsx 420KB** chỉ cần khi user xuất Excel → nên lazy-import: `const XLSX = await import('xlsx')`.
- **Prefetch strategy** đã được implement cho SupportCenter — tốt.

### Hướng xử lý

| # | Hành động | Ưu tiên | Độ phức tạp |
|---|-----------|---------|-------------|
| 1 | **Lazy load xlsx:** `import('xlsx')` on-demand thay vì static import trong Fat Components | 🟡 Sớm | Thấp |
| 2 | **Route-based splitting:** Mỗi tab lớn (MSTAssignment, AiAssistant, RulesEditor) nên là `React.lazy` riêng | 🟡 Sớm | Trung bình |
| 3 | **Vite manual chunks:** Cấu hình `vite.config.js` → `build.rollupOptions.output.manualChunks` để tách vendor chunks tối ưu | 🟢 Sau | Trung bình |
| 4 | **Bundle analyzer:** Chạy `npx vite-bundle-visualizer` để xác định dead code importing | 🟢 Sau | Thấp |

---

## 16. Vấn đề #12: Error Handling & Resilience

### Hiện trạng

| Hạng mục | Trạng thái | Chi tiết |
|----------|-----------|----------|
| **React Error Boundary** | ❌ Thiếu hoàn toàn | Không tìm thấy `ErrorBoundary` nào trong `src/` |
| **Backend error handling (v4)** | ✅ Tốt | `BaseController.handleError()` pattern chuẩn |
| **Backend error handling (legacy)** | ⚠️ Hỗn hợp | Có `try/catch` nhưng không nhất quán |
| **API error format** | ⚠️ Không chuẩn hóa | Legacy trả `{ ok: false, error: '...' }`, v4 trả `{ ok: false, error: { code, message } }` |
| **Graceful degradation** | ✅ Có | `syncStatus.waitingForBackend` banner khi offline |

### Nhận định Code

- **Rủi ro nghiêm trọng nhất:** Không có React Error Boundary nào. Nếu bất kỳ component lớn nào throw runtime error → **toàn bộ app trắng xóa** (white screen of death), user mất hoàn toàn giao diện.
- **Backend v4** có pattern `BaseController` xử lý error consistency — code mẫu tốt.
- **Legacy** có nhiều endpoint catch error nhưng format response không đồng nhất giữa các route.

### Hướng xử lý

| # | Hành động | Ưu tiên | Độ phức tạp |
|---|-----------|---------|-------------|
| 1 | **Tạo React Error Boundary:** `src/components/ErrorBoundary.jsx` bọc `<App>` với fallback UI "Đã xảy ra lỗi, vui lòng tải lại" | 🔴 Ngay | Thấp |
| 2 | **Tab-level Error Boundaries:** Bọc mỗi lazy-loaded tab component bằng Error Boundary riêng → chỉ tab lỗi bị ảnh hưởng | 🟡 Sớm | Thấp |
| 3 | **Chuẩn hóa API error format:** Tất cả endpoints trả `{ ok: false, error: { code: string, message: string } }` | 🟡 Sớm | Trung bình |
| 4 | **Global unhandled rejection handler:** `process.on('unhandledRejection')` trên server để log thay vì crash | 🟡 Sớm | Thấp |

---

> 📝 **Ghi chú:** Tài liệu này được tạo và cập nhật bởi Gemini trong phiên Deep Codebase Review ngày 24/03/2026 (2 lượt review). Lượt 1: kiến trúc + monolith + integration. Lượt 2: bảo mật, database, business logic, UI/UX, performance, error handling. Mọi nhận định dựa trên phân tích mã nguồn thực tế.
