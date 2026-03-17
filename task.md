# Task Tracker

## Active Slice

- Title: Remediation backlog for app shell and report UX audit
- Bead: `cng-mtn`
- Status: open
- Last updated: 2026-03-17
- Current implementation status:
  - `cng-mtn.1` completed
  - `cng-mtn.2` next up

## Goal

- Chuyển toàn bộ phát hiện UI/UX đã audit thành backlog beads có thể làm dần.
- Tách phạm vi theo các slice độc lập để sửa shell, mobile UX, report workflow, và guardrails mà không chồng chéo.
- Giữ notebook đủ rõ để session sau có thể pick bead tiếp theo mà không phải điều tra lại từ đầu.

## Current Scope

1. Hoàn tất `cng-mtn.1` bằng cách loại bỏ xung đột styling trong shell sidebar tabs.
2. Khóa regression bằng test đơn vị cho `TabsTrigger/TabsList` và Playwright coverage cho shell sidebar.
3. Cập nhật notebook + bead state để session kế tiếp chuyển thẳng sang `cng-mtn.2`.

## Completion Criteria

- Mỗi vấn đề chính từ audit được map sang ít nhất một bead rõ phạm vi.
- Có thứ tự triển khai đề xuất để tránh sửa chồng chéo shell/report/mobile.
- Notebook phản ánh đúng epic hiện tại và danh sách bead con liên quan.
- `cng-mtn.1` không còn ghosting/overlap ở sidebar desktop và mobile trên build hiện tại.

## Notes

- Epic hiện tại: `cng-mtn`
- Child beads:
  - `cng-mtn.1` sidebar ghosting / shell navigation cleanup
  - `cng-mtn.2` responsive navigation + compact shell
  - `cng-mtn.3` sequential report tab navigation bug
  - `cng-mtn.4` report information architecture + mobile readability
  - `cng-mtn.5` report data pipeline profiling, only expanding to backend/database if evidence supports it
  - `cng-mtn.6` E2E guardrails for shell/report UX
- Tôi chưa thấy bằng chứng chắc chắn phải mở backend/database fix ngay. Vì vậy `cng-mtn.5` được tạo như bead điều tra có điều kiện, để không over-scope quá sớm.
- `cng-mtn.1` đã được xử lý bằng cách cho shell opt out khỏi default utility classes của tab primitives, thay vì tiếp tục fight CSS bằng override mạnh hơn.
