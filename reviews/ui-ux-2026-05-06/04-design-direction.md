# 04 — Design Direction & UX Principles

> Đây là **mệnh đề thiết kế** mà mọi slice phải tuân theo. Nếu code đề xuất vi phạm, slice cần được điều chỉnh.

---

## 1. Triết lý: "Ops Console — Quiet, Dense, Confident"

KPI Command là **công cụ điều hành nội bộ** cho operator nghiệp vụ. Khác với consumer app (Toss, Notion) ở 3 điểm:

| Tiêu chí | Consumer app | KPI Command (Ops console) |
|---------|--------------|---------------------------|
| Mật độ thông tin | thưa, nhiều khoảng trắng | **dày**, mỗi pixel có giá trị |
| Tone | thân thiện, vui tươi | **trung tính, chuyên nghiệp** |
| Hiệu suất | giải trí | **xong việc trong ít click nhất** |
| Color | nhiều sắc | **2-3 hue cố định** |
| Animation | có nhiều | **tối thiểu, không phân tâm** |

**Triết lý**: *"Quiet UI"* — tham khảo Linear, Plain, Height, Stripe Dashboard, Cron Calendar. Cảm giác:
- Im lặng, không "ồn"
- Trắng/xám chủ đạo, accent vàng/cam (brand) cho điểm nhấn
- Typography phẳng, đều
- Border thay vì shadow nặng
- Spacing vừa phải (không quá thoáng cũng không quá chật)

---

## 2. Color system

### 2.1 Brand: Gold (Golden Logistics)

Quyết định: **`--brand-500` (#f59e0b) là primary brand color**. Cobalt blue trở thành **info accent**.

### 2.2 Hierarchy

| Vai trò | Token | Use case |
|---------|-------|----------|
| **Primary action** | `--brand-500` (gold) | Chính: Save, Apply, Submit, CTA |
| **Secondary action** | `--ds-surface-card` + border | Cancel, Reset, Open dialog |
| **Tertiary** | text-only link | Navigate links, Show more |
| **Destructive** | `--ds-destructive` | Delete, Remove |
| **Info** | `--ds-info` (cobalt) | Banners, helper alerts |
| **Success** | `--ds-success` (green) | Confirm states, completed |
| **Warning** | `--ds-warning` (amber dark) | Caution, dirty state |

### 2.3 Bảng màu cuối

```css
:root {
  /* Brand gold — primary CTA, highlight */
  --brand-500: #f59e0b;       /* default */
  --brand-600: #d97706;       /* hover */
  --brand-700: #b45309;       /* active */
  --brand-50: #fffbeb;        /* subtle bg */
  --brand-100: #fef3c7;       /* selected bg */
  --brand-on-500: #ffffff;    /* text on brand */

  /* Neutral surfaces */
  --ds-surface-base: oklch(0.985 0.01 250);   /* page bg */
  --ds-surface-card: oklch(1 0 0);            /* card */
  --ds-surface-muted: oklch(0.965 0.014 250); /* hover bg, table zebra */
  --ds-surface-raised: oklch(0.99 0.008 250); /* tooltip, popover */

  /* Text */
  --ds-text-primary: oklch(0.21 0.02 250);    /* heading, body */
  --ds-text-secondary: oklch(0.4 0.018 250);  /* caption, label */
  --ds-text-muted: oklch(0.55 0.015 250);     /* helper, footer */

  /* Border */
  --ds-border-subtle: rgba(15,23,42, 0.08);   /* hairline */
  --ds-border-strong: rgba(15,23,42, 0.16);   /* divider */

  /* Semantic */
  --ds-info: #2563eb;
  --ds-success: #059669;
  --ds-warning: #d97706;
  --ds-destructive: #dc2626;
}
```

### 2.4 Cấm

- ❌ Không dùng cobalt làm primary CTA (chỉ info)
- ❌ Không dùng `bg-slate-*`, `bg-stone-*`, `text-zinc-*` raw — phải qua token
- ❌ Không gradient bg cho card (trừ hero dashboard tuỳ chọn)
- ❌ Không gradient text
- ❌ Không emoji icon (`📊`, `📈` ...) — dùng lucide icons

---

## 3. Typography

```css
:root {
  --ds-font-sans: "Be Vietnam Pro", "Inter", system-ui, ...;
  --ds-font-mono: "JetBrains Mono", "Fira Code", ...;
}
```

### 3.1 Scale

| Token | Size | Line | Use case |
|-------|------|------|----------|
| `text-2xs` | 11px | 1.4 | Pill badge text |
| `text-xs` | 12px | 1.4 | Helper, meta |
| `text-sm` | 13px | 1.5 | **Body default** |
| `text-base` | 14px | 1.5 | Important body |
| `text-lg` | 16px | 1.4 | Section title |
| `text-xl` | 18px | 1.3 | Page title |
| `text-2xl` | 20px | 1.2 | Hero title (compact) |
| `text-3xl` | 24px | 1.2 | Hero title (default) |

→ **Default body 13px**, không phải 14px. Mật độ cao hơn = ops console.

### 3.2 Cấm

- ❌ Không dùng `text-3xl`/`text-4xl` cho card title (chỉ hero)
- ❌ Không dùng `font-bold` cho body text (chỉ heading)
- ❌ Không dùng tracking wide (`tracking-[0.18em]`) trên text < 12px (đã thấy trong header App.tsx) → tăng lên 14px hoặc bỏ tracking

---

## 4. Spacing & Layout

### 4.1 Spacing scale (Tailwind)

| Mục | Spacing |
|-----|---------|
| Inside button | `px-3 py-1.5` (mobile), `px-4 py-2` (desktop) |
| Card padding | `p-4` (mobile), `p-5` (desktop) |
| Section gap | `space-y-4` |
| Page padding | `px-4 py-3` (mobile), `px-6 py-4` (desktop) |
| Toolbar gap | `gap-2` |
| Form field gap | `space-y-3` |

→ **Section gap 16px** thay vì 24px (`space-y-6` cũ). Mật độ cao hơn.

### 4.2 Border radius

```css
--ds-radius-xs: 0.25rem;  /* 4px — input, badge */
--ds-radius-sm: 0.375rem; /* 6px — button, small card */
--ds-radius-md: 0.5rem;   /* 8px — large card */
--ds-radius-lg: 0.75rem;  /* 12px — modal, dropdown */
--ds-radius-pill: 999px;
```

→ **Giảm radius** từ 8/12/16/20 → 4/6/8/12 → cảm giác **lean**, không "fluffy".

### 4.3 Shadow

```css
--ds-shadow-sm: 0 1px 2px rgba(15,23,42, 0.04);    /* dropdown */
--ds-shadow-md: 0 4px 8px rgba(15,23,42, 0.06);    /* modal */
--ds-shadow-lg: 0 12px 24px rgba(15,23,42, 0.08);  /* important overlay */
--ds-shadow-soft: 0 1px 3px rgba(15,23,42, 0.06);  /* card subtle */
```

→ **Bỏ `0 20px 60px`** kiểu lơ lửng. Card chủ yếu dùng border, không shadow.

### 4.4 Page layout

```
┌───────────────────────────────────────────────┐
│ Header (App.tsx) — 56px                       │
├──────────┬────────────────────────────────────┤
│          │ Page Header (compact) — 48px       │
│  Side    ├────────────────────────────────────┤
│  bar     │ Toolbar (filter/actions) — 48px    │
│  220px   ├────────────────────────────────────┤
│          │                                     │
│          │ Content (tabs trong page nếu cần)  │
│          │                                     │
│          │                                     │
│          │                                     │
│          │ (sticky bottom: BulkActionBar)     │
└──────────┴────────────────────────────────────┘
```

**Total chrome**: 56 + 48 + 48 = **152px** (cũ ~330px)

---

## 5. Iconography

- **Library**: `lucide-react` (đã có) — sticking với 1 lib
- **Size default**: 16px (sm), 20px (md), 24px (lg)
- **Stroke width**: 1.5 (default) hoặc 1.75 (action button)
- **Cấm**: emoji, font-awesome, custom SVG (trừ logo)

---

## 6. Motion

- **Default duration**: `150ms` — interactive feedback
- **Page transition**: `200ms` ease-out
- **Modal enter**: `200ms` ease-out + scale(0.96 → 1)
- **Cấm**: animation > 400ms cho UI feedback (chỉ hero/onboarding mới được)

```css
:root {
  --ds-duration-fast: 100ms;
  --ds-duration-md: 150ms;
  --ds-duration-slow: 200ms;
  --ds-easing-default: cubic-bezier(0.2, 0.8, 0.2, 1);
}
```

---

## 7. UX Principles

### 7.1 Information Density Triangle

Mỗi page cấu trúc theo:
1. **Top**: 1 dòng "ngữ cảnh" (page name + period + actions chính)
2. **Middle**: filter + table/chart (nội dung chính)
3. **Bottom**: pagination, secondary actions

**KHÔNG** có description card, workflow guide, "ghi chú", "sơ đồ" giữa hero và nội dung.

### 7.2 Progressive Disclosure

- **Tooltip** = info icon → click hoặc hover hiện tooltip
- **Collapsible** = panel có thể thu gọn (filter nâng cao, lịch sử)
- **Modal/Dialog** = action mở thêm form (không nhúng inline 8 fields)
- **Tabs trong page** = data subviews (Nhân viên / Tổ đội / Xuất)

### 7.3 1 page = 1 primary action

Mỗi page có **1 button primary** (gold) — hành động chính của page đó.

| Page | Primary action |
|------|---------------|
| Dashboard | (none — read-only) |
| Import Data | "Tải file ECUS" |
| MST | "Lưu thay đổi" (chỉ active khi dirty) |
| HQ | "Lưu thay đổi" |
| Teams | "Lưu tổ đội" |
| Rules | "Áp dụng quy tắc" |
| Adjustments | "Thêm điều chỉnh" |
| Reports | "Xuất báo cáo" |
| Audit | (none) |

→ **Cấm 2 primary buttons cùng lúc** trên 1 page.

### 7.4 Empty state always

Mọi container hiển thị data **phải có empty state** với:
- Icon
- Title (1 dòng, mục đích cụ thể)
- Description (1-2 dòng, "vì sao trống")
- Action (optional, "làm gì để có data")

→ Không có bảng trống không message. Không có pie chart full màu khi 0 data.

### 7.5 Permissions = single banner + disabled UI

- **1 banner đầu page** giải thích quyền hạn (`<PermissionBanner>`)
- **UI disabled** cho action không có quyền (button grey, tooltip giải thích)
- **Không có 2 alerts xếp chồng** giải thích cùng quyền

### 7.6 Error states

- **Field error**: ngay dưới input, đỏ, icon
- **Form error**: trên đầu form, đỏ, có actionable hint
- **Page error**: full page với illustration + "Tải lại"
- **Toast** chỉ cho transient feedback (đã save, đã copy)

---

## 8. Accessibility (WCAG 2.2 AA)

- Color contrast text ≥ 4.5:1 cho < 18pt, ≥ 3:1 cho ≥ 18pt bold
- Focus indicator visible cho mọi interactive element
- Dialog có `aria-labelledby`, `aria-describedby`
- Form input có `<label htmlFor>` hoặc `aria-label`
- Tab navigation hợp lý (skip link, focus trap)
- Screen reader test cho 3 page chính (Dashboard, MST, Reports)

---

## 9. Comparison: BEFORE vs AFTER (mock)

### BEFORE (image 4 / 7 — current dashboard)

```
┌──────────────────────────────────────┐
│ Header (Golden Logistics ...)         │ 88px
├──────┬───────────────────────────────┤
│      │ Hero (eyebrow + title + ...)  │ 120px
│ Side │ ─── + role + info + user pill │
│ bar  │ ─── (8 lines text in section)│
│ 220  │ ─── ALL SIDEBAR EXPANDED     │
│      │ ─── (5 sections × 4 lines)    │ + 600px sidebar
│      │ Card "Chế độ khách"           │ 80px
│      │ ─── (period + reload)         │
│      │ Section "Tóm tắt điều hành" + │ 200px
│      │ description + 4 cards         │
│      │ Tín hiệu lệch chuẩn           │ 60px
│      │ 4 SummaryCards                │ 100px
│      │ Xu hướng + 2 pie + Top staff  │ 600px
│      │ Quick Actions 4 cards         │ 200px
│      │ ────────                       │
└──────┴───────────────────────────────┘
Total scroll: ~1500px
```

### AFTER (target)

```
┌──────────────────────────────────────┐
│ Header (Brand + status + θ)           │ 48px
├──────┬───────────────────────────────┤
│      │ Page header                    │ 48px
│ Side │ ─── Tổng quan KPI · 30/04 →   │
│ bar  │ 30/05 (i) [↻]                 │
│ 200  │ ────────                       │
│      │ 4 SummaryCards (2x2 mobile,   │ 100px
│      │ 4x1 desktop)                   │
│      │ Trend chart                   │ 240px
│      │ Pie distribution (or empty)   │ 240px
│      │ Top staff list                 │ 160px
└──────┴───────────────────────────────┘
Total scroll: ~840px (giảm 44%)
```

→ Mọi info quan trọng nằm trong viewport đầu tiên.

---

## 10. Design tokens cần BỔ SUNG

```css
/* Add to App.css :root */
--ds-radius-xs: 0.25rem;
--ds-radius-sm: 0.375rem;
--ds-radius-md: 0.5rem;
--ds-radius-lg: 0.75rem;
--ds-radius-pill: 999px;

--ds-shadow-sm: 0 1px 2px rgba(15,23,42, 0.04);
--ds-shadow-md: 0 4px 8px rgba(15,23,42, 0.06);
--ds-shadow-lg: 0 12px 24px rgba(15,23,42, 0.08);

--ds-duration-fast: 100ms;
--ds-duration-md: 150ms;
--ds-duration-slow: 200ms;
--ds-easing-default: cubic-bezier(0.2, 0.8, 0.2, 1);

/* Layout */
--ds-sidebar-width: 220px;
--ds-page-padding-x: 1rem;
--ds-page-padding-y: 0.75rem;
--ds-page-header-height: 3rem;

/* Density */
--ds-density-compact-row: 32px;
--ds-density-default-row: 40px;
--ds-density-relaxed-row: 48px;
```

→ Thêm vào `@/src/App.css:69-156` trong slice 1 (token foundation).
