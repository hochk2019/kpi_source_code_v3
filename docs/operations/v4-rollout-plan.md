# V4 Staged Rollout Plan

Tài liệu này định nghĩa gate bật traffic cho `server-v4` sau Phase 3.

## Gate API

Trước mỗi lần chuyển stage, kiểm tra:

- `GET /api/v4/health`
- `GET /api/v4/meta/rollout`

`/api/v4/meta/rollout` là nguồn truth cho:

- tình trạng đọc được legacy DB
- số module còn metadata-only
- stage hiện tại có thể công bố
- fallback checklist nếu gate chưa xanh

## Stages

### Stage 0: Baseline Health

Điều kiện:

- `health.dbFile.state = "ready"`
- `health.readiness.state != "blocked"`

Hành động:

- Chạy đầy đủ QA matrix trong [v4-qa-matrix.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-qa-matrix.md).
- Chỉ cho phép internal verification, chưa bật traffic nghiệp vụ mới.

Fallback:

- Nếu DB path mất hoặc unreadable, dừng rollout.
- Giữ toàn bộ operator traffic ở monolith `/api/*`.

### Stage 1: Internal QA

Điều kiện:

- `rollout.currentStage = "internal-qa"`
- Không có check `fail` trong `migrationVerification.checks`

Hành động:

- Cho QA nội bộ dùng `server-v4` health/meta/reporting routes song song với monolith.
- Theo dõi Data Health Dashboard và monitor ECUS hiện tại để chắc rằng monolith vẫn là write path ổn định.

Fallback:

- Nếu parity test fail hoặc readiness tụt xuống `blocked`, quay lại Stage 0.
- Không giữ traffic internal trên `server-v4` khi QA matrix còn đỏ.

### Stage 2: Module Parity

Điều kiện:

- `rollout.recommendedNextStage = "module-parity"` đã được giải quyết, tức không còn module metadata-only trong catalog public.

Hành động:

- Bật read traffic có kiểm soát cho các module đã đạt parity.
- So sánh output `server-v4` với monolith cho reporting/declarations/team/rules surfaces trước khi mở rộng tiếp.

Fallback:

- Nếu còn scaffold module trong catalog, không công bố parity đầy đủ.
- Nếu phải rút lại, xoá route mapping `v4` khỏi ingress/proxy và trả traffic về monolith ngay.

### Stage 3: Cutover Ready

Điều kiện:

- `rollout.currentStage = "cutover-ready"`
- Có ít nhất một module `read-write` đã qua QA matrix
- ECUS/backup/health monitor của monolith vẫn xanh để làm safety net

Hành động:

- Mở staged traffic theo nhóm operator nhỏ hoặc theo route cụ thể.
- Giữ monolith là fallback nóng cho toàn bộ write workflow cho đến khi đủ chu kỳ quan sát.

Fallback:

- Tắt route/proxy `server-v4` write traffic.
- Giữ monolith `/api/*` là production write path cho đến khi gate xanh lại.
- Re-run QA matrix trước khi thử mở lại.

## Suggested rollout order

1. `server-v4` health + rollout metadata
2. reporting read paths
3. declarations read/query paths
4. any write-capable route after parity + manual operator signoff

## Operator checklist

1. Chạy QA matrix.
2. Gọi `/api/v4/meta/rollout` và chụp lại payload vào ticket/issue rollout.
3. Xác nhận `health.readiness.state` không phải `blocked`.
4. Xác nhận monitor monolith vẫn healthy cho ECUS sync, SQL Server, backup.
5. Chỉ sau đó mới bật stage kế tiếp.
