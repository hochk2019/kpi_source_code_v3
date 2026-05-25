// AuditLogFilters.jsx
// Filter controls for audit log table

import React from 'react';

export default function AuditLogFilters({
  filter,
  onFilterChange,
  typeFilter,
  onTypeFilterChange,
  availableCategories,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  onClear,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="text"
        value={filter}
        onChange={(e) => onFilterChange(e.target.value)}
        placeholder="Tìm kiếm..."
        className="rounded border px-3 py-1.5 text-sm"
      />
      <select
        value={typeFilter}
        onChange={(e) => onTypeFilterChange(e.target.value)}
        className="rounded border px-3 py-1.5 text-sm"
      >
        <option value="all">Tất cả loại</option>
        {availableCategories
          .filter((c) => c !== 'all')
          .map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
      </select>
      <input
        type="date"
        value={fromDate}
        onChange={(e) => onFromDateChange(e.target.value)}
        className="rounded border px-3 py-1.5 text-sm"
        placeholder="Từ ngày"
      />
      <input
        type="date"
        value={toDate}
        onChange={(e) => onToDateChange(e.target.value)}
        className="rounded border px-3 py-1.5 text-sm"
        placeholder="Đến ngày"
      />
      <button
        onClick={onClear}
        className="rounded border px-3 py-1.5 text-sm hover:bg-gray-100"
      >
        Xóa bộ lọc
      </button>
    </div>
  );
}
