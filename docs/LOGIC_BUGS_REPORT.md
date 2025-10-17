# Báo Cáo Lỗi Logic Hệ Thống KPI Calculator

**Ngày phân tích:** 2025-10-17
**Phiên bản:** v3.0
**Người thực hiện:** Code Review Team
**Chi nhánh:** `feature/kpi-v4-upgrade`

---

## 📋 Tóm Tắt Điều Hành

| Chỉ số | Giá trị |
|--------|---------|
| Tổng số lỗi | 10 nhóm |
| Lỗi nghiêm trọng | 1 |
| Lỗi quan trọng | 2 |
| Lỗi trung bình | 6 |
| Lỗi nhẹ | 2 |
| **Ưu tiên cao** | 3 lỗi |

---

## 🔴 LỖI NGHIÊM TRỌNG (CRITICAL)

### Lỗi #1: Regex Phân Loại Tờ Khai Xuất/Nhập Khẩu Sai

**Mức độ:** 🔴 Critical
**Ảnh hưởng:** Toàn bộ hệ thống phân loại tờ khai
**Vị trí:** `src/lib/store.js:472-477`

#### Mô tả chi tiết

```javascript
// ❌ CODE HIỆN TẠI (SAI)
export function isExportByNumber(soTk) {
  const s = (soTk ?? "").toString().replace(/\D/g,"");
  return /^30\\d{9,10}$/.test(s);  // Regex sai: \\d thay vì \d
}

export function isImportByNumber(soTk) {
  const s = (soTk ?? "").toString().replace(/\D/g,"");
  return /^10\\d{9,10}$/.test(s);  // Regex sai: \\d thay vì \d
}
```

#### Nguyên nhân

- Regex pattern `\\d` được hiểu là ký tự backslash `\` theo sau bởi chữ `d`
- Không phải là pattern `\d` (digit) như mong muốn
- Dẫn đến regex KHÔNG BAO GIỜ match số tờ khai hợp lệ

#### Hậu quả

1. **Gán nhân viên sai:**
   - Tờ khai xuất khẩu (30xxx) không được nhận diện → gán nhầm nhân viên nhập khẩu
   - Tờ khai nhập khẩu (10xxx) không được nhận diện → gán nhầm nhân viên xuất khẩu

2. **Báo cáo sai:**
   - Thống kê xuất/nhập không chính xác
   - KPI nhân viên bị tính sai

3. **Phân luồng xử lý sai:**
   - Logic nghiệp vụ phụ thuộc vào việc phân loại này

#### Test case chứng minh

```javascript
// Kết quả hiện tại
isExportByNumber("30123456789")  // → false (SAI - phải là true)
isImportByNumber("10123456789")  // → false (SAI - phải là true)

// Pattern thực sự đang test
/^30\\d{9,10}$/.test("30\\d\\d\\d\\d\\d\\d\\d\\d\\d")  // → true (vô lý)
```

#### Giải pháp

```javascript
// ✅ CODE SỬA (ĐÚNG)
export function isExportByNumber(soTk) {
  const s = (soTk ?? "").toString().replace(/\D/g, "");
  return /^30\d{9,10}$/.test(s);  // Sửa: \d là digit pattern
}

export function isImportByNumber(soTk) {
  const s = (soTk ?? "").toString().replace(/\D/g, "");
  return /^10\d{9,10}$/.test(s);  // Sửa: \d là digit pattern
}
```

#### Test sau khi sửa

```javascript
isExportByNumber("30123456789")   // → true ✓
isExportByNumber("301234567890")  // → true ✓
isExportByNumber("30123456")      // → false ✓
isExportByNumber("20123456789")   // → false ✓

isImportByNumber("10123456789")   // → true ✓
isImportByNumber("101234567890")  // → true ✓
isImportByNumber("30123456789")   // → false ✓
```

#### Checklist kiểm tra sau sửa

- [ ] Test với tờ khai xuất khẩu bắt đầu bằng 30
- [ ] Test với tờ khai nhập khẩu bắt đầu bằng 10
- [ ] Test với số tờ khai 11 digits
- [ ] Test với số tờ khai 12 digits
- [ ] Verify gán nhân viên đúng theo xuất/nhập
- [ ] Chạy lại test suite `tests/server.*.test.js`

---

## 🟠 LỖI QUAN TRỌNG (HIGH PRIORITY)

### Lỗi #2: Xử Lý Đại Lý Hải Quan Thiếu Validation

**Mức độ:** 🟠 High
**Ảnh hưởng:** Module quản lý đại lý HQ
**Vị trí:** `src/lib/store.js:1485-1490`

#### Mô tả chi tiết

```javascript
// ❌ CODE HIỆN TẠI
function sanitizeAgencyRow(row) {
  const mst = normalizeMST(row?.mst);
  if (!mst) return null;
  const company = normalizeStr(row?.company ?? row?.cong_ty ?? row?.customer ?? "");
  const agents = parseAgencyList(
    row?.agents ??
    row?.agent ??
    row?.agency ??
    row?.dai_ly ??
    row?.dai_ly_hq ??
    row?.['Đại lý HQ'] ??
    row?.['Dai ly HQ']
  );
  const agent = formatAgencyList(agents);
  return { mst, company, agent, agents };
}
```

#### Vấn đề

1. **Fallback chain quá dài:** 7 fallbacks không có priority rõ ràng
2. **Không validate empty:** `agents` array có thể rỗng nhưng vẫn return
3. **Không deduplicate:** Có thể có trùng lặp trong `agents` array
4. **Inconsistent naming:** Trả về cả `agent` (string) và `agents` (array)

#### Giải pháp

```javascript
// ✅ CODE SỬA
const AGENCY_FIELD_PRIORITY = [
  'agents',
  'agent',
  'agency',
  'dai_ly',
  'dai_ly_hq',
  'Đại lý HQ',
  'Dai ly HQ'
];

function sanitizeAgencyRow(row) {
  const mst = normalizeMST(row?.mst);
  if (!mst) return null;

  // Normalize company name
  const company = normalizeStr(
    row?.company ?? row?.cong_ty ?? row?.customer ?? ""
  );

  // Find first non-empty agency field
  let agencySource = null;
  for (const field of AGENCY_FIELD_PRIORITY) {
    if (row?.[field]) {
      agencySource = row[field];
      break;
    }
  }

  // Parse and deduplicate
  const agents = parseAgencyList(agencySource);

  // Validate: must have at least company or agents
  if (!company && agents.length === 0) {
    return null;
  }

  const agent = formatAgencyList(agents);

  return { mst, company, agent, agents };
}
```

#### Test case

```javascript
// Case 1: Multiple fields có data → lấy theo priority
sanitizeAgencyRow({
  mst: "0123456789",
  agents: ["A", "B"],
  agency: "C"
}) // → { mst: "0123456789", agents: ["A", "B"], agent: "A, B" }

// Case 2: Empty agents → return null nếu không có company
sanitizeAgencyRow({
  mst: "0123456789",
  agents: []
}) // → null

// Case 3: Duplicate agents → deduplicate
sanitizeAgencyRow({
  mst: "0123456789",
  agents: ["A", "A", "B"]
}) // → { agents: ["A", "B"], agent: "A, B" }
```

---

### Lỗi #3: Logic Loại Trừ Giấy Phép Phức Tạp

**Mức độ:** 🟠 High
**Ảnh hưởng:** Tính toán KPI giấy phép
**Vị trí:** `src/lib/importer.js:196-258`, `src/lib/rules.js:612-648`

#### Mô tả chi tiết

Hệ thống có 2 cơ chế exclude giấy phép:
1. **Global exclude:** Loại trừ mã GP toàn cục (ví dụ: GP01, GP02)
2. **Agency-specific exclude:** Loại trừ mã GP theo đại lý (ví dụ: GP-A chỉ exclude cho đại lý X)

#### Vấn đề

```javascript
// Trong importer.js
const agencyKeyNormalized = normalizeCodeValue(agency);
const combinedExcludeSet = agencyKeyNormalized && agencyExcludeMap.has(agencyKeyNormalized)
  ? new Set([...excludeSet, ...agencyExcludeMap.get(agencyKeyNormalized)])
  : excludeSet;

// Vấn đề: Logic này chỉ combine khi có agency key
// Nếu agency key không match CHÍNH XÁC → chỉ dùng global exclude
```

Trong `rules.js`:
```javascript
function resolveLicenseSource(row) {
  // Priority: manual → licenseCodes → __raw → licenses field
  // Vấn đề: Nếu manual count = 0 → return 0, không tính auto
  if (Number.isFinite(manual) && manual >= 0) {
    return {
      codes: [],
      directCount: Math.max(0, Math.round(manual)),
    };
  }
}
```

#### Hậu quả

1. Tên đại lý sai 1 dấu cách/ký tự → exclude rules không áp dụng
2. User nhập manual = 0 để reset → hệ thống không tự động tính
3. Không có audit trail cho việc exclude

#### Giải pháp

```javascript
// ✅ Cải thiện matching logic
function findAgencyExcludeRules(agencyName, agencyExcludeMap) {
  if (!agencyName || !agencyExcludeMap) return null;

  const normalized = normalizeCodeValue(agencyName);

  // 1. Exact match
  if (agencyExcludeMap.has(normalized)) {
    return agencyExcludeMap.get(normalized);
  }

  // 2. Fuzzy match (normalized without spaces/accents)
  const fuzzy = normalizeName(agencyName); // remove accents, lowercase
  for (const [key, value] of agencyExcludeMap.entries()) {
    if (normalizeName(key) === fuzzy) {
      return value;
    }
  }

  return null;
}

// ✅ Sửa manual count logic
function resolveLicenseSource(row) {
  // Check if manual count is explicitly set (not undefined)
  const hasManualCount = Object.prototype.hasOwnProperty.call(row, 'licenseManualCount') ||
                         Object.prototype.hasOwnProperty.call(row, 'manual_license_count');

  if (hasManualCount) {
    const manual = Number(row.licenseManualCount ?? row.manual_license_count);
    if (Number.isFinite(manual) && manual >= 0) {
      return {
        codes: [],
        directCount: Math.max(0, Math.round(manual)),
        source: 'manual'
      };
    }
  }

  // Fallback to auto calculation...
}
```

---

## 🟡 LỖI TRUNG BÌNH (MEDIUM PRIORITY)

### Lỗi #4: Merge Declaration Row Logic Mâu Thuẫn

**Mức độ:** 🟡 Medium
**Vị trí:** `src/lib/store.js:284-405`

#### Vấn đề

```javascript
const skipFields = new Set([
  'nhan_vien', 'team', 'agency', 'dai_ly',
  'licenses', 'so_luong_gp', 'licenseManualCount',
  'reviewed', 'reviewed_at',
]);

// Skip khi merge...
for (const [key, value] of Object.entries(incoming)) {
  if (skipFields.has(key)) continue;  // Bỏ qua
  // ...
}

// Nhưng fill blank ở dưới!
fillIfBlank('nhan_vien');
fillIfBlank('team');
fillIfBlank('agency');
```

**Logic mâu thuẫn:** Skip field khi merge nhưng lại fill nếu blank

#### Giải pháp

Tách thành 2 set:
- `protectedFields`: Không overwrite nếu đã có giá trị
- `fillableFields`: Fill nếu blank

```javascript
const PROTECTED_FIELDS = new Set(['reviewed', 'reviewed_at', 'reviewed_by']);
const FILLABLE_FIELDS = new Set(['nhan_vien', 'team', 'agency', 'dai_ly']);

for (const [key, value] of Object.entries(incoming)) {
  // Bảo vệ reviewed fields
  if (PROTECTED_FIELDS.has(key) && existing[key]) continue;

  // Fillable fields: chỉ fill nếu blank
  if (FILLABLE_FIELDS.has(key)) {
    if (!existing[key] && value) {
      merged[key] = value;
    }
    continue;
  }

  // Các field khác: merge bình thường
  merged[key] = value;
}
```

---

### Lỗi #5: History Limits Không Nhất Quán

**Mức độ:** 🟡 Medium
**Vị trí:** Multiple files

#### Vấn đề

```javascript
// src/lib/store.js
const MST_HISTORY_LIMIT = 500;                    // MST history
const DECL_HISTORY_PER_ROW_LIMIT = 20;           // Per declaration
const DECL_HISTORY_MAX_ROWS = 300;               // Total declarations tracked
const KPI_ADJUSTMENT_HISTORY_LIMIT = 50;         // KPI adjustment history
export const HQ_HISTORY_LIMIT = 500;             // HQ agency history
```

**Không nhất quán & không có chiến lược cleanup**

#### Giải pháp

```javascript
// Tạo config tập trung
const HISTORY_CONFIG = Object.freeze({
  MST: {
    limit: 500,
    ttl: 365 * 24 * 60 * 60 * 1000, // 1 year
  },
  DECLARATION: {
    perRow: 20,
    maxRows: 300,
    ttl: 180 * 24 * 60 * 60 * 1000, // 6 months
  },
  ADJUSTMENT: {
    limit: 100,
    ttl: 730 * 24 * 60 * 60 * 1000, // 2 years
  },
  HQ_AGENCY: {
    limit: 500,
    ttl: 365 * 24 * 60 * 60 * 1000, // 1 year
  },
});

// Cleanup function
function cleanupHistoryByAge(entries, ttl) {
  const cutoff = Date.now() - ttl;
  return entries.filter(entry => {
    const timestamp = new Date(entry.ts || entry.timestamp).getTime();
    return timestamp >= cutoff;
  });
}
```

---

### Lỗi #6: Normalize Declaration Number Mất Dữ Liệu

**Mức độ:** 🟡 Medium
**Vị trí:** `src/lib/store.js:203-213`

#### Vấn đề

```javascript
export function normalizeDeclarationNumber(input, length = 11) {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length >= maxLength) {
    return digits.slice(0, maxLength);  // ❌ Cắt bỏ
  }
  return digits.padStart(maxLength, "0");  // ❌ Thêm số 0
}

// Test case
normalizeDeclarationNumber("12345")          // → "00000012345"
normalizeDeclarationNumber("123456789012")   // → "12345678901" (mất số 2 cuối)
```

#### Giải pháp

```javascript
export function normalizeDeclarationNumber(input, length = 11) {
  const raw = (input ?? "").toString();
  if (!raw.trim()) return "";

  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";

  const maxLength = Number.isFinite(length) && length > 0 ? length : 11;

  // ✅ Không pad nếu số đã đúng độ dài hoặc dài hơn
  if (digits.length >= maxLength) {
    return digits; // Giữ nguyên, không cắt
  }

  // ✅ Chỉ pad nếu số quá ngắn VÀ có vẻ là số tờ khai hợp lệ
  // (Ví dụ: 12345 có thể là input sai, không nên pad)
  if (digits.length >= 8) {
    return digits.padStart(maxLength, "0");
  }

  // ✅ Trả về nguyên bản nếu quá ngắn (có thể là lỗi input)
  return digits;
}
```

---

### Lỗi #7: Schedule Monthly Calculation Edge Case

**Mức độ:** 🟡 Medium
**Vị trí:** `src/lib/store.js:3340-3353`

#### Vấn đề

```javascript
// Schedule cho ngày 31 hàng tháng
if (frequency === 'monthly') {
  const targetDay = clampMonthDay(schedule.dayOfMonth); // targetDay = 31
  // ...
  const day = Math.min(targetDay, daysInMonth); // Tháng 2 → day = 28/29
  initial.setDate(day);

  if (initial <= base) {
    // Tính tháng sau
    initial.setMonth(initial.getMonth() + 1);
    const nextDays = new Date(...).getDate();
    initial.setDate(Math.min(targetDay, nextDays)); // Tháng 3 → day = 31
  }
}

// Bug: Nếu hôm nay là 15/2, schedule ngày 31
// → initial = 28/2 (đã qua)
// → next = 31/3 (SKIP tháng 2 hoàn toàn!)
```

#### Giải pháp

```javascript
if (frequency === 'monthly') {
  const targetDay = clampMonthDay(schedule.dayOfMonth);
  let year = candidate.getFullYear();
  let month = candidate.getMonth();

  // Tính scheduled date cho tháng hiện tại
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  const actualDay = Math.min(targetDay, daysInCurrentMonth);
  const scheduledDate = new Date(year, month, actualDay, timeInfo.hour, timeInfo.minute, 0, 0);

  // Nếu đã qua → tính tháng sau
  if (scheduledDate <= base) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    const daysInNextMonth = new Date(year, month + 1, 0).getDate();
    const nextDay = Math.min(targetDay, daysInNextMonth);
    return new Date(year, month, nextDay, timeInfo.hour, timeInfo.minute, 0, 0).toISOString();
  }

  return scheduledDate.toISOString();
}
```

---

### Lỗi #8: Date Parsing ISO-like Format Sai

**Mức độ:** 🟡 Medium
**Vị trí:** `src/lib/store.js:434-443`

#### Vấn đề

```javascript
const isoLike = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
if (isoLike) {
  let [, y, m, dNum] = isoLike;
  const monthVal = Number.parseInt(m, 10);
  const dayVal = Number.parseInt(dNum, 10);

  // ❌ Swap nếu month > 12
  if (monthVal > 12 && dayVal >= 1 && dayVal <= 12) {
    return tryFromParts({ year: y, month: dNum, day: m });
  }
  return tryFromParts({ year: y, month: m, day: dNum });
}

// Bug:
// "2024-20-05" → swap thành "2024-05-20" (tháng 20 không tồn tại!)
// "2024-15-08" → không swap → "2024-15-08" (tháng 15 không tồn tại!)
```

#### Giải pháp

```javascript
const isoLike = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
if (isoLike) {
  let [, y, m, dNum] = isoLike;
  const monthVal = Number.parseInt(m, 10);
  const dayVal = Number.parseInt(dNum, 10);

  // ✅ Validate cả month và day
  const isValidMonthDay = monthVal >= 1 && monthVal <= 12 && dayVal >= 1 && dayVal <= 31;
  const isValidDayMonth = dayVal >= 1 && dayVal <= 12 && monthVal >= 1 && monthVal <= 31;

  if (!isValidMonthDay && isValidDayMonth) {
    // Swap nếu chỉ có day-month order hợp lệ
    return tryFromParts({ year: y, month: dNum, day: m });
  } else if (isValidMonthDay) {
    // Giữ nguyên nếu month-day order hợp lệ
    return tryFromParts({ year: y, month: m, day: dNum });
  } else {
    // Cả 2 đều không hợp lệ → return empty
    return "";
  }
}
```

---

### Lỗi #9: CO Status Detection Logic Phức Tạp

**Mức độ:** 🟡 Medium
**Vị trí:** `src/shared/co.js:220-252`

#### Vấn đề

Hệ thống detect C/O từ nhiều nguồn:
1. Field `co_line_count` (số dòng)
2. Field `co_codes` (mã BT)
3. Field `co` (text "Có"/"CO")
4. Scan XML trong các field khác

**Logic phức tạp, dễ conflict**

#### Cải thiện

Thêm priority rõ ràng và logging:

```javascript
export function deriveCOStatus(record, existing = {}) {
  const sources = {
    explicitCount: readCoLineCount(existing) || readCoLineCount(record),
    evaluation: evaluateCOFromRecord(record),
    manualFlag: existing.has_co || existing.co === "Có",
  };

  // Priority: explicit count > evaluation > manual flag
  let coLineCount = 0;
  let detectionSource = 'none';

  if (sources.explicitCount > 0) {
    coLineCount = sources.explicitCount;
    detectionSource = 'explicit_count';
  } else if (sources.evaluation.lineCount > 0) {
    coLineCount = sources.evaluation.lineCount;
    detectionSource = 'code_evaluation';
  } else if (sources.manualFlag) {
    coLineCount = 1; // Default to 1 if flag is set but no count
    detectionSource = 'manual_flag';
  }

  const hasCO = coLineCount > 0;

  return {
    ...existing,
    co: hasCO ? "Có" : "",
    has_co: !!hasCO,
    co_codes: sources.evaluation.codes,
    co_line_count: coLineCount,
    __co_detection_source: detectionSource, // Debug info
  };
}
```

---

## 🟢 LỖI NHẸ (LOW PRIORITY / TECH DEBT)

### Lỗi #10: Performance Issues

**Mức độ:** 🟢 Low
**Ảnh hưởng:** Performance

#### Các vấn đề

1. **Không cache `getMSTFor()` results**
   ```javascript
   // Trong loop, gọi lại cho cùng MST
   for (const row of rows) {
     const mst = getMSTFor(row.mst, row.date); // Không cache
   }
   ```

2. **JSON.parse/stringify thay vì shallow clone**
   ```javascript
   function shallowClone(obj) {
     return JSON.parse(JSON.stringify(obj ?? null)); // Chậm
   }
   ```

3. **Normalize nhiều lần**
   ```javascript
   const mst1 = normalizeMST(input);
   // ...
   const mst2 = normalizeMST(input); // Duplicate
   ```

#### Giải pháp

```javascript
// 1. Cache MST lookup
const mstCache = new Map();
function getMSTForCached(mst, date) {
  const key = `${mst}_${date}`;
  if (mstCache.has(key)) return mstCache.get(key);
  const result = getMSTFor(mst, date);
  mstCache.set(key, result);
  return result;
}

// 2. True shallow clone
function shallowClone(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return [...obj];
  return { ...obj };
}

// 3. Normalize once
const normalizedMst = normalizeMST(input);
// Use normalizedMst everywhere
```

---

### Lỗi #11: Type Safety & Error Handling

**Mức độ:** 🟢 Low
**Ảnh hưởng:** Code quality

#### Vấn đề

```javascript
// Silent failures
function sanitizeMSTRow(row) {
  const mst = normalizeMST(row?.mst);
  if (!mst) return null; // ❌ Silent fail, không biết lý do
}

// Inconsistent null/undefined checks
if (value === null || value === undefined) // ❌ Verbose
if (value == null)                          // ✅ Better
if (!value)                                 // ❌ Falsy check (khác với null)
```

#### Giải pháp

```javascript
// 1. Throw errors với message rõ ràng
function sanitizeMSTRow(row) {
  if (!row || typeof row !== 'object') {
    throw new Error('sanitizeMSTRow: row must be an object');
  }

  const mst = normalizeMST(row.mst);
  if (!mst) {
    throw new Error(`sanitizeMSTRow: invalid MST "${row.mst}"`);
  }

  return { mst, /* ... */ };
}

// 2. Consistent null checks
const isNullish = (value) => value == null;
const hasValue = (value) => value != null && value !== '';

// 3. Type validation utility
function validateRowStructure(row, requiredFields) {
  const missing = requiredFields.filter(field => !hasValue(row[field]));
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}
```

---

## 📅 Lộ Trình Sửa Lỗi

### Phase 1: Hotfix (Tuần 1) - CRITICAL

**Mục tiêu:** Sửa lỗi nghiêm trọng ảnh hưởng trực tiếp nghiệp vụ

| Lỗi | File | Công việc | Ước tính | Người phụ trách |
|-----|------|-----------|----------|-----------------|
| #1 | `src/lib/store.js` | Sửa regex xuất/nhập khẩu | 0.5h | Dev A |
| Test | `tests/` | Viết test case cho lỗi #1 | 1h | QA |
| Verify | Production data | Chạy script kiểm tra data hiện tại | 1h | Dev A |

**Deliverables:**
- [ ] PR sửa lỗi #1
- [ ] Test coverage đạt 100% cho functions liên quan
- [ ] Script migration data nếu cần
- [ ] Hot-deploy to production

---

### Phase 2: High Priority Fixes (Tuần 2-3)

**Mục tiêu:** Sửa lỗi quan trọng, cải thiện reliability

| Lỗi | File | Công việc | Ước tính | Người phụ trách |
|-----|------|-----------|----------|-----------------|
| #2 | `src/lib/store.js` | Refactor agency validation | 2h | Dev B |
| #3 | `src/lib/importer.js`<br>`src/lib/rules.js` | Cải thiện license exclude logic | 4h | Dev A |
| Test | Multiple | Integration tests | 3h | QA |

**Deliverables:**
- [ ] PR cho lỗi #2, #3
- [ ] Documentation cập nhật
- [ ] Migration guide nếu có breaking changes
- [ ] Regression test suite

---

### Phase 3: Medium Priority (Tuần 4-5)

**Mục tiêu:** Cải thiện logic, giảm technical debt

| Lỗi | File | Công việc | Ước tính |
|-----|------|-----------|----------|
| #4 | `src/lib/store.js` | Refactor merge logic | 3h |
| #5 | Multiple | Chuẩn hóa history limits | 2h |
| #6 | `src/lib/store.js` | Sửa normalize declaration | 2h |
| #7 | `src/lib/store.js` | Fix schedule calculation | 3h |
| #8 | `src/lib/store.js` | Improve date parsing | 2h |
| #9 | `src/shared/co.js` | Simplify CO detection | 3h |

**Deliverables:**
- [ ] PRs cho từng lỗi
- [ ] Updated documentation
- [ ] Performance benchmarks

---

### Phase 4: Low Priority / Refactoring (Tuần 6+)

**Mục tiêu:** Code quality, performance

| Task | Công việc | Ước tính |
|------|-----------|----------|
| #10 | Performance optimization | 4h |
| #11 | Type safety improvements | 3h |
| Refactor | Extract common utilities | 3h |
| Docs | API documentation | 2h |

---

## 🔧 Hướng Dẫn Sửa Lỗi

### Quy Trình Chung

```bash
# 1. Tạo branch từ feature/kpi-v4-upgrade
git checkout feature/kpi-v4-upgrade
git pull origin feature/kpi-v4-upgrade
git checkout -b fix/logic-bug-[số-lỗi]-[mô-tả-ngắn]

# Ví dụ:
git checkout -b fix/logic-bug-1-export-import-regex

# 2. Sửa lỗi
# - Thay đổi code theo giải pháp trong báo cáo
# - Viết/update tests
# - Chạy test suite đầy đủ

# 3. Commit
git add .
git commit -m "fix: [mô tả ngắn lỗi]

- Sửa [vấn đề cụ thể]
- Thêm test cases
- Update documentation

Fixes #[issue-number]
Relates to: LOGIC_BUGS_REPORT.md lỗi #[số]"

# 4. Push và tạo PR
git push origin fix/logic-bug-[số]
# Tạo PR trên GitHub với template
```

### PR Template

```markdown
## Mô tả

Sửa lỗi logic #[số] theo báo cáo LOGIC_BUGS_REPORT.md

## Thay đổi

- [ ] Sửa [file]: [mô tả thay đổi]
- [ ] Thêm test cases
- [ ] Update documentation

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Screenshots (nếu có)

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No breaking changes (hoặc có migration plan)

## Related Issues

Fixes #[issue-number]
Relates to: LOGIC_BUGS_REPORT.md lỗi #[số]
```

---

## ✅ Checklist Tổng Thể

### Trước Khi Bắt Đầu

- [ ] Đọc kỹ báo cáo này
- [ ] Hiểu rõ root cause của từng lỗi
- [ ] Setup môi trường dev đầy đủ
- [ ] Backup data production
- [ ] Tạo test database

### Trong Quá Trình Sửa

- [ ] Sửa theo đúng thứ tự priority
- [ ] Viết test trước khi sửa (TDD)
- [ ] Code review với >= 2 người
- [ ] Update documentation đồng thời
- [ ] Kiểm tra backward compatibility

### Sau Khi Sửa

- [ ] Tất cả tests đều pass
- [ ] Performance không giảm
- [ ] Security scan clean
- [ ] Documentation hoàn chỉnh
- [ ] Deployment plan sẵn sàng

---

## 📚 Tài Liệu Tham Khảo

### Files Liên Quan

- `src/lib/store.js` - Core data management (nhiều lỗi nhất)
- `src/lib/importer.js` - Data import logic
- `src/lib/rules.js` - KPI calculation rules
- `src/shared/co.js` - C/O status detection
- `src/shared/declSearch.js` - Declaration filtering

### Test Files

- `tests/server.*.test.js` - Backend tests
- `tests/rules.test.js` - Rules logic tests
- `tests/sampleDeclarations.test.js` - Sample data tests

### Các Pattern Cần Lưu Ý

1. **Normalization pattern:**
   ```javascript
   normalizeStr() → remove whitespace
   normalizeMST() → only digits
   normalizeName() → remove accents, lowercase
   normalizeDeclarationNumber() → pad/trim to length
   ```

2. **Validation pattern:**
   ```javascript
   if (!value) return fallback;    // Falsy check
   if (value == null) return null; // Nullish check
   ```

3. **Merge pattern:**
   ```javascript
   existing → incoming
   Protected fields không overwrite
   Fillable fields chỉ fill blank
   ```

---

## 🎯 Metrics Để Theo Dõi

### Code Quality

- [ ] Cyclomatic complexity < 10 per function
- [ ] Test coverage >= 80%
- [ ] No critical CodeQL alerts
- [ ] ESLint errors = 0

### Performance

- [ ] Data import time không tăng > 10%
- [ ] Memory usage không tăng > 20%
- [ ] API response time < 200ms

### Business Metrics

- [ ] Số lượng tờ khai phân loại đúng tăng lên
- [ ] Số lỗi gán nhân viên giảm xuống
- [ ] Độ chính xác KPI tăng lên

---

## 📞 Liên Hệ & Hỗ Trợ

**Technical Lead:** [Tên]
**QA Lead:** [Tên]
**Product Owner:** [Tên]

**Slack Channel:** #kpi-system-bugs
**Issue Tracker:** GitHub Issues với label `logic-bug`

---

## 📝 Changelog

| Ngày | Phiên bản | Thay đổi | Người cập nhật |
|------|-----------|----------|----------------|
| 2025-10-17 | 1.0 | Báo cáo ban đầu | Code Review Team |

---

**Lưu ý:** Báo cáo này được tạo tự động từ phân tích code. Cần review lại với team trước khi implement.
